import { NextRequest, NextResponse } from 'next/server';
import { RubricData, StudentSubmission, TeacherSettings } from '@/types/grading';
import { gradeWithProvider, gradeWithThreeModelsAndConsensus } from '@/utils/aiGrading';

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

    const gradingMode = settings?.gradingMode || 'triple_consensus';

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

    // Server environment backup keys (used if client keys are invalid/malformed)
    const backupKeys = {
      gemini: envGemini && envGemini !== clientGemini ? envGemini : undefined,
      claude: envClaude && envClaude !== clientClaude ? envClaude : undefined,
      openai: envOpenai && envOpenai !== clientOpenai ? envOpenai : undefined,
    };

    // Mode 1: Triple-Model Consensus (Gemini + Claude + OpenAI)
    if (gradingMode === 'triple_consensus') {
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
              'Chưa cấu hình API Key nào trong Cài Đặt hoặc .env.local (cần ít nhất API Key của Gemini, Claude hoặc OpenAI để chấm đối chiếu).',
          },
          { status: 400 }
        );
      }

      const { gradingResult, consensusReport } = await gradeWithThreeModelsAndConsensus(
        submission,
        rubric,
        settings,
        availableKeys,
        backupKeys
      );

      return NextResponse.json({
        success: true,
        gradingResult,
        consensusReport,
        mode: 'triple_consensus',
      });
    }

    // Mode 2: Single model provider
    const provider = settings?.provider || 'claude';
    let apiKey = '';
    let backupApiKey: string | undefined = undefined;

    if (provider === 'claude') {
      apiKey = claudeKey;
      backupApiKey = backupKeys.claude;
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
      apiKey = openaiKey;
      backupApiKey = backupKeys.openai;
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
      apiKey = geminiKey;
      backupApiKey = backupKeys.gemini;
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
      apiKey,
      backupApiKey
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

