// Shrinks a photo picked from the computer/phone before upload: phone pictures
// are often 3–8 MB, which is slow on mobile networks and heavy to store.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`« ${file.name} » n’est pas une image.`));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Le navigateur ne peut pas traiter cette image.'));
        return;
      }
      // White background so transparent PNGs don't turn black in JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Impossible de lire « ${file.name} ». Utilisez une photo JPEG ou PNG (le format HEIC d’iPhone n’est pas lisible par tous les navigateurs).`));
    };
    img.src = objectUrl;
  });
}
