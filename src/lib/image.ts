export async function optimiseImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  let quality = .86; let blob: Blob | null = null;
  while (quality >= .4) { blob = await new Promise(r => canvas.toBlob(r, 'image/webp', quality)); if (blob && blob.size <= 500000) break; quality -= .1; }
  if (!blob) throw new Error('Could not optimize image.');
  return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read image.')); reader.readAsDataURL(blob!); });
}
