'use client';

import React, { useState, useEffect } from 'react';
import { ModelOption } from '@/utils/modelConfig';
import {
  X,
  Key,
  User,
  Sliders,
  Check,
  ShieldCheck,
  Cpu,
  Sparkles,
  Bot,
  Layers,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { TeacherSettings, AIProvider } from '@/types/grading';

interface SettingsModalProps {
  isOpen: boolean;
  settings: TeacherSettings;
  onClose: () => void;
  onSave: (newSettings: TeacherSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [current, setCurrent] = useState<TeacherSettings>({
    ...settings,
    provider: settings.provider || 'openrouter',
    strictness: settings.strictness || 'strict',
    gradingMode: settings.gradingMode || 'single_pass',
    autoOcrBeforeGrading: true,
    ocrPasses: settings.ocrPasses ?? 3,
    gradingPasses: settings.gradingPasses ?? 1,
    queueDelayMs: settings.queueDelayMs ?? 2000,
    maxRegradeRetries: settings.maxRegradeRetries ?? 2,
    consensusTolerance: settings.consensusTolerance ?? 0.25,
    geminiModel: settings.geminiModel || settings.model || 'gemini-3.8-flash',
    openaiModel: settings.openaiModel || 'gpt-4o',
    openaiBaseUrl: settings.openaiBaseUrl || 'https://api.openai.com/v1',
    openrouterModel: settings.openrouterModel || 'qwen/qwen3.8-27b',
    openrouterBaseUrl: settings.openrouterBaseUrl || 'https://openrouter.ai/api/v1',
    openrouterReasoning: settings.openrouterReasoning !== false,
    openrouterApiKey: settings.openrouterApiKey || '',
    alibabacloudModel: settings.alibabacloudModel || 'qwen-plus-character',
    alibabacloudBaseUrl:
      settings.alibabacloudBaseUrl ||
      'https://ws-oxwvfx79avt7ebq3.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    alibabacloudApiKey: settings.alibabacloudApiKey || '',
    modelPasses: {
      gemini: settings.modelPasses?.gemini ?? 1,
      openai: settings.modelPasses?.openai ?? 1,
      openrouter: settings.modelPasses?.openrouter ?? 1,
      alibabacloud: settings.modelPasses?.alibabacloud ?? 1,
    },
  });

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showAlibabaCloudKey, setShowAlibabaCloudKey] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
  }, [isOpen]);

  // Custom model flags
  const [isCustomGemini, setIsCustomGemini] = useState(
    !['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-pro'].includes(
      current.geminiModel
    )
  );
  const [isCustomOpenAI, setIsCustomOpenAI] = useState(
    !['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'gpt-4-turbo'].includes(current.openaiModel)
  );
  const [isCustomOpenRouter, setIsCustomOpenRouter] = useState(
    ![
      'qwen/qwen3.8-27b',
      'qwen/qwen3-vl-235b-a22b-instruct',
      'qwen/qwen3.8-flash',
      'qwen/qwen-2.5-vl-72b-instruct',
      'qwen/qwen-2.5-72b-instruct',
      'qwen/qwq-32b-preview',
      'qwen/qwen-2.5-coder-32b-instruct',
    ].includes(current.openrouterModel || '')
  );
  const [isCustomAlibabaCloud, setIsCustomAlibabaCloud] = useState(
    ![
      'qwen-plus-character',
      'qwen-flash-character',
      'qwen-plus',
      'qwen-flash',
      'qwen-max',
      'qwen-vl-max',
      'qwen2.5-vl-72b-instruct',
    ].includes(current.alibabacloudModel || '')
  );

  const renderPassSelector = (
    providerKey: 'gemini' | 'openai' | 'openrouter' | 'alibabacloud',
    modelLabel: string
  ) => {
    const currentPasses = current.modelPasses?.[providerKey] ?? 3;
    return (
      <div
        style={{
          marginTop: '6px',
          padding: '12px 14px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: 0,
            }}
          >
            <Sparkles size={14} color="#818cf8" />
            Số lần chấm của {modelLabel}:
          </label>
          <span
            className={`badge ${currentPasses === 3 ? 'badge-amber' : 'badge-emerald'}`}
            style={{ fontSize: '0.68rem', padding: '2px 8px' }}
          >
            {currentPasses === 3 ? '⭐ Chấm 3 lần (Triple-Pass)' : '⚡ Chấm 1 lần nhanh'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={() =>
              setCurrent({
                ...current,
                modelPasses: {
                  ...current.modelPasses,
                  [providerKey]: 1,
                },
              })
            }
            className={`btn ${currentPasses === 1 ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 10px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: currentPasses === 1 ? '1px solid #06b6d4' : undefined,
              background: currentPasses === 1 ? 'rgba(6, 182, 212, 0.25)' : undefined,
            }}
          >
            {currentPasses === 1 && <Check size={14} />}
            ⚡ Chấm 1 Lần Nhanh
          </button>

          <button
            type="button"
            onClick={() =>
              setCurrent({
                ...current,
                modelPasses: {
                  ...current.modelPasses,
                  [providerKey]: 3,
                },
              })
            }
            className={`btn ${currentPasses === 3 ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 10px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: currentPasses === 3 ? '1px solid #f59e0b' : undefined,
              background: currentPasses === 3 ? 'rgba(245, 158, 11, 0.25)' : undefined,
            }}
          >
            {currentPasses === 3 && <Check size={14} />}
            ⭐ Chấm 3 Lần (Triple-Pass)
          </button>
        </div>

        <p style={{ fontSize: '0.73rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
          {currentPasses === 3
            ? `✓ Chấm 3 lượt độc lập (Barem + Soi lỗi + Sư phạm), sau đó Hội đồng ${modelLabel} tự tổng hợp và chốt điểm chính xác.`
            : `✓ Chấm 1 lần trực tiếp bằng ${modelLabel}, phản hồi nhanh chóng và tiết kiệm token.`}
        </p>
      </div>
    );
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...current,
      model: current.geminiModel, // sync backward compatibility field
    });
    onClose();
  };

  const handleProviderSelect = (provider: AIProvider) => {
    setCurrent({ ...current, provider });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px' }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="#818cf8" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Cài Đặt Sư Phạm & AI Chấm Bài
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Teacher Persona */}
          <div>
            <label
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <User size={16} color="#34d399" />
              Danh Xưng Giáo Viên (Xưng hô trong lời phê):
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginTop: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setCurrent({ ...current, role: 'thầy' })}
                className={`btn ${current.role === 'thầy' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '10px' }}
              >
                {current.role === 'thầy' && <Check size={16} />}
                Thầy giáo ("Thầy và Em")
              </button>
              <button
                type="button"
                onClick={() => setCurrent({ ...current, role: 'cô' })}
                className={`btn ${current.role === 'cô' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '10px' }}
              >
                {current.role === 'cô' && <Check size={16} />}
                Cô giáo ("Cô và Em")
              </button>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Tên giáo viên (tùy chọn, ví dụ: Tuấn, Mai):
              </label>
              <input
                type="text"
                className="input-field"
                value={current.teacherName}
                onChange={(e) => setCurrent({ ...current, teacherName: e.target.value })}
                placeholder="Ví dụ: Hoàng Tuấn"
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          {/* Strictness */}
          <div>
            <label
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={16} color="#f87171" />
              Mức Độ Chặt Chẽ Khi Chấm Bài:
            </label>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '8px' }}>
              Ảnh hưởng trực tiếp đến cách AI đánh giá lỗi nhỏ (thiếu điều kiện, sai ký hiệu, bỏ bước...).
            </p>
            <select
              className="input-field"
              value={current.strictness}
              onChange={(e) => setCurrent({ ...current, strictness: e.target.value as any })}
            >
              <option value="strict">🔴 Khắt khe — Mặc định (Mọi thiếu sót dù nhỏ đều trừ điểm)</option>
              <option value="standard">🟡 Chuẩn kỳ thi — THPT/ĐGNL (Linh hoạt với sơ suất nhỏ về trình bày)</option>
              <option value="encouraging">🟢 Khuyến khích (Ưu tiên ghi nhận tư duy đúng, bỏ qua hình thức)</option>
            </select>
          </div>

          {/* Grading Mode Selector: Triple-Model Consensus vs Single Model */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
            <label
              style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={18} color="#818cf8" />
              Chế Độ Chấm Bài AI:
            </label>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '12px' }}>
              Chọn phương thức chấm bài thi tự luận môn Toán.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid #a855f7',
                  background: 'rgba(168, 85, 247, 0.15)',
                  textAlign: 'left',
                  boxShadow: '0 0 16px rgba(168, 85, 247, 0.25)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={16} color="#c084fc" />
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
                      Mô Hình Chấm Bài: Qwen (OpenRouter)
                    </span>
                  </div>
                  <span className="badge badge-amber" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                    Chuyên gia Toán học ⭐
                  </span>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4, margin: 0 }}>
                  Hệ thống sử dụng bộ đôi mô hình Qwen đỉnh cao của Alibaba trên OpenRouter: <strong>qwen/qwen3-vl-235b-a22b-instruct</strong> (chuyên gia OCR nhận diện công thức ảnh) và <strong>qwen/qwen3.8-27b</strong> (chuyên gia lý luận & chấm bài thi). Hỗ trợ tùy chọn <strong>1 lần nhanh</strong> hoặc <strong>3 lần tư duy sâu (Deep Reasoning CoT)</strong>.
                </p>
                <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Trạng thái: <strong>QWEN OPENROUTER</strong> đang đặt <strong>{current.gradingPasses === 1 ? 'Chấm 1 lần nhanh' : 'Chấm 3 lần (Tư duy sâu ⭐)'}</strong></span>
                </div>
              </div>
            </div>

            {/* Mandatory 2-Step Pipeline Settings: OCR -> Grading */}
            <div
              style={{
                marginTop: '16px',
                padding: '16px 18px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.09), rgba(15, 23, 42, 0.7))',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                      ⚡ Quy trình chuẩn 2 bước: Bắt buộc Đọc OCR ảnh trước ➔ Chấm bài bằng AI sau
                    </span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                      Mặc định bắt buộc
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.5 }}>
                    Hệ thống luôn tự động tách biệt 2 giai đoạn: Bóc tách & đối chiếu công thức viết tay qua OCR trước, sau đó bài đã số hóa chuẩn LaTeX mới được đưa sang chấm điểm. Không chấm trực tiếp ảnh thô để bảo đảm công tâm tuyệt đối.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* Option 1: OCR Passes */}
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(15, 23, 42, 0.65)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                      1. Số lượt đọc OCR & Verify ảnh:
                    </span>
                    <span className="badge badge-indigo" style={{ fontSize: '0.68rem' }}>
                      {current.ocrPasses === 1 ? '1 Lần Nhanh' : '3 Lần & Verify (Khuyên dùng)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setCurrent({ ...current, ocrPasses: 3 })}
                      className={`btn ${current.ocrPasses !== 1 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      ⭐ Đọc 3 Lần & Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrent({ ...current, ocrPasses: 1 })}
                      className={`btn ${current.ocrPasses === 1 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      ⚡ Đọc 1 Lần nhanh
                    </button>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.4 }}>
                    {current.ocrPasses === 1
                      ? 'Đọc nhanh 1 lượt bằng model AI để lấy văn bản tức thì.'
                      : 'Đọc 3 lượt chuyên sâu (Toàn diện + Soi nét mực + Công thức) và chạy Hội đồng thẩm định đối chiếu nét mực thực tế với ảnh gốc.'}
                  </p>
                </div>

                {/* Option 2: Grading Passes */}
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(15, 23, 42, 0.65)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24' }}>
                      2. Số lượt chấm bài bằng AI:
                    </span>
                    <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>
                      {current.gradingPasses === 1 ? 'Chấm 1 Lần (Mặc định)' : 'Chấm 3 Lần Triple-Pass'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setCurrent({ ...current, gradingPasses: 1 })}
                      className={`btn ${current.gradingPasses === 1 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      ⚡ Chấm 1 Lần nhanh (Mặc định)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrent({ ...current, gradingPasses: 3 })}
                      className={`btn ${current.gradingPasses === 3 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      ⭐ Chấm 3 Lần (Triple-Pass)
                    </button>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.4 }}>
                    {current.gradingPasses === 1
                      ? 'Chấm 1 lượt nhanh theo barem chuẩn để có điểm ngay (Mặc định tiết kiệm & tốc độ cao).'
                      : 'Chấm 3 góc nhìn (Barem chuẩn + Phản biện soi lỗi + Sư phạm ghi nhận tư duy) rồi tổng hợp điểm chuẩn xác.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-settings for Queue & Consensus */}
            {current.gradingMode === 'triple_consensus' && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '14px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                }}
              >
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Giãn cách hàng đợi:
                  </label>
                  <select
                    className="input-field"
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    value={current.queueDelayMs ?? 2000}
                    onChange={(e) => setCurrent({ ...current, queueDelayMs: Number(e.target.value) })}
                  >
                    <option value={1500}>1.5 giây / bài</option>
                    <option value={2000}>2.0 giây / bài (Chuẩn)</option>
                    <option value={3000}>3.0 giây / bài</option>
                    <option value={4000}>4.0 giây / bài</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Ngưỡng dung sai chênh lệch:
                  </label>
                  <select
                    className="input-field"
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    value={current.consensusTolerance ?? 0.25}
                    onChange={(e) => setCurrent({ ...current, consensusTolerance: Number(e.target.value) })}
                  >
                    <option value={0.1}>&gt; 0.10 điểm (Rất khắt khe)</option>
                    <option value={0.25}>&gt; 0.25 điểm (Chuẩn sư phạm)</option>
                    <option value={0.5}>&gt; 0.50 điểm (Linh hoạt)</option>
                  </select>
                </div>

                {current.gradingMode === 'triple_consensus' && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Số lần chấm lại tối đa:
                    </label>
                    <select
                      className="input-field"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={current.maxRegradeRetries ?? 2}
                      onChange={(e) => setCurrent({ ...current, maxRegradeRetries: Number(e.target.value) })}
                    >
                      <option value={1}>1 lần</option>
                      <option value={2}>2 lần (Chuẩn)</option>
                      <option value={3}>3 lần</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Provider Switcher */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
            <label
              style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Cpu size={18} color="#c084fc" />
              Cấu Hình Nhà Cung Cấp AI: Qwen (OpenRouter)
            </label>

            {/* Provider Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '2px solid #a855f7',
                background: 'rgba(168, 85, 247, 0.16)',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="#c084fc" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                  Qwen AI (OpenRouter.ai)
                </span>
                <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.3)', color: '#e9d5ff', border: '1px solid #a855f7', fontSize: '0.68rem' }}>
                  Đang hoạt động ⭐
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#c084fc' }}>
                Hỗ trợ Vision Đọc Ảnh & Reasoning Tư Duy Sâu
              </span>
            </div>

            {/* Provider Details Sub-Panel */}
            <div
              style={{
                padding: '18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Reset to env.local helper banner */}
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  color: '#bae6fd',
                  gap: '10px',
                }}
              >
                <span>
                  💡 <strong>Gợi ý:</strong> Để trống ô API Key nếu muốn hệ thống tự động dùng <code>OPENROUTER_API_KEY</code> đã khai báo trong file <code>.env.local</code>.
                </span>
                {current.openrouterApiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent({
                        ...current,
                        openrouterApiKey: '',
                      });
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.74rem', flexShrink: 0 }}
                  >
                    Dùng .env.local
                  </button>
                )}
              </div>

              {/* QWEN OPENROUTER CONFIG */}
              <div>
                <label
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    marginBottom: '6px',
                    display: 'block',
                  }}
                >
                  Mô hình Qwen Chấm Bài (OpenRouter.ai):
                </label>
                <select
                  className="input-field"
                  value={isCustomOpenRouter ? 'custom' : (current.openrouterModel || 'qwen/qwen3.8-27b')}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomOpenRouter(true);
                    } else {
                      setIsCustomOpenRouter(false);
                      setCurrent({ ...current, openrouterModel: e.target.value });
                    }
                  }}
                >
                  <option value="qwen/qwen3.8-27b">
                    qwen/qwen3.8-27b (Mặc định Chấm bài & OCR ⭐ - Đọc ảnh & Suy luận CoT)
                  </option>
                  <option value="qwen/qwen3-vl-235b-a22b-instruct">
                    qwen/qwen3-vl-235b-a22b-instruct (Chuyên gia đọc ảnh OCR ⭐ - 235B MoE Vision)
                  </option>
                  <option value="qwen/qwen3.8-flash">
                    qwen/qwen3.8-flash (OCR & Suy luận siêu nhanh ⚡ - Paid)
                  </option>
                  <option value="qwen/qwen-2.5-vl-72b-instruct">
                    qwen/qwen-2.5-vl-72b-instruct (Thị giác & chữ viết tay 72B - Paid)
                  </option>
                  <option value="qwen/qwen-2.5-72b-instruct">
                    qwen/qwen-2.5-72b-instruct (Mô hình 72B mạnh mẽ, toàn diện)
                  </option>
                  <option value="qwen/qwq-32b-preview">
                    qwen/qwq-32b-preview (QwQ 32B - Chuyên gia suy luận logic toán học)
                  </option>
                  <option value="qwen/qwen-2.5-coder-32b-instruct">
                    qwen/qwen-2.5-coder-32b-instruct (Qwen 2.5 Coder 32B)
                  </option>
                  <option value="custom">-- Nhập tên model tùy chỉnh trên OpenRouter --</option>
                </select>

                {isCustomOpenRouter && (
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="Ví dụ: qwen/qwen3.8-27b hoặc qwen/qwen3-vl-235b-a22b-instruct"
                    value={current.openrouterModel || ''}
                    onChange={(e) => setCurrent({ ...current, openrouterModel: e.target.value })}
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Key size={14} color="#c084fc" />
                    OpenRouter API Key:
                  </label>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: '0.75rem',
                      color: '#c084fc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    Lấy key OpenRouter <ExternalLink size={12} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showOpenRouterKey ? 'text' : 'password'}
                    className="input-field font-mono"
                    value={current.openrouterApiKey || ''}
                    onChange={(e) => setCurrent({ ...current, openrouterApiKey: e.target.value })}
                    placeholder="sk-or-v1-..."
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {showOpenRouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Globe size={13} />
                  OpenRouter Base URL:
                </label>
                <input
                  type="text"
                  className="input-field font-mono"
                  value={current.openrouterBaseUrl || ''}
                  onChange={(e) => setCurrent({ ...current, openrouterBaseUrl: e.target.value })}
                  placeholder="https://openrouter.ai/api/v1"
                />
              </div>

              {/* Reasoning toggle */}
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(168, 85, 247, 0.08)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#f8fafc' }}>
                    🧠 Chế độ Tư Duy Sâu (Deep Reasoning / Chain-of-Thought)
                  </span>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                    Kích hoạt chuỗi suy luận từng bước cho Qwen 3.8 27B (<code>reasoning: &#123; effort: 'high' &#125;</code>). Khi chọn Chấm 3 Lần, hệ thống bắt buộc chạy chế độ tư duy sâu để thẩm định từng phép biến đổi toán học.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={current.openrouterReasoning !== false}
                  onChange={(e) =>
                    setCurrent({ ...current, openrouterReasoning: e.target.checked })
                  }
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#a855f7',
                    flexShrink: 0,
                  }}
                />
              </div>

              {renderPassSelector('openrouter', 'Qwen 3.8 27B (OpenRouter)')}

              {/* Qwen OCR & Vision helper notice */}
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  color: '#e9d5ff',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <Sparkles size={18} color="#c084fc" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ lineHeight: 1.5 }}>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                    Quy trình OCR chuyên sâu 3 lần kết hợp 3 model Qwen (OpenRouter Paid):
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: '#cbd5e1' }}>
                    <li><strong>Lần 1:</strong> <code>qwen/qwen3-vl-235b-a22b-instruct</code> (Đọc toàn diện & cấu trúc bài làm).</li>
                    <li><strong>Lần 2:</strong> <code>qwen/qwen3.8-27b</code> (Soi nét mực, điều kiện xác định $x \ge 0$, ký hiệu viết tay).</li>
                    <li><strong>Lần 3:</strong> <code>qwen/qwen3.8-flash</code> (Rà soát công thức toán học & logic biến đổi siêu tốc).</li>
                    <li><strong>Thẩm định & Verify:</strong> Đối chiếu lại cả 3 bản với ảnh gốc để xuất ra bản LaTeX chính xác tuyệt đối trước khi chấm điểm.</li>
                  </ul>
                </div>
              </div>

              {/* Security Hint */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.76rem',
                  color: '#34d399',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '10px',
                }}
              >
                <ShieldCheck size={14} />
                <span>Khóa API được lưu bảo mật trong trình duyệt hoặc file .env.local của bạn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary">
            Hủy
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
};

