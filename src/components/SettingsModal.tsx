'use client';

import React, { useState } from 'react';
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
    provider: settings.provider || 'claude',
    strictness: settings.strictness || 'strict',
    gradingMode: settings.gradingMode || 'triple_consensus',
    queueDelayMs: settings.queueDelayMs ?? 2000,
    maxRegradeRetries: settings.maxRegradeRetries ?? 2,
    consensusTolerance: settings.consensusTolerance ?? 0.25,
    geminiModel: settings.geminiModel || settings.model || 'gemini-3.8-flash',
    claudeModel: settings.claudeModel || 'claude-sonnet-4-6',
    openaiModel: settings.openaiModel || 'gpt-4o',
    claudeBaseUrl: settings.claudeBaseUrl || 'https://api.anthropic.com/v1',
    openaiBaseUrl: settings.openaiBaseUrl || 'https://api.openai.com/v1',
  });

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);

  // Custom model flags
  const [isCustomGemini, setIsCustomGemini] = useState(
    !['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-pro'].includes(
      current.geminiModel
    )
  );
  const [isCustomClaude, setIsCustomClaude] = useState(
    ![
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251101',
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-fable-5-1',
    ].includes(current.claudeModel)
  );
  const [isCustomOpenAI, setIsCustomOpenAI] = useState(
    !['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'gpt-4-turbo'].includes(current.openaiModel)
  );

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Option 1: 3 Models Consensus */}
              <button
                type="button"
                onClick={() => setCurrent({ ...current, gradingMode: 'triple_consensus' })}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border:
                    current.gradingMode === 'triple_consensus'
                      ? '2px solid #818cf8'
                      : '1px solid var(--border-subtle)',
                  background:
                    current.gradingMode === 'triple_consensus'
                      ? 'rgba(99, 102, 241, 0.16)'
                      : 'rgba(255, 255, 255, 0.03)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow:
                    current.gradingMode === 'triple_consensus'
                      ? '0 0 16px rgba(99, 102, 241, 0.25)'
                      : 'none',
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
                    <Layers size={16} color="#818cf8" />
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
                      Đối Chiếu 3 Model AI
                    </span>
                  </div>
                  <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                    Khuyên dùng
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Chạy song song <strong>Gemini + Claude + GPT-4o</strong> cùng prompt & rubric. Tự động so sánh và <strong>tự động chấm lại</strong> nếu phát hiện lệch điểm để kết quả luôn công tâm, chính xác nhất.
                </p>
              </button>

              {/* Option 2: Single Model */}
              <button
                type="button"
                onClick={() => setCurrent({ ...current, gradingMode: 'single' })}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border:
                    current.gradingMode === 'single'
                      ? '2px solid #06b6d4'
                      : '1px solid var(--border-subtle)',
                  background:
                    current.gradingMode === 'single'
                      ? 'rgba(6, 182, 212, 0.16)'
                      : 'rgba(255, 255, 255, 0.03)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Bot size={16} color="#06b6d4" />
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
                    Chấm 1 Model duy nhất
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Chỉ gọi 1 nhà cung cấp đã chọn bên dưới (tiết kiệm token, phản hồi nhanh hơn).
                </p>
              </button>
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
                  gridTemplateColumns: 'repeat(3, 1fr)',
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
                    Ngưỡng lệch điểm chấm lại:
                  </label>
                  <select
                    className="input-field"
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    value={current.consensusTolerance ?? 0.25}
                    onChange={(e) => setCurrent({ ...current, consensusTolerance: Number(e.target.value) })}
                  >
                    <option value={0.1}>&gt; 0.10 điểm (Rất nhạy)</option>
                    <option value={0.25}>&gt; 0.25 điểm (Chuẩn)</option>
                    <option value={0.5}>&gt; 0.50 điểm (Thoáng)</option>
                  </select>
                </div>

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
              <Cpu size={18} color="#818cf8" />
              {current.gradingMode === 'triple_consensus'
                ? 'Cấu Hình 3 Model & API Key:'
                : 'Chọn Nhà Cung Cấp AI Chấm Bài:'}
            </label>

            {/* Provider Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              {/* Google Gemini Tab */}
              <button
                type="button"
                onClick={() => handleProviderSelect('gemini')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  border:
                    current.provider === 'gemini'
                      ? '2px solid #06b6d4'
                      : '1px solid var(--border-subtle)',
                  background:
                    current.provider === 'gemini'
                      ? 'rgba(6, 182, 212, 0.15)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow:
                    current.provider === 'gemini' ? '0 0 16px rgba(6, 182, 212, 0.25)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#06b6d4" />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Google Gemini</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>3.8 / 3.7 Flash</span>
                {current.provider === 'gemini' && (
                  <span className="badge badge-indigo" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    Đang chọn
                  </span>
                )}
              </button>

              {/* Anthropic Claude Tab */}
              <button
                type="button"
                onClick={() => handleProviderSelect('claude')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  border:
                    current.provider === 'claude'
                      ? '2px solid #f59e0b'
                      : '1px solid var(--border-subtle)',
                  background:
                    current.provider === 'claude'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow:
                    current.provider === 'claude' ? '0 0 16px rgba(245, 158, 11, 0.25)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bot size={16} color="#f59e0b" />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Claude API</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>3.7 / 3.5 Sonnet</span>
                {current.provider === 'claude' && (
                  <span className="badge badge-amber" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    Đang chọn
                  </span>
                )}
              </button>

              {/* OpenAI / OpenAPI Tab */}
              <button
                type="button"
                onClick={() => handleProviderSelect('openai')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  border:
                    current.provider === 'openai'
                      ? '2px solid #10b981'
                      : '1px solid var(--border-subtle)',
                  background:
                    current.provider === 'openai'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow:
                    current.provider === 'openai' ? '0 0 16px rgba(16, 185, 129, 0.25)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} color="#10b981" />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>OpenAI (OpenAPI)</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>GPT-4o / o3-mini</span>
                {current.provider === 'openai' && (
                  <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    Đang chọn
                  </span>
                )}
              </button>
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
                  💡 <strong>Gợi ý:</strong> Để trống các ô API Key nếu muốn hệ thống tự động dùng các API Key chuẩn đã khai báo sẵn trong file <code>.env.local</code>.
                </span>
                {(current.geminiApiKey || current.claudeApiKey || current.openaiApiKey) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent({
                        ...current,
                        geminiApiKey: '',
                        claudeApiKey: '',
                        openaiApiKey: '',
                      });
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.74rem', flexShrink: 0 }}
                  >
                    Xóa key trình duyệt (Dùng .env.local)
                  </button>
                )}
              </div>

              {/* 1. GEMINI CONFIG */}
              {current.provider === 'gemini' && (
                <>
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
                      Mô hình Gemini:
                    </label>
                    <select
                      className="input-field"
                      value={isCustomGemini ? 'custom' : current.geminiModel}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setIsCustomGemini(true);
                        } else {
                          setIsCustomGemini(false);
                          setCurrent({ ...current, geminiModel: e.target.value });
                        }
                      }}
                    >
                      <option value="gemini-3.8-flash">
                        Gemini 3.8 Flash (Khuyên dùng - Tốc độ cao & Mới nhất)
                      </option>
                      <option value="gemini-3.7-flash">
                        Gemini 3.7 Flash (Tối ưu tư duy và nhận diện bài làm)
                      </option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Phản hồi cực nhanh)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Tư duy toán học nâng cao)</option>
                      <option value="custom">-- Nhập tên model tùy chỉnh --</option>
                    </select>

                    {isCustomGemini && (
                      <input
                        type="text"
                        className="input-field font-mono"
                        placeholder="Ví dụ: gemini-3.8-flash"
                        value={current.geminiModel}
                        onChange={(e) => setCurrent({ ...current, geminiModel: e.target.value })}
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
                        <Key size={14} color="#fbbf24" />
                        Google Gemini API Key:
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.75rem',
                          color: '#38bdf8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none',
                        }}
                      >
                        Lấy key miễn phí <ExternalLink size={12} />
                      </a>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        className="input-field font-mono"
                        value={current.geminiApiKey}
                        onChange={(e) => setCurrent({ ...current, geminiApiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
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
                        {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 2. CLAUDE CONFIG */}
              {current.provider === 'claude' && (
                <>
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
                      Mô hình Claude:
                    </label>
                    <select
                      className="input-field"
                      value={isCustomClaude ? 'custom' : current.claudeModel}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setIsCustomClaude(true);
                        } else {
                          setIsCustomClaude(false);
                          setCurrent({ ...current, claudeModel: e.target.value });
                        }
                      }}
                    >
                      <option value="claude-sonnet-4-6">
                        Claude Sonnet 4.6 (Khuyên dùng - Chuẩn xác, chi tiết & nhận diện chữ viết tay tốt nhất)
                      </option>
                      <option value="claude-opus-4-6">
                        Claude Opus 4.6 (Lập luận & Suy luận toán học chuyên sâu nhất)
                      </option>
                      <option value="claude-haiku-4-5-20251001">
                        Claude Haiku 4.5 (Tốc độ cao & Tiết kiệm chi phí)
                      </option>
                      <option value="claude-sonnet-5">
                        Claude Sonnet 5
                      </option>
                      <option value="claude-opus-5">
                        Claude Opus 5
                      </option>
                      <option value="claude-sonnet-4-5-20250929">
                        Claude Sonnet 4.5
                      </option>
                      <option value="claude-opus-4-5-20251101">
                        Claude Opus 4.5
                      </option>
                      <option value="custom">-- Nhập tên model Claude tùy chỉnh --</option>
                    </select>

                    {isCustomClaude && (
                      <input
                        type="text"
                        className="input-field font-mono"
                        placeholder="Ví dụ: claude-sonnet-4-6"
                        value={current.claudeModel}
                        onChange={(e) => setCurrent({ ...current, claudeModel: e.target.value })}
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
                        <Key size={14} color="#f59e0b" />
                        Anthropic Claude API Key:
                      </label>
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.75rem',
                          color: '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none',
                        }}
                      >
                        Lấy key Anthropic <ExternalLink size={12} />
                      </a>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showClaudeKey ? 'text' : 'password'}
                        className="input-field font-mono"
                        value={current.claudeApiKey || ''}
                        onChange={(e) => setCurrent({ ...current, claudeApiKey: e.target.value })}
                        placeholder="sk-ant-api03-..."
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowClaudeKey(!showClaudeKey)}
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
                        {showClaudeKey ? <EyeOff size={16} /> : <Eye size={16} />}
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
                      Claude Base URL (Tùy chọn - mặc định: https://api.anthropic.com/v1):
                    </label>
                    <input
                      type="text"
                      className="input-field font-mono"
                      value={current.claudeBaseUrl || ''}
                      onChange={(e) => setCurrent({ ...current, claudeBaseUrl: e.target.value })}
                      placeholder="https://api.anthropic.com/v1"
                    />
                  </div>
                </>
              )}

              {/* 3. OPENAI / OPENAPI CONFIG */}
              {current.provider === 'openai' && (
                <>
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
                      Mô hình OpenAI / OpenAPI:
                    </label>
                    <select
                      className="input-field"
                      value={isCustomOpenAI ? 'custom' : current.openaiModel}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setIsCustomOpenAI(true);
                        } else {
                          setIsCustomOpenAI(false);
                          setCurrent({ ...current, openaiModel: e.target.value });
                        }
                      }}
                    >
                      <option value="gpt-4o">
                        GPT-4o (Khuyên dùng - Đa phương thức xuất sắc đọc chữ viết tay)
                      </option>
                      <option value="gpt-4o-mini">
                        GPT-4o Mini (Phản hồi nhanh, chi phí siêu tiết kiệm)
                      </option>
                      <option value="o3-mini">o3-mini (Tư duy suy luận logic toán học sâu)</option>
                      <option value="o1">o1 (Mô hình suy luận cao cấp)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo Vision</option>
                      <option value="custom">-- Nhập tên model tùy chỉnh / OpenRouter / DeepSeek --</option>
                    </select>

                    {isCustomOpenAI && (
                      <input
                        type="text"
                        className="input-field font-mono"
                        placeholder="Ví dụ: gpt-4o hoặc deepseek-chat hoặc anthropic/claude-3.5-sonnet"
                        value={current.openaiModel}
                        onChange={(e) => setCurrent({ ...current, openaiModel: e.target.value })}
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
                        <Key size={14} color="#10b981" />
                        OpenAI API Key:
                      </label>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.75rem',
                          color: '#34d399',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none',
                        }}
                      >
                        Lấy key OpenAI <ExternalLink size={12} />
                      </a>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showOpenAIKey ? 'text' : 'password'}
                        className="input-field font-mono"
                        value={current.openaiApiKey || ''}
                        onChange={(e) => setCurrent({ ...current, openaiApiKey: e.target.value })}
                        placeholder="sk-..."
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenAIKey(!showOpenAIKey)}
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
                        {showOpenAIKey ? <EyeOff size={16} /> : <Eye size={16} />}
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
                      OpenAI Base URL (Hỗ trợ chuẩn OpenAPI / OpenRouter / OneAPI / DeepSeek):
                    </label>
                    <input
                      type="text"
                      className="input-field font-mono"
                      value={current.openaiBaseUrl || ''}
                      onChange={(e) => setCurrent({ ...current, openaiBaseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                    />
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
                      Mặc định là <code>https://api.openai.com/v1</code>. Có thể đổi sang OpenRouter (<code>https://openrouter.ai/api/v1</code>) hoặc proxy tùy ý.
                    </p>
                  </div>
                </>
              )}

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

