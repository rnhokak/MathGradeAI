'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileCheck,
  Play,
  RotateCw,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  Image as ImageIcon,
} from 'lucide-react';
import { StudentSubmission, RubricData, TeacherSettings } from '@/types/grading';

interface SubmissionUploaderProps {
  submissions: StudentSubmission[];
  rubric: RubricData;
  settings: TeacherSettings;
  onUpdateSubmissions: (
    updater: StudentSubmission[] | ((prev: StudentSubmission[]) => StudentSubmission[])
  ) => void;
  onSelectSubmissionToView: (id: string) => void;
}

export const SubmissionUploader: React.FC<SubmissionUploaderProps> = ({
  submissions,
  rubric,
  settings,
  onUpdateSubmissions,
  onSelectSubmissionToView,
}) => {
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isBatchGrading, setIsBatchGrading] = useState(false);
  const [gradingIds, setGradingIds] = useState<Set<string>>(new Set());
  const gradingRef = useRef<Set<string>>(new Set());
  const submissionsRef = useRef<StudentSubmission[]>(submissions);

  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  // Auto clean Vietnamese name from filename
  const cleanStudentName = (fileName: string): string => {
    let name = fileName.replace(/\.[^/.]+$/, ''); // remove extension
    name = name.replace(/bài\s*\d+/i, '').replace(/bai\s*\d+/i, '');
    name = name.replace(/[-_]/g, ' ').trim();
    // Capitalize words
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Handle uploading files (multiple docx or images)
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    const newSubs: StudentSubmission[] = [...submissions];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isDocx = file.name.endsWith('.docx');
      const isImage = /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

      if (isDocx) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/parse-docx', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (res.ok) {
            newSubs.push({
              id: `sub-${Date.now()}-${i}`,
              studentName: cleanStudentName(file.name),
              fileName: file.name,
              fileType: 'docx',
              fileSize: file.size,
              images: (data.images || []).map((img: any) => img.dataUrl),
              extractedText: data.text || '',
              status: 'idle',
            });
          }
        } catch (err) {
          console.error('Error parsing docx file:', err);
        }
      } else if (isImage) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        newSubs.push({
          id: `sub-${Date.now()}-${i}`,
          studentName: cleanStudentName(file.name),
          fileName: file.name,
          fileType: 'image',
          fileSize: file.size,
          images: [dataUrl],
          status: 'idle',
        });
      }
    }

    onUpdateSubmissions((prev) => [...prev, ...newSubs]);
    setIsProcessingFiles(false);
  };

  // Grade a single submission
  const gradeSubmission = async (subId: string) => {
    // Prevent double clicking on the same submission if already in flight
    if (gradingRef.current.has(subId)) return;

    const sub = submissionsRef.current.find((s) => s.id === subId);
    if (!sub) return;

    // Track active grading in ref & state
    gradingRef.current.add(subId);
    setGradingIds(new Set(gradingRef.current));

    // Update status to grading using functional updater to avoid stale state race conditions
    onUpdateSubmissions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, status: 'grading' as const, error: undefined } : s))
    );

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
          submission: sub,
          rubric,
          settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi chấm bài');

      // Update state using functional updater - preserving parallel grading results
      onUpdateSubmissions((prev) =>
        prev.map((s) =>
          s.id === subId
            ? {
                ...s,
                status: 'done' as const,
                gradingResult: data.gradingResult,
                error: undefined,
              }
            : s
        )
      );
    } catch (err: any) {
      console.error(`Error grading submission ${subId}:`, err);
      onUpdateSubmissions((prev) =>
        prev.map((s) =>
          s.id === subId
            ? {
                ...s,
                status: 'error' as const,
                error: err.message || 'Lỗi không xác định',
              }
            : s
        )
      );
    } finally {
      gradingRef.current.delete(subId);
      setGradingIds(new Set(gradingRef.current));
    }
  };

  // Grade all idle or error submissions sequentially
  const gradeAll = async () => {
    if (isBatchGrading || gradingRef.current.size > 0) return;
    setIsBatchGrading(true);

    try {
      const toGrade = submissionsRef.current.filter((s) => s.status === 'idle' || s.status === 'error');
      for (const sub of toGrade) {
        await gradeSubmission(sub.id);
      }
    } finally {
      setIsBatchGrading(false);
    }
  };

  // Remove submission safely
  const removeSubmission = (id: string) => {
    if (gradingRef.current.has(id)) return;
    onUpdateSubmissions((prev) => prev.filter((s) => s.id !== id));
  };

  const completedCount = submissions.filter((s) => s.status === 'done').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Upload Banner */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={22} color="#06b6d4" />
              Nạp Danh Sách Bài Làm Của Học Sinh
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Hỗ trợ nạp cùng lúc nhiều file Word (.docx chứa ảnh bài thi viết tay) hoặc file ảnh (.png, .jpg) chụp bài làm.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <label
              className="btn btn-secondary"
              style={{
                cursor:
                  isProcessingFiles || isBatchGrading || gradingIds.size > 0
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  isProcessingFiles || isBatchGrading || gradingIds.size > 0 ? 0.6 : 1,
              }}
            >
              <UploadCloud size={16} />
              {isProcessingFiles ? 'Đang đọc files...' : 'Tải lên bài làm (Chọn nhiều)'}
              <input
                type="file"
                multiple
                accept=".docx,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFiles}
                style={{ display: 'none' }}
                disabled={isProcessingFiles || isBatchGrading || gradingIds.size > 0}
              />
            </label>

            {submissions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  className={`badge ${
                    settings.provider === 'claude'
                      ? 'badge-amber'
                      : settings.provider === 'openai'
                      ? 'badge-emerald'
                      : 'badge-indigo'
                  }`}
                  style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                >
                  AI:{' '}
                  {settings.provider === 'claude'
                    ? settings.claudeModel || 'Claude Sonnet 4.6'
                    : settings.provider === 'openai'
                    ? settings.openaiModel || 'GPT-4o'
                    : settings.geminiModel || settings.model || 'Gemini 3.8'}
                </span>
                <button
                  onClick={gradeAll}
                  disabled={
                    isBatchGrading ||
                    gradingIds.size > 0 ||
                    submissions.filter((s) => s.status === 'idle' || s.status === 'error').length === 0
                  }
                  className="btn btn-emerald"
                  style={{
                    minWidth: '150px',
                    opacity:
                      isBatchGrading ||
                      gradingIds.size > 0 ||
                      submissions.filter((s) => s.status === 'idle' || s.status === 'error').length === 0
                        ? 0.6
                        : 1,
                    cursor:
                      isBatchGrading ||
                      gradingIds.size > 0 ||
                      submissions.filter((s) => s.status === 'idle' || s.status === 'error').length === 0
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {isBatchGrading ? (
                    <>
                      <RotateCw size={15} className="animate-spin" /> Đang chấm tất cả...
                    </>
                  ) : (
                    <>
                      <Play size={15} /> Chấm tất cả bài (
                      {submissions.filter((s) => s.status === 'idle' || s.status === 'error').length})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={18} color="#34d399" />
            Danh Sách Bài Làm ({submissions.length} bài - Đã chấm: {completedCount}/{submissions.length})
          </h3>
        </div>

        {submissions.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              border: '2px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
            }}
          >
            <UploadCloud size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontSize: '0.95rem', marginBottom: '8px' }}>
              Chưa có bài làm nào được nạp vào hệ thống.
            </p>
            <p style={{ fontSize: '0.82rem' }}>
              Bấm nút <strong>"Nạp bài mẫu (Nga & Trang)"</strong> trên thanh tiêu đề để thử nghiệm ngay lập tức!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submissions.map((sub, idx) => {
              const hasImages = sub.images && sub.images.length > 0;
              const isGraded = sub.status === 'done';

              return (
                <div
                  key={sub.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Left: Thumbnail & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
                    {/* Thumbnail preview */}
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {hasImages ? (
                        <img
                          src={sub.images[0]}
                          alt={sub.studentName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <FileCode size={20} color="#94a3b8" />
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                          {sub.studentName}
                        </span>
                        <span
                          className="badge badge-indigo"
                          style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                        >
                          {sub.fileType.toUpperCase()}
                        </span>
                        {hasImages && (
                          <span
                            className="badge badge-emerald"
                            style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                          >
                            <ImageIcon size={10} /> {sub.images.length} ảnh
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {sub.fileName} ({(sub.fileSize / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  </div>

                  {/* Middle: Status & Score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {sub.status === 'idle' && (
                      <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}>
                        <Clock size={12} /> Chờ chấm
                      </span>
                    )}
                    {sub.status === 'grading' && (
                      <span className="badge badge-amber">
                        <RotateCw size={12} className="animate-spin" /> Đang chấm AI...
                      </span>
                    )}
                    {sub.status === 'done' && sub.gradingResult && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-emerald">
                          <CheckCircle2 size={12} /> Đã chấm xong
                        </span>
                        <strong
                          style={{
                            fontSize: '1.05rem',
                            color: sub.gradingResult.score >= 0.8 ? '#34d399' : '#fbbf24',
                          }}
                        >
                          {sub.gradingResult.score} / {sub.gradingResult.maxScore}đ
                        </strong>
                      </div>
                    )}
                    {sub.status === 'error' && (
                      <span className="badge badge-rose">
                        <AlertCircle size={12} /> Lỗi
                      </span>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isGraded ? (
                      <button
                        onClick={() => onSelectSubmissionToView(sub.id)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        <Eye size={14} /> Xem & Sửa kết quả
                      </button>
                    ) : (
                      <button
                        onClick={() => gradeSubmission(sub.id)}
                        disabled={sub.status === 'grading' || gradingIds.has(sub.id) || isBatchGrading}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          opacity:
                            sub.status === 'grading' || gradingIds.has(sub.id) || isBatchGrading ? 0.6 : 1,
                          cursor:
                            sub.status === 'grading' || gradingIds.has(sub.id) || isBatchGrading
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {sub.status === 'grading' || gradingIds.has(sub.id) ? (
                          <>
                            <RotateCw size={13} className="animate-spin" /> Đang chấm...
                          </>
                        ) : (
                          <>
                            <Play size={13} /> {sub.status === 'error' ? 'Thử chấm lại' : 'Chấm bài này'}
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => removeSubmission(sub.id)}
                      disabled={sub.status === 'grading' || gradingIds.has(sub.id) || isBatchGrading}
                      className="btn btn-danger"
                      style={{
                        padding: '6px 8px',
                        opacity:
                          sub.status === 'grading' || gradingIds.has(sub.id) || isBatchGrading ? 0.4 : 1,
                        cursor:
                          sub.status === 'grading' || gradingIds.has(sub.id) || isBatchGrading
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                      title="Xóa bài này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Error Message Details */}
                  {sub.status === 'error' && sub.error && (
                    <div
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        marginTop: '4px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(244, 63, 94, 0.12)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        color: '#fda4af',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={15} style={{ flexShrink: 0, color: '#f43f5e' }} />
                        <span>{sub.error}</span>
                      </div>
                      <button
                        onClick={() => gradeSubmission(sub.id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', flexShrink: 0 }}
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
