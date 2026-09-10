import { NextRequest, NextResponse } from 'next/server';
import { RubricData, StudentSubmission, TeacherSettings } from '@/types/grading';
import { gradeWithProvider } from '@/utils/aiGrading';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      submission,
      rubric,
      settings,
    }: {
      submission: StudentSubmission;
      rubric: RubricData;
      settings: TeacherSettings;
    } = body;

    if (!submission || !rubric) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bài làm hoặc rubric chấm điểm.' },
        { status: 400 }
      );
    }

    const provider = settings?.provider || 'claude';
    let apiKey = '';

    if (provider === 'claude') {
      apiKey = (
        req.headers.get('x-claude-api-key') ||
        settings?.claudeApiKey ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.CLAUDE_API_KEY ||
        ''
      ).trim();

      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình Anthropic Claude API Key. Vui lòng bấm vào Cài Đặt (chọn tab Claude) để nhập API Key, hoặc khai báo ANTHROPIC_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }
    } else if (provider === 'openai') {
      apiKey = (
        req.headers.get('x-openai-api-key') ||
        settings?.openaiApiKey ||
        process.env.OPENAI_API_KEY ||
        ''
      ).trim();

      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình OpenAI / OpenAPI API Key. Vui lòng bấm vào Cài Đặt (chọn tab OpenAI) để nhập API Key, hoặc khai báo OPENAI_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }
    } else {
      // Gemini
      apiKey = (
        req.headers.get('x-gemini-api-key') ||
        settings?.geminiApiKey ||
        process.env.GEMINI_API_KEY ||
        ''
      ).trim();

      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình Google Gemini API Key. Vui lòng bấm vào Cài Đặt để nhập API Key, hoặc khai báo biến GEMINI_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }
    }

    const { gradingResult, modelUsed } = await gradeWithProvider(
      submission,
      rubric,
      settings,
      apiKey
    );

    return NextResponse.json({
      success: true,
      gradingResult,
      mode: provider,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Grading error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Lỗi trong quá trình chấm bài bằng AI',
      },
      { status: 500 }
    );
  }
}

