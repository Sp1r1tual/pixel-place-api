import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";

process.env.JWT_ACCESS_SECRET = "test-access";
process.env.JWT_REFRESH_SECRET = "test-refresh";
process.env.CLIENT_URL = "https://app.example.com";
process.env.API_URL = "https://api.example.com";

interface IUserRow {
  id: string;
  email: string;
  password: string;
  activation_link: string;
  is_activated: boolean;
}

interface ITokenRow {
  user_id: string;
  refresh_token: string;
  previous_refresh_token?: string;
  rotated_at?: string;
}

interface IResetRow {
  user_id: string;
  reset_token: string;
  created_at: string;
}

const db = vi.hoisted(() => ({
  users: [] as IUserRow[],
  tokens: [] as ITokenRow[],
  resets: [] as IResetRow[],
}));

const mail = vi.hoisted(() => ({
  sendActivationMail: vi.fn(),
  sendResetPasswordMail: vi.fn(),
}));

vi.mock("../src/shared/configs/supabase.js", () => ({ supabase: {} }));

vi.mock("../src/auth/services/email-service.js", () => ({
  EmailService: class {
    sendActivationMail = mail.sendActivationMail;
    sendResetPasswordMail = mail.sendResetPasswordMail;
  },
}));

vi.mock("../src/auth/models/auth-model.js", () => ({
  AuthModel: class {
    findUserByEmail = async (email: string) =>
      db.users.find((u) => u.email === email) ?? null;
    findUserById = async (id: string) =>
      db.users.find((u) => u.id === id) ?? null;
    findUserByActivationLink = async (link: string) =>
      db.users.find((u) => u.activation_link === link) ?? null;
    createUser = async (data: Omit<IUserRow, "id">) => {
      const user = { ...data, id: `user-${db.users.length + 1}` };
      db.users.push(user);
      return user;
    };
    updateUser = async (id: string, updates: Partial<IUserRow>) => {
      Object.assign(
        db.users.find((u) => u.id === id)!,
        updates,
      );
    };
    deleteUser = async (id: string) => {
      db.users = db.users.filter((u) => u.id !== id);
    };
    createToken = async (user_id: string, refresh_token: string) => {
      db.tokens.push({ user_id, refresh_token });
    };
    rotateToken = async (hash: string, newHash: string) => {
      const row = db.tokens.find((t) => t.refresh_token === hash);
      if (!row) return false;
      row.previous_refresh_token = hash;
      row.refresh_token = newHash;
      row.rotated_at = new Date().toISOString();
      return true;
    };
    wasRotatedAfter = async (hash: string, after: string) =>
      db.tokens.some(
        (t) =>
          t.previous_refresh_token === hash && (t.rotated_at as string) > after,
      );
    deleteToken = async (hash: string) => {
      db.tokens = db.tokens.filter((t) => t.refresh_token !== hash);
    };
    deleteUserTokens = async (id: string) => {
      db.tokens = db.tokens.filter((t) => t.user_id !== id);
    };
    deleteExpiredTokens = async () => undefined;
    createResetToken = async (user_id: string, reset_token: string) => {
      db.resets.push({
        user_id,
        reset_token,
        created_at: new Date().toISOString(),
      });
    };
    findResetToken = async (hash: string, after: string) =>
      db.resets.find((r) => r.reset_token === hash && r.created_at > after) ??
      null;
    hasResetTokenCreatedAfter = async (id: string, after: string) =>
      db.resets.some((r) => r.user_id === id && r.created_at > after);
    deleteResetToken = async (hash: string) => {
      db.resets = db.resets.filter((r) => r.reset_token !== hash);
    };
    deleteUserResetTokens = async (id: string) => {
      db.resets = db.resets.filter((r) => r.user_id !== id);
    };
  },
}));

const { authRouter } = await import("../src/auth/routers/auth-router.js");
const { errorMiddleware } =
  await import("../src/shared/middlewares/error-middleware.js");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use(authRouter);
app.use(errorMiddleware);

const EMAIL = "user@example.com";
const PASSWORD = "Password1";

// Every test gets its own IP so that the rate limiters stay out of the way.
let testIp = 0;
const client = () => {
  const ip = `10.0.${Math.floor(testIp / 250)}.${(testIp++ % 250) + 1}`;
  return {
    post: (url: string) => request(app).post(url).set("X-Forwarded-For", ip),
    get: (url: string) => request(app).get(url).set("X-Forwarded-For", ip),
  };
};

const addUser = async (is_activated = true) => {
  const user: IUserRow = {
    id: "user-1",
    email: EMAIL,
    password: await bcrypt.hash(PASSWORD, 4),
    activation_link: "activation-link",
    is_activated,
  };
  db.users.push(user);
  return user;
};

const refreshCookie = (res: request.Response): string => {
  const cookies = res.headers["set-cookie"] as unknown as string[];
  return cookies
    .find((c) => c.startsWith("refreshToken="))!
    .split(";")[0] as string;
};

const login = async () =>
  client().post("/login").send({ email: EMAIL, password: PASSWORD });

beforeEach(() => {
  db.users = [];
  db.tokens = [];
  db.resets = [];
  mail.sendActivationMail.mockReset().mockResolvedValue(undefined);
  mail.sendResetPasswordMail.mockReset().mockResolvedValue(undefined);
});

describe("registration", () => {
  const register = () =>
    client().post("/registration").send({ email: EMAIL, password: PASSWORD });

  it("issues no tokens before activation", async () => {
    const res = await register().expect(200);

    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(db.tokens).toHaveLength(0);
  });

  it("removes the user when the activation mail fails", async () => {
    mail.sendActivationMail.mockRejectedValue(new Error("smtp down"));

    await register().expect(400);

    expect(db.users).toHaveLength(0);
  });
});

describe("login", () => {
  it("never returns the refresh token in the body", async () => {
    await addUser();

    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeUndefined();
    expect(refreshCookie(res)).toMatch(/^refreshToken=/);
  });

  it("stores only a hash of the refresh token", async () => {
    await addUser();

    const res = await login();
    const raw = refreshCookie(res).replace("refreshToken=", "");

    expect(db.tokens[0]!.refresh_token).not.toBe(raw);
    expect(db.tokens[0]!.refresh_token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("answers the same for an unknown email and a wrong password", async () => {
    await addUser();

    const unknown = await client()
      .post("/login")
      .send({ email: "other@example.com", password: PASSWORD });
    const wrong = await client()
      .post("/login")
      .send({ email: EMAIL, password: "Password2" });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("refuses an account that is not activated", async () => {
    await addUser(false);

    const res = await login();

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("auth.errors.user-not-activated");
  });

  it("keeps sessions on several devices apart", async () => {
    await addUser();

    await login();
    await login();

    expect(db.tokens).toHaveLength(2);
    expect(db.tokens[0]!.refresh_token).not.toBe(db.tokens[1]!.refresh_token);
  });
});

describe("refresh", () => {
  it("rotates the token", async () => {
    await addUser();
    const cookie = refreshCookie(await login());

    const res = await client()
      .get("/refresh")
      .set("Cookie", cookie)
      .expect(200);

    expect(refreshCookie(res)).not.toBe(cookie);
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("lets a second tab through right after rotation without a new cookie", async () => {
    await addUser();
    const cookie = refreshCookie(await login());

    await client().get("/refresh").set("Cookie", cookie).expect(200);
    const second = await client()
      .get("/refresh")
      .set("Cookie", cookie)
      .expect(200);

    expect(second.body.accessToken).toBeTypeOf("string");
    expect(second.headers["set-cookie"]).toBeUndefined();
  });

  it("refuses an old token after the grace period", async () => {
    await addUser();
    const cookie = refreshCookie(await login());

    await client().get("/refresh").set("Cookie", cookie).expect(200);
    db.tokens[0]!.rotated_at = new Date(Date.now() - 60_000).toISOString();

    await client().get("/refresh").set("Cookie", cookie).expect(401);
  });

  it("refuses a user who is not activated", async () => {
    const user = await addUser();
    const cookie = refreshCookie(await login());

    user.is_activated = false;

    await client().get("/refresh").set("Cookie", cookie).expect(401);
  });

  it("refuses garbage", async () => {
    await client().get("/refresh").set("Cookie", "refreshToken=x").expect(401);
    await client().get("/refresh").expect(401);
  });
});

describe("logout", () => {
  it("ends the session on the server", async () => {
    await addUser();
    const cookie = refreshCookie(await login());

    await client().post("/logout").set("Cookie", cookie).expect(200);

    expect(db.tokens).toHaveLength(0);
    await client().get("/refresh").set("Cookie", cookie).expect(401);
  });

  it("succeeds without a cookie", async () => {
    await client().post("/logout").expect(200);
  });
});

describe("password reset", () => {
  const requestReset = async (email = EMAIL) => {
    const res = await client().post("/forgot-password").send({ email });
    await vi.waitFor(() => expect(res.status).toBe(200));
    return res;
  };

  const sentToken = (): string => {
    const link = mail.sendResetPasswordMail.mock.calls[0]![1] as string;
    return link.split("/").pop() as string;
  };

  it("answers the same whether or not the account exists", async () => {
    await addUser();

    const known = await requestReset();
    const unknown = await requestReset("nobody@example.com");

    expect(known.body).toEqual(unknown.body);
    expect(mail.sendResetPasswordMail).toHaveBeenCalledTimes(1);
  });

  it("does not resend within the cooldown", async () => {
    await addUser();

    await requestReset();
    await requestReset();

    expect(mail.sendResetPasswordMail).toHaveBeenCalledTimes(1);
  });

  it("changes the password and ends every session", async () => {
    await addUser();
    await login();
    await requestReset();

    await client()
      .post(`/reset-password/${sentToken()}`)
      .send({ password: "NewPassword1" })
      .expect(200);

    expect(db.tokens).toHaveLength(0);
    expect(db.resets).toHaveLength(0);
    expect(await bcrypt.compare("NewPassword1", db.users[0]!.password)).toBe(
      true,
    );
  });

  it("refuses an expired token", async () => {
    await addUser();
    await requestReset();

    db.resets[0]!.created_at = new Date(
      Date.now() - 16 * 60 * 1000,
    ).toISOString();

    const res = await client()
      .post(`/reset-password/${sentToken()}`)
      .send({ password: "NewPassword1" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("auth.errors.reset-token-invalid");
  });

  it("refuses a token that was already used", async () => {
    await addUser();
    await requestReset();
    const token = sentToken();

    await client()
      .post(`/reset-password/${token}`)
      .send({ password: "NewPassword1" })
      .expect(200);
    await client()
      .post(`/reset-password/${token}`)
      .send({ password: "NewPassword2" })
      .expect(400);
  });
});

describe("rate limiting", () => {
  it("blocks repeated forgot-password requests from one IP", async () => {
    const send = () =>
      request(app)
        .post("/forgot-password")
        .set("X-Forwarded-For", "203.0.113.7")
        .send({ email: "nobody@example.com" });

    for (let i = 0; i < 5; i++) await send().expect(200);

    const blocked = await send();

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe("errors.too-many-requests");
  });
});
