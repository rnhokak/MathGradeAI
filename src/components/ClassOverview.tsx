'use client';

import React from 'react';
import { Users, BarChart3, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { StudentSubmission } from '@/types/grading';

interface ClassOverviewProps {
  submissions: StudentSubmission[];
  onSelectStudent: (id: string) => void;
}

export const ClassOverview: React.FC<ClassOverviewProps> = ({
  submissions,
  onSelectStudent,
}) => {
  const gradedList = submissions
    .filter((s) => s.status === 'done' && s.gradingResult)
    .filter((sub, index, self) => index === self.findIndex((s) => s.id === sub.id));

  if (gradedList.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
        <Users size={40} color="#94a3b8" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
          Chưa có bài nào được chấm xong
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Hãy chuyển sang bước 2 "Nạp Bài Làm" và bấm "Chấm tất cả bài" để xem bảng tổng hợp cả lớp.
        </p>
      </div>
    );
  }

  // Calculate statistics
  const totalScore = gradedList.reduce((sum, s) => sum + (s.gradingResult?.score || 0), 0);
  const avgScore = (totalScore / gradedList.length).toFixed(2);
  const maxScorePossible = gradedList[0]?.gradingResult?.maxScore || 1.0;

  // Export to CSV
  const exportCsv = () => {
    let csv = 'Họ và tên,Tên file,Điểm đạt,Điểm tối đa,Đánh giá,Lời phê của giáo viên\n';
    gradedList.forEach((s) => {
      const r = s.gradingResult!;
      const commentSafe = `"${(r.teacherComment || '').replace(/"/g, '""')}"`;
      csv += `"${r.studentName}","${s.fileName}",${r.score},${r.maxScore},"${r.percentage}%",${commentSafe}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_Diem_Lop_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            SỐ BÀI ĐÃ CHẤM
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
            {gradedList.length} / {submissions.length}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            ĐIỂM TRUNG BÌNH LỚP
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            {avgScore} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {maxScorePossible}đ</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            TỶ LỆ ĐẠT ĐIỂM TỐI ĐA
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#818cf8', marginTop: '4px' }}>
            {Math.round(
              (gradedList.filter((s) => s.gradingResult?.score === maxScorePossible).length /
                gradedList.length) *
                100
            )}
            %
          </div>
        </div>
      </div>

      {/* Class Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#06b6d4" />
            Bảng Tổng Hợp Điểm Cả Lớp
          </h3>
          <button onClick={exportCsv} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            <Download size={15} /> Xuất Bảng Điểm (CSV / Excel)
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>STT</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Họ và Tên Học Sinh</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>Điểm Số</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Ưu Điểm Nổi Bật</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {gradedList.map((sub, i) => {
                const r = sub.gradingResult!;
                return (
                  <tr
                    key={`${sub.id}-${i}`}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      cursor: 'pointer',
                    }}
                    onClick={() => onSelectStudent(sub.id)}
                  >
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>
                      {r.studentName}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        className="badge badge-emerald"
                        style={{ fontSize: '0.85rem', fontWeight: 700 }}
                      >
                        {r.score} / {r.maxScore}đ
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '380px' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.strengths[0] || 'Làm bài hoàn chỉnh'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStudent(sub.id);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      >
                        Xem bài &rarr;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
