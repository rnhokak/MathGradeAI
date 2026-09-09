import { RubricData, RubricCriterion } from '@/types/grading';
import { GoogleGenAI } from '@google/genai';

/**
 * Extracts numeric points from a string (e.g., "0,25", "0.25đ", "0.5 điểm", "(0.25)", "[1.0]")
 */
export function extractPointsFromString(str: string): number | null {
  if (!str) return null;
  const clean = str.trim();
  // Match number with optional decimal separator (, or .)
  const match = clean.match(/(\d+(?:[.,]\d+)?)/);
  if (match) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0 && val <= 100) {
      return val;
    }
  }
  return null;
}

/**
 * Smart heuristic table parser for rubrics
 * Supports 2-column, 3-column, 4-column, and arbitrary table layouts
 */
export function parseRubricFromTablesAndText(
  tables: string[][][],
  text: string,
  fileName?: string
): RubricData {
  let bestCriteria: RubricCriterion[] = [];
  let calculatedTotal = 0;

  // 1. Scan all tables to find the best matching rubric table
  if (tables && tables.length > 0) {
    for (let tIdx = 0; tIdx < tables.length; tIdx++) {
      const table = tables[tIdx];
      if (!table || table.length < 2) continue;

      // Detect columns from headers or cell contents
      const headerRow = table[0];
      const colCount = Math.max(...table.map((r) => r.length));
      if (colCount < 2) continue;

      let pointsColIdx = -1;
      let nameColIdx = -1;
      let descColIdx = -1;

      // Check header row for keywords
      for (let c = 0; c < headerRow.length; c++) {
        const cell = (headerRow[c] || '').toLowerCase();
        if (/điểm|thang\s*điểm|biểu\s*điểm|pts|score|mark/i.test(cell)) {
          pointsColIdx = c;
        } else if (/^(ý|câu|stt|tt|bước|bài)\b/i.test(cell)) {
          nameColIdx = c;
        } else if (/nội\s*dung|đáp\s*án|hướng\s*dẫn|yêu\s*cầu|lời\s*giải|tiêu\s*chí/i.test(cell)) {
          descColIdx = c;
        }
      }

      // If points column not detected from header, detect by analyzing cell values
      if (pointsColIdx === -1) {
        let maxNumericCount = 0;
        for (let c = 0; c < colCount; c++) {
          let numCount = 0;
          for (let r = 1; r < table.length; r++) {
            const val = extractPointsFromString(table[r]?.[c] || '');
            if (val !== null) numCount++;
          }
          if (numCount > maxNumericCount) {
            maxNumericCount = numCount;
            pointsColIdx = c;
          }
        }
      }

      // If points column found, pick description column as the longest remaining text column
      if (pointsColIdx !== -1) {
        if (descColIdx === -1 || descColIdx === pointsColIdx) {
          let maxLen = 0;
          for (let c = 0; c < colCount; c++) {
            if (c === pointsColIdx || c === nameColIdx) continue;
            let totalLen = 0;
            for (let r = 1; r < table.length; r++) {
              totalLen += (table[r]?.[c] || '').length;
            }
            if (totalLen > maxLen) {
              maxLen = totalLen;
              descColIdx = c;
            }
          }
        }

        // If still no desc col, default to 0 (or 1 if points is 0)
        if (descColIdx === -1) {
          descColIdx = pointsColIdx === 0 ? 1 : 0;
        }

        // Extract criteria rows from this table
        const tableCriteria: RubricCriterion[] = [];
        let tableTotal = 0;

        for (let r = 1; r < table.length; r++) {
          const row = table[r];
          if (!row || row.length === 0) continue;

          const descCell = (row[descColIdx] || '').trim();
          const nameCell = nameColIdx !== -1 ? (row[nameColIdx] || '').trim() : '';
          const ptsCell = (row[pointsColIdx] || '').trim();

          // Skip total / summary rows
          if (/^tổng\s*(điểm)?\b|^cộng\b|^total\b/i.test(descCell) || /^tổng\b/i.test(nameCell)) {
            continue;
          }

          const pts = extractPointsFromString(ptsCell);
          if (pts !== null && pts > 0 && descCell.length > 0) {
            // Determine clean name
            let criterionName = nameCell;
            if (!criterionName) {
              // Try to take short prefix before colon or first sentence
              const colonIdx = descCell.indexOf(':');
              if (colonIdx > 0 && colonIdx <= 45) {
                criterionName = descCell.substring(0, colonIdx).trim();
              } else if (descCell.length <= 40) {
                criterionName = descCell;
              } else {
                criterionName = `Ý ${tableCriteria.length + 1}`;
              }
            }

            tableCriteria.push({
              id: `crit-${tableCriteria.length + 1}`,
              name: criterionName,
              points: Number(pts.toFixed(2)),
              description: descCell,
            });
            tableTotal += pts;
          }
        }

        if (tableCriteria.length > bestCriteria.length) {
          bestCriteria = tableCriteria;
          calculatedTotal = Number(tableTotal.toFixed(2));
        }
      }
    }
  }

  // 2. If no criteria extracted from tables, attempt text line parsing
  if (bestCriteria.length === 0 && text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    let lineIdx = 1;
    let textTotal = 0;

    for (const line of lines) {
      if (/^tổng\s*điểm|^cộng/i.test(line)) continue;

      // Look for patterns like "a) ... (0.25đ)" or "Ý 1: ... [0.5 điểm]" or "- ... : 0.25"
      const match = line.match(/^(?:([a-z\d]+[.)]|\-|\*|Ý\s*\d+:?|Bước\s*\d+:?)\s*)?(.+?)(?:[:\s(-]+)(\d+(?:[.,]\d+)?)\s*(?:đ|điểm|pts)?(?:\)|\]|\s|$)/i);
      if (match) {
        const prefix = (match[1] || '').trim();
        const desc = match[2].trim();
        const pts = parseFloat(match[3].replace(',', '.'));

        if (!isNaN(pts) && pts > 0 && pts <= 10 && desc.length > 3) {
          bestCriteria.push({
            id: `crit-${lineIdx}`,
            name: prefix || `Ý ${lineIdx}`,
            points: Number(pts.toFixed(2)),
            description: `${prefix ? prefix + ' ' : ''}${desc}`,
          });
          textTotal += pts;
          lineIdx++;
        }
      }
    }

    if (bestCriteria.length > 0) {
      calculatedTotal = Number(textTotal.toFixed(2));
    }
  }

  // 3. Problem statement extraction
  const cleanTitle = (fileName || 'Đề bài và Thang điểm Rubric').replace(/\.[^/.]+$/, '');
  let problemStatement = '';

  if (text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    // Find lines that look like problem questions (before the table / criteria)
    const questionLines: string[] = [];
    for (const l of lines) {
      if (/^đáp\s*án|^thang\s*điểm|^hướng\s*dẫn\s*chấm|^bảng\s*điểm/i.test(l)) {
        break;
      }
      questionLines.push(l);
      if (questionLines.length >= 6) break;
    }

    if (questionLines.length > 0) {
      problemStatement = questionLines.join('\n');
    }
  }

  if (!problemStatement) {
    problemStatement = text ? text.substring(0, 300) : 'Nội dung đề bài và đáp án chuẩn...';
  }

  return {
    title: cleanTitle,
    problemStatement,
    totalPoints: calculatedTotal > 0 ? calculatedTotal : 1.0,
    criteria: bestCriteria,
    rawText: text,
  };
}

/**
 * Parses rubric using Gemini AI for complete pedagogical precision
 */
export async function parseRubricWithGemini(
  text: string,
  tables: string[][][],
  fileName: string,
  apiKey: string,
  modelName: string = 'gemini-3.7-flash'
): Promise<RubricData> {
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const tableSummary = tables
    .map(
      (t, idx) =>
        `Bảng ${idx + 1}:\n` +
        t.map((row) => '| ' + row.join(' | ') + ' |').join('\n')
    )
    .join('\n\n');

  const prompt = `
Bạn là chuyên gia khảo thí và chấm điểm tự động. Hãy phân tích văn bản và các bảng biểu từ file Word Rubric/Đáp án "${fileName}" dưới đây để tạo ra thang điểm Rubric có cấu trúc JSON chuẩn xác.

Nội dung văn bản:
"""
${text.substring(0, 10000)}
"""

Nội dung bảng biểu trích xuất từ file:
"""
${tableSummary.substring(0, 10000)}
"""

HÃY TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON VỚI CẤU TRÚC:
{
  "title": "Tên câu hỏi hoặc bài thi (ví dụ: Câu 1. Giải phương trình logarit)",
  "problemStatement": "Nội dung đầy đủ của câu hỏi / đề bài toán và đáp án chuẩn (giữ nguyên công thức toán dạng LaTeX $...$)",
  "totalPoints": 1.0, // Tổng số điểm của câu này (dạng số thập phân, ví dụ 1.0 hoặc 2.5)
  "criteria": [
    {
      "id": "crit-1",
      "name": "Tên ngắn gọn của ý/bước giải (ví dụ: 'Điều kiện xác định', 'Ý a: Biến đổi phương trình')",
      "points": 0.25, // Số điểm của ý này (dạng số, ví dụ 0.25, 0.5)
      "description": "Yêu cầu chi tiết, điều kiện để cho điểm ý này (giữ nguyên công thức toán)"
    }
  ]
}

LƯU Ý:
1. Không bỏ sót bất kỳ ý chấm nào trong bảng đáp án / biểu điểm.
2. Tổng điểm "totalPoints" phải bằng tổng "points" của tất cả các tiêu chí trong "criteria".
3. Giữ nguyên tất cả công thức toán học và ký hiệu LaTeX nếu có.
4. Chỉ trả về JSON hợp lệ, không giải thích thêm.
`;

  const candidates = Array.from(new Set([modelName, 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.5-flash']));
  let response: any = null;
  let lastErr: any = null;

  for (const m of candidates) {
    if (m === 'gemini-2.5-flash') continue;
    try {
      response = await ai.models.generateContent({
        model: m,
        contents: [prompt],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      break;
    } catch (err: any) {
      lastErr = err;
    }
  }

  if (!response) {
    throw lastErr || new Error('Không thể phân tích rubric bằng Gemini AI');
  }

  const rawJson = (response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(rawJson);

  const criteria: RubricCriterion[] = (parsed.criteria || []).map((c: any, idx: number) => ({
    id: c.id || `crit-${idx + 1}`,
    name: c.name || `Tiêu chí ${idx + 1}`,
    points: Number(parseFloat(c.points || 0).toFixed(2)),
    description: c.description || '',
  }));

  const totalPoints = Number(
    parseFloat(parsed.totalPoints || criteria.reduce((sum, c) => sum + c.points, 0)).toFixed(2)
  );

  return {
    title: parsed.title || fileName.replace(/\.[^/.]+$/, ''),
    problemStatement: parsed.problemStatement || text.substring(0, 300),
    totalPoints: totalPoints > 0 ? totalPoints : 1.0,
    criteria,
    rawText: text,
  };
}
