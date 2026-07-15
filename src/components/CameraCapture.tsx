import { useEffect, useRef, useState, type ChangeEvent } from 'react'

interface Props {
  title: string
  onConfirm: (photo: Blob) => Promise<void>
  onClose: () => void
}

/**
 * Plein écran : caméra arrière → capture → aperçu → « Valider ».
 * Si getUserMedia est indisponible (http non sécurisé, permission refusée…),
 * bascule sur <input type="file" capture> qui ouvre l'appli caméra native.
 */
export default function CameraCapture({ title, onConfirm, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (preview) return
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(true)
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        if (!cancelled) setCameraError(true)
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [preview])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) setPreview({ blob, url: URL.createObjectURL(blob) })
    }, 'image/jpeg', 0.92)
  }

  const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPreview({ blob: file, url: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setError(null)
  }

  const confirm = async () => {
    if (!preview) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(preview.blob)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’envoi.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="min-w-0 truncate text-sm font-medium text-white">{title}</p>
        <button
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white"
        >
          Annuler
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {preview ? (
          <img src={preview.url} alt="Aperçu de la photo" className="max-h-full max-w-full object-contain" />
        ) : cameraError ? (
          <div className="px-8 text-center">
            <p className="text-sm text-slate-300">
              Impossible d'accéder à la caméra dans le navigateur.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Ouvrir l'appareil photo
            </button>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        )}
      </div>

      {error && <p className="px-4 py-2 text-center text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-center gap-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {preview ? (
          <>
            <button
              onClick={retake}
              disabled={submitting}
              className="rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Reprendre
            </button>
            <button
              onClick={confirm}
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Envoi…' : 'Valider'}
            </button>
          </>
        ) : !cameraError ? (
          <button
            onClick={capture}
            aria-label="Prendre la photo"
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 transition active:scale-95"
          />
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFilePicked}
        className="hidden"
      />
    </div>
  )
}
