import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { RubricData, StudentSubmission, TeacherSettings, GradingResult } from '@/types/grading';
import { buildGradingPrompt } from '@/utils/promptBuilder';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      submission,
      rubric,
      settings,
    }: {
      submission: StudentSubmission;
      rubric: RubricData;
      settings: TeacherSettings;
    } = body;

    if (!submission || !rubric) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bài làm hoặc rubric chấm điểm.' },
        { status: 400 }
      );
    }

    const apiKey = (
      req.headers.get('x-gemini-api-key') ||
      settings?.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    // Must have a real Gemini API Key - NO MOCK FALLBACK
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Chưa cấu hình Google Gemini API Key. Vui lòng bấm vào Cài Đặt (biểu tượng bánh răng) ở góc trên bên phải để nhập API Key, hoặc khai báo biến GEMINI_API_KEY trong file .env.local.',
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const contents: any[] = [];

    // 1. Add images (student handwriting / submission scans)
    if (submission.images && submission.images.length > 0) {
      for (const imgUrl of submission.images) {
        const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          contents.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }
    }

    // 2. Add system instructions and prompt
    const promptText = buildGradingPrompt(
      rubric,
      submission.studentName,
      settings,
      submission.extractedText
    );
    contents.push(promptText);

    // Candidate models to withstand temporary spikes in demand (e.g. 503)
    const userModel = settings?.model || process.env.GEMINI_MODEL || 'gemini-3.7-flash';
    const cleanPreferred = userModel === 'gemini-2.5-flash' ? 'gemini-3.7-flash' : userModel;
    const candidates = Array.from(new Set([cleanPreferred, 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.5-flash']));

    let response: any = null;
    let modelUsed = cleanPreferred;
    let lastError: any = null;

    for (const m of candidates) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
        modelUsed = m;
        break;
      } catch (err: any) {
        console.warn(`Model ${m} failed (${err.message || err}), trying next candidate...`);
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error('Không thể kết nối đến các mô hình Gemini AI.');
    }

    const textOutput = response.text || '';
    const cleaned = textOutput.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (parseErr: any) {
      console.error('Failed to parse Gemini output as JSON:', textOutput);
      return NextResponse.json(
        {
          error:
            'AI phản hồi định dạng không hợp lệ: ' +
            (parseErr.message || parseErr) +
            '. Phản hồi thô: ' +
            textOutput.substring(0, 300),
        },
        { status: 500 }
      );
    }

    const score = Number(parsedJson.score ?? 0);
    const maxScore = Number(parsedJson.maxScore ?? rubric.totalPoints);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    const gradingResult: GradingResult = {
      studentName: submission.studentName,
      submissionId: submission.id,
      score,
      maxScore,
      percentage,
      status: 'completed',
      gradedAt: new Date().toISOString(),
      strengths: Array.isArray(parsedJson.strengths) ? parsedJson.strengths : [],
      weaknesses: Array.isArray(parsedJson.weaknesses) ? parsedJson.weaknesses : [],
      stepByStepAnalysis: parsedJson.stepByStepAnalysis || '',
      criteriaBreakdown: Array.isArray(parsedJson.criteriaBreakdown) ? parsedJson.criteriaBreakdown : [],
      correctionGuide: parsedJson.correctionGuide || '',
      knowledgeToReview: Array.isArray(parsedJson.knowledgeToReview) ? parsedJson.knowledgeToReview : [],
      teacherComment: parsedJson.teacherComment || '',
    };

    return NextResponse.json({
      success: true,
      gradingResult,
      mode: 'gemini-live',
      modelUsed,
    });
  } catch (error: any) {
    console.error('Grading error:', error);
    return NextResponse.json(
      {
        error: 'Lỗi trong quá trình chấm bài bằng Gemini AI: ' + (error.message || error),
      },
      { status: 500 }
    );
  }
}
