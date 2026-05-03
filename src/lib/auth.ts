import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { initDb } from "./db";
import bcrypt from "bcryptjs";
import { seedDatabase } from "./seed";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "blackridge-fallback-secret"
);
const COOKIE_NAME = "br_session";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  brand_name: string;
  prestige: number;
  credits: number;
  level: number;
}

export async function createSession(userId: number): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  const db = await initDb();
  const expiresAt = Math.floor((Date.now() + SESSION_DURATION) / 1000);

  db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token.slice(-36), userId, expiresAt);

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as number;

    const db = await initDb();
    const user = db
      .prepare(
        "SELECT id, username, email, brand_name, prestige, credits, level FROM users WHERE id = ?"
      )
      .get(userId) as SessionUser | undefined;

    return user || null;
  } catch {
    return null;
  }
}

export async function register(data: {
  username: string;
  email: string;
  password: string;
  brand_name: string;
}): Promise<{ success: boolean; error?: string; userId?: number }> {
  try {
    const db = await initDb();
    await seedDatabase(db);

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
      .get(data.email, data.username);

    if (existing) {
      return { success: false, error: "Username or email already taken." };
    }

    const hashed = await bcrypt.hash(data.password, 12);
    const result = db
      .prepare(
        "INSERT INTO users (username, email, password, brand_name) VALUES (?, ?, ?, ?)"
      )
      .run(data.username, data.email, hashed, data.brand_name);

    const userId = result.lastInsertRowid;

    // Give starting materials
    const materialIds = [1, 2, 3, 4, 5];
    const qtys = [5, 10, 2, 8, 6];
    for (let i = 0; i < materialIds.length; i++) {
      db.prepare(
        "INSERT OR REPLACE INTO inventory_materials (user_id, material_id, quantity) VALUES (?, ?, ?)"
      ).run(userId, materialIds[i], qtys[i]);
    }

    // Give starting driver (common rarity)
    const starterTemplate = db
      .prepare("SELECT id FROM driver_templates WHERE rarity = 'common' LIMIT 1")
      .get() as { id: number } | undefined;

    if (starterTemplate) {
      db.prepare(
        "INSERT INTO drivers (user_id, template_id, speed, skill, stamina, aggression) SELECT ?, id, base_speed, base_skill, base_stamina, base_aggression FROM driver_templates WHERE id = ?"
      ).run(userId, starterTemplate.id);
    }

    return { success: true, userId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Register error:", msg);
    return { success: false, error: process.env.NODE_ENV !== "production" ? msg : "Registration failed." };
  }
}

export async function login(
  emailOrUsername: string,
  password: string
): Promise<{ success: boolean; error?: string; token?: string }> {
  try {
    const db = await initDb();
    await seedDatabase(db);

    const user = db
      .prepare(
        "SELECT id, password FROM users WHERE email = ? OR username = ?"
      )
      .get(emailOrUsername, emailOrUsername) as
      | { id: number; password: string }
      | undefined;

    if (!user) {
      return { success: false, error: "Invalid credentials." };
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return { success: false, error: "Invalid credentials." };
    }

    db.prepare("UPDATE users SET last_active = unixepoch() WHERE id = ?").run(
      user.id
    );

    const token = await createSession(user.id);
    return { success: true, token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Login error:", msg);
    return { success: false, error: process.env.NODE_ENV !== "production" ? msg : "Login failed." };
  }
}

export const COOKIE_CONFIG = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION / 1000,
};
