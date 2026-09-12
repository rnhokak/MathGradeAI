'use client';

import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  UploadCloud,
  FileCheck,
  Play,
  Pause,
  Square,
  RotateCw,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  Layers,
  RefreshCw,
  Bot,
  Zap,
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
  
  // Sequential Queue State
  const [queueStatus, setQueueStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [queueProgress, setQueueProgress] = useState({
    total: 0,
    current: 0,
    studentName: '',
    statusText: '',
  });

  const queueControlRef = useRef({
    isPaused: false,
    isCancelled: false,
  });

  const submissionsRef = useRef<StudentSubmission[]>(submissions);
  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  // Clean up duplicate entries
  useEffect(() => {
    const seen = new Set<string>();
    let hasDuplicate = false;
    for (const sub of submissions) {
      if (seen.has(sub.id)) {
        hasDuplicate = true;
        break;
      }
      seen.add(sub.id);
    }
    if (hasDuplicate) {
      onUpdateSubmissions((prev) =>
        prev.filter((sub, index, self) => index === self.findIndex((s) => s.id === sub.id))
      );
    }
  }, [submissions, onUpdateSubmissions]);

  // Auto clean Vietnamese student name from filename
  const cleanStudentName = (fileName: string): string => {
    let name = fileName.replace(/\.[^/.]+$/, '');
    name = name.replace(/bài\s*\d+/i, '').replace(/bai\s*\d+/i, '');
    name = name.replace(/[-_]/g, ' ').trim();
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Handle uploading files
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    const newSubs: StudentSubmission[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isDocx = file.name.endsWith('.docx');
      const isImage = /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
      const uniqueId = `sub-${timestamp}-${Math.random().toString(36).slice(2, 8)}-${i}`;

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
              id: uniqueId,
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
          id: uniqueId,
          studentName: cleanStudentName(file.name),
          fileName: file.name,
          fileType: 'image',
          fileSize: file.size,
          images: [dataUrl],
          status: 'idle',
        });
      }
    }

    onUpdateSubmissions((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const filtered = newSubs.filter((s) => !existingIds.has(s.id));
      return [...prev, ...filtered];
    });

    e.target.value = '';
    setIsProcessingFiles(false);
  };

  // Grade a single submission directly
  const gradeSingleSubmission = async (sub: StudentSubmission) => {
    setActiveSubId(sub.id);
    const isTriple = (settings.gradingMode || 'triple_consensus') === 'triple_consensus';

    onUpdateSubmissions((prev) =>
      prev.map((s) =>
        s.id === sub.id
          ? {
              ...s,
              status: 'grading',
              stepMessage: isTriple
                ? 'Đang chấm đồng thời 3 Model (Gemini, Claude, GPT-4o)...'
                : 'Đang chấm AI...',
              error: undefined,
            }
          : s
      )
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

      // Update state reactively
      onUpdateSubmissions((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                status: 'done',
                gradingResult: data.gradingResult,
                stepMessage: undefined,
                queuePosition: undefined,
                error: undefined,
              }
            : s
        )
      );
      return true;
    } catch (err: any) {
      console.error(`Error grading ${sub.id}:`, err);
      onUpdateSubmissions((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                status: 'error',
                error: err.message || 'Lỗi không xác định',
                stepMessage: undefined,
                queuePosition: undefined,
              }
            : s
        )
      );
      return false;
    } finally {
      setActiveSubId(null);
    }
  };

  // Start sequential queue processing
  const startQueue = async (targetId?: string) => {
    if (queueStatus === 'running') return;

    // Reset control flags
    queueControlRef.current = {
      isPaused: false,
      isCancelled: false,
    };

    let toQueue: StudentSubmission[] = [];
    if (targetId) {
      const found = submissionsRef.current.find((s) => s.id === targetId);
      if (found) toQueue = [found];
    } else {
      toQueue = submissionsRef.current.filter(
        (s) => s.status === 'idle' || s.status === 'error'
      );
    }

    if (toQueue.length === 0) return;

    // Set UI to queued state
    const queueMap = new Map<string, number>();
    toQueue.forEach((item, index) => {
      queueMap.set(item.id, index + 1);
    });

    onUpdateSubmissions((prev) =>
      prev.map((s) =>
        queueMap.has(s.id)
          ? {
              ...s,
              status: 'queued',
              queuePosition: queueMap.get(s.id),
              error: undefined,
            }
          : s
      )
    );

    setQueueStatus('running');
    setQueueProgress({
      total: toQueue.length,
      current: 0,
      studentName: toQueue[0]?.studentName || '',
      statusText: 'Đang bắt đầu hàng đợi...',
    });

    const delayMs = settings.queueDelayMs ?? 2000;
    let completedCount = 0;

    for (let i = 0; i < toQueue.length; i++) {
      // Check cancellation
      if (queueControlRef.current.isCancelled) {
        break;
      }

      // Check pause
      while (queueControlRef.current.isPaused) {
        if (queueControlRef.current.isCancelled) break;
        await new Promise((r) => setTimeout(r, 250));
      }

      if (queueControlRef.current.isCancelled) {
        break;
      }

      const item = toQueue[i];
      setQueueProgress({
        total: toQueue.length,
        current: i + 1,
        studentName: item.studentName,
        statusText: `Đang chấm bài ${i + 1}/${toQueue.length}: ${item.studentName}...`,
      });

      // Grade the submission
      await gradeSingleSubmission(item);
      completedCount++;

      // Update remaining queue positions
      onUpdateSubmissions((prev) =>
        prev.map((s) => {
          if (s.status === 'queued' && s.queuePosition && s.queuePosition > 1) {
            return { ...s, queuePosition: s.queuePosition - 1 };
          }
          return s;
        })
      );

      // Controlled polite pause between submissions to prevent rate limit
      if (i < toQueue.length - 1 && !queueControlRef.current.isCancelled) {
        setQueueProgress((prev) => ({
          ...prev,
          statusText: `Đã chấm xong ${item.studentName}. Nghỉ ${(delayMs / 1000).toFixed(1)}s trước bài tiếp theo...`,
        }));
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Clean up queue
    if (queueControlRef.current.isCancelled) {
      onUpdateSubmissions((prev) =>
        prev.map((s) =>
          s.status === 'queued'
            ? { ...s, status: 'idle', queuePosition: undefined, stepMessage: undefined }
            : s
        )
      );
    } else if (completedCount > 0) {
      // Trigger confetti celebration when queue successfully finished!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    setQueueStatus('idle');
    setActiveSubId(null);
  };

  // Pause queue
  const handlePauseQueue = () => {
    queueControlRef.current.isPaused = true;
    setQueueStatus('paused');
    setQueueProgress((prev) => ({
      ...prev,
      statusText: 'Hàng đợi đang tạm dừng. Bấm "Tiếp tục" để chạy tiếp.',
    }));
  };

  // Resume queue
  const handleResumeQueue = () => {
    queueControlRef.current.isPaused = false;
    setQueueStatus('running');
  };

  // Cancel queue
  const handleCancelQueue = () => {
    queueControlRef.current.isCancelled = true;
    queueControlRef.current.isPaused = false;
    setQueueStatus('idle');
    setActiveSubId(null);
    onUpdateSubmissions((prev) =>
      prev.map((s) =>
        s.status === 'queued'
          ? { ...s, status: 'idle', queuePosition: undefined, stepMessage: undefined }
          : s
      )
    );
  };

  // Remove submission safely
  const removeSubmission = (id: string) => {
    if (activeSubId === id) return;
    onUpdateSubmissions((prev) => prev.filter((s) => s.id !== id));
  };

  // Deduplicate submissions
  const displaySubmissions = submissions.filter(
    (sub, index, self) => index === self.findIndex((s) => s.id === sub.id)
  );

  const completedCount = displaySubmissions.filter((s) => s.status === 'done').length;
  const pendingCount = displaySubmissions.filter(
    (s) => s.status === 'idle' || s.status === 'error' || s.status === 'queued'
  ).length;
  const isTripleMode = (settings.gradingMode || 'triple_consensus') === 'triple_consensus';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Upload & Queue Header Banner */}
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
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <UploadCloud size={22} color="#06b6d4" />
              Nạp Danh Sách Bài Làm & Quản Lý Chấm Bài
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Hỗ trợ nạp cùng lúc nhiều bài làm (.docx hoặc ảnh viết tay). Hệ thống dùng{' '}
              <strong style={{ color: '#38bdf8' }}>
                {isTripleMode ? 'Bộ 3 Model AI (Gemini + Claude + GPT-4o) đối chiếu kết quả' : '1 Model AI'}
              </strong>{' '}
              và hàng đợi tuần tự để chấm điểm chính xác nhất.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label
              className="btn btn-secondary"
              style={{
                cursor:
                  isProcessingFiles || queueStatus === 'running'
                    ? 'not-allowed'
                    : 'pointer',
                opacity: isProcessingFiles || queueStatus === 'running' ? 0.6 : 1,
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
                disabled={isProcessingFiles || queueStatus === 'running'}
              />
            </label>

            {displaySubmissions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* AI Mode badge */}
                <span
                  className={`badge ${isTripleMode ? 'badge-indigo' : 'badge-amber'}`}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={13} color={isTripleMode ? '#818cf8' : '#fbbf24'} />
                  {isTripleMode ? '3 Model Đối Chiếu (Gemini + Claude + GPT-4o)' : `1 Model: ${settings.provider.toUpperCase()}`}
                </span>

                {/* Start Queue button */}
                {queueStatus === 'idle' ? (
                  <button
                    onClick={() => startQueue()}
                    disabled={pendingCount === 0 || isProcessingFiles}
                    className="btn btn-emerald"
                    style={{
                      minWidth: '170px',
                      opacity: pendingCount === 0 || isProcessingFiles ? 0.6 : 1,
                      cursor: pendingCount === 0 || isProcessingFiles ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Play size={15} /> Chạy hàng đợi chấm ({pendingCount} bài)
                  </button>
                ) : queueStatus === 'running' ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handlePauseQueue}
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                    >
                      <Pause size={14} /> Tạm dừng
                    </button>
                    <button
                      onClick={handleCancelQueue}
                      className="btn btn-danger"
                      style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                    >
                      <Square size={14} /> Hủy hàng đợi
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleResumeQueue}
                      className="btn btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                    >
                      <Play size={14} /> Tiếp tục
                    </button>
                    <button
                      onClick={handleCancelQueue}
                      className="btn btn-danger"
                      style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                    >
                      <Square size={14} /> Hủy hàng đợi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Sequential Queue Banner */}
      {queueStatus !== 'idle' && (
        <div
          className="glass-panel"
          style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: queueStatus === 'running' ? '#34d399' : '#fbbf24',
                  boxShadow:
                    queueStatus === 'running'
                      ? '0 0 12px #34d399'
                      : '0 0 12px #fbbf24',
                  animation: queueStatus === 'running' ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#f8fafc' }}>
                HÀNG ĐỢI CHẤM BÀI TUẦN TỰ: {queueStatus === 'running' ? 'ĐANG CHẠY' : 'ĐANG TẠM DỪNG'}
              </span>
              <span
                className="badge badge-indigo"
                style={{ fontSize: '0.78rem', padding: '3px 10px' }}
              >
                Tiến độ: {queueProgress.current} / {queueProgress.total} bài
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Giãn cách: {((settings.queueDelayMs ?? 2000) / 1000).toFixed(1)}s / bài
              </span>
              {queueStatus === 'running' ? (
                <button
                  onClick={handlePauseQueue}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Pause size={13} /> Tạm dừng
                </button>
              ) : (
                <button
                  onClick={handleResumeQueue}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Play size={13} /> Tiếp tục
                </button>
              )}
              <button
                onClick={handleCancelQueue}
                className="btn btn-danger"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <Square size={13} /> Hủy
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${
                  queueProgress.total > 0
                    ? Math.round((queueProgress.current / queueProgress.total) * 100)
                    : 0
                }%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #06b6d4, #10b981)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.84rem',
              color: '#cbd5e1',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCw size={13} className={queueStatus === 'running' ? 'animate-spin' : ''} />
              {queueProgress.statusText}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              {isTripleMode
                ? 'Đang đối chiếu 3 Model AI & tự động chấm lại nếu lệch điểm'
                : 'Đang chấm bài tuần tự'}
            </span>
          </div>
        </div>
      )}

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
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FileCheck size={18} color="#34d399" />
            Danh Sách Bài Làm ({displaySubmissions.length} bài — Đã chấm xong: {completedCount}/{displaySubmissions.length})
          </h3>
        </div>

        {displaySubmissions.length === 0 ? (
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
            {displaySubmissions.map((sub, idx) => {
              const hasImages = sub.images && sub.images.length > 0;
              const isGraded = sub.status === 'done';
              const consensus = sub.gradingResult?.consensusReport;

              return (
                <div
                  key={`${sub.id}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background:
                      sub.status === 'grading'
                        ? 'rgba(99, 102, 241, 0.12)'
                        : sub.status === 'queued'
                        ? 'rgba(30, 41, 59, 0.8)'
                        : 'rgba(15, 23, 42, 0.6)',
                    border:
                      sub.status === 'grading'
                        ? '1px solid rgba(99, 102, 241, 0.5)'
                        : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    gap: '16px',
                    flexWrap: 'wrap',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Left: Thumbnail & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
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

                  {/* Middle: Status & Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {sub.status === 'idle' && (
                      <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}>
                        <Clock size={12} /> Chờ chấm
                      </span>
                    )}

                    {sub.status === 'queued' && (
                      <span className="badge badge-indigo" style={{ padding: '5px 10px' }}>
                        <Clock size={12} /> Trong hàng đợi #{sub.queuePosition || 1}
                      </span>
                    )}

                    {sub.status === 'grading' && (
                      <span className="badge badge-amber" style={{ padding: '5px 10px' }}>
                        <RotateCw size={12} className="animate-spin" />{' '}
                        {sub.stepMessage || 'Đang chấm 3 Model AI...'}
                      </span>
                    )}

                    {sub.status === 'regrading' && (
                      <span className="badge badge-rose" style={{ padding: '5px 10px' }}>
                        <RotateCw size={12} className="animate-spin" /> Lệch điểm — Đang chấm lại...
                      </span>
                    )}

                    {sub.status === 'done' && sub.gradingResult && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong
                          style={{
                            fontSize: '1.1rem',
                            color: sub.gradingResult.score >= 0.8 ? '#34d399' : '#fbbf24',
                          }}
                        >
                          {sub.gradingResult.score} / {sub.gradingResult.maxScore}đ
                        </strong>

                        {/* Consensus Badge */}
                        {consensus ? (
                          consensus.status === 'unanimous' ? (
                            <span
                              className="badge badge-emerald"
                              title={consensus.summary}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                            >
                              <CheckCircle2 size={12} /> Đồng thuận 3/3 Model
                            </span>
                          ) : consensus.status === 'majority' ? (
                            <span
                              className="badge badge-amber"
                              title={consensus.summary}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                            >
                              <Layers size={12} /> Đồng thuận 2/3 (Lệch {consensus.scoreDifference}đ)
                            </span>
                          ) : consensus.status === 'resolved_after_retry' ? (
                            <span
                              className="badge badge-indigo"
                              title={consensus.summary}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                            >
                              <RefreshCw size={12} /> Đã chấm lại {consensus.regradeCount} lần
                            </span>
                          ) : (
                            <span
                              className="badge badge-rose"
                              title={consensus.summary}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                            >
                              <AlertCircle size={12} /> Chênh lệch {consensus.scoreDifference}đ
                            </span>
                          )
                        ) : (
                          <span className="badge badge-emerald">
                            <CheckCircle2 size={12} /> Đã chấm xong
                          </span>
                        )}
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
                        onClick={() => startQueue(sub.id)}
                        disabled={sub.status === 'grading' || sub.status === 'queued' || queueStatus === 'running'}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          opacity:
                            sub.status === 'grading' || sub.status === 'queued' || queueStatus === 'running'
                              ? 0.6
                              : 1,
                          cursor:
                            sub.status === 'grading' || sub.status === 'queued' || queueStatus === 'running'
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {sub.status === 'grading' ? (
                          <>
                            <RotateCw size={13} className="animate-spin" /> Đang chấm...
                          </>
                        ) : sub.status === 'queued' ? (
                          <>
                            <Clock size={13} /> Đã xếp hàng
                          </>
                        ) : (
                          <>
                            <Play size={13} /> {sub.status === 'error' ? 'Thử lại' : 'Chấm bài này'}
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => removeSubmission(sub.id)}
                      disabled={sub.status === 'grading' || sub.status === 'queued' || queueStatus === 'running'}
                      className="btn btn-danger"
                      style={{
                        padding: '6px 8px',
                        opacity:
                          sub.status === 'grading' || sub.status === 'queued' || queueStatus === 'running'
                            ? 0.4
                            : 1,
                        cursor:
                          sub.status === 'grading' || sub.status === 'queued' || queueStatus === 'running'
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
                        onClick={() => startQueue(sub.id)}
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

