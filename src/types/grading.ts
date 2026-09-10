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
  reason: string; // Tại sao cộng điểm hoặc trừ điểm
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
  
  // Chi tiết theo yêu cầu của giáo viên:
  strengths: string[]; // Ưu điểm
  weaknesses: string[]; // Nhược điểm
  stepByStepAnalysis: string; // Phân tích học sinh đã làm được đến đâu, đúng ý nào, sai ý nào
  criteriaBreakdown: CriterionResult[]; // Chi tiết từng tiêu chí
  correctionGuide: string; // Chỉ ra cách sửa chi tiết cho học sinh tham khảo và rút kinh nghiệm
  knowledgeToReview: string[]; // Kiến thức học sinh cần ôn lại để làm tốt dạng bài này
  teacherComment: string; // Lời phê chân thật của Thầy/Cô (thầy và em hoặc cô và em)
}

export interface StudentSubmission {
  id: string;
  studentName: string;
  fileName: string;
  fileType: 'docx' | 'image' | 'pdf';
  fileSize: number;
  images: string[]; // base64 data URLs
  extractedText?: string;
  gradingResult?: GradingResult;
  status: 'idle' | 'grading' | 'done' | 'error';
  error?: string;
}

export type AIProvider = 'gemini' | 'claude' | 'openai';

export interface TeacherSettings {
  role: 'thầy' | 'cô';
  teacherName: string;
  strictness: 'standard' | 'strict' | 'encouraging';
  provider: AIProvider;
  
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

