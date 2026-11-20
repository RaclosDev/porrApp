/** Panel de administración: solo responde a las cuentas de administrador. */
import type { AdminAnnouncementResult, AdminOverview } from '../../types/api';
import { request } from '../http';

export const fetchAdminOverview = () => request<AdminOverview>('/admin/overview');

export interface AdminAnnouncementInput {
  leagueIds: number[];
  title: string;
  body: string;
}

/** Aviso push a los miembros de las ligas elegidas; devuelve cuántos dispositivos lo han recibido. */
export const sendAdminAnnouncement = (input: AdminAnnouncementInput) =>
  request<AdminAnnouncementResult>('/admin/announcements', {
    method: 'POST',
    json: input,
    timeoutMs: 60_000,
    fallbackError: 'No se pudo enviar el aviso',
  });
