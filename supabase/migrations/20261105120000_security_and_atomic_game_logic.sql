-- ============================================================
-- Row level security
-- ============================================================
-- The API connects with the service_role key, which bypasses RLS. No policies
-- are defined on purpose: the anon and authenticated keys get no access at all.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_energy ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Tokens are stored as SHA-256 hashes; a user may have several sessions
-- ============================================================
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS previous_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + INTERVAL '30 days';

DELETE FROM tokens a
USING tokens b
WHERE a.refresh_token = b.refresh_token AND a.ctid < b.ctid;

UPDATE tokens
SET refresh_token = encode(sha256(convert_to(refresh_token, 'UTF8')), 'hex');

UPDATE reset_tokens
SET reset_token = encode(sha256(convert_to(reset_token, 'UTF8')), 'hex');

DROP INDEX IF EXISTS idx_tokens_refresh_token;
CREATE UNIQUE INDEX idx_tokens_refresh_token ON tokens(refresh_token);
CREATE INDEX IF NOT EXISTS idx_tokens_previous_refresh_token ON tokens(previous_refresh_token);

-- ============================================================
-- Pixels: reject bad data at the database level
-- ============================================================
-- NOT VALID applies the checks to new writes without failing on existing rows.
ALTER TABLE pixels
  ADD CONSTRAINT pixels_x_range CHECK (x >= 0 AND x < 1000) NOT VALID,
  ADD CONSTRAINT pixels_y_range CHECK (y >= 0 AND y < 1000) NOT VALID,
  ADD CONSTRAINT pixels_color_format CHECK (color ~ '^#[0-9a-fA-F]{6}$') NOT VALID;

-- ============================================================
-- Game rules
-- ============================================================
-- Errors meant for players use SQLSTATE PP001 and an i18n key as the message.

CREATE OR REPLACE FUNCTION recovery_interval_seconds(p_level INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT GREATEST(60 - p_level * 3, 24);
$$;

CREATE OR REPLACE FUNCTION level_from_repaints(p_repaints INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_level INTEGER := 1;
  v_remaining INTEGER := p_repaints;
BEGIN
  -- Level N costs 10 + (N - 1) repaints; the maximum level is 100.
  WHILE v_level < 100 AND v_remaining >= 10 + (v_level - 1) LOOP
    v_remaining := v_remaining - (10 + (v_level - 1));
    v_level := v_level + 1;
  END LOOP;

  RETURN v_level;
END;
$$;

-- Applies regeneration and returns the row locked until the transaction ends.
-- updated_at only advances by whole regenerated units, so progress towards the
-- next unit survives spending. While energy is full nothing accumulates.
CREATE OR REPLACE FUNCTION settle_energy(p_user_id UUID)
RETURNS user_energy
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row user_energy;
  v_interval INTEGER;
  v_regenerated BIGINT;
BEGIN
  INSERT INTO user_stats (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_energy (user_id, updated_at) VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM user_energy WHERE user_id = p_user_id FOR UPDATE;

  SELECT recovery_interval_seconds(recovery_speed_level) INTO v_interval
  FROM user_stats WHERE user_id = p_user_id;

  v_regenerated := GREATEST(
    floor(extract(epoch FROM now() - v_row.updated_at) / v_interval),
    0
  );

  IF v_row.energy + v_regenerated >= v_row.max_energy THEN
    v_row.energy := v_row.max_energy;
    v_row.updated_at := now();
  ELSIF v_regenerated > 0 THEN
    v_row.energy := v_row.energy + v_regenerated;
    v_row.updated_at := v_row.updated_at + make_interval(secs => v_regenerated * v_interval);
  END IF;

  UPDATE user_energy
  SET energy = v_row.energy, updated_at = v_row.updated_at
  WHERE id = v_row.id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION get_energy(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_energy user_energy;
  v_level INTEGER;
BEGIN
  v_energy := settle_energy(p_user_id);

  SELECT recovery_speed_level INTO v_level FROM user_stats WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'energy', v_energy.energy,
    'maxEnergy', v_energy.max_energy,
    'recoverySpeed', recovery_interval_seconds(v_level),
    'updatedAt', v_energy.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION place_pixels(p_user_id UUID, p_pixels JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_energy user_energy;
  v_stats user_stats;
  v_count INTEGER;
  v_reward INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM (
    SELECT DISTINCT x, y FROM jsonb_to_recordset(p_pixels) AS t(x INTEGER, y INTEGER)
  ) AS unique_pixels;

  IF v_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PP001', MESSAGE = 'canvas.errors.invalid-pixel-data';
  END IF;

  -- The row lock makes concurrent batches of one user wait for each other.
  v_energy := settle_energy(p_user_id);

  IF v_energy.energy < v_count THEN
    RAISE EXCEPTION USING ERRCODE = 'PP001', MESSAGE = 'errors.not-enough-energy';
  END IF;

  -- Sorted so that overlapping batches of different users lock rows in one order.
  INSERT INTO pixels (x, y, color, user_id, placed_at)
  SELECT x, y, color, p_user_id, now()
  FROM (
    SELECT DISTINCT ON (x, y) x, y, color
    FROM jsonb_to_recordset(p_pixels) AS t(x INTEGER, y INTEGER, color TEXT)
    ORDER BY x, y
  ) AS unique_pixels
  ORDER BY x, y
  ON CONFLICT (x, y) DO UPDATE
  SET color = EXCLUDED.color,
      user_id = EXCLUDED.user_id,
      placed_at = EXCLUDED.placed_at;

  UPDATE user_energy
  SET energy = energy - v_count
  WHERE id = v_energy.id
  RETURNING * INTO v_energy;

  SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id FOR UPDATE;

  v_reward := (1 + v_stats.pixel_reward_level) * v_count;

  UPDATE user_stats
  SET currency = currency + v_reward,
      repaints = repaints + v_count,
      level = level_from_repaints(repaints + v_count)
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'energy', v_energy.energy,
    'maxEnergy', v_energy.max_energy,
    'recoverySpeed', recovery_interval_seconds(v_stats.recovery_speed_level),
    'updatedAt', v_energy.updated_at,
    'placedAt', now(),
    'currencyEarned', v_reward
  );
END;
$$;

CREATE OR REPLACE FUNCTION upgrade_item(p_user_id UUID, p_item_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item shop_items;
  v_energy user_energy;
  v_stats user_stats;
  v_level INTEGER;
  v_price INTEGER;
BEGIN
  SELECT * INTO v_item FROM shop_items WHERE type = p_item_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PP001', MESSAGE = 'shop.shop-item-not-found';
  END IF;

  -- Same lock order as place_pixels: energy first, then stats.
  v_energy := settle_energy(p_user_id);

  SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id FOR UPDATE;

  v_level := CASE p_item_type
    WHEN 'energy_limit' THEN v_stats.energy_limit_level
    WHEN 'recovery_speed' THEN v_stats.recovery_speed_level
    WHEN 'pixel_reward' THEN v_stats.pixel_reward_level
  END;

  IF v_level >= v_item.max_level THEN
    RAISE EXCEPTION USING ERRCODE = 'PP001', MESSAGE = 'shop.item-max-level';
  END IF;

  v_price := floor(v_item.base_price * power(1.25::DOUBLE PRECISION, v_level));

  IF v_stats.currency < v_price THEN
    RAISE EXCEPTION USING ERRCODE = 'PP001', MESSAGE = 'shop.not-enough-currency';
  END IF;

  UPDATE user_stats
  SET currency = currency - v_price,
      energy_limit_level = energy_limit_level + (p_item_type = 'energy_limit')::INTEGER,
      recovery_speed_level = recovery_speed_level + (p_item_type = 'recovery_speed')::INTEGER,
      pixel_reward_level = pixel_reward_level + (p_item_type = 'pixel_reward')::INTEGER
  WHERE user_id = p_user_id
  RETURNING * INTO v_stats;

  IF p_item_type = 'energy_limit' THEN
    UPDATE user_energy
    SET max_energy = max_energy + 1, energy = energy + 1
    WHERE id = v_energy.id;
  END IF;

  RETURN jsonb_build_object(
    'level', v_level + 1,
    'currency', v_stats.currency
  );
END;
$$;

-- Supabase exposes functions in the public schema over HTTP, and these trust
-- p_user_id, so only the API (service_role) may call them.
REVOKE ALL ON FUNCTION recovery_interval_seconds(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION level_from_repaints(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION settle_energy(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_energy(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION place_pixels(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION upgrade_item(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION recovery_interval_seconds(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION level_from_repaints(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION settle_energy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_energy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION place_pixels(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION upgrade_item(UUID, TEXT) TO service_role;
