import { NextRequest, NextResponse } from 'next/server';
import { parseDocx } from '@/utils/docxParser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file tải lên.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parseDocx(arrayBuffer);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      text: parsed.text,
      images: parsed.images,
      tables: parsed.tables,
    });
  } catch (error: any) {
    console.error('Error parsing docx:', error);
    return NextResponse.json(
      { error: 'Lỗi khi bóc tách file Word docx: ' + (error.message || error) },
      { status: 500 }
    );
  }
}
