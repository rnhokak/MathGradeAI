import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { OpenRouter } from '@openrouter/sdk';
import { jsonrepair } from 'jsonrepair';
import {
  GradingResult,
  RubricData,
  StudentSubmission,
  TeacherSettings,
  AIProvider,
  ModelEvaluation,
  ConsensusReport,
  CriterionResult,
  OcrModelResult,
  OcrComparisonReport,
} from '@/types/grading';
import {
  buildGradingPrompt,
  buildMathOcrPrompt,
  buildOcrConsensusPrompt,
  buildClaudeTriplePassPrompt,
  buildClaudeSynthesisPrompt,
  buildModelTriplePassPrompt,
  buildModelSynthesisPrompt,
} from './promptBuilder';

/**
 * Creates an OpenAI client configured for OpenRouter.ai
 */
export function createOpenRouterClient(apiKey: string, baseUrl?: string): OpenAI {
  const cleanBaseUrl = (
    baseUrl ||
    process.env.OPENROUTER_BASE_URL ||
    'https://openrouter.ai/api/v1'
  ).replace(/\/+$/, '');

  return new OpenAI({
    baseURL: cleanBaseUrl,
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://mathgrade.ai',
      'X-Title': 'MathGrade AI',
    },
  });
}

/**
 * Creates an @openrouter/sdk client for streaming chat (qwen/qwen3.8-flash, etc.)
 * Follows official docs: openrouter.chat.send({ chatRequest: { model, messages, stream: true } })
 */
export function createOpenRouterSdk(apiKey: string, baseUrl?: string): OpenRouter {
  const serverURL = (
    baseUrl ||
    process.env.OPENROUTER_BASE_URL ||
    'https://openrouter.ai/api/v1'
  ).replace(/\/+$/, '').replace(/\/v1$/, '');

  return new OpenRouter({
    apiKey,
    serverURL,
  });
}

/**
 * Creates an OpenAI client configured for Alibaba Cloud Model Studio (DashScope Singapore / OpenAI Compatible)
 */
export function createAlibabaCloudClient(apiKey: string, baseUrl?: string): OpenAI {
  const cleanBaseUrl = (
    baseUrl ||
    process.env.ALIBABACLOUD_BASE_URL ||
    'https://ws-oxwvfx79avt7ebq3.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '');

  return new OpenAI({
    baseURL: cleanBaseUrl,
    apiKey,
  });
}

/**
 * Chuẩn hóa ảnh base64 theo Section 5 của tài liệu Anthropic Messages API:
 * - Tách phần metadata data:...;base64, nếu có
 * - Bỏ mọi ký tự khoảng trắng / xuống dòng thừa
 * - Chuẩn hóa media_type (image/png, image/jpeg, image/webp, image/gif)
 */
export function normalizeBase64Image(input: string): { mime: string; data: string } {
  const trimmed = (input || '').trim();
  const commaIdx = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIdx !== -1) {
    const meta = trimmed.slice(5, commaIdx);
    const mimeMatch = meta.match(/^([^;]+)/);
    let mime = mimeMatch ? mimeMatch[1].toLowerCase().trim() : 'image/png';
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)) {
      mime = 'image/png';
    }
    const cleanData = trimmed.slice(commaIdx + 1).replace(/\s+/g, '');
    return { mime, data: cleanData };
  }

  // Pure base64
  let mime = 'image/png';
  if (trimmed.startsWith('/9j/')) {
    mime = 'image/jpeg';
  } else if (trimmed.startsWith('R0lGOD')) {
    mime = 'image/gif';
  } else if (trimmed.startsWith('UklGR')) {
    mime = 'image/webp';
  }
  return { mime, data: trimmed.replace(/\s+/g, '') };
}

/**
 * Chuẩn hóa URL endpoint cho Claude API (tương thích Anthropic Messages API và proxy apikey.pimath.id.vn)
 */
export function resolveClaudeEndpoint(rawBaseUrl?: string): string {
  let url = (
    rawBaseUrl ||
    process.env.CLAUDE_BASE_URL ||
    'https://apikey.pimath.id.vn/v1'
  )
    .trim()
    .replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Bất kỳ URL nào liên quan đến pimath.id.vn (kể cả apikey.pimath.id.vn hay claudecode.pimath.id.vn, /v1, /v1/messages...)
  // bắt buộc phải trỏ về endpoint chuẩn Anthropic Messages: https://apikey.pimath.id.vn/anthropic/v1/messages
  // Tuyệt đối không gọi /v1/messages trên pimath vì sẽ bị lỗi 500: Failed to create chat: no chat ID returned
  if (url.toLowerCase().includes('pimath.id.vn')) {
    const target = 'https://apikey.pimath.id.vn/anthropic/v1/messages';
    console.log(`[CLAUDE_RESOLVER] pimath detected: raw="${rawBaseUrl}" -> target="${target}"`);
    return target;
  }

  if (url.endsWith('/messages')) {
    return url;
  }

  if (url.endsWith('/v1')) {
    return `${url}/messages`;
  }

  return `${url}/v1/messages`;
}


/**
 * Attempts to repair a truncated JSON string by closing unclosed braces/brackets
 * using a LIFO stack in reverse order of opening.
 */
function repairTruncatedJson(raw: string): string {
  let s = raw.trimEnd();

  // Strip trailing incomplete key or dangling colon
  s = s
    .replace(/,\s*"[^"]*"\s*:\s*$/, '')
    .replace(/,\s*"[^"]*"\s*$/, '')
    .replace(/,\s*$/, '');

  const openStack: string[] = [];
  let inStr = false;
  let isEsc = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (isEsc) {
      isEsc = false;
      continue;
    }
    if (c === '\\' && inStr) {
      isEsc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;

    if (c === '{' || c === '[') {
      openStack.push(c);
    } else if (c === '}') {
      if (openStack.length > 0 && openStack[openStack.length - 1] === '{') {
        openStack.pop();
      }
    } else if (c === ']') {
      if (openStack.length > 0 && openStack[openStack.length - 1] === '[') {
        openStack.pop();
      }
    }
  }

  // If string was cut off mid-way, close it
  if (inStr) {
    s += '"';
  }

  // Remove trailing comma again
  s = s.replace(/,\s*$/, '');

  // Close open structures in LIFO order (last in, first out)
  while (openStack.length > 0) {
    const lastOpen = openStack.pop();
    if (lastOpen === '{') {
      s += '}';
    } else if (lastOpen === '[') {
      s += ']';
    }
  }

  return s;
}

/**
 * Pre-cleans AI JSON string by stripping comments, smart quotes, unescaped LaTeX backslashes,
 * unescaped inner quotation marks inside strings, and raw newlines.
 */
function sanitizeAiJson(raw: string): string {
  // 1. Remove markdown fences ```json ... ```
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 2. Remove JavaScript comments // ... and /* ... */ that AI models sometimes include
  // Be careful not to remove http:// or https://
  text = text.replace(/(\/\*[\s\S]*?\*\/)|((?<!https?:)\/\/[^\r\n]*)/g, '');

  // 3. Normalize unicode smart quotes
  text = text.replace(/[\u201C\u201D\u00AB\u00BB]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // 4. Protect LaTeX backslashes for common math symbols
  const commonLatexCommands = [
    'frac', 'dfrac', 'tfrac', 'cfrac',
    'sqrt',
    'log', 'ln', 'lg', 'exp',
    'sin', 'cos', 'tan', 'cot', 'arcsin', 'arccos', 'arctan',
    'lim', 'to', 'infty',
    'left', 'right',
    'text', 'textbf', 'textit', 'textrm', 'operatorname',
    'alpha', 'beta', 'gamma', 'delta', 'Delta', 'epsilon', 'varepsilon',
    'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'Lambda',
    'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega', 'Omega',
    'times', 'cdot', 'pm', 'mp', 'div', 'ne', 'neq', 'le', 'leq', 'ge', 'geq',
    'approx', 'sim', 'equiv', 'in', 'notin', 'subset', 'subseteq',
    'cap', 'cup', 'setminus', 'emptyset',
    'forall', 'exists', 'nexists',
    'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'implies', 'iff',
    'vec', 'overrightarrow', 'bar', 'hat', 'overline', 'underline',
    'sum', 'prod', 'int', 'iint', 'iiint', 'oint',
    'partial', 'nabla', 'mathbb', 'mathbf', 'mathcal'
  ];
  const latexRegex = new RegExp(`\\\\(${commonLatexCommands.join('|')})(?![a-zA-Z])`, 'g');
  text = text.replace(latexRegex, '\\\\$1');

  // Also replace any backslash not followed by valid JSON escape character
  text = text.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

  // 5. Fix inner unescaped quotes and control characters inside string literals
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (isEscaped) {
      result += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      if (!inString) {
        inString = true;
        result += char;
      } else {
        const rest = text.slice(i + 1).trimStart();
        const isClosingQuote =
          rest.startsWith(':') ||
          rest.startsWith(',') ||
          rest.startsWith('}') ||
          rest.startsWith(']') ||
          rest === '';

        if (isClosingQuote) {
          if (rest.startsWith(',')) {
            const afterComma = rest.slice(1).trimStart();
            const isProperJsonToken = /^("|\{|\}|\[|\]|-?\d|true|false|null)/i.test(afterComma);
            if (!isProperJsonToken && afterComma.length > 0) {
              result += '\\"';
              continue;
            }
          }
          inString = false;
          result += char;
        } else {
          result += '\\"';
        }
      }
      continue;
    }

    if (inString) {
      if (char === '\n') {
        result += '\\n';
        continue;
      }
      if (char === '\r') {
        continue;
      }
      if (char === '\t') {
        result += '\\t';
        continue;
      }
    }

    result += char;
  }

  return result;
}

/**
 * Ultimate fallback regex parser: Extracts grading fields from malformed AI output
 * so that grading never crashes with 500 errors even if JSON is severely damaged.
 */
function fallbackRegexJsonExtractor(rawText: string): any {
  const result: any = {
    score: 0,
    maxScore: 10,
    generalComment: '',
    criteriaBreakdown: [],
    strengths: [],
    weaknesses: [],
    correctionGuide: '',
    teacherComment: '',
  };

  const scoreMatch = rawText.match(/"score"\s*:\s*([0-9.]+)/i);
  if (scoreMatch) result.score = parseFloat(scoreMatch[1]);

  const maxScoreMatch = rawText.match(/"maxScore"\s*:\s*([0-9.]+)/i);
  if (maxScoreMatch) result.maxScore = parseFloat(maxScoreMatch[1]);

  const generalCommentMatch = rawText.match(/"generalComment"\s*:\s*"([\s\S]*?)(?="\s*,\s*"\w+":|"\s*})/i);
  if (generalCommentMatch) result.generalComment = generalCommentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

  const teacherCommentMatch = rawText.match(/"teacherComment"\s*:\s*"([\s\S]*?)(?="\s*,\s*"\w+":|"\s*})/i);
  if (teacherCommentMatch) result.teacherComment = teacherCommentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

  const correctionGuideMatch = rawText.match(/"correctionGuide"\s*:\s*"([\s\S]*?)(?="\s*,\s*"\w+":|"\s*})/i);
  if (correctionGuideMatch) result.correctionGuide = correctionGuideMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

  const synthesisSummaryMatch = rawText.match(/"synthesisSummary"\s*:\s*"([\s\S]*?)(?="\s*,\s*"\w+":|"\s*})/i);
  if (synthesisSummaryMatch) result.synthesisSummary = synthesisSummaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

  // Try extracting criteria items: { "criterionId": "...", "awardedPoints": ... }
  const criteriaRegex = /\{\s*"criterionId"\s*:\s*"([^"]+)"[\s\S]*?"awardedPoints"\s*:\s*([0-9.]+)[\s\S]*?\}/gi;
  let match;
  while ((match = criteriaRegex.exec(rawText)) !== null) {
    const itemBlock = match[0];
    const critId = match[1];
    const pts = parseFloat(match[2]);
    const nameMatch = itemBlock.match(/"criterionName"\s*:\s*"([^"]+)"/i);
    const maxMatch = itemBlock.match(/"maxPoints"\s*:\s*([0-9.]+)/i);
    const isCorrectMatch = itemBlock.match(/"isCorrect"\s*:\s*"([^"]+)"/i);
    const reasonMatch = itemBlock.match(/"reason"\s*:\s*"([\s\S]*?)(?="\s*,\s*"\w+":|"\s*})/i);

    result.criteriaBreakdown.push({
      criterionId: critId,
      criterionName: nameMatch ? nameMatch[1] : critId,
      maxPoints: maxMatch ? parseFloat(maxMatch[1]) : pts,
      awardedPoints: pts,
      isCorrect: isCorrectMatch ? isCorrectMatch[1] : (pts > 0 ? 'full' : 'wrong'),
      reason: reasonMatch ? reasonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '',
    });
  }

  return result;
}

/**
 * Robust JSON extractor from AI output that handles:
 * - Markdown fences ```json ... ```
 * - Unescaped LaTeX backslashes (\log, \sqrt, \frac, \le, \ge, etc.)
 * - Unescaped quotes inside strings ("x = 2")
 * - Raw newlines inside strings
 * - Trailing commas and JavaScript comments
 * - jsonrepair library auto-fixing
 * - Fallback regex extraction so no 500 error occurs
 */
export function extractJsonFromText(rawText: string): any {
  if (!rawText || !rawText.trim()) {
    throw new Error('AI trả về phản hồi rỗng.');
  }

  // 1. Try direct parse first
  try {
    return JSON.parse(rawText.trim());
  } catch {}

  // 2. Extract content between ```json ... ``` or locate first { and last }
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  let cleaned = fenceMatch ? fenceMatch[1].trim() : rawText.trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  let candidate = '';
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidate = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBrace !== -1) {
    candidate = cleaned.substring(firstBrace);
  } else {
    candidate = cleaned;
  }

  // 3. Try jsonrepair directly on candidate
  try {
    const directRepaired = jsonrepair(candidate);
    return JSON.parse(directRepaired);
  } catch {}

  // 4. Sanitize AI output (comments, LaTeX backslashes, smart quotes, inner quotes, raw newlines)
  const sanitized = sanitizeAiJson(candidate);

  // 5. Try jsonrepair on sanitized candidate
  try {
    const repaired = jsonrepair(sanitized);
    return JSON.parse(repaired);
  } catch {}

  // 6. Try parsing sanitized directly
  try {
    return JSON.parse(sanitized);
  } catch {}

  // 7. Stack-based repairTruncatedJson fallback
  try {
    const truncatedRepaired = repairTruncatedJson(sanitized);
    return JSON.parse(jsonrepair(truncatedRepaired));
  } catch {}

  // 8. Ultimate fallback: Regex field extractor to prevent 500 crashes
  try {
    const fallbackObj = fallbackRegexJsonExtractor(rawText);
    if (fallbackObj && (fallbackObj.score !== undefined || fallbackObj.criteriaBreakdown?.length > 0)) {
      console.warn('[JSON Extractor] JSON bị lỗi cú pháp từ AI, đã dùng bộ bóc tách regex cứu vãn thành công:', fallbackObj);
      return fallbackObj;
    }
  } catch {}

  throw new Error(
    `Không thể bóc tách JSON hợp lệ từ phản hồi AI. Dữ liệu thô: ${cleaned.substring(0, 300)}...`
  );
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
 * Transcribe math handwritten images using Google Gemini
 */
export async function transcribeImageWithGemini(
  images: string[],
  studentName: string,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ transcription: string; modelUsed: string }> {
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Google Gemini API Key. Vui lòng vào Cài Đặt để nhập API Key, hoặc khai báo biến GEMINI_API_KEY trong file .env.local.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents: any[] = [];

  for (const imgUrl of images) {
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

  const promptText = buildMathOcrPrompt(studentName);
  contents.push(promptText);

  const userModel = settings.geminiModel || settings.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const cleanPreferred = userModel === 'gemini-2.5-flash' || userModel === 'gemini-2.0-flash' ? 'gemini-3.6-flash' : userModel;
  const candidates = Array.from(
    new Set([cleanPreferred, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'])
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
          temperature: 0.0,
        },
      });
      modelUsed = m;
      break;
    } catch (err: any) {
      lastError = err;
      const isKeyInvalid = /api_key_invalid|api key not valid/i.test(err.message || '');
      if (isKeyInvalid && backupApiKey && backupApiKey !== apiKey) {
        return transcribeImageWithGemini(images, studentName, settings, backupApiKey);
      }
      if (isKeyInvalid) break;
    }
  }

  if (!response) {
    throw lastError || new Error('Không thể kết nối đến Gemini để nhận diện công thức toán.');
  }

  return {
    transcription: (response.text || '').trim(),
    modelUsed,
  };
}

/**
 * Transcribe math handwritten images using Anthropic Claude
 */
export async function transcribeImageWithClaude(
  images: string[],
  studentName: string,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ transcription: string; modelUsed: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình Anthropic Claude API Key.');
  }

  const endpointUrl = resolveClaudeEndpoint(settings.claudeBaseUrl);
  let model = settings.claudeModel || process.env.CLAUDE_MODEL || 'claude-opus-5';
  const legacyClaudeModels = [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ];
  if (legacyClaudeModels.includes(model)) {
    model = 'claude-opus-5';
  } else if (model === 'claude-haiku-4-5-20251001') {
    model = 'claude-haiku-4-5';
  } else if (model === 'claude-opus-4-6') {
    model = 'claude-opus-4-7';
  }

  const promptText = buildMathOcrPrompt(studentName);
  const contentBlocks: any[] = [];

  for (const imgUrl of images) {
    const { mime, data } = normalizeBase64Image(imgUrl);
    if (data) {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mime,
          data,
        },
      });
    }
  }

  contentBlocks.push({
    type: 'text',
    text: promptText,
  });

  let response: Response | null = null;
  let lastError: any = null;
  const MAX_FETCH_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      console.log(`[TRANSCRIBE_CLAUDE_FETCH] (Lần ${attempt}/${MAX_FETCH_RETRIES}) Calling ${endpointUrl} with model=${model}`);
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: false,
          strict_images: true,
          temperature: 0.0,
          messages: [
            {
              role: 'user',
              content: contentBlocks,
            },
          ],
        }),
      });

      if (!res.ok) {
        let errorDetail = res.statusText;
        try {
          const errJson = await res.json();
          errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
        } catch { }
        if (
          (res.status === 401 || /invalid x-api-key/i.test(errorDetail)) &&
          backupApiKey &&
          backupApiKey !== apiKey
        ) {
          return transcribeImageWithClaude(images, studentName, settings, backupApiKey);
        }
        if (res.status === 401 || /invalid x-api-key/i.test(errorDetail)) {
          throw new Error(`Anthropic Claude OCR: API Key không hợp lệ (401 Unauthorized).`);
        }
        throw new Error(`Claude OCR lỗi (${res.status}): ${errorDetail}`);
      }

      response = res;
      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`[TRANSCRIBE_CLAUDE_FETCH] Lần ${attempt}/${MAX_FETCH_RETRIES} gặp lỗi:`, err.message || err);
      if (/401|invalid x-api-key/i.test(err.message || '')) {
        throw err;
      }
      if (attempt < MAX_FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 1200));
      }
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error(`Claude OCR thất bại sau ${MAX_FETCH_RETRIES} lần thử.`);
  }

  const data = await response.json();
  let textOutput = '';
  if (Array.isArray(data.content)) {
    textOutput = data.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
  } else if (typeof data.content === 'string') {
    textOutput = data.content;
  } else if (data.choices && data.choices[0]?.message) {
    textOutput = data.choices[0].message.content || '';
  } else if (data.choices && data.choices[0]?.text) {
    textOutput = data.choices[0].text;
  }

  return {
    transcription: textOutput.trim(),
    modelUsed: model,
  };
}

/**
 * Transcribe math handwritten images using OpenAI
 */
export async function transcribeImageWithOpenAI(
  images: string[],
  studentName: string,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ transcription: string; modelUsed: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình OpenAI API Key.');
  }

  const baseUrl = (
    settings.openaiBaseUrl ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  ).replace(/\/+$/, '');
  const model = settings.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o';
  const promptText = buildMathOcrPrompt(studentName);

  const userContents: any[] = [
    {
      type: 'text',
      text: promptText,
    },
  ];

  for (const imgUrl of images) {
    userContents.push({
      type: 'image_url',
      image_url: { url: imgUrl, detail: 'high' },
    });
  }

  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3');
  const requestBody: any = {
    model,
    messages: [{ role: 'user', content: userContents }],
  };
  if (!isReasoningModel) {
    requestBody.temperature = 0.0;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch { }
    if (
      (response.status === 401 || /invalid api key/i.test(errorDetail)) &&
      backupApiKey &&
      backupApiKey !== apiKey
    ) {
      return transcribeImageWithOpenAI(images, studentName, settings, backupApiKey);
    }
    throw new Error(`OpenAI OCR lỗi (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';

  return {
    transcription: textOutput.trim(),
    modelUsed: model,
  };
}

/**
 * Transcribe math handwritten images using Qwen on OpenRouter.ai
 * Supports vision models (qwen/qwen-2.5-vl-72b-instruct:free, qwen/qwen-2.5-vl-72b-instruct, etc.)
 * Supports reasoning: { enabled: true } and extracts reasoning_details / <think> tags.
 */
export async function transcribeImageWithOpenRouter(
  images: string[],
  studentName: string,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ transcription: string; modelUsed: string; reasoning?: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình OpenRouter API Key.');
  }

  const client = createOpenRouterClient(apiKey, settings.openrouterBaseUrl);
  let model = settings.openrouterModel || process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-vl-72b-instruct:free';

  // OCR handwriting requires vision capabilities. If a pure text model is selected, fallback to Qwen 2.5 VL
  const isPureText = /qwen3\.8|coder|qwq-32b-preview/i.test(model) && !/vl/i.test(model);
  if (isPureText) {
    console.log(
      `[OpenRouter OCR] Model "${model}" là model văn bản thuần, tự động chuyển sang "qwen/qwen-2.5-vl-72b-instruct:free" để đọc nét chữ viết tay.`
    );
    model = 'qwen/qwen-2.5-vl-72b-instruct:free';
  }

  const promptText = buildMathOcrPrompt(studentName);
  const userContents: any[] = [
    {
      type: 'text',
      text: promptText,
    },
  ];

  for (const imgUrl of images) {
    const formattedUrl = imgUrl.startsWith('data:') ? imgUrl : `data:image/jpeg;base64,${imgUrl}`;
    userContents.push({
      type: 'image_url',
      image_url: { url: formattedUrl, detail: 'high' },
    });
  }

  const enableReasoning = settings.openrouterReasoning !== false;
  const requestPayload: any = {
    model,
    messages: [
      {
        role: 'user',
        content: userContents,
      },
    ],
  };

  if (enableReasoning) {
    requestPayload.reasoning = { enabled: true };
  } else {
    requestPayload.temperature = 0.0;
  }

  let apiResponse: any;
  try {
    apiResponse = await (client.chat.completions.create as any)(requestPayload);
  } catch (err: any) {
    const errorMsg = err.message || '';
    if (/invalid api key|unauthorized|401/i.test(errorMsg) && backupApiKey && backupApiKey !== apiKey) {
      return transcribeImageWithOpenRouter(images, studentName, settings, backupApiKey);
    }
    // If free model fails due to 429 rate limit or busy, try non-free qwen/qwen-2.5-vl-72b-instruct
    if (model.includes(':free') && /rate limit|429|busy|unavailable|quota|temporarily/i.test(errorMsg)) {
      console.warn(`[OpenRouter OCR] Model ${model} gặp giới hạn tần suất, tự động chuyển sang qwen/qwen-2.5-vl-72b-instruct...`);
      requestPayload.model = 'qwen/qwen-2.5-vl-72b-instruct';
      model = 'qwen/qwen-2.5-vl-72b-instruct';
      try {
        apiResponse = await (client.chat.completions.create as any)(requestPayload);
      } catch (retryPaidErr: any) {
        throw new Error(`OpenRouter (${model}) OCR lỗi: ${retryPaidErr.message || errorMsg}`);
      }
    } else if (requestPayload.reasoning && /reasoning|parameter/i.test(errorMsg)) {
      // If reasoning parameter causes issues on a specific proxy, retry without reasoning
      delete requestPayload.reasoning;
      requestPayload.temperature = 0.0;
      apiResponse = await (client.chat.completions.create as any)(requestPayload);
    } else {
      throw new Error(`OpenRouter (${model}) OCR lỗi: ${errorMsg}`);
    }
  }

  type ORChatMessage = (typeof apiResponse)['choices'][number]['message'] & {
    reasoning_details?: unknown;
    reasoning?: string;
  };
  const responseMsg = (apiResponse?.choices?.[0]?.message || {}) as ORChatMessage;
  let textOutput = responseMsg.content || '';
  const reasoningDetails = responseMsg.reasoning_details;
  let reasoningText = typeof responseMsg.reasoning === 'string' ? responseMsg.reasoning : undefined;

  // Extract <think>...</think> if present
  const thinkMatch = textOutput.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    reasoningText = (reasoningText ? reasoningText + '\n\n' : '') + thinkMatch[1].trim();
    textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  textOutput = textOutput
    .replace(/^```latex\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return {
    transcription: textOutput.trim(),
    modelUsed: model,
    reasoning: reasoningText || (reasoningDetails ? JSON.stringify(reasoningDetails) : undefined),
  };
}

/**
 * Transcribe math handwritten images using Alibaba Cloud Model Studio (Qwen)
 * Supports vision models (qwen-vl-max, qwen2.5-vl-72b-instruct, etc.)
 */
export async function transcribeImageWithAlibabaCloud(
  images: string[],
  studentName: string,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ transcription: string; modelUsed: string; reasoning?: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình Alibaba Cloud Model Studio API Key.');
  }

  const client = createAlibabaCloudClient(apiKey, settings.alibabacloudBaseUrl);
  let model = settings.alibabacloudModel || process.env.ALIBABACLOUD_MODEL || 'qwen-vl-max';

  // OCR handwriting requires vision capabilities on Alibaba Cloud. If a pure text model is selected, fallback to qwen-vl-max
  if (!/vl/i.test(model)) {
    console.log(
      `[Alibaba Cloud OCR] Model "${model}" là model văn bản thuần, tự động chuyển sang "qwen-vl-max" để đọc ảnh viết tay.`
    );
    model = 'qwen-vl-max';
  }

  const promptText = buildMathOcrPrompt(studentName);
  const userContents: any[] = [
    {
      type: 'text',
      text: promptText,
    },
  ];

  for (const imgUrl of images) {
    const formattedUrl = imgUrl.startsWith('data:') ? imgUrl : `data:image/jpeg;base64,${imgUrl}`;
    userContents.push({
      type: 'image_url',
      image_url: { url: formattedUrl, detail: 'high' },
    });
  }

  const requestPayload: any = {
    model,
    messages: [
      {
        role: 'user',
        content: userContents,
      },
    ],
    temperature: 0.0,
  };

  let apiResponse: any;
  try {
    apiResponse = await (client.chat.completions.create as any)(requestPayload);
  } catch (err: any) {
    const errorMsg = err.message || '';
    if (/invalid api key|unauthorized|401/i.test(errorMsg) && backupApiKey && backupApiKey !== apiKey) {
      return transcribeImageWithAlibabaCloud(images, studentName, settings, backupApiKey);
    }
    // If qwen-vl-max fails with format or activation error, fallback to qwen2.5-vl-72b-instruct
    if (/qwen-vl-max/i.test(model) && /not activate|not found|permission|unauthorized|Invalid chat format|Expected 'text'/i.test(errorMsg)) {
      console.warn(`[Alibaba Cloud OCR] Model qwen-vl-max gặp lỗi (${errorMsg}), tự động chuyển sang qwen2.5-vl-72b-instruct...`);
      requestPayload.model = 'qwen2.5-vl-72b-instruct';
      model = 'qwen2.5-vl-72b-instruct';
      try {
        apiResponse = await (client.chat.completions.create as any)(requestPayload);
      } catch (retryErr2: any) {
        throw new Error(`Alibaba Cloud (${model}) OCR lỗi: ${retryErr2.message || errorMsg}`);
      }
    } else {
      throw new Error(`Alibaba Cloud (${model}) OCR lỗi: ${errorMsg}`);
    }
  }

  const responseMsg = apiResponse?.choices?.[0]?.message || {};
  let textOutput = responseMsg.content || '';
  let reasoningText = typeof responseMsg.reasoning === 'string' ? responseMsg.reasoning : (typeof responseMsg.reasoning_content === 'string' ? responseMsg.reasoning_content : undefined);

  const thinkMatch = textOutput.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    reasoningText = (reasoningText ? reasoningText + '\n\n' : '') + thinkMatch[1].trim();
    textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  textOutput = textOutput
    .replace(/^```latex\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return {
    transcription: textOutput.trim(),
    modelUsed: model,
    reasoning: reasoningText,
  };
}

/**
 * Transcribe math handwritten images using 3-4 models (Gemini, Claude, OpenAI, Qwen/OpenRouter),
 * compare transcriptions line by line, resolve discrepancies with original image,
 * and synthesize the authoritative consensus transcription.
 */
export async function transcribeWithThreeModelsAndConsensus(
  submission: StudentSubmission,
  settings: TeacherSettings,
  apiKeys: {
    gemini?: string;
    claude?: string;
    openai?: string;
    openrouter?: string;
  },
  backupKeys?: {
    gemini?: string;
    claude?: string;
    openai?: string;
    openrouter?: string;
  }
): Promise<{ ocrComparison: OcrComparisonReport; consensusText: string }> {
  if (!submission.images || submission.images.length === 0) {
    return {
      consensusText: submission.extractedText || '',
      ocrComparison: {
        status: 'single_model',
        modelsUsed: ['Văn bản trực tiếp'],
        results: [
          {
            provider: 'gemini',
            modelName: 'Direct Text',
            transcription: submission.extractedText || '',
          },
        ],
        consensusText: submission.extractedText || '',
        comparisonSummary: 'Bài làm không có ảnh viết tay, sử dụng văn bản trực tiếp.',
        hasDiscrepancies: false,
      },
    };
  }

  const effectiveGeminiKey = apiKeys.gemini || backupKeys?.gemini;
  const effectiveClaudeKey = apiKeys.claude || backupKeys?.claude;
  const effectiveOpenaiKey = apiKeys.openai || backupKeys?.openai;
  const effectiveOpenrouterKey = apiKeys.openrouter || backupKeys?.openrouter;
  const effectiveAlibabaKey = (apiKeys as any).alibabacloud || (backupKeys as any)?.alibabacloud;

  const tasks: {
    provider: AIProvider;
    name: string;
    promise: Promise<{ transcription: string; modelUsed: string }>;
  }[] = [];

  // Model 1: Google Gemini
  if (effectiveGeminiKey) {
    tasks.push({
      provider: 'gemini',
      name: 'Google Gemini',
      promise: transcribeImageWithGemini(
        submission.images,
        submission.studentName,
        settings,
        effectiveGeminiKey,
        backupKeys?.gemini
      ),
    });
  }

  // Model 2: Anthropic Claude
  if (effectiveClaudeKey) {
    tasks.push({
      provider: 'claude',
      name: 'Anthropic Claude',
      promise: transcribeImageWithClaude(
        submission.images,
        submission.studentName,
        settings,
        effectiveClaudeKey,
        backupKeys?.claude
      ),
    });
  }

  // Model 3: OpenAI GPT-4o (kèm tự động dự phòng sang OpenRouter/Gemini nếu OpenAI hết hạn mức hoặc lỗi)
  if (effectiveOpenaiKey) {
    tasks.push({
      provider: 'openai',
      name: 'OpenAI (GPT-4o)',
      promise: transcribeImageWithOpenAI(
        submission.images,
        submission.studentName,
        settings,
        effectiveOpenaiKey,
        backupKeys?.openai
      ).catch(async (openAiErr) => {
        if (effectiveOpenrouterKey) {
          console.warn(
            `[OCR Fallback] OpenAI gặp lỗi (${openAiErr.message}). Tự động dùng Qwen (OpenRouter) làm Model thứ 3.`
          );
          const res = await transcribeImageWithOpenRouter(
            submission.images,
            submission.studentName,
            settings,
            effectiveOpenrouterKey,
            backupKeys?.openrouter
          );
          return {
            transcription: res.transcription,
            modelUsed: `${res.modelUsed} (Dự phòng cho OpenAI)`,
          };
        }
        if (effectiveGeminiKey) {
          console.warn(
            `[OCR Fallback] OpenAI gặp lỗi (${openAiErr.message}). Tự động dùng Gemini 3.6 Flash làm Model thứ 3.`
          );
          const fallbackSettings: TeacherSettings = {
            ...settings,
            geminiModel: 'gemini-3.6-flash',
          };
          const res = await transcribeImageWithGemini(
            submission.images,
            submission.studentName,
            fallbackSettings,
            effectiveGeminiKey,
            backupKeys?.gemini
          );
          return {
            transcription: res.transcription,
            modelUsed: `${res.modelUsed} (Dự phòng cho OpenAI)`,
          };
        }
        throw openAiErr;
      }),
    });
  } else if (effectiveOpenrouterKey) {
    // Nếu không có OpenAI key, dùng Qwen (OpenRouter) làm Model thứ 3
    tasks.push({
      provider: 'openrouter',
      name: 'Qwen (OpenRouter)',
      promise: transcribeImageWithOpenRouter(
        submission.images,
        submission.studentName,
        settings,
        effectiveOpenrouterKey,
        backupKeys?.openrouter
      ),
    });
  } else if (effectiveGeminiKey) {
    const fallbackSettings: TeacherSettings = {
      ...settings,
      geminiModel: 'gemini-3.6-flash',
    };
    tasks.push({
      provider: 'gemini',
      name: 'Gemini (Model 3)',
      promise: transcribeImageWithGemini(
        submission.images,
        submission.studentName,
        fallbackSettings,
        effectiveGeminiKey,
        backupKeys?.gemini
      ).then((res) => ({
        transcription: res.transcription,
        modelUsed: `${res.modelUsed} (Model 3)`,
      })),
    });
  }

  // Nếu cả 3 model đều có và có cả OpenRouter, thêm OpenRouter làm mô hình thẩm định độc lập
  if (
    effectiveOpenrouterKey &&
    !tasks.some((t) => t.provider === 'openrouter')
  ) {
    tasks.push({
      provider: 'openrouter',
      name: 'Qwen (OpenRouter)',
      promise: transcribeImageWithOpenRouter(
        submission.images,
        submission.studentName,
        settings,
        effectiveOpenrouterKey,
        backupKeys?.openrouter
      ),
    });
  }

  // Nếu có Alibaba Cloud key và đang chọn hoặc dùng vision model, thêm Alibaba Cloud OCR
  if (
    effectiveAlibabaKey &&
    !tasks.some((t) => t.provider === 'alibabacloud') &&
    (/vl/i.test(settings.alibabacloudModel || '') || settings.provider === 'alibabacloud')
  ) {
    tasks.push({
      provider: 'alibabacloud',
      name: 'Qwen (Alibaba Cloud)',
      promise: transcribeImageWithAlibabaCloud(
        submission.images,
        submission.studentName,
        settings,
        effectiveAlibabaKey,
        (backupKeys as any)?.alibabacloud
      ),
    });
  }

  if (tasks.length === 0) {
    if (effectiveAlibabaKey) {
      tasks.push({
        provider: 'alibabacloud',
        name: 'Qwen (Alibaba Cloud)',
        promise: transcribeImageWithAlibabaCloud(
          submission.images,
          submission.studentName,
          settings,
          effectiveAlibabaKey,
          (backupKeys as any)?.alibabacloud
        ),
      });
    } else {
      throw new Error('Chưa cấu hình API Key nào (Gemini, Claude, OpenAI, OpenRouter hoặc Alibaba Cloud) để nhận diện công thức toán từ ảnh.');
    }
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));
  const modelResults: OcrModelResult[] = [];

  settled.forEach((res, idx) => {
    const t = tasks[idx];
    if (res.status === 'fulfilled') {
      modelResults.push({
        provider: t.provider,
        modelName: res.value.modelUsed,
        transcription: res.value.transcription,
      });
    } else {
      console.warn(`[OCR 3-Model] ${t.name} OCR thất bại:`, res.reason?.message || res.reason);
      modelResults.push({
        provider: t.provider,
        modelName: t.name,
        transcription: '',
        error: res.reason?.message || 'Lỗi không xác định',
      });
    }
  });

  const successfulResults = modelResults.filter((r) => r.transcription && !r.error);

  if (successfulResults.length === 0) {
    throw new Error(
      `Không thể đọc văn bản từ ảnh bằng các model AI: ${modelResults.map((r) => `${r.modelName}: ${r.error}`).join(' | ')}`
    );
  }

  if (successfulResults.length === 1) {
    const single = successfulResults[0];
    return {
      consensusText: single.transcription,
      ocrComparison: {
        status: 'single_model',
        modelsUsed: [single.modelName],
        results: modelResults,
        consensusText: single.transcription,
        comparisonSummary: `Chỉ có 1 model (${single.modelName}) nhận diện thành công. Đã sử dụng trực tiếp kết quả này.`,
        hasDiscrepancies: false,
      },
    };
  }

  // Reconciliation pass: Compare transcriptions against the image
  const geminiText = modelResults.find((r) => r.provider === 'gemini' && !r.error)?.transcription || '';
  const claudeText = modelResults.find((r) => r.provider === 'claude' && !r.error)?.transcription || '';
  const openaiText =
    modelResults.find((r) => r.provider === 'openai' && !r.error)?.transcription ||
    modelResults.filter((r) => r.provider === 'gemini' && !r.error)[1]?.transcription ||
    '';
  const openrouterText = modelResults.find((r) => r.provider === 'openrouter' && !r.error)?.transcription || '';

  let consensusText = successfulResults[0].transcription;
  let comparisonSummary = 'Đã đối chiếu và hợp nhất các bản đọc từ các model AI.';
  let hasDiscrepancies = false;
  let discrepancies: string[] = [];

  try {
    const arbitrationPrompt = buildOcrConsensusPrompt(
      geminiText,
      claudeText,
      openaiText,
      submission.studentName,
      openrouterText
    );

    if (effectiveGeminiKey) {
      const ai = new GoogleGenAI({ apiKey: effectiveGeminiKey });
      const contents: any[] = [];
      for (const imgUrl of submission.images) {
        const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          contents.push({
            inlineData: { mimeType: match[1], data: match[2] },
          });
        }
      }
      contents.push(arbitrationPrompt);

      const arbCandidates = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash'];
      let arbResponse: any = null;
      for (const m of arbCandidates) {
        try {
          arbResponse = await ai.models.generateContent({
            model: m,
            contents,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.0,
            },
          });
          break;
        } catch (e: any) {
          console.warn(`[OCR Arbitration] ${m} gặp lỗi:`, e.message || e);
        }
      }

      if (arbResponse) {
        const parsedArb = extractJsonFromText(arbResponse.text || '');
        if (parsedArb.consensusText) {
          consensusText = parsedArb.consensusText;
        }
        if (parsedArb.comparisonSummary) {
          comparisonSummary = parsedArb.comparisonSummary;
        }
        hasDiscrepancies = Boolean(parsedArb.hasDiscrepancies);
        discrepancies = Array.isArray(parsedArb.discrepancies) ? parsedArb.discrepancies : [];
      }
    }

    // Fallback to Claude for arbitration if Gemini did not produce a consensus
    if ((!consensusText || consensusText === successfulResults[0].transcription) && effectiveClaudeKey) {
      try {
        const contentBlocks: any[] = [];
        for (const imgUrl of submission.images) {
          const { mime, data } = normalizeBase64Image(imgUrl);
          if (data) {
            contentBlocks.push({
              type: 'image',
              source: { type: 'base64', media_type: mime, data },
            });
          }
        }
        contentBlocks.push({ type: 'text', text: arbitrationPrompt });

        const claudeEndpoint = resolveClaudeEndpoint(settings.claudeBaseUrl || process.env.CLAUDE_BASE_URL);
        const claudeResp = await fetch(claudeEndpoint, {
          method: 'POST',
          headers: {
            'x-api-key': effectiveClaudeKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: settings.claudeModel || process.env.CLAUDE_MODEL || 'claude-opus-5',
            max_tokens: 4096,
            stream: false,
            strict_images: true,
            temperature: 0.0,
            messages: [{ role: 'user', content: contentBlocks }],
          }),
        });

        if (claudeResp.ok) {
          const claudeData = await claudeResp.json();
          let rawText = '';
          if (Array.isArray(claudeData.content)) {
            rawText = claudeData.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
          } else if (typeof claudeData.content === 'string') {
            rawText = claudeData.content;
          } else if (claudeData.choices && claudeData.choices[0]?.message) {
            rawText = claudeData.choices[0].message.content || '';
          } else if (claudeData.choices && claudeData.choices[0]?.text) {
            rawText = claudeData.choices[0].text;
          }
          const parsedArb = extractJsonFromText(rawText);
          if (parsedArb.consensusText) {
            consensusText = parsedArb.consensusText;
          }
          if (parsedArb.comparisonSummary) {
            comparisonSummary = parsedArb.comparisonSummary;
          }
          hasDiscrepancies = Boolean(parsedArb.hasDiscrepancies);
          discrepancies = Array.isArray(parsedArb.discrepancies) ? parsedArb.discrepancies : [];
        }
      } catch (claudeArbErr: any) {
        console.warn('[OCR Reconciliation] Claude arbitration fallback error:', claudeArbErr.message || claudeArbErr);
      }
    }
  } catch (arbErr) {
    console.warn('[OCR Reconciliation] Lỗi trong bước đối chiếu tự động, sử dụng bản đọc chi tiết nhất:', arbErr);
    const sortedByLength = [...successfulResults].sort((a, b) => b.transcription.length - a.transcription.length);
    consensusText = sortedByLength[0].transcription;
    comparisonSummary = 'Đã hợp nhất từ bản đọc chi tiết nhất của các model.';
  }

  const ocrReport: OcrComparisonReport = {
    status: hasDiscrepancies ? 'reconciled' : 'unanimous',
    modelsUsed: successfulResults.map((r) => r.modelName),
    results: modelResults,
    consensusText,
    comparisonSummary,
    hasDiscrepancies,
    discrepancies,
    arbitratedBy: 'Gemini 3.8 Flash Cross-Verification',
  };

  return {
    consensusText,
    ocrComparison: ocrReport,
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
  const userModel = settings.geminiModel || settings.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const cleanPreferred = userModel === 'gemini-2.5-flash' || userModel === 'gemini-2.0-flash' ? 'gemini-3.6-flash' : userModel;
  const candidates = Array.from(
    new Set([cleanPreferred, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'])
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
 * Core function to grade with Claude API using a customized prompt and temperature
 */
export async function gradeWithClaudeCustomPrompt(
  promptText: string,
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string,
  temperature: number = 0.1
): Promise<{ gradingResult: GradingResult; modelUsed: string; reasoning?: string; rawOutput: string }> {
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Anthropic Claude API Key. Vui lòng vào Cài Đặt (chọn mục Claude) để nhập API Key, hoặc khai báo ANTHROPIC_API_KEY trong file .env.local.'
    );
  }

  const endpointUrl = resolveClaudeEndpoint(settings.claudeBaseUrl);
  let model = settings.claudeModel || process.env.CLAUDE_MODEL || 'claude-opus-5';
  const legacyClaudeModels = [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ];
  if (legacyClaudeModels.includes(model)) {
    model = 'claude-opus-5';
  } else if (model === 'claude-haiku-4-5-20251001') {
    model = 'claude-haiku-4-5';
  } else if (model === 'claude-opus-4-6') {
    model = 'claude-opus-4-7';
  }

  const contentBlocks: any[] = [];

  // Add handwriting scans / images
  if (submission.images && submission.images.length > 0) {
    for (const imgUrl of submission.images) {
      const { mime, data } = normalizeBase64Image(imgUrl);
      if (data) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mime,
            data,
          },
        });
      }
    }
  }

  contentBlocks.push({
    type: 'text',
    text: promptText,
  });

  const requestPayload: any = {
    model,
    max_tokens: 8192,
    stream: false,
    strict_images: true,
    temperature,
    messages: [
      {
        role: 'user',
        content: contentBlocks,
      },
    ],
  };

  const reasoningEffort = process.env.CLAUDE_REASONING_EFFORT || (model.includes('opus') ? 'medium' : undefined);
  if (reasoningEffort) {
    requestPayload.reasoning_effort = reasoningEffort;
  }

  let response: Response | null = null;
  let lastError: any = null;
  const MAX_FETCH_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      console.log(`[GRADE_CLAUDE_FETCH] (Lần ${attempt}/${MAX_FETCH_RETRIES}) Calling ${endpointUrl} with model=${model} (temp=${temperature})`);
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        let errorDetail = res.statusText;
        try {
          const errJson = await res.json();
          errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
        } catch {
          // ignore
        }
        if ((res.status === 401 || /invalid x-api-key/i.test(errorDetail)) && backupApiKey && backupApiKey !== apiKey) {
          console.warn('[Claude] Key trình duyệt không hợp lệ (401). Đang tự động chuyển sang server backup key từ .env.local...');
          return gradeWithClaudeCustomPrompt(promptText, submission, rubric, settings, backupApiKey, undefined, temperature);
        }
        if (res.status === 401 || /invalid x-api-key/i.test(errorDetail)) {
          throw new Error('Anthropic Claude: API Key không hợp lệ hoặc đã hết hạn (401 Unauthorized).');
        }
        throw new Error(`Lỗi từ Claude API (${res.status}): ${errorDetail}`);
      }

      response = res;
      break;
    } catch (fetchErr: any) {
      lastError = fetchErr;
      console.warn(`[GRADE_CLAUDE_FETCH] Lần ${attempt}/${MAX_FETCH_RETRIES} gặp lỗi:`, fetchErr.message || fetchErr);
      if (/401|invalid x-api-key/i.test(fetchErr.message || '')) {
        throw fetchErr;
      }
      if (attempt < MAX_FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 1200));
      }
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error(`Gọi Claude API thất bại sau ${MAX_FETCH_RETRIES} lần thử.`);
  }

  const data = await response.json();
  let textOutput = '';
  let reasoningText = '';

  if (Array.isArray(data.content)) {
    textOutput = data.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
  } else if (typeof data.content === 'string') {
    textOutput = data.content;
  } else if (data.choices && data.choices[0]?.message) {
    textOutput = data.choices[0].message.content || '';
    reasoningText = data.choices[0].message.reasoning_content || '';
  } else if (data.choices && data.choices[0]?.text) {
    textOutput = data.choices[0].text;
  }

  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);
  if (reasoningText && !gradingResult.reasoningText) {
    gradingResult.reasoningText = reasoningText;
  }

  return { gradingResult, modelUsed: model, reasoning: reasoningText, rawOutput: textOutput };
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
): Promise<{ gradingResult: GradingResult; modelUsed: string; reasoning?: string }> {
  const promptText = buildGradingPrompt(
    rubric,
    submission.studentName,
    settings,
    submission.extractedText
  );
  const res = await gradeWithClaudeCustomPrompt(
    promptText,
    submission,
    rubric,
    settings,
    apiKey,
    backupApiKey,
    0.1
  );
  return { gradingResult: res.gradingResult, modelUsed: res.modelUsed, reasoning: res.reasoning };
}

/**
 * Fallback algorithmic synthesis if LLM synthesis fails
 */
export function fallbackSynthesizePasses(
  provider: AIProvider,
  passes: { passNumber: number; modelLabel: string; result: GradingResult }[],
  rubric: RubricData,
  submission: StudentSubmission
): GradingResult {
  const evaluations = passes.map((p) => toModelEvaluation(provider, p.modelLabel, p.result));
  const synthesizedCriteria: CriterionResult[] = rubric.criteria.map((c) => {
    const pointsList = evaluations.map((e) => e.awardedPointsByCriterion[c.id] ?? 0);
    const sorted = [...pointsList].sort((a, b) => a - b);
    const midIdx = Math.floor(sorted.length / 2);
    const consensusPoint = sorted.length % 2 !== 0 ? sorted[midIdx] : sorted[midIdx - 1];

    let bestReason = '';
    let isCorrect: 'full' | 'partial' | 'wrong' =
      consensusPoint >= c.points ? 'full' : consensusPoint > 0 ? 'partial' : 'wrong';

    for (const ev of evaluations) {
      if (Math.abs((ev.awardedPointsByCriterion[c.id] ?? 0) - consensusPoint) <= 0.05) {
        if (ev.reasonsByCriterion[c.id]) {
          bestReason = ev.reasonsByCriterion[c.id];
          isCorrect = ev.isCorrectByCriterion[c.id] || isCorrect;
          break;
        }
      }
    }
    if (!bestReason && evaluations[0]) {
      bestReason = evaluations[0].reasonsByCriterion[c.id] || '';
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

  const primaryResult =
    passes.find((p) => Math.abs(p.result.score - totalScore) <= 0.25)?.result || passes[0].result;

  return {
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
    ocrComparison: submission.ocrComparison,
  };
}

export function fallbackSynthesizeClaudePasses(
  passes: { passNumber: number; modelLabel: string; result: GradingResult }[],
  rubric: RubricData,
  submission: StudentSubmission
): GradingResult {
  return fallbackSynthesizePasses('claude', passes, rubric, submission);
}

/**
 * Grade using Qwen on OpenRouter.ai with custom prompt & temperature
 * Uses @openrouter/sdk streaming: openrouter.chat.send({ chatRequest: { model, messages, stream: true } })
 */
export async function gradeWithOpenRouterCustomPrompt(
  promptText: string,
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string,
  temperature: number = 0.1
): Promise<{ gradingResult: GradingResult; modelUsed: string; reasoning?: string; rawOutput: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình OpenRouter API Key.');
  }

  const model = settings.openrouterModel || process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-flash';
  const isVisionModel = /vl/i.test(model);

  // Build messages – text only for reasoning models, image_url only for vision models
  const userContent: any[] = [{ type: 'text', text: promptText }];
  if (isVisionModel && submission.images && submission.images.length > 0) {
    for (const imgUrl of submission.images) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imgUrl.startsWith('data:') ? imgUrl : `data:image/jpeg;base64,${imgUrl}`,
          detail: 'high',
        },
      });
    }
  }

  const messages: any[] = [{ role: 'user', content: userContent }];

  // Try @openrouter/sdk streaming first (official pattern)
  try {
    const orSdk = createOpenRouterSdk(apiKey, settings.openrouterBaseUrl);
    const stream = await orSdk.chat.send({
      chatRequest: {
        model,
        messages,
        stream: true,
      } as any,
    });

    let textOutput = '';
    let reasoningText: string | undefined;
    let reasoningTokens: number | undefined;

    for await (const chunk of stream as AsyncIterable<any>) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        textOutput += delta.content;
      }
      if (delta?.reasoning) {
        reasoningText = (reasoningText || '') + delta.reasoning;
      }
      if (chunk.usage?.completionTokensDetails?.reasoningTokens !== undefined) {
        reasoningTokens = chunk.usage.completionTokensDetails.reasoningTokens;
      }
    }

    console.log(`[OpenRouter SDK] ${model} streaming done. reasoningTokens=${reasoningTokens ?? 'n/a'}`);

    // Extract <think>...</think> if present
    const thinkMatch = textOutput.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      reasoningText = (reasoningText ? reasoningText + '\n\n' : '') + thinkMatch[1].trim();
      textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    const parsedJson = extractJsonFromText(textOutput);
    const gradingResult = buildGradingResult(parsedJson, submission, rubric);
    if (reasoningText) {
      gradingResult.reasoningText = reasoningText;
    }

    return { gradingResult, modelUsed: model, reasoning: reasoningText, rawOutput: textOutput };
  } catch (sdkErr: any) {
    const sdkMsg = sdkErr.message || '';
    // Propagate auth errors immediately
    if (/invalid api key|unauthorized|401/i.test(sdkMsg) && backupApiKey && backupApiKey !== apiKey) {
      return gradeWithOpenRouterCustomPrompt(promptText, submission, rubric, settings, backupApiKey, undefined, temperature);
    }
    if (/invalid api key|unauthorized|401/i.test(sdkMsg)) {
      throw new Error(`OpenRouter: API Key không hợp lệ (401).`);
    }
    console.warn(`[OpenRouter SDK] Streaming lỗi (${sdkMsg}), fallback sang OpenAI-compat client...`);
  }

  // Fallback: OpenAI-compat client (for proxies / models that don't support SDK streaming)
  const client = createOpenRouterClient(apiKey, settings.openrouterBaseUrl);
  const enableReasoning = settings.openrouterReasoning !== false;
  const requestPayload: any = {
    model,
    messages,
    response_format: { type: 'json_object' },
  };
  if (enableReasoning) {
    requestPayload.reasoning = { enabled: true };
  } else {
    requestPayload.temperature = temperature;
  }

  let apiResponse: any;
  try {
    apiResponse = await (client.chat.completions.create as any)(requestPayload);
  } catch (err: any) {
    const errorMsg = err.message || '';
    if (/invalid api key|unauthorized|401/i.test(errorMsg) && backupApiKey && backupApiKey !== apiKey) {
      return gradeWithOpenRouterCustomPrompt(promptText, submission, rubric, settings, backupApiKey, undefined, temperature);
    }
    if (requestPayload.response_format && /json_object|response_format/i.test(errorMsg)) {
      delete requestPayload.response_format;
      try {
        apiResponse = await (client.chat.completions.create as any)(requestPayload);
      } catch (err2: any) {
        if (userContent.length > 1 && /image|multimodal|vision/i.test(err2.message || '')) {
          requestPayload.messages = [{ role: 'user', content: promptText }];
          apiResponse = await (client.chat.completions.create as any)(requestPayload);
        } else {
          throw err2;
        }
      }
    } else if (userContent.length > 1 && /image|multimodal|vision/i.test(errorMsg)) {
      requestPayload.messages = [{ role: 'user', content: promptText }];
      apiResponse = await (client.chat.completions.create as any)(requestPayload);
    } else {
      throw new Error(`OpenRouter (${model}) lỗi: ${errorMsg}`);
    }
  }

  type ORChatMessage = (typeof apiResponse)['choices'][number]['message'] & {
    reasoning_details?: unknown;
    reasoning?: string;
  };
  const responseMsg2 = (apiResponse?.choices?.[0]?.message || {}) as ORChatMessage;
  let textOutput2 = responseMsg2.content || '';
  const reasoningDetails2 = responseMsg2.reasoning_details;
  let reasoningText2 = typeof responseMsg2.reasoning === 'string' ? responseMsg2.reasoning : undefined;

  const thinkMatch2 = textOutput2.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch2) {
    reasoningText2 = (reasoningText2 ? reasoningText2 + '\n\n' : '') + thinkMatch2[1].trim();
    textOutput2 = textOutput2.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  const parsedJson2 = extractJsonFromText(textOutput2);
  const gradingResult2 = buildGradingResult(parsedJson2, submission, rubric);
  if (reasoningDetails2) {
    gradingResult2.reasoningDetails = reasoningDetails2;
  }
  if (reasoningText2) {
    gradingResult2.reasoningText = reasoningText2;
  }

  return { gradingResult: gradingResult2, modelUsed: model, reasoning: reasoningText2, rawOutput: textOutput2 };
}

/**
 * Grade using Qwen on Alibaba Cloud Model Studio with custom prompt & temperature
 */
export async function gradeWithAlibabaCloudCustomPrompt(
  promptText: string,
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string,
  temperature: number = 0.1
): Promise<{ gradingResult: GradingResult; modelUsed: string; reasoning?: string; rawOutput: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình Alibaba Cloud API Key.');
  }

  const client = createAlibabaCloudClient(apiKey, settings.alibabacloudBaseUrl);
  const model = settings.alibabacloudModel || process.env.ALIBABACLOUD_MODEL || 'qwen-plus-character';

  const isVisionModel = /vl/i.test(model);
  let requestPayload: any;

  if (isVisionModel && submission.images && submission.images.length > 0) {
    const userContents: any[] = [
      {
        type: 'text',
        text: promptText,
      },
    ];
    for (const imgUrl of submission.images) {
      userContents.push({
        type: 'image_url',
        image_url: {
          url: imgUrl.startsWith('data:') ? imgUrl : `data:image/jpeg;base64,${imgUrl}`,
          detail: 'high',
        },
      });
    }
    requestPayload = {
      model,
      messages: [{ role: 'user', content: userContents }],
      response_format: { type: 'json_object' },
      temperature,
    };
  } else {
    requestPayload = {
      model,
      messages: [{ role: 'user', content: promptText }],
      response_format: { type: 'json_object' },
      temperature,
    };
  }

  let apiResponse: any;
  try {
    apiResponse = await (client.chat.completions.create as any)(requestPayload);
  } catch (err: any) {
    const errorMsg = err.message || '';
    if (
      /invalid api key|unauthorized|401/i.test(errorMsg) &&
      backupApiKey &&
      backupApiKey !== apiKey
    ) {
      return gradeWithAlibabaCloudCustomPrompt(
        promptText,
        submission,
        rubric,
        settings,
        backupApiKey,
        undefined,
        temperature
      );
    }

    if (requestPayload.messages[0]?.content && Array.isArray(requestPayload.messages[0].content)) {
      requestPayload.messages = [{ role: 'user', content: promptText }];
      try {
        apiResponse = await (client.chat.completions.create as any)(requestPayload);
      } catch (retryErr: any) {
        if (requestPayload.response_format && /json_object|response_format/i.test(retryErr.message || '')) {
          delete requestPayload.response_format;
          apiResponse = await (client.chat.completions.create as any)(requestPayload);
        } else {
          throw retryErr;
        }
      }
    } else if (requestPayload.response_format && /json_object|response_format/i.test(errorMsg)) {
      delete requestPayload.response_format;
      apiResponse = await (client.chat.completions.create as any)(requestPayload);
    } else {
      throw new Error(`Alibaba Cloud (${model}) lỗi: ${errorMsg}`);
    }
  }

  const responseMsg = apiResponse?.choices?.[0]?.message || {};
  let textOutput = responseMsg.content || '';
  let reasoningText =
    typeof responseMsg.reasoning === 'string'
      ? responseMsg.reasoning
      : typeof responseMsg.reasoning_content === 'string'
      ? responseMsg.reasoning_content
      : undefined;

  const thinkMatch = textOutput.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    reasoningText = (reasoningText ? reasoningText + '\n\n' : '') + thinkMatch[1].trim();
    textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  if (reasoningText) {
    gradingResult.reasoningText = reasoningText;
  }

  return { gradingResult, modelUsed: model, reasoning: reasoningText, rawOutput: textOutput };
}

/**
 * Grade using Gemini with custom prompt & temperature
 */
export async function gradeWithGeminiCustomPrompt(
  promptText: string,
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string,
  temperature: number = 0.1
): Promise<{ gradingResult: GradingResult; modelUsed: string; rawOutput: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình Google Gemini API Key.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents: any[] = [];

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

  contents.push(promptText);

  const userModel = settings.geminiModel || settings.model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const cleanPreferred =
    userModel === 'gemini-2.5-flash' || userModel === 'gemini-2.0-flash' ? 'gemini-3.8-flash' : userModel;
  const candidates = Array.from(
    new Set([cleanPreferred, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-pro'])
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
          temperature,
        },
      });
      modelUsed = m;
      break;
    } catch (err: any) {
      lastError = err;
      if (/api_key_invalid|api key not valid/i.test(err.message || '') && backupApiKey && backupApiKey !== apiKey) {
        return gradeWithGeminiCustomPrompt(promptText, submission, rubric, settings, backupApiKey, undefined, temperature);
      }
    }
  }

  if (!response) {
    throw lastError || new Error('Không thể kết nối đến mô hình Google Gemini.');
  }

  const textOutput = response.text || '';
  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  return { gradingResult, modelUsed, rawOutput: textOutput };
}

/**
 * Grade using OpenAI with custom prompt & temperature
 */
export async function gradeWithOpenAICustomPrompt(
  promptText: string,
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string,
  temperature: number = 0.1
): Promise<{ gradingResult: GradingResult; modelUsed: string; rawOutput: string }> {
  if (!apiKey) {
    throw new Error('Chưa cấu hình OpenAI API Key.');
  }

  const baseUrl = (settings.openaiBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = settings.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o';

  const userContents: any[] = [{ type: 'text', text: promptText }];
  if (submission.images && submission.images.length > 0) {
    for (const imgUrl of submission.images) {
      userContents.push({
        type: 'image_url',
        image_url: {
          url: imgUrl.startsWith('data:') ? imgUrl : `data:image/jpeg;base64,${imgUrl}`,
          detail: 'high',
        },
      });
    }
  }

  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3');
  const requestBody: any = {
    model,
    messages: [{ role: 'user', content: userContents }],
  };
  if (!isReasoningModel) {
    requestBody.temperature = temperature;
    requestBody.response_format = { type: 'json_object' };
  }

  let res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok && requestBody.response_format) {
    delete requestBody.response_format;
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `HTTP ${res.status}`;
    if (/invalid api key|unauthorized|401/i.test(errorMsg) && backupApiKey && backupApiKey !== apiKey) {
      return gradeWithOpenAICustomPrompt(promptText, submission, rubric, settings, backupApiKey, undefined, temperature);
    }
    throw new Error(`OpenAI (${model}) lỗi: ${errorMsg}`);
  }

  const data = await res.json();
  const textOutput = data.choices?.[0]?.message?.content || '';
  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  return { gradingResult, modelUsed: model, rawOutput: textOutput };
}

/**
 * Chấm điểm 3 lần độc lập bằng MỌI mô hình AI (Qwen, Claude, Gemini, OpenAI) với 3 prompt tối ưu:
 * - Lần 1: Chuẩn mực theo barem & tiến trình
 * - Lần 2: Giám khảo phản biện sắc sảo, khó tính & soi lỗi tiềm ẩn
 * - Lần 3: Chuyên gia sư phạm, bản chất toán học & cách giải khác
 * Sau đó đưa 3 kết quả vào Vòng tổng hợp (Chủ tịch hội đồng AI) để chốt kết quả cuối cùng chính xác nhất.
 */
export async function gradeWithProviderTriplePass(
  provider: AIProvider,
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ gradingResult: GradingResult; consensusReport: ConsensusReport }> {
  if (!apiKey) {
    throw new Error(`Chưa cấu hình API Key cho ${provider.toUpperCase()}.`);
  }

  const providerNames: Record<AIProvider, string> = {
    openrouter: `Qwen (${settings.openrouterModel || 'Qwen 3.8'})`,
    alibabacloud: `Qwen Alibaba (${settings.alibabacloudModel || 'Model Studio'})`,
    claude: `Claude (${settings.claudeModel || 'Opus 5'})`,
    gemini: `Gemini (${settings.geminiModel || '3.8 Flash'})`,
    openai: `OpenAI (${settings.openaiModel || 'GPT-4o'})`,
  };
  const displayName = providerNames[provider] || provider;

  // 0. Tự động nhận diện công thức LaTeX bằng OCR nếu bài có ảnh viết tay mà chưa có extractedText
  const isPureText = !/vl/i.test(
    provider === 'openrouter'
      ? settings.openrouterModel || ''
      : provider === 'alibabacloud'
      ? settings.alibabacloudModel || ''
      : ''
  );
  const needsMandatoryOcr = isPureText && submission.images && submission.images.length > 0 && !submission.extractedText;

  if (
    submission.images &&
    submission.images.length > 0 &&
    !submission.extractedText &&
    (settings.autoOcrBeforeGrading !== false || needsMandatoryOcr)
  ) {
    try {
      console.log(`[${displayName} 3-Pass] Tự động đọc công thức toán qua OCR cho ${submission.studentName}...`);
      let ocrRes: { transcription: string } | null = null;
      if (provider === 'openrouter') {
        ocrRes = await transcribeImageWithOpenRouter(submission.images, submission.studentName, settings, apiKey, backupApiKey);
      } else if (provider === 'alibabacloud') {
        ocrRes = await transcribeImageWithAlibabaCloud(submission.images, submission.studentName, settings, apiKey, backupApiKey);
      } else if (provider === 'claude') {
        ocrRes = await transcribeImageWithClaude(submission.images, submission.studentName, settings, apiKey, backupApiKey);
      } else if (provider === 'gemini') {
        ocrRes = await transcribeImageWithGemini(submission.images, submission.studentName, settings, apiKey, backupApiKey);
      } else if (provider === 'openai') {
        ocrRes = await transcribeImageWithOpenAI(submission.images, submission.studentName, settings, apiKey, backupApiKey);
      }
      if (ocrRes?.transcription) {
        submission.extractedText = ocrRes.transcription;
      }
    } catch (ocrErr: any) {
      console.warn(`[${displayName} 3-Pass] OCR cảnh báo (tiếp tục chấm với ảnh gốc):`, ocrErr.message || ocrErr);
    }
  }

  // 1. Tạo 3 prompt tối ưu theo 3 góc nhìn chuyên môn
  const prompt1 = buildModelTriplePassPrompt(1, rubric, submission.studentName, settings, submission.extractedText, displayName);
  const prompt2 = buildModelTriplePassPrompt(2, rubric, submission.studentName, settings, submission.extractedText, displayName);
  const prompt3 = buildModelTriplePassPrompt(3, rubric, submission.studentName, settings, submission.extractedText, displayName);

  const runCustomPrompt = (p: string, temp: number) => {
    switch (provider) {
      case 'openrouter':
        return gradeWithOpenRouterCustomPrompt(p, submission, rubric, settings, apiKey, backupApiKey, temp);
      case 'alibabacloud':
        return gradeWithAlibabaCloudCustomPrompt(p, submission, rubric, settings, apiKey, backupApiKey, temp);
      case 'claude':
        return gradeWithClaudeCustomPrompt(p, submission, rubric, settings, apiKey, backupApiKey, temp);
      case 'gemini':
        return gradeWithGeminiCustomPrompt(p, submission, rubric, settings, apiKey, backupApiKey, temp);
      case 'openai':
        return gradeWithOpenAICustomPrompt(p, submission, rubric, settings, apiKey, backupApiKey, temp);
    }
  };

  const tasks = [
    {
      passNumber: 1,
      perspective: 'Giám khảo Chuẩn mực Barem',
      modelLabel: 'Lần 1: Chuẩn Barem',
      promise: runCustomPrompt(prompt1, 0.1),
    },
    {
      passNumber: 2,
      perspective: 'Giám khảo Phản biện Soi lỗi',
      modelLabel: 'Lần 2: Soi Lỗi Phản Biện',
      promise: runCustomPrompt(prompt2, 0.2),
    },
    {
      passNumber: 3,
      perspective: 'Chuyên gia Sư phạm & Bản chất',
      modelLabel: 'Lần 3: Sư Phạm & Bản Chất',
      promise: runCustomPrompt(prompt3, 0.2),
    },
  ];

  console.log(`[${displayName} 3-Pass] Khởi động 3 lượt chấm song song cho học sinh ${submission.studentName}...`);
  const settled = await Promise.allSettled(tasks.map((t) => t.promise));

  const successfulPasses: {
    passNumber: number;
    perspective: string;
    modelLabel: string;
    result: GradingResult;
    modelUsed: string;
  }[] = [];
  const failedPasses: { provider: string; reason: string }[] = [];

  settled.forEach((res, idx) => {
    const t = tasks[idx];
    if (res.status === 'fulfilled') {
      successfulPasses.push({
        passNumber: t.passNumber,
        perspective: t.perspective,
        modelLabel: t.modelLabel,
        result: res.value.gradingResult,
        modelUsed: res.value.modelUsed,
      });
    } else {
      const msg = res.reason?.message || 'Lỗi không xác định';
      console.error(`[${displayName} 3-Pass] ${t.modelLabel} thất bại:`, msg);
      failedPasses.push({
        provider: `${displayName} (${t.modelLabel})`,
        reason: msg,
      });
    }
  });

  if (successfulPasses.length === 0) {
    throw new Error(
      `Cả 3 lượt chấm bằng ${displayName} đều thất bại: ${failedPasses.map((f) => f.reason).join(' | ')}`
    );
  }

  // 2. Chuyển đổi thành danh sách ModelEvaluation để đối chiếu
  const evaluations: ModelEvaluation[] = successfulPasses.map((sp) =>
    toModelEvaluation(provider, sp.modelLabel, sp.result)
  );

  // 3. Vòng Tổng Hợp: Hội đồng AI của model thẩm định và chốt kết quả tối ưu
  let finalGradingResult: GradingResult;
  let synthesisSummary = '';

  if (successfulPasses.length >= 2) {
    try {
      console.log(`[${displayName} 3-Pass] Chạy Vòng Tổng Hợp (Chủ tịch hội đồng ${displayName})...`);
      const synthesisPrompt = buildModelSynthesisPrompt(
        rubric,
        submission.studentName,
        settings,
        successfulPasses.map((sp) => ({
          passNumber: sp.passNumber,
          perspective: sp.perspective,
          result: sp.result,
        })),
        submission.extractedText,
        `Hội Đồng ${displayName}`
      );

      const synthRes = await runCustomPrompt(synthesisPrompt, 0.1);
      finalGradingResult = synthRes.gradingResult;
      const parsedRaw = extractJsonFromText(synthRes.rawOutput || '');
      if (parsedRaw && parsedRaw.synthesisSummary) {
        synthesisSummary = parsedRaw.synthesisSummary;
      }
    } catch (synthErr: any) {
      console.warn(
        `[${displayName} 3-Pass] Vòng tổng hợp gặp sự cố, chuyển sang thuật toán dung hòa trung vị:`,
        synthErr.message || synthErr
      );
      finalGradingResult = fallbackSynthesizePasses(provider, successfulPasses, rubric, submission);
    }
  } else {
    finalGradingResult = successfulPasses[0].result;
  }

  // Đảm bảo thông tin bài làm chính xác
  finalGradingResult.studentName = submission.studentName;
  finalGradingResult.submissionId = submission.id;
  finalGradingResult.maxScore = rubric.totalPoints;
  finalGradingResult.status = 'completed';
  finalGradingResult.gradedAt = new Date().toISOString();
  finalGradingResult.ocrComparison = submission.ocrComparison;
  if (finalGradingResult.maxScore > 0) {
    finalGradingResult.percentage = Math.round((finalGradingResult.score / finalGradingResult.maxScore) * 100);
  }

  // 4. Báo cáo đối chiếu ConsensusReport
  const scores = evaluations.map((e) => e.score);
  const scoreDiff = scores.length > 1 ? Number((Math.max(...scores) - Math.min(...scores)).toFixed(2)) : 0;
  const tolerance = settings.consensusTolerance ?? 0.25;

  let consensusStatus: ConsensusReport['status'] = 'unanimous';
  if (evaluations.length === 1) {
    consensusStatus = 'single_model';
  } else if (scoreDiff <= 0.05) {
    consensusStatus = 'unanimous';
  } else if (scoreDiff <= tolerance) {
    consensusStatus = 'majority';
  } else {
    consensusStatus = 'resolved_after_retry';
  }

  const passScoresText = successfulPasses
    .map((sp) => `${sp.modelLabel}: ${sp.result.score}đ`)
    .join(' | ');

  let summaryText = '';
  if (evaluations.length === 1) {
    summaryText = `Chỉ có 1/3 lần chấm ${displayName} hoàn thành (${passScoresText}). Điểm: ${finalGradingResult.score}/${rubric.totalPoints}đ.`;
  } else if (consensusStatus === 'unanimous') {
    summaryText = `Đồng thuận tuyệt đối 3 lần chấm ${displayName} (${passScoresText}). Điểm chốt: ${finalGradingResult.score}/${rubric.totalPoints}đ.`;
  } else if (consensusStatus === 'majority') {
    summaryText = `Đồng thuận đa số giữa các lần chấm ${displayName} (Độ lệch: ${scoreDiff}đ | ${passScoresText}). Điểm chốt: ${finalGradingResult.score}/${rubric.totalPoints}đ.`;
  } else {
    summaryText = `Hội đồng ${displayName} đã phân xử chênh lệch giữa các lần chấm (Độ lệch: ${scoreDiff}đ | ${passScoresText}). Điểm chốt tối ưu: ${finalGradingResult.score}/${rubric.totalPoints}đ.`;
  }
  if (synthesisSummary) {
    summaryText += ` [Hội đồng: ${synthesisSummary}]`;
  }

  const consensusReport: ConsensusReport = {
    roundCount: 1,
    regradeCount: 0,
    status: consensusStatus,
    modelsUsed: successfulPasses.map((sp) => `${displayName} (${sp.modelLabel})`),
    scoreDifference: scoreDiff,
    evaluations,
    summary: summaryText,
    failedModels: failedPasses,
  };

  finalGradingResult.consensusReport = consensusReport;

  return { gradingResult: finalGradingResult, consensusReport };
}

/**
 * Backward compatibility wrapper for Claude Triple-Pass
 */
export async function gradeWithClaudeTriplePass(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ gradingResult: GradingResult; consensusReport: ConsensusReport }> {
  return gradeWithProviderTriplePass('claude', submission, rubric, settings, apiKey, backupApiKey);
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
          detail: 'high',
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

  let response: Response | null = null;
  let lastError: any = null;
  const MAX_FETCH_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      let res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // If response_format caused an error on third-party OpenAPI proxies, retry without response_format
      if (!res.ok && requestBody.response_format) {
        delete requestBody.response_format;
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!res.ok) {
        let errorDetail = res.statusText;
        try {
          const errJson = await res.json();
          errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
        } catch {
          // ignore
        }
        if ((res.status === 401 || /invalid api key|incorrect api key/i.test(errorDetail)) && backupApiKey && backupApiKey !== apiKey) {
          console.warn('[OpenAI] Key trình duyệt không hợp lệ. Đang tự động chuyển sang server backup key từ .env.local...');
          return gradeWithOpenAI(submission, rubric, settings, backupApiKey);
        }
        if (/credit_balance_exhausted|insufficient_quota|you have no credits/i.test(errorDetail)) {
          throw new Error('OpenAI: Tài khoản hết số dư / hạn mức (Credit balance exhausted).');
        }
        if (res.status === 401 || /invalid api key|incorrect api key/i.test(errorDetail)) {
          throw new Error('OpenAI: API Key không hợp lệ (401 Unauthorized).');
        }
        throw new Error(`Lỗi từ OpenAI / OpenAPI (${res.status}): ${errorDetail}`);
      }

      response = res;
      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`[OpenAI] Lần ${attempt}/${MAX_FETCH_RETRIES} gặp lỗi:`, err.message || err);
      if (/401|invalid api key|credit_balance_exhausted/i.test(err.message || '')) {
        throw err;
      }
      if (attempt < MAX_FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 1200));
      }
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error(`OpenAI API thất bại sau ${MAX_FETCH_RETRIES} lần thử.`);
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';

  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  return { gradingResult, modelUsed: model };
}

/**
 * Grade using Qwen on OpenRouter.ai (qwen/qwen3.8-flash, qwen/qwen-2.5-vl-72b-instruct:free, etc.)
 * Uses @openrouter/sdk streaming: openrouter.chat.send({ chatRequest: { model, messages, stream: true } })
 * Preserves reasoning tokens for transparent chain-of-thought.
 */
export async function gradeWithOpenRouter(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ gradingResult: GradingResult; modelUsed: string; reasoning?: string }> {
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình OpenRouter API Key. Vui lòng vào Cài Đặt (chọn mục OpenRouter) để nhập API Key, hoặc khai báo OPENROUTER_API_KEY trong file .env.local.'
    );
  }

  const model = settings.openrouterModel || process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-flash';

  const promptText = buildGradingPrompt(
    rubric,
    submission.studentName,
    settings,
    submission.extractedText
  );

  const isVisionModel = /vl/i.test(model);
  const userContent: any[] = [{ type: 'text', text: promptText }];
  if (isVisionModel && submission.images && submission.images.length > 0) {
    for (const imgUrl of submission.images) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imgUrl, detail: 'high' },
      });
    }
  }

  const messages: any[] = [{ role: 'user', content: userContent }];

  // Primary: @openrouter/sdk streaming
  try {
    const orSdk = createOpenRouterSdk(apiKey, settings.openrouterBaseUrl);
    const stream = await orSdk.chat.send({
      chatRequest: {
        model,
        messages,
        stream: true,
      } as any,
    });

    let textOutput = '';
    let reasoningText: string | undefined;
    let reasoningTokens: number | undefined;

    for await (const chunk of stream as AsyncIterable<any>) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        textOutput += delta.content;
      }
      if (delta?.reasoning) {
        reasoningText = (reasoningText || '') + delta.reasoning;
      }
      if (chunk.usage?.completionTokensDetails?.reasoningTokens !== undefined) {
        reasoningTokens = chunk.usage.completionTokensDetails.reasoningTokens;
      }
    }

    console.log(`[OpenRouter SDK] ${model} streaming done. reasoningTokens=${reasoningTokens ?? 'n/a'}`);

    const thinkMatch = textOutput.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      reasoningText = (reasoningText ? reasoningText + '\n\n' : '') + thinkMatch[1].trim();
      textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    const parsedJson = extractJsonFromText(textOutput);
    const gradingResult = buildGradingResult(parsedJson, submission, rubric);
    if (reasoningText) {
      gradingResult.reasoningText = reasoningText;
    }

    return { gradingResult, modelUsed: model, reasoning: reasoningText };
  } catch (sdkErr: any) {
    const sdkMsg = sdkErr.message || '';
    if (/invalid api key|unauthorized|401/i.test(sdkMsg) && backupApiKey && backupApiKey !== apiKey) {
      console.warn('[OpenRouter] Key trình duyệt không hợp lệ. Đang tự động chuyển sang server backup key...');
      return gradeWithOpenRouter(submission, rubric, settings, backupApiKey);
    }
    if (/invalid api key|unauthorized|401/i.test(sdkMsg)) {
      throw new Error('OpenRouter: API Key không hợp lệ (401).');
    }
    console.warn(`[OpenRouter SDK] Streaming lỗi (${sdkMsg}), fallback sang OpenAI-compat client...`);
  }

  // Fallback: OpenAI-compat client
  const client = createOpenRouterClient(apiKey, settings.openrouterBaseUrl);
  const enableReasoning = settings.openrouterReasoning !== false;
  const requestPayload: any = {
    model,
    messages,
    response_format: { type: 'json_object' },
  };
  if (enableReasoning) {
    requestPayload.reasoning = { enabled: true };
  } else {
    requestPayload.temperature = 0.1;
  }

  let apiResponse: any;
  try {
    apiResponse = await (client.chat.completions.create as any)(requestPayload);
  } catch (err: any) {
    const errorMsg = err.message || '';
    if (/invalid api key|unauthorized|401/i.test(errorMsg) && backupApiKey && backupApiKey !== apiKey) {
      console.warn('[OpenRouter] Key trình duyệt không hợp lệ. Đang tự động chuyển sang server backup key...');
      return gradeWithOpenRouter(submission, rubric, settings, backupApiKey);
    }
    if (requestPayload.response_format && /json_object|response_format/i.test(errorMsg)) {
      delete requestPayload.response_format;
      try {
        apiResponse = await (client.chat.completions.create as any)(requestPayload);
      } catch (err2: any) {
        if (userContent.length > 1 && /image|multimodal|vision/i.test(err2.message || '')) {
          requestPayload.messages = [{ role: 'user', content: promptText }];
          apiResponse = await (client.chat.completions.create as any)(requestPayload);
        } else {
          throw err2;
        }
      }
    } else if (userContent.length > 1 && /image|multimodal|vision/i.test(errorMsg)) {
      requestPayload.messages = [{ role: 'user', content: promptText }];
      apiResponse = await (client.chat.completions.create as any)(requestPayload);
    } else {
      throw new Error(`Lỗi từ OpenRouter (${model}): ${errorMsg}`);
    }
  }

  type ORChatMessage = (typeof apiResponse)['choices'][number]['message'] & {
    reasoning_details?: unknown;
    reasoning?: string;
  };
  const responseMsg = (apiResponse?.choices?.[0]?.message || {}) as ORChatMessage;
  let textOutput = responseMsg.content || '';
  const reasoningDetails = responseMsg.reasoning_details;
  let reasoningText = typeof responseMsg.reasoning === 'string' ? responseMsg.reasoning : undefined;

  const thinkMatch = textOutput.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    reasoningText = (reasoningText ? reasoningText + '\n\n' : '') + thinkMatch[1].trim();
    textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);
  if (reasoningDetails) {
    gradingResult.reasoningDetails = reasoningDetails;
  }
  if (reasoningText) {
    gradingResult.reasoningText = reasoningText;
  }

  return { gradingResult, modelUsed: model, reasoning: reasoningText };
}

/**
 * Grade using Qwen on Alibaba Cloud Model Studio (DashScope Singapore / OpenAI Compatible)
 * Supports models like qwen-plus-character, qwen-flash-character, qwen-plus, qwen-vl-max, etc.
 */
export async function gradeWithAlibabaCloud(
  submission: StudentSubmission,
  rubric: RubricData,
  settings: TeacherSettings,
  apiKey: string,
  backupApiKey?: string
): Promise<{ gradingResult: GradingResult; modelUsed: string; reasoning?: string }> {
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Alibaba Cloud API Key. Vui lòng vào Cài Đặt (chọn tab Alibaba Cloud) để nhập API Key, hoặc khai báo ALIBABACLOUD_API_KEY trong file .env.local.'
    );
  }

  const client = createAlibabaCloudClient(apiKey, settings.alibabacloudBaseUrl);
  const model = settings.alibabacloudModel || process.env.ALIBABACLOUD_MODEL || 'qwen-plus-character';

  const promptText = buildGradingPrompt(
    rubric,
    submission.studentName,
    settings,
    submission.extractedText
  );

  const isVisionModel = /vl/i.test(model);
  let requestPayload: any;

  if (isVisionModel && submission.images && submission.images.length > 0) {
    const userContents: any[] = [
      {
        type: 'text',
        text: promptText,
      },
    ];
    for (const imgUrl of submission.images) {
      userContents.push({
        type: 'image_url',
        image_url: { url: imgUrl, detail: 'high' },
      });
    }
    requestPayload = {
      model,
      messages: [{ role: 'user', content: userContents }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    };
  } else {
    requestPayload = {
      model,
      messages: [{ role: 'user', content: promptText }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    };
  }

  let apiResponse: any;
  try {
    apiResponse = await (client.chat.completions.create as any)(requestPayload);
  } catch (err: any) {
    const errorMsg = err.message || '';
    if (
      (/invalid api key|unauthorized|401/i.test(errorMsg)) &&
      backupApiKey &&
      backupApiKey !== apiKey
    ) {
      console.warn('[Alibaba Cloud] Key trình duyệt không hợp lệ. Đang tự động chuyển sang server backup key...');
      return gradeWithAlibabaCloud(submission, rubric, settings, backupApiKey);
    }

    if (requestPayload.messages[0]?.content && Array.isArray(requestPayload.messages[0].content)) {
      console.warn(`[Alibaba Cloud] Model ${model} không hỗ trợ mảng nội dung đa phương thức, chuyển sang gửi dạng text thuần.`);
      requestPayload.messages = [{ role: 'user', content: promptText }];
      try {
        apiResponse = await (client.chat.completions.create as any)(requestPayload);
      } catch (retryErr: any) {
        if (requestPayload.response_format && /json_object|response_format/i.test(retryErr.message || '')) {
          delete requestPayload.response_format;
          apiResponse = await (client.chat.completions.create as any)(requestPayload);
        } else {
          throw retryErr;
        }
      }
    } else if (requestPayload.response_format && /json_object|response_format/i.test(errorMsg)) {
      delete requestPayload.response_format;
      apiResponse = await (client.chat.completions.create as any)(requestPayload);
    } else {
      throw new Error(`Lỗi từ Alibaba Cloud Model Studio (${model}): ${errorMsg}`);
    }
  }

  const responseMsg = apiResponse?.choices?.[0]?.message || {};
  let textOutput = responseMsg.content || '';
  let reasoningText = typeof responseMsg.reasoning === 'string' ? responseMsg.reasoning : (typeof responseMsg.reasoning_content === 'string' ? responseMsg.reasoning_content : undefined);

  const thinkMatch = textOutput.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    reasoningText = (reasoningText ? reasoningText + '\n\n' : '') + thinkMatch[1].trim();
    textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  const parsedJson = extractJsonFromText(textOutput);
  const gradingResult = buildGradingResult(parsedJson, submission, rubric);

  if (reasoningText) {
    gradingResult.reasoningText = reasoningText;
  }

  return { gradingResult, modelUsed: model, reasoning: reasoningText };
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

  // 0. Ensure high-fidelity math OCR transcription exists if submission has images
  const isPureText = !/vl/i.test(
    provider === 'openrouter'
      ? settings.openrouterModel || ''
      : provider === 'alibabacloud'
      ? settings.alibabacloudModel || ''
      : ''
  );
  const needsMandatoryOcr = isPureText && submission.images && submission.images.length > 0 && !submission.extractedText;

  if (
    submission.images &&
    submission.images.length > 0 &&
    (!submission.extractedText || !submission.ocrComparison) &&
    (settings.autoOcrBeforeGrading !== false || needsMandatoryOcr)
  ) {
    try {
      if (provider === 'openrouter' && !submission.extractedText) {
        const ocrRes = await transcribeImageWithOpenRouter(
          submission.images,
          submission.studentName,
          settings,
          resolvedApiKey,
          backupApiKey
        );
        submission.extractedText = ocrRes.transcription;
      } else if (provider === 'alibabacloud' && !submission.extractedText) {
        const ocrRes = await transcribeImageWithAlibabaCloud(
          submission.images,
          submission.studentName,
          settings,
          resolvedApiKey,
          backupApiKey
        );
        submission.extractedText = ocrRes.transcription;
      } else {
        const ocrKeys = {
          gemini: provider === 'gemini' ? resolvedApiKey : undefined,
          claude: provider === 'claude' ? resolvedApiKey : undefined,
          openai: provider === 'openai' ? resolvedApiKey : undefined,
          openrouter: provider === 'openrouter' ? resolvedApiKey : undefined,
          alibabacloud: provider === 'alibabacloud' ? resolvedApiKey : undefined,
        };
        const ocrBackup = backupApiKey ? { [provider]: backupApiKey } : undefined;
        const { ocrComparison, consensusText } = await transcribeWithThreeModelsAndConsensus(
          submission,
          settings,
          ocrKeys,
          ocrBackup
        );
        submission.extractedText = consensusText;
        submission.ocrComparison = ocrComparison;
      }
    } catch (ocrErr) {
      console.warn('[OCR] Chuyển tiếp chấm với ảnh trực tiếp:', ocrErr);
    }
  }

  switch (provider) {
    case 'alibabacloud': {
      const { gradingResult, modelUsed } = await gradeWithAlibabaCloud(
        submission,
        rubric,
        settings,
        resolvedApiKey,
        backupApiKey
      );
      if (submission.ocrComparison && !gradingResult.ocrComparison) {
        gradingResult.ocrComparison = submission.ocrComparison;
      }
      return { gradingResult, provider: 'alibabacloud', modelUsed };
    }
    case 'openrouter': {
      const { gradingResult, modelUsed } = await gradeWithOpenRouter(
        submission,
        rubric,
        settings,
        resolvedApiKey,
        backupApiKey
      );
      if (submission.ocrComparison && !gradingResult.ocrComparison) {
        gradingResult.ocrComparison = submission.ocrComparison;
      }
      return { gradingResult, provider: 'openrouter', modelUsed };
    }
    case 'claude': {
      const { gradingResult, modelUsed } = await gradeWithClaude(
        submission,
        rubric,
        settings,
        resolvedApiKey,
        backupApiKey
      );
      if (submission.ocrComparison && !gradingResult.ocrComparison) {
        gradingResult.ocrComparison = submission.ocrComparison;
      }
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
      if (submission.ocrComparison && !gradingResult.ocrComparison) {
        gradingResult.ocrComparison = submission.ocrComparison;
      }
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
      if (submission.ocrComparison && !gradingResult.ocrComparison) {
        gradingResult.ocrComparison = submission.ocrComparison;
      }
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
    reasoningText: res.reasoningText,
  };
}

/**
 * Grade using AI models (Gemini, Claude, OpenAI, Qwen/OpenRouter) simultaneously with the same prompt,
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
    openrouter?: string;
    alibabacloud?: string;
  },
  backupKeys?: {
    gemini?: string;
    claude?: string;
    openai?: string;
    openrouter?: string;
    alibabacloud?: string;
  }
): Promise<{ gradingResult: GradingResult; consensusReport: ConsensusReport }> {
  const tolerance = settings.consensusTolerance ?? 0.25;
  const maxRetries = settings.maxRegradeRetries ?? 2;

  // 0. Ensure high-fidelity math OCR transcription exists if submission has images
  if (
    submission.images &&
    submission.images.length > 0 &&
    (!submission.extractedText || !submission.ocrComparison) &&
    settings.autoOcrBeforeGrading !== false
  ) {
    console.log(
      `[OCR 3-Model] Đang chạy nhận diện công thức toán viết tay bằng các model cho bài của ${submission.studentName}...`
    );
    try {
      const { ocrComparison, consensusText } = await transcribeWithThreeModelsAndConsensus(
        submission,
        settings,
        apiKeys,
        backupKeys
      );
      submission.extractedText = consensusText;
      submission.ocrComparison = ocrComparison;
    } catch (ocrErr) {
      console.warn('[OCR 3-Model] Cảnh báo lỗi khi OCR đối chiếu, tiếp tục với ảnh gốc:', ocrErr);
    }
  }

  let roundCount = 1;
  let regradeCount = 0;
  let finalEvaluations: ModelEvaluation[] = [];
  let modelResults: { provider: AIProvider; result: GradingResult; model: string }[] = [];
  const accumulatedFailedModels: { provider: string; reason: string }[] = [];

  // Helper to run all models in parallel with identical prompt and settings
  const runTripleEvaluation = async () => {
    const tasks: {
      provider: string;
      promise: Promise<{ provider: AIProvider; result: GradingResult; model: string }>;
    }[] = [];

    // 1. Google Gemini
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

    // 2. Anthropic Claude
    if (apiKeys.claude) {
      tasks.push({
        provider: 'Anthropic Claude',
        promise: gradeWithClaude(submission, rubric, settings, apiKeys.claude, backupKeys?.claude).then(
          ({ gradingResult, modelUsed, reasoning }) => {
            if (reasoning && !gradingResult.reasoningText) {
              gradingResult.reasoningText = reasoning;
            }
            return {
              provider: 'claude' as AIProvider,
              result: gradingResult,
              model: modelUsed,
            };
          }
        ),
      });
    }

    // 3. OpenAI GPT - Có tự động dự phòng sang OpenRouter / Gemini nếu OpenAI hết hạn mức
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
            const openrouterKeyToUse = backupKeys?.openrouter || apiKeys.openrouter;
            if (openrouterKeyToUse) {
              console.warn(
                `[Consensus fallback] OpenAI gặp lỗi (${openAiErr.message}). Tự động dùng Qwen (OpenRouter) làm Model thứ 3.`
              );
              const { gradingResult, modelUsed, reasoning } = await gradeWithOpenRouter(
                submission,
                rubric,
                settings,
                openrouterKeyToUse,
                backupKeys?.openrouter
              );
              if (reasoning && !gradingResult.reasoningText) {
                gradingResult.reasoningText = reasoning;
              }
              return {
                provider: 'openrouter' as AIProvider,
                result: gradingResult,
                model: `${modelUsed} (Dự phòng cho OpenAI)`,
              };
            }
            const geminiKeyToUse = backupKeys?.gemini || apiKeys.gemini;
            if (geminiKeyToUse) {
              console.warn(
                `[Consensus fallback] OpenAI gặp lỗi (${openAiErr.message}). Tự động dùng Gemini 3.6 Flash làm Model thứ 3.`
              );
              const fallbackSettings: TeacherSettings = {
                ...settings,
                geminiModel: 'gemini-3.6-flash',
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
    } else if (apiKeys.openrouter) {
      // Nếu không có OpenAI key, dùng Qwen (OpenRouter)
      tasks.push({
        provider: 'Qwen (OpenRouter)',
        promise: gradeWithOpenRouter(submission, rubric, settings, apiKeys.openrouter, backupKeys?.openrouter).then(
          ({ gradingResult, modelUsed, reasoning }) => {
            if (reasoning && !gradingResult.reasoningText) {
              gradingResult.reasoningText = reasoning;
            }
            return {
              provider: 'openrouter' as AIProvider,
              result: gradingResult,
              model: modelUsed,
            };
          }
        ),
      });
    } else if (apiKeys.gemini) {
      // Nếu không có OpenAI và OpenRouter key, chạy Gemini 3.6 Flash làm Model thứ 3
      const fallbackSettings: TeacherSettings = {
        ...settings,
        geminiModel: 'gemini-3.6-flash',
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

    // Nếu cả OpenAI và OpenRouter đều có key, thêm OpenRouter làm mô hình thẩm định độc lập
    if (
      apiKeys.openrouter &&
      !tasks.some((t) => t.provider === 'Qwen (OpenRouter)')
    ) {
      tasks.push({
        provider: 'Qwen (OpenRouter)',
        promise: gradeWithOpenRouter(submission, rubric, settings, apiKeys.openrouter, backupKeys?.openrouter).then(
          ({ gradingResult, modelUsed, reasoning }) => {
            if (reasoning && !gradingResult.reasoningText) {
              gradingResult.reasoningText = reasoning;
            }
            return {
              provider: 'openrouter' as AIProvider,
              result: gradingResult,
              model: modelUsed,
            };
          }
        ),
      });
    }

    // Nếu có Alibaba Cloud key, thêm mô hình Qwen Alibaba Cloud
    if (apiKeys.alibabacloud && !tasks.some((t) => t.provider === 'Qwen (Alibaba Cloud)')) {
      tasks.push({
        provider: 'Qwen (Alibaba Cloud)',
        promise: gradeWithAlibabaCloud(submission, rubric, settings, apiKeys.alibabacloud, backupKeys?.alibabacloud).then(
          ({ gradingResult, modelUsed, reasoning }) => {
            if (reasoning && !gradingResult.reasoningText) {
              gradingResult.reasoningText = reasoning;
            }
            return {
              provider: 'alibabacloud' as AIProvider,
              result: gradingResult,
              model: modelUsed,
            };
          }
        ),
      });
    }

    if (tasks.length === 0) {
      throw new Error(
        'Chưa cấu hình API Key nào (Gemini, Claude, OpenAI, OpenRouter hoặc Alibaba Cloud) để thực hiện đối chiếu.'
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
    // Nếu có key Gemini, bổ sung thêm model Gemini khác (gemini-3.6-flash / gemini-3.5-flash / gemini-3.8-flash) để luôn đủ 3 model!
    const effectiveGeminiKey = backupKeys?.gemini || apiKeys.gemini;
    if (successful.length < 3 && effectiveGeminiKey) {
      const needed = 3 - successful.length;
      const extraCandidates = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash'];
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
    ocrComparison: submission.ocrComparison,
  };

  return { gradingResult: finalGradingResult, consensusReport };
}

