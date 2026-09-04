-- Migracion: Agregar campo email_template a business
-- Fecha: 2026-08-28

ALTER TABLE business ADD COLUMN IF NOT EXISTS email_template TEXT;

COMMENT ON COLUMN business.email_template IS 'Template HTML personalizado para correos de facturas';
