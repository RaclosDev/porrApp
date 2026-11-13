import { useState } from 'react';
import { UserAvatar } from '../Avatar';
import InstallAppButton from './InstallAppButton';
import NotificationBell from './NotificationBell';
import SupportDialog from '../SupportDialog';
import type { NavigateFunction } from 'react-router-dom';
import type { SettingsSection } from '../ProfileSettingsModal';

interface HeaderActionsProps {
  enterDemoMode: () => void;
  isLanding: boolean;
  isUserLoggedIn: boolean;
  /** Aún se está recuperando la sesión de Safari: sin botones de acceso que luego desaparecen. */
  sessionPending?: boolean;
  navigate: NavigateFunction;
  onLogout: () => void;
  setShowLoginModal: (show: boolean) => void;
  setShowProfileMenu: (show: boolean) => void;
  /** Abre los ajustes de cuenta en una sección: la cuenta o los avisos. */
  onOpenSettings: (section: SettingsSection) => void;
  showProfileMenu: boolean;
  /** Campana de avisos: solo con sesión real, no en la demo. */
  showNotificationBell: boolean;
  userAvatarUrl: string;
  userId: string;
  userName: string;
}

/** Taza con vapor y un corazón: mismo trazo que los iconos de la campana para que casen. */
function SupportCupIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2.5c-.6.8-.6 1.7 0 2.5M12 2.5c-.6.8-.6 1.7 0 2.5" />
      <path d="M4 8h13v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8Z" />
      <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path
        d="M10.5 16.2s-2.7-1.5-2.7-3.2a1.4 1.4 0 0 1 2.7-.5 1.4 1.4 0 0 1 2.7.5c0 1.7-2.7 3.2-2.7 3.2Z"
        fill="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Entradas del menú de cuenta que abren los ajustes, cada una en su sección. */
const SETTINGS_ENTRIES: { section: SettingsSection; label: string }[] = [
  { section: 'account', label: 'Ajustes de cuenta' },
  { section: 'reminders', label: 'Avisos' },
];

/** Parte derecha de la cabecera: acceso, instalar la app, avisos y menú de perfil. */
export default function HeaderActions({
  enterDemoMode,
  isLanding,
  isUserLoggedIn,
  sessionPending = false,
  navigate,
  onLogout,
  setShowLoginModal,
  setShowProfileMenu,
  onOpenSettings,
  showProfileMenu,
  showNotificationBell,
  userAvatarUrl,
  userId,
  userName,
}: HeaderActionsProps) {
  const [showSupport, setShowSupport] = useState(false);

  return (
    <div className="header-right flex justify-end items-center gap-2.5 relative">
      {!isUserLoggedIn ? (
        sessionPending ? null : (
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
                title="Probar la demo"
                aria-label="Demo"
              >
                <span className="header-demo-label">Demo</span>
              </button>
            )}
            <button
              id="btn-login-header"
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="glass-btn header-paper-action h-11 py-0 px-4 text-[0.88rem] flex items-center justify-center gap-2 whitespace-nowrap"
              title="Iniciar sesión"
            >
              <span>Iniciar sesión</span>
            </button>
          </div>
        )
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowSupport(true)}
            title="Apoya el proyecto"
            aria-label="Apoya el proyecto"
            aria-haspopup="dialog"
            className="glass-btn header-icon-btn header-support-btn"
          >
            <SupportCupIcon />
            <span className="header-support-label">Apoyar</span>
          </button>
          <SupportDialog open={showSupport} onClose={() => setShowSupport(false)} />
          <InstallAppButton />
          {showNotificationBell && (
            <NotificationBell onOpenSettings={() => onOpenSettings('reminders')} />
          )}
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

              {SETTINGS_ENTRIES.map(({ section, label }) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings(section);
                  }}
                  className="glass-btn py-[9px] px-3 rounded-[8px] cursor-pointer text-[0.88rem] font-bold w-full flex items-center justify-center gap-2"
                >
                  {label}
                </button>
              ))}

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
