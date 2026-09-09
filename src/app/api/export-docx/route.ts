import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Packer,
} from 'docx';
import { GradingResult } from '@/types/grading';

export async function POST(req: NextRequest) {
  try {
    const { gradingResult, teacherRole, teacherName }: {
      gradingResult: GradingResult;
      teacherRole?: string;
      teacherName?: string;
    } = await req.json();

    if (!gradingResult) {
      return NextResponse.json({ error: 'Không có dữ liệu kết quả chấm.' }, { status: 400 });
    }

    const roleTitle = teacherRole === 'cô' ? 'Cô' : 'Thầy';
    const signatureName = teacherName ? `${roleTitle} ${teacherName}` : roleTitle;

    // Create table rows for rubric criteria
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Nội dung tiêu chí', bold: true, color: 'FFFFFF' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: '1E3A8A' },
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Thang điểm', bold: true, color: 'FFFFFF' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: '1E3A8A' },
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Điểm đạt', bold: true, color: 'FFFFFF' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: '1E3A8A' },
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Đánh giá & Lý do cho điểm', bold: true, color: 'FFFFFF' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: '1E3A8A' },
          }),
        ],
      }),
      ...(gradingResult.criteriaBreakdown || []).map(
        (c) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: c.criterionName, bold: true })] })],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: `${c.maxPoints}đ` })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: `${c.awardedPoints}đ`, bold: true, color: '15803D' })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: c.reason })] })],
              }),
            ],
          })
      ),
    ];

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Header
            new Paragraph({
              children: [
                new TextRun({
                  text: 'PHIẾU ĐÁNH GIÁ & NHẬN XÉT BÀI LÀM TỰ LUẬN MÔN TOÁN',
                  bold: true,
                  size: 28,
                  color: '1E3A8A',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Họ và tên học sinh: ${gradingResult.studentName}  |  Điểm số: `,
                  size: 24,
                }),
                new TextRun({
                  text: `${gradingResult.score} / ${gradingResult.maxScore} điểm`,
                  bold: true,
                  size: 26,
                  color: 'DC2626',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            // Table of criteria
            new Paragraph({
              children: [new TextRun({ text: 'I. BẢNG ĐIỂM CHI TIẾT THEO RUBRIC', bold: true, size: 24 })],
              spacing: { before: 100, after: 100 },
            }),
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),

            // Section 2: Ưu điểm
            new Paragraph({
              children: [new TextRun({ text: 'II. ƯU ĐIỂM', bold: true, size: 24, color: '15803D' })],
              spacing: { before: 200, after: 80 },
            }),
            ...(gradingResult.strengths || []).map(
              (s) =>
                new Paragraph({
                  children: [new TextRun({ text: `• ${s}` })],
                  spacing: { after: 60 },
                })
            ),

            // Section 3: Nhược điểm
            new Paragraph({
              children: [new TextRun({ text: 'III. NHƯỢC ĐIỂM & ĐIỂM CẦN LƯU Ý', bold: true, size: 24, color: 'B45309' })],
              spacing: { before: 160, after: 80 },
            }),
            ...(gradingResult.weaknesses || []).map(
              (w) =>
                new Paragraph({
                  children: [new TextRun({ text: `• ${w}` })],
                  spacing: { after: 60 },
                })
            ),

            // Section 4: Hướng dẫn sửa bài
            new Paragraph({
              children: [new TextRun({ text: 'IV. HƯỚNG DẪN SỬA BÀI & RÚT KINH NGHIỆM', bold: true, size: 24, color: '4338CA' })],
              spacing: { before: 160, after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: gradingResult.correctionGuide || 'Không có.' })],
              spacing: { after: 120 },
            }),

            // Section 5: Kiến thức cần ôn lại
            new Paragraph({
              children: [new TextRun({ text: 'V. KIẾN THỨC CẦN ÔN TẬP LẠI', bold: true, size: 24, color: '6D28D9' })],
              spacing: { before: 160, after: 80 },
            }),
            ...(gradingResult.knowledgeToReview || []).map(
              (k) =>
                new Paragraph({
                  children: [new TextRun({ text: `✔ ${k}` })],
                  spacing: { after: 60 },
                })
            ),

            // Section 6: Lời phê của giáo viên
            new Paragraph({
              children: [new TextRun({ text: 'VI. LỜI NHẬN XÉT CỦA GIÁO VIÊN', bold: true, size: 24, color: '0369A1' })],
              spacing: { before: 180, after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `"${gradingResult.teacherComment}"`,
                  italics: true,
                  size: 22,
                }),
              ],
              spacing: { after: 200 },
            }),

            // Signature
            new Paragraph({
              children: [
                new TextRun({
                  text: `Giáo viên chấm bài: ${signatureName}`,
                  bold: true,
                }),
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 200 },
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Phieu_Nhan_Xet_${encodeURIComponent(gradingResult.studentName)}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('Export docx error:', error);
    return NextResponse.json({ error: 'Lỗi xuất file docx: ' + (error.message || error) }, { status: 500 });
  }
}
