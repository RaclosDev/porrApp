/** Usuario: perfil, preferencias y cuenta. El inicio de sesión está en http.ts. */
import type { Me, ProfileResponse, StatusResponse, UserPreferences } from '../../types/api';
import { request, imageForm } from '../http';

export const fetchMe = () => request<Me>('/users/me');

export const completeProfileSetup = () =>
  request<StatusResponse>('/users/me/profile-setup', { method: 'PUT' });

export const updateUserPreferences = (preferences: UserPreferences) =>
  request<StatusResponse>('/users/me/preferences', {
    method: 'PUT',
    json: preferences,
    fallbackError: 'Error al actualizar preferencias',
  });

export const updateMyProfile = (participantName: string) =>
  request<ProfileResponse>('/users/me/profile', { method: 'PUT', json: { participantName } });

export const uploadMyAvatar = (blob: Blob) =>
  request<ProfileResponse>('/users/me/avatar', { method: 'PUT', form: imageForm(blob) });

export const deleteMyAvatar = () =>
  request<ProfileResponse>('/users/me/avatar', { method: 'DELETE' });

/** Copia en JSON de los datos personales propios (derecho de acceso y portabilidad). */
export const exportMyData = () =>
  request<unknown>('/users/me/export', { fallbackError: 'No se pudieron descargar tus datos' });

/** Borra la cuenta y todos sus datos. Falla con 409 si administra ligas con más miembros. */
export const deleteMyAccount = () =>
  request<StatusResponse>('/users/me', {
    method: 'DELETE',
    fallbackError: 'No se pudo borrar la cuenta',
  });
