import { useEffect, useState } from 'react';

interface Props {
  /** Enlace que abre el QR al escanearlo. */
  link: string;
  name: string;
  label?: string;
}

/** QR del enlace de invitación, para que quien esté al lado lo escanee y entre. */
export default function TrackerQr({ link, name, label }: Props) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    // La librería solo se descarga cuando se enchufa un marcador, no con el resto de la app.
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(link, { margin: 2, width: 512, errorCorrectionLevel: 'M' }),
      )
      .then((url) => {
        if (current) setSrc(url);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [link]);

  if (failed) return <p className="tracker-note">No se pudo generar el QR; usa el enlace.</p>;
  if (!src) return <div className="tracker-qr is-loading" aria-hidden="true" />;
  return (
    <img
      className="tracker-qr"
      src={src}
      width={220}
      height={220}
      alt={label ?? `Código QR para unirse al marcador ${name}`}
    />
  );
}
