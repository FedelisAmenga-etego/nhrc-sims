-- ============================================================
-- NHRC Stores Information Management System
-- Database Schema for Supabase (PostgreSQL)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'store_manager', 'store_officer', 'viewer')),
  department_id UUID,
  phone TEXT,
  employee_id TEXT UNIQUE,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  head_of_department TEXT,
  phone TEXT,
  email TEXT,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from profiles to departments
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ============================================================
-- UNITS OF MEASUREMENT
-- ============================================================
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default units
INSERT INTO units (name, abbreviation) VALUES
  ('Pieces', 'pcs'),
  ('Boxes', 'box'),
  ('Reams', 'ream'),
  ('Litres', 'L'),
  ('Millilitres', 'mL'),
  ('Kilograms', 'kg'),
  ('Grams', 'g'),
  ('Metres', 'm'),
  ('Rolls', 'roll'),
  ('Packs', 'pack'),
  ('Pairs', 'pair'),
  ('Sets', 'set'),
  ('Cartons', 'ctn'),
  ('Bottles', 'btl'),
  ('Tubes', 'tube');

-- ============================================================
-- CATEGORIES (hierarchical)
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default categories
INSERT INTO categories (name, description) VALUES
  ('Stationery & Office Supplies', 'Paper, pens, folders, and general office items'),
  ('Medical & Laboratory Supplies', 'Medical consumables, lab reagents, and equipment'),
  ('IT & Electronics', 'Computers, printers, peripherals, and accessories'),
  ('Cleaning & Sanitation', 'Cleaning agents, PPE, and hygiene supplies'),
  ('Furniture & Fixtures', 'Desks, chairs, cabinets, and fixtures'),
  ('Vehicle & Workshop', 'Vehicle spare parts, tools, and workshop supplies'),
  ('Printing & Publishing', 'Printing materials, banners, and publication supplies'),
  ('Food & Catering', 'Kitchen and catering supplies');

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tin_number TEXT,
  bank_name TEXT,
  bank_account TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES units(id),
  quantity_in_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_value NUMERIC(14, 2) GENERATED ALWAYS AS (quantity_in_stock * unit_cost) STORED,
  location TEXT,
  bin_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GOODS RECEIVED NOTES (GRN)
-- ============================================================
CREATE TABLE goods_received_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  received_by UUID NOT NULL REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  delivery_note_number TEXT,
  invoice_number TEXT,
  purchase_order_number TEXT,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grn_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id UUID NOT NULL REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity_ordered NUMERIC(12, 2),
  quantity_received NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  total_cost NUMERIC(14, 2) GENERATED ALWAYS AS (quantity_received * unit_cost) STORED,
  expiry_date DATE,
  batch_number TEXT,
  notes TEXT
);

-- ============================================================
-- ISSUE VOUCHERS (Stock Out)
-- ============================================================
CREATE TABLE issue_vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_number TEXT NOT NULL UNIQUE,
  department_id UUID NOT NULL REFERENCES departments(id),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  issued_by UUID REFERENCES profiles(id),
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_date DATE,
  issued_date DATE,
  purpose TEXT,
  total_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'issued')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE issue_voucher_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID NOT NULL REFERENCES issue_vouchers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity_requested NUMERIC(12, 2) NOT NULL,
  quantity_approved NUMERIC(12, 2),
  quantity_issued NUMERIC(12, 2),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14, 2) GENERATED ALWAYS AS (COALESCE(quantity_issued, quantity_approved, quantity_requested) * unit_cost) STORED,
  notes TEXT
);

-- ============================================================
-- STOCK ADJUSTMENTS
-- ============================================================
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_number TEXT NOT NULL UNIQUE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  adjusted_by UUID NOT NULL REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('increase', 'decrease', 'write_off', 'correction')),
  quantity_before NUMERIC(12, 2) NOT NULL,
  quantity_adjusted NUMERIC(12, 2) NOT NULL,
  quantity_after NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STOCK ALERTS
-- ============================================================
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock', 'expiry_soon')),
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEQUENCES for auto-generating document numbers
-- ============================================================
CREATE SEQUENCE grn_number_seq START 1;
CREATE SEQUENCE voucher_number_seq START 1;
CREATE SEQUENCE adjustment_number_seq START 1;
CREATE SEQUENCE item_code_seq START 1;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-generate GRN number
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
    NEW.grn_number := 'GRN-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('grn_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_grn_number
  BEFORE INSERT ON goods_received_notes
  FOR EACH ROW EXECUTE FUNCTION generate_grn_number();

-- Auto-generate Issue Voucher number
CREATE OR REPLACE FUNCTION generate_voucher_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.voucher_number IS NULL OR NEW.voucher_number = '' THEN
    NEW.voucher_number := 'ISS-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('voucher_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_voucher_number
  BEFORE INSERT ON issue_vouchers
  FOR EACH ROW EXECUTE FUNCTION generate_voucher_number();

-- Auto-generate Adjustment number
CREATE OR REPLACE FUNCTION generate_adjustment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.adjustment_number IS NULL OR NEW.adjustment_number = '' THEN
    NEW.adjustment_number := 'ADJ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('adjustment_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_adjustment_number
  BEFORE INSERT ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION generate_adjustment_number();

-- Auto-generate Item Code
CREATE OR REPLACE FUNCTION generate_item_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
    NEW.item_code := 'ITM-' || LPAD(NEXTVAL('item_code_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_code
  BEFORE INSERT ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION generate_item_code();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_grn_updated_at BEFORE UPDATE ON goods_received_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_voucher_updated_at BEFORE UPDATE ON issue_vouchers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update stock when GRN is approved
CREATE OR REPLACE FUNCTION update_stock_on_grn_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE inventory_items i
    SET quantity_in_stock = i.quantity_in_stock + gi.quantity_received,
        unit_cost = gi.unit_cost
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id AND gi.item_id = i.id;

    -- Update GRN total value
    UPDATE goods_received_notes
    SET total_value = (SELECT COALESCE(SUM(total_cost), 0) FROM grn_items WHERE grn_id = NEW.id)
    WHERE id = NEW.id;

    -- Insert audit log
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (NEW.approved_by, 'GRN_APPROVED', 'goods_received_notes', NEW.id::TEXT,
            jsonb_build_object('grn_number', NEW.grn_number, 'status', NEW.status));

    -- Check and create stock alerts
    INSERT INTO stock_alerts (item_id, alert_type)
    SELECT i.id, 
      CASE WHEN i.quantity_in_stock = 0 THEN 'out_of_stock'
           WHEN i.quantity_in_stock <= i.reorder_level THEN 'low_stock'
      END
    FROM inventory_items i
    JOIN grn_items gi ON gi.item_id = i.id AND gi.grn_id = NEW.id
    WHERE (i.quantity_in_stock = 0 OR i.quantity_in_stock <= i.reorder_level)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_grn_stock_update
  AFTER UPDATE ON goods_received_notes
  FOR EACH ROW EXECUTE FUNCTION update_stock_on_grn_approval();

-- Update stock when issue voucher is issued
CREATE OR REPLACE FUNCTION update_stock_on_issue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'issued' AND OLD.status != 'issued' THEN
    UPDATE inventory_items i
    SET quantity_in_stock = i.quantity_in_stock - COALESCE(vi.quantity_issued, vi.quantity_approved, vi.quantity_requested)
    FROM issue_voucher_items vi
    WHERE vi.voucher_id = NEW.id AND vi.item_id = i.id;

    -- Update voucher total value
    UPDATE issue_vouchers
    SET total_value = (SELECT COALESCE(SUM(total_cost), 0) FROM issue_voucher_items WHERE voucher_id = NEW.id),
        issued_date = CURRENT_DATE
    WHERE id = NEW.id;

    -- Audit
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (NEW.issued_by, 'VOUCHER_ISSUED', 'issue_vouchers', NEW.id::TEXT,
            jsonb_build_object('voucher_number', NEW.voucher_number, 'status', NEW.status));

    -- Check low stock alerts after issue
    INSERT INTO stock_alerts (item_id, alert_type)
    SELECT i.id,
      CASE WHEN i.quantity_in_stock <= 0 THEN 'out_of_stock'
           WHEN i.quantity_in_stock <= i.reorder_level THEN 'low_stock'
      END
    FROM inventory_items i
    JOIN issue_voucher_items vi ON vi.item_id = i.id AND vi.voucher_id = NEW.id
    WHERE i.quantity_in_stock <= i.reorder_level;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_issue_stock_update
  AFTER UPDATE ON issue_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_stock_on_issue();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), NEW.email, 'viewer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_voucher_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see all, update own
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin'));

-- Departments: all authenticated can read
CREATE POLICY "departments_read" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write" ON departments FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager'));

-- Units: all can read
CREATE POLICY "units_read" ON units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_write" ON units FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager'));

-- Categories: all can read
CREATE POLICY "categories_read" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_write" ON categories FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager'));

-- Suppliers: all can read, managers can write
CREATE POLICY "suppliers_read" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_write" ON suppliers FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager'));

-- Inventory: all can read, officers+ can write
CREATE POLICY "inventory_read" ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_write" ON inventory_items FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager', 'store_officer'));

-- GRNs: all can read, officers+ can write
CREATE POLICY "grns_read" ON goods_received_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "grns_write" ON goods_received_notes FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager', 'store_officer'));

CREATE POLICY "grn_items_read" ON grn_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "grn_items_write" ON grn_items FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager', 'store_officer'));

-- Issue Vouchers
CREATE POLICY "vouchers_read" ON issue_vouchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "vouchers_write" ON issue_vouchers FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager', 'store_officer'));

CREATE POLICY "voucher_items_read" ON issue_voucher_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "voucher_items_write" ON issue_voucher_items FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager', 'store_officer'));

-- Stock adjustments
CREATE POLICY "adjustments_read" ON stock_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "adjustments_write" ON stock_adjustments FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager'));

-- Audit logs: read-only for all, system writes
CREATE POLICY "audit_read" ON audit_logs FOR SELECT TO authenticated USING (true);

-- Stock alerts
CREATE POLICY "alerts_read" ON stock_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "alerts_write" ON stock_alerts FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'store_manager', 'store_officer'));

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_unit ON inventory_items(unit_id);
CREATE INDEX idx_inventory_items_code ON inventory_items(item_code);
CREATE INDEX idx_grn_supplier ON goods_received_notes(supplier_id);
CREATE INDEX idx_grn_status ON goods_received_notes(status);
CREATE INDEX idx_grn_date ON goods_received_notes(received_date);
CREATE INDEX idx_voucher_department ON issue_vouchers(department_id);
CREATE INDEX idx_voucher_status ON issue_vouchers(status);
CREATE INDEX idx_voucher_date ON issue_vouchers(request_date);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_stock_alerts_item ON stock_alerts(item_id);
CREATE INDEX idx_stock_alerts_resolved ON stock_alerts(is_resolved);

-- ============================================================
-- VIEWS for common queries
-- ============================================================

-- Low stock view
CREATE VIEW v_low_stock_items AS
SELECT i.*, c.name as category_name, u.name as unit_name, u.abbreviation
FROM inventory_items i
LEFT JOIN categories c ON c.id = i.category_id
LEFT JOIN units u ON u.id = i.unit_id
WHERE i.quantity_in_stock <= i.reorder_level AND i.is_active = true;

-- Stock valuation by category
CREATE VIEW v_stock_valuation_by_category AS
SELECT 
  COALESCE(c.name, 'Uncategorized') as category,
  COUNT(i.id) as item_count,
  SUM(i.quantity_in_stock) as total_quantity,
  SUM(i.total_value) as total_value
FROM inventory_items i
LEFT JOIN categories c ON c.id = i.category_id
WHERE i.is_active = true
GROUP BY c.name;

-- Monthly transactions summary
CREATE VIEW v_monthly_transactions AS
SELECT 
  DATE_TRUNC('month', received_date) as month,
  'receipt' as type,
  COUNT(*) as count,
  SUM(total_value) as total_value
FROM goods_received_notes
WHERE status = 'approved'
GROUP BY DATE_TRUNC('month', received_date)
UNION ALL
SELECT 
  DATE_TRUNC('month', issued_date) as month,
  'issue' as type,
  COUNT(*) as count,
  SUM(total_value) as total_value
FROM issue_vouchers
WHERE status = 'issued' AND issued_date IS NOT NULL
GROUP BY DATE_TRUNC('month', issued_date)
ORDER BY month DESC;
