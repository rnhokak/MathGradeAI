import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MathGrade AI - Hệ Thống Chấm Bài Tự Luận Môn Toán Bằng AI',
  description:
    'Ứng dụng chấm bài tự luận môn Toán bằng AI với thang điểm rubric, nhận diện chữ viết tay tiếng Việt từ file Word và ảnh, nhận xét chuẩn sư phạm với đầy đủ Ưu điểm, Nhược điểm, hướng dẫn sửa bài và kiến thức ôn tập.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
