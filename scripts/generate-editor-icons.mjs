/* 生成手机编辑器（public/editor）的 PWA 图标：紫底白色羽毛笔 */
import sharp from "sharp";

const size = 512;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7b5bf2"/>
      <stop offset="1" stop-color="#5636c9"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="112" fill="url(#bg)"/>
  <g transform="translate(136 136) scale(10)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z"/>
    <path d="M16 8 2 22"/>
    <path d="M17.5 15H9"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).resize(512, 512).png().toFile("public/editor/icon-512.png");
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile("public/editor/icon-192.png");
console.log("icons generated");
