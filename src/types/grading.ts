export interface RubricCriterion {
  id: string;
  name: string;
  points: number;
  description: string;
}

export interface RubricData {
  title: string;
  problemStatement: string;
  totalPoints: number;
  criteria: RubricCriterion[];
  rawText?: string;
}

export interface CriterionResult {
  criterionId: string;
  criterionName: string;
  maxPoints: number;
  awardedPoints: number;
  isCorrect: 'full' | 'partial' | 'wrong';
  reason: string; // Lồng ghép tiến trình + ưu/nhược điểm + căn cứ cho/trừ điểm
}

export interface ModelEvaluation {
  provider: AIProvider;
  modelName: string;
  score: number;
  maxScore: number;
  awardedPointsByCriterion: Record<string, number>;
  reasonsByCriterion: Record<string, string>;
  isCorrectByCriterion: Record<string, 'full' | 'partial' | 'wrong'>;
  generalComment?: string;
  strengths?: string[];
  weaknesses?: string[];
  teacherComment?: string;
  reasoningText?: string;
  error?: string;
}

export interface ConsensusReport {
  roundCount: number;
  regradeCount: number;
  status: 'unanimous' | 'majority' | 'resolved_after_retry' | 'conflict' | 'single_model';
  modelsUsed: string[];
  scoreDifference: number;
  evaluations: ModelEvaluation[];
  summary: string;
  failedModels?: { provider: string; reason: string }[];
}

export interface GradingResult {
  studentName: string;
  submissionId: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'pending' | 'grading' | 'completed' | 'error';
  errorMessage?: string;
  gradedAt?: string;
  
  // Chi tiết nhận xét theo yêu cầu sư phạm:
  generalComment: string; // 1. Nhận xét chung ngắn gọn (tối đa 3 gạch đầu dòng): hướng làm, nhận diện dạng bài, trình bày
  criteriaBreakdown: CriterionResult[]; // 2. Chi tiết bài làm (lồng ghép tiến trình + ưu/nhược + cho/trừ điểm)
  strengths: string[]; // 3. Ưu điểm tổng hợp ngắn gọn
  weaknesses: string[]; // 3. Nhược điểm tổng hợp ngắn gọn
  correctionGuide: string; // 5. Hướng dẫn sửa bài và rút kinh nghiệm
  teacherComment: string; // Lời phê chân thật, ngắn gọn của Thầy/Cô
  
  // Báo cáo đối chiếu 3 Model (nếu dùng chế độ Triple-Model Consensus)
  consensusReport?: ConsensusReport;
  ocrComparison?: OcrComparisonReport;

  // Hỗ trợ lưu trữ suy luận (Reasoning Details) từ mô hình Qwen / OpenRouter
  reasoningDetails?: unknown;
  reasoningText?: string;

  // Tương thích ngược nếu còn dữ liệu cũ
  stepByStepAnalysis?: string;
  knowledgeToReview?: string[];
}

export interface OcrModelResult {
  provider: AIProvider;
  modelName: string;
  transcription: string;
  durationMs?: number;
  error?: string;
}

export interface OcrComparisonReport {
  status: 'unanimous' | 'majority' | 'reconciled' | 'single_model' | 'error';
  modelsUsed: string[];
  results: OcrModelResult[];
  consensusText: string;
  comparisonSummary: string;
  hasDiscrepancies: boolean;
  discrepancies?: string[];
  arbitratedBy?: string;
}

export type SubmissionStatus = 'idle' | 'queued' | 'ocr' | 'grading' | 'regrading' | 'done' | 'error';

export interface StudentSubmission {
  id: string;
  studentName: string;
  fileName: string;
  fileType: 'docx' | 'image' | 'pdf';
  fileSize: number;
  images: string[]; // base64 data URLs
  extractedText?: string;
  ocrComparison?: OcrComparisonReport;
  gradingResult?: GradingResult;
  status: SubmissionStatus;
  error?: string;
  queuePosition?: number;
  stepMessage?: string;
}

export type AIProvider = 'gemini' | 'claude' | 'openai' | 'openrouter' | 'alibabacloud';
export type GradingMode = 'single' | 'single_pass' | 'triple_consensus' | 'claude_triple_pass' | 'triple_pass';

export interface ModelPassSettings {
  gemini?: 1 | 3;
  claude?: 1 | 3;
  openai?: 1 | 3;
  openrouter?: 1 | 3;
  alibabacloud?: 1 | 3;
}

export interface TeacherSettings {
  role: 'thầy' | 'cô';
  teacherName: string;
  strictness: 'standard' | 'strict' | 'encouraging';
  provider: AIProvider;
  gradingMode?: GradingMode; // 'single' (theo model đã chọn), 'triple_consensus' (đa model) hoặc 'claude_triple_pass'
  _gradingModeExplicitlySet?: boolean;
  _gradingPassesExplicitlySet?: boolean;
  autoOcrBeforeGrading?: boolean; // Tương thích ngược: luôn true trong quy trình 2 bước

  // Cấu hình quy trình 2 bước (Bắt buộc tách Đọc OCR trước -> Chấm bài sau)
  ocrPasses?: 1 | 3; // Số lượt đọc OCR ảnh: 3 (Đọc 3 lần & Verify lại kết quả - Mặc định) | 1 (Đọc 1 lần nhanh)
  gradingPasses?: 1 | 3; // Số lượt chấm bài AI: 1 (Chấm 1 lần nhanh - Mặc định) | 3 (Chấm 3 lần Triple-Pass)
  
  // Cài đặt số lượt chấm riêng biệt cho mỗi model: 1 lần (dùng một lần) hoặc 3 lần (chấm 3 lần)
  modelPasses?: ModelPassSettings;
  
  // Cấu hình Hàng đợi & Đối chiếu
  queueDelayMs?: number; // Độ trễ giữa các bài trong hàng đợi (ms), mặc định 2000
  maxRegradeRetries?: number; // Số lần tự động chấm lại khi lệch điểm, mặc định 2
  consensusTolerance?: number; // Ngưỡng chênh lệch điểm tối đa chấp nhận được, mặc định 0.25
  
  // Google Gemini
  geminiApiKey: string;
  geminiModel: string;
  
  // Anthropic Claude
  claudeApiKey: string;
  claudeModel: string;
  claudeBaseUrl?: string;
  
  // OpenAI / OpenAPI-compatible
  openaiApiKey: string;
  openaiModel: string;
  openaiBaseUrl?: string;

  // OpenRouter (Qwen: qwen/qwen3.8-27b, qwen/qwen3-vl-235b-a22b-instruct, qwen/qwen3.8-flash,...)
  openrouterApiKey?: string;
  openrouterModel?: string;
  openrouterBaseUrl?: string;
  openrouterReasoning?: boolean;

  // Alibaba Cloud Model Studio (Qwen)
  alibabacloudApiKey?: string;
  alibabacloudModel?: string;
  alibabacloudBaseUrl?: string;

  // Tương thích ngược với cấu hình cũ
  model?: string;
}


