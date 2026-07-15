/** Compression d'image côté client avant envoi (≤ 1280 px, JPEG ~80 %). */

/**
 * Identifiant unique pour les noms de fichiers.
 * crypto.randomUUID n'existe que sur les pages sécurisées (https/localhost) ;
 * en test sur réseau local (http://192.168…), on retombe sur getRandomValues.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.8

export async function compressImage(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression échouée'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
