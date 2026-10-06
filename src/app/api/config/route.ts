import { NextResponse } from 'next/server';
import {
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_OPENAI_MODELS,
  SUPPORTED_OPENROUTER_MODELS,
  parseModelEnvList,
  filterModels,
} from '@/utils/modelConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Global visibility filters
    const globalVisible = parseModelEnvList(process.env.VISIBLE_MODELS || process.env.NEXT_PUBLIC_VISIBLE_MODELS);
    const globalHidden = parseModelEnvList(process.env.HIDDEN_MODELS || process.env.NEXT_PUBLIC_HIDDEN_MODELS);

    // 2. Gemini visibility
    const geminiVisible = parseModelEnvList(
      process.env.GEMINI_VISIBLE_MODELS || process.env.NEXT_PUBLIC_GEMINI_VISIBLE_MODELS
    ) || globalVisible;
    const geminiHidden = [
      ...(parseModelEnvList(process.env.GEMINI_HIDDEN_MODELS || process.env.NEXT_PUBLIC_GEMINI_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const geminiModels = filterModels(SUPPORTED_GEMINI_MODELS, geminiVisible, geminiHidden);

    // 3. OpenAI visibility
    const openaiVisible = parseModelEnvList(
      process.env.OPENAI_VISIBLE_MODELS || process.env.NEXT_PUBLIC_OPENAI_VISIBLE_MODELS
    ) || globalVisible;
    const openaiHidden = [
      ...(parseModelEnvList(process.env.OPENAI_HIDDEN_MODELS || process.env.NEXT_PUBLIC_OPENAI_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const openaiModels = filterModels(SUPPORTED_OPENAI_MODELS, openaiVisible, openaiHidden);

    // 4. OpenRouter visibility
    const openrouterVisible = parseModelEnvList(
      process.env.OPENROUTER_VISIBLE_MODELS || process.env.NEXT_PUBLIC_OPENROUTER_VISIBLE_MODELS
    ) || globalVisible;
    const openrouterHidden = [
      ...(parseModelEnvList(process.env.OPENROUTER_HIDDEN_MODELS || process.env.NEXT_PUBLIC_OPENROUTER_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const openrouterModels = filterModels(SUPPORTED_OPENROUTER_MODELS, openrouterVisible, openrouterHidden);

    return NextResponse.json({
      success: true,
      gemini: {
        models: geminiModels,
        defaultModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        hasServerKey: Boolean(process.env.GEMINI_API_KEY),
      },
      openai: {
        models: openaiModels,
        defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        hasServerKey: Boolean(process.env.OPENAI_API_KEY),
      },
      openrouter: {
        models: openrouterModels,
        defaultModel: process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b',
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        hasServerKey: Boolean(process.env.OPENROUTER_API_KEY),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi tải cấu hình mô hình',
      },
      { status: 500 }
    );
  }
}
