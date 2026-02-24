import { PhotoItem } from './types';

export const uid = () => crypto.randomUUID();

export async function resizeImage(file: File, maxWidth = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('image compression failed'));
      else resolve(blob);
    }, 'image/jpeg', quality);
  });
}

export function estimateCapturedAt(file: File): string {
  return new Date(file.lastModified || Date.now()).toISOString();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function photoPreview(photo: PhotoItem) {
  return URL.createObjectURL(photo.blob);
}
