const http = require('http');

async function chat(message, sessionId = null) {
  const payload = JSON.stringify({ message, session_id: sessionId });
  return new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:3000/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error(data));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifyAll() {
  console.log('=== VERIFICATION SCENARIOS ===\n');

  // Test 1: Malayalam Greeting
  console.log('--- Test 1: Malayalam Greeting ("ഹലോ") ---');
  const res1 = await chat('ഹലോ');
  console.log('Response:', res1.response);
  const sessionId = res1.session_id;
  console.log('Session ID:', sessionId);

  // Test 2: English Enquiry Count (Continuing same session)
  console.log('\n--- Test 2: English Enquiry Count ("How many enquiries do we have?") ---');
  const res2 = await chat('How many enquiries do we have?', sessionId);
  console.log('Response:', res2.response);

  // Test 3: Malayalam Contact Listing ("എല്ലാ കോൺടാക്റ്റുകളുടെയും വിവരങ്ങൾ കാണിക്കൂ.")
  console.log('\n--- Test 3: Malayalam Contact Details ("എല്ലാ കോൺടാക്റ്റുകളുടെയും വിവരങ്ങൾ കാണിക്കൂ.") ---');
  const res3 = await chat('എല്ലാ കോൺടാക്റ്റുകളുടെയും വിവരങ്ങൾ കാണിക്കൂ.', sessionId);
  console.log('Response:', res3.response);

  // Test 4: Hindi Query ("आज कितने contacts हैं?")
  console.log('\n--- Test 4: Hindi Query ("आज कितने contacts हैं?") ---');
  const res4 = await chat('आज कितने contacts हैं?', sessionId);
  console.log('Response:', res4.response);

  // Test 5: CRM Analytics
  console.log('\n--- Test 5: CRM Analytics ("What is the CRM summary?") ---');
  const res5 = await chat('What is the CRM summary?', sessionId);
  console.log('Response:', res5.response);

  console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
}

verifyAll().catch(console.error);
