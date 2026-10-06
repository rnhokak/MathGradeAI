import { NextRequest, NextResponse } from 'next/server';
import { StudentSubmission, TeacherSettings } from '@/types/grading';
import { transcribeWithThreeModelsAndConsensus } from '@/utils/aiGrading';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      submission,
      settings,
      ocrPasses,
    }: {
      submission: StudentSubmission;
      settings: TeacherSettings;
      ocrPasses?: 1 | 3;
    } = body;

    if (!submission) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bài làm cần nhận diện công thức.' },
        { status: 400 }
      );
    }

    const effectiveSettings: TeacherSettings = {
      ...(settings || {}),
    };

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

    const provider = effectiveSettings.provider || 'openrouter';

    if (provider === 'openrouter') {
      if (!openrouterKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình OpenRouter API Key. Vui lòng bấm vào Cài Đặt (chọn tab OpenRouter) để nhập API Key, hoặc khai báo OPENROUTER_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }

      const availableKeys = {
        openrouter: openrouterKey,
      };
      const backupKeys = {
        openrouter: envOpenrouter && envOpenrouter !== clientOpenrouter ? envOpenrouter : undefined,
      };

      const effectivePasses: 1 | 3 = ocrPasses ?? settings?.ocrPasses ?? 3;

      const { ocrComparison, consensusText } = await transcribeWithThreeModelsAndConsensus(
        submission,
        effectiveSettings,
        availableKeys,
        backupKeys,
        effectivePasses
      );

      return NextResponse.json({
        success: true,
        ocrComparison,
        consensusText,
      });
    }

    if (provider === 'alibabacloud') {
      if (!alibabaKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình Alibaba Cloud API Key. Vui lòng bấm vào Cài Đặt để nhập API Key, hoặc khai báo ALIBABACLOUD_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }

      const availableKeys = {
        alibabacloud: alibabaKey,
      };
      const backupKeys = {
        alibabacloud: envAlibaba && envAlibaba !== clientAlibaba ? envAlibaba : undefined,
      };

      const effectivePasses: 1 | 3 = ocrPasses ?? settings?.ocrPasses ?? 3;

      const { ocrComparison, consensusText } = await transcribeWithThreeModelsAndConsensus(
        submission,
        effectiveSettings,
        availableKeys,
        backupKeys,
        effectivePasses
      );

      return NextResponse.json({
        success: true,
        ocrComparison,
        consensusText,
      });
    }

    if (provider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json(
          {
            error:
              'Chưa cấu hình OpenAI API Key. Vui lòng bấm vào Cài Đặt để nhập API Key, hoặc khai báo OPENAI_API_KEY trong file .env.local.',
          },
          { status: 400 }
        );
      }

      const availableKeys = {
        openai: openaiKey,
      };
      const backupKeys = {
        openai: envOpenai && envOpenai !== clientOpenai ? envOpenai : undefined,
      };

      const effectivePasses: 1 | 3 = ocrPasses ?? settings?.ocrPasses ?? 3;

      const { ocrComparison, consensusText } = await transcribeWithThreeModelsAndConsensus(
        submission,
        effectiveSettings,
        availableKeys,
        backupKeys,
        effectivePasses
      );

      return NextResponse.json({
        success: true,
        ocrComparison,
        consensusText,
      });
    }

    // Provider: gemini
    if (!geminiKey) {
      return NextResponse.json(
        {
          error:
            'Chưa cấu hình Google Gemini API Key. Vui lòng bấm vào Cài Đặt để nhập API Key, hoặc khai báo GEMINI_API_KEY trong file .env.local.',
        },
        { status: 400 }
      );
    }

    const availableKeys = {
      gemini: geminiKey,
    };
    const backupKeys = {
      gemini: envGemini && envGemini !== clientGemini ? envGemini : undefined,
    };

    const effectivePasses: 1 | 3 = ocrPasses ?? settings?.ocrPasses ?? 3;

    const { ocrComparison, consensusText } = await transcribeWithThreeModelsAndConsensus(
      submission,
      effectiveSettings,
      availableKeys,
      backupKeys,
      effectivePasses
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
