'use client';

import React from 'react';
import { Sparkles, Settings, UserCheck, BookOpen, GraduationCap, Zap, Bot, Layers, Cpu } from 'lucide-react';
import { TeacherSettings } from '@/types/grading';

interface HeaderProps {
  settings: TeacherSettings;
  onOpenSettings: () => void;
  onLoadSampleData: () => void;
  isLoadingSample: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onOpenSettings,
  onLoadSampleData,
  isLoadingSample,
}) => {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Brand & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
            }}
          >
            <GraduationCap size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                MathGrade <span className="text-gradient">AI</span>
              </h1>
              {settings.gradingMode === 'triple_consensus' ? (
                <span
                  className="badge badge-indigo"
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(99, 102, 241, 0.25)',
                    border: '1px solid #6366f1',
                    color: '#e0e7ff',
                  }}
                  onClick={onOpenSettings}
                  title="Chế độ chấm đa model đối chiếu (Gemini + Claude + GPT-4o)"
                >
                  <Layers size={11} /> Đa Model Đối Chiếu (3 AI)
                </span>
              ) : settings.provider === 'alibabacloud' ? (
                <span
                  className="badge"
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(234, 88, 12, 0.25)',
                    color: '#ffedd5',
                    border: '1px solid #ea580c',
                  }}
                  onClick={onOpenSettings}
                  title={`Alibaba Cloud Model Studio: ${settings.alibabacloudModel || 'qwen-plus-character'} • ${(settings.modelPasses?.alibabacloud ?? 3) === 3 ? 'Chấm 3 lần (Triple-Pass)' : 'Chấm 1 lần'}`}
                >
                  <Cpu size={11} /> Qwen Alibaba {(settings.modelPasses?.alibabacloud ?? 3) === 3 ? '3 Lần (⭐)' : '1 Lần'}
                </span>
              ) : settings.provider === 'openrouter' ? (
                <span
                  className="badge"
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(168, 85, 247, 0.25)',
                    color: '#e9d5ff',
                    border: '1px solid #a855f7',
                  }}
                  onClick={onOpenSettings}
                  title={`OpenRouter: ${settings.openrouterModel || 'qwen/qwen3.8-flash'} • ${(settings.modelPasses?.openrouter ?? 3) === 3 ? 'Chấm 3 lần (Triple-Pass)' : 'Chấm 1 lần'}`}
                >
                  <Cpu size={11} /> Qwen OpenRouter {(settings.modelPasses?.openrouter ?? 3) === 3 ? '3 Lần (⭐)' : '1 Lần'}
                </span>
              ) : settings.provider === 'claude' ? (
                <span
                  className="badge badge-amber"
                  style={{
                    cursor: 'pointer',
                    background: (settings.modelPasses?.claude ?? 3) === 3
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.25))'
                      : 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid #f59e0b',
                    color: '#fef3c7',
                  }}
                  onClick={onOpenSettings}
                  title={`Claude API: ${settings.claudeModel || 'Claude Opus 5'} • ${(settings.modelPasses?.claude ?? 3) === 3 ? 'Chấm 3 lần (Triple-Pass)' : 'Chấm 1 lần'}`}
                >
                  <Bot size={11} /> Claude {(settings.modelPasses?.claude ?? 3) === 3 ? '3 Lần (⭐)' : '1 Lần'}
                </span>
              ) : settings.provider === 'openai' ? (
                <span
                  className="badge badge-emerald"
                  style={{ cursor: 'pointer' }}
                  onClick={onOpenSettings}
                  title={`OpenAI: ${settings.openaiModel || 'GPT-4o'} • ${(settings.modelPasses?.openai ?? 3) === 3 ? 'Chấm 3 lần (Triple-Pass)' : 'Chấm 1 lần'}`}
                >
                  <Layers size={11} /> OpenAI {(settings.modelPasses?.openai ?? 3) === 3 ? '3 Lần (⭐)' : '1 Lần'}
                </span>
              ) : (
                <span
                  className="badge badge-indigo"
                  style={{ cursor: 'pointer' }}
                  onClick={onOpenSettings}
                  title={`Gemini: ${settings.geminiModel || settings.model || 'Gemini 3.8'} • ${(settings.modelPasses?.gemini ?? 3) === 3 ? 'Chấm 3 lần (Triple-Pass)' : 'Chấm 1 lần'}`}
                >
                  <Sparkles size={11} /> Gemini {(settings.modelPasses?.gemini ?? 3) === 3 ? '3 Lần (⭐)' : '1 Lần'}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Chấm bài tự luận môn Toán & Lời phê sư phạm chuẩn mực
            </p>
          </div>
        </div>

        {/* Action Controls & Teacher Persona */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Quick Load Sample Data Button */}
          <button
            onClick={onLoadSampleData}
            disabled={isLoadingSample}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 14px',
              borderColor: 'rgba(99, 102, 241, 0.4)',
              background: 'rgba(99, 102, 241, 0.1)',
            }}
            title="Nạp nhanh 1 Rubric mẫu và 2 bài làm viết tay của học sinh Nga & Trang"
          >
            <Zap size={15} color="#818cf8" />
            {isLoadingSample ? 'Đang nạp file mẫu...' : 'Nạp bài mẫu (Nga & Trang)'}
          </button>

          {/* Teacher Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
            }}
          >
            <UserCheck size={16} color="#34d399" />
            <span style={{ color: 'var(--text-secondary)' }}>Xưng hô:</span>
            <strong style={{ color: '#f8fafc', textTransform: 'capitalize' }}>
              {settings.role === 'cô' ? 'Cô' : 'Thầy'}{' '}
              {settings.teacherName ? `(${settings.teacherName})` : ''} - Em
            </strong>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            title="Cài đặt API Key & Tùy chọn Sư phạm"
          >
            <Settings size={16} />
            Cài đặt
          </button>
        </div>
      </div>
    </header>
  );
};
