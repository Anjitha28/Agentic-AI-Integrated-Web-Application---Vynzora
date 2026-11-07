import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

/**
 * Split text into speech chunks <= 150 characters on sentence / clause boundaries.
 */
function splitTextIntoChunks(text: string, maxLength: number = 150): string[] {
  const clean = text
    .replace(/[*#_`~>]/g, '')
    .replace(/•/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  const sentences = clean.split(/(?<=[.?!,\n])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length <= maxLength) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLength) {
        current = sentence;
      } else {
        // Break long sentence by words
        const words = sentence.split(' ');
        let wordChunk = '';
        for (const w of words) {
          if ((wordChunk + ' ' + w).trim().length <= maxLength) {
            wordChunk = (wordChunk + ' ' + w).trim();
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = w;
          }
        }
        current = wordChunk;
      }
    }
  }
  if (current) chunks.push(current);

  return chunks.slice(0, 5); // Limit to top 5 chunks (~400 chars) for crisp conversational audio
}

/**
 * Fetch a single audio buffer from Google's neural TTS engine.
 */
function fetchTtsChunk(text: string, lang: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text
    )}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`TTS provider returned HTTP ${res.statusCode}`));
        }
        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
      }
    );

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error('TTS request timed out'));
    });
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || '';
    const lang = searchParams.get('lang') || 'ml';

    if (!text.trim()) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    const chunks = splitTextIntoChunks(text);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No pronounceable text provided' }, { status: 400 });
    }

    // Fetch audio chunks sequentially to maintain order
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await fetchTtsChunk(chunk, lang);
      buffers.push(buf);
    }

    const fullAudio = Buffer.concat(buffers);

    return new Response(fullAudio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': fullAudio.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('TTS endpoint error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to synthesize speech' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text || '';
    const lang = body.lang || 'ml';

    if (!text.trim()) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    const chunks = splitTextIntoChunks(text);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No pronounceable text provided' }, { status: 400 });
    }

    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await fetchTtsChunk(chunk, lang);
      buffers.push(buf);
    }

    const fullAudio = Buffer.concat(buffers);

    return new Response(fullAudio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': fullAudio.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('TTS endpoint error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to synthesize speech' },
      { status: 500 }
    );
  }
}

