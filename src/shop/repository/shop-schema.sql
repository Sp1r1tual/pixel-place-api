CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('energy_limit', 'recovery_speed', 'pixel_reward')),
  base_price INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  image_url TEXT
);

INSERT INTO shop_items (name, type, base_price, max_level, image_url)
VALUES 
  ('shop.energy-limit', 'energy_limit', 10, 12, '/images/shop/pixel-energy.png'),
  ('shop.recovery-speed', 'recovery_speed', 15, 12, '/images/shop/pixel-clock.png'),
  ('shop.pixel-reward', 'pixel_reward', 20, 12, '/images/shop/pixel-coin.png')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_shop_items_type ON shop_items(type);