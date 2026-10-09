-- Esquema preventivo de vacunación para Costa Rica (piloto en la Región Brunca).
-- Catálogo de referencia que usa el API para calcular vigencias y recordatorios.
-- Rabia anual según la práctica exigida por SENASA; el resto con refuerzo anual.
-- Edades mínimas en meses cumplidos (la primera dosis de cachorro ronda las 6-8 semanas).

INSERT INTO "esquemas_vacunacion" ("id", "pais", "especie", "vacuna", "edad_minima_meses", "intervalo_meses", "vigencia_meses") VALUES
  (gen_random_uuid(), 'CR', 'perro', 'Polivalente',         2, 12, 12),
  (gen_random_uuid(), 'CR', 'perro', 'Leptospirosis',       3, 12, 12),
  (gen_random_uuid(), 'CR', 'perro', 'Rabia',               3, 12, 12),
  (gen_random_uuid(), 'CR', 'perro', 'Tos de las perreras', 3, 12, 12),
  (gen_random_uuid(), 'CR', 'gato',  'Triple felina',       2, 12, 12),
  (gen_random_uuid(), 'CR', 'gato',  'Leucemia felina',     2, 12, 12),
  (gen_random_uuid(), 'CR', 'gato',  'Rabia',               3, 12, 12);
