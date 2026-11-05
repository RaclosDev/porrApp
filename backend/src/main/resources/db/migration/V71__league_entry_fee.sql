-- Cuota de inscripción opcional por liga. Sin cuota, la clasificación no distingue pagados y pendientes.
ALTER TABLE leagues ADD COLUMN entry_fee BOOLEAN NOT NULL DEFAULT FALSE;

-- Las ligas privadas en las que el administrador ya marcó algún pago siguen con cuota.
UPDATE leagues l
SET entry_fee = TRUE
WHERE NOT l.is_public
  AND EXISTS (SELECT 1 FROM memberships m WHERE m.league_id = l.id AND m.payment_status = 'PAID');
