-- Última actividad de cada cuenta, para borrar las inactivas durante 24 meses.
-- Las cuentas existentes empiezan a contar desde hoy: no hay historial fiable anterior.
ALTER TABLE app_users ADD COLUMN last_active_at TIMESTAMPTZ NOT NULL DEFAULT now();
