import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/game");

  return (
    <main className="relative min-h-dvh bg-[#080808] overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid opacity-50" />

      {/* Dramatic red glow blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "700px",
          height: "400px",
          background:
            "radial-gradient(ellipse at center, rgba(232,0,28,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4 md:px-12 md:pt-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-full h-full">
              <rect width="32" height="32" fill="none" />
              <path
                d="M4 22 L4 18 Q5 14 10 12 L14 10 Q15 8 16 8 Q17 8 18 10 L22 12 Q27 14 28 18 L28 22 Z"
                fill="#1c1c1c"
              />
              <rect x="4" y="20" width="24" height="2" fill="#e8001c" />
              <circle cx="10" cy="23" r="4" fill="#111" stroke="#222" strokeWidth="1" />
              <circle cx="22" cy="23" r="4" fill="#111" stroke="#222" strokeWidth="1" />
              <circle cx="10" cy="23" r="2" fill="#e8001c" opacity="0.7" />
              <circle cx="22" cy="23" r="2" fill="#e8001c" opacity="0.7" />
            </svg>
          </div>
          <span
            className="text-white tracking-[0.2em] text-sm font-medium"
            style={{ fontFamily: "var(--font-display)", fontSize: "20px", letterSpacing: "0.25em" }}
          >
            BLACKRIDGE
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="btn-ghost text-sm">
            Sign In
          </Link>
          <Link href="/auth/register" className="btn-primary text-sm px-5 py-2.5">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        {/* Eyebrow */}
        <div
          className="animate-fade-up animate-delay-100 flex items-center gap-3 mb-8"
        >
          <span className="w-8 h-px bg-[#e8001c]" />
          <span className="section-tag">Season 01 — Now Open</span>
          <span className="w-8 h-px bg-[#e8001c]" />
        </div>

        {/* Main headline */}
        <h1
          className="animate-fade-up animate-delay-200"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(64px, 14vw, 160px)",
            lineHeight: 0.92,
            letterSpacing: "0.02em",
            color: "#f0f0f0",
          }}
        >
          BUILD.
          <br />
          <span style={{ color: "#e8001c" }}>RACE.</span>
          <br />
          DOMINATE.
        </h1>

        <p
          className="animate-fade-up animate-delay-400 mt-8 max-w-md text-[#666] text-base md:text-lg leading-relaxed"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Engineer legendary cars. Field elite drivers. Build the most
          prestigious automotive brand in Blackridge history.
        </p>

        <div className="animate-fade-up animate-delay-500 flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Link href="/auth/register" className="btn-primary px-8 py-4 text-base">
            Start Your Brand
          </Link>
          <Link href="#how-it-works" className="btn-secondary px-8 py-4 text-base">
            How It Works
          </Link>
        </div>

        {/* Stats strip */}
        <div
          className="animate-fade-up animate-delay-600 mt-16 flex flex-wrap justify-center gap-8 md:gap-16"
        >
          {[
            { label: "Car Models", value: "5" },
            { label: "Race Circuits", value: "5" },
            { label: "Driver Pool", value: "8+" },
            { label: "Crafted Parts", value: "12+" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="number-display text-white"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 5vw, 44px)",
                  color: "#e8001c",
                }}
              >
                {stat.value}
              </p>
              <p className="text-xs tracking-widest uppercase text-[#555] mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Car showcase strip */}
      <section className="relative z-10 w-full overflow-hidden border-y border-white/[0.06]">
        <div className="flex items-center py-6 px-6 gap-6 overflow-x-auto scrollbar-none md:justify-center">
          {["APEX", "VORTEX", "PHANTOM", "RAPTOR", "ZENITH X"].map((model, i) => (
            <div
              key={model}
              className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border border-white/[0.08] rounded-sm"
            >
              <span
                className="text-[#e8001c] text-xs"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                0{i + 1}
              </span>
              <span
                className="text-white text-sm tracking-widest"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.15em" }}
              >
                BR-{model}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative z-10 px-6 py-20 md:py-32 max-w-5xl mx-auto"
      >
        <div className="text-center mb-16">
          <span className="section-tag">The Game</span>
          <h2
            className="mt-3 text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 6vw, 72px)",
              letterSpacing: "0.04em",
            }}
          >
            HOW BLACKRIDGE WORKS
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              num: "01",
              title: "CRAFT & ENGINEER",
              desc: "Source raw materials through racing. Craft precision parts. Assemble your Blackridge lineup — from entry-level Apex to the legendary Zenith X.",
              icon: (
                <svg viewBox="0 0 40 40" className="w-10 h-10">
                  <circle cx="20" cy="20" r="12" fill="none" stroke="#e8001c" strokeWidth="1.5"/>
                  <circle cx="20" cy="20" r="6" fill="none" stroke="#e8001c" strokeWidth="1" opacity="0.5"/>
                  <circle cx="20" cy="20" r="2" fill="#e8001c"/>
                  <line x1="20" y1="5" x2="20" y2="10" stroke="#e8001c" strokeWidth="1.5"/>
                  <line x1="20" y1="30" x2="20" y2="35" stroke="#e8001c" strokeWidth="1.5"/>
                  <line x1="5" y1="20" x2="10" y2="20" stroke="#e8001c" strokeWidth="1.5"/>
                  <line x1="30" y1="20" x2="35" y2="20" stroke="#e8001c" strokeWidth="1.5"/>
                </svg>
              ),
            },
            {
              num: "02",
              title: "RACE & EARN",
              desc: "Deploy your drivers on auto-battle race events. Climb circuits, earn credits and materials, and build prestige for your brand.",
              icon: (
                <svg viewBox="0 0 40 40" className="w-10 h-10">
                  <path d="M6 28 L6 22 Q8 16 14 13 L18 11 Q20 9 20 9 Q20 9 22 11 L26 13 Q32 16 34 22 L34 28" fill="none" stroke="#e8001c" strokeWidth="1.5"/>
                  <rect x="6" y="26" width="28" height="2" fill="#e8001c"/>
                  <circle cx="12" cy="29" r="4" fill="none" stroke="#e8001c" strokeWidth="1.5"/>
                  <circle cx="28" cy="29" r="4" fill="none" stroke="#e8001c" strokeWidth="1.5"/>
                </svg>
              ),
            },
            {
              num: "03",
              title: "SELL & DOMINATE",
              desc: "List your cars on the market. Build a revenue empire. Top the leaderboards. Your brand's name echoes across every circuit.",
              icon: (
                <svg viewBox="0 0 40 40" className="w-10 h-10">
                  <polyline points="5,32 12,20 20,25 28,12 35,8" fill="none" stroke="#e8001c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="35" cy="8" r="3" fill="#e8001c"/>
                  <line x1="5" y1="35" x2="35" y2="35" stroke="#333" strokeWidth="1"/>
                  <line x1="5" y1="10" x2="5" y2="35" stroke="#333" strokeWidth="1"/>
                </svg>
              ),
            },
          ].map((item) => (
            <div
              key={item.num}
              className="card p-6 md:p-8 card-hover transition-all duration-300"
            >
              <div className="mb-5">{item.icon}</div>
              <div
                className="text-[#e8001c] text-xs mb-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {item.num}
              </div>
              <h3
                className="text-white mb-3"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "22px",
                  letterSpacing: "0.08em",
                }}
              >
                {item.title}
              </h3>
              <p className="text-[#555] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="relative z-10 px-6 py-20 md:py-28 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <span className="section-tag">Leaderboard</span>
            <h2
              className="mt-3 text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 5vw, 56px)",
                letterSpacing: "0.04em",
              }}
            >
              PRESTIGE RANKINGS
            </h2>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <span className="text-xs text-[#444] tracking-widest uppercase">Brand</span>
              <span className="text-xs text-[#444] tracking-widest uppercase">Prestige</span>
            </div>
            {[
              { pos: 1, brand: "Apex Motorsport", prestige: "48,200", gold: true },
              { pos: 2, brand: "NightHawk Racing", prestige: "41,750", gold: false },
              { pos: 3, brand: "Iron Circuit Co.", prestige: "38,100", gold: false },
              { pos: 4, brand: "Meridian Drive", prestige: "29,400", gold: false },
              { pos: 5, brand: "Your Brand Here", prestige: "—", ghost: true },
            ].map((row) => (
              <div
                key={row.pos}
                className={`flex items-center justify-between px-5 py-4 border-b border-white/[0.04] ${
                  row.ghost ? "opacity-30" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="number-display text-sm w-6"
                    style={{
                      color: row.pos === 1 ? "#c9a84c" : "#333",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {String(row.pos).padStart(2, "0")}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: row.gold ? "#c9a84c" : "#888" }}
                  >
                    {row.brand}
                  </span>
                </div>
                <span
                  className="number-display text-sm"
                  style={{
                    color: row.gold ? "#c9a84c" : "#555",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {row.prestige}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/auth/register" className="btn-primary px-10 py-4">
              Claim Your Spot
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <span
          className="text-[#2a2a2a] text-sm tracking-widest"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.2em" }}
        >
          BLACKRIDGE
        </span>
        <p className="text-xs text-[#333]">
          © 2025 Blackridge. All rights reserved. Season 01.
        </p>
        <div className="flex gap-6">
          <Link href="/leaderboard" className="text-xs text-[#444] hover:text-[#888] transition-colors">
            Leaderboard
          </Link>
          <Link href="/auth/login" className="text-xs text-[#444] hover:text-[#888] transition-colors">
            Sign In
          </Link>
        </div>
      </footer>

      {/* Scan line effect */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)",
          backgroundSize: "100% 4px",
        }}
      />
    </main>
  );
}
