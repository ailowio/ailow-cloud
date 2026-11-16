-- Up Migration
-- Rodada 2 de UX (decisão do Pedro, 2026-11-16): "Sair" desvincula o aparelho no SERVIDOR, não só apaga o cookie.
-- Revoga o ADR 004 item "não há revogação do aparelho em si". Expand puro: coluna nova anulável, nada é apagado
-- (as sessões e a trilha continuam apontando para o aparelho). O GRANT de UPDATE em aparelhos já existe (S04).
-- Desvinculado = morto para sempre: os guardas e o login ignoram o aparelho; o mesmo segredo nunca volta a valer.
ALTER TABLE aparelhos ADD COLUMN desvinculado_em timestamptz;

-- Down Migration
ALTER TABLE aparelhos DROP COLUMN desvinculado_em;
