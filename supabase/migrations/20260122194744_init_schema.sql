-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  activation_link TEXT UNIQUE,
  is_activated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create reset_tokens table
CREATE TABLE IF NOT EXISTS reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reset_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for users, tokens, reset_tokens
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tokens_refresh_token ON tokens(refresh_token);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(reset_token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON reset_tokens(user_id);

-- Create pixels table
CREATE TABLE IF NOT EXISTS pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  color TEXT NOT NULL,
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT pixels_xy_unique UNIQUE (x, y)
);

-- Create user_energy table
CREATE TABLE IF NOT EXISTS user_energy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  energy NUMERIC(10, 4) NOT NULL DEFAULT 10,
  max_energy INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for pixels and user_energy
CREATE UNIQUE INDEX IF NOT EXISTS idx_pixels_coordinates ON pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON pixels(user_id);
CREATE INDEX IF NOT EXISTS idx_pixels_placed_at ON pixels(placed_at);
CREATE INDEX IF NOT EXISTS idx_user_energy_user_id ON user_energy(user_id);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  energy_limit_level INTEGER NOT NULL DEFAULT 0,
  recovery_speed_level INTEGER NOT NULL DEFAULT 0,
  pixel_reward_level INTEGER NOT NULL DEFAULT 0,
  currency INTEGER NOT NULL DEFAULT 0,
  repaints INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  bio TEXT,
  avatar_src TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for user_stats and user_profiles
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_level ON user_stats(level);
CREATE INDEX IF NOT EXISTS idx_user_stats_repaints ON user_stats(repaints);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Create shop_items table
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('energy_limit', 'recovery_speed', 'pixel_reward')),
  base_price INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  image_url TEXT
);

-- Add UNIQUE constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shop_items_name_key' 
    AND conrelid = 'shop_items'::regclass
  ) THEN
    ALTER TABLE shop_items ADD CONSTRAINT shop_items_name_key UNIQUE (name);
  END IF;
END $$;

-- Insert initial shop items (will skip if already exist)
INSERT INTO shop_items (name, type, base_price, max_level, image_url)
VALUES 
  ('shop.energy-limit', 'energy_limit', 10, 12, '/images/shop/pixel-energy.png'),
  ('shop.recovery-speed', 'recovery_speed', 15, 12, '/images/shop/pixel-clock.png'),
  ('shop.pixel-reward', 'pixel_reward', 20, 12, '/images/shop/pixel-coin.png')
ON CONFLICT (name) DO NOTHING;

-- Create index for shop_items
CREATE INDEX IF NOT EXISTS idx_shop_items_type ON shop_items(type);