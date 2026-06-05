import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const testFile = 'backend/data/uploads/Section_12_in_The_Criminal_Law_Amendment_Ordinance_1944_1780373826042.PDF';
const backendUrl = 'http://127.0.0.1:5000';

async function testUpload() {
  try {
    console.log('[TEST] Testing upload endpoint...');
    console.log('[TEST] Backend URL:', backendUrl);
    console.log('[TEST] Test file:', testFile);
    
    if (!fs.existsSync(testFile)) {
      console.error('[ERROR] Test file not found:', testFile);
      process.exit(1);
    }

    const fileStream = fs.createReadStream(testFile);
    const form = new FormData();
    form.append('files', fileStream, path.basename(testFile));

    console.log('[TEST] Sending upload request...');
    const startTime = Date.now();
    
    const response = await fetch(`${backendUrl}/api/upload`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 60000, // 60 second timeout
    });

    const duration = Date.now() - startTime;
    console.log(`[TEST] Response received after ${duration}ms`);
    console.log('[TEST] Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('[TEST] Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('[TEST] ✓ Upload successful!');
    } else {
      console.error('[TEST] ✗ Upload failed!');
    }
  } catch (error) {
    console.error('[ERROR]', error.message);
    console.error('[ERROR] Details:', error);
    process.exit(1);
  }
}

testUpload();
