import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.AI_AGENT_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/agent/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('AI Agent cancel proxy error:', error);
    return NextResponse.json(
      { status: 'error', detail: error.message || 'AI Agent backend service is offline.' },
      { status: 503 }
    );
  }
}

