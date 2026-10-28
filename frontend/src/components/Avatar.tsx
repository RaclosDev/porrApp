import { useState, useEffect } from 'react';

function Img({ src, size, radius, fallback, label = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const box = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: radius,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  if (src && !failed) {
    return (
      <span style={box} data-testid="avatar-image">
        <img
          src={src}
          alt={label || ''}
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </span>
    );
  }
  return <span style={box}>{fallback}</span>;
}

/** Foto de perfil con inicial como respaldo. `alt` vacío por defecto: es decorativa junto al nombre. */
export function UserAvatar({ url, name, size = 32 }) {
  return (
    <Img
      src={url}
      size={size}
      radius="50%"
      fallback={
        <span
          style={{
            width: '100%',
            height: '100%',
            background: 'rgba(0, 210, 211, 0.15)',
            color: '#00d2d3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: Math.max(11, Math.round(size * 0.42)),
          }}
        >
          {name ? name.charAt(0).toUpperCase() : 'U'}
        </span>
      }
    />
  );
}

/** Imagen de liga con un emoji (insignia de la competición) como respaldo. */
export function LeagueAvatar({ url, badge = '🏆', size = 32 }) {
  return (
    <Img
      src={url}
      size={size}
      radius={Math.round(size * 0.28)}
      fallback={
        <span
          style={{
            width: '100%',
            height: '100%',
            background: 'rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.6),
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      }
    />
  );
}
