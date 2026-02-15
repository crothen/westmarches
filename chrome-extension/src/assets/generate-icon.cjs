const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const padding = size * 0.1;
  const cornerRadius = size * 0.18;
  
  // Background - dark red gradient
  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, '#8B1538');
  bgGrad.addColorStop(1, '#5C0E24');
  
  // Rounded rectangle background
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, cornerRadius);
  ctx.fillStyle = bgGrad;
  ctx.fill();
  
  // Center point
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size * 0.38;
  const innerRadius = size * 0.12;
  
  // Compass rose - 8 points
  ctx.save();
  ctx.translate(cx, cy);
  
  // Draw the compass points
  const points = 8;
  const mainPoints = [0, 2, 4, 6]; // N, E, S, W
  
  for (let i = 0; i < points; i++) {
    const angle = (i * Math.PI * 2) / points - Math.PI / 2; // Start from top
    const isMain = mainPoints.includes(i);
    const pointLength = isMain ? outerRadius : outerRadius * 0.65;
    
    ctx.save();
    ctx.rotate(angle);
    
    // Draw diamond/arrow shape
    ctx.beginPath();
    ctx.moveTo(0, -pointLength);
    ctx.lineTo(innerRadius * 0.5, -innerRadius * 0.3);
    ctx.lineTo(0, innerRadius * 0.2);
    ctx.lineTo(-innerRadius * 0.5, -innerRadius * 0.3);
    ctx.closePath();
    
    // North point is highlighted
    if (i === 0) {
      const pointGrad = ctx.createLinearGradient(0, -pointLength, 0, 0);
      pointGrad.addColorStop(0, '#FFD700');
      pointGrad.addColorStop(1, '#FFA500');
      ctx.fillStyle = pointGrad;
    } else if (isMain) {
      ctx.fillStyle = '#F5F5F5';
    } else {
      ctx.fillStyle = 'rgba(245, 245, 245, 0.6)';
    }
    ctx.fill();
    
    ctx.restore();
  }
  
  // Center circle
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  
  // Inner dot
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#5C0E24';
  ctx.fill();
  
  ctx.restore();
  
  return canvas;
}

// Generate all sizes
const sizes = [16, 48, 128];
const outputDir = __dirname;

sizes.forEach(size => {
  const canvas = generateIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const filepath = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated ${filepath}`);
});

console.log('Done!');
