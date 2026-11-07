import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get('room') || 'vynzora-business-room';
    const identity = searchParams.get('identity') || `admin-${Date.now().toString(36)}`;
    const name = searchParams.get('name') || 'Vynzora Administrator';

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'LiveKit server credentials are not fully configured in environment variables.',
        },
        { status: 503 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '1h',
    });

    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      success: true,
      token,
      wsUrl,
      room,
      identity,
    });
  } catch (error: any) {
    console.error('LiveKit token generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Token generation failed' },
      { status: 500 }
    );
  }
}

