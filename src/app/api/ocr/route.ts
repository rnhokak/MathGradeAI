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
            'Chưa cấu hình API Key nào trong Cài Đặt hoặc .env.local (cần ít nhất API Key của OpenRouter, Gemini, OpenAI hoặc Alibaba Cloud để đọc ảnh).',
        },
        { status: 400 }
      );
    }

    const backupKeys = {
      gemini: envGemini && envGemini !== clientGemini ? envGemini : undefined,
      openai: envOpenai && envOpenai !== clientOpenai ? envOpenai : undefined,
      openrouter: envOpenrouter && envOpenrouter !== clientOpenrouter ? envOpenrouter : undefined,
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
