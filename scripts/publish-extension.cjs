#!/usr/bin/env node
/**
 * Chrome Web Store Extension Publisher
 * 
 * Setup:
 * 1. Set environment variables or create .env file:
 *    - CHROME_CLIENT_ID
 *    - CHROME_CLIENT_SECRET
 *    - CHROME_REFRESH_TOKEN
 *    - CHROME_EXTENSION_ID
 * 
 * 2. Run: node scripts/publish-extension.js
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Load env from .env file if exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const CLIENT_ID = process.env.CHROME_CLIENT_ID;
const CLIENT_SECRET = process.env.CHROME_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CHROME_REFRESH_TOKEN;
const EXTENSION_ID = process.env.CHROME_EXTENSION_ID || 'pjfgbggijdiijaabflnpdgmekainmaok';

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

async function createZip() {
  const zipPath = path.join(__dirname, '..', 'chrome-extension.zip');
  const extensionDir = path.join(__dirname, '..', 'chrome-extension');
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`📦 Created zip: ${archive.pointer()} bytes`);
      resolve(zipPath);
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(extensionDir, false);
    archive.finalize();
  });
}

async function uploadExtension(accessToken, zipPath) {
  const zipBuffer = fs.readFileSync(zipPath);
  
  console.log('📤 Uploading to Chrome Web Store...');
  
  const response = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${EXTENSION_ID}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-api-version': '2'
      },
      body: zipBuffer
    }
  );
  
  const data = await response.json();
  
  if (data.uploadState === 'FAILURE') {
    throw new Error(`Upload failed: ${JSON.stringify(data.itemError || data)}`);
  }
  
  console.log('✅ Upload successful');
  return data;
}

async function publishExtension(accessToken) {
  console.log('🚀 Publishing extension...');
  
  const response = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${EXTENSION_ID}/publish`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Length': '0'
      }
    }
  );
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Publish failed: ${JSON.stringify(data.error)}`);
  }
  
  console.log('✅ Published successfully!');
  console.log('   Status:', data.status);
  return data;
}

async function bumpVersion() {
  const manifestPath = path.join(__dirname, '..', 'chrome-extension', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  
  // Bump patch version
  const parts = manifest.version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  manifest.version = parts.join('.');
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`📝 Bumped version to ${manifest.version}`);
  
  return manifest.version;
}

async function main() {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      console.error('❌ Missing credentials. Set CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, and CHROME_REFRESH_TOKEN');
      console.log('\nTo get refresh token, run: node scripts/get-chrome-token.js');
      process.exit(1);
    }
    
    // Bump version
    const version = await bumpVersion();
    
    // Create zip
    const zipPath = await createZip();
    
    // Get access token
    console.log('🔑 Getting access token...');
    const accessToken = await getAccessToken();
    
    // Upload
    await uploadExtension(accessToken, zipPath);
    
    // Publish
    await publishExtension(accessToken);
    
    // Cleanup
    fs.unlinkSync(zipPath);
    
    console.log(`\n🎉 Extension v${version} published to Chrome Web Store!`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
