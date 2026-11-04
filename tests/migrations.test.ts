import { readdirSync, readFileSync } from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");
const USER_ID = "11111111-1111-1111-1111-111111111111";

let db: PGlite;

const rpc = async <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T> => {
  const { rows } = await db.query<{ result: T }>(sql, params);
  return (rows[0] as { result: T }).result;
};

const placePixels = (pixels: object[]) =>
  rpc<{ energy: number; currencyEarned: number; updatedAt: string }>(
    "SELECT place_pixels($1, $2::jsonb) AS result",
    [USER_ID, JSON.stringify(pixels)],
  );

const upgrade = (type: string) =>
  rpc<{ level: number; currency: number }>(
    "SELECT upgrade_item($1, $2) AS result",
    [USER_ID, type],
  );

const getEnergy = () =>
  rpc<{ energy: number; maxEnergy: number; updatedAt: string }>(
    "SELECT get_energy($1) AS result",
    [USER_ID],
  );

const stats = async () =>
  (
    await db.query<{ currency: number; repaints: number; level: number }>(
      "SELECT currency, repaints, level FROM user_stats WHERE user_id = $1",
      [USER_ID],
    )
  ).rows[0]!;

const setEnergy = (energy: number, secondsAgo: number) =>
  db.query(
    `UPDATE user_energy SET energy = $1, updated_at = now() - make_interval(secs => $2)
     WHERE user_id = $3`,
    [energy, secondsAgo, USER_ID],
  );

const pixel = (x: number, y = 0, color = "#FF0000") => ({ x, y, color });

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  `);

  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
});

beforeEach(async () => {
  await db.exec("TRUNCATE users CASCADE");
  await db.query(
    "INSERT INTO users (id, email, password) VALUES ($1, 'a@b.c', 'x')",
    [USER_ID],
  );
});

describe("place_pixels", () => {
  it("spends energy and pays the reward atomically", async () => {
    const result = await placePixels([pixel(1), pixel(2)]);

    expect(Number(result.energy)).toBe(8);
    expect(result.currencyEarned).toBe(2);
    expect(await stats()).toMatchObject({
      currency: 2,
      repaints: 2,
      level: 1,
    });
  });

  it("charges once for duplicate coordinates", async () => {
    const result = await placePixels([
      pixel(5, 5, "#000000"),
      pixel(5, 5, "#FFFFFF"),
    ]);

    expect(Number(result.energy)).toBe(9);
  });

  it("refuses a batch larger than the available energy and changes nothing", async () => {
    await expect(
      placePixels(Array.from({ length: 11 }, (_, i) => pixel(i))),
    ).rejects.toMatchObject({
      code: "PP001",
      message: "errors.not-enough-energy",
    });

    const { rows } = await db.query("SELECT 1 FROM pixels");
    expect(rows).toHaveLength(0);
    expect(Number((await getEnergy()).energy)).toBe(10);
  });

  it("keeps energy when a pixel fails a database check", async () => {
    await expect(placePixels([pixel(1, 0, "#<script>")])).rejects.toThrow();
    expect(Number((await getEnergy()).energy)).toBe(10);
  });

  it("repaints an existing pixel", async () => {
    await placePixels([pixel(1, 1, "#000000")]);
    await placePixels([pixel(1, 1, "#FFFFFF")]);

    const { rows } = await db.query<{ color: string }>(
      "SELECT color FROM pixels",
    );
    expect(rows).toEqual([{ color: "#FFFFFF" }]);
  });

  it("levels up with the same curve as before", async () => {
    await getEnergy();
    await db.query("UPDATE user_stats SET repaints = 9 WHERE user_id = $1", [
      USER_ID,
    ]);

    await placePixels([pixel(1)]);

    expect((await stats()).level).toBe(2);
  });
});

describe("energy regeneration", () => {
  beforeEach(async () => {
    await getEnergy();
  });

  it("regenerates one unit per interval", async () => {
    await setEnergy(0, 125);
    expect(Number((await getEnergy()).energy)).toBe(2);
  });

  it("keeps partial progress when energy is spent", async () => {
    await setEnergy(5, 59);
    await placePixels([pixel(1)]);

    // One more second completes the 60-second interval that was already running.
    await db.query(
      `UPDATE user_energy SET updated_at = updated_at - interval '1 second'
       WHERE user_id = $1`,
      [USER_ID],
    );

    expect(Number((await getEnergy()).energy)).toBe(5);
  });

  it("does not bank time beyond the maximum", async () => {
    await setEnergy(0, 100000);
    expect(Number((await getEnergy()).energy)).toBe(10);

    await placePixels([pixel(1)]);
    expect(Number((await getEnergy()).energy)).toBe(9);
  });

  it("uses a shorter interval after upgrading recovery speed", async () => {
    await db.query(
      "UPDATE user_stats SET recovery_speed_level = 12 WHERE user_id = $1",
      [USER_ID],
    );
    await setEnergy(0, 49);

    expect(Number((await getEnergy()).energy)).toBe(2);
  });
});

describe("upgrade_item", () => {
  beforeEach(async () => {
    await getEnergy();
  });

  const setCurrency = (currency: number) =>
    db.query("UPDATE user_stats SET currency = $1 WHERE user_id = $2", [
      currency,
      USER_ID,
    ]);

  it("charges the price and raises the level", async () => {
    await setCurrency(100);

    const first = await upgrade("recovery_speed");
    expect(first).toEqual({ level: 1, currency: 85 });

    const second = await upgrade("recovery_speed");
    expect(second).toEqual({ level: 2, currency: 67 });
  });

  it("raises maximum and current energy for energy_limit", async () => {
    await setCurrency(10);
    await setEnergy(4, 0);

    await upgrade("energy_limit");

    const energy = await getEnergy();
    expect(Number(energy.energy)).toBe(5);
    expect(energy.maxEnergy).toBe(11);
  });

  it("refuses without enough currency and changes nothing", async () => {
    await setCurrency(5);

    await expect(upgrade("energy_limit")).rejects.toMatchObject({
      code: "PP001",
      message: "shop.not-enough-currency",
    });
    expect((await stats()).currency).toBe(5);
    expect((await getEnergy()).maxEnergy).toBe(10);
  });

  it("refuses above the maximum level", async () => {
    await setCurrency(100000);
    await db.query(
      "UPDATE user_stats SET pixel_reward_level = 12 WHERE user_id = $1",
      [USER_ID],
    );

    await expect(upgrade("pixel_reward")).rejects.toMatchObject({
      message: "shop.item-max-level",
    });
  });

  it("refuses an unknown item", async () => {
    await expect(upgrade("constructor")).rejects.toMatchObject({
      message: "shop.shop-item-not-found",
    });
  });
});

describe("access control", () => {
  const asRole = async <T>(role: string, action: () => Promise<T>) => {
    await db.exec(`SET ROLE ${role}`);
    try {
      return await action();
    } finally {
      await db.exec("RESET ROLE");
    }
  };

  it.each(["users", "tokens", "reset_tokens", "pixels", "user_stats"])(
    "hides %s from the anon role",
    async (table) => {
      await db.exec(`GRANT SELECT ON ${table} TO anon`);

      const { rows } = await asRole("anon", () =>
        db.query(`SELECT * FROM ${table}`),
      );

      expect(rows).toHaveLength(0);
    },
  );

  it.each(["anon", "authenticated"])(
    "does not let %s call game functions",
    async (role) => {
      await expect(
        asRole(role, () => db.query("SELECT get_energy($1)", [USER_ID])),
      ).rejects.toThrow(/permission denied/);
    },
  );
});
