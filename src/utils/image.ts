/**
 * 头像处理：校验、裁剪、压缩。
 *
 * 直接存 2MB 原图的问题：
 * - 游客草稿会把它转成 base64 塞进 JSON，一份草稿就能撑爆存储配额；
 * - 简历里最大只显示 5em×6em，存原图纯属浪费；
 * - 云端上传也没必要传几 MB 的图。
 *
 * 目标：300×300 以内、WebP 质量 0.85、体积 ≤ 80KB。
 */

export const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 300;
export const AVATAR_TARGET_BYTES = 80 * 1024;

export interface ProcessedAvatar {
  /** data:image/webp;base64,... 或 data:image/jpeg;base64,... */
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/** 允许的图片 MIME */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * 读取文件头判断真实类型。
 *
 * 只信 `file.type` 不够：改个扩展名或伪造 MIME 就能绕过。这里校验 magic
 * number，防止把非图片文件当图片解码。
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/** 校验并返回真实 MIME；不合法时返回错误信息 */
export async function validateAvatarFile(file: File): Promise<{ ok: true; type: string } | { ok: false; message: string }> {
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    return { ok: false, message: '图片请小于 5MB' };
  }

  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  } catch {
    return { ok: false, message: '无法读取该文件' };
  }

  const type = sniffImageType(head);
  if (!type) {
    return { ok: false, message: '请选择 JPG / PNG / WebP / GIF 格式的图片' };
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: '请选择 JPG / PNG / WebP / GIF 格式的图片' };
  }

  return { ok: true, type };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = dataUrl;
  });
}

function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number): string {
  return canvas.toDataURL(type, quality);
}

/** base64 字符串的近似字节数（去掉 data URL 前缀） */
export function base64Bytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * 裁剪为正方形并压缩。
 *
 * `crop` 是相对原图的归一化区域（0–1），默认取居中的最大正方形。
 * 输出优先 WebP；浏览器不支持时回退 JPEG。
 */
export async function processAvatar(
  file: File,
  options: { crop?: { x: number; y: number; size: number }; targetSize?: number } = {}
): Promise<ProcessedAvatar> {
  const validation = await validateAvatarFile(file);
  if (!validation.ok) throw new Error(validation.message);

  const rawDataUrl = await readAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const target = options.targetSize ?? AVATAR_OUTPUT_SIZE;
  const side = Math.min(img.width, img.height);
  // 默认居中裁剪出正方形
  const crop = options.crop ?? {
    x: (img.width - side) / 2,
    y: (img.height - side) / 2,
    size: side,
  };

  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持图片处理');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, target, target);

  // 先试 WebP；不支持时浏览器会返回 PNG 的 data URL，此时改用 JPEG
  let dataUrl = canvasToDataUrl(canvas, 'image/webp', 0.85);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvasToDataUrl(canvas, 'image/jpeg', 0.85);
  }

  // 仍然超标就逐档降质量
  let quality = 0.85;
  while (base64Bytes(dataUrl) > AVATAR_TARGET_BYTES && quality > 0.5) {
    quality -= 0.1;
    const type = dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    dataUrl = canvasToDataUrl(canvas, type, Number(quality.toFixed(2)));
  }

  return {
    dataUrl,
    width: target,
    height: target,
    bytes: base64Bytes(dataUrl),
  };
}
