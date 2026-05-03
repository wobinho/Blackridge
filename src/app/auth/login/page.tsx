"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error || "Login failed.");
      return;
    }

    router.push("/game");
  }

  return (
    <main className="min-h-dvh bg-[#080808] flex flex-col">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none" />

      {/* Red glow */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: "-10%",
          right: "-5%",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(ellipse at center, rgba(232,0,28,0.08) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4 md:px-12">
        <Link href="/" className="flex items-center gap-3 group">
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <path
              d="M4 22 L4 18 Q5 14 10 12 L14 10 Q15 8 16 8 Q17 8 18 10 L22 12 Q27 14 28 18 L28 22 Z"
              fill="#1c1c1c"
            />
            <rect x="4" y="20" width="24" height="2" fill="#e8001c" />
            <circle cx="10" cy="23" r="3" fill="#111" stroke="#222" strokeWidth="1" />
            <circle cx="22" cy="23" r="3" fill="#111" stroke="#222" strokeWidth="1" />
            <circle cx="10" cy="23" r="1.5" fill="#e8001c" opacity="0.7" />
            <circle cx="22" cy="23" r="1.5" fill="#e8001c" opacity="0.7" />
          </svg>
          <span
            className="text-white group-hover:text-[#e8001c] transition-colors"
            style={{ fontFamily: "var(--font-display)", fontSize: "18px", letterSpacing: "0.22em" }}
          >
            BLACKRIDGE
          </span>
        </Link>
        <Link href="/auth/register" className="text-sm text-[#555] hover:text-white transition-colors">
          No account?{" "}
          <span className="text-[#e8001c]">Register</span>
        </Link>
      </nav>

      {/* Auth card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-10 animate-fade-up">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-px bg-[#e8001c]" />
              <span className="section-tag">Welcome Back</span>
            </div>
            <h1
              className="text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "44px",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              SIGN IN
            </h1>
            <p className="text-[#555] text-sm mt-3">
              Your brand awaits. Pick up where you left off.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 animate-fade-up animate-delay-100"
          >
            <div>
              <label className="label">Username or Email</label>
              <input
                type="text"
                className="input"
                placeholder="yourname or email@brand.com"
                value={form.identifier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, identifier: e.target.value }))
                }
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="px-4 py-3 border border-[#e8001c]/30 bg-[#e8001c]/5 text-sm text-[#e8001c]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-base"
              style={{ clipPath: "none", borderRadius: 0 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                "Enter Blackridge"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8 animate-fade-up animate-delay-200">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-[#333] tracking-widest">OR</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <div className="text-center animate-fade-up animate-delay-300">
            <p className="text-sm text-[#444]">
              New to Blackridge?{" "}
              <Link
                href="/auth/register"
                className="text-[#e8001c] hover:text-[#ff1a35] transition-colors"
              >
                Create your brand
              </Link>
            </p>
          </div>

          {/* Decorative corner marks */}
          <div className="mt-12 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/[0.08]" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/[0.08]" />
            <p className="text-center text-xs text-[#252525] py-3 tracking-widest">
              BLACKRIDGE // SEASON 01
            </p>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/[0.08]" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/[0.08]" />
          </div>
        </div>
      </div>
    </main>
  );
}
