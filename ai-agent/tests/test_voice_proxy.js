const http = require('http');

async function run() {
  const speakData = JSON.stringify({
    text: 'എത്ര കോൺടാക്റ്റുകൾ ഉണ്ട്?',
    language: 'ml-IN'
  });

  const audioBuf = await new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:8000/agent/voice/speak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(speakData)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.write(speakData);
    req.end();
  });

  console.log('Step 1: Generated sample Malayalam speech audio bytes:', audioBuf.length);

  // Step 2: Upload as multipart form data to Next.js /api/agent/voice
  const boundary = '----WebKitFormBoundaryXyZ12345';
  const postDataHeader = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="audio"; filename="malayalam_sample.mp3"\r\n` +
    `Content-Type: audio/mpeg\r\n\r\n`
  );
  const postDataFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fullBody = Buffer.concat([postDataHeader, audioBuf, postDataFooter]);

  const voiceResponse = await new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:3000/api/agent/voice', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });

  console.log('Step 2: Next.js /api/agent/voice response status:', voiceResponse.status);
  const parsed = JSON.parse(voiceResponse.body);
  console.log('Status:', parsed.status);
  console.log('Transcript:', parsed.transcript);
  console.log('Detected Language:', parsed.detected_language);
  console.log('AI Response:', parsed.response);
  console.log('Base64 Audio Length:', (parsed.audio_base64 || '').length);
}

run().catch(console.error);
