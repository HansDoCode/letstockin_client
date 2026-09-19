import { useEffect, useRef, useState } from 'react';

import React from 'react';

export default function CameraScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const detectedRef = useRef(onDetected);
  const closeRef = useRef(onClose);
  const closeButtonRef = useRef(null);
  const [error, setError] = useState('');
  detectedRef.current = onDetected;
  closeRef.current = onClose;

  useEffect(() => {
    let stopped = false;
    let stream;
    let frame;
    let lastAttempt = 0;
    closeButtonRef.current?.focus();

    async function start() {
      if (typeof window.BarcodeDetector !== 'function' || !navigator.mediaDevices?.getUserMedia) {
        setError('Camera scanning is unavailable in this browser. Use the search field or a barcode scanner.');
        return;
      }
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const formats = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'].filter(format => supported.includes(format));
        if (!formats.length) throw new Error('No supported barcode formats.');
        const detector = new window.BarcodeDetector({ formats });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        async function detect(time) {
          if (stopped) return;
          if (time - lastAttempt >= 250 && video.readyState >= 2) {
            lastAttempt = time;
            try {
              const codes = await detector.detect(video);
              const code = codes.find(result => result.rawValue?.trim())?.rawValue.trim();
              if (code && !stopped) { stopped = true; detectedRef.current(code); return; }
            } catch { /* A camera frame can be unavailable while the stream starts. */ }
          }
          frame = requestAnimationFrame(detect);
        }
        frame = requestAnimationFrame(detect);
      } catch (cause) {
        stream?.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        if (!stopped) setError(cause.name === 'NotAllowedError' ? 'Camera access was denied. Allow camera access or enter the code manually.' : 'Camera scanning could not start. Enter the code manually.');
      }
    }
    start();
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()); if (videoRef.current) videoRef.current.srcObject = null; };
  }, []);

  return <div className="camera-overlay" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); } if (event.key === 'Tab') { event.preventDefault(); closeButtonRef.current?.focus(); } }}>
    <section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="camera-head"><div><p className="eyebrow">Barcode / QR</p><h2 id="camera-title">Scan a product</h2></div><button ref={closeButtonRef} className="secondary" onClick={onClose}>Close</button></div>
      <video ref={videoRef} muted playsInline aria-label="Camera preview" />
      {error ? <p className="form-notice" role="alert">{error}</p> : <p>Point the camera at a product barcode or QR code.</p>}
    </section>
  </div>;
}
