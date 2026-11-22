import { Link } from 'react-router-dom';
import { SMOOTH_SCROLL_STATE } from '../ScrollOnNavigate';

const SECTIONS = [
  { href: '/#pruebalo', label: 'Pruébalo' },
  { href: '/#como-se-juega', label: 'Cómo se juega' },
  { href: '/#deportes', label: 'Deportes' },
];

interface PublicHeaderProps {
  /** En /login y /registro: solo la marca y «← Volver». */
  auth?: boolean;
}

/**
 * Cabecera de las páginas públicas (portada, contenido y acceso), la misma que en Ascension y
 * LoopDeck: marca a la izquierda, secciones y «Demo» en medio, «Iniciar sesión» a la derecha.
 */
export default function PublicHeader({ auth = false }: PublicHeaderProps) {
  return (
    <header className="fam fam-container fam-header">
      <Link to="/" state={SMOOTH_SCROLL_STATE} className="fam-brand" aria-label="PorrApp, inicio">
        <span>PorrApp</span>
      </Link>
      <div className="fam-header__end">
        {auth ? (
          <Link to="/" className="fam-navlink">
            ← Volver
          </Link>
        ) : (
          <>
            <nav className="fam-nav" aria-label="Secciones">
              {SECTIONS.map((section) => (
                <Link
                  key={section.href}
                  to={section.href}
                  state={SMOOTH_SCROLL_STATE}
                  className="fam-navlink"
                >
                  {section.label}
                </Link>
              ))}
              <Link id="btn-header-demo" to="/demo" className="fam-navlink">
                Demo
              </Link>
            </nav>
            <Link id="btn-login-header" to="/login" className="fam-btn fam-btn--ink">
              Iniciar sesión
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
