import { NextRequest, NextResponse } from 'next/server';
import { parseDocx } from '@/utils/docxParser';
import {
  parseRubricFromTablesAndText,
  parseRubricWithGemini,
  parseRubricWithClaude,
  parseRubricWithOpenAI,
} from '@/utils/rubricParser';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let text = '';
    let tables: string[][][] = [];
    let fileName = 'Rubric';
    let bodyProvider = '';
    let bodyModel = '';
    let bodyBaseUrl = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'Không tìm thấy file tải lên.' }, { status: 400 });
      }

      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await parseDocx(arrayBuffer);
      text = parsed.text;
      tables = parsed.tables;
    } else {
      const body = await req.json();
      text = body.text || '';
      tables = body.tables || [];
      fileName = body.fileName || 'Rubric';
      bodyProvider = body.provider || '';
      bodyModel = body.model || '';
      bodyBaseUrl = body.baseUrl || '';
    }

    const provider = req.headers.get('x-ai-provider') || bodyProvider || 'claude';

    // 1. Try AI parsing with selected provider
    if (provider === 'claude') {
      const claudeKey = (
        req.headers.get('x-claude-api-key') ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.CLAUDE_API_KEY ||
        ''
      ).trim();
      const claudeModel = req.headers.get('x-claude-model') || bodyModel || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
      const claudeBaseUrl = req.headers.get('x-claude-base-url') || bodyBaseUrl || process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1';

      if (claudeKey) {
        try {
          const aiRubric = await parseRubricWithClaude(text, tables, fileName, claudeKey, claudeModel, claudeBaseUrl);
          if (aiRubric.criteria && aiRubric.criteria.length > 0) {
            return NextResponse.json({
              success: true,
              rubric: aiRubric,
              mode: 'claude',
            });
          }
        } catch (aiErr: any) {
          console.error('Claude rubric parsing failed, falling back to smart heuristic:', aiErr);
        }
      }
    } else if (provider === 'openai') {
      const openaiKey = (
        req.headers.get('x-openai-api-key') ||
        process.env.OPENAI_API_KEY ||
        ''
      ).trim();
      const openaiModel = req.headers.get('x-openai-model') || bodyModel || process.env.OPENAI_MODEL || 'gpt-4o';
      const openaiBaseUrl = req.headers.get('x-openai-base-url') || bodyBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

      if (openaiKey) {
        try {
          const aiRubric = await parseRubricWithOpenAI(text, tables, fileName, openaiKey, openaiModel, openaiBaseUrl);
          if (aiRubric.criteria && aiRubric.criteria.length > 0) {
            return NextResponse.json({
              success: true,
              rubric: aiRubric,
              mode: 'openai',
            });
          }
        } catch (aiErr: any) {
          console.error('OpenAI rubric parsing failed, falling back to smart heuristic:', aiErr);
        }
      }
    } else {
      // Gemini default
      const geminiKey = (
        req.headers.get('x-gemini-api-key') ||
        process.env.GEMINI_API_KEY ||
        ''
      ).trim();
      const geminiModel = req.headers.get('x-gemini-model') || bodyModel || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

      if (geminiKey) {
        try {
          const aiRubric = await parseRubricWithGemini(text, tables, fileName, geminiKey, geminiModel);
          if (aiRubric.criteria && aiRubric.criteria.length > 0) {
            return NextResponse.json({
              success: true,
              rubric: aiRubric,
              mode: 'gemini',
            });
          }
        } catch (aiErr: any) {
          console.error('Gemini rubric parsing failed, falling back to smart heuristic:', aiErr);
        }
      }
    }

    // 2. Fallback to smart heuristic table and text parser
    const heuristicRubric = parseRubricFromTablesAndText(tables, text, fileName);

    return NextResponse.json({
      success: true,
      rubric: heuristicRubric,
      mode: 'heuristic',
    });
  } catch (error: any) {
    console.error('Error parsing rubric:', error);
    return NextResponse.json(
      { error: 'Lỗi khi bóc tách rubric: ' + (error.message || error) },
      { status: 500 }
    );
  }
}

