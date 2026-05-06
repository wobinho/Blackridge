"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
    brand_name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brand_name.trim()) {
      setError("Brand name is required.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error || "Registration failed.");
      return;
    }

    router.push("/game");
  }

  return (
    <main className="min-h-dvh bg-[#080808] flex flex-col">
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none" />
      <div
        className="fixed pointer-events-none"
        style={{
          bottom: "-10%",
          left: "-5%",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(ellipse at center, rgba(232,0,28,0.07) 0%, transparent 65%)",
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
        <Link href="/auth/login" className="text-sm text-[#555] hover:text-white transition-colors">
          Have an account?{" "}
          <span className="text-[#e8001c]">Sign In</span>
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 flex items-center justify-center text-xs transition-all duration-300"
                  style={{
                    background: step >= s ? "#e8001c" : "transparent",
                    border: `1px solid ${step >= s ? "#e8001c" : "#333"}`,
                    fontFamily: "var(--font-mono)",
                    color: step >= s ? "white" : "#444",
                  }}
                >
                  {s}
                </div>
                {s < 2 && (
                  <div
                    className="w-12 h-px transition-all duration-300"
                    style={{ background: step > s ? "#e8001c" : "#222" }}
                  />
                )}
              </div>
            ))}
            <span className="ml-2 text-xs text-[#444]" style={{ fontFamily: "var(--font-mono)" }}>
              {step === 1 ? "ACCOUNT" : "YOUR BRAND"}
            </span>
          </div>

          {/* Step 1: Account Details */}
          {step === 1 && (
            <div>
              <div className="mb-8 animate-fade-up">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-6 h-px bg-[#e8001c]" />
                  <span className="section-tag">Create Account</span>
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
                  JOIN THE GRID
                </h1>
                <p className="text-[#555] text-sm mt-3">
                  Your journey to racing legend starts here.
                </p>
              </div>

              <form onSubmit={handleStep1} className="space-y-5 animate-fade-up animate-delay-100">
                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ridgerunner"
                    value={form.username}
                    onChange={(e) => handleChange("username", e.target.value)}
                    required
                    minLength={3}
                    maxLength={20}
                    pattern="[a-zA-Z0-9_]+"
                    title="Letters, numbers, and underscores only"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="driver@blackridge.com"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={(e) => handleChange("confirm", e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div className="px-4 py-3 border border-[#e8001c]/30 bg-[#e8001c]/5 text-sm text-[#e8001c]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary w-full py-4 text-base"
                  style={{ clipPath: "none", borderRadius: 0 }}
                >
                  Next — Name Your Brand
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Brand Setup */}
          {step === 2 && (
            <div>
              <div className="mb-8 animate-fade-up">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-6 h-px bg-[#e8001c]" />
                  <span className="section-tag">Brand Identity</span>
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
                  YOUR BRAND
                </h1>
                <p className="text-[#555] text-sm mt-3">
                  This is the name that will echo across every circuit.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up animate-delay-100">
                <div>
                  <label className="label">Brand Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Apex Motorsport"
                    value={form.brand_name}
                    onChange={(e) => handleChange("brand_name", e.target.value)}
                    required
                    minLength={2}
                    maxLength={40}
                  />
                  <p className="text-xs text-[#444] mt-2">
                    Your brand name is public and appears on leaderboards.
                  </p>
                </div>

                {/* Starting package info */}
                <div className="border border-white/[0.06] p-4">
                  <p className="text-xs text-[#e8001c] tracking-widest uppercase mb-3" style={{ fontFamily: "var(--font-mono)" }}>
                    Starter Package
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: "Credits", value: "20,000 CR" },
                      { label: "XGEAR", value: "200" },
                      { label: "Blueprints", value: "2× CC-1, 2× SC-1" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between text-sm">
                        <span className="text-[#555]">{item.label}</span>
                        <span className="text-[#888]" style={{ fontFamily: "var(--font-mono)" }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="px-4 py-3 border border-[#e8001c]/30 bg-[#e8001c]/5 text-sm text-[#e8001c]">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary px-5 py-4 flex-shrink-0"
                    style={{ clipPath: "none", borderRadius: 0 }}
                  >
                    ←
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1 py-4 text-base"
                    style={{ clipPath: "none", borderRadius: 0 }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                        Creating Brand...
                      </span>
                    ) : (
                      "Enter Blackridge"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-10 text-center">
            <p className="text-xs text-[#333]">
              Already racing?{" "}
              <Link href="/auth/login" className="text-[#e8001c] hover:text-[#ff1a35] transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
