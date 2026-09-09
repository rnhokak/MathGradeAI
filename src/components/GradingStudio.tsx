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
  BookOpen,
  ArrowLeft,
  Sparkles,
  Save,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import { StudentSubmission, GradingResult, TeacherSettings, RubricData } from '@/types/grading';
import { ImageViewer } from './ImageViewer';

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

  // Copy teacher feedback formatted for Zalo / SMS / Classroom
  const handleCopyFeedback = () => {
    const feedbackText = `--- KẾT QUẢ CHẤM BÀI MÔN TOÁN ---
Học sinh: ${result.studentName}
Điểm số: ${result.score}/${result.maxScore} điểm

1. ƯU ĐIỂM:
${(result.strengths || []).map((s) => `• ${s}`).join('\n')}

2. NHƯỢC ĐIỂM CẦN LƯU Ý:
${(result.weaknesses || []).map((w) => `• ${w}`).join('\n')}

3. HƯỚNG DẪN SỬA BÀI & RÚT KINH NGHIỆM:
${result.correctionGuide}

4. KIẾN THỨC CẦN ÔN TẬP LẠI:
${(result.knowledgeToReview || []).map((k) => `✔ ${k}`).join('\n')}

5. LỜI NHẬN XÉT CỦA GIÁO VIÊN:
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
        {/* LEFT COLUMN: Student's original work */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                marginBottom: '12px',
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Edit3 size={16} color="#06b6d4" />
              Bài Làm Của Học Sinh
            </h3>
            <ImageViewer images={submission.images} studentName={result.studentName} />

            {submission.extractedText && (
              <div style={{ marginTop: '14px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Văn bản trích xuất:
                </span>
                <pre
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    marginTop: '6px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {submission.extractedText}
                </pre>
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

          {/* Teacher Authentic Remarks */}
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
                Lời Nhận Xét Của {settings.role === 'cô' ? 'Cô' : 'Thầy'}
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

          {/* Criteria Breakdown Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="#34d399" />
              Chi Tiết Từng Bước Theo Thang Điểm Rubric
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

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {crit.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths & Weaknesses Grid */}
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
                <CheckCircle size={15} /> ƯU ĐIỂM
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

          {/* Step By Step Analysis */}
          {result.stepByStepAnalysis && (
            <div className="glass-panel" style={{ padding: '18px' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                ĐÁNH GIÁ TIẾN TRÌNH LÀM BÀI CỦA HỌC SINH
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {result.stepByStepAnalysis}
              </p>
            </div>
          )}

          {/* Correction Guide */}
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
              <Sparkles size={15} /> HƯỚNG DẪN SỬA BÀI & RÚT KINH NGHIỆM
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.5' }}>
              {result.correctionGuide}
            </p>
          </div>

          {/* Knowledge To Review */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <h4
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <BookOpen size={15} color="#c084fc" /> KIẾN THỨC CẦN ÔN TẬP LẠI
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(result.knowledgeToReview || []).map((item, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#c4b5fd',
                  }}
                >
                  ✔ {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
