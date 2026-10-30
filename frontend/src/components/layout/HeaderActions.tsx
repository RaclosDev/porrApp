import { setAuthToken } from '../../services/api';
import { UserAvatar } from '../Avatar';
import type { NavigateFunction } from 'react-router-dom';

interface HeaderActionsProps {
  enterDemoMode: () => void;
  isLanding: boolean;
  isUserLoggedIn: boolean;
  navigate: NavigateFunction;
  setIsAuthenticated: (value: boolean) => void;
  setShowMyPredictionModal: (show: boolean) => void;
  setShowProfileMenu: (show: boolean) => void;
  setShowProfileSettings: (show: boolean) => void;
  setUserName: (name: string) => void;
  showProfileMenu: boolean;
  userAvatarUrl: string;
  userName: string;
}

/** Parte derecha de la cabecera: acceso, liga activa y menú de perfil. */
export default function HeaderActions({
  enterDemoMode,
  isLanding,
  isUserLoggedIn,
  navigate,
  setIsAuthenticated,
  setShowMyPredictionModal,
  setShowProfileMenu,
  setShowProfileSettings,
  setUserName,
  showProfileMenu,
  userAvatarUrl,
  userName,
}: HeaderActionsProps) {
  return (
    <div
      className="header-right"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '10px',
        position: 'relative',
      }}
    >
      {!isUserLoggedIn ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLanding && (
            <button
              id="btn-header-demo"
              type="button"
              onClick={() => {
                if (enterDemoMode) enterDemoMode();
                navigate('/demo');
              }}
              className="glass-btn"
              style={{
                height: '38px',
                padding: '0 12px',
                fontSize: '0.82rem',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#e2e8f0',
              }}
              title="Probar Demo del Mundial"
            >
              <span>🚀</span>
              <span>Demo</span>
            </button>
          )}
          <button
            id="btn-login-header"
            type="button"
            onClick={() => setShowMyPredictionModal(true)}
            className="glass-btn"
            style={{
              height: '38px',
              padding: '0 16px',
              fontSize: '0.88rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: 'rgba(0, 210, 211, 0.12)',
              border: '1px solid rgba(0, 210, 211, 0.45)',
              color: '#00d2d3',
              boxShadow: '0 4px 15px rgba(0, 210, 211, 0.15)',
            }}
            title="Iniciar Sesión"
          >
            <span style={{ fontSize: '1.05rem' }}>👤</span>
            <span>Iniciar Sesión</span>
          </button>
        </div>
      ) : (
        <>
          <button
            id="btn-profile-menu"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="glass-btn"
            style={{
              height: '36px',
              width: '36px',
              minWidth: '36px',
              maxWidth: '36px',
              minHeight: '36px',
              maxHeight: '36px',
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Menú de Usuario"
            aria-label="Menú de Usuario"
          >
            {userAvatarUrl ? (
              <UserAvatar url={userAvatarUrl} name={userName} size={34} />
            ) : (
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>👤</span>
            )}
          </button>

          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                background: '#151525',
                boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px',
                marginTop: '10px',
                zIndex: 100,
                minWidth: '200px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <UserAvatar url={userAvatarUrl} name={userName} size={32} />
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      fontWeight: 'bold',
                      color: '#fff',
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {userName || 'Usuario'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conectado</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowProfileSettings(true);
                }}
                className="glass-btn"
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                ⚙️ Ajustes de cuenta
              </button>

              <button
                onClick={() => {
                  setAuthToken(null);
                  setIsAuthenticated?.(false);
                  setUserName('');
                  localStorage.removeItem('my_prediction_name');
                  localStorage.removeItem('my_user_id');
                  localStorage.removeItem('my_avatar_url');
                  localStorage.removeItem('token');
                  window.location.href = '/';
                }}
                style={{
                  background: 'rgba(255, 71, 87, 0.12)',
                  border: '1px solid rgba(255, 71, 87, 0.4)',
                  color: '#ff4757',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  width: '100%',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
