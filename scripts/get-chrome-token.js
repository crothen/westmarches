#!/usr/bin/env node
/**
 * Get Chrome Web Store API Refresh Token
 * 
 * Run this once to get your refresh token:
 * 1. Set CHROME_CLIENT_ID and CHROME_CLIENT_SECRET env vars
 * 2. Run: node scripts/get-chrome-token.js
 * 3. Open the URL in browser, authorize, copy the code
 * 4. Paste the code when prompted
 * 5. Save the refresh token to .env
 */

const readline = require('readline');

const CLIENT_ID = process.env.CHROME_CLIENT_ID;
const CLIENT_SECRET = process.env.CHROME_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Set CHROME_CLIENT_ID and CHROME_CLIENT_SECRET environment variables first');
  console.log('\nExample:');
  console.log('  export CHROME_CLIENT_ID="your-client-id.apps.googleusercontent.com"');
  console.log('  export CHROME_CLIENT_SECRET="your-client-secret"');
  process.exit(1);
}

const SCOPES = 'https://www.googleapis.com/auth/chromewebstore';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(SCOPES)}`;

console.log('🔗 Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('📝 Paste the authorization code here: ', async (code) => {
  rl.close();
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code.trim(),
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error_description || data.error);
      process.exit(1);
    }
    
    console.log('\n✅ Success! Add these to your .env file:\n');
    console.log(`CHROME_CLIENT_ID=${CLIENT_ID}`);
    console.log(`CHROME_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`CHROME_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`CHROME_EXTENSION_ID=pjfgbggijdiijaabflnpdgmekainmaok`);
    console.log('\nThen run: node scripts/publish-extension.js');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
});
