/**
 * Utilidades de imagen en el navegador: validación y reducción antes de subir.
 * El servidor vuelve a validar todo; esto solo mejora la experiencia (vista previa inmediata,
 * menos datos por red móvil y orientación EXIF correcta).
 */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const OUTPUT_SIZE = 512;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImageFile(file: File | null | undefined): string | null {
  if (!file) return 'No se ha seleccionado ningún archivo.';

  const type = (file.type || '').toLowerCase();
  const extension = file.name?.split('.').pop()?.toLowerCase();
  const allowedByType = ACCEPTED_TYPES.includes(type);
  const allowedByExtension = !type && ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '');

  if (!allowedByType && !allowedByExtension) {
    if (
      type === 'image/heic' ||
      type === 'image/heif' ||
      ['heic', 'heif'].includes(extension ?? '')
    ) {
      return 'Tu archivo está en formato HEIC/HEIF. Convierte la foto a JPG o PNG para poder previsualizarla y guardarla.';
    }
    return 'Selecciona una imagen JPG, PNG o WebP.';
  }

  return null;
}

/** Carga la imagen usando ImageBitmap cuando está disponible y un elemento Image como alternativa. */
async function decodeImage(file: File) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    } catch {
      // Algunos navegadores no decodifican todos los formatos con createImageBitmap.
      // Se intenta el decodificador HTML estándar antes de mostrar un error.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error('No se pudo leer la imagen. Prueba con otra JPG, PNG o WebP.');
  }
}

/**
 * Recorta la imagen al cuadrado central, la reduce a 512 px y la devuelve como Blob JPEG
 * (o PNG si conserva transparencia). Respeta la orientación EXIF de las fotos de móvil.
 */
export async function prepareImageForUpload(file: File, size = OUTPUT_SIZE): Promise<Blob> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const decoded = await decodeImage(file);
  try {
    const side = Math.min(decoded.width, decoded.height);
    const sx = Math.floor((decoded.width - side) / 2);
    const sy = Math.floor((decoded.height - side) / 2);
    const target = Math.min(size, side);

    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tu navegador no puede procesar la imagen.');

    const keepsAlpha =
      (file.type || '').toLowerCase() === 'image/png' ||
      (!file.type && file.name?.toLowerCase().endsWith('.png'));
    if (!keepsAlpha) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, target, target);
    }
    ctx.drawImage(decoded.source, sx, sy, side, side, 0, 0, target, target);

    const mime = keepsAlpha ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.88));
    if (!blob) throw new Error('No se pudo procesar la imagen.');
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('La imagen supera el tamaño máximo de 3 MB.');
    return blob;
  } finally {
    decoded.close();
  }
}
