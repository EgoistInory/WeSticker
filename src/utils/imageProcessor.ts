/**
 * 将文件读取为 Image 对象
 */
export const loadImage = (file: File | Blob | string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof file === 'string' ? file : URL.createObjectURL(file);
    img.onload = () => {
      if (typeof file !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * 将 Canvas 转换为 Blob
 */
const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob failed'));
        }
      },
      type,
      quality
    );
  });
};

/**
 * 带有动态压质核心的 JPEG 生成器
 * @description 根据最高 KB 限制，自动步进降低质量直到体积达标
 */
export const compressToTargetKB = async (canvas: HTMLCanvasElement, maxKB: number): Promise<Blob> => {
  let quality = 0.95; // 初始极高画质
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  const maxBytes = maxKB * 1024;

  // 如果原始大小已经达标这直接返回
  if (blob.size <= maxBytes) {
    return blob;
  }

  // 循环降质防爆
  while (blob.size > maxBytes && quality > 0.1) {
    quality -= 0.05; // 步长 0.05
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }
  
  if (blob.size > maxBytes) {
    console.warn(`Extreme compression failed to meet ${maxKB}KB limit. Final size: ${(blob.size / 1024).toFixed(2)}KB`);
  }

  return blob;
};

/**
 * 透明底色主体的通用处理器（用于主图、缩略图、面板图标）
 * @description 接收原图，在 targetSize 方块中按比例居中且不拉伸，外围补充 safePadding 的透明留白
 */
export const processTransparentSticker = async (
  file: File | Blob, 
  targetSize: number, 
  safePadding = 0
): Promise<{ canvas: HTMLCanvasElement; blob: Blob }> => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');

  canvas.width = targetSize;
  canvas.height = targetSize;

  const innerSize = targetSize - safePadding * 2;
  ctx.clearRect(0, 0, targetSize, targetSize);

  const scale = Math.min(innerSize / img.width, innerSize / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;

  const dx = (targetSize - drawWidth) / 2;
  const dy = (targetSize - drawHeight) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

  // 主图和缩略图等均使用透明格式导出
  const blob = await canvasToBlob(canvas, 'image/png');
  return { canvas, blob };
};

/**
 * 推广与运营物料处理器（横幅/致谢/艺术家主页等）
 * @description 根据要求的定死长宽渲染，并触发动态体积压制
 */
export const processBannerAndReward = async (
  sourceBlob: Blob, 
  targetWidth: number, 
  targetHeight: number, 
  maxKB: number
): Promise<Blob> => {
  const img = await loadImage(sourceBlob);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // 微信规则中，横幅这类若有透明会被填充黑底或出 bug，故强行白底
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 将裁剪后传入的内容撑满该区域（理想情况来源已经被裁切好比例）
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // 严格执行压缩要求
  return await compressToTargetKB(canvas, maxKB);
};
