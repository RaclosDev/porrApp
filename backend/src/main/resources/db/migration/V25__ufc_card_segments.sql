-- UFC: partes de la cartelera que sigue una liga («EARLY_PRELIMS,PRELIMS,MAIN», en ese orden). Nulo: la
-- velada completa, como hasta ahora.
ALTER TABLE editions ADD COLUMN card_segments varchar(40);
ALTER TABLE editions ADD CONSTRAINT editions_card_segments_check
    CHECK (card_segments IS NULL OR card_segments ~ '^(EARLY_PRELIMS|PRELIMS|MAIN)(,(EARLY_PRELIMS|PRELIMS|MAIN)){0,1}$');
