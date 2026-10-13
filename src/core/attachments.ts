const VISION_MAX_EDGE = 1024;
const VISION_QUALITY = 0.85;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
}

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  if (width <= 0 || height <= 0) {
    return Promise.resolve(null);
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return Promise.resolve(null);
  }

  ctx.drawImage(source, 0, 0, w, h);
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/webp', quality);
  });
}

/**
 * Downscale a picked image to a vision-friendly payload (WebP, max edge
 * 1024px) so it can be attached to a model message. Falls back to the original
 * file when the image cannot be decoded or re-encoded.
 */
export async function makeVisionImage(file: File): Promise<Blob> {
  try {
    const img = await loadImage(file);
    const blob = await drawToCanvas(
      img,
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      VISION_MAX_EDGE,
      VISION_QUALITY,
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}
