/**
 * Generate PWA icons as simple colored squares with text.
 * Uses Node.js Buffer to create minimal valid PNG files.
 * Run with: npx tsx scripts/generate-icons.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// Minimal PNG encoder — creates a solid color PNG with no dependencies
function createPNG(size: number, r: number, g: number, b: number): Buffer {
  const width = size;
  const height = size;

  // Raw pixel data: filter byte + RGB for each row
  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter: none
    for (let x = 0; x < width; x++) {
      // Create a gradient effect
      const gradientFactor = 1 - (y / height) * 0.3;
      rawData.push(Math.round(r * gradientFactor));
      rawData.push(Math.round(g * gradientFactor));
      rawData.push(Math.round(b * gradientFactor));
      rawData.push(255); // alpha
    }
  }

  const rawBuf = Buffer.from(rawData);

  // Deflate the raw data (use zlib)
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawBuf);

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type: string, data: Buffer): Buffer {
    const typeB = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const payload = Buffer.concat([typeB, data]);
    const crc32 = require("zlib").crc32 || crc32Fallback;
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload) >>> 0);
    return Buffer.concat([len, payload, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = chunk("IHDR", ihdr);
  const idatChunk = chunk("IDAT", compressed);
  const iendChunk = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 fallback for older Node versions
function crc32Fallback(buf: Buffer): number {
  let crc = 0xffffffff;
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = join(__dirname, "..", "public", "icons");
mkdirSync(iconsDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Emerald green: #059669 = rgb(5, 150, 105)
for (const size of sizes) {
  const png = createPNG(size, 5, 150, 105);
  const path = join(iconsDir, `icon-${size}x${size}.png`);
  writeFileSync(path, png);
  console.log(`Created ${path} (${png.length} bytes)`);
}

console.log("\nDone! Icons generated in public/icons/");
