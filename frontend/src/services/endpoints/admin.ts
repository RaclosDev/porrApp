/** Panel de administración: solo responde a las cuentas de administrador. */
import type { AdminAnnouncementResult, AdminIncident, AdminOverview } from '../../types/api';
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

/** Plan de una liga y si tiene la música de la TV de póker; los pagos aún se gestionan a mano. */
export const setAdminLeaguePlan = (
  id: number,
  plan: AdminOverview['leagues'][number]['plan'],
  pokerMusic: boolean,
) =>
  request<void>(`/admin/leagues/${id}/plan`, {
    method: 'PUT',
    json: { plan, pokerMusic },
    fallbackError: 'No se pudo cambiar el plan',
  });

/** Resultados retenidos por la sincronización: los abiertos y los últimos resueltos. */
export const fetchAdminIncidents = () => request<AdminIncident[]>('/admin/incidents');

/** Aplica lo que manda el proveedor (o cancela la pelea que ya no sale) y recalcula los puntos. */
export const applyAdminIncident = (id: number) =>
  request<AdminIncident>(`/admin/incidents/${id}/apply`, {
    method: 'POST',
    timeoutMs: 60_000,
    fallbackError: 'No se pudo aplicar el cambio',
  });

/** Deja el resultado guardado y no vuelve a avisar por los mismos datos. */
export const dismissAdminIncident = (id: number) =>
  request<AdminIncident>(`/admin/incidents/${id}/dismiss`, {
    method: 'POST',
    fallbackError: 'No se pudo descartar la incidencia',
  });
