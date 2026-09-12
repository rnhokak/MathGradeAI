'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  FileCheck2,
  BarChart2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { RubricManager } from '@/components/RubricManager';
import { SubmissionUploader } from '@/components/SubmissionUploader';
import { GradingStudio } from '@/components/GradingStudio';
import { ClassOverview } from '@/components/ClassOverview';
import { SettingsModal } from '@/components/SettingsModal';
import { RubricData, StudentSubmission, TeacherSettings, GradingResult } from '@/types/grading';

const DEFAULT_RUBRIC: RubricData = {
  title: 'Câu 1. Giải phương trình logarit chứa căn thức',
  problemStatement: 'Câu 1. Giải phương trình: log_5^2(x) + sqrt(log_5^2(x) + 1) - 3 = 0',
  totalPoints: 1.0,
  criteria: [
    {
      id: 'c1',
      name: 'Điều kiện xác định',
      points: 0.25,
      description: 'Điều kiện xác định: x > 0',
    },
    {
      id: 'c2',
      name: 'Đặt ẩn phụ & chuyển đổi phương trình',
      points: 0.25,
      description: 'Đặt ẩn phụ với điều kiện tương ứng, đưa về phương trình bậc 2',
    },
    {
      id: 'c3',
      name: 'Giải phương trình bậc hai theo ẩn phụ',
      points: 0.25,
      description: 'Giải ra nghiệm của ẩn phụ, đối chiếu điều kiện để loại/nhận nghiệm',
    },
    {
      id: 'c4',
      name: 'Tìm x và kết luận tập nghiệm',
      points: 0.25,
      description: 'Thay lại ẩn phụ tìm x, đối chiếu điều kiện ban đầu và kết luận tập nghiệm',
    },
  ],
};

const DEFAULT_SETTINGS: TeacherSettings = {
  role: 'thầy',
  teacherName: '',
  strictness: 'strict',
  provider: 'claude',
  gradingMode: 'triple_consensus',
  queueDelayMs: 2000,
  maxRegradeRetries: 2,
  consensusTolerance: 0.25,
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-6',
  claudeBaseUrl: 'https://api.anthropic.com/v1',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  openaiBaseUrl: 'https://api.openai.com/v1',
  model: 'gemini-3.8-flash',
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'rubric' | 'submissions' | 'studio' | 'overview'>('rubric');
  const [rubric, setRubric] = useState<RubricData>(DEFAULT_RUBRIC);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TeacherSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chambai_teacher_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.model === 'gemini-2.5-flash') {
          parsed.model = 'gemini-3.8-flash';
        }
        // Auto migrate legacy 404 Claude models
        const legacyClaudeModels = [
          'claude-3-7-sonnet-20250219',
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
        ];
        let claudeModel = parsed.claudeModel || DEFAULT_SETTINGS.claudeModel;
        if (legacyClaudeModels.includes(claudeModel)) {
          claudeModel = 'claude-sonnet-4-6';
        }

        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          gradingMode: parsed.gradingMode || 'triple_consensus',
          queueDelayMs: parsed.queueDelayMs ?? 2000,
          maxRegradeRetries: parsed.maxRegradeRetries ?? 2,
          consensusTolerance: parsed.consensusTolerance ?? 0.25,
          provider: parsed.provider || 'claude',
          geminiModel: parsed.geminiModel || parsed.model || DEFAULT_SETTINGS.geminiModel,
          claudeModel,
          openaiModel: parsed.openaiModel || DEFAULT_SETTINGS.openaiModel,
          claudeBaseUrl: parsed.claudeBaseUrl || DEFAULT_SETTINGS.claudeBaseUrl,
          openaiBaseUrl: parsed.openaiBaseUrl || DEFAULT_SETTINGS.openaiBaseUrl,
        });
      }
    } catch (e) {
      console.warn('Could not read settings from localStorage');
    }
  }, []);

  // Save settings
  const handleSaveSettings = (newSettings: TeacherSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('chambai_teacher_settings', JSON.stringify(newSettings));
      showToast('Đã lưu cấu hình giáo viên thành công!');
    } catch (e) {
      console.warn('Could not save settings to localStorage');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load sample data from /api/sample-data
  const handleLoadSampleData = async () => {
    setIsLoadingSample(true);
    try {
      const res = await fetch('/api/sample-data');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi nạp dữ liệu mẫu');

      if (data.rubric) {
        setRubric(data.rubric);
      }
      if (data.submissions && data.submissions.length > 0) {
        setSubmissions(data.submissions);
      }

      showToast('Đã nạp thành công Rubric mẫu và bài thi của Nga & Trang!');
      setActiveTab('submissions');
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi khi nạp file mẫu: ' + err.message);
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Select submission to view in studio
  const handleSelectSubmissionToView = (id: string) => {
    setSelectedSubmissionId(id);
    setActiveTab('studio');
  };

  // Update a grading result from studio
  const handleUpdateGradingResult = (updatedResult: GradingResult) => {
    if (!selectedSubmissionId) return;
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === selectedSubmissionId ? { ...s, gradingResult: updatedResult } : s
      )
    );
  };

  const selectedSubmission = submissions.find((s) => s.id === selectedSubmissionId);
  const gradedCount = submissions.filter((s) => s.status === 'done').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLoadSampleData={handleLoadSampleData}
        isLoadingSample={isLoadingSample}
      />

      {/* Main Container */}
      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px 24px 60px', flex: 1 }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div className="tabs-container">
            <button
              onClick={() => setActiveTab('rubric')}
              className={`tab-btn ${activeTab === 'rubric' ? 'active' : ''}`}
            >
              <FileText size={16} /> 1. Đề Bài & Rubric
            </button>

            <button
              onClick={() => setActiveTab('submissions')}
              className={`tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
            >
              <UploadCloud size={16} /> 2. Nạp Bài Làm ({submissions.length})
            </button>

            <button
              onClick={() => {
                if (submissions.some((s) => s.status === 'done')) {
                  const firstGraded = submissions.find((s) => s.status === 'done');
                  if (firstGraded && !selectedSubmissionId) {
                    setSelectedSubmissionId(firstGraded.id);
                  }
                  setActiveTab('studio');
                } else if (submissions.length > 0) {
                  setSelectedSubmissionId(submissions[0].id);
                  setActiveTab('studio');
                }
              }}
              disabled={submissions.length === 0}
              className={`tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
              style={{ opacity: submissions.length === 0 ? 0.5 : 1 }}
            >
              <FileCheck2 size={16} /> 3. Chi Tiết Bài Chấm {gradedCount > 0 && `(${gradedCount})`}
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              disabled={gradedCount === 0}
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              style={{ opacity: gradedCount === 0 ? 0.5 : 1 }}
            >
              <BarChart2 size={16} /> 4. Bảng Điểm Cả Lớp
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'rubric' && (
          <RubricManager
            rubric={rubric}
            settings={settings}
            onChangeRubric={setRubric}
            onNextStep={() => setActiveTab('submissions')}
          />
        )}

        {activeTab === 'submissions' && (
          <SubmissionUploader
            submissions={submissions}
            rubric={rubric}
            settings={settings}
            onUpdateSubmissions={setSubmissions}
            onSelectSubmissionToView={handleSelectSubmissionToView}
          />
        )}

        {activeTab === 'studio' && (
          selectedSubmission ? (
            <GradingStudio
              submission={selectedSubmission}
              rubric={rubric}
              settings={settings}
              onBackToList={() => setActiveTab('submissions')}
              onUpdateResult={handleUpdateGradingResult}
            />
          ) : (
            <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Vui lòng chọn một bài làm học sinh từ danh sách ở Bước 2.
              </p>
              <button
                onClick={() => setActiveTab('submissions')}
                className="btn btn-secondary"
                style={{ marginTop: '14px' }}
              >
                Chuyển đến danh sách bài làm &rarr;
              </button>
            </div>
          )
        )}

        {activeTab === 'overview' && (
          <ClassOverview
            submissions={submissions}
            onSelectStudent={(id) => {
              setSelectedSubmissionId(id);
              setActiveTab('studio');
            }}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 1000,
            fontSize: '0.9rem',
            fontWeight: 600,
            animation: 'scaleUp 0.2s ease-out',
          }}
        >
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
