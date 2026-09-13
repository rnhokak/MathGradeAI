'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle,
  AlertTriangle,
  FileDown,
  Copy,
  Printer,
  Edit3,
  FileText,
  ArrowLeft,
  Sparkles,
  Save,
  MessageSquare,
  TrendingUp,
  Layers,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  FileCode,
  GitCompare,
  Cpu,
  Bot,
} from 'lucide-react';
import { StudentSubmission, GradingResult, TeacherSettings, RubricData } from '@/types/grading';
import { ImageViewer } from './ImageViewer';
import { MathRenderer } from './MathRenderer';

interface GradingStudioProps {
  submission: StudentSubmission;
  rubric: RubricData;
  settings: TeacherSettings;
  onBackToList: () => void;
  onUpdateResult: (updatedResult: GradingResult) => void;
}

export const GradingStudio: React.FC<GradingStudioProps> = ({
  submission,
  rubric,
  settings,
  onBackToList,
  onUpdateResult,
}) => {
  const initialResult = submission.gradingResult;
  const [result, setResult] = useState<GradingResult | null>(initialResult || null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [isEditingGeneralComment, setIsEditingGeneralComment] = useState(false);
  const [showConsensusDetails, setShowConsensusDetails] = useState(true);

  // OCR & Math formula transcription state
  const ocrReport = result?.ocrComparison || submission.ocrComparison;
  const [leftTab, setLeftTab] = useState<'image' | 'transcription' | 'ocr_comparison'>(
    submission.images && submission.images.length > 0 ? 'image' : 'transcription'
  );
  const [customExtractedText, setCustomExtractedText] = useState(
    submission.extractedText || ocrReport?.consensusText || ''
  );
  const [isEditingText, setIsEditingText] = useState(false);
  const [isReGrading, setIsReGrading] = useState(false);
  const [isReRunningOcr, setIsReRunningOcr] = useState(false);
  const [selectedOcrModelTab, setSelectedOcrModelTab] = useState<'consensus' | 'gemini' | 'claude' | 'openai'>('consensus');

  if (!result) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <p>Bài làm chưa có kết quả chấm.</p>
        <button onClick={onBackToList} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </button>
      </div>
    );
  }

  // Trigger celebration confetti
  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  // Re-grade submission using custom or edited extracted text
  const handleRegradeWithText = async (textToUse: string) => {
    setIsReGrading(true);
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.geminiApiKey ? { 'x-gemini-api-key': settings.geminiApiKey } : {}),
          ...(settings.claudeApiKey ? { 'x-claude-api-key': settings.claudeApiKey } : {}),
          ...(settings.openaiApiKey ? { 'x-openai-api-key': settings.openaiApiKey } : {}),
        },
        body: JSON.stringify({
          submission: {
            ...submission,
            extractedText: textToUse,
          },
          rubric,
          settings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi chấm lại');
      setResult(data.gradingResult);
      onUpdateResult(data.gradingResult);
      setIsEditingText(false);
      triggerConfetti();
    } catch (err: any) {
      alert('Lỗi khi chấm lại: ' + err.message);
    } finally {
      setIsReGrading(false);
    }
  };

  // Run OCR with 3 models on demand
  const handleRerunOcr = async () => {
    setIsReRunningOcr(true);
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.geminiApiKey ? { 'x-gemini-api-key': settings.geminiApiKey } : {}),
          ...(settings.claudeApiKey ? { 'x-claude-api-key': settings.claudeApiKey } : {}),
          ...(settings.openaiApiKey ? { 'x-openai-api-key': settings.openaiApiKey } : {}),
        },
        body: JSON.stringify({
          submission,
          settings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi nhận diện công thức');
      setCustomExtractedText(data.consensusText);
      if (result) {
        const updated = {
          ...result,
          ocrComparison: data.ocrComparison,
        };
        setResult(updated);
        onUpdateResult(updated);
      }
      setLeftTab('ocr_comparison');
    } catch (err: any) {
      alert('Lỗi khi đọc công thức bằng 3 model: ' + err.message);
    } finally {
      setIsReRunningOcr(false);
    }
  };

  // Copy teacher feedback formatted for Zalo / SMS / Classroom
  const handleCopyFeedback = () => {
    const feedbackText = `--- KẾT QUẢ CHẤM BÀI MÔN TOÁN ---
Học sinh: ${result.studentName}
Điểm số: ${result.score}/${result.maxScore} điểm

1. NHẬN XÉT CHUNG:
${result.generalComment || 'Chưa có nhận xét chung.'}

2. CHI TIẾT BÀI LÀM:
${(result.criteriaBreakdown || []).map((c) => `• ${c.criterionName} (${c.awardedPoints}/${c.maxPoints}đ): ${c.reason}`).join('\n')}

3. ƯU ĐIỂM:
${(result.strengths || []).map((s) => `• ${s}`).join('\n')}

4. NHƯỢC ĐIỂM CẦN LƯU Ý:
${(result.weaknesses || []).map((w) => `• ${w}`).join('\n')}

5. HƯỚNG DẪN SỬA BÀI & RÚT KINH NGHIỆM:
${result.correctionGuide || 'Không có.'}

LỜI NHẬN XÉT CỦA GIÁO VIÊN:
"${result.teacherComment}"
`;

    navigator.clipboard.writeText(feedbackText);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  // Export to Word .docx
  const handleExportDocx = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradingResult: result,
          teacherRole: settings.role,
          teacherName: settings.teacherName,
        }),
      });

      if (!res.ok) throw new Error('Lỗi xuất file docx');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_Cham_${result.studentName.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Không thể xuất file docx. Vui lòng thử lại!');
    } finally {
      setIsExporting(false);
    }
  };

  // Update criterion awarded points
  const handleScoreChange = (index: number, newScore: number) => {
    if (!result) return;
    const updatedBreakdown = [...result.criteriaBreakdown];
    updatedBreakdown[index].awardedPoints = newScore;
    const totalScore = updatedBreakdown.reduce((sum, c) => sum + (c.awardedPoints || 0), 0);
    const updated: GradingResult = {
      ...result,
      score: Number(totalScore.toFixed(2)),
      criteriaBreakdown: updatedBreakdown,
      percentage: Math.round((totalScore / result.maxScore) * 100),
    };
    setResult(updated);
    onUpdateResult(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Actions */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={onBackToList} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={16} /> Danh sách bài
          </button>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Kết Quả Chấm: <span className="text-gradient">{result.studentName}</span>
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Bài thi: {submission.fileName}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleCopyFeedback} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            <Copy size={15} />
            {copiedToast ? 'Đã sao chép!' : 'Sao chép nhận xét'}
          </button>

          <button
            onClick={handleExportDocx}
            disabled={isExporting}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <FileDown size={15} />
            {isExporting ? 'Đang xuất Word...' : 'Xuất File Word (.docx)'}
          </button>

          <button
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
            title="In phiếu nhận xét"
          >
            <Printer size={15} /> In phiếu
          </button>
        </div>
      </div>

      {/* Split View: Left (Original Student Submission) | Right (Detailed Pedagogical Grading Sheet) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Student's original work & Math OCR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px' }}>
            {/* Header with Title and Mode Switcher */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Edit3 size={16} color="#06b6d4" />
                Bài Làm & Công Thức
              </h3>

              {/* Navigation Segment Tabs */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '3px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setLeftTab('image')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: leftTab === 'image' ? 'var(--accent-primary)' : 'transparent',
                    color: leftTab === 'image' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  <Eye size={13} />
                  Ảnh Viết Tay
                  {submission.images?.length > 0 && ` (${submission.images.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => setLeftTab('transcription')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: leftTab === 'transcription' ? 'var(--accent-primary)' : 'transparent',
                    color: leftTab === 'transcription' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  <FileCode size={13} />
                  Bản Đọc LaTeX
                </button>

                <button
                  type="button"
                  onClick={() => setLeftTab('ocr_comparison')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: leftTab === 'ocr_comparison' ? 'var(--accent-primary)' : 'transparent',
                    color: leftTab === 'ocr_comparison' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  <GitCompare size={13} />
                  Đối Chiếu 3 Model
                  {ocrReport && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#34d399',
                        display: 'inline-block',
                      }}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* TAB 1: Image Viewer */}
            {leftTab === 'image' && (
              <div>
                <ImageViewer images={submission.images} studentName={result.studentName} />

                {/* Quick OCR Bar below image */}
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="#818cf8" />
                    <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                      {ocrReport
                        ? `Đã nhận diện & đối chiếu 3 Model (${ocrReport.modelsUsed.join(', ')})`
                        : customExtractedText
                        ? 'Đã có văn bản trích xuất từ bài làm'
                        : 'Chưa có bản đọc công thức toán bằng 3 Model'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setLeftTab('transcription')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                    >
                      <FileCode size={13} /> Xem bản LaTeX &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={handleRerunOcr}
                      disabled={isReRunningOcr}
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                    >
                      <RefreshCw size={13} className={isReRunningOcr ? 'spin' : ''} />
                      {isReRunningOcr ? 'Đang OCR 3 Model...' : 'Đọc lại bằng 3 Model'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LaTeX Math Transcription & Inline Editor */}
            {leftTab === 'transcription' && (
              <div>
                {/* Header info & action buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: ocrReport ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        color: ocrReport ? '#34d399' : '#818cf8',
                        border: `1px solid ${ocrReport ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                      }}
                    >
                      {ocrReport ? '✓ Bản đọc đã qua đối chiếu 3 Model' : 'Văn bản bài làm'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isEditingText ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingText(true)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          <Edit3 size={13} /> Sửa văn bản
                        </button>
                        <button
                          type="button"
                          onClick={handleRerunOcr}
                          disabled={isReRunningOcr}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          <RefreshCw size={13} className={isReRunningOcr ? 'spin' : ''} />
                          {isReRunningOcr ? 'Đang đọc...' : 'Chạy lại OCR 3 Model'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomExtractedText(submission.extractedText || ocrReport?.consensusText || '');
                            setIsEditingText(false);
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegradeWithText(customExtractedText)}
                          disabled={isReGrading}
                          className="btn btn-primary"
                          style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                        >
                          <Save size={13} />
                          {isReGrading ? 'Đang chấm lại...' : 'Lưu & Chấm lại với bản này'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Content View / Edit */}
                {isEditingText ? (
                  <div>
                    <textarea
                      value={customExtractedText}
                      onChange={(e) => setCustomExtractedText(e.target.value)}
                      rows={14}
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid var(--border-glow)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-mono)',
                        lineHeight: '1.6',
                        resize: 'vertical',
                      }}
                      placeholder="Nhập hoặc chỉnh sửa văn bản và công thức LaTeX ($x > 0$, $$t^2 + t - 4 = 0$$)..."
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '8px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>💡 Dùng $công_thức$ cho công thức trong dòng, $$công_thức$$ cho công thức riêng một dòng.</span>
                      <button
                        type="button"
                        onClick={() => handleRegradeWithText(customExtractedText)}
                        disabled={isReGrading}
                        className="btn btn-emerald"
                        style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                      >
                        {isReGrading ? 'Đang chấm lại...' : '⚡ Chấm lại ngay'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      padding: '16px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      maxHeight: '460px',
                      overflowY: 'auto',
                    }}
                  >
                    {customExtractedText ? (
                      <MathRenderer text={customExtractedText} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        <p>Chưa có bản phiên âm văn bản hoặc công thức toán.</p>
                        <button
                          type="button"
                          onClick={handleRerunOcr}
                          disabled={isReRunningOcr}
                          className="btn btn-primary"
                          style={{ marginTop: '12px', fontSize: '0.8rem' }}
                        >
                          <RefreshCw size={13} className={isReRunningOcr ? 'spin' : ''} />
                          Chạy nhận diện công thức bằng 3 Model ngay
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: 3-Model OCR Comparison Report */}
            {leftTab === 'ocr_comparison' && (
              <div>
                {ocrReport ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Summary banner */}
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background:
                          ocrReport.status === 'unanimous'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(99, 102, 241, 0.1)',
                        border: `1px solid ${
                          ocrReport.status === 'unanimous'
                            ? 'rgba(16, 185, 129, 0.25)'
                            : 'rgba(99, 102, 241, 0.25)'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: ocrReport.status === 'unanimous' ? '#34d399' : '#818cf8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {ocrReport.status === 'unanimous'
                            ? '✓ Đồng thuận tuyệt đối 3/3 Model'
                            : ocrReport.status === 'reconciled'
                            ? '⚖️ Đã hợp nhất dị biệt qua thẩm định hình ảnh'
                            : 'Đồng thuận đa số'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {ocrReport.arbitratedBy || 'AI Verification'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: '1.5' }}>
                        {ocrReport.comparisonSummary}
                      </p>

                      {ocrReport.discrepancies && ocrReport.discrepancies.length > 0 && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24' }}>
                            Các điểm sai lệch đã giải quyết:
                          </span>
                          <ul style={{ margin: '4px 0 0 16px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                            {ocrReport.discrepancies.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Model selector buttons */}
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedOcrModelTab('consensus')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: selectedOcrModelTab === 'consensus' ? 'var(--accent-emerald)' : 'rgba(15, 23, 42, 0.7)',
                          color: selectedOcrModelTab === 'consensus' ? '#ffffff' : 'var(--text-secondary)',
                        }}
                      >
                        ★ Bản Hợp Nhất (Consensus)
                      </button>

                      {ocrReport.results.map((r, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedOcrModelTab(r.provider as any)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: selectedOcrModelTab === r.provider ? 'var(--accent-primary)' : 'rgba(15, 23, 42, 0.7)',
                            color: selectedOcrModelTab === r.provider ? '#ffffff' : 'var(--text-secondary)',
                          }}
                        >
                          {r.provider === 'gemini'
                            ? `Gemini (${r.modelName})`
                            : r.provider === 'claude'
                            ? `Claude (${r.modelName})`
                            : `OpenAI (${r.modelName})`}
                        </button>
                      ))}
                    </div>

                    {/* Detailed text of selected model */}
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.85)',
                        padding: '14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        maxHeight: '380px',
                        overflowY: 'auto',
                      }}
                    >
                      {selectedOcrModelTab === 'consensus' ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', marginBottom: '8px' }}>
                            BẢN PHIÊN ÂM CUỐI CÙNG ĐƯỢC CHỐT ĐỂ CHẤM ĐIỂM THEO TIÊU CHÍ:
                          </div>
                          <MathRenderer text={ocrReport.consensusText} />
                        </div>
                      ) : (
                        <div>
                          {(() => {
                            const found = ocrReport.results.find((r) => r.provider === selectedOcrModelTab);
                            if (!found || !found.transcription) {
                              return (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  Model này không có kết quả OCR hoặc gặp sự cố: {found?.error || 'N/A'}
                                </p>
                              );
                            }
                            return (
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818cf8', marginBottom: '8px' }}>
                                  Bản đọc của {found.modelName}:
                                </div>
                                <MathRenderer text={found.transcription} />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    <Bot size={28} color="#818cf8" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '0.9rem', marginBottom: '6px' }}>
                      Chưa có báo cáo đối chiếu OCR 3 Model cho bài làm này.
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      Hệ thống sẽ chạy đồng thời Gemini, Claude và GPT-4o để so sánh từng công thức toán học.
                    </p>
                    <button
                      type="button"
                      onClick={handleRerunOcr}
                      disabled={isReRunningOcr}
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                    >
                      <RefreshCw size={14} className={isReRunningOcr ? 'spin' : ''} />
                      {isReRunningOcr ? 'Đang đọc bằng 3 Model...' : 'Chạy Đối Chiếu OCR 3 Model Ngay'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Pedagogical Grading Sheet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Score Banner */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              background:
                result.score >= 0.8
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.1))'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(99, 102, 241, 0.1))',
              borderColor: result.score >= 0.8 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                ĐIỂM TỔNG KẾT BÀI THI
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '2.4rem',
                    fontWeight: 800,
                    color: result.score >= 0.8 ? '#34d399' : '#fbbf24',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {result.score}
                </span>
                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                  / {result.maxScore} điểm
                </span>
              </div>
            </div>

            {result.score === result.maxScore && (
              <button
                onClick={triggerConfetti}
                className="btn btn-emerald"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                <Award size={15} /> Điểm Tuyệt Đối 🎉
              </button>
            )}
          </div>

          {/* BẢNG ĐỐI CHIẾU 3 MODEL AI (NẾU CÓ BÁO CÁO CONSENSUS) */}
          {result.consensusReport && (
            <div
              className="glass-panel"
              style={{
                padding: '18px 20px',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  cursor: 'pointer',
                }}
                onClick={() => setShowConsensusDetails(!showConsensusDetails)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="#818cf8" />
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#f8fafc' }}>
                    {result.consensusReport.evaluations.length >= 3
                      ? 'Bảng Đối Chiếu Điểm 3 Model AI (Gemini + Claude + GPT-4o)'
                      : result.consensusReport.evaluations.length === 2
                      ? 'Bảng Đối Chiếu Điểm 2 Model AI'
                      : `Bảng Điểm AI — Chỉ 1 Model Hoàn Thành (${result.consensusReport.evaluations[0]?.provider?.toUpperCase() || 'AI'})`}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {result.consensusReport.status === 'single_model' && (
                    <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                      <AlertTriangle size={12} /> Chỉ 1 Model hoàn thành (1/3)
                    </span>
                  )}
                  {result.consensusReport.status === 'unanimous' && (
                    <span className="badge badge-emerald" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                      <CheckCircle size={12} /> Đồng thuận tuyệt đối (3/3)
                    </span>
                  )}
                  {result.consensusReport.status === 'majority' && (
                    <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                      <Layers size={12} /> Đồng thuận {result.consensusReport.evaluations.length >= 3 ? 'đa số (2/3)' : '2 Model'}
                    </span>
                  )}
                  {result.consensusReport.status === 'resolved_after_retry' && (
                    <span className="badge badge-indigo" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                      <RefreshCw size={12} /> Đã chấm lại {result.consensusReport.regradeCount} lần
                    </span>
                  )}
                  {result.consensusReport.status === 'conflict' && (
                    <span className="badge badge-rose" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                      <AlertTriangle size={12} /> Lệch {result.consensusReport.scoreDifference}đ
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px', borderRadius: '50%' }}
                  >
                    {showConsensusDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Warning banner if any model failed due to quota/network */}
              {result.consensusReport.failedModels && result.consensusReport.failedModels.length > 0 && (
                <div
                  style={{
                    padding: '8px 12px',
                    marginBottom: '10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    color: '#fde68a',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Cảnh báo hạn mức:</strong> {result.consensusReport.failedModels.map((f) => `${f.provider}: ${f.reason}`).join(' | ')}.
                  </span>
                </div>
              )}

              {/* Summary note */}
              <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: showConsensusDetails ? '14px' : '0' }}>
                {result.consensusReport.summary}
              </p>

              {/* Comparison Table */}
              {showConsensusDetails && (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.8rem',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 600 }}>Tiêu chí thang điểm</th>
                        {result.consensusReport.evaluations.map((ev, idx) => {
                          const isFallback = ev.modelName.includes('Dự phòng');
                          const headerLabel = isFallback
                            ? 'GEMINI (Dự phòng cho OpenAI)'
                            : `${ev.provider.toUpperCase()} (${ev.modelName.split('-').slice(0, 2).join('-')})`;
                          return (
                            <th
                              key={idx}
                              style={{
                                padding: '8px 10px',
                                fontWeight: 600,
                                textAlign: 'center',
                                color: isFallback ? '#fbbf24' : undefined,
                              }}
                              title={
                                isFallback
                                  ? 'Đang dùng Gemini 3.7 Flash dự phòng do tài khoản OpenAI hết hạn mức tín dụng ($0 credits)'
                                  : undefined
                              }
                            >
                              {headerLabel}
                            </th>
                          );
                        })}
                        <th
                          style={{
                            padding: '8px 10px',
                            fontWeight: 700,
                            textAlign: 'center',
                            color: '#34d399',
                            background: 'rgba(52, 211, 153, 0.08)',
                          }}
                        >
                          Điểm Đồng Thuận
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubric.criteria.map((c) => {
                        const agreedPoints =
                          result.criteriaBreakdown?.find((item) => item.criterionId === c.id)
                            ?.awardedPoints ?? 0;

                        return (
                          <tr
                            key={c.id}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            }}
                          >
                            <td style={{ padding: '8px 10px', color: '#f1f5f9' }}>
                              <span style={{ fontWeight: 600 }}>{c.name}</span>{' '}
                              <span style={{ color: 'var(--text-muted)' }}>({c.points}đ)</span>
                            </td>

                            {result.consensusReport?.evaluations.map((ev, evIdx) => {
                              const p = ev.awardedPointsByCriterion[c.id] ?? 0;
                              const isMatch = Math.abs(p - agreedPoints) <= 0.05;

                              return (
                                <td
                                  key={evIdx}
                                  style={{
                                    padding: '8px 10px',
                                    textAlign: 'center',
                                    fontWeight: isMatch ? 600 : 400,
                                    color: isMatch ? '#f8fafc' : '#fbbf24',
                                  }}
                                >
                                  {p}đ
                                </td>
                              );
                            })}

                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'center',
                                fontWeight: 700,
                                color: '#34d399',
                                background: 'rgba(52, 211, 153, 0.08)',
                              }}
                            >
                              {agreedPoints}đ
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total row */}
                      <tr style={{ borderTop: '2px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0,0,0,0.2)' }}>
                        <td style={{ padding: '10px', fontWeight: 700, color: '#f8fafc' }}>
                          TỔNG ĐIỂM
                        </td>
                        {result.consensusReport.evaluations.map((ev, idx) => (
                          <td
                            key={idx}
                            style={{
                              padding: '10px',
                              textAlign: 'center',
                              fontWeight: 700,
                              color: '#cbd5e1',
                            }}
                          >
                            {ev.score}đ
                          </td>
                        ))}
                        <td
                          style={{
                            padding: '10px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            color: '#34d399',
                            background: 'rgba(52, 211, 153, 0.15)',
                          }}
                        >
                          {result.score}đ
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 1. NHẬN XÉT CHUNG */}
          <div
            className="glass-panel"
            style={{
              padding: '18px 20px',
              borderLeft: '4px solid #38bdf8',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <FileText size={16} />
                1. Nhận Xét Chung (Tối đa 3 gạch đầu dòng)
              </h3>
              <button
                onClick={() => setIsEditingGeneralComment(!isEditingGeneralComment)}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                {isEditingGeneralComment ? 'Xong' : 'Chỉnh sửa'}
              </button>
            </div>

            {isEditingGeneralComment ? (
              <textarea
                className="textarea-field"
                rows={3}
                value={result.generalComment || ''}
                onChange={(e) => {
                  const updated = { ...result, generalComment: e.target.value };
                  setResult(updated);
                  onUpdateResult(updated);
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: '0.88rem',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  whiteSpace: 'pre-line',
                }}
              >
                {result.generalComment || '• Học sinh đã nộp bài làm.'}
              </div>
            )}
          </div>

          {/* 2. CHI TIẾT BÀI LÀM THEO RUBRIC */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc' }}>
              <TrendingUp size={16} color="#34d399" />
              2. Chi Tiết Bài Làm Theo Thang Điểm Rubric
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.criteriaBreakdown.map((crit, idx) => (
                <div
                  key={crit.criterionId || idx}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                      {crit.criterionName}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max={crit.maxPoints}
                        value={crit.awardedPoints}
                        onChange={(e) => handleScoreChange(idx, parseFloat(e.target.value) || 0)}
                        style={{
                          width: '56px',
                          padding: '3px 6px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          color: '#34d399',
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        / {crit.maxPoints}đ
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    {crit.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 3. TỔNG HỢP ƯU ĐIỂM & NHƯỢC ĐIỂM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* ƯU ĐIỂM */}
            <div
              className="glass-panel"
              style={{
                padding: '18px',
                borderTop: '3px solid #10b981',
              }}
            >
              <h4
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: '#34d399',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle size={15} /> 3. ƯU ĐIỂM
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {(result.strengths || []).map((s, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* NHƯỢC ĐIỂM */}
            <div
              className="glass-panel"
              style={{
                padding: '18px',
                borderTop: '3px solid #f59e0b',
              }}
            >
              <h4
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: '#fbbf24',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={15} /> NHƯỢC ĐIỂM & LƯU Ý
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {(result.weaknesses || []).map((w, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4. HƯỚNG DẪN SỬA BÀI & RÚT KINH NGHIỆM */}
          <div
            className="glass-panel"
            style={{
              padding: '18px',
              borderLeft: '4px solid #818cf8',
            }}
          >
            <h4
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#818cf8',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={15} /> 4. HƯỚNG DẪN SỬA BÀI & RÚT KINH NGHIỆM
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
              {result.correctionGuide || 'Không có yêu cầu chỉnh sửa đặc biệt.'}
            </p>
          </div>

          {/* 5. LỜI NHẬN XÉT CỦA GIÁO VIÊN */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              borderLeft: '4px solid #6366f1',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#a5b4fc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <MessageSquare size={16} />
                5. Lời Nhận Xét Của {settings.role === 'cô' ? 'Cô' : 'Thầy'}
              </h3>
              <button
                onClick={() => setIsEditingComment(!isEditingComment)}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                {isEditingComment ? 'Xong' : 'Chỉnh sửa'}
              </button>
            </div>

            {isEditingComment ? (
              <textarea
                className="textarea-field"
                rows={4}
                value={result.teacherComment}
                onChange={(e) => {
                  const updated = { ...result, teacherComment: e.target.value };
                  setResult(updated);
                  onUpdateResult(updated);
                }}
              />
            ) : (
              <p
                style={{
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  fontStyle: 'italic',
                  color: '#e2e8f0',
                }}
              >
                "{result.teacherComment}"
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
