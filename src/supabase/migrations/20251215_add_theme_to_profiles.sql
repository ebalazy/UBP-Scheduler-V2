-- Add 'theme' column to 'profiles' table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'theme') THEN
        ALTER TABLE profiles ADD COLUMN theme TEXT DEFAULT 'light';
    END IF;
END $$;
