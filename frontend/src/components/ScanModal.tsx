import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@glean/barcode-scanner'
import { X } from 'lucide-react'

/**
 * Barcode scanner. On native it opens the plugin's camera; on web it uses the
 * BarcodeDetector API (Chrome/Edge) with a live preview.
 */
export default function ScanModal({
  onClose,
  onScan,
}: {
  onClose: () => void
  onScan: (barcode: string) => void
}) {
  const isNative = Capacitor.getPlatform() !== 'web'
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNative) {
      let cancelled = false
      BarcodeScanner.scan()
        .then((res) => {
          if (!cancelled && res.barcode) onScan(res.barcode)
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Scan failed.')
        })
      return () => {
        cancelled = true
      }
    }

    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false

    const start = async () => {
      // @ts-expect-error BarcodeDetector is not in the TS DOM lib yet
      const Detector = typeof window !== 'undefined' ? window.BarcodeDetector : undefined
      if (!Detector) {
        setError('This browser cannot scan barcodes. Add the item manually instead.')
        return
      }
      try {
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
        })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes && codes.length > 0 && codes[0].rawValue) {
              stopped = true
              onScan(String(codes[0].rawValue))
              return
            }
          } catch {
            /* keep trying */
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open the camera.')
      }
    }

    start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [isNative, onScan])

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-[15px] font-medium">Scan a barcode</span>
        <button onClick={onClose} aria-label="Close scanner">
          <X size={24} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {isNative ? (
          <div className="flex h-full items-center justify-center text-[15px] text-white/70">
            Opening the camera…
          </div>
        ) : (
          <>
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-32 -translate-y-1/2 rounded-xl border-2 border-white/80" />
          </>
        )}
        {error && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-lg bg-white/95 p-4 text-center text-[14px] text-ink">
            {error}
          </div>
        )}
      </div>

      <p className="p-4 text-center text-[12px] text-white/70">
        Point the camera at the barcode on the package.
      </p>
    </div>
  )
}
