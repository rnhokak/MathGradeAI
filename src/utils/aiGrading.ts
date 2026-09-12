import { GoogleGenAI } from '@google/genai';
import {
  GradingResult,
  RubricData,
  StudentSubmission,
  TeacherSettings,
  AIProvider,
  ModelEvaluation,
  ConsensusReport,
  CriterionResult,
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
  apiKey: string,
  backupApiKey?: string
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
      const isKeyInvalid = /api_key_invalid|api key not valid/i.test(err.message || '');
      if (isKeyInvalid && backupApiKey && backupApiKey !== apiKey) {
        console.warn('[Gemini] Key trình duyệt không hợp lệ. Đang tự động chuyển sang server backup key từ .env.local...');
        return gradeWithGemini(submission, rubric, settings, backupApiKey);
      }
      if (isKeyInvalid) {
        break;
      }
    }
  }

  if (!response) {
    const rawMsg = lastError?.message || '';
    if (/api_key_invalid|api key not valid/i.test(rawMsg)) {
      throw new Error('Google Gemini: API Key không hợp lệ hoặc đã bị khóa/hết hạn.');
    }
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
  apiKey: string,
  backupApiKey?: string
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
    if ((response.status === 401 || /invalid x-api-key/i.test(errorDetail)) && backupApiKey && backupApiKey !== apiKey) {
      console.warn('[Claude] Key trình duyệt không hợp lệ (401). Đang tự động chuyển sang server backup key từ .env.local...');
      return gradeWithClaude(submission, rubric, settings, backupApiKey);
    }
    if (response.status === 401 || /invalid x-api-key/i.test(errorDetail)) {
      throw new Error('Anthropic Claude: API Key không hợp lệ hoặc đã hết hạn (401 Unauthorized).');
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
  apiKey: string,
  backupApiKey?: string
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
    if ((response.status === 401 || /invalid api key|incorrect api key/i.test(errorDetail)) && backupApiKey && backupApiKey !== apiKey) {
      console.warn('[OpenAI] Key trình duyệt không hợp lệ. Đang tự động chuyển sang server backup key từ .env.local...');
      return gradeWithOpenAI(submission, rubric, settings, backupApiKey);
    }
    if (/credit_balance_exhausted|insufficient_quota|you have no credits/i.test(errorDetail)) {
      throw new Error('OpenAI: Tài khoản hết số dư / hạn mức (Credit balance exhausted).');
    }
    if (response.status === 401 || /invalid api key|incorrect api key/i.test(errorDetail)) {
      throw new Error('OpenAI: API Key không hợp lệ (401 Unauthorized).');
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
  resolvedApiKey: string,
  backupApiKey?: string
): Promise<{ gradingResult: GradingResult; provider: AIProvider; modelUsed: string }> {
  const provider = settings.provider || 'claude';

  switch (provider) {
    case 'claude': {
      const { gradingResult, modelUsed } = await gradeWithClaude(
        submission,
        rubric,
        settings,
        resolvedApiKey,
        backupApiKey
      );
      return { gradingResult, provider: 'claude', modelUsed };
    }
    case 'openai': {
      const { gradingResult, modelUsed } = await gradeWithOpenAI(
        submission,
        rubric,
        settings,
        resolvedApiKey,
        backupApiKey
      );
      return { gradingResult, provider: 'openai', modelUsed };
    }
    case 'gemini':
    default: {
      const { gradingResult, modelUsed } = await gradeWithGemini(
        submission,
        rubric,
        settings,
        resolvedApiKey,
        backupApiKey
      );
      return { gradingResult, provider: 'gemini', modelUsed };
    }
  }
}

/**
 * Convert a GradingResult to a ModelEvaluation structure for cross-checking
 */
export function toModelEvaluation(
  provider: AIProvider,
  modelName: string,
  res: GradingResult
): ModelEvaluation {
  const awardedPointsByCriterion: Record<string, number> = {};
  const reasonsByCriterion: Record<string, string> = {};
  const isCorrectByCriterion: Record<string, 'full' | 'partial' | 'wrong'> = {};

  for (const c of res.criteriaBreakdown || []) {
    awardedPointsByCriterion[c.criterionId] = Number(c.awardedPoints ?? 0);
    reasonsByCriterion[c.criterionId] = c.reason || '';
    isCorrectByCriterion[c.criterionId] = c.isCorrect || 'wrong';
  }

  return {
    provider,
    modelName,
    score: res.score,
    maxScore: res.maxScore,
    awardedPointsByCriterion,
    reasonsByCriterion,
    isCorrectByCriterion,
    generalComment: res.generalComment,
    strengths: res.strengths,
    weaknesses: res.weaknesses,
    teacherComment: res.teacherComment,
  };
}

/**
 * Grade using 3 AI models (Gemini, Claude, OpenAI) simultaneously with the same prompt,
 * cross-check results against each other, and automatically re-grade if scores diverge.
 */
export async function gradeWithThreeModelsAndConsensus(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKeys: {
    gemini?: string;
    claude?: string;
    openai?: string;
  },
  backupKeys?: {
    gemini?: string;
    claude?: string;
    openai?: string;
  }
): Promise<{ gradingResult: GradingResult; consensusReport: ConsensusReport }> {
  const tolerance = settings.consensusTolerance ?? 0.25;
  const maxRetries = settings.maxRegradeRetries ?? 2;

  let roundCount = 1;
  let regradeCount = 0;
  let finalEvaluations: ModelEvaluation[] = [];
  let modelResults: { provider: AIProvider; result: GradingResult; model: string }[] = [];
  const accumulatedFailedModels: { provider: string; reason: string }[] = [];

  // Helper to run all 3 models in parallel with identical prompt and settings
  const runTripleEvaluation = async () => {
    const tasks: {
      provider: string;
      promise: Promise<{ provider: AIProvider; result: GradingResult; model: string }>;
    }[] = [];

    // 1. Google Gemini (Model 1)
    if (apiKeys.gemini) {
      tasks.push({
        provider: 'Google Gemini',
        promise: gradeWithGemini(submission, rubric, settings, apiKeys.gemini, backupKeys?.gemini).then(
          ({ gradingResult, modelUsed }) => ({
            provider: 'gemini' as AIProvider,
            result: gradingResult,
            model: modelUsed,
          })
        ),
      });
    }

    // 2. Anthropic Claude (Model 2)
    if (apiKeys.claude) {
      tasks.push({
        provider: 'Anthropic Claude',
        promise: gradeWithClaude(submission, rubric, settings, apiKeys.claude, backupKeys?.claude).then(
          ({ gradingResult, modelUsed }) => ({
            provider: 'claude' as AIProvider,
            result: gradingResult,
            model: modelUsed,
          })
        ),
      });
    }

    // 3. OpenAI GPT (Model 3) - Có tự động dự phòng sang Gemini 3.7/3.6 nếu OpenAI hết hạn mức (429)
    if (apiKeys.openai) {
      tasks.push({
        provider: 'OpenAI (GPT-4o)',
        promise: gradeWithOpenAI(submission, rubric, settings, apiKeys.openai, backupKeys?.openai)
          .then(({ gradingResult, modelUsed }) => ({
            provider: 'openai' as AIProvider,
            result: gradingResult,
            model: modelUsed,
          }))
          .catch(async (openAiErr) => {
            // Khi OpenAI báo 429 (You have no credits remaining) hoặc lỗi key
            const geminiKeyToUse = backupKeys?.gemini || apiKeys.gemini;
            if (geminiKeyToUse) {
              console.warn(
                `[Consensus fallback] OpenAI gặp lỗi (${openAiErr.message}). Tự động dùng Gemini 3.7 Flash làm Model thứ 3.`
              );
              const fallbackSettings: TeacherSettings = {
                ...settings,
                geminiModel: 'gemini-3.7-flash',
              };
              const { gradingResult, modelUsed } = await gradeWithGemini(
                submission,
                rubric,
                fallbackSettings,
                geminiKeyToUse,
                backupKeys?.gemini
              );
              return {
                provider: 'gemini' as AIProvider,
                result: gradingResult,
                model: `${modelUsed} (Dự phòng cho OpenAI)`,
              };
            }
            throw openAiErr;
          }),
      });
    } else if (apiKeys.gemini) {
      // Nếu không có OpenAI key, chạy Gemini 3.7 Flash làm Model thứ 3
      const fallbackSettings: TeacherSettings = {
        ...settings,
        geminiModel: 'gemini-3.7-flash',
      };
      tasks.push({
        provider: 'Gemini (Model 3)',
        promise: gradeWithGemini(submission, rubric, fallbackSettings, apiKeys.gemini, backupKeys?.gemini).then(
          ({ gradingResult, modelUsed }) => ({
            provider: 'gemini' as AIProvider,
            result: gradingResult,
            model: `${modelUsed} (Model 3)`,
          })
        ),
      });
    }

    if (tasks.length === 0) {
      throw new Error(
        'Chưa cấu hình API Key nào (Gemini, Claude, hoặc OpenAI) để thực hiện đối chiếu 3 model.'
      );
    }

    const settled = await Promise.allSettled(tasks.map((t) => t.promise));
    const successful: { provider: AIProvider; result: GradingResult; model: string }[] = [];
    const errors: string[] = [];

    settled.forEach((res, idx) => {
      const pName = tasks[idx]?.provider || 'AI Model';
      if (res.status === 'fulfilled') {
        successful.push(res.value);
      } else {
        const rawMsg = res.reason?.message || 'Lỗi không xác định';
        let formatted = rawMsg;
        if (/quota|resource_exhausted|429/i.test(rawMsg)) {
          formatted = 'Hết hạn mức sử dụng (Quota / 429)';
        } else if (/credit_balance_exhausted|insufficient_quota|you have no credits/i.test(rawMsg)) {
          formatted = 'Hết số dư tín dụng ($0 balance / 429)';
        } else if (/api_key_invalid|api key not valid/i.test(rawMsg)) {
          formatted = 'API Key không hợp lệ hoặc đã bị khóa';
        } else if (/invalid x-api-key|401/i.test(rawMsg)) {
          formatted = 'API Key không hợp lệ hoặc đã hết hạn (401 Unauthorized)';
        }
        errors.push(`${pName}: ${formatted}`);
        if (!accumulatedFailedModels.some((m) => m.provider === pName)) {
          accumulatedFailedModels.push({ provider: pName, reason: formatted });
        }
      }
    });

    if (successful.length === 0) {
      const uniqueErrors = Array.from(new Set(errors));
      throw new Error(
        `Tất cả các model AI đều thất bại: ${uniqueErrors.join(' | ')}. (Gợi ý: Nếu bạn có cấu hình key trong .env.local, hãy vào Cài Đặt -> Xóa key trình duyệt để hệ thống tự nhận key chuẩn).`
      );
    }

    // Nếu chỉ có 1 hoặc 2 model thành công nhưng cần đủ 3 kết quả để đối chiếu:
    // Nếu có key Gemini, bổ sung thêm model Gemini khác (gemini-3.7-flash / gemini-3.6-flash / gemini-flash-latest) để luôn đủ 3 model!
    const effectiveGeminiKey = backupKeys?.gemini || apiKeys.gemini;
    if (successful.length < 3 && effectiveGeminiKey) {
      const needed = 3 - successful.length;
      const extraCandidates = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
      for (let i = 0; i < needed; i++) {
        const fallbackM = extraCandidates[i] || 'gemini-3.6-flash';
        try {
          const fallbackSettings: TeacherSettings = {
            ...settings,
            geminiModel: fallbackM,
          };
          const { gradingResult, modelUsed } = await gradeWithGemini(
            submission,
            rubric,
            fallbackSettings,
            effectiveGeminiKey,
            backupKeys?.gemini
          );
          successful.push({
            provider: 'gemini',
            result: gradingResult,
            model: `${modelUsed} (Bổ sung)`,
          });
        } catch (e: any) {
          const rawMsg = e?.message || '';
          let formatted = 'Hết hạn mức (Quota / 429)';
          if (/api_key_invalid/i.test(rawMsg)) formatted = 'API key không hợp lệ';
          if (!accumulatedFailedModels.some((m) => m.provider === `Gemini (${fallbackM})`)) {
            accumulatedFailedModels.push({ provider: `Gemini (${fallbackM})`, reason: formatted });
          }
        }
      }
    }

    return successful;
  };

  // Run initial round
  modelResults = await runTripleEvaluation();
  finalEvaluations = modelResults.map((r) => toModelEvaluation(r.provider, r.model, r.result));

  // Helper to calculate maximum score spread
  const getScoreDiff = (evals: ModelEvaluation[]) => {
    if (evals.length <= 1) return 0;
    const scores = evals.map((e) => e.score);
    return Math.max(...scores) - Math.min(...scores);
  };

  // Re-grade loop: If scores or criteria diverge beyond tolerance, trigger re-grading (only if >= 2 models available)
  while (finalEvaluations.length >= 2 && regradeCount < maxRetries) {
    const diff = getScoreDiff(finalEvaluations);

    // Check if any major criterion has strong conflict (e.g., > 50% points divergence)
    let hasCriterionConflict = false;
    for (const crit of rubric.criteria) {
      const critScores = finalEvaluations.map(
        (e) => e.awardedPointsByCriterion[crit.id] ?? 0
      );
      const critDiff = Math.max(...critScores) - Math.min(...critScores);
      if (critDiff > crit.points * 0.5 && critDiff > 0.2) {
        hasCriterionConflict = true;
        break;
      }
    }

    // If models are within agreement threshold, consensus is achieved
    if (diff <= tolerance && !hasCriterionConflict) {
      break;
    }

    // Difference detected -> trigger re-grade!
    regradeCount++;
    roundCount++;
    console.log(
      `[Consensus] Vòng ${roundCount - 1} phát hiện chênh lệch ${diff.toFixed(2)}đ (> ${tolerance}đ) hoặc xung đột tiêu chí. Tiến hành chấm lại (Lần ${regradeCount}/${maxRetries})...`
    );

    try {
      const newResults = await runTripleEvaluation();
      if (newResults.length > 0) {
        modelResults = newResults;
        finalEvaluations = modelResults.map((r) =>
          toModelEvaluation(r.provider, r.model, r.result)
        );
      }
    } catch (retryErr) {
      console.warn('[Consensus] Gặp lỗi trong lần chấm lại:', retryErr);
      break;
    }
  }

  // Determine final consensus status based on actual number of participating models
  const evalCount = finalEvaluations.length;
  const scoreDiff = Number(getScoreDiff(finalEvaluations).toFixed(2));
  let consensusStatus: ConsensusReport['status'] = 'unanimous';

  if (evalCount === 1) {
    consensusStatus = 'single_model';
  } else if (evalCount === 2) {
    consensusStatus = scoreDiff <= tolerance ? 'majority' : 'conflict';
  } else if (regradeCount > 0) {
    consensusStatus = scoreDiff <= tolerance ? 'resolved_after_retry' : 'conflict';
  } else if (scoreDiff > 0.05) {
    consensusStatus = scoreDiff <= tolerance ? 'majority' : 'conflict';
  } else {
    consensusStatus = 'unanimous';
  }

  // Synthesize consensus criteria points and explanations
  const synthesizedCriteria: CriterionResult[] = rubric.criteria.map((c) => {
    const pointsList = finalEvaluations.map(
      (e) => e.awardedPointsByCriterion[c.id] ?? 0
    );

    let consensusPoint = 0;
    if (pointsList.length === 1) {
      consensusPoint = pointsList[0];
    } else if (pointsList.length === 2) {
      if (Math.abs(pointsList[0] - pointsList[1]) <= 0.05) {
        consensusPoint = pointsList[0];
      } else {
        consensusPoint = Math.min(pointsList[0], pointsList[1]);
      }
    } else {
      // 3 models: median value gives consensus vote
      const sorted = [...pointsList].sort((a, b) => a - b);
      consensusPoint = sorted[1];
    }

    // Pick reasoning from the model agreeing with consensus point
    let bestReason = '';
    let isCorrect: 'full' | 'partial' | 'wrong' =
      consensusPoint >= c.points
        ? 'full'
        : consensusPoint > 0
        ? 'partial'
        : 'wrong';

    for (const ev of finalEvaluations) {
      if (Math.abs((ev.awardedPointsByCriterion[c.id] ?? 0) - consensusPoint) <= 0.05) {
        if (ev.reasonsByCriterion[c.id]) {
          bestReason = ev.reasonsByCriterion[c.id];
          isCorrect = ev.isCorrectByCriterion[c.id] || isCorrect;
          break;
        }
      }
    }

    if (!bestReason && finalEvaluations[0]) {
      bestReason = finalEvaluations[0].reasonsByCriterion[c.id] || '';
    }

    return {
      criterionId: c.id,
      criterionName: c.name,
      maxPoints: c.points,
      awardedPoints: Number(consensusPoint.toFixed(2)),
      isCorrect,
      reason: bestReason,
    };
  });

  const totalScore = Number(
    synthesizedCriteria.reduce((sum, c) => sum + c.awardedPoints, 0).toFixed(2)
  );
  const maxScore = rubric.totalPoints;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  // Best feedback text from agreeing models
  const primaryResult =
    modelResults.find(
      (r) => Math.abs(r.result.score - totalScore) <= tolerance
    )?.result || modelResults[0].result;

  // Human-readable summary
  const modelScoreDetails = finalEvaluations
    .map((e) => `${e.provider.toUpperCase()} (${e.modelName}): ${e.score}đ`)
    .join(', ');

  let summaryText = '';
  const hasFallback = finalEvaluations.some((e) => e.modelName.includes('Dự phòng'));
  const fallbackNote = hasFallback
    ? ' (💡 Lưu ý: Model thứ 3 đang dùng Gemini 3.7 Flash dự phòng do tài khoản OpenAI hết hạn mức tín dụng).'
    : '';

  const failedSummary =
    accumulatedFailedModels.length > 0
      ? `Các model còn lại gặp sự cố: ${accumulatedFailedModels.map((f) => `${f.provider} (${f.reason})`).join(', ')}.`
      : '';

  if (evalCount === 1) {
    const single = finalEvaluations[0];
    summaryText = `Chỉ có 1/3 Model (${single.provider.toUpperCase()} - ${single.modelName}) chấm thành công (${single.score}đ). ${failedSummary} Điểm số được lấy trực tiếp từ model này: ${totalScore}/${maxScore}đ.`;
  } else if (evalCount === 2) {
    const statusNote = scoreDiff <= tolerance ? 'Đồng thuận giữa 2/3 Model' : 'Chênh lệch giữa 2/3 Model';
    summaryText = `${statusNote} (Độ lệch: ${scoreDiff}đ | ${modelScoreDetails}). ${failedSummary} Điểm chốt: ${totalScore}/${maxScore}đ.`;
  } else if (consensusStatus === 'unanimous') {
    summaryText = `Đồng thuận tuyệt đối 3/3 Model (${modelScoreDetails}). Điểm chốt: ${totalScore}/${maxScore}đ.${fallbackNote}`;
  } else if (consensusStatus === 'majority') {
    summaryText = `Đồng thuận đa số 2/3 Model (Độ lệch: ${scoreDiff}đ | ${modelScoreDetails}). Điểm chốt: ${totalScore}/${maxScore}đ.${fallbackNote}`;
  } else if (consensusStatus === 'resolved_after_retry') {
    summaryText = `Đã tự động chấm lại ${regradeCount} lần để giải quyết bất đồng điểm số ban đầu. Điểm chốt đồng thuận: ${totalScore}/${maxScore}đ (${modelScoreDetails}).${fallbackNote}`;
  } else {
    summaryText = `Có sự phân kỳ giữa các Model sau ${regradeCount} lần chấm lại (Độ lệch: ${scoreDiff}đ | ${modelScoreDetails}). Đã chốt điểm trung vị tối ưu: ${totalScore}/${maxScore}đ.${fallbackNote}`;
  }

  const consensusReport: ConsensusReport = {
    roundCount,
    regradeCount,
    status: consensusStatus,
    modelsUsed: finalEvaluations.map((e) => `${e.provider} (${e.modelName})`),
    scoreDifference: scoreDiff,
    evaluations: finalEvaluations,
    summary: summaryText,
    failedModels: accumulatedFailedModels,
  };

  const finalGradingResult: GradingResult = {
    studentName: submission.studentName,
    submissionId: submission.id,
    score: totalScore,
    maxScore,
    percentage,
    status: 'completed',
    gradedAt: new Date().toISOString(),
    generalComment: primaryResult.generalComment,
    criteriaBreakdown: synthesizedCriteria,
    strengths: primaryResult.strengths,
    weaknesses: primaryResult.weaknesses,
    correctionGuide: primaryResult.correctionGuide,
    teacherComment: primaryResult.teacherComment,
    consensusReport,
  };

  return { gradingResult: finalGradingResult, consensusReport };
}

