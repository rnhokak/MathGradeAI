'use client';

import React, { useState } from 'react';
import { FileText, Upload, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { RubricData, RubricCriterion, TeacherSettings } from '@/types/grading';
import { parseRubricFromTablesAndText } from '@/utils/rubricParser';

interface RubricManagerProps {
  rubric: RubricData;
  settings?: TeacherSettings;
  onChangeRubric: (rubric: RubricData) => void;
  onNextStep: () => void;
}

export const RubricManager: React.FC<RubricManagerProps> = ({
  rubric,
  settings,
  onChangeRubric,
  onNextStep,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handle docx upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {
        'x-ai-provider': settings?.provider || 'claude',
      };
      if (settings?.geminiApiKey) headers['x-gemini-api-key'] = settings.geminiApiKey;
      if (settings?.claudeApiKey) headers['x-claude-api-key'] = settings.claudeApiKey;
      if (settings?.openaiApiKey) headers['x-openai-api-key'] = settings.openaiApiKey;
      if (settings?.geminiModel) headers['x-gemini-model'] = settings.geminiModel;
      if (settings?.claudeModel) headers['x-claude-model'] = settings.claudeModel;
      if (settings?.openaiModel) headers['x-openai-model'] = settings.openaiModel;
      if (settings?.claudeBaseUrl) headers['x-claude-base-url'] = settings.claudeBaseUrl;
      if (settings?.openaiBaseUrl) headers['x-openai-base-url'] = settings.openaiBaseUrl;

      // Try the specialized /api/parse-rubric first (which auto-detects tables & AI)
      let rubricResult: RubricData | null = null;
      let usedMode = '';

      try {
        const res = await fetch('/api/parse-rubric', {
          method: 'POST',
          headers,
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.success && data.rubric) {
          rubricResult = data.rubric;
          usedMode = data.mode || 'ai';
        }
      } catch (rubricErr) {
        console.warn('Direct parse-rubric failed, falling back to docx extraction:', rubricErr);
      }

      // If parse-rubric didn't succeed, fallback to parse-docx + client heuristic parser
      if (!rubricResult) {
        const docxRes = await fetch('/api/parse-docx', {
          method: 'POST',
          body: formData,
        });

        const docxData = await docxRes.json();
        if (!docxRes.ok) throw new Error(docxData.error || 'Lỗi khi phân tích file docx');

        rubricResult = parseRubricFromTablesAndText(
          docxData.tables || [],
          docxData.text || '',
          file.name
        );
        usedMode = 'heuristic';
      }

      if (rubricResult) {
        onChangeRubric(rubricResult);
        const modeText =
          usedMode === 'claude'
            ? 'Claude AI'
            : usedMode === 'openai'
            ? 'OpenAI API'
            : usedMode === 'gemini'
            ? 'Gemini AI'
            : 'bộ nhận diện bảng thông minh';
        showSuccess(
          `Đã tải và bóc tách thành công ${rubricResult.criteria.length} tiêu chí chấm (${rubricResult.totalPoints}đ) bằng ${modeText}!`
        );
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Lỗi khi tải hoặc bóc tách file Word.');
    } finally {
      setIsUploading(false);
      // Reset input value so re-selecting the same file fires onChange
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Re-analyze existing text with AI
  const handleAiReAnalyze = async () => {
    const textToAnalyze = rubric.rawText || rubric.problemStatement;
    if (!textToAnalyze || textToAnalyze.trim().length < 10) {
      setUploadError('Chưa có đủ nội dung đề bài / đáp án để AI phân tích. Vui lòng tải file hoặc nhập đề bài.');
      return;
    }

    setIsAiAnalyzing(true);
    setUploadError(null);

    try {
      const activeProvider = settings?.provider || 'claude';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-ai-provider': activeProvider,
      };
      if (settings?.geminiApiKey) headers['x-gemini-api-key'] = settings.geminiApiKey;
      if (settings?.claudeApiKey) headers['x-claude-api-key'] = settings.claudeApiKey;
      if (settings?.openaiApiKey) headers['x-openai-api-key'] = settings.openaiApiKey;
      if (settings?.geminiModel) headers['x-gemini-model'] = settings.geminiModel;
      if (settings?.claudeModel) headers['x-claude-model'] = settings.claudeModel;
      if (settings?.openaiModel) headers['x-openai-model'] = settings.openaiModel;
      if (settings?.claudeBaseUrl) headers['x-claude-base-url'] = settings.claudeBaseUrl;
      if (settings?.openaiBaseUrl) headers['x-openai-base-url'] = settings.openaiBaseUrl;

      const res = await fetch('/api/parse-rubric', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: textToAnalyze,
          fileName: rubric.title,
          provider: activeProvider,
          model:
            activeProvider === 'claude'
              ? settings?.claudeModel
              : activeProvider === 'openai'
              ? settings?.openaiModel
              : settings?.geminiModel,
          baseUrl:
            activeProvider === 'claude'
              ? settings?.claudeBaseUrl
              : activeProvider === 'openai'
              ? settings?.openaiBaseUrl
              : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Lỗi khi phân tích lại bằng AI');

      if (data.rubric) {
        onChangeRubric(data.rubric);
        showSuccess(`AI đã chuẩn hóa lại ${data.rubric.criteria.length} tiêu chí chấm!`);
      }
    } catch (err: any) {
      setUploadError('Lỗi phân tích AI: ' + (err.message || err));
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Add new criterion
  const addCriterion = () => {
    const newId = `crit-${Date.now()}`;
    const updated = [
      ...rubric.criteria,
      {
        id: newId,
        name: `Ý ${rubric.criteria.length + 1}`,
        points: 0.25,
        description: 'Mô tả yêu cầu và cách cho điểm...',
      },
    ];
    const newTotal = updated.reduce((sum, c) => sum + c.points, 0);
    onChangeRubric({
      ...rubric,
      criteria: updated,
      totalPoints: Number(newTotal.toFixed(2)),
    });
  };

  // Remove criterion
  const removeCriterion = (id: string) => {
    const updated = rubric.criteria.filter((c) => c.id !== id);
    const newTotal = updated.reduce((sum, c) => sum + c.points, 0);
    onChangeRubric({
      ...rubric,
      criteria: updated,
      totalPoints: Number(newTotal.toFixed(2)),
    });
  };

  // Update criterion field
  const updateCriterion = (id: string, field: keyof RubricCriterion, value: any) => {
    const updated = rubric.criteria.map((c) => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    });
    const newTotal = updated.reduce((sum, c) => sum + Number(c.points || 0), 0);
    onChangeRubric({
      ...rubric,
      criteria: updated,
      totalPoints: Number(newTotal.toFixed(2)),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Upload Zone */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#818cf8" />
              Đề Bài & Thang Điểm Rubric
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Tải file Word Rubric (.docx) để hệ thống tự động bóc tách đề bài, công thức MathType và các ý chấm điểm.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* AI Re-analyze button */}
            <button
              type="button"
              onClick={handleAiReAnalyze}
              disabled={isAiAnalyzing || isUploading}
              className="btn btn-secondary"
              title="Yêu cầu Gemini AI phân tích lại đề bài và cấu trúc tiêu chí"
            >
              <Sparkles size={16} color="#fbbf24" />
              {isAiAnalyzing ? 'AI đang phân tích...' : 'Phân tích lại bằng AI'}
            </button>

            {/* Docx Upload Button */}
            <label className="btn btn-primary" style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
              <Upload size={16} />
              {isUploading ? 'Đang đọc file Word...' : 'Tải lên Rubric (.docx)'}
              <input
                type="file"
                accept=".docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={isUploading || isAiAnalyzing}
              />
            </label>
          </div>
        </div>

        {uploadError && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} />
            {uploadError}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {/* Title input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Tên đề bài / Tiêu đề:
          </label>
          <input
            type="text"
            className="input-field"
            value={rubric.title}
            onChange={(e) => onChangeRubric({ ...rubric, title: e.target.value })}
            placeholder="Ví dụ: Câu 1. Giải phương trình logarit..."
            style={{ fontWeight: 600 }}
          />
        </div>

        {/* Problem Statement Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Nội dung câu hỏi / Đề bài và Đáp án mẫu:
          </label>
          <textarea
            className="textarea-field font-mono"
            rows={4}
            value={rubric.problemStatement}
            onChange={(e) => onChangeRubric({ ...rubric, problemStatement: e.target.value })}
            placeholder="Nhập đề bài hoặc công thức toán học cần giải..."
          />
        </div>
      </div>

      {/* Criteria Breakdown Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Bảng Tiêu Chí Điểm Chi Tiết ({rubric.criteria.length} ý)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Mỗi bước làm được tính điểm riêng lẻ giúp AI nhận xét chính xác phần học sinh làm được.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              className="badge badge-emerald"
              style={{ fontSize: '0.9rem', padding: '6px 14px' }}
            >
              Tổng điểm: {rubric.totalPoints}đ
            </span>
            <button onClick={addCriterion} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              <Plus size={15} /> Thêm ý chấm
            </button>
          </div>
        </div>

        {/* Criteria List */}
        {rubric.criteria.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '14px' }}>
              Chưa có tiêu chí chấm nào. Vui lòng tải file Word Rubric hoặc thêm thủ công.
            </p>
            <button onClick={addCriterion} className="btn btn-secondary">
              <Plus size={15} /> Thêm ý chấm đầu tiên
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rubric.criteria.map((crit, index) => (
              <div
                key={crit.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 180px 90px 1fr 40px',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
                  #{index + 1}
                </span>

                {/* Criterion Name */}
                <input
                  type="text"
                  className="input-field"
                  value={crit.name}
                  onChange={(e) => updateCriterion(crit.id, 'name', e.target.value)}
                  placeholder="Tên bước / ý chấm"
                  style={{ fontWeight: 600 }}
                />

                {/* Points */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="10"
                    className="input-field"
                    value={crit.points}
                    onChange={(e) => updateCriterion(crit.id, 'points', parseFloat(e.target.value) || 0)}
                    style={{ textAlign: 'right', paddingRight: '26px', color: '#34d399', fontWeight: 700 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    đ
                  </span>
                </div>

                {/* Description */}
                <input
                  type="text"
                  className="input-field font-mono"
                  value={crit.description}
                  onChange={(e) => updateCriterion(crit.id, 'description', e.target.value)}
                  placeholder="Yêu cầu cụ thể của bước này (ví dụ: x > 0 hoặc đặt t >= 0)"
                />

                {/* Delete button */}
                <button
                  onClick={() => removeCriterion(crit.id)}
                  className="btn btn-danger"
                  style={{ padding: '8px', borderRadius: 'var(--radius-sm)' }}
                  title="Xóa ý này"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Next Action */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onNextStep} className="btn btn-primary" style={{ padding: '12px 24px' }}>
            Tiếp tục: Nạp bài làm học sinh &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
