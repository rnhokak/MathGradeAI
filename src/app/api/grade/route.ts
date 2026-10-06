import { NextRequest, NextResponse } from 'next/server';
import { RubricData, StudentSubmission, TeacherSettings } from '@/types/grading';
import {
  gradeWithProvider,
  gradeWithThreeModelsAndConsensus,
  gradeWithClaudeTriplePass,
  gradeWithProviderTriplePass,
  resolveClaudeEndpoint,
} from '@/utils/aiGrading';

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

    // Always normalize claudeBaseUrl to prevent any legacy /v1/messages proxy errors
    const effectiveSettings: TeacherSettings = {
      ...(settings || {}),
      claudeBaseUrl: resolveClaudeEndpoint(settings?.claudeBaseUrl),
    };

    const gradingMode = effectiveSettings?.gradingMode || 'triple_pass';

    // Retrieve API keys from server env
    const envGemini = (process.env.GEMINI_API_KEY || '').trim();
    const envClaude = (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '').trim();
    const envOpenai = (process.env.OPENAI_API_KEY || '').trim();
    const envOpenrouter = (process.env.OPENROUTER_API_KEY || '').trim();
    const envAlibaba = (process.env.ALIBABACLOUD_API_KEY || '').trim();

    // Client provided keys
    const clientGemini = (req.headers.get('x-gemini-api-key') || settings?.geminiApiKey || '').trim();
    const clientClaude = (req.headers.get('x-claude-api-key') || settings?.claudeApiKey || '').trim();
    const clientOpenai = (req.headers.get('x-openai-api-key') || settings?.openaiApiKey || '').trim();
    const clientOpenrouter = (req.headers.get('x-openrouter-api-key') || settings?.openrouterApiKey || '').trim();
    const clientAlibaba = (req.headers.get('x-alibabacloud-api-key') || settings?.alibabacloudApiKey || '').trim();

    const geminiKey = clientGemini || envGemini;
    const claudeKey = clientClaude || envClaude;
    const openaiKey = clientOpenai || envOpenai;
    const openrouterKey = clientOpenrouter || envOpenrouter;
    const alibabaKey = clientAlibaba || envAlibaba;

    // Server environment backup keys (used if client keys are invalid/malformed)
    const backupKeys = {
      gemini: envGemini && envGemini !== clientGemini ? envGemini : undefined,
      claude: envClaude && envClaude !== clientClaude ? envClaude : undefined,
      openai: envOpenai && envOpenai !== clientOpenai ? envOpenai : undefined,
      openrouter: envOpenrouter && envOpenrouter !== clientOpenrouter ? envOpenrouter : undefined,
      alibabacloud: envAlibaba && envAlibaba !== clientAlibaba ? envAlibaba : undefined,
    };

    // Mode 1: Triple-Model Consensus (Gemini + Claude + OpenAI + OpenRouter + Alibaba Cloud)
    if (gradingMode === 'triple_consensus') {
      const availableKeys = {
        gemini: geminiKey,
        claude: claudeKey,
        openai: openaiKey,
        openrouter: openrouterKey,
        alibabacloud: alibabaKey,
      };

      const keyCount = Object.values(availableKeys).filter(Boolean).length;
      if (keyCount === 0) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình API Key nào trong Cài Đặt hoặc .env.local (cần ít nhất API Key của Gemini, Claude, OpenAI, OpenRouter hoặc Alibaba Cloud để chấm đối chiếu).',
          },
          { status: 400 }
        );
      }

      const { gradingResult, consensusReport } = await gradeWithThreeModelsAndConsensus(
        submission,
        rubric,
        effectiveSettings,
        availableKeys,
        backupKeys
      );

      return NextResponse.json({
        success: true,
        gradingResult,
        consensusReport,
        ocrComparison: gradingResult.ocrComparison || submission.ocrComparison,
        extractedText: submission.extractedText,
        mode: 'triple_consensus',
      });
    }

    // Mode 2 & 3: Single model provider (có thể cấu hình Chấm 1 lần hoặc Chấm 3 lần Triple-Pass)
    const provider = effectiveSettings?.provider || (gradingMode === 'claude_triple_pass' ? 'claude' : 'openrouter');
    let apiKey = '';
    let backupApiKey: string | undefined = undefined;

    if (provider === 'alibabacloud') {
      apiKey = alibabaKey;
      backupApiKey = backupKeys.alibabacloud;
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình Alibaba Cloud Model Studio API Key. Vui lòng bấm vào Cài Đặt (chọn tab Alibaba Cloud) để nhập API Key, hoặc khai báo ALIBABACLOUD_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }
    } else if (provider === 'openrouter') {
      apiKey = openrouterKey;
      backupApiKey = backupKeys.openrouter;
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình OpenRouter API Key. Vui lòng bấm vào Cài Đặt (chọn tab OpenRouter) để nhập API Key, hoặc khai báo OPENROUTER_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }
    } else if (provider === 'claude') {
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

    // Kiểm tra số lượt chấm cấu hình cho model này: 1 lần (dùng một lần) hay 3 lần (chấm 3 lần)
    const passes =
      effectiveSettings?.gradingPasses ??
      effectiveSettings?.modelPasses?.[provider] ??
      (gradingMode === 'single' ? 1 : 3);

    if (passes === 3) {
      console.log(`[API /grade] Chạy chế độ Chấm 3 Lần (Triple-Pass) với model: ${provider}`);
      const { gradingResult, consensusReport } = await gradeWithProviderTriplePass(
        provider,
        submission,
        rubric,
        effectiveSettings,
        apiKey,
        backupApiKey
      );

      return NextResponse.json({
        success: true,
        gradingResult,
        consensusReport,
        ocrComparison: gradingResult.ocrComparison || submission.ocrComparison,
        extractedText: submission.extractedText,
        mode: `${provider}_triple_pass`,
        modelUsed: consensusReport?.modelsUsed?.[0] || provider,
      });
    }

    // Dùng 1 lần (Single-pass nhanh)
    console.log(`[API /grade] Chạy chế độ Chấm 1 Lần Nhanh với model: ${provider}`);
    const { gradingResult, modelUsed } = await gradeWithProvider(
      submission,
      rubric,
      effectiveSettings,
      apiKey,
      backupApiKey
    );

    return NextResponse.json({
      success: true,
      gradingResult,
      ocrComparison: gradingResult.ocrComparison || submission.ocrComparison,
      extractedText: submission.extractedText,
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

