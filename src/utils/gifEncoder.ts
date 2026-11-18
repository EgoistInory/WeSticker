/**
 * Pure-Frontend Binary GIF89a Encoder with Transparency & Micro-Motion Frame Synthesizer
 * Solves the "fake .gif (renamed PNG)" rejection issue on WeChat Sticker Open Platform.
 */

export type MotionPreset = 'static' | 'bounce' | 'wiggle' | 'pulse';

/**
 * Quantizes RGBA ImageData into a 256-color 3-3-2 palette with index 0 reserved for full transparency.
 */
function quantizeFrameTo256(imageData: ImageData): { indexedPixels: Uint8Array; palette: Uint8Array } {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const indexedPixels = new Uint8Array(pixelCount);
  const palette = new Uint8Array(256 * 3);

  // Index 0 is reserved for transparent pixel
  palette[0] = 0;
  palette[1] = 0;
  palette[2] = 0;

  // Build deterministic 255-color RGB cube (R: 6 levels, G: 7 levels, B: 6 levels = 252 colors + grays)
  let idx = 1;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 7; g++) {
      for (let b = 0; b < 6; b++) {
        if (idx >= 256) break;
        palette[idx * 3] = Math.round((r * 255) / 5);
        palette[idx * 3 + 1] = Math.round((g * 255) / 6);
        palette[idx * 3 + 2] = Math.round((b * 255) / 5);
        idx++;
      }
    }
  }
  // Fill remaining slots with pure white/grays for crisp sticker strokes
  palette[253 * 3] = 245; palette[253 * 3 + 1] = 245; palette[253 * 3 + 2] = 245;
  palette[254 * 3] = 250; palette[254 * 3 + 1] = 250; palette[254 * 3 + 2] = 250;
  palette[255 * 3] = 255; palette[255 * 3 + 1] = 255; palette[255 * 3 + 2] = 255;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const a = data[offset + 3];
    if (a < 96) {
      // Transparent
      indexedPixels[i] = 0;
    } else {
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (r > 248 && g > 248 && b > 248) {
        indexedPixels[i] = 255;
      } else {
        const rIdx = Math.round((r * 5) / 255);
        const gIdx = Math.round((g * 6) / 255);
        const bIdx = Math.round((b * 5) / 255);
        const colorIndex = 1 + rIdx * 42 + gIdx * 6 + bIdx;
        indexedPixels[i] = Math.min(252, Math.max(1, colorIndex));
      }
    }
  }

  return { indexedPixels, palette };
}

/**
 * Standard GIF LZW Encoder for 8-bit indexed pixel arrays (minCodeSize = 8)
 */
function lzwEncode(indexedPixels: Uint8Array, minCodeSize = 8): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const outBytes: number[] = [minCodeSize];

  let bitBuffer = 0;
  let bitCount = 0;
  const subBlock: number[] = [];

  const flushSubBlock = () => {
    if (subBlock.length > 0) {
      outBytes.push(subBlock.length);
      for (let i = 0; i < subBlock.length; i++) {
        outBytes.push(subBlock[i]);
      }
      subBlock.length = 0;
    }
  };

  const writeCode = (code: number, size: number) => {
    bitBuffer |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      subBlock.push(bitBuffer & 0xff);
      if (subBlock.length === 255) {
        flushSubBlock();
      }
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<number, number>();

  writeCode(clearCode, codeSize);

  if (indexedPixels.length > 0) {
    let prefix = indexedPixels[0];
    for (let i = 1; i < indexedPixels.length; i++) {
      const k = indexedPixels[i];
      const key = (prefix << 8) | k;
      const found = dict.get(key);
      if (found !== undefined) {
        prefix = found;
      } else {
        writeCode(prefix, codeSize);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeCode(clearCode, codeSize);
          dict.clear();
          codeSize = minCodeSize + 1;
          nextCode = eoiCode + 1;
        }
        prefix = k;
      }
    }
    writeCode(prefix, codeSize);
  }

  writeCode(eoiCode, codeSize);
  if (bitCount > 0) {
    subBlock.push(bitBuffer & 0xff);
  }
  flushSubBlock();
  outBytes.push(0x00); // Block terminator

  return new Uint8Array(outBytes);
}

/**
 * Encodes one or multiple ImageData frames into a spec-compliant GIF89a Blob.
 */
export function encodeGIF89a(frames: ImageData[], delayCs = 8): Blob {
  if (frames.length === 0) {
    throw new Error('Cannot encode GIF with 0 frames');
  }
  const width = frames[0].width;
  const height = frames[0].height;
  const chunks: Uint8Array[] = [];

  const { palette } = quantizeFrameTo256(frames[0]);

  // 1. Header: GIF89a + Logical Screen Descriptor
  const header = new Uint8Array(13);
  header.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
  header[6] = width & 0xff;
  header[7] = (width >> 8) & 0xff;
  header[8] = height & 0xff;
  header[9] = (height >> 8) & 0xff;
  header[10] = 0xf7; // Global Color Table Flag (1), Color Res (7), Sort (0), Size of GCT (7 -> 256 colors)
  header[11] = 0x00; // Background color index (0 = transparent)
  header[12] = 0x00; // Pixel aspect ratio
  chunks.push(header);

  // 2. Global Color Table (768 bytes)
  chunks.push(palette);

  // 3. Netscape 2.0 Infinite Loop Application Extension (if multi-frame)
  if (frames.length > 1) {
    const netscapeExt = new Uint8Array([
      0x21, 0xff, 0x0b,
      0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, // "NETSCAPE2.0"
      0x03, 0x01, 0x00, 0x00, 0x00 // Infinite loop
    ]);
    chunks.push(netscapeExt);
  }

  // 4. Encode Each Frame
  for (let i = 0; i < frames.length; i++) {
    const { indexedPixels } = quantizeFrameTo256(frames[i]);

    // Graphic Control Extension (with Transparency Index = 0 & Disposal = 2 Restore to Background)
    const gce = new Uint8Array([
      0x21, 0xf9, 0x04,
      0x09, // Disposal method 2 (Restore to bg) + Transparent Color Flag (1)
      delayCs & 0xff, (delayCs >> 8) & 0xff,
      0x00, // Transparent Color Index = 0
      0x00
    ]);
    chunks.push(gce);

    // Image Descriptor
    const imgDesc = new Uint8Array([
      0x2c,
      0x00, 0x00, 0x00, 0x00, // Left, Top = 0, 0
      width & 0xff, (width >> 8) & 0xff,
      height & 0xff, (height >> 8) & 0xff,
      0x00 // No local color table
    ]);
    chunks.push(imgDesc);

    // LZW Compressed Image Data
    chunks.push(lzwEncode(indexedPixels, 8));
  }

  // 5. Trailer
  chunks.push(new Uint8Array([0x3b]));

  return new Blob(chunks as BlobPart[], { type: 'image/gif' });
}

/**
 * Synthesizes a 1-frame or multi-frame animated GIF89a from a rendered sticker canvas,
 * while strictly maintaining the outer `padding` transparent safe border!
 */
export function synthesizeStickerGIF(
  baseCanvas: HTMLCanvasElement,
  motion: MotionPreset = 'static',
  padding = 2
): Blob {
  const size = baseCanvas.width;
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = size;
  frameCanvas.height = size;
  const ctx = frameCanvas.getContext('2d', { willReadFrequently: true })!;

  const clearOuterPadding = () => {
    if (padding <= 0) return;
    ctx.clearRect(0, 0, size, padding);
    ctx.clearRect(0, size - padding, size, padding);
    ctx.clearRect(0, 0, padding, size);
    ctx.clearRect(size - padding, 0, padding, size);
  };

  if (motion === 'static') {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(baseCanvas, 0, 0);
    clearOuterPadding();
    return encodeGIF89a([ctx.getImageData(0, 0, size, size)], 10);
  }

  const frames: ImageData[] = [];
  const totalFrames = 6;

  for (let f = 0; f < totalFrames; f++) {
    const t = (f / totalFrames) * Math.PI * 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);

    if (motion === 'bounce') {
      // Q-elastic squash & stretch
      const scaleX = 1 + Math.sin(t) * 0.045;
      const scaleY = 1 - Math.sin(t) * 0.045;
      const offsetY = -Math.abs(Math.sin(t)) * 4;
      ctx.translate(0, offsetY);
      ctx.scale(scaleX, scaleY);
    } else if (motion === 'wiggle') {
      // Playful rotation wiggle
      const angle = Math.sin(t) * 0.065;
      ctx.rotate(angle);
    } else if (motion === 'pulse') {
      // Heartbeat scale pulse
      const s = 0.96 + (Math.sin(t) + 1) * 0.03;
      ctx.scale(s, s);
    }

    ctx.drawImage(baseCanvas, -size / 2, -size / 2);
    ctx.restore();

    // Enforce WeChat mandatory 2px outer safety margin on every animated frame
    clearOuterPadding();
    frames.push(ctx.getImageData(0, 0, size, size));
  }

  return encodeGIF89a(frames, 9);
}
