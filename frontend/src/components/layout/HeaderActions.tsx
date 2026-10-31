import { UserAvatar } from '../Avatar';
import type { NavigateFunction } from 'react-router-dom';

interface HeaderActionsProps {
  enterDemoMode: () => void;
  isLanding: boolean;
  isUserLoggedIn: boolean;
  navigate: NavigateFunction;
  onLogout: () => void;
  setShowMyPredictionModal: (show: boolean) => void;
  setShowProfileMenu: (show: boolean) => void;
  setShowProfileSettings: (show: boolean) => void;
  showProfileMenu: boolean;
  userAvatarUrl: string;
  userId: string;
  userName: string;
}

/** Parte derecha de la cabecera: acceso, liga activa y menú de perfil. */
export default function HeaderActions({
  enterDemoMode,
  isLanding,
  isUserLoggedIn,
  navigate,
  onLogout,
  setShowMyPredictionModal,
  setShowProfileMenu,
  setShowProfileSettings,
  showProfileMenu,
  userAvatarUrl,
  userId,
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
              className="glass-btn h-11 py-0 px-3 text-[0.82rem] rounded-[10px] flex items-center gap-1.5 font-bold cursor-pointer whitespace-nowrap bg-[rgba(255,_255,_255,_0.06)] bg-none border border-[rgba(255,_255,_255,_0.15)] text-[#e2e8f0]"
              title="Probar la demo del Mundial"
              aria-label="Demo"
            >
              <span className="header-demo-label">Demo</span>
            </button>
          )}
          <button
            id="btn-login-header"
            type="button"
            onClick={() => setShowMyPredictionModal(true)}
            className="glass-btn header-paper-action h-11 py-0 px-4 text-[0.88rem] flex items-center justify-center gap-2 whitespace-nowrap"
            title="Iniciar sesión"
          >
            <span>Iniciar sesión</span>
          </button>
        </div>
      ) : (
        <>
          <button
            id="btn-profile-menu"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="glass-btn h-11 w-11 min-w-11 max-w-11 min-h-11 max-h-11 [aspect-ratio:1_/_1] rounded-full p-0 flex items-center justify-center cursor-pointer shrink-0"
            title="Menú de usuario"
            aria-label="Menú de usuario"
            aria-expanded={showProfileMenu}
          >
            <UserAvatar url={userAvatarUrl} userId={userId} name={userName} size={34} />
          </button>

          {showProfileMenu && (
            <div className="paper-panel album-sheet absolute top-full right-0 p-3 mt-2.5 z-[100] min-w-50 flex flex-col gap-2.5">
              <div className="border-b border-b-line pb-2 flex items-center gap-2">
                <UserAvatar url={userAvatarUrl} userId={userId} name={userName} size={32} />
                <div className="overflow-hidden font-bold text-main text-[0.9rem] text-ellipsis whitespace-nowrap">
                  {userName || 'Usuario'}
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
                Ajustes de cuenta
              </button>

              <button
                className="bg-[rgba(185,_28,_28,_0.08)] bg-none border border-[var(--miss)] text-[var(--miss)] py-[9px] px-3 rounded-[8px] cursor-pointer text-[0.88rem] flex items-center gap-2 font-bold w-full justify-center [transition:all_0.15s_ease]"
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
