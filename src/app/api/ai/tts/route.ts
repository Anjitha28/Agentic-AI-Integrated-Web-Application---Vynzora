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

  return chunks.slice(0, 5);
}

/**
 * Synthesize speech using Sarvam AI Bulbul v3 (Malayalam ml-IN, Hindi hi-IN, English en-IN).
 */
async function fetchSarvamBulbulTts(
  text: string,
  langCode: string,
  apiKey: string
): Promise<Buffer | null> {
  try {
    const clean = text
      .replace(/[*#_`~>]/g, '')
      .replace(/•/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return null;

    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [clean.slice(0, 450)],
        target_language_code: langCode,
        speaker: 'kavya',
        model: 'bulbul:v3',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const audios = data.audios;
      if (Array.isArray(audios) && audios.length > 0 && typeof audios[0] === 'string') {
        return Buffer.from(audios[0], 'base64');
      }
    } else {
      console.warn(`Sarvam TTS returned status ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.warn('Sarvam Bulbul TTS exception:', err);
  }
  return null;
}

/**
 * Fallback to Google Neural TTS chunk.
 */
function fetchGoogleTtsChunk(text: string, lang: string): Promise<Buffer> {
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

async function synthesizeAudio(text: string, lang: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const sarvamKey = process.env.SARVAM_API_KEY;
  const targetLangCode = lang === 'ml' ? 'ml-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';

  // 1. Primary: Sarvam Bulbul v3 for Malayalam, Hindi, and Indian English
  if (sarvamKey && sarvamKey.trim() !== '') {
    const sarvamAudio = await fetchSarvamBulbulTts(text, targetLangCode, sarvamKey);
    if (sarvamAudio && sarvamAudio.length > 0) {
      return { buffer: sarvamAudio, mimeType: 'audio/wav' };
    }
  }

  // 2. Secondary: Google Neural TTS
  const chunks = splitTextIntoChunks(text);
  if (chunks.length === 0) {
    throw new Error('No pronounceable text provided');
  }

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const buf = await fetchGoogleTtsChunk(chunk, lang);
    buffers.push(buf);
  }

  return { buffer: Buffer.concat(buffers), mimeType: 'audio/mpeg' };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || '';
    const lang = searchParams.get('lang') || 'ml';

    if (!text.trim()) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    const { buffer, mimeType } = await synthesizeAudio(text, lang);

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
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

    const { buffer, mimeType } = await synthesizeAudio(text, lang);

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
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
