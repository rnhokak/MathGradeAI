'use client';

import React from 'react';
import { Sparkles, Settings, UserCheck, BookOpen, GraduationCap, Zap, Bot, Layers } from 'lucide-react';
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
              {settings.provider === 'claude' ? (
                <span
                  className="badge badge-amber"
                  style={{ cursor: 'pointer' }}
                  onClick={onOpenSettings}
                  title="Bấm để cấu hình Claude API"
                >
                  <Bot size={11} /> {settings.claudeModel || 'Claude 3.7'}
                </span>
              ) : settings.provider === 'openai' ? (
                <span
                  className="badge badge-emerald"
                  style={{ cursor: 'pointer' }}
                  onClick={onOpenSettings}
                  title="Bấm để cấu hình OpenAI API"
                >
                  <Layers size={11} /> {settings.openaiModel || 'GPT-4o'}
                </span>
              ) : (
                <span
                  className="badge badge-indigo"
                  style={{ cursor: 'pointer' }}
                  onClick={onOpenSettings}
                  title="Bấm để cấu hình Gemini API"
                >
                  <Sparkles size={11} /> {settings.geminiModel || settings.model || 'Gemini 3.8'}
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
