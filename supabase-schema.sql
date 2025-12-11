-- Create machines table
CREATE TABLE machines (
  id UUID PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  bankName TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create records table
CREATE TABLE records (
  id UUID PRIMARY KEY,
  userId TEXT NOT NULL,
  machineId UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  openingBalance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  closingBalance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  mada NUMERIC(15, 2) NOT NULL DEFAULT 0,
  visa NUMERIC(15, 2) NOT NULL DEFAULT 0,
  mastercard NUMERIC(15, 2) NOT NULL DEFAULT 0,
  gcc NUMERIC(15, 2) NOT NULL DEFAULT 0,
  machineTotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  bankMada NUMERIC(15, 2) DEFAULT 0,
  bankVisa NUMERIC(15, 2) DEFAULT 0,
  bankMastercard NUMERIC(15, 2) DEFAULT 0,
  bankGcc NUMERIC(15, 2) DEFAULT 0,
  bankCredit NUMERIC(15, 2) NOT NULL DEFAULT 0,
  difference NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  extraFields JSONB,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  userId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  taxId TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS taxId TEXT;

-- Create indexes for better query performance
CREATE INDEX idx_machines_userId ON machines(userId);
CREATE INDEX idx_records_userId ON records(userId);
CREATE INDEX idx_records_machineId ON records(machineId);
CREATE INDEX idx_records_date ON records(date);
CREATE INDEX idx_records_timestamp ON records(timestamp);

-- Enable Row Level Security
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Create policies for machines
CREATE POLICY "Users can view their own machines" ON machines
  FOR SELECT USING (auth.uid()::text = userId);

CREATE POLICY "Users can insert their own machines" ON machines
  FOR INSERT WITH CHECK (auth.uid()::text = userId);

CREATE POLICY "Users can update their own machines" ON machines
  FOR UPDATE USING (auth.uid()::text = userId);

CREATE POLICY "Users can delete their own machines" ON machines
  FOR DELETE USING (auth.uid()::text = userId);

-- Create policies for records
CREATE POLICY "Users can view their own records" ON records
  FOR SELECT USING (auth.uid()::text = userId);

CREATE POLICY "Users can insert their own records" ON records
  FOR INSERT WITH CHECK (auth.uid()::text = userId);

CREATE POLICY "Users can update their own records" ON records
  FOR UPDATE USING (auth.uid()::text = userId);

CREATE POLICY "Users can delete their own records" ON records
  FOR DELETE USING (auth.uid()::text = userId);

-- Create policies for businesses
CREATE POLICY "Users can view their own business" ON businesses
  FOR SELECT USING (auth.uid()::text = userId);

CREATE POLICY "Users can insert their own business" ON businesses
  FOR INSERT WITH CHECK (auth.uid()::text = userId);

CREATE POLICY "Users can update their own business" ON businesses
  FOR UPDATE USING (auth.uid()::text = userId);

CREATE POLICY "Users can delete their own business" ON businesses
  FOR DELETE USING (auth.uid()::text = userId);
