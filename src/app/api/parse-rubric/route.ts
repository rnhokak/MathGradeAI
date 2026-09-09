import { NextRequest, NextResponse } from 'next/server';
import { parseDocx } from '@/utils/docxParser';
import { parseRubricFromTablesAndText, parseRubricWithGemini } from '@/utils/rubricParser';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let text = '';
    let tables: string[][][] = [];
    let fileName = 'Rubric';

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
    }

    const apiKey = (
      req.headers.get('x-gemini-api-key') ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

    // 1. Try Gemini AI parsing if API key is present
    if (apiKey) {
      try {
        const aiRubric = await parseRubricWithGemini(text, tables, fileName, apiKey, modelName);
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
