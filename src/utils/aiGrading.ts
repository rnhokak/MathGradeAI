import { GoogleGenAI } from '@google/genai';
import {
  GradingResult,
  RubricData,
  StudentSubmission,
  TeacherSettings,
  AIProvider,
} from '@/types/grading';
import { buildGradingPrompt } from './promptBuilder';

/**
 * Robust JSON extractor from AI output that may contain markdown or surrounding text
 */
/**
 * Attempts to repair a truncated JSON string by closing unclosed braces/brackets
 * and trimming dangling incomplete fields.
 */
function repairTruncatedJson(raw: string): string {
  // Remove trailing incomplete key-value pair that caused truncation
  // e.g., ..."field": "incomplete string  → strip back to last valid comma or {
  let s = raw.trimEnd();

  // Remove trailing comma before trying to close
  s = s.replace(/,\s*$/, '');

  // Count unclosed braces and brackets
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  // If we're inside a string (unterminated), close it first
  if (inString) s += '"';

  // Remove trailing comma again after potential string close
  s = s.replace(/,\s*$/, '');

  // Close unclosed brackets and braces
  for (let i = 0; i < brackets; i++) s += ']';
  for (let i = 0; i < braces; i++) s += '}';

  return s;
}

export function extractJsonFromText(rawText: string): any {
  if (!rawText) {
    throw new Error('AI trả về phản hồi rỗng.');
  }

  // 1. Remove markdown code blocks if wrapped in ```json ... ``` or ``` ... ```
  let cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // 2. Try regex extraction of first outer balanced JSON object { ... }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch {
        // 3. JSON bị truncate — thử repair
        const truncated = cleaned.substring(firstBrace);
        try {
          const repaired = repairTruncatedJson(truncated);
          return JSON.parse(repaired);
        } catch (err: any) {
          throw new Error(
            `Không thể bóc tách JSON hợp lệ từ phản hồi AI: ${err.message || err}. Dữ liệu thô: ${cleaned.substring(0, 200)}...`
          );
        }
      }
    }
    throw new Error(
      `AI không trả về cấu trúc JSON hợp lệ: ${cleaned.substring(0, 200)}...`
    );
  }
}

/**
 * Standardizes parsed JSON into a valid GradingResult
 */
export function buildGradingResult(
  parsedJson: any,
  submission: StudentSubmission,
  rubric: RubricData
): GradingResult {
  const score = Number(parsedJson.score ?? 0);
  const maxScore = Number(parsedJson.maxScore ?? rubric.totalPoints);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    studentName: submission.studentName,
    submissionId: submission.id,
    score,
    maxScore,
    percentage,
    status: 'completed',
    gradedAt: new Date().toISOString(),
    strengths: Array.isArray(parsedJson.strengths) ? parsedJson.strengths : [],
    weaknesses: Array.isArray(parsedJson.weaknesses) ? parsedJson.weaknesses : [],
    generalComment: parsedJson.generalComment || '',
    criteriaBreakdown: Array.isArray(parsedJson.criteriaBreakdown)
      ? parsedJson.criteriaBreakdown.map((c: any, idx: number) => ({
          criterionId: c.criterionId || `crit-${idx + 1}`,
          criterionName: c.criterionName || `Tiêu chí ${idx + 1}`,
          maxPoints: Number(c.maxPoints ?? 0),
          awardedPoints: Number(c.awardedPoints ?? 0),
          isCorrect: c.isCorrect || (Number(c.awardedPoints) >= Number(c.maxPoints) ? 'full' : Number(c.awardedPoints) > 0 ? 'partial' : 'wrong'),
          reason: c.reason || '',
        }))
      : [],
    correctionGuide: parsedJson.correctionGuide || '',
    teacherComment: parsedJson.teacherComment || '',
    stepByStepAnalysis: parsedJson.stepByStepAnalysis || undefined,
    knowledgeToReview: parsedJson.knowledgeToReview || undefined,
  };
}

/**
 * Grade using Google Gemini AI
 */
export async function gradeWithGemini(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string
): Promise<{ gradingResult: GradingResult; modelUsed: string }> {
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Google Gemini API Key. Vui lòng vào Cài Đặt để nhập API Key, hoặc khai báo biến GEMINI_API_KEY trong file .env.local.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents: any[] = [];

  // 1. Add images
  if (submission.images && submission.images.length > 0) {
    for (const imgUrl of submission.images) {
      const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contents.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }
  }

  // 2. Add prompt
  const promptText = buildGradingPrompt(
    rubric,
    submission.studentName,
    settings,
    submission.extractedText
  );
  contents.push(promptText);

  // Candidate models fallback
  const userModel = settings.geminiModel || settings.model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const cleanPreferred = userModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : userModel;
  const candidates = Array.from(
    new Set([cleanPreferred, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'])
  );

  let response: any = null;
  let modelUsed = cleanPreferred;
  let lastError: any = null;

  for (const m of candidates) {
    try {
      response = await ai.models.generateContent({
        model: m,
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      modelUsed = m;
      break;
    } catch (err: any) {
      console.warn(`Gemini model ${m} failed (${err.message || err}), trying next candidate...`);
      lastError = err;
    }
  }

  if (!response) {
    throw lastError || new Error('Không thể kết nối đến mô hình Google Gemini.');
  }

  const textOutput = response.text || '';
  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  return { gradingResult, modelUsed };
}

/**
 * Grade using Anthropic Claude API (Claude 3.7 Sonnet, Claude 3.5 Sonnet, etc.)
 */
export async function gradeWithClaude(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string
): Promise<{ gradingResult: GradingResult; modelUsed: string }> {
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Anthropic Claude API Key. Vui lòng vào Cài Đặt (chọn mục Claude) để nhập API Key, hoặc khai báo ANTHROPIC_API_KEY trong file .env.local.'
    );
  }

  const baseUrl = (settings.claudeBaseUrl || process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1').replace(
    /\/+$/,
    ''
  );
  let model = settings.claudeModel || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  // Fallback for legacy models that return 404 on current Anthropic account tier
  const legacyClaudeModels = [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ];
  if (legacyClaudeModels.includes(model)) {
    console.warn(`Claude model "${model}" is not available on this API key. Auto-redirecting to claude-sonnet-4-6.`);
    model = 'claude-sonnet-4-6';
  }

  const promptText = buildGradingPrompt(
    rubric,
    submission.studentName,
    settings,
    submission.extractedText
  );

  // Build Claude message content blocks
  const contentBlocks: any[] = [];

  // Add handwriting scans / images
  if (submission.images && submission.images.length > 0) {
    for (const imgUrl of submission.images) {
      const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        let mime = match[1].toLowerCase();
        // Claude supports jpeg, png, gif, webp
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)) {
          mime = 'image/jpeg';
        }
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mime,
            data: match[2],
          },
        });
      }
    }
  }

  // Add the pedagogical prompt
  contentBlocks.push({
    type: 'text',
    text: promptText,
  });

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    }),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      // ignore
    }
    throw new Error(`Lỗi từ Claude API (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const textOutput =
    data.content
      ?.filter((b: any) => b.type === 'text')
      ?.map((b: any) => b.text)
      ?.join('\n') || '';

  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  return { gradingResult, modelUsed: model };
}

/**
 * Grade using OpenAI / OpenAPI-compatible API (GPT-4o, GPT-4o-mini, o3-mini, OpenRouter, DeepSeek, etc.)
 */
export async function gradeWithOpenAI(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string
): Promise<{ gradingResult: GradingResult; modelUsed: string }> {
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình OpenAI / OpenAPI API Key. Vui lòng vào Cài Đặt (chọn mục OpenAI) để nhập API Key, hoặc khai báo OPENAI_API_KEY trong file .env.local.'
    );
  }

  const baseUrl = (
    settings.openaiBaseUrl ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  ).replace(/\/+$/, '');

  const model = settings.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o';

  const promptText = buildGradingPrompt(
    rubric,
    submission.studentName,
    settings,
    submission.extractedText
  );

  // Build OpenAI content blocks
  const userContents: any[] = [
    {
      type: 'text',
      text: promptText,
    },
  ];

  // Add images
  if (submission.images && submission.images.length > 0) {
    for (const imgUrl of submission.images) {
      userContents.push({
        type: 'image_url',
        image_url: {
          url: imgUrl,
        },
      });
    }
  }

  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3');

  const requestBody: any = {
    model,
    messages: [
      {
        role: 'user',
        content: userContents,
      },
    ],
  };

  if (!isReasoningModel) {
    requestBody.temperature = 0.1;
    requestBody.response_format = { type: 'json_object' };
  }

  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  // If response_format caused an error on third-party OpenAPI proxies, retry without response_format
  if (!response.ok && requestBody.response_format) {
    delete requestBody.response_format;
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      // ignore
    }
    throw new Error(`Lỗi từ OpenAI / OpenAPI (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';

  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  return { gradingResult, modelUsed: model };
}

/**
 * Main dispatcher to grade with selected AI provider
 */
export async function gradeWithProvider(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  resolvedApiKey: string
): Promise<{ gradingResult: GradingResult; provider: AIProvider; modelUsed: string }> {
  const provider = settings.provider || 'claude';

  switch (provider) {
    case 'claude': {
      const { gradingResult, modelUsed } = await gradeWithClaude(
        submission,
        rubric,
        settings,
        resolvedApiKey
      );
      return { gradingResult, provider: 'claude', modelUsed };
    }
    case 'openai': {
      const { gradingResult, modelUsed } = await gradeWithOpenAI(
        submission,
        rubric,
        settings,
        resolvedApiKey
      );
      return { gradingResult, provider: 'openai', modelUsed };
    }
    case 'gemini':
    default: {
      const { gradingResult, modelUsed } = await gradeWithGemini(
        submission,
        rubric,
        settings,
        resolvedApiKey
      );
      return { gradingResult, provider: 'gemini', modelUsed };
    }
  }
}
