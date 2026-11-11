import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.AI_AGENT_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'offline', detail: error.message || 'AI Agent backend service is offline.' },
      { status: 503 }
    );
  }
}

