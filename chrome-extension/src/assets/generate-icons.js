// Run this to generate icon PNGs from the SVG
// node generate-icons.js

const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [16, 48, 128];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background circle
  ctx.fillStyle = '#ef233c';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Dragon emoji approximation (simple shape)
  ctx.fillStyle = 'white';
  ctx.font = `${size * 0.6}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐉', size/2, size/2);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icon${size}.png`, buffer);
  console.log(`Generated icon${size}.png`);
}
