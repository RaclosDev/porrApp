import { useState } from 'react';
import { UserAvatar } from '../Avatar';
import InstallAppButton from './InstallAppButton';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import SupportDialog from '../SupportDialog';
import HeaderSupportButton, { BeerIcon } from './HeaderSupportButton';
import type { NavigateFunction } from 'react-router-dom';
import type { SettingsSection } from '../ProfileSettingsModal';

interface HeaderActionsProps {
  isUserLoggedIn: boolean;
  /** Aún se está recuperando la sesión de Safari: sin botones de acceso que luego desaparecen. */
  sessionPending?: boolean;
  navigate: NavigateFunction;
  onLogout: () => void;
  setShowProfileMenu: (show: boolean) => void;
  /** Abre los ajustes de cuenta en una sección: la cuenta o los avisos. */
  onOpenSettings: (section: SettingsSection) => void;
  showProfileMenu: boolean;
  /** Campana de avisos: solo con sesión real, no en la demo. */
  showNotificationBell: boolean;
  userAvatarUrl: string;
  /** Cuenta de administrador: el menú ofrece el panel de gestión. */
  isAdmin?: boolean;
  userId: string;
  userName: string;
}

/** Entradas del menú de cuenta que abren los ajustes, cada una en su sección. */
const SETTINGS_ENTRIES: { section: SettingsSection; label: string }[] = [
  { section: 'profile', label: 'Ajustes de cuenta' },
  { section: 'reminders', label: 'Avisos' },
];

/** Parte derecha de la cabecera: acceso, instalar la app, avisos y menú de perfil. */
export default function HeaderActions({
  isUserLoggedIn,
  sessionPending = false,
  navigate,
  onLogout,
  setShowProfileMenu,
  onOpenSettings,
  showProfileMenu,
  showNotificationBell,
  userAvatarUrl,
  isAdmin = false,
  userId,
  userName,
}: HeaderActionsProps) {
  const [showSupport, setShowSupport] = useState(false);

  return (
    <div className="header-right flex justify-end items-center gap-2.5 relative">
      {!isUserLoggedIn ? (
        sessionPending ? null : (
          <div className="flex items-center gap-2">
            <button
              id="btn-login-header"
              type="button"
              onClick={() => navigate('/login')}
              className="glass-btn header-paper-action h-11 py-0 px-4 text-[0.88rem] flex items-center justify-center gap-2 whitespace-nowrap"
              title="Iniciar sesión"
            >
              <span>Iniciar sesión</span>
            </button>
          </div>
        )
      ) : (
        <>
          <SupportDialog open={showSupport} onClose={() => setShowSupport(false)} />
          <HeaderSupportButton />
          <ThemeToggle />
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

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/gestion-7k2q');
                  }}
                  className="glass-btn py-[9px] px-3 rounded-[8px] cursor-pointer text-[0.88rem] font-bold w-full flex items-center justify-center gap-2"
                >
                  Panel de gestión
                </button>
              )}

              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowSupport(true);
                }}
                className="glass-btn py-[9px] px-3 rounded-[8px] cursor-pointer text-[0.88rem] font-bold w-full flex items-center justify-center gap-2"
              >
                <BeerIcon size={22} />
                Apoyar el proyecto
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
