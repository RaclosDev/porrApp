-- Clasificación completa de cada carrera de Fórmula 1: posición, parrilla, vueltas, tiempo o diferencia,
-- abandonos y puntos de cada piloto (JSON), y el id de ESPN de la sesión de carrera para pedirla.
ALTER TABLE race_weekends
    ADD COLUMN race_session_id varchar(20),
    ADD COLUMN classification text;
