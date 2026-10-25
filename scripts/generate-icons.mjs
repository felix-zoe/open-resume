#!/usr/bin/env node
/**
 * 生成 PWA 图标。
 *
 * 为什么自己画 PNG 而不是引依赖：只需要三个尺寸、一张纯几何图形，
 * 装 `sharp` / `resvg` 会往开发依赖里塞进几十 MB 原生模块，
 * 而 PNG 的容器格式（IHDR/IDAT/IEND + zlib）本身只有几十行。
 *
 * 图标内容：品牌蓝底 + 白色纸张 + 三条蓝色文字线。
 * 底铺满整个画布（而不是圆角留白），满足 maskable 图标的「安全区」要求——
 * 系统裁成圆形/水滴形时不会露出白边。
 *
 * 产物提交到 `public/`，构建时不再执行本脚本（`npm run icons` 按需重生成）。
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve(process.cwd(), 'public');
const BRAND = [0x25, 0x63, 0xeb];
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // 每行前置一个 filter 字节（0 = None）
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** 圆角矩形判定（用像素中心点） */
function inRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 + 0.001;
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const s = size;

  // 纸张（安全区内，占中间 ~46% 宽）
  const pageLeft = 0.27 * s;
  const pageRight = 0.73 * s;
  const pageTop = 0.19 * s;
  const pageBottom = 0.81 * s;
  const pageRadius = 0.05 * s;

  // 三条文字线
  const lines = [
    { y: 0.32, x2: 0.65 },
    { y: 0.44, x2: 0.65 },
    { y: 0.56, x2: 0.55 }
  ];
  const lineHeight = 0.045 * s;
  const lineLeft = 0.35 * s;

  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      let color = BRAND;

      if (inRoundedRect(x, y, pageLeft, pageTop, pageRight, pageBottom, pageRadius)) {
        color = WHITE;
        for (const line of lines) {
          const top = line.y * s;
          if (y >= top && y <= top + lineHeight && x >= lineLeft && x <= line.x2 * s) {
            color = BRAND;
            break;
          }
        }
      }

      const offset = (y * s + x) * 4;
      buf[offset] = color[0];
      buf[offset + 1] = color[1];
      buf[offset + 2] = color[2];
      buf[offset + 3] = 0xff;
    }
  }

  return buf;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `pwa-${size}x${size}.png`;
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, encodePng(size, drawIcon(size)));
  console.log(`✅ ${name} (${size}×${size})`);
}
