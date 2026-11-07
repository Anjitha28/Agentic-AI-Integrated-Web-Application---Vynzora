import { NextResponse } from 'next/server';
import { processAiMessage } from '@/lib/ai/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'A valid message string is required.' },
        { status: 400 }
      );
    }

    const aiResponse = await processAiMessage(
      message.trim(),
      Array.isArray(history) ? history : []
    );

    return NextResponse.json({
      success: true,
      data: aiResponse,
    });
  } catch (error: any) {
    console.error('AI chat endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal AI Assistant Error',
      },
      { status: 500 }
    );
  }
}

