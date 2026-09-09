'use client';

import React, { useState } from 'react';
import { X, Key, User, Sliders, Check, ShieldCheck, Cpu } from 'lucide-react';
import { TeacherSettings } from '@/types/grading';

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
  const [current, setCurrent] = useState<TeacherSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(current);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              Cài Đặt Sư Phạm & AI Model
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
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Teacher Persona */}
          <div>
            <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} color="#34d399" />
              Danh Xưng Giáo Viên (Xưng hô trong lời phê):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
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
            <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'block' }}>
              Mức Độ Chặt Chẽ Khi Chấm Bài:
            </label>
            <select
              className="input-field"
              value={current.strictness}
              onChange={(e) => setCurrent({ ...current, strictness: e.target.value as any })}
            >
              <option value="standard">Chuẩn kỳ thi (ĐGNL & Tốt nghiệp THPT)</option>
              <option value="strict">Khắt khe (Trừ điểm mạnh nếu thiếu điều kiện hoặc làm tắt)</option>
              <option value="encouraging">Khuyến khích & Động viên (Bỏ qua sơ suất nhỏ về trình bày)</option>
            </select>
          </div>

          {/* Gemini Model */}
          <div>
            <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="#06b6d4" />
              Mô Hình AI (Google Gemini):
            </label>
            <select
              className="input-field"
              value={current.model}
              onChange={(e) => setCurrent({ ...current, model: e.target.value })}
            >
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Khuyên dùng - Tốc độ cao & Mới nhất)</option>
              <option value="gemini-3.7-flash">Gemini 3.7 Flash (Tối ưu tư duy và nhận diện bài làm)</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Tốc độ phản hồi cực nhanh)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Tư duy toán học nâng cao)</option>
            </select>
          </div>

          {/* Gemini API Key */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={16} color="#fbbf24" />
              Google Gemini API Key:
            </label>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Nhập API Key để chấm bài với AI trực tiếp. Nếu để trống, hệ thống sẽ sử dụng bộ dữ liệu mẫu đối sánh chuẩn sư phạm.
            </p>
            <input
              type="password"
              className="input-field font-mono"
              value={current.geminiApiKey}
              onChange={(e) => setCurrent({ ...current, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.75rem', color: '#34d399' }}>
              <ShieldCheck size={14} />
              <span>Khóa API được lưu an toàn trên trình duyệt của bạn</span>
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
