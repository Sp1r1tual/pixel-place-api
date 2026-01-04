CREATE TABLE IF NOT EXISTS pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  color TEXT NOT NULL,
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT pixels_xy_unique UNIQUE (x, y)
);

CREATE TABLE IF NOT EXISTS user_energy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  energy NUMERIC(10, 4) NOT NULL DEFAULT 10,
  max_energy INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pixels_coordinates ON pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON pixels(user_id);
CREATE INDEX IF NOT EXISTS idx_pixels_placed_at ON pixels(placed_at);

CREATE INDEX IF NOT EXISTS idx_user_energy_user_id ON user_energy(user_id);