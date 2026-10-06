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
  // Grade a single submission directly with MANDATORY 2-STEP PIPELINE:
  // Bước 1: Bắt buộc đọc OCR ảnh trước (3 lần & verify hoặc 1 lần) -> Lấy bài đã có văn bản
  // Bước 2: Chấm bài bằng AI bằng văn bản đã qua OCR
  const gradeSingleSubmission = async (sub: StudentSubmission) => {
    setActiveSubId(sub.id);
    const mode = settings.gradingMode || 'single_pass';
    const provider = settings.provider || 'openrouter';
    const isTriple = provider !== 'openrouter' && mode === 'triple_consensus';
    const passes = (provider === 'openrouter' && mode === 'triple_consensus')
      ? 3
      : (settings.gradingPasses ?? (settings.modelPasses?.[provider] ?? 1));
    const ocrPasses = settings.ocrPasses ?? 3;
    const hasImages = sub.images && sub.images.length > 0;

    const providerDisplayNames: Record<string, string> = {
      openrouter: `Qwen (${settings.openrouterModel || '3.8 27B'})`,
      alibabacloud: `Qwen (${settings.alibabacloudModel || 'Alibaba'})`,
      openai: settings.openaiModel || 'GPT-4o',
      gemini: settings.geminiModel || 'Gemini 3.8',
    };
    const activeModelName = providerDisplayNames[provider] || provider;

    let currentSub = { ...sub };

    // =========================================================================
    // BƯỚC 1: BẮT BUỘC ĐỌC OCR ẢNH TRƯỚC (NẾU BÀI LÀM CÓ ẢNH VÀ CHƯA CÓ OCR)
    // =========================================================================
    if (hasImages && (!currentSub.extractedText || !currentSub.ocrComparison)) {
      const ocrBaseMessage = ocrPasses === 3
        ? 'Bước 1/2: Đang đọc OCR ảnh 3 lần & verify đối chiếu nét mực...'
        : 'Bước 1/2: Đang đọc nhanh công thức qua AI OCR (1 lần)...';

      const MAX_OCR_RETRIES = 3;
      let ocrSuccess = false;
      let ocrLastError: any = null;

      for (let attempt = 1; attempt <= MAX_OCR_RETRIES; attempt++) {
        onUpdateSubmissions((prev) =>
          prev.map((s) =>
            s.id === sub.id
              ? {
                  ...s,
                  status: 'ocr',
                  stepMessage:
                    attempt > 1
                      ? `[Thử lại OCR ${attempt}/${MAX_OCR_RETRIES}] ${ocrBaseMessage}`
                      : ocrBaseMessage,
                  error: undefined,
                }
              : s
          )
        );

        try {
          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(settings.geminiApiKey ? { 'x-gemini-api-key': settings.geminiApiKey } : {}),
              ...(settings.openaiApiKey ? { 'x-openai-api-key': settings.openaiApiKey } : {}),
              ...(settings.openrouterApiKey ? { 'x-openrouter-api-key': settings.openrouterApiKey } : {}),
              ...(settings.alibabacloudApiKey ? { 'x-alibabacloud-api-key': settings.alibabacloudApiKey } : {}),
            },
            body: JSON.stringify({
              submission: currentSub,
              settings,
              ocrPasses,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || `Lỗi HTTP ${res.status} từ máy chủ khi đọc OCR`);
          }

          // Cập nhật kết quả OCR đã được verify vào currentSub
          currentSub = {
            ...currentSub,
            extractedText: data.consensusText,
            ocrComparison: data.ocrComparison,
          };

          onUpdateSubmissions((prev) =>
            prev.map((s) =>
              s.id === sub.id
                ? {
                    ...s,
                    extractedText: data.consensusText,
                    ocrComparison: data.ocrComparison,
                  }
                : s
            )
          );

          ocrSuccess = true;
          break;
        } catch (err: any) {
          ocrLastError = err;
          console.warn(`[OCR ${sub.studentName}] Lần ${attempt}/${MAX_OCR_RETRIES} gặp lỗi:`, err.message || err);

          if (attempt < MAX_OCR_RETRIES) {
            const delayMs = attempt * 1500;
            onUpdateSubmissions((prev) =>
              prev.map((s) =>
                s.id === sub.id
                  ? {
                      ...s,
                      stepMessage: `Sự cố đọc OCR (${err.message || 'Lỗi mạng'}). Đang thử lại (${attempt + 1}/${MAX_OCR_RETRIES})...`,
                    }
                  : s
              )
            );
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }

      if (!ocrSuccess) {
        console.error(`[OCR thất bại] Không thể đọc ảnh bài làm của ${sub.studentName}:`, ocrLastError);
        const errText = `Lỗi đọc ảnh OCR sau 3 lần thử: ${ocrLastError?.message || 'Lỗi không xác định'}. Bắt buộc OCR xong mới chấm bài.`;
        onUpdateSubmissions((prev) =>
          prev.map((s) =>
            s.id === sub.id
              ? {
                  ...s,
                  status: 'error',
                  error: errText,
                  stepMessage: undefined,
                  queuePosition: undefined,
                }
              : s
          )
        );
        setActiveSubId(null);
        return false;
      }
    }

    // =========================================================================
    // BƯỚC 2: CHẤM BÀI BẰNG AI (SỬ DỤNG BẢN ĐÃ QUA OCR VÀ VERIFY)
    // =========================================================================
    const gradeBaseMessage = isTriple
      ? 'Bước 2/2: Đang chấm đồng thời 3 Model (Gemini, OpenRouter, GPT-4o)...'
      : passes === 3
      ? `Bước 2/2: Đang chấm 3 lần bằng ${activeModelName} (Barem + Soi lỗi + Sư phạm)...`
      : `Bước 2/2: Đang chấm nhanh bằng ${activeModelName}...`;

    const MAX_GRADE_RETRIES = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_GRADE_RETRIES; attempt++) {
      onUpdateSubmissions((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                status: 'grading',
                stepMessage:
                  attempt > 1
                    ? `[Thử lại Chấm ${attempt}/${MAX_GRADE_RETRIES}] ${gradeBaseMessage}`
                    : gradeBaseMessage,
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
            ...(settings.openaiApiKey ? { 'x-openai-api-key': settings.openaiApiKey } : {}),
            ...(settings.openrouterApiKey ? { 'x-openrouter-api-key': settings.openrouterApiKey } : {}),
            ...(settings.alibabacloudApiKey ? { 'x-alibabacloud-api-key': settings.alibabacloudApiKey } : {}),
          },
          body: JSON.stringify({
            submission: currentSub,
            rubric,
            settings,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Lỗi HTTP ${res.status} từ máy chủ khi chấm bài`);
        }

        // Thành công: Cập nhật trạng thái 'done'
        onUpdateSubmissions((prev) =>
          prev.map((s) =>
            s.id === sub.id
              ? {
                  ...s,
                  status: 'done',
                  gradingResult: data.gradingResult,
                  extractedText: data.extractedText || currentSub.extractedText,
                  ocrComparison: data.ocrComparison || currentSub.ocrComparison,
                  stepMessage: undefined,
                  queuePosition: undefined,
                  error: undefined,
                }
              : s
          )
        );
        setActiveSubId(null);
        return true;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Chấm bài ${sub.studentName}] Lần ${attempt}/${MAX_GRADE_RETRIES} gặp lỗi:`, err.message || err);

        if (attempt < MAX_GRADE_RETRIES) {
          const delayMs = attempt * 1500;
          onUpdateSubmissions((prev) =>
            prev.map((s) =>
              s.id === sub.id
                ? {
                    ...s,
                    stepMessage: `Gặp sự cố chấm bài (${err.message || 'Lỗi kết nối'}). Đang thử lại (${attempt + 1}/${MAX_GRADE_RETRIES})...`,
                  }
                : s
            )
          );
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }

    // Sau 3 lần lỗi thì dừng và báo lỗi chi tiết
    console.error(`[Chấm bài thất bại] Đã thử 3 lần đều gặp lỗi bài của ${sub.studentName}:`, lastError);
    const finalErrorMessage = `Đã thử lại 3 lần nhưng đều thất bại (${lastError?.message || 'Lỗi không xác định'})`;

    onUpdateSubmissions((prev) =>
      prev.map((s) =>
        s.id === sub.id
          ? {
              ...s,
              status: 'error',
              error: finalErrorMessage,
              stepMessage: undefined,
              queuePosition: undefined,
            }
          : s
      )
    );
    setActiveSubId(null);
    return false;
  };

  // Run OCR with selected passes on a single submission without immediate grading (Tự động thử lại tối đa 3 lần)
  const runOcrOnly = async (sub: StudentSubmission) => {
    setActiveSubId(sub.id);
    const MAX_RETRIES = 3;
    let lastError: any = null;
    const ocrPasses = settings.ocrPasses ?? 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      onUpdateSubmissions((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                status: 'ocr',
                stepMessage:
                  attempt > 1
                    ? `[Thử lại ${attempt}/${MAX_RETRIES}] Đang đọc công thức bằng AI OCR...`
                    : ocrPasses === 3
                    ? 'Đang đọc ảnh OCR 3 lần & verify đối chiếu nét mực...'
                    : 'Đang đọc công thức bằng AI OCR (1 lần)...',
                error: undefined,
              }
            : s
        )
      );

      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(settings.geminiApiKey ? { 'x-gemini-api-key': settings.geminiApiKey } : {}),
            ...(settings.openaiApiKey ? { 'x-openai-api-key': settings.openaiApiKey } : {}),
            ...(settings.openrouterApiKey ? { 'x-openrouter-api-key': settings.openrouterApiKey } : {}),
            ...(settings.alibabacloudApiKey ? { 'x-alibabacloud-api-key': settings.alibabacloudApiKey } : {}),
          },
          body: JSON.stringify({
            submission: sub,
            settings,
            ocrPasses,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi khi nhận diện công thức');

        onUpdateSubmissions((prev) =>
          prev.map((s) =>
            s.id === sub.id
              ? {
                  ...s,
                  status: s.gradingResult ? 'done' : 'idle',
                  extractedText: data.consensusText,
                  ocrComparison: data.ocrComparison,
                  stepMessage: undefined,
                }
              : s
          )
        );
        setActiveSubId(null);
        return true;
      } catch (err: any) {
        lastError = err;
        console.warn(`[OCR ${sub.studentName}] Lần ${attempt}/${MAX_RETRIES} gặp lỗi:`, err.message || err);

        if (attempt < MAX_RETRIES) {
          const delayMs = attempt * 1500;
          onUpdateSubmissions((prev) =>
            prev.map((s) =>
              s.id === sub.id
                ? {
                    ...s,
                    stepMessage: `Lỗi đọc công thức: ${err.message || 'Lỗi API'}. Đang thử lại (${attempt + 1}/${MAX_RETRIES})...`,
                  }
                : s
            )
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error(`[OCR thất bại] Đã thử 3 lần trên bài của ${sub.studentName}:`, lastError);
    onUpdateSubmissions((prev) =>
      prev.map((s) =>
        s.id === sub.id
          ? {
              ...s,
              status: 'error',
              error: `Lỗi nhận diện công thức sau 3 lần thử: ${lastError?.message || 'Lỗi không xác định'}`,
              stepMessage: undefined,
            }
          : s
      )
    );
    setActiveSubId(null);
    return false;
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
  const mode = settings.gradingMode || 'single_pass';
  const activeProvider = settings.provider || 'openrouter';
  const isTripleMode = activeProvider !== 'openrouter' && mode === 'triple_consensus';
  const activePasses = (activeProvider === 'openrouter' && mode === 'triple_consensus')
    ? 3
    : (settings.gradingPasses ?? (settings.modelPasses?.[activeProvider] ?? 1));
  const activeOcrPasses = settings.ocrPasses ?? 3;
  const activeModelTitle =
    activeProvider === 'openrouter'
      ? `Qwen (${settings.openrouterModel || '3.8 27B'})`
      : activeProvider === 'alibabacloud'
      ? `Qwen (${settings.alibabacloudModel || 'Alibaba'})`
      : activeProvider === 'openai'
      ? (settings.openaiModel || 'GPT-4o')
      : (settings.geminiModel || 'Gemini 3.8');

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
              Quy trình chuẩn 2 bước: Bắt buộc{' '}
              <strong style={{ color: '#38bdf8' }}>
                Đọc OCR ảnh {activeOcrPasses === 1 ? '1 Lần nhanh' : '3 Lần & Verify đối chiếu'}
              </strong>{' '}
              ➔ Chuyển bài đã số hóa sang{' '}
              <strong style={{ color: isTripleMode ? '#818cf8' : activePasses === 3 ? '#fbbf24' : '#34d399' }}>
                {isTripleMode
                  ? 'Chấm đối chiếu 3 Model AI (Gemini + OpenRouter + GPT-4o)'
                  : activePasses === 3
                  ? `Chấm 3 Lần Triple-Pass bằng ${activeModelTitle} (Barem + Soi lỗi + Sư phạm)`
                  : `Chấm 1 Lần Nhanh bằng ${activeModelTitle}`}
              </strong>.
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
                  className="badge badge-indigo"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={13} color="#818cf8" />
                  {`Quy trình 2 bước: OCR ${activeOcrPasses === 1 ? '1 Lần' : '3 Lần (⭐)'} ➔ Chấm ${activePasses === 1 ? '1 Lần' : '3 Lần (⭐)'}`}
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

                    {sub.status === 'ocr' && (
                      <span className="badge badge-indigo" style={{ padding: '5px 10px' }}>
                        <RotateCw size={12} className="animate-spin" />{' '}
                        {sub.stepMessage || 'Đang đọc công thức bằng 3 Model AI...'}
                      </span>
                    )}

                    {(sub.ocrComparison || sub.gradingResult?.ocrComparison) && (
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#06b6d4',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title={
                          (sub.ocrComparison || sub.gradingResult?.ocrComparison)?.comparisonSummary ||
                          'Đã đối chiếu công thức bằng 3 Model AI'
                        }
                      >
                        <FileCode size={11} /> 3-Model OCR
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
                          (() => {
                            const isSingleTriple =
                              consensus.evaluations.length > 1 &&
                              consensus.evaluations.every((e) => e.provider === consensus.evaluations[0]?.provider);
                            const providerName = consensus.evaluations[0]?.provider?.toUpperCase() || 'AI';

                            if (consensus.status === 'single_model') {
                              return (
                                <span
                                  className="badge badge-amber"
                                  title={consensus.summary}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                                >
                                  <AlertCircle size={12} /> {isSingleTriple ? `Chỉ 1 lượt ${providerName}` : `Chỉ 1 Model (${providerName})`}
                                </span>
                              );
                            }
                            if (consensus.status === 'unanimous') {
                              return (
                                <span
                                  className="badge badge-emerald"
                                  title={consensus.summary}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                                >
                                  <CheckCircle2 size={12} /> {isSingleTriple ? `Đồng thuận 3 lần ${providerName}` : 'Đồng thuận 3/3 Model'}
                                </span>
                              );
                            }
                            if (consensus.status === 'majority') {
                              return (
                                <span
                                  className="badge badge-amber"
                                  title={consensus.summary}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                                >
                                  <Layers size={12} /> {isSingleTriple ? `Đồng thuận đa số (${providerName})` : `Đồng thuận ${consensus.evaluations.length >= 3 ? 'đa số (2/3)' : '2 Model'}`} (Lệch {consensus.scoreDifference}đ)
                                </span>
                              );
                            }
                            if (consensus.status === 'resolved_after_retry') {
                              return (
                                <span
                                  className="badge badge-indigo"
                                  title={consensus.summary}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                                >
                                  <RefreshCw size={12} /> {isSingleTriple ? `Hội đồng ${providerName} tổng hợp` : `Đã chấm lại ${consensus.regradeCount} lần`}
                                </span>
                              );
                            }
                            return (
                              <span
                                className="badge badge-rose"
                                title={consensus.summary}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}
                              >
                                <AlertCircle size={12} /> {isSingleTriple ? `${providerName} lệch ${consensus.scoreDifference}đ (Đã phân xử)` : `Chênh lệch ${consensus.scoreDifference}đ`}
                              </span>
                            );
                          })()
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
                    {hasImages && !isGraded && (
                      <button
                        onClick={() => runOcrOnly(sub)}
                        disabled={sub.status === 'grading' || sub.status === 'ocr' || sub.status === 'queued' || queueStatus === 'running'}
                        className="btn btn-secondary"
                        title={`Đọc ảnh viết tay (${activeOcrPasses === 1 ? '1 lần nhanh' : '3 lần & đối chiếu verify'}) trước khi chấm`}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <FileCode size={13} color="#06b6d4" />
                        {sub.status === 'ocr' ? 'Đang đọc...' : (activeOcrPasses === 1 ? 'Đọc OCR 1 Lần' : 'Đọc OCR 3 Lần')}
                      </button>
                    )}

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

