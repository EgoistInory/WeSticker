import { MotionPreset, synthesizeStickerGIF } from './gifEncoder';

export type CaptionStyle = 'classic-white' | 'pop-yellow' | 'cyber-emerald' | 'flame-red';

export interface StickerCraftOptions {
  /** Enable smart background chroma-key removal */
  removeBg: boolean;
  /** Color distance tolerance (0-100) for background removal */
  bgTolerance: number;
  /** Target background color mode: 'auto-corner' | 'white' | 'green' | 'black' */
  bgKeyMode: 'auto-corner' | 'white' | 'green' | 'black';
  /** Background removal algorithm: 'flood-fill' protects internal whites; 'global' removes all matching color */
  bgAlgorithm?: 'flood-fill' | 'global';
  /** Panda/White-Face Shield: protects light/white regions enclosed by dark character outlines & seals small line gaps */
  protectInteriorWhites?: boolean;
  /** Morphological gap-closing radius in px (1-6px) to prevent flood-fill leaking through broken line-art */
  gapClosingPx?: number;
  /** Die-cut contour border width in px (0 = off, 1-12px) */
  strokeWidth: number;
  /** Die-cut contour border color (default #FFFFFF) */
  strokeColor: string;
  /** Add subtle contact drop shadow for dark/light chat contrast */
  dropShadow: boolean;
  /** Bottom meme caption text */
  caption: string;
  /** Visual style preset for the meme caption */
  captionStyle: CaptionStyle;
  /** Relative font size multiplier for caption (0.75 - 1.35) */
  captionScale?: number;
  /** Motion preset for GIF89a export */
  motion: MotionPreset;
  /** Export binary format: 'gif89a' (real GIF binary) or 'png' */
  exportFormat: 'gif89a' | 'png';
  /** Optional user-painted repair mask (+255 = force restore original pixel, -255 = force erase pixel) */
  repairMaskData?: Int8Array | null;
}

export const DEFAULT_CRAFT_OPTIONS: StickerCraftOptions = {
  removeBg: true,
  bgTolerance: 24,
  bgKeyMode: 'auto-corner',
  bgAlgorithm: 'flood-fill',
  protectInteriorWhites: true,
  gapClosingPx: 3,
  strokeWidth: 4,
  strokeColor: '#FFFFFF',
  dropShadow: true,
  caption: '',
  captionStyle: 'classic-white',
  captionScale: 1.0,
  motion: 'static',
  exportFormat: 'gif89a',
  repairMaskData: null,
};

export interface ProcessedStickerResult {
  blob: Blob;
  gifBlob: Blob;
  canvas: HTMLCanvasElement;
  bleedAudit: {
    passed: boolean;
    cleanRatio: number;
  };
}

/**
 * Loads a File, Blob, or dataURL into an HTMLImageElement.
 */
export const loadImage = (source: File | Blob | string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const isObjectUrl = typeof source !== 'string';
    const url = isObjectUrl ? URL.createObjectURL(source) : source;

    img.onload = () => {
      if (isObjectUrl) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      if (isObjectUrl) URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
};

/**
 * Smart Chroma-Key & Gap-Sealed Flood-Fill Background Removal with Panda/White-Face Interior Shield.
 *
 * Solves the classic AI sticker bug where white-faced characters (Pandas, White Cats, Bunnies, White Shirts)
 * on white backgrounds get their faces hollowed out due to 1-5px line-art gaps or bottom-edge bust cutoffs!
 */
function applySmartChromaKey(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: StickerCraftOptions['bgKeyMode'],
  tolerance: number,
  algorithm: 'flood-fill' | 'global' = 'flood-fill',
  protectInteriorWhites: boolean = true,
  gapClosingPx: number = 3
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  let keyR = 255, keyG = 255, keyB = 255;
  if (mode === 'white') {
    keyR = 255; keyG = 255; keyB = 255;
  } else if (mode === 'green') {
    keyR = 0; keyG = 255; keyB = 0;
  } else if (mode === 'black') {
    keyR = 0; keyG = 0; keyB = 0;
  } else {
    // Sample 8 perimeter points (corners + mid-edges)
    const coords = [
      [2, 2],
      [width - 3, 2],
      [2, height - 3],
      [width - 3, height - 3],
      [Math.floor(width / 2), 2],
      [Math.floor(width / 2), height - 3],
      [2, Math.floor(height / 2)],
      [width - 3, Math.floor(height / 2)],
    ];
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (const [cx, cy] of coords) {
      if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
        const idx = (cy * width + cx) * 4;
        if (data[idx + 3] > 128) {
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }
    }
    if (count === 0) return; // Already transparent perimeter!
    keyR = Math.round(rSum / count);
    keyG = Math.round(gSum / count);
    keyB = Math.round(bSum / count);
  }

  const maxDist = Math.max(4, (tolerance / 100) * 210);
  const featherRange = Math.max(10, maxDist * 0.3);

  const colorDist = (pixelIndex: number): number => {
    const offset = pixelIndex * 4;
    const dr = data[offset] - keyR;
    const dg = data[offset + 1] - keyG;
    const db = data[offset + 2] - keyB;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  if (algorithm === 'flood-fill') {
    // 1. Identify solid non-background "Wall" pixels (e.g. black outlines, ears, eyes, colored clothes)
    const wallThreshold = Math.max(32, maxDist + 14);
    const isHardWall = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      if (data[i * 4 + 3] > 90 && colorDist(i) > wallThreshold) {
        isHardWall[i] = 1;
      }
    }

    // 2. Build Morphological Gap-Closing Barrier + Bottom Bust Cut-Off Seal when protectInteriorWhites is enabled
    const isProtectedInterior = new Uint8Array(totalPixels);
    if (protectInteriorWhites) {
      // 2a. Morphological Dilation Gap-Closing (radius r = 4px bridges up to 8px broken line-art gaps!)
      const r = Math.max(2, Math.min(7, gapClosingPx));
      const dilatedWall = new Uint8Array(totalPixels);
      for (let y = 0; y < height; y++) {
        const rOff = y * width;
        for (let x = 0; x < width; x++) {
          if (!isHardWall[rOff + x]) continue;
          const y0 = Math.max(0, y - r);
          const y1 = Math.min(height - 1, y + r);
          const x0 = Math.max(0, x - r);
          const x1 = Math.min(width - 1, x + r);
          for (let ny = y0; ny <= y1; ny++) {
            const nOff = ny * width;
            for (let nx = x0; nx <= x1; nx++) {
              dilatedWall[nOff + nx] = 1;
            }
          }
        }
      }

      // 2b. Bottom Bust Cut-Off Seal: if a half-body character's left & right outlines reach near the bottom edge,
      // seal the bottom border segment between them so flood-fill doesn't rush up through an open white shirt/neck!
      let botMinX = width, botMaxX = -1;
      for (let y = Math.max(0, height - 10); y < height; y++) {
        const rOff = y * width;
        for (let x = 0; x < width; x++) {
          if (isHardWall[rOff + x]) {
            if (x < botMinX) botMinX = x;
            if (x > botMaxX) botMaxX = x;
          }
        }
      }
      if (botMaxX > botMinX && botMaxX - botMinX < width * 0.85) {
        for (let y = Math.max(0, height - r - 1); y < height; y++) {
          const rOff = y * width;
          for (let x = botMinX; x <= botMaxX; x++) {
            dilatedWall[rOff + x] = 1;
          }
        }
      }

      // 2c. Run Choked Flood-Fill from outer edges against `dilatedWall`
      const outsideBg = new Uint8Array(totalPixels);
      const q = new Int32Array(totalPixels);
      let qH = 0, qT = 0;

      const isBgCandidate = (idx: number): boolean => {
        if (data[idx * 4 + 3] < 32) return true;
        return colorDist(idx) <= maxDist;
      };

      const pushSeed = (x: number, y: number) => {
        const idx = y * width + x;
        if (outsideBg[idx] || dilatedWall[idx]) return;
        if (isBgCandidate(idx)) {
          outsideBg[idx] = 1;
          q[qT++] = idx;
        }
      };

      for (let x = 0; x < width; x++) {
        pushSeed(x, 0);
        pushSeed(x, height - 1);
      }
      for (let y = 1; y < height - 1; y++) {
        pushSeed(0, y);
        pushSeed(width - 1, y);
      }

      while (qH < qT) {
        const curr = q[qH++];
        const cx = curr % width;
        const cy = (curr - cx) / width;

        if (cx > 0) pushSeed(cx - 1, cy);
        if (cx < width - 1) pushSeed(cx + 1, cy);
        if (cy > 0) pushSeed(cx, cy - 1);
        if (cy < height - 1) pushSeed(cx, cy + 1);
      }

      // 2d. Expand `outsideBg` back by `r + 1` steps ONLY into non-hard-wall pixels
      // so the `r`-pixel dilation buffer right outside the black outline is cleanly removed too!
      let currentWave = new Uint8Array(outsideBg);
      for (let step = 0; step < r + 1; step++) {
        const nextWave = new Uint8Array(currentWave);
        for (let y = 0; y < height; y++) {
          const rOff = y * width;
          for (let x = 0; x < width; x++) {
            const idx = rOff + x;
            if (currentWave[idx] || isHardWall[idx]) continue;
            const hasBgNeighbor =
              (x > 0 && currentWave[idx - 1]) ||
              (x < width - 1 && currentWave[idx + 1]) ||
              (y > 0 && currentWave[idx - width]) ||
              (y < height - 1 && currentWave[idx + width]);
            if (hasBgNeighbor && colorDist(idx) <= maxDist + featherRange) {
              nextWave[idx] = 1;
            }
          }
        }
        currentWave = nextWave;
      }

      // Any pixel NOT reached by `currentWave` is protected interior (Panda white face, white eyes, white shirt)!
      for (let i = 0; i < totalPixels; i++) {
        if (!currentWave[i]) {
          isProtectedInterior[i] = 1;
        }
      }
    }

    // 3. Final Flood-Fill Alpha Extraction respecting `isProtectedInterior`
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const tryEnqueue = (x: number, y: number) => {
      const idx = y * width + x;
      if (visited[idx] || isProtectedInterior[idx]) return;
      const d = colorDist(idx);
      if (d <= maxDist + featherRange) {
        visited[idx] = 1;
        queue[tail++] = idx;
      }
    };

    for (let x = 0; x < width; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
      tryEnqueue(0, y);
      tryEnqueue(width - 1, y);
    }

    while (head < tail) {
      const curr = queue[head++];
      const d = colorDist(curr);
      const offset = curr * 4;

      if (d <= maxDist) {
        data[offset + 3] = 0;
        const cx = curr % width;
        const cy = (curr - cx) / width;
        if (cx > 0) tryEnqueue(cx - 1, cy);
        if (cx < width - 1) tryEnqueue(cx + 1, cy);
        if (cy > 0) tryEnqueue(cx, cy - 1);
        if (cy < height - 1) tryEnqueue(cx, cy + 1);
      } else if (d <= maxDist + featherRange) {
        const factor = (d - maxDist) / featherRange;
        data[offset + 3] = Math.round(data[offset + 3] * factor);
      }
    }
  } else {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const dr = data[i] - keyR;
      const dg = data[i + 1] - keyG;
      const db = data[i + 2] - keyB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= maxDist) {
        data[i + 3] = 0;
      } else if (dist <= maxDist + featherRange) {
        const factor = (dist - maxDist) / featherRange;
        data[i + 3] = Math.round(data[i + 3] * factor);
      }
    }
  }

  // 4. Despeckle isolated 1-2px floating alpha dust islands so they don't grow into ugly white stroke blobs
  const alphaCopy = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) alphaCopy[i] = data[i * 4 + 3];
  for (let y = 1; y < height - 1; y++) {
    const rOff = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rOff + x;
      if (alphaCopy[idx] === 0) continue;
      let solidNeighbors = 0;
      if (alphaCopy[idx - 1] > 40) solidNeighbors++;
      if (alphaCopy[idx + 1] > 40) solidNeighbors++;
      if (alphaCopy[idx - width] > 40) solidNeighbors++;
      if (alphaCopy[idx + width] > 40) solidNeighbors++;
      if (solidNeighbors === 0) {
        data[idx * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Renders high-impact sticker caption text at the bottom safe zone.
 */
function renderStickerCaption(
  ctx: CanvasRenderingContext2D,
  targetSize: number,
  padding: number,
  caption: string,
  style: CaptionStyle
) {
  const text = caption.trim();
  if (!text) return;

  ctx.save();
  const fontSize = Math.max(18, Math.min(38, Math.floor((targetSize * 0.82) / Math.max(2.6, text.length * 0.72))));
  ctx.font = `900 ${fontSize}px "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const x = targetSize / 2;
  const y = targetSize - Math.max(padding + 6, 10);

  let fillStyle: string | CanvasGradient = '#FFFFFF';
  let outerStroke = '#111318';
  let innerStroke = '#FFFFFF';

  if (style === 'classic-white') {
    fillStyle = '#FFFFFF';
    outerStroke = '#14161D';
    innerStroke = '#14161D';
  } else if (style === 'pop-yellow') {
    const grad = ctx.createLinearGradient(0, y - fontSize, 0, y);
    grad.addColorStop(0, '#FFF066');
    grad.addColorStop(1, '#FFAA00');
    fillStyle = grad;
    outerStroke = '#FFFFFF';
    innerStroke = '#18181B';
  } else if (style === 'cyber-emerald') {
    const grad = ctx.createLinearGradient(0, y - fontSize, 0, y);
    grad.addColorStop(0, '#6EE7B7');
    grad.addColorStop(1, '#07C160');
    fillStyle = grad;
    outerStroke = '#FFFFFF';
    innerStroke = '#062819';
  } else if (style === 'flame-red') {
    const grad = ctx.createLinearGradient(0, y - fontSize, 0, y);
    grad.addColorStop(0, '#FF8A65');
    grad.addColorStop(1, '#FF3B30');
    fillStyle = grad;
    outerStroke = '#FFFFFF';
    innerStroke = '#2A0806';
  }

  // Outer white sticker halo
  if (style !== 'classic-white') {
    ctx.strokeStyle = outerStroke;
    ctx.lineWidth = Math.max(7, Math.round(fontSize * 0.34));
    ctx.strokeText(text, x, y);
  }

  // Dark contrast stroke
  ctx.strokeStyle = innerStroke;
  ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.2));
  ctx.strokeText(text, x, y);

  // Main fill
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Audits whether the outer `padding` pixels on all 4 sides of the canvas are 100% transparent.
 */
export function verifyBleedSafety(imageData: ImageData, padding = 2): { passed: boolean; cleanRatio: number } {
  if (padding <= 0) return { passed: true, cleanRatio: 1 };
  const { data, width, height } = imageData;
  let totalBorderPixels = 0;
  let cleanPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder = x < padding || x >= width - padding || y < padding || y >= height - padding;
      if (isBorder) {
        totalBorderPixels++;
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha === 0) cleanPixels++;
      }
    }
  }

  const ratio = totalBorderPixels > 0 ? cleanPixels / totalBorderPixels : 1;
  return {
    passed: cleanPixels === totalBorderPixels,
    cleanRatio: ratio,
  };
}

/**
 * Core Sticker Processing Engine:
 * - Aspect-ratio preserving fit within safe zone (`targetSize - padding * 2 - strokeMargin * 2`)
 * - Optional Smart Chroma-Key background removal
 * - Optional Morphological Die-Cut White Contour Stroke + Drop Shadow
 * - Optional Meme Typography Caption
 * - Strict enforcement of `padding` (2px) transparent border
 */
export const processTransparentSticker = async (
  file: File | Blob | string,
  targetSize: number = 240,
  padding: number = 2,
  craft?: Partial<StickerCraftOptions>
): Promise<ProcessedStickerResult> => {
  const opts: StickerCraftOptions = { ...DEFAULT_CRAFT_OPTIONS, ...(craft || {}) };
  const img = await loadImage(file);

  // Reserve room for outer padding + die-cut stroke + drop shadow so nothing clips!
  const effectiveStroke = targetSize >= 120 ? opts.strokeWidth : Math.max(0, Math.round(opts.strokeWidth * (targetSize / 240)));
  const shadowReserve = opts.dropShadow && targetSize >= 120 ? 3 : 0;
  const totalInset = padding + effectiveStroke + shadowReserve;
  const safeMaxDim = Math.max(16, targetSize - totalInset * 2);

  const scale = Math.min(safeMaxDim / img.width, safeMaxDim / img.height);
  const drawW = Math.max(1, Math.round(img.width * scale));
  const drawH = Math.max(1, Math.round(img.height * scale));
  const offsetX = Math.round((targetSize - drawW) / 2);
  // Leave slight bottom bias if caption is active
  const captionBias = opts.caption.trim() && targetSize >= 120 ? Math.round(targetSize * 0.045) : 0;
  const offsetY = Math.max(padding + effectiveStroke, Math.round((targetSize - drawH) / 2) - captionBias);

  // Step 1: Run Smart Chroma-Key on the exact image bounds (drawW x drawH) BEFORE placing with inset offset!
  // This ensures perimeter sampling and border flood-fill hit the true image edges rather than the 9px transparent inset!
  const imgBoundCanvas = document.createElement('canvas');
  imgBoundCanvas.width = drawW;
  imgBoundCanvas.height = drawH;
  const ibCtx = imgBoundCanvas.getContext('2d', { willReadFrequently: true })!;
  ibCtx.drawImage(img, 0, 0, drawW, drawH);

  if (opts.removeBg) {
    applySmartChromaKey(
      ibCtx,
      drawW,
      drawH,
      opts.bgKeyMode,
      opts.bgTolerance,
      opts.bgAlgorithm || 'flood-fill',
      opts.protectInteriorWhites ?? true,
      opts.gapClosingPx ?? 4
    );
  }

  // Keep an untouched raw copy at targetSize for manual brush restore
  const rawSubjectCanvas = document.createElement('canvas');
  rawSubjectCanvas.width = targetSize;
  rawSubjectCanvas.height = targetSize;
  const rawCtx = rawSubjectCanvas.getContext('2d', { willReadFrequently: true })!;
  rawCtx.drawImage(img, offsetX, offsetY, drawW, drawH);

  const subjectCanvas = document.createElement('canvas');
  subjectCanvas.width = targetSize;
  subjectCanvas.height = targetSize;
  const sCtx = subjectCanvas.getContext('2d', { willReadFrequently: true })!;
  sCtx.drawImage(imgBoundCanvas, offsetX, offsetY);

  // Apply user-painted interactive Repair Mask (+1 = restore original pixel, -1 = erase to transparent)
  if (opts.repairMaskData && opts.repairMaskData.length === targetSize * targetSize) {
    const rawData = rawCtx.getImageData(0, 0, targetSize, targetSize).data;
    const subImgData = sCtx.getImageData(0, 0, targetSize, targetSize);
    const subData = subImgData.data;
    const mask = opts.repairMaskData;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) {
        // Restore original RGB + full alpha from raw un-keyed image!
        const off = i * 4;
        subData[off] = rawData[off];
        subData[off + 1] = rawData[off + 1];
        subData[off + 2] = rawData[off + 2];
        subData[off + 3] = rawData[off + 3];
      } else if (mask[i] < 0) {
        // Force erase pixel
        subData[i * 4 + 3] = 0;
      }
    }
    sCtx.putImageData(subImgData, 0, 0);
  }

  // Step 2: Compose Die-Cut Contour Stroke + Shadow + Subject on final canvas
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetSize;
  finalCanvas.height = targetSize;
  const ctx = finalCanvas.getContext('2d', { willReadFrequently: true })!;

  if (effectiveStroke > 0) {
    // Build solid silhouette mask in strokeColor
    const silhouetteCanvas = document.createElement('canvas');
    silhouetteCanvas.width = targetSize;
    silhouetteCanvas.height = targetSize;
    const silCtx = silhouetteCanvas.getContext('2d')!;
    silCtx.drawImage(subjectCanvas, 0, 0);
    silCtx.globalCompositeOperation = 'source-in';
    silCtx.fillStyle = opts.strokeColor || '#FFFFFF';
    silCtx.fillRect(0, 0, targetSize, targetSize);

    // Radial multi-angle morphological dilation for ultra-smooth die-cut sticker border
    const strokeLayer = document.createElement('canvas');
    strokeLayer.width = targetSize;
    strokeLayer.height = targetSize;
    const stCtx = strokeLayer.getContext('2d')!;

    const steps = 24;
    for (let r = 1; r <= effectiveStroke; r++) {
      for (let i = 0; i < steps; i++) {
        const angle = (i * 2 * Math.PI) / steps;
        const dx = Math.cos(angle) * r;
        const dy = Math.sin(angle) * r;
        stCtx.drawImage(silhouetteCanvas, dx, dy);
      }
    }

    if (opts.dropShadow && targetSize >= 120) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(strokeLayer, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(strokeLayer, 0, 0);
    }
  } else if (opts.dropShadow && targetSize >= 120) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(subjectCanvas, 0, 0);
    ctx.restore();
  }

  // Draw crisp subject over stroke layer
  ctx.drawImage(subjectCanvas, 0, 0);

  // Step 3: Draw Meme Caption if present (only on main/thumb sizes >= 100px)
  if (opts.caption.trim() && targetSize >= 100) {
    renderStickerCaption(ctx, targetSize, padding, opts.caption, opts.captionStyle);
  }

  // Step 4: Hard-enforce WeChat mandatory `padding` (e.g. 2px) transparent border
  if (padding > 0) {
    ctx.clearRect(0, 0, targetSize, padding);
    ctx.clearRect(0, targetSize - padding, targetSize, padding);
    ctx.clearRect(0, 0, padding, targetSize);
    ctx.clearRect(targetSize - padding, 0, padding, targetSize);
  }

  const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
  const bleedAudit = verifyBleedSafety(imageData, padding);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });

  // Generate true binary GIF89a (either static 1-frame or animated multi-frame)
  const gifBlob =
    targetSize >= 120
      ? synthesizeStickerGIF(finalCanvas, opts.motion, padding)
      : pngBlob;

  return {
    blob: pngBlob,
    gifBlob,
    canvas: finalCanvas,
    bleedAudit,
  };
};

/**
 * Dynamic Quality Step-Down Loop to strictly satisfy WeChat KB limits (e.g. <= 80KB / 90KB / 200KB).
 */
export const compressToTargetKB = async (
  canvas: HTMLCanvasElement,
  maxKB: number,
  mimeType: string = 'image/jpeg'
): Promise<Blob> => {
  const maxBytes = maxKB * 1024;
  let quality = 0.92;
  let blob: Blob | null = null;

  while (quality >= 0.1) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (blob && blob.size <= maxBytes) {
      return blob;
    }
    quality = Number((quality - 0.05).toFixed(2));
  }

  // Fallback: if visual complexity is still above maxBytes at quality 0.1, progressively compress texture detail
  if (blob && blob.size > maxBytes) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.fillStyle = '#FFFFFF';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tCtx.filter = 'blur(0.6px)';
    tCtx.drawImage(canvas, 0, 0);
    const fallbackBlob = await new Promise<Blob | null>((resolve) =>
      tempCanvas.toBlob(resolve, 'image/jpeg', 0.35)
    );
    if (fallbackBlob) return fallbackBlob;
  }

  if (!blob) throw new Error('Canvas compression failed');
  return blob;
};

/**
 * Processes any promotional asset (PNG or JPG) to exact dimensions and KB limit.
 */
export const processAssetToSpec = async (
  sourceBlob: File | Blob,
  targetWidth: number,
  targetHeight: number,
  outputType: 'png' | 'jpg',
  maxKB: number
): Promise<Blob> => {
  if (outputType === 'png') {
    const res = await processTransparentSticker(sourceBlob, targetWidth, 0, {
      strokeWidth: 0,
      dropShadow: false,
      removeBg: false,
    });
    return res.blob;
  }
  return processBannerAndReward(sourceBlob, targetWidth, targetHeight, maxKB);
};

/**
 * Processes Banner, Artist Homepage, Reward Guide, and Reward Thanks assets with strict aspect ratio and KB cap.
 */
export const processBannerAndReward = async (
  fileOrBlob: File | Blob,
  targetWidth: number,
  targetHeight: number,
  maxKB: number
): Promise<Blob> => {
  const img = await loadImage(fileOrBlob);
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  // Fill white background first to prevent black artifacts on transparent inputs
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Center-cover crop if aspect ratios differ slightly
  const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
  const sw = Math.round(img.width * scale);
  const sh = Math.round(img.height * scale);
  const dx = Math.round((targetWidth - sw) / 2);
  const dy = Math.round((targetHeight - sh) / 2);

  ctx.drawImage(img, dx, dy, sw, sh);

  return compressToTargetKB(canvas, maxKB, 'image/jpeg');
};

/**
 * Detects the non-transparent bounding box of a canvas and crops/re-centers the subject
 * so slightly off-center AI grid cells become uniformly scaled and centered!
 */
function cropToContentBoundingBox(
  sourceCanvas: HTMLCanvasElement,
  padRatio: number = 0.04
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 35) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return sourceCanvas;
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const maxDim = Math.max(contentW, contentH);
  const pad = Math.round(maxDim * padRatio);
  const outSize = maxDim + pad * 2;

  const centeredCanvas = document.createElement('canvas');
  centeredCanvas.width = outSize;
  centeredCanvas.height = outSize;
  const cCtx = centeredCanvas.getContext('2d')!;

  const dx = Math.round((outSize - contentW) / 2);
  const dy = Math.round((outSize - contentH) / 2);
  cCtx.drawImage(sourceCanvas, minX, minY, contentW, contentH, dx, dy, contentW, contentH);

  return centeredCanvas;
}

/**
 * AI Sprite Sheet Slicer (Non-Destructive Architecture):
 * Slices a multi-grid AI sticker sheet (e.g., 3x3, 4x4, 4x6) into individual raw cell blobs.
 * IMPORTANT: Saves the UN-KEYED raw cell image as `rawBlob` (using a temporary chroma-key pass only
 * to compute the tight centering bounding-box if `autoCenterSubject` is enabled), so that downstream
 * background removal, Panda White-Face Shield, tolerance tweaks, and Brush Repair in the Matrix
 * are 100% NON-DESTRUCTIVE and reversible!
 */
export const sliceSpriteSheet = async (
  file: File | Blob | string,
  rows: number,
  cols: number,
  trimPercent: number = 4,
  autoRemoveBg: boolean = true,
  tolerance: number = 24,
  autoCenterSubject: boolean = true,
  bgAlgorithm: 'flood-fill' | 'global' = 'flood-fill',
  outerMarginPercent: number = 0
): Promise<{ blob: Blob; previewUrl: string; index: number }[]> => {
  const img = await loadImage(file);
  const outerX = Math.round((img.width * outerMarginPercent) / 100);
  const outerY = Math.round((img.height * outerMarginPercent) / 100);
  const usableW = Math.max(32, img.width - outerX * 2);
  const usableH = Math.max(32, img.height - outerY * 2);

  const cellW = usableW / cols;
  const cellH = usableH / rows;
  const results: { blob: Blob; previewUrl: string; index: number }[] = [];

  let index = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const trimX = (cellW * trimPercent) / 100;
      const trimY = (cellH * trimPercent) / 100;
      const sx = Math.round(outerX + c * cellW + trimX);
      const sy = Math.round(outerY + r * cellH + trimY);
      const sw = Math.max(16, Math.round(cellW - trimX * 2));
      const sh = Math.max(16, Math.round(cellH - trimY * 2));

      let rawCellCanvas = document.createElement('canvas');
      rawCellCanvas.width = sw;
      rawCellCanvas.height = sh;
      const rawCtx = rawCellCanvas.getContext('2d', { willReadFrequently: true })!;
      rawCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // If autoCenterSubject is on, detect bounding box on a temporary probe canvas
      // and crop/center the RAW un-keyed canvas using the detected box + background fill!
      if (autoCenterSubject) {
        const probeCanvas = document.createElement('canvas');
        probeCanvas.width = sw;
        probeCanvas.height = sh;
        const pCtx = probeCanvas.getContext('2d', { willReadFrequently: true })!;
        pCtx.drawImage(rawCellCanvas, 0, 0);
        applySmartChromaKey(pCtx, sw, sh, 'auto-corner', tolerance, bgAlgorithm, true, 3);

        const pData = pCtx.getImageData(0, 0, sw, sh).data;
        let minX = sw, minY = sh, maxX = -1, maxY = -1;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (pData[(y * sw + x) * 4 + 3] > 35) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX > minX && maxY > minY) {
          const contentW = maxX - minX + 1;
          const contentH = maxY - minY + 1;
          const maxDim = Math.max(contentW, contentH);
          const pad = Math.round(maxDim * 0.06);
          const outSize = maxDim + pad * 2;

          // Sample corner color of rawCellCanvas to fill padding seamlessly
          const cornerPixel = rawCtx.getImageData(1, 1, 1, 1).data;
          const centeredRaw = document.createElement('canvas');
          centeredRaw.width = outSize;
          centeredRaw.height = outSize;
          const cCtx = centeredRaw.getContext('2d')!;
          if (cornerPixel[3] > 128) {
            cCtx.fillStyle = `rgb(${cornerPixel[0]}, ${cornerPixel[1]}, ${cornerPixel[2]})`;
            cCtx.fillRect(0, 0, outSize, outSize);
          }
          const dx = Math.round((outSize - contentW) / 2);
          const dy = Math.round((outSize - contentH) / 2);
          cCtx.drawImage(rawCellCanvas, minX, minY, contentW, contentH, dx, dy, contentW, contentH);
          rawCellCanvas = centeredRaw;
        }
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        rawCellCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Cell slice failed'))), 'image/png');
      });

      results.push({
        blob,
        previewUrl: URL.createObjectURL(blob),
        index: index++,
      });
    }
  }

  return results;
};

export type PromoThemeKey = 'atelier-warm' | 'wechat-emerald' | 'neo-brutal' | 'obsidian-grid';

/**
 * One-Click Promo Asset Synthesizer:
 * Automatically composes all 6 WeChat promotional assets (Cover, Icon, Banner, Artist, Guide, Thanks)
 * from the active sticker matrix + album metadata, adhering strictly to each asset's W×H and maxKB!
 */
export const synthesizeAllPromoAssets = async (
  stickerCanvases: HTMLCanvasElement[],
  albumName: string,
  subtitle: string,
  theme: PromoThemeKey,
  specs: {
    cover: { w: number; h: number; maxKB: number };
    icon: { w: number; h: number; maxKB: number };
    banner: { w: number; h: number; maxKB: number };
    artist: { w: number; h: number; maxKB: number };
    guide: { w: number; h: number; maxKB: number };
    thanks: { w: number; h: number; maxKB: number };
  }
): Promise<Record<'cover' | 'icon' | 'banner' | 'artist' | 'guide' | 'thanks', Blob>> => {
  if (stickerCanvases.length === 0) {
    throw new Error('请先至少导入或生成 1 张主图表情');
  }

  const title = albumName.trim() || '原创 AI 表情专辑';
  const sub = subtitle.trim() || '全天候高频斗图 · 官方规范精修版';

  const palettes: Record<
    PromoThemeKey,
    { bg1: string; bg2: string; accent: string; text: string; muted: string; badgeBg: string }
  > = {
    'atelier-warm': {
      bg1: '#FBF9F3',
      bg2: '#EFECE2',
      accent: '#FF5A36',
      text: '#16181D',
      muted: '#5A606D',
      badgeBg: '#FFFFFF',
    },
    'wechat-emerald': {
      bg1: '#0A2E1D',
      bg2: '#061910',
      accent: '#07C160',
      text: '#F3F4F6',
      muted: '#86EFAC',
      badgeBg: '#113E28',
    },
    'neo-brutal': {
      bg1: '#FFE866',
      bg2: '#FFD233',
      accent: '#141416',
      text: '#141416',
      muted: '#3F3F46',
      badgeBg: '#FFFFFF',
    },
    'obsidian-grid': {
      bg1: '#141720',
      bg2: '#0B0D12',
      accent: '#38BDF8',
      text: '#F8FAFC',
      muted: '#94A3B8',
      badgeBg: '#1E2330',
    },
  };

  const pal = palettes[theme];
  const heroCanvas = stickerCanvases[0];

  // 1. Cover (240x240 PNG, transparent)
  const coverBlob = await new Promise<Blob>((resolve, reject) => {
    const c = document.createElement('canvas');
    c.width = specs.cover.w;
    c.height = specs.cover.h;
    const ctx = c.getContext('2d')!;
    const pad = 6;
    ctx.drawImage(heroCanvas, pad, pad, c.width - pad * 2, c.height - pad * 2);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Cover failed'))), 'image/png');
  });

  // 2. Icon (50x50 PNG, transparent)
  const iconBlob = await new Promise<Blob>((resolve, reject) => {
    const c = document.createElement('canvas');
    c.width = specs.icon.w;
    c.height = specs.icon.h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(heroCanvas, 0, 0, c.width, c.height);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Icon failed'))), 'image/png');
  });

  // Helper to draw patterned studio background
  const drawBackdrop = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, pal.bg1);
    grad.addColorStop(1, pal.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle precision grid lines
    ctx.strokeStyle = pal.text === '#F3F4F6' || pal.text === '#F8FAFC' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Decorative accent frame
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, h - 36);
  };

  // 3. Details Banner (750x400 JPG <= 80KB)
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = specs.banner.w;
  bannerCanvas.height = specs.banner.h;
  {
    const ctx = bannerCanvas.getContext('2d')!;
    const w = bannerCanvas.width;
    const h = bannerCanvas.height;
    drawBackdrop(ctx, w, h);

    // Left Typography Block
    ctx.fillStyle = pal.accent;
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText('WECHAT STICKER COLLECTION // OFFICIAL', 42, 82);

    ctx.fillStyle = pal.text;
    ctx.font = '900 42px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(title.slice(0, 8), 42, 148);

    ctx.fillStyle = pal.muted;
    ctx.font = '600 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(sub.slice(0, 17), 42, 194);

    // Pill tag
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect(42, 238, 182, 40, 20);
    ctx.fill();
    ctx.fillStyle = pal.accent === '#FFE866' ? '#141416' : '#FFFFFF';
    ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('✦ 聊天气泡高对比度特调', 56, 264);

    // Right Character Showcase Cluster (up to 3 stickers)
    const picks = stickerCanvases.slice(0, 3);
    if (picks.length === 1) {
      ctx.drawImage(picks[0], w - 285, (h - 240) / 2, 240, 240);
    } else {
      if (picks[1]) {
        ctx.save();
        ctx.translate(w - 268, h / 2 - 18);
        ctx.rotate(-0.12);
        ctx.drawImage(picks[1], -82, -82, 164, 164);
        ctx.restore();
      }
      if (picks[2]) {
        ctx.save();
        ctx.translate(w - 98, h / 2 + 18);
        ctx.rotate(0.14);
        ctx.drawImage(picks[2], -78, -78, 156, 156);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(w - 182, h / 2 + 8);
      ctx.drawImage(picks[0], -110, -110, 220, 220);
      ctx.restore();
    }
  }
  const bannerBlob = await compressToTargetKB(bannerCanvas, specs.banner.maxKB, 'image/jpeg');

  // 4. Artist Homepage Banner (750x400 JPG <= 80KB)
  const artistCanvas = document.createElement('canvas');
  artistCanvas.width = specs.artist.w;
  artistCanvas.height = specs.artist.h;
  {
    const ctx = artistCanvas.getContext('2d')!;
    const w = artistCanvas.width;
    const h = artistCanvas.height;
    drawBackdrop(ctx, w, h);

    // Strip showcase of up to 4 characters along the bottom
    const count = Math.min(4, stickerCanvases.length);
    const slotW = (w - 120) / count;
    for (let i = 0; i < count; i++) {
      const sc = stickerCanvases[i];
      const cx = 60 + slotW * i + (slotW - 145) / 2;
      ctx.drawImage(sc, cx, h - 185, 145, 145);
    }

    ctx.fillStyle = pal.text;
    ctx.textAlign = 'center';
    ctx.font = '900 40px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`${title} · 创作者主理人空间`, w / 2, 105);

    ctx.fillStyle = pal.muted;
    ctx.font = '600 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('ORIGINAL CHARACTER IP STUDIO & DIGITAL STICKER ARCHIVE', w / 2, 148);
  }
  const artistBlob = await compressToTargetKB(artistCanvas, specs.artist.maxKB, 'image/jpeg');

  // 5. Reward Guide (750x560 JPG <= 90KB)
  const guideCanvas = document.createElement('canvas');
  guideCanvas.width = specs.guide.w;
  guideCanvas.height = specs.guide.h;
  {
    const ctx = guideCanvas.getContext('2d')!;
    const w = guideCanvas.width;
    const h = guideCanvas.height;
    drawBackdrop(ctx, w, h);

    const guideHero = stickerCanvases[Math.min(1, stickerCanvases.length - 1)];
    ctx.drawImage(guideHero, (w - 260) / 2, 55, 260, 260);

    ctx.textAlign = 'center';
    ctx.fillStyle = pal.text;
    ctx.font = '900 42px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('喜欢这套表情？投喂主理人一杯咖啡 ☕', w / 2, 390);

    ctx.fillStyle = pal.muted;
    ctx.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`来自「${title}」的创作发电邀请 · 感谢每一份支持`, w / 2, 442);
  }
  const guideBlob = await compressToTargetKB(guideCanvas, specs.guide.maxKB, 'image/jpeg');

  // 6. Reward Thanks (750x750 JPG <= 200KB)
  const thanksCanvas = document.createElement('canvas');
  thanksCanvas.width = specs.thanks.w;
  thanksCanvas.height = specs.thanks.h;
  {
    const ctx = thanksCanvas.getContext('2d')!;
    const w = thanksCanvas.width;
    const h = thanksCanvas.height;
    drawBackdrop(ctx, w, h);

    // Soft radial badge
    ctx.fillStyle = pal.badgeBg;
    ctx.beginPath();
    ctx.arc(w / 2, 290, 185, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    const thanksHero = stickerCanvases[Math.min(2, stickerCanvases.length - 1)];
    ctx.drawImage(thanksHero, (w - 310) / 2, 135, 310, 310);

    ctx.textAlign = 'center';
    ctx.fillStyle = pal.accent;
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText('♥ THANK YOU FOR YOUR SUPPORT ♥', w / 2, 540);

    ctx.fillStyle = pal.text;
    ctx.font = '900 48px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('感谢老板赞赏！祝您暴富开心！', w / 2, 608);

    ctx.fillStyle = pal.muted;
    ctx.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`${title} · 下一弹表情包正在全力肝图中`, w / 2, 660);
  }
  const thanksBlob = await compressToTargetKB(thanksCanvas, specs.thanks.maxKB, 'image/jpeg');

  return {
    cover: coverBlob,
    icon: iconBlob,
    banner: bannerBlob,
    artist: artistBlob,
    guide: guideBlob,
    thanks: thanksBlob,
  };
};
