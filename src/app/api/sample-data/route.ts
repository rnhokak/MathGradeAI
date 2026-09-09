import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { parseDocx } from '@/utils/docxParser';
import { RubricData, StudentSubmission } from '@/types/grading';

export async function GET(req: NextRequest) {
  try {
    const fileMauDir = path.join(process.cwd(), 'fileMau');

    // 1. Parse rubric bai 1.docx
    const rubricPath = path.join(fileMauDir, 'rubric bai 1.docx');
    let rubricData: RubricData = {
      title: 'Câu 1. Giải phương trình logarit chứa căn thức',
      problemStatement: 'Câu 1. Giải phương trình: log_5^2(x) + sqrt(log_5^2(x) + 1) - 3 = 0',
      totalPoints: 1.0,
      criteria: [
        {
          id: 'c1',
          name: 'Điều kiện xác định',
          points: 0.25,
          description: 'Tìm điều kiện: x > 0',
        },
        {
          id: 'c2',
          name: 'Đặt ẩn phụ và chuyển phương trình',
          points: 0.25,
          description: 'Đặt ẩn phụ với điều kiện tương ứng, chuyển về phương trình bậc 2',
        },
        {
          id: 'c3',
          name: 'Giải phương trình bậc hai theo ẩn phụ',
          points: 0.25,
          description: 'Giải ra nghiệm của ẩn phụ, đối chiếu điều kiện để loại/nhận nghiệm',
        },
        {
          id: 'c4',
          name: 'Tìm nghiệm x và kết luận tập nghiệm',
          points: 0.25,
          description: 'Thay lại ẩn phụ tìm x, đối chiếu điều kiện ban đầu và kết luận tập nghiệm S',
        },
      ],
      rawText: '',
    };

    if (fs.existsSync(rubricPath)) {
      const rubricBuffer = fs.readFileSync(rubricPath);
      const parsedRubric = await parseDocx(rubricBuffer);
      rubricData.rawText = parsedRubric.text;
    }

    // 2. Parse sample submissions
    const sampleSubmissions: StudentSubmission[] = [];

    // Nga
    const ngaPath = path.join(fileMauDir, 'Dinh_Thi_Viet_Nga bài 1.docx');
    if (fs.existsSync(ngaPath)) {
      const ngaBuffer = fs.readFileSync(ngaPath);
      const parsedNga = await parseDocx(ngaBuffer);
      sampleSubmissions.push({
        id: 'sample-nga',
        studentName: 'Đinh Thị Việt Nga',
        fileName: 'Dinh_Thi_Viet_Nga bài 1.docx',
        fileType: 'docx',
        fileSize: ngaBuffer.length,
        images: parsedNga.images.map((img) => img.dataUrl),
        extractedText: parsedNga.text,
        status: 'idle',
      });
    }

    // Trang
    const trangPath = path.join(fileMauDir, 'Do_Thi_Thuy_Trang bài 1.docx');
    if (fs.existsSync(trangPath)) {
      const trangBuffer = fs.readFileSync(trangPath);
      const parsedTrang = await parseDocx(trangBuffer);
      sampleSubmissions.push({
        id: 'sample-trang',
        studentName: 'Đỗ Thị Thùy Trang',
        fileName: 'Do_Thi_Thuy_Trang bài 1.docx',
        fileType: 'docx',
        fileSize: trangBuffer.length,
        images: parsedTrang.images.map((img) => img.dataUrl),
        extractedText: parsedTrang.text,
        status: 'idle',
      });
    }

    return NextResponse.json({
      success: true,
      rubric: rubricData,
      submissions: sampleSubmissions,
    });
  } catch (error: any) {
    console.error('Error loading sample data:', error);
    return NextResponse.json(
      { error: 'Lỗi nạp dữ liệu mẫu: ' + (error.message || error) },
      { status: 500 }
    );
  }
}
