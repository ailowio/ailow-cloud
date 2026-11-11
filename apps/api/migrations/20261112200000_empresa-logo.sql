-- Up Migration
-- RF-CFG-02: logo da empresa (bytes + MIME). Sem SVG (XSS). RLS/GRANT de empresas já cobrem.
ALTER TABLE empresas
  ADD COLUMN logo_bytes bytea NULL,
  ADD COLUMN logo_mime text NULL,
  ADD CONSTRAINT empresas_logo_par
    CHECK ((logo_bytes IS NULL) = (logo_mime IS NULL)),
  ADD CONSTRAINT empresas_logo_mime_ok
    CHECK (logo_mime IS NULL OR logo_mime IN ('image/png', 'image/jpeg', 'image/webp'));

-- Down Migration
ALTER TABLE empresas
  DROP CONSTRAINT empresas_logo_mime_ok,
  DROP CONSTRAINT empresas_logo_par,
  DROP COLUMN logo_mime,
  DROP COLUMN logo_bytes;
