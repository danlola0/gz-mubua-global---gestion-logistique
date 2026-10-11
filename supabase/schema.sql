-- ============================================================================
-- GZ MUBUA GLOBAL - Schéma PostgreSQL & Tables pour Supabase
-- Projet : gz-mubua-global (https://btdsaxwwmbphtanzblmf.supabase.co)
-- ============================================================================

-- Extensions utiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table des Taux de Change Multi-Devises
CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    usd_rate NUMERIC(12, 4) DEFAULT 1.0000,
    cny_rate NUMERIC(12, 4) DEFAULT 7.2500,
    cdf_rate NUMERIC(12, 4) DEFAULT 2850.0000,
    aoa_rate NUMERIC(12, 4) DEFAULT 920.0000,
    last_updated DATE DEFAULT CURRENT_DATE
);

-- 2. Table des Agences & Hubs
CREATE TABLE IF NOT EXISTS agencies (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    country VARCHAR(50) NOT NULL, -- Chine, RDC, Angola
    city VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    type VARCHAR(50) DEFAULT 'destination', -- origin, destination, hub
    manager_name VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table des Utilisateurs & Rôles (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL, -- admin, china_team, kinshasa_team, cashier, client
    agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    agency_name VARCHAR(150),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table des Clients
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Kinshasa',
    country VARCHAR(50) DEFAULT 'RDC',
    total_parcels INTEGER DEFAULT 0,
    total_amount_usd NUMERIC(12, 2) DEFAULT 0.00,
    total_paid_usd NUMERIC(12, 2) DEFAULT 0.00,
    remaining_balance_usd NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(full_name);

-- 5. Table des Expéditions (Fret Maritime & Aérien)
CREATE TABLE IF NOT EXISTS shipments (
    id VARCHAR(50) PRIMARY KEY,
    shipment_number VARCHAR(50) NOT NULL UNIQUE, -- EXP-2026-00012
    departure_agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    departure_agency_name VARCHAR(150),
    destination VARCHAR(50) NOT NULL, -- Kinshasa, Angola
    destination_agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    destination_agency_name VARCHAR(150),
    transport_mode VARCHAR(20) NOT NULL, -- MARITIME, AERIEN
    carrier_name VARCHAR(150),
    container_or_flight_number VARCHAR(100),
    departure_date DATE,
    estimated_arrival_date DATE,
    actual_arrival_date DATE,
    parcel_count INTEGER DEFAULT 0,
    total_weight_kg NUMERIC(10, 2) DEFAULT 0.00,
    total_volume_cbm NUMERIC(10, 3) DEFAULT 0.000,
    total_cost_usd NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'EN_PREPARATION', -- EN_PREPARATION, EXPEDIE, EN_TRANSIT, ARRIVE, TRAITE
    parcel_ids JSONB DEFAULT '[]'::jsonb,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Table des Colis (17 Statuts Officiels)
CREATE TABLE IF NOT EXISTS parcels (
    id VARCHAR(50) PRIMARY KEY,
    tracking_number VARCHAR(50) NOT NULL UNIQUE, -- COL-2026-000001
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(150) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    weight_kg NUMERIC(10, 2) NOT NULL,
    length_cm NUMERIC(10, 2),
    width_cm NUMERIC(10, 2),
    height_cm NUMERIC(10, 2),
    volume_cbm NUMERIC(10, 3) DEFAULT 0.050,
    photos JSONB DEFAULT '[]'::jsonb,
    supplier VARCHAR(150),
    purchase_info TEXT,
    china_reception_address TEXT,
    china_reception_date DATE,
    china_agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    china_agency_name VARCHAR(150),
    shipment_id VARCHAR(50) REFERENCES shipments(id) ON DELETE SET NULL,
    shipment_number VARCHAR(50),
    transport_mode VARCHAR(20) DEFAULT 'MARITIME',
    origin VARCHAR(100) DEFAULT 'Guangzhou, Chine',
    destination VARCHAR(100) DEFAULT 'Kinshasa',
    destination_agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    destination_agency_name VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'COMMANDE_CREEE',
    status_history JSONB DEFAULT '[]'::jsonb,
    pricing_currency VARCHAR(10) DEFAULT 'USD',
    transport_cost_usd NUMERIC(12, 2) DEFAULT 0.00,
    extra_fees_usd NUMERIC(12, 2) DEFAULT 0.00,
    total_cost_usd NUMERIC(12, 2) DEFAULT 0.00,
    amount_paid_usd NUMERIC(12, 2) DEFAULT 0.00,
    remaining_amount_usd NUMERIC(12, 2) DEFAULT 0.00,
    warehouse_location VARCHAR(100),
    delivery_driver_name VARCHAR(100),
    delivery_driver_phone VARCHAR(50),
    delivery_recipient VARCHAR(150),
    delivery_date DATE,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_tracking ON parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_parcels_client_id ON parcels(client_id);
CREATE INDEX IF NOT EXISTS idx_parcels_shipment_id ON parcels(shipment_id);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);

-- 7. Table des Paiements & Recettes de Caisse
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(50) PRIMARY KEY,
    receipt_number VARCHAR(50) NOT NULL UNIQUE, -- REC-2026-0001
    parcel_id VARCHAR(50) REFERENCES parcels(id) ON DELETE SET NULL,
    parcel_tracking_number VARCHAR(50),
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL, -- AVANCE, SOLDE, FRAIS_TRANSPORT, FRAIS_SUPPLEMENTAIRES, AUTRE_RECETTE
    original_amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL, -- USD, CNY, CDF, AOA
    exchange_rate NUMERIC(12, 4) DEFAULT 1.0000,
    amount_usd NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'ESPECES',
    reference VARCHAR(100),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time VARCHAR(10),
    agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    agency_name VARCHAR(150),
    cashier_id VARCHAR(50),
    cashier_name VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_parcel ON payments(parcel_id);

-- 8. Table des Dépenses d'Exploitation
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(50) PRIMARY KEY,
    voucher_number VARCHAR(50) NOT NULL UNIQUE, -- DEP-2026-0001
    category VARCHAR(50) NOT NULL,
    category_label VARCHAR(150),
    original_amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL, -- USD, CNY, CDF, AOA
    exchange_rate NUMERIC(12, 4) DEFAULT 1.0000,
    amount_usd NUMERIC(12, 2) NOT NULL,
    agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    agency_name VARCHAR(150),
    country VARCHAR(50) NOT NULL,
    beneficiary VARCHAR(150) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time VARCHAR(10),
    recorded_by VARCHAR(150),
    description TEXT,
    attachment_name VARCHAR(255),
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Table des Employés (RH)
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    job_title VARCHAR(150) NOT NULL,
    agency_id VARCHAR(50) REFERENCES agencies(id) ON DELETE SET NULL,
    agency_name VARCHAR(150),
    country VARCHAR(50) NOT NULL,
    base_salary_usd NUMERIC(10, 2) NOT NULL,
    preferred_currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'actif',
    hire_date DATE DEFAULT CURRENT_DATE
);

-- 10. Table des Bulletins de Paie
CREATE TABLE IF NOT EXISTS salary_payments (
    id VARCHAR(50) PRIMARY KEY,
    slip_number VARCHAR(50) NOT NULL UNIQUE,
    employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150) NOT NULL,
    job_title VARCHAR(150),
    agency_name VARCHAR(150),
    country VARCHAR(50),
    period_month VARCHAR(20) NOT NULL, -- YYYY-MM
    base_salary_usd NUMERIC(10, 2) NOT NULL,
    primes_usd NUMERIC(10, 2) DEFAULT 0.00,
    avances_usd NUMERIC(10, 2) DEFAULT 0.00,
    retenues_usd NUMERIC(10, 2) DEFAULT 0.00,
    overtime_usd NUMERIC(10, 2) DEFAULT 0.00,
    net_salary_usd NUMERIC(10, 2) NOT NULL,
    paid_amount_original NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    exchange_rate NUMERIC(12, 4) DEFAULT 1.0000,
    payment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'PAYE',
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Table du Journal d'Audit
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(50),
    user_name VARCHAR(150),
    user_role VARCHAR(50),
    agency_name VARCHAR(150),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    details TEXT,
    old_value JSONB,
    new_value JSONB
);

-- 12. Table des Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    target_role VARCHAR(50) DEFAULT 'ALL',
    parcel_tracking VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- POLITIQUES DE SÉCURITÉ SUPABASE (ROW LEVEL SECURITY)
-- Permet l'accès en lecture et écriture pour la plateforme GZ MUBUA
-- ============================================================================
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Autoriser la lecture et l'écriture anonyme / API authenticated
CREATE POLICY "Public read-write exchange_rates" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write agencies" ON agencies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write shipments" ON shipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write parcels" ON parcels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write salary_payments" ON salary_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read-write notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- DONNÉES INITIALES (SEEDING)
-- ============================================================================

-- Taux de change initiaux
INSERT INTO exchange_rates (id, usd_rate, cny_rate, cdf_rate, aoa_rate, last_updated)
VALUES (1, 1.0000, 7.2500, 2850.0000, 920.0000, CURRENT_DATE)
ON CONFLICT (id) DO UPDATE SET
    cny_rate = EXCLUDED.cny_rate,
    cdf_rate = EXCLUDED.cdf_rate,
    aoa_rate = EXCLUDED.aoa_rate;

-- Agences GZ MUBUA GLOBAL
INSERT INTO agencies (id, code, name, country, city, address, phone, email, type, manager_name) VALUES
('AG-GZ', 'GZ-HQ', 'GZ MUBUA Hub Guangzhou', 'Chine', 'Guangzhou', 'No. 88 Huanshi Dong Road, Yuexiu District, Guangzhou', '+86 138 0013 8000', 'china.gz@mubua-global.com', 'origin', 'David Mubua'),
('AG-YIWU', 'YIWU-WH', 'Entrepôt GZ MUBUA Yiwu', 'Chine', 'Yiwu', 'Chouzhou North Road, International Trade City, Yiwu', '+86 139 5790 1234', 'yiwu@mubua-global.com', 'origin', 'Lin Xiaopeng'),
('AG-GOMBE', 'KIN-HQ', 'Siège Kinshasa Gombe', 'RDC', 'Kinshasa', 'Avenue Colonel Ebeya, Immeuble Horizon 3e niveau, Gombe', '+243 81 555 0101', 'kinshasa@mubua-global.com', 'destination', 'Alain Mubua (DG)'),
('AG-LIMETE', 'KIN-LIM', 'Dépôt & Retrait Kinshasa Limete', 'RDC', 'Kinshasa', '7ème Rue Limete Industriel, Hangar B4', '+243 82 444 0202', 'depot.limete@mubua-global.com', 'destination', 'Glodi Kabasele'),
('AG-LUANDA', 'LAD-AG', 'Agence Luanda Viana', 'Angola', 'Luanda', 'Estrada de Catete Km 14, Viana Industrial, Luanda', '+244 923 888 777', 'luanda@mubua-global.com', 'destination', 'Mateus Dos Santos')
ON CONFLICT (id) DO NOTHING;

-- Utilisateurs initiaux
INSERT INTO users (id, username, full_name, email, phone, role, agency_id, agency_name, status) VALUES
('USR-ADMIN', 'admin', 'Directeur Général Alain Mubua', 'direction@mubua-global.com', '+243 81 555 0101', 'admin', 'AG-GOMBE', 'Siège Kinshasa Gombe', 'active'),
('USR-CHINE', 'agent_chine', 'David Mubua (Superviseur Guangzhou)', 'david.mubua@mubua-global.com', '+86 138 0013 8000', 'china_team', 'AG-GZ', 'GZ MUBUA Hub Guangzhou', 'active'),
('USR-KIN', 'agent_kin', 'Glodi Kabasele (Chef Dépôt Limete)', 'glodi.k@mubua-global.com', '+243 82 444 0202', 'kinshasa_team', 'AG-LIMETE', 'Dépôt & Retrait Kinshasa Limete', 'active'),
('USR-CAISSE', 'caissier', 'Grâce Mpiana (Responsable Caisse)', 'caisse.kin@mubua-global.com', '+243 89 777 0303', 'cashier', 'AG-GOMBE', 'Siège Kinshasa Gombe', 'active'),
('USR-PATRICE', 'client_patrice', 'Patrice Ilunga (Client Importateur)', 'patrice.ilunga@yahoo.fr', '+243 81 234 5678', 'client', 'AG-GOMBE', 'Siège Kinshasa Gombe', 'active')
ON CONFLICT (id) DO NOTHING;

-- Clients initiaux
INSERT INTO clients (id, code, full_name, phone, email, address, city, country, total_parcels, total_amount_usd, total_paid_usd, remaining_balance_usd, notes) VALUES
('CLI-001', 'CLI-001', 'Patrice Ilunga', '+243 81 234 5678', 'patrice.ilunga@yahoo.fr', '14 Av. de la Libération, Lingwala', 'Kinshasa', 'RDC', 2, 1450.00, 1100.00, 350.00, 'Grossiste textiles et pièces auto'),
('CLI-002', 'CLI-002', 'Sarah Kalala', '+243 99 876 5432', 'sarah.kalala@gmail.com', '22 Av. Colonel Mondjiba, Ngaliema', 'Kinshasa', 'RDC', 1, 410.00, 410.00, 0.00, 'Boutique accessoires téléphonie'),
('CLI-003', 'CLI-003', 'Jean-Marc Mbemba', '+243 84 112 2334', 'jm.mbemba@outlook.com', '05 Boulevard Lumumba, Limete', 'Kinshasa', 'RDC', 1, 420.00, 200.00, 220.00, 'Importateur chaussures mode'),
('CLI-004', 'CLI-004', 'Domingos Manuel', '+244 923 111 222', 'domingos.manuel@sapo.ao', 'Rua Rainha Ginga 45, Mutamba', 'Luanda', 'Angola', 1, 1850.00, 1000.00, 850.00, 'Panneaux solaires et onduleurs'),
('CLI-005', 'CLI-005', 'Bijoux Mputu', '+243 81 999 8877', 'bijoux.mputu@gmail.com', '88 Av. Kasa-Vubu, Bandalungwa', 'Kinshasa', 'RDC', 1, 310.00, 310.00, 0.00, 'Cosmétiques et mèches')
ON CONFLICT (id) DO NOTHING;

-- Fin du script de migration Supabase
