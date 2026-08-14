const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..', 'gallery');
const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];
const sizes = [800, 1024, 1280, 1600];
const labels = ['set-a', 'set-b', 'set-c'];

async function makeImage(filePath, label, i) {
  const w = sizes[i % sizes.length];
  const h = Math.round(w * 0.75);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${colors[i % colors.length]}"/>
    <text x="50%" y="50%" font-size="${Math.round(w/12)}" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${label}-${i}</text>
  </svg>`);
  await sharp(svg).jpeg({ quality: 80 }).toFile(filePath);
}

async function run() {
  // nested folder set
  const setA = path.join(root, '集合A-风光');
  fs.mkdirSync(setA, { recursive: true });
  for (let i = 0; i < 6; i++) await makeImage(path.join(setA, `图片${i + 1}.jpg`), 'A', i);

  const setB = path.join(root, '集合B-人物');
  fs.mkdirSync(setB, { recursive: true });
  const sub = path.join(setB, '子目录-写真');
  fs.mkdirSync(sub, { recursive: true });
  for (let i = 0; i < 5; i++) await makeImage(path.join(sub, `photo${i + 1}.png`), 'B', i + 2);
  await makeImage(path.join(setB, 'cover.jpg'), 'B', 0);

  // nested deeper dir
  const setC = path.join(root, '集合C-建筑');
  fs.mkdirSync(setC, { recursive: true });
  const deep = path.join(setC, '楼层', '屋顶');
  fs.mkdirSync(deep, { recursive: true });
  for (let i = 0; i < 4; i++) await makeImage(path.join(deep, `roof${i + 1}.webp`), 'C', i + 1);

  // gif & bmp & avif
  const mixed = path.join(root, '集合D-混合格式');
  fs.mkdirSync(mixed, { recursive: true });
  await makeImage(path.join(mixed, 'bmp1.bmp'), 'D', 1);
  await makeImage(path.join(mixed, 'tiff1.tiff'), 'D', 2);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#2ecc71"/><circle cx="200" cy="150" r="80" fill="#e74c3c"/></svg>');
  fs.writeFileSync(path.join(mixed, 'vector.svg'), svg);

  console.log('Test gallery generated at', root);
}

run().catch((e) => { console.error(e); process.exit(1); });
