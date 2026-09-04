-- 004_add_permissions_and_notes.sql
-- Agregar campo permissions a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT;

-- Agregar campos GPS y foto a attendance
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lat FLOAT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lng FLOAT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lat FLOAT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lng FLOAT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Crear tabla customer_notes
CREATE TABLE IF NOT EXISTS customer_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(20) REFERENCES customers(dni_ruc) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    note TEXT NOT NULL,
    note_type VARCHAR(20) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crear tabla credit_notes
CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) UNIQUE,
    sale_id UUID REFERENCES sales(id) NOT NULL,
    client_id VARCHAR(20) REFERENCES customers(dni_ruc),
    client_name VARCHAR(200) NOT NULL,
    client_id_type VARCHAR(5),
    reason TEXT NOT NULL,
    subtotal_15 FLOAT DEFAULT 0,
    subtotal_12 FLOAT DEFAULT 0,
    subtotal_5 FLOAT DEFAULT 0,
    subtotal_0 FLOAT DEFAULT 0,
    subtotal FLOAT NOT NULL,
    iva_15 FLOAT DEFAULT 0,
    iva_12 FLOAT DEFAULT 0,
    iva_5 FLOAT DEFAULT 0,
    tax FLOAT NOT NULL,
    total FLOAT NOT NULL,
    date TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    clave_acceso VARCHAR(50),
    pdf_path TEXT,
    xml_path TEXT,
    sri_status VARCHAR(20) DEFAULT 'local',
    sri_error TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crear tabla credit_note_items
CREATE TABLE IF NOT EXISTS credit_note_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID REFERENCES credit_notes(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),
    name VARCHAR(200) NOT NULL,
    barcode VARCHAR(50),
    quantity FLOAT NOT NULL,
    unit_price FLOAT NOT NULL,
    iva_rate FLOAT DEFAULT 0,
    discount FLOAT DEFAULT 0
);
