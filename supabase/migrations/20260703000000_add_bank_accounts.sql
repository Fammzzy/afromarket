-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view bank accounts
-- Buyers need to see sellers' bank details, and sellers need to see their own.
CREATE POLICY "Bank accounts are viewable by authenticated users" 
ON bank_accounts FOR SELECT 
TO authenticated 
USING (true);

-- Policy: Allow users to insert their own bank account
CREATE POLICY "Users can insert their own bank account" 
ON bank_accounts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to update their own bank account
CREATE POLICY "Users can update their own bank account" 
ON bank_accounts FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bank_accounts_timestamp
BEFORE UPDATE ON bank_accounts
FOR EACH ROW
EXECUTE FUNCTION update_bank_accounts_updated_at();
