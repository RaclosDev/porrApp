import { useState } from 'react';
import { UserAvatar } from './Avatar';
import PhotoViewer from './PhotoViewer';

/**
 * Avatar que se ve en grande al pulsarlo. Sin foto es el avatar de letras de siempre, sin
 * botón. El clic no pasa a la fila que lo contiene, que puede abrir otra cosa.
 */
export default function ZoomableAvatar({
  url,
  name,
  userId,
  size,
}: {
  url: string | null | undefined;
  name: string;
  userId?: number | string | null;
  size?: number;
}) {
  const [zoomed, setZoomed] = useState(false);
  const avatar = <UserAvatar url={url} userId={userId} name={name} size={size} />;
  if (!url) return avatar;
  return (
    <>
      <button
        type="button"
        className="sheet-person-photo"
        onClick={(event) => {
          event.stopPropagation();
          setZoomed(true);
        }}
        aria-label={`Ver la foto de ${name}`}
      >
        {avatar}
      </button>
      {zoomed && <PhotoViewer url={url} name={name} onClose={() => setZoomed(false)} />}
    </>
  );
}
