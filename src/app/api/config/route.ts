import { NextResponse } from 'next/server';
import {
  SUPPORTED_CLAUDE_MODELS,
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_OPENAI_MODELS,
  SUPPORTED_OPENROUTER_MODELS,
  SUPPORTED_ALIBABACLOUD_MODELS,
  parseModelEnvList,
  filterModels,
} from '@/utils/modelConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Global visibility filters
    const globalVisible = parseModelEnvList(process.env.VISIBLE_MODELS || process.env.NEXT_PUBLIC_VISIBLE_MODELS);
    const globalHidden = parseModelEnvList(process.env.HIDDEN_MODELS || process.env.NEXT_PUBLIC_HIDDEN_MODELS);

    // 2. Claude visibility
    const claudeVisible = parseModelEnvList(
      process.env.CLAUDE_VISIBLE_MODELS || process.env.NEXT_PUBLIC_CLAUDE_VISIBLE_MODELS
    ) || globalVisible;
    const claudeHidden = [
      ...(parseModelEnvList(process.env.CLAUDE_HIDDEN_MODELS || process.env.NEXT_PUBLIC_CLAUDE_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const claudeModels = filterModels(SUPPORTED_CLAUDE_MODELS, claudeVisible, claudeHidden);

    // 3. Gemini visibility
    const geminiVisible = parseModelEnvList(
      process.env.GEMINI_VISIBLE_MODELS || process.env.NEXT_PUBLIC_GEMINI_VISIBLE_MODELS
    ) || globalVisible;
    const geminiHidden = [
      ...(parseModelEnvList(process.env.GEMINI_HIDDEN_MODELS || process.env.NEXT_PUBLIC_GEMINI_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const geminiModels = filterModels(SUPPORTED_GEMINI_MODELS, geminiVisible, geminiHidden);

    // 4. OpenAI visibility
    const openaiVisible = parseModelEnvList(
      process.env.OPENAI_VISIBLE_MODELS || process.env.NEXT_PUBLIC_OPENAI_VISIBLE_MODELS
    ) || globalVisible;
    const openaiHidden = [
      ...(parseModelEnvList(process.env.OPENAI_HIDDEN_MODELS || process.env.NEXT_PUBLIC_OPENAI_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const openaiModels = filterModels(SUPPORTED_OPENAI_MODELS, openaiVisible, openaiHidden);

    // 5. OpenRouter visibility
    const openrouterVisible = parseModelEnvList(
      process.env.OPENROUTER_VISIBLE_MODELS || process.env.NEXT_PUBLIC_OPENROUTER_VISIBLE_MODELS
    ) || globalVisible;
    const openrouterHidden = [
      ...(parseModelEnvList(process.env.OPENROUTER_HIDDEN_MODELS || process.env.NEXT_PUBLIC_OPENROUTER_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const openrouterModels = filterModels(SUPPORTED_OPENROUTER_MODELS, openrouterVisible, openrouterHidden);

    // 6. Alibaba Cloud visibility
    const alibabaVisible = parseModelEnvList(
      process.env.ALIBABACLOUD_VISIBLE_MODELS || process.env.NEXT_PUBLIC_ALIBABACLOUD_VISIBLE_MODELS
    ) || globalVisible;
    const alibabaHidden = [
      ...(parseModelEnvList(process.env.ALIBABACLOUD_HIDDEN_MODELS || process.env.NEXT_PUBLIC_ALIBABACLOUD_HIDDEN_MODELS) || []),
      ...(globalHidden || []),
    ];
    const alibabaModels = filterModels(SUPPORTED_ALIBABACLOUD_MODELS, alibabaVisible, alibabaHidden);

    return NextResponse.json({
      success: true,
      claude: {
        models: claudeModels,
        defaultModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        baseUrl: process.env.CLAUDE_BASE_URL || 'https://apikey.pimath.id.vn/v1',
        hasServerKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
      },
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
        defaultModel: process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free',
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        hasServerKey: Boolean(process.env.OPENROUTER_API_KEY),
      },
      alibabacloud: {
        models: alibabaModels,
        defaultModel: process.env.ALIBABACLOUD_MODEL || 'qwen-plus-character',
        baseUrl:
          process.env.ALIBABACLOUD_BASE_URL ||
          'https://ws-oxwvfx79avt7ebq3.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
        hasServerKey: Boolean(process.env.ALIBABACLOUD_API_KEY),
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
