-- Recordatorio de elección en ligas superviviente: reutiliza el registro de avisos enviados. Cada aviso
-- se distingue por su tipo: 'MATCH' para el partido sin predecir y 'SURVIVOR:<liga>' para la jornada sin
-- elegir equipo (identificada por uno de sus partidos). Así un aviso no silencia al otro.

ALTER TABLE match_reminders_sent ADD COLUMN kind varchar(40) DEFAULT 'MATCH' NOT NULL;
ALTER TABLE match_reminders_sent DROP CONSTRAINT match_reminders_sent_pkey;
ALTER TABLE match_reminders_sent ADD CONSTRAINT match_reminders_sent_pkey PRIMARY KEY (user_id, match_id, kind);
