import { NextRequest, NextResponse } from 'next/server';
import { StudentSubmission, TeacherSettings } from '@/types/grading';
import { transcribeWithThreeModelsAndConsensus } from '@/utils/aiGrading';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      submission,
      settings,
    }: {
      submission: StudentSubmission;
      settings: TeacherSettings;
    } = body;

    if (!submission) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bài làm cần nhận diện công thức.' },
        { status: 400 }
      );
    }

    // Retrieve API keys from server env
    const envGemini = (process.env.GEMINI_API_KEY || '').trim();
    const envClaude = (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '').trim();
    const envOpenai = (process.env.OPENAI_API_KEY || '').trim();

    // Client provided keys
    const clientGemini = (req.headers.get('x-gemini-api-key') || settings?.geminiApiKey || '').trim();
    const clientClaude = (req.headers.get('x-claude-api-key') || settings?.claudeApiKey || '').trim();
    const clientOpenai = (req.headers.get('x-openai-api-key') || settings?.openaiApiKey || '').trim();

    const geminiKey = clientGemini || envGemini;
    const claudeKey = clientClaude || envClaude;
    const openaiKey = clientOpenai || envOpenai;

    const availableKeys = {
      gemini: geminiKey,
      claude: claudeKey,
      openai: openaiKey,
    };

    const keyCount = Object.values(availableKeys).filter(Boolean).length;
    if (keyCount === 0) {
      return NextResponse.json(
        {
          error:
            'Chưa cấu hình API Key nào trong Cài Đặt hoặc .env.local (cần ít nhất API Key của Gemini, Claude hoặc OpenAI để đọc ảnh).',
        },
        { status: 400 }
      );
    }

    const backupKeys = {
      gemini: envGemini && envGemini !== clientGemini ? envGemini : undefined,
      claude: envClaude && envClaude !== clientClaude ? envClaude : undefined,
      openai: envOpenai && envOpenai !== clientOpenai ? envOpenai : undefined,
    };

    const { ocrComparison, consensusText } = await transcribeWithThreeModelsAndConsensus(
      submission,
      settings,
      availableKeys,
      backupKeys
    );

    return NextResponse.json({
      success: true,
      ocrComparison,
      consensusText,
    });
  } catch (error: any) {
    console.error('OCR Transcribe error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Lỗi trong quá trình nhận diện công thức từ ảnh',
      },
      { status: 500 }
    );
  }
}
