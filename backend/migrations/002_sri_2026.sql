-- Migracion: SRI 2026 - IVA configurable, secuencial, configuracion SRI
-- Fecha: 2026-08-28

-- 1. Agregar campo iva_rate a productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS iva_rate DECIMAL(5,2) DEFAULT 15;

-- 2. Agregar campos de IVA a sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_15 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_12 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_5 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_0 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_no_objeto DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_exento DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS iva_15 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS iva_12 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS iva_5 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sri_status VARCHAR(20) DEFAULT 'local';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sri_error TEXT;

-- 3. Agregar campos de IVA y descuento a sale_items
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS iva_rate DECIMAL(5,2) DEFAULT 15;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;

-- 4. Agregar campos SRI a business
ALTER TABLE business ADD COLUMN IF NOT EXISTS sri_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE business ADD COLUMN IF NOT EXISTS sri_ambiente VARCHAR(1) DEFAULT '1';
ALTER TABLE business ADD COLUMN IF NOT EXISTS sri_tipo_emision VARCHAR(1) DEFAULT '1';
ALTER TABLE business ADD COLUMN IF NOT EXISTS sri_contribuyente_especial VARCHAR(20);
ALTER TABLE business ADD COLUMN IF NOT EXISTS sri_agente_retencion VARCHAR(20);
ALTER TABLE business ADD COLUMN IF NOT EXISTS sri_regimen VARCHAR(20) DEFAULT 'GENERAL';

-- 5. Crear tabla de secuenciales
CREATE TABLE IF NOT EXISTS invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id),
    doc_type VARCHAR(5) NOT NULL,
    establecimiento VARCHAR(3) NOT NULL,
    punto_emision VARCHAR(3) NOT NULL,
    current_sequence INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_id, doc_type, establecimiento, punto_emision)
);

-- Comentarios
COMMENT ON COLUMN products.iva_rate IS 'Tarifa IVA: 0, 5, 12, 15 por ciento';
COMMENT ON COLUMN sales.sri_status IS 'Estado SRI: local, pending, authorized, rejected';
COMMENT ON COLUMN business.sri_enabled IS 'Habilitar facturacion electronica SRI';
COMMENT ON COLUMN business.sri_ambiente IS 'Ambiente SRI: 1=Pruebas, 2=Produccion';
COMMENT ON COLUMN business.sri_regimen IS 'Regimen tributario: GENERAL, RIMPE, ESPECIAL';
