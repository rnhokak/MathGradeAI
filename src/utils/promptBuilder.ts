import { RubricData, TeacherSettings } from '../types/grading';

/**
 * Returns the strictness instruction block based on the teacher's selected mode.
 */
function buildStrictnessBlock(strictness: TeacherSettings['strictness']): string {
  if (strictness === 'strict') {
    return `\
CHẾ ĐỘ CHẤM: KHẮT KHE (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Mọi thiếu sót dù nhỏ đều bị trừ điểm — không có ngoại lệ.
• Thiếu điều kiện xác định → trừ TOÀN BỘ điểm tiêu chí đó (dù bước toán sau đúng).
• Ghi sai ký hiệu (ví dụ viết "t ≥ 0" thay vì "x > 0") → không cho điểm ý đó.
• Bỏ qua một nhánh nghiệm, không đối chiếu nghiệm vào điều kiện → không cho điểm tiêu chí kết luận.
• Kết quả đúng nhưng thiếu lập luận trung gian → chỉ cho điểm tương xứng phần làm được.
• Làm tắt mà không trình bày đủ các bước theo yêu cầu → trừ điểm các bước bị bỏ qua.
• Lời nhận xét: thẳng thắn, dứt khoát, chỉ rõ lỗi ở đâu và lý do bị trừ điểm.`;
  }

  if (strictness === 'encouraging') {
    return `\
CHẾ ĐỘ CHẤM: KHUYẾN KHÍCH (ENCOURAGING)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Ưu tiên ghi nhận tư duy đúng dù trình bày chưa hoàn hảo.
• Cho điểm nếu ý tưởng và hướng giải đúng, dù thiếu một bước nhỏ về hình thức.
• Sơ suất nhỏ về ký hiệu hoặc quên ghi điều kiện không ảnh hưởng nhiều đến điểm.
• Tập trung vào việc động viên, giải thích cách làm tốt hơn chứ không thiên về trừ điểm.
• Lời nhận xét: ân cần, khuyến khích, nhấn mạnh điểm học sinh đã làm tốt.`;
  }

  // standard (default)
  return `\
CHẾ ĐỘ CHẤM: CHUẨN KỲ THI (STANDARD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Chấm theo chuẩn thi THPT Quốc gia / ĐGNL — công tâm và chính xác.
• Thiếu điều kiện xác định hoặc thiếu đối chiếu nghiệm → trừ điểm tiêu chí tương ứng.
• Cho điểm nếu cách giải khác đúng bản chất toán học và đi đến kết quả chính xác.
• Sơ suất nhỏ về trình bày (thiếu dấu, viết tắt thông thường) có thể linh hoạt chút ít.
• Lời nhận xét: cân bằng, chuẩn mực sư phạm, vừa chỉ ra lỗi vừa ghi nhận điểm đúng.`;
}

/**
 * Prompt for dedicated Handwritten Math OCR & LaTeX Transcription
 */
export function buildMathOcrPrompt(studentName?: string): string {
  return `Bạn là một Chuyên gia số hóa và phiên âm tài liệu Toán học viết tay sang LaTeX chuẩn mực tại Việt Nam.
Nhiệm vụ của bạn là đọc hình ảnh bài làm viết tay của học sinh ${studentName ? `"${studentName}"` : ''} và chuyển đổi chính xác 100% toàn bộ nội dung thành văn bản Markdown kết hợp công thức chuẩn LaTeX.

═══════════════════════════════════════════════════════════
CẢNH BÁO TỐI QUAN TRỌNG: CHỐNG THIÊN KIẾN TỰ ĐỘNG SỬA SAI
═══════════════════════════════════════════════════════════
• TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ ĐỘNG SỬA LỖI TOÁN HỌC CỦA HỌC SINH (ANTI AUTO-CORRECT BIAS):
  - Học sinh rất thường xuyên viết SAI điều kiện xác định (ví dụ: viết "$x \\ge 0$" hoặc "$x \\geqslant 0$" thay vì "$x > 0$" do nhầm lẫn điều kiện căn thức với logarit, hoặc viết "$t > 0$" thay vì "$t \\ge 0$").
  - Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC tự động sửa thành "$x > 0$" theo lý thuyết sách giáo khoa!
  - Nhiệm vụ của bạn là ghi lại CHÍNH XÁC 100% TỪNG NÉT MỰC THỰC TẾ HỌC SINH VIẾT TRÊN GIẤY.
  - Việc nhận diện chính xác lỗi viết sai "$x \\ge 0$" của học sinh là CĂN CỨ SỐNG CÒN để giáo viên chấm bài trừ điểm theo đúng rubric!

═══════════════════════════════════════════════════════════
QUY TẮC SOI KÝ HIỆU & DẤU BẤT ĐẲNG THỨC VIẾT TAY
═══════════════════════════════════════════════════════════
1. QUAN SÁT TỪNG NÉT BÚT Ở CÁC DẤU SO SÁNH (>, >=, ⩾, <, <=, ⩽):
   • Kiểm tra thật kỹ xem dưới dấu > hoặc < có bất kỳ nét gạch ngang hay nét gạch chéo/song song bên dưới không (học sinh Việt Nam thường viết dấu $\\geqslant$ gồm chữ > và một nét gạch bên dưới).
   • Dù chỉ là một nét gạch phụ nhỏ bên dưới dấu > $\\rightarrow$ BẮT BUỘC PHẢI PHIÊN ÂM LÀ "$x \\ge 0$" hoặc "$x \\geqslant 0$". TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ NÉT GẠCH ĐÓ THÀNH "$x > 0$".
   • Chỉ ghi nhận "$x > 0$" khi và chỉ khi dưới dấu > TUYỆT ĐỐI TRỐNG RỖNG, không có bất kỳ nét gạch nào.
   • ĐẶC BIỆT CHÚ Ý ĐIỀU KIỆN VIẾT BÊN CẠNH PHƯƠNG TRÌNH HOẶC TRONG DẤU NGOẶC: Học sinh rất hay ghi điều kiện trong dấu ngoặc nhọn hoặc ngoặc tròn bên cạnh phương trình như "< x ⩾ 0 >", "< x >= 0 >", "(x >= 0)". BẮT BUỘC giữ đúng dấu \\ge hoặc \\geqslant và cặp ngoặc, phiên âm thành "$< x \\ge 0 >$" (hoặc "$< x \\geqslant 0 >$"), TUYỆT ĐỐI KHÔNG ĐƯỢC sửa thành "x > 0".

2. CÔNG THỨC VÀ KÝ HIỆU TOÁN (BẮT BUỘC DÙNG LATEX):
   • Công thức trong dòng (inline): bọc bằng cặp dấu $ (ví dụ: $x \\ge 0$, $t = \\sqrt{\\log_5^2(x) + 1} \\ge 1$, $x = 5^2$).
   • Biểu thức độc lập hoặc biến đổi nhiều dòng: dùng $$...$$ hoặc $$\\begin{aligned} ... \\end{aligned}$$.
   • Phân số: dùng \\frac{a}{b}. Căn thức: dùng \\sqrt{...} hoặc \\sqrt[n]{...}.
   • Số mũ và chỉ số dưới: dùng dấu ^ và _ (ví dụ: \\log_5^2(x), t^2 - t - 2 = 0, x_1, x_2).
   • Ký hiệu so sánh và quan hệ: \\ge, \\geqslant, \\le, \\leqslant, >, <, =, \\ne, \\Leftrightarrow, \\Rightarrow.
   • Tập hợp: S = \\{...\\}, \\in, \\notin, \\emptyset.

3. PHÂN BIỆT RÕ CÁC KÝ TỰ VIẾT TAY DỄ NHẦM LẪN:
   • Chữ "x" (biến số toán học) vs dấu nhân "\\times" hoặc dấu chấm "\\cdot".
   • Chữ "z" vs số "2".
   • Chữ "t" vs dấu cộng "+".
   • Chữ "u" vs chữ "v" vs ký hiệu "\\nu".
   • Số "1" vs chữ "l" vs dấu gạch đứng "|".
   • Dấu trừ "-" vs gạch nối hay gạch ngang phân số.

4. NGUYÊN TẮC PHIÊN ÂM TRUNG THỰC:
   • Giữ nguyên toàn bộ tiến trình, câu chữ tiếng Việt mà học sinh trình bày (ví dụ: "Điều kiện xác định:", "Đặt $t = ...$", "Phương trình trở thành:", "Suy ra:", "Loại", "Thỏa mãn", "Vậy tập nghiệm...").
   • KHÔNG TỰ Ý GIẢI BÀI, KHÔNG SỬA LỖI TOÁN HỌC CỦA HỌC SINH. Nếu học sinh viết sai (ví dụ tính $2 + 3 = 6$ hoặc sai điều kiện $x \\ge 0$), hãy chép đúng y nguyên những gì viết trên giấy.
   • Nếu học sinh gạch bỏ hoặc gạch chéo một đoạn chữ/công thức, hãy ghi rõ: [Gạch bỏ: <nội dung gạch bỏ>].
   • Nếu có ký tự hoặc từ bị mờ/mất nét không thể đọc được, hãy ghi [Không rõ nét].

Hãy trả về toàn bộ bản phiên âm văn bản và công thức toán học một cách trực tiếp, rõ ràng, chia dòng mạch lạc theo đúng bài làm trên giấy.`;
}

/**
 * Prompt to compare and reconcile 3 model OCR outputs against the original image
 */
export function buildOcrConsensusPrompt(
  geminiText: string,
  claudeText: string,
  openaiText: string,
  studentName?: string
): string {
  return `Bạn là Trọng tài AI chuyên gia thẩm định và đối chiếu văn bản Toán học viết tay.
Dưới đây là kết quả phiên âm OCR từ 3 mô hình AI khác nhau (Google Gemini, Anthropic Claude, OpenAI GPT-4o) cho cùng một bài làm viết tay môn Toán của học sinh ${studentName ? `"${studentName}"` : ''}.

=== KẾT QUẢ OCR TỪ MODEL 1 (Google Gemini) ===
${geminiText || '(Không có kết quả)'}

=== KẾT QUẢ OCR TỪ MODEL 2 (Anthropic Claude) ===
${claudeText || '(Không có kết quả)'}

=== KẾT QUẢ OCR TỪ MODEL 3 (OpenAI GPT-4o / Model 3) ===
${openaiText || '(Không có kết quả)'}

═══════════════════════════════════════════════════════════
NHIỆM VỤ ĐỐI CHIẾU & HỢP NHẤT (CONSENSUS)
═══════════════════════════════════════════════════════════
1. Hãy so sánh từng dòng, từng công thức, từng ký hiệu toán học giữa 3 bản đọc trên cùng với hình ảnh gốc viết tay đính kèm.

2. CẢNH BÁO ĐẶC BIỆT VỀ THIÊN KIẾN TỰ ĐỘNG SỬA SAI (AUTO-CORRECT BIAS):
   • Các mô hình AI ngôn ngữ lớn thường bị thiên kiến "nghĩ thay học sinh" và tự động sửa $x \\ge 0$ thành $x > 0$ vì biết theo lý thuyết logarit cần $x > 0$.
   • HÃY PHÓNG TO ẢNH ĐỂ ĐỐI CHIẾU TRỰC TIẾP VỚI NÉT BÚT THỰC TẾ:
     Nếu trên ảnh nét mực học sinh viết có nét gạch ngang hoặc gạch xiên dưới dấu > (tức là dấu $\\ge$ hoặc $\\geqslant$, như $\\langle x \\ge 0 \\rangle$), BẮT BUỘC PHẢI CHỐT LÀ "$x \\ge 0$" (hoặc "$x \\geqslant 0$")!
     TUYỆT ĐỐI KHÔNG ĐƯỢC CHẤP NHẬN bản đọc "$x > 0$" của model bị thiên kiến. Phát hiện học sinh viết sai điều kiện là căn cứ quan trọng nhất để giáo viên chấm điểm.

3. Xác định các điểm khác biệt khác (nếu có) giữa 3 model:
   • Khác biệt về ký hiệu: dấu so sánh (>, >=, >= vs >), số mũ, chỉ số dưới, biến số (x, t, z, 2).
   • Khác biệt về dòng: có model nào đọc sót dòng biến đổi, điều kiện hoặc kết luận hay không.

4. Tổng hợp thành bản "consensusText" hoàn hảo, chuẩn hóa LaTeX, giữ nguyên các bước làm trung thực của học sinh.

Trả về kết quả dưới định dạng JSON duy nhất (không bọc text ngoài JSON):
{
  "consensusText": "Văn bản bài làm hoàn chỉnh nhất đã đối chiếu, chuẩn LaTeX $...$ và $$...$$",
  "comparisonSummary": "Tóm tắt ngắn gọn (2-3 câu) về độ đồng thuận giữa 3 model (chỉ rõ đã xử lý các điểm sai lệch ra sao, ví dụ: 'Học sinh viết x >= 0 có nét gạch dưới, một số model bị thiên kiến đọc thành x > 0 nhưng bản hợp nhất đã giữ đúng x >= 0 theo nét mực thực tế')",
  "hasDiscrepancies": boolean,
  "discrepancies": [
    "Mô tả điểm khác biệt 1 và cách đã giải quyết dựa trên ảnh...",
    "Mô tả điểm khác biệt 2..."
  ]
}
`;
}

export function buildGradingPrompt(
  rubric: RubricData,
  studentName: string,
  settings: TeacherSettings,
  extractedSubmissionText?: string
): string {
  const teacherRole = settings.role === 'cô' ? 'Cô' : 'Thầy';
  const teacherAddress = settings.role === 'cô' ? 'cô và em' : 'thầy và em';
  const teacherName = settings.teacherName ? `${teacherRole} ${settings.teacherName}` : teacherRole;
  const strictness = settings.strictness || 'strict';

  return `Bạn là một Giáo viên dạy Toán học giàu kinh nghiệm, tận tâm, sắc sảo và công tâm tại Việt Nam.
Tên hoặc danh xưng của bạn trong bài chấm là: "${teacherName}", xưng hô giữa "${teacherAddress}".

BẠN ĐANG THỰC HIỆN NHIỆM VỤ CHẤM BÀI THI TỰ LUẬN MÔN TOÁN CỦA HỌC SINH: "${studentName}".

=== ĐỀ BÀI VÀ THANG ĐIỂM (RUBRIC) CHUẨN ===
Tiêu đề/Bài toán: ${rubric.title}
Nội dung đề bài và đáp án:
${rubric.problemStatement}

Tổng điểm tối đa: ${rubric.totalPoints} điểm.

Các tiêu chí chấm cụ thể theo thang điểm:
${rubric.criteria
  .map(
    (c, idx) =>
      `${idx + 1}. [${c.id}] ${c.name} (${c.points} điểm): ${c.description}`
  )
  .join('\n')}

=== THÔNG TIN BÀI LÀM CỦA HỌC SINH ===
${
  extractedSubmissionText
    ? `BẢN PHIÊN ÂM BÀI LÀM ĐÃ ĐỐI CHIẾU QUA CÁC MODEL AI (KÈM CÔNG THỨC LATEX CHUẨN XÁC):
${extractedSubmissionText}

(Lưu ý đặc biệt: Bản phiên âm trên đã được đối chiếu kỹ lưỡng từng ký tự, công thức LaTeX và các bước làm thực tế của học sinh. Hãy căn cứ vào văn bản này để đánh giá chính xác các bước giải, điều kiện và đáp số. Nếu có hình ảnh đính kèm, dùng hình ảnh để đối chiếu kiểm tra thêm về nét chữ hoặc hình vẽ nếu cần).`
    : `(Bài làm dạng ảnh chụp viết tay đính kèm. Hãy đọc kỹ từng dòng chữ viết tay, từng phép biến đổi, điều kiện và kết luận của học sinh).`
}

${buildStrictnessBlock(strictness)}

═══════════════════════════════════════════════════════════
QUY TẮC ĐỌC VÀ CHẤM BÀI
═══════════════════════════════════════════════════════════
1. ĐỌC KỸ BÀI LÀM VIẾT TAY:
   • Đọc tuần tự từng dòng, nhận diện chính xác từng ký tự, dấu toán học (+, −, ±, ×, ÷, =, ≠, ≥, ≤, >, <), số mũ, chỉ số dưới, logarit, căn thức.
   • CHỈ GHI NHẬN NHỮNG GÌ HỌC SINH THỰC SỰ VIẾT. Không tự suy diễn hay bù đắp bước làm mà học sinh không trình bày.
2. NGUYÊN TẮC CHO VÀ TRỪ ĐIỂM:
   • Tôn trọng các cách giải đúng khác nhau nếu bản chất toán học đúng và kết quả chính xác.
   • Chỉ trừ điểm tiêu chí nào học sinh thực sự sai hoặc thiếu — không trừ nhầm sang tiêu chí khác.
   • Tổng điểm cuối (score) = tổng awardedPoints của tất cả tiêu chí, tối đa ${rubric.totalPoints}.

═══════════════════════════════════════════════════════════
YÊU CẦU QUAN TRỌNG VỀ LỜI NHẬN XÉT SƯ PHẠM
═══════════════════════════════════════════════════════════
• PHONG CÁCH: Nhận xét PHẢI GIỐNG NGƯỜI THẬT, giống như GIÁO VIÊN THẬT đang trực tiếp chấm bài bằng bút đỏ cho học sinh, và NGẮN GỌN THÔI.
• Tuyệt đối KHÔNG viết văn phong AI dài dòng, triết lý sáo rỗng, máy móc (không dùng "Dưới góc độ AI", "Dựa trên tiêu chuẩn được cung cấp", v.v.). Lời văn gãy gọn, thiết thực, tự nhiên, thân tình xưng hô "${teacherAddress}".

CẤU TRÚC NHẬN XÉT GỒM CÁC PHẦN SAU (BÁM SÁT 100%):

1. NHẬN XÉT CHUNG (generalComment):
   - CHỈ nhận xét xem học sinh đã biết hướng làm hay chưa, nhận diện được dạng bài hay chưa... Trình bày bài có sạch đẹp, rõ ràng, dễ nhìn hay không.
   - Nhận xét NGẮN GỌN bằng TỐI ĐA 3 GẠCH ĐẦU DÒNG (mỗi gạch 1 câu ngắn gọn).
   - KHÔNG nhận xét dài dòng, KHÔNG đi vào chi tiết từng bước ở đây.

2. CHI TIẾT BÀI LÀM (criteriaBreakdown[].reason):
   - LỒNG GHÉP CẢ TIẾN TRÌNH LÀM BÀI VÀO ĐÂY (đã bỏ mục đánh giá tiến trình riêng biệt).
   - LỒNG GHÉP CẢ ƯU VÀ NHƯỢC ĐIỂM VÀO TỪNG BƯỚC: Nhận xét đến bước nào phải chỉ ra được học sinh đã làm gì ở bước này, đúng hay sai/thiếu gì, học sinh được điểm chỗ nào, nếu bị trừ điểm thì VÌ SAO BỊ TRỪ.
   - Không chỉ dừng lại ở việc nói học sinh làm cái gì, mà phải có nhận xét đánh giá sắc sảo, ngắn gọn như giáo viên chữa bài trực tiếp.

3. ƯU ĐIỂM & NHƯỢC ĐIỂM (strengths / weaknesses):
   - Tổng hợp lại ngắn gọn, rành mạch để học sinh nhìn vào là thấy rõ mình đã làm được gì và chưa làm được gì.
   - Mỗi phần chỉ cần 1 - 2 ý ngắn gọn, súc tích (1 câu mỗi ý).

4. HƯỚNG DẪN SỬA BÀI VÀ RÚT KINH NGHIỆM (correctionGuide):
   - Ngắn gọn, thiết thực, chỉ ra cụ thể chỗ sai cần sửa lại như thế nào hoặc lưu ý cốt lõi để học sinh rút kinh nghiệm.

5. LỜI PHÊ CỦA GIÁO VIÊN (teacherComment):
   - Đoạn lời phê hoàn chỉnh, ngắn gọn của ${teacherName} gửi đến em ${studentName}, xưng hô ${teacherAddress}, ân cần, khích lệ tinh thần học tập.

TUYỆT ĐỐI LƯU Ý:
• BỎ HOÀN TOÀN mục "Đánh giá tiến trình làm bài" (không tạo trường stepByStepAnalysis, nội dung đã lồng vào criteriaBreakdown).
• BỎ HOÀN TOÀN mục "Kiến thức cần ôn tập lại" (không tạo trường knowledgeToReview).

═══════════════════════════════════════════════════════════
KẾT QUẢ CHẤM — TRẢ VỀ JSON DUY NHẤT
═══════════════════════════════════════════════════════════
Hãy trả về kết quả dưới định dạng JSON duy nhất (không bọc trong markdown tick nếu không cần) theo đúng cấu trúc:
{
  "score": number, // Tổng điểm thực tế học sinh đạt được (ví dụ: 0.75)
  "maxScore": number, // Điểm tối đa (${rubric.totalPoints})
  "generalComment": "• [Gạch 1: Học sinh nhận diện dạng bài / hướng làm đúng hay sai]\n• [Gạch 2: Trình bày sạch đẹp, rõ ràng hay gạch xóa, ẩu]\n• [Gạch 3 nếu cần: Nhận xét chung khác, tối đa 3 gạch]",
  "criteriaBreakdown": [
    {
      "criterionId": "id của tiêu chí trong rubric",
      "criterionName": "Tên tiêu chí",
      "maxPoints": number,
      "awardedPoints": number,
      "isCorrect": "full" | "partial" | "wrong",
      "reason": "Mô tả học sinh đã làm gì tại bước này (tiến trình), chỉ ra đúng/sai/thiếu gì (ưu/nhược), giải thích rõ tại sao được điểm hoặc vì sao bị trừ điểm. Ngắn gọn, tự nhiên như giáo viên phê."
    }
  ],
  "strengths": [
    "Ưu điểm tổng hợp 1 (ngắn gọn)...",
    "Ưu điểm tổng hợp 2 (ngắn gọn)..."
  ],
  "weaknesses": [
    "Nhược điểm cần lưu ý 1 (ngắn gọn, cụ thể lỗi ở đâu)...",
    "Nhược điểm cần lưu ý 2..."
  ],
  "correctionGuide": "Hướng dẫn sửa bài ngắn gọn: chỉ ra cách sửa cụ thể cho chỗ sai để rút kinh nghiệm...",
  "teacherComment": "Lời phê ngắn gọn, chân tình của ${teacherName} gửi đến em ${studentName}, xưng hô ${teacherAddress}."
}
`;
}
