-- Tenis: una liga puede seguir varios torneos (todos, solo los Grand Slams o solo los Masters 1000 con las
-- ATP Finals) de un circuito o de los dos. Nulo: la liga es de un solo torneo, como hasta ahora.
ALTER TABLE editions ADD COLUMN tennis_scope varchar(20);
ALTER TABLE editions ADD COLUMN tennis_tour varchar(10);
ALTER TABLE editions ADD CONSTRAINT editions_tennis_scope_check
    CHECK (tennis_scope IS NULL OR tennis_scope IN ('ALL', 'GRAND_SLAMS', 'MASTERS_1000'));
ALTER TABLE editions ADD CONSTRAINT editions_tennis_tour_check
    CHECK ((tennis_scope IS NULL AND tennis_tour IS NULL)
        OR (tennis_scope IS NOT NULL AND tennis_tour IN ('ATP', 'WTA', 'BOTH')));
