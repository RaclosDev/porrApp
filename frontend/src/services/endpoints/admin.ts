/** Panel de administración: solo responde a las cuentas de administrador. */
import type { AdminOverview } from '../../types/api';
import { request } from '../http';

export const fetchAdminOverview = () => request<AdminOverview>('/admin/overview');
