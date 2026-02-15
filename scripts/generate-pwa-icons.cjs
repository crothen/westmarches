const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background - dark with subtle gradient
  const bgGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size * 0.7);
  bgGrad.addColorStop(0, '#1a1a1a');
  bgGrad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);
  
  // Center point
  const cx = size / 2;
  const cy = size / 2;
  
  // Outer ring
  const ringRadius = size * 0.42;
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#ef233c';
  ctx.lineWidth = size * 0.02;
  ctx.stroke();
  
  // Inner ring
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius * 0.85, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(239, 35, 60, 0.3)';
  ctx.lineWidth = size * 0.01;
  ctx.stroke();
  
  // Compass rose
  const outerRadius = size * 0.32;
  const innerRadius = size * 0.1;
  
  ctx.save();
  ctx.translate(cx, cy);
  
  // Draw 8 points
  const points = 8;
  const mainPoints = [0, 2, 4, 6]; // N, E, S, W
  
  for (let i = 0; i < points; i++) {
    const angle = (i * Math.PI * 2) / points - Math.PI / 2;
    const isMain = mainPoints.includes(i);
    const pointLength = isMain ? outerRadius : outerRadius * 0.6;
    
    ctx.save();
    ctx.rotate(angle);
    
    ctx.beginPath();
    ctx.moveTo(0, -pointLength);
    ctx.lineTo(innerRadius * 0.4, -innerRadius * 0.25);
    ctx.lineTo(0, innerRadius * 0.15);
    ctx.lineTo(-innerRadius * 0.4, -innerRadius * 0.25);
    ctx.closePath();
    
    if (i === 0) {
      // North - red accent
      const pointGrad = ctx.createLinearGradient(0, -pointLength, 0, 0);
      pointGrad.addColorStop(0, '#ef233c');
      pointGrad.addColorStop(1, '#8b1538');
      ctx.fillStyle = pointGrad;
    } else if (isMain) {
      ctx.fillStyle = '#f5f5f5';
    } else {
      ctx.fillStyle = 'rgba(245, 245, 245, 0.5)';
    }
    ctx.fill();
    
    ctx.restore();
  }
  
  // Center dot
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#ef233c';
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  
  ctx.restore();
  
  return canvas;
}

// Generate PWA icons
const outputDir = path.join(__dirname, '..', 'public');

[192, 512].forEach(size => {
  const canvas = generateIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const filepath = path.join(outputDir, `pwa-${size}x${size}.png`);
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated ${filepath}`);
});

// Also generate apple-touch-icon (180x180)
const appleCanvas = generateIcon(180);
fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), appleCanvas.toBuffer('image/png'));
console.log('Generated apple-touch-icon.png');

// Generate favicon (32x32)
const faviconCanvas = generateIcon(32);
fs.writeFileSync(path.join(outputDir, 'favicon.ico'), faviconCanvas.toBuffer('image/png'));
console.log('Generated favicon.ico');

console.log('Done!');
