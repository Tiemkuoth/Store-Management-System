import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

export default function BarcodeScannerModal({ onClose, onScanSuccess }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Initialize the scanner on load
    const scanner = new Html5QrcodeScanner(
      "qr-reader-element",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [] // support all standard bar/QR formats
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        // Success handler
        console.log(`Scan success: ${decodedText}`);
        onScanSuccess(decodedText);
        scanner.clear().catch(e => console.warn(e));
        onClose();
      },
      (error) => {
        // Silent error handler (fps polling drops)
      }
    );

    scannerRef.current = scanner;

    // Clean up on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.warn("Scanner cleanup warning:", e));
      }
    };
  }, [onClose, onScanSuccess]);

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '450px', width: '90vw', borderRadius: '16px' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--bg-border)', paddingBottom: '12px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0', fontSize: '16px', fontWeight: '700' }}>
            <Camera size={18} color="#4f46e5" /> Barcode Scanner
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close scanner">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', margin: '0' }}>
            Position the barcode or QR code inside the camera window to scan automatically.
          </p>
          <div id="qr-reader-element" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}></div>
        </div>
      </div>
    </div>
  );
}
