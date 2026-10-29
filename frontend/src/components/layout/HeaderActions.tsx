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
    <div className="header-right flex justify-end items-center gap-2.5 relative">
      {!isUserLoggedIn ? (
        <div className="flex items-center gap-2">
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
            <span className="text-[1.05rem]">👤</span>
            <span>Iniciar Sesión</span>
          </button>
        </div>
      ) : (
        <>
          <button
            id="btn-profile-menu"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="glass-btn h-9 w-9 min-w-9 max-w-9 min-h-9 max-h-9 [aspect-ratio:1_/_1] rounded-full p-0 flex items-center justify-center cursor-pointer shrink-0"
            title="Menú de Usuario"
            aria-label="Menú de Usuario"
          >
            {userAvatarUrl ? (
              <UserAvatar url={userAvatarUrl} name={userName} size={34} />
            ) : (
              <span className="text-[1.1rem] leading-[1]">👤</span>
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute top-full right-0 bg-[#151525] shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-[rgba(255,_255,_255,_0.1)] rounded-[12px] p-3 mt-2.5 z-[100] min-w-50 flex flex-col gap-2.5">
              <div className="border-b border-b-[rgba(255,_255,_255,_0.08)] pb-2 flex items-center gap-2">
                <UserAvatar url={userAvatarUrl} name={userName} size={32} />
                <div className="overflow-hidden">
                  <div className="font-bold text-white text-[0.9rem] overflow-hidden text-ellipsis whitespace-nowrap">
                    {userName || 'Usuario'}
                  </div>
                  <div className="text-[0.75rem] text-muted">Conectado</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowProfileSettings(true);
                }}
                className="glass-btn py-[9px] px-3 rounded-[8px] cursor-pointer text-[0.88rem] font-bold w-full flex items-center justify-center gap-2"
              >
                ⚙️ Ajustes de cuenta
              </button>

              <button
                className="bg-[rgba(255,_71,_87,_0.12)] border border-[rgba(255,_71,_87,_0.4)] text-[#ff4757] py-[9px] px-3 rounded-[8px] cursor-pointer text-[0.88rem] flex items-center gap-2 font-bold w-full justify-center [transition:all_0.15s_ease]"
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
