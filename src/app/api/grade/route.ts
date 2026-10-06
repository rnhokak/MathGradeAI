import { NextRequest, NextResponse } from 'next/server';
import { RubricData, StudentSubmission, TeacherSettings } from '@/types/grading';
import {
  gradeWithProvider,
  gradeWithThreeModelsAndConsensus,
  gradeWithProviderTriplePass,
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

    const effectiveSettings: TeacherSettings = {
      ...(settings || {}),
    };

    const gradingMode = effectiveSettings?.gradingMode || 'single_pass';

    // Retrieve API keys from server env
    const envGemini = (process.env.GEMINI_API_KEY || '').trim();
    const envOpenai = (process.env.OPENAI_API_KEY || '').trim();
    const envOpenrouter = (process.env.OPENROUTER_API_KEY || '').trim();
    const envAlibaba = (process.env.ALIBABACLOUD_API_KEY || '').trim();

    // Client provided keys
    const clientGemini = (req.headers.get('x-gemini-api-key') || settings?.geminiApiKey || '').trim();
    const clientOpenai = (req.headers.get('x-openai-api-key') || settings?.openaiApiKey || '').trim();
    const clientOpenrouter = (req.headers.get('x-openrouter-api-key') || settings?.openrouterApiKey || '').trim();
    const clientAlibaba = (req.headers.get('x-alibabacloud-api-key') || settings?.alibabacloudApiKey || '').trim();

    const geminiKey = clientGemini || envGemini;
    const openaiKey = clientOpenai || envOpenai;
    const openrouterKey = clientOpenrouter || envOpenrouter;
    const alibabaKey = clientAlibaba || envAlibaba;

    // Server environment backup keys (used if client keys are invalid/malformed)
    const backupKeys = {
      gemini: envGemini && envGemini !== clientGemini ? envGemini : undefined,
      openai: envOpenai && envOpenai !== clientOpenai ? envOpenai : undefined,
      openrouter: envOpenrouter && envOpenrouter !== clientOpenrouter ? envOpenrouter : undefined,
      alibabacloud: envAlibaba && envAlibaba !== clientAlibaba ? envAlibaba : undefined,
    };

    const provider = effectiveSettings?.provider || 'openrouter';

    // ĐẶC BIỆT: Khi chọn model là Qwen OpenRouter, CHỈ dùng model Qwen để chấm bài
    // cho cả trường hợp chấm 1 lần lẫn chấm 3 lần (Triple-Pass), không trộn bất kỳ model nào khác.
    if (provider === 'openrouter') {
      const apiKey = openrouterKey;
      const backupApiKey = backupKeys.openrouter;
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình OpenRouter API Key. Vui lòng bấm vào Cài Đặt (chọn tab OpenRouter) để nhập API Key, hoặc khai báo OPENROUTER_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }

      const passes =
        effectiveSettings?.gradingPasses ??
        effectiveSettings?.modelPasses?.openrouter ??
        (gradingMode === 'triple_consensus' ? 3 : 1);

      if (passes === 3) {
        console.log(`[API /grade] Chạy chế độ Chấm 3 Lần độc quyền bằng Qwen OpenRouter (Triple-Pass: Barem + Phản biện + Sư phạm)...`);
        const { gradingResult, consensusReport } = await gradeWithProviderTriplePass(
          'openrouter',
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
          mode: 'openrouter_triple_pass',
          modelUsed: consensusReport?.modelsUsed?.[0] || 'Qwen OpenRouter (Chấm 3 Lần)',
        });
      }

      // Chấm 1 lần nhanh bằng Qwen OpenRouter
      console.log(`[API /grade] Chạy chế độ Chấm 1 Lần Nhanh bằng Qwen OpenRouter (${effectiveSettings.openrouterModel || 'qwen/qwen3.8-27b'})`);
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
        mode: 'openrouter',
        modelUsed,
      });
    }

    // Mode 1: Triple-Model Consensus (Chỉ áp dụng khi không dùng OpenRouter đơn lẻ)
    if (gradingMode === 'triple_consensus') {
      const availableKeys = {
        gemini: geminiKey,
        openai: openaiKey,
        openrouter: openrouterKey,
        alibabacloud: alibabaKey,
      };

      const keyCount = Object.values(availableKeys).filter(Boolean).length;
      if (keyCount === 0) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình API Key nào trong Cài Đặt hoặc .env.local (cần ít nhất API Key của Gemini, OpenAI hoặc Alibaba Cloud để chấm đối chiếu).',
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

    // Mode 2 & 3: Các Single model provider khác (Alibaba Cloud, OpenAI, Gemini)
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

