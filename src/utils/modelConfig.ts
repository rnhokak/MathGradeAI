import { AIProvider } from '@/types/grading';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
  badge?: string;
  provider: AIProvider;
}

/**
 * Các mô hình Claude được hỗ trợ theo tài liệu Anthropic Messages API (Host: apikey.pimath.id.vn)
 * Chỉ dùng các model Claude này (không phân biệt hoa thường). Model khác sẽ trả về 400 invalid_request_error.
 */
export const SUPPORTED_CLAUDE_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Sonnet cân bằng - Chuẩn xác, chi tiết & nhận diện chữ viết tay tốt nhất',
    recommended: true,
    badge: 'Khuyên dùng',
    provider: 'claude',
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    description: 'Opus mạnh nhất - Lập luận & Suy luận toán học chuyên sâu đỉnh cao',
    badge: 'Mạnh nhất',
    provider: 'claude',
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    description: 'Opus - Khả năng đối chiếu & lập luận toán học chuyên sâu cực cao',
    badge: 'Hiệu năng cao',
    provider: 'claude',
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: 'Opus - Suy luận toán học mạnh mẽ, đối chiếu tiêu chí chặt chẽ',
    provider: 'claude',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Haiku nhanh / nhẹ - Tốc độ cao & Tiết kiệm chi phí',
    badge: 'Nhanh nhẹ',
    provider: 'claude',
  },
];

export const SUPPORTED_GEMINI_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Khuyên dùng - Đỉnh cao xử lý đa phương thức & chữ viết tay',
    recommended: true,
    badge: 'Khuyên dùng',
    provider: 'gemini',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Tốc độ phản hồi cực nhanh, chính xác cao',
    provider: 'gemini',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Bản ổn định thế hệ 3.5',
    provider: 'gemini',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Suy luận logic sâu sắc và chi tiết',
    provider: 'gemini',
  },
];

export const SUPPORTED_OPENAI_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Khuyên dùng - Đa phương thức xuất sắc đọc chữ viết tay',
    recommended: true,
    badge: 'Khuyên dùng',
    provider: 'openai',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Bản rút gọn - Tốc độ cực nhanh & chi phí tối ưu',
    provider: 'openai',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    description: 'Mô hình suy luận chuyên sâu thế hệ mới',
    provider: 'openai',
  },
  {
    id: 'o1',
    name: 'o1',
    description: 'Mô hình suy luận phức tạp hàng đầu',
    provider: 'openai',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'Bản chuẩn GPT-4 Turbo',
    provider: 'openai',
  },
];

export const SUPPORTED_OPENROUTER_MODELS: ModelOption[] = [
  {
    id: 'qwen/qwen3.8-flash',
    name: 'Qwen 3.8 Flash',
    description: 'Khuyên dùng - Siêu nhanh, hỗ trợ suy luận reasoning tokens chuyên sâu',
    recommended: true,
    badge: 'Mới nhất ⭐',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen3.8-27b:free',
    name: 'Qwen 3.8 27B (Free)',
    description: 'Miễn phí, Chain-of-Thought suy luận toán học xuất sắc',
    badge: 'Free',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen-2.5-vl-72b-instruct:free',
    name: 'Qwen 2.5 VL 72B (Free)',
    description: 'Đa phương thức đọc ảnh bài viết tay miễn phí',
    badge: 'Free Vision',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen-2.5-vl-72b-instruct',
    name: 'Qwen 2.5 VL 72B Paid',
    description: 'Thị giác siêu mạnh, tốc độ cao không giới hạn',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct',
    description: 'Mô hình ngôn ngữ lớn chuyên lập luận toán học',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwq-32b-preview',
    name: 'QwQ 32B Preview',
    description: 'Mô hình lý luận toán học đỉnh cao của Qwen',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    description: 'Tư duy logic cấu trúc chặt chẽ',
    provider: 'openrouter',
  },
];

export const SUPPORTED_ALIBABACLOUD_MODELS: ModelOption[] = [
  {
    id: 'qwen-plus-character',
    name: 'Qwen Plus Character',
    description: 'Khuyên dùng - Chuẩn mực sư phạm & đọc công thức toán',
    recommended: true,
    badge: 'Khuyên dùng',
    provider: 'alibabacloud',
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    description: 'Mô hình lớn nhất, lý luận sâu sắc nhất',
    provider: 'alibabacloud',
  },
  {
    id: 'qwen-vl-max',
    name: 'Qwen VL Max',
    description: 'Thị giác đa phương thức đọc ảnh viết tay',
    provider: 'alibabacloud',
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    description: 'Cân bằng tốc độ và độ chính xác',
    provider: 'alibabacloud',
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    description: 'Tốc độ cực nhanh, tiết kiệm chi phí',
    provider: 'alibabacloud',
  },
];

/**
 * Tách chuỗi danh sách model từ biến môi trường (phân tách bởi dấu phẩy)
 */
export function parseModelEnvList(envVal?: string | null): string[] | null {
  if (!envVal || typeof envVal !== 'string') return null;
  const list = envVal
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

/**
 * Lọc danh sách model theo cấu hình ẩn / hiện từ env
 * - visibleList: nếu được khai báo và không rỗng, CHỈ giữ lại các model trong danh sách này
 * - hiddenList: nếu được khai báo, loại bỏ các model nằm trong danh sách này
 */
export function filterModels(
  allModels: ModelOption[],
  visibleList?: string[] | null,
  hiddenList?: string[] | null
): ModelOption[] {
  let models = [...allModels];

  if (visibleList && visibleList.length > 0) {
    const visibleSet = new Set(visibleList.map((m) => m.trim().toLowerCase()));
    models = models.filter((m) => visibleSet.has(m.id.toLowerCase()));
  }

  if (hiddenList && hiddenList.length > 0) {
    const hiddenSet = new Set(hiddenList.map((m) => m.trim().toLowerCase()));
    models = models.filter((m) => !hiddenSet.has(m.id.toLowerCase()));
  }

  // Fallback an toàn: nếu vô tình lọc hết thì trả về danh sách gốc
  return models.length > 0 ? models : allModels;
}
