-- Migracion: Agregar columnas para modo offline y multipagos
-- Fecha: 2026-08-28
-- Tabla: sales

-- external_id: ID externo para idempotencia en sync offline
ALTER TABLE sales ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);

-- discount: Descuento aplicado a la venta
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;

-- payment_method: Metodo de pago principal (cash, card, transfer, qr)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash';

-- Crear indice unico para external_id (solo si no existe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_external_id ON sales(external_id) WHERE external_id IS NOT NULL;

-- Comentario en las columnas
COMMENT ON COLUMN sales.external_id IS 'ID externo para ventas offline (UUID) - idempotencia en sincronizacion';
COMMENT ON COLUMN sales.discount IS 'Descuento total aplicado a la venta';
COMMENT ON COLUMN sales.payment_method IS 'Metodo de pago: cash, card, transfer, qr';
