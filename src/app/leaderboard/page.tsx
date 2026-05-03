import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { getSession } from "@/lib/auth";
import Link from "next/link";

interface LeaderRow {
  rank: number;
  username: string;
  brand_name: string;
  prestige: number;
  credits: number;
  level: number;
}

async function getLeaders(): Promise<LeaderRow[]> {
  try {
    const db = await initDb();
    await seedDatabase(db);
    return db
      .prepare(
        `SELECT
          ROW_NUMBER() OVER (ORDER BY prestige DESC) as rank,
          username, brand_name, prestige, credits, level
         FROM users
         ORDER BY prestige DESC
         LIMIT 50`
      )
      .all() as LeaderRow[];
  } catch {
    return [];
  }
}

export default async function LeaderboardPage() {
  const [session, leaders] = await Promise.all([getSession(), getLeaders()]);

  return (
    <main className="min-h-dvh bg-[#080808]">
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4 md:px-12 border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <path d="M4 22 L4 18 Q5 14 10 12 L14 10 Q15 8 16 8 Q17 8 18 10 L22 12 Q27 14 28 18 L28 22 Z" fill="#1c1c1c"/>
            <rect x="4" y="20" width="24" height="2" fill="#e8001c"/>
            <circle cx="10" cy="23" r="3" fill="#111" stroke="#222" strokeWidth="1"/>
            <circle cx="22" cy="23" r="3" fill="#111" stroke="#222" strokeWidth="1"/>
            <circle cx="10" cy="23" r="1.5" fill="#e8001c" opacity="0.7"/>
            <circle cx="22" cy="23" r="1.5" fill="#e8001c" opacity="0.7"/>
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", letterSpacing: "0.22em", color: "white" }}>
            BLACKRIDGE
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {session ? (
            <Link href="/game" className="btn-primary px-4 py-2 text-sm">
              My HQ
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="btn-ghost text-sm">Sign In</Link>
              <Link href="/auth/register" className="btn-primary px-4 py-2 text-sm">Register</Link>
            </>
          )}
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-20">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-8 h-px bg-[#e8001c]" />
            <span className="section-tag">Season 01</span>
            <span className="w-8 h-px bg-[#e8001c]" />
          </div>
          <h1
            className="text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(48px, 10vw, 88px)",
              letterSpacing: "0.04em",
              lineHeight: 0.95,
            }}
          >
            PRESTIGE
            <br />
            RANKINGS
          </h1>
          <p className="text-[#555] text-sm mt-4">
            The most prestigious brands on the grid. Build your legacy.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/[0.05] pb-4 overflow-x-auto">
          {["Prestige", "Credits", "Race Wins", "Cars Sold"].map((tab, i) => (
            <button
              key={tab}
              className="flex-shrink-0 px-4 py-2 text-xs tracking-widest uppercase transition-all duration-150"
              style={{
                fontFamily: "var(--font-mono)",
                color: i === 0 ? "#e8001c" : "#333",
                borderBottom: i === 0 ? "1px solid #e8001c" : "1px solid transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden animate-fade-up animate-delay-200">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_auto] md:grid-cols-[48px_1fr_auto_auto] items-center px-5 py-3 border-b border-white/[0.08]">
            <span className="text-xs text-[#333] tracking-widest" style={{ fontFamily: "var(--font-mono)" }}>#</span>
            <span className="text-xs text-[#333] tracking-widest uppercase">Brand</span>
            <span className="text-xs text-[#333] tracking-widest uppercase hidden md:block">LVL</span>
            <span className="text-xs text-[#333] tracking-widest uppercase text-right">Prestige</span>
          </div>

          {leaders.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-[#2a2a2a] text-sm">No brands yet. Be the first.</p>
              <Link href="/auth/register" className="btn-primary mt-6 inline-flex px-6 py-3">
                Create Your Brand
              </Link>
            </div>
          ) : (
            leaders.map((row, i) => {
              const isCurrentUser = session?.username === row.username;
              const medal = i === 0 ? "#c9a84c" : i === 1 ? "#aaaaaa" : i === 2 ? "#cd7f32" : null;

              return (
                <div
                  key={row.username}
                  className="grid grid-cols-[40px_1fr_auto] md:grid-cols-[48px_1fr_auto_auto] items-center px-5 py-4 border-b border-white/[0.04] last:border-0 transition-colors"
                  style={{
                    background: isCurrentUser ? "rgba(232,0,28,0.04)" : "transparent",
                    borderLeft: isCurrentUser ? "2px solid rgba(232,0,28,0.4)" : "2px solid transparent",
                  }}
                >
                  <span
                    className="number-display text-sm"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: medal || "#333",
                      fontWeight: medal ? "600" : "400",
                    }}
                  >
                    {String(row.rank).padStart(2, "0")}
                  </span>

                  <div>
                    <p
                      className="text-sm"
                      style={{ color: isCurrentUser ? "#fff" : "#777" }}
                    >
                      {row.brand_name}
                      {isCurrentUser && (
                        <span
                          className="ml-2 text-xs px-1.5 py-0.5 border border-[#e8001c]/30 text-[#e8001c]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          YOU
                        </span>
                      )}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "#333", fontFamily: "var(--font-mono)" }}
                    >
                      @{row.username}
                    </p>
                  </div>

                  <span
                    className="text-xs number-display hidden md:block"
                    style={{ color: "#444", fontFamily: "var(--font-mono)" }}
                  >
                    LVL {row.level}
                  </span>

                  <span
                    className="text-sm number-display text-right"
                    style={{
                      color: medal || (isCurrentUser ? "#e8001c" : "#555"),
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {row.prestige.toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* CTA for non-logged-in */}
        {!session && (
          <div className="mt-10 text-center animate-fade-up animate-delay-400">
            <p className="text-[#444] text-sm mb-4">
              Your brand isn&apos;t on this list yet.
            </p>
            <Link href="/auth/register" className="btn-primary px-10 py-4">
              Join the Grid
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
