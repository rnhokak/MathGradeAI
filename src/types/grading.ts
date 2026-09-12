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

  // Tương thích ngược nếu còn dữ liệu cũ
  stepByStepAnalysis?: string;
  knowledgeToReview?: string[];
}

export type SubmissionStatus = 'idle' | 'queued' | 'grading' | 'regrading' | 'done' | 'error';

export interface StudentSubmission {
  id: string;
  studentName: string;
  fileName: string;
  fileType: 'docx' | 'image' | 'pdf';
  fileSize: number;
  images: string[]; // base64 data URLs
  extractedText?: string;
  gradingResult?: GradingResult;
  status: SubmissionStatus;
  error?: string;
  queuePosition?: number;
  stepMessage?: string;
}

export type AIProvider = 'gemini' | 'claude' | 'openai';
export type GradingMode = 'single' | 'triple_consensus';

export interface TeacherSettings {
  role: 'thầy' | 'cô';
  teacherName: string;
  strictness: 'standard' | 'strict' | 'encouraging';
  provider: AIProvider;
  gradingMode?: GradingMode; // 'triple_consensus' (mặc định) hoặc 'single'
  
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

  // Tương thích ngược với cấu hình cũ
  model?: string;
}

