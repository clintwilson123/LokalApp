-- Disable RLS on profiles so save/load works directly
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS on other tables for safety
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
