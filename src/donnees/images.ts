// Préparation des photos avant stockage : redimensionnement et compression.

/** Plus grand côté d'une image enregistrée (px). */
const TAILLE_MAX = 1280;
const QUALITE = 0.8;

/** Charge un fichier image en respectant l'orientation de l'appareil photo. */
async function charger(fichier: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    } catch {
      // on retombe sur la méthode classique ci-dessous
    }
  }
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

/**
 * Redimensionne (1280 px max) et compresse une photo (WebP, ou JPEG si le
 * navigateur ne sait pas écrire du WebP). Une photo de téléphone de plusieurs
 * Mo tombe ainsi à 100–300 Ko.
 */
export async function compresserImage(fichier: Blob): Promise<{ blob: Blob; extension: string }> {
  const image = await charger(fichier);
  const echelle = Math.min(1, TAILLE_MAX / Math.max(image.width, image.height));
  const toile = document.createElement('canvas');
  toile.width = Math.round(image.width * echelle);
  toile.height = Math.round(image.height * echelle);
  toile.getContext('2d')!.drawImage(image, 0, 0, toile.width, toile.height);
  if ('close' in image) image.close();

  const enBlob = (type: string) =>
    new Promise<Blob | null>((resoudre) => toile.toBlob(resoudre, type, QUALITE));

  let blob = await enBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await enBlob('image/jpeg');
  if (!blob) throw new Error('Impossible de préparer cette image.');
  return { blob, extension: blob.type === 'image/webp' ? 'webp' : 'jpg' };
}
