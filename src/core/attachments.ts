import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { ReAgentFileRef } from './types';

const VISION_MAX_EDGE = 1024;
const VISION_QUALITY = 0.85;

/** Default attachment size cap (25 MB). */
export const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: 'text/csv',
  css: 'text/css',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  htm: 'text/html',
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  jsx: 'text/javascript',
  md: 'text/markdown',
  markdown: 'text/markdown',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  ts: 'text/typescript',
  tsv: 'text/tab-separated-values',
  tsx: 'text/typescript',
  txt: 'text/plain',
  webp: 'image/webp',
  xml: 'application/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  zip: 'application/zip',
};

/** Guess a MIME type from a filename when the browser did not provide one. */
export function guessMimeType(name: string): string {
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/** Compact, human-readable file size. */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || Number.isNaN(bytes)) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** Whether a file can be rendered as text in the preview dialog. */
export function isTextFile(file: Pick<ReAgentFileRef, 'name' | 'mimeType'>): boolean {
  const mimeType = file.mimeType.toLowerCase();
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType.endsWith('+json') ||
    mimeType.endsWith('+xml')
  ) {
    return true;
  }
  return /\.(md|markdown|txt|json|csv|tsv|html?|css|js|jsx|ts|tsx|xml|ya?ml|toml|ini|log|sh|py|rb|go|rs|java|c|cc|cpp|h|hpp|sql)$/i.test(
    file.name,
  );
}

/** Type guard for file references persisted inside a user message. */
export function isReAgentFileRef(value: unknown): value is ReAgentFileRef {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const ref = value as Partial<ReAgentFileRef>;
  return (
    typeof ref.id === 'string' &&
    typeof ref.name === 'string' &&
    typeof ref.mimeType === 'string' &&
    typeof ref.size === 'number'
  );
}

/** Files attached to a persisted user or assistant message. */
export function getMessageFiles(message: AgentMessage): ReAgentFileRef[] {
  if (message.role !== 'user' && message.role !== 'assistant') {
    return [];
  }
  const value = (message as AgentMessage & { files?: unknown }).files;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isReAgentFileRef);
}

/** Attach durable file references to a user/assistant message before it is persisted. */
export function setMessageFiles(message: AgentMessage, files: ReAgentFileRef[]): void {
  if (message.role !== 'user' && message.role !== 'assistant') {
    return;
  }
  (message as AgentMessage & { files?: ReAgentFileRef[] }).files = files;
}

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
