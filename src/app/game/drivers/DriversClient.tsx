"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { DriverFull } from "./page";

const RARITY_CONFIG = {
  common:    { label: "COMMON",    cls: "badge-common",    glow: "rgba(180,180,180,0.06)",  border: "rgba(255,255,255,0.1)",   accent: "#aaaaaa", shimmer: false },
  rare:      { label: "RARE",      cls: "badge-rare",      glow: "rgba(59,130,246,0.12)",   border: "rgba(59,130,246,0.3)",    accent: "#60a5fa", shimmer: false },
  epic:      { label: "EPIC",      cls: "badge-epic",      glow: "rgba(168,85,247,0.14)",   border: "rgba(168,85,247,0.35)",   accent: "#c084fc", shimmer: false },
  legendary: { label: "LEGENDARY", cls: "badge-legendary", glow: "rgba(201,168,76,0.18)",   border: "rgba(201,168,76,0.45)",   accent: "#c9a84c", shimmer: true  },
};

const STATUS_CONFIG = {
  idle:     { label: "IDLE",    color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  racing:   { label: "RACING",  color: "#e8001c", bg: "rgba(232,0,28,0.12)" },
  injured:  { label: "INJURED", color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  retired:  { label: "RETIRED", color: "#555",    bg: "rgba(85,85,85,0.08)" },
};

// Stat icon paths
const STAT_ICONS: Record<string, string> = {
  Speed:      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  Skill:      "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  Stamina:    "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  Aggression: "M13 10V3L4 14h7v7l9-11h-7z",
  Morale:     "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
};

function AnimatedStatBar({ label, value, accent, delay = 0 }: { label: string; value: number; accent: string; delay?: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const iconPath = STAT_ICONS[label] ?? STAT_ICONS.Speed;
  const tier = value >= 85 ? "elite" : value >= 70 ? "strong" : value >= 50 ? "average" : "weak";
  const tierColor = tier === "elite" ? accent : tier === "strong" ? accent + "cc" : tier === "average" ? accent + "88" : "#555";

  return (
    <div className="driver-stat-row">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: accent + "99" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {tier === "elite" && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: accent, letterSpacing: "0.1em", opacity: 0.8 }}>ELITE</span>
          )}
          <span ref={barRef} style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500, color: tierColor, minWidth: "2.4ch", textAlign: "right" }}>
            {value}
          </span>
        </div>
      </div>
      <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: animated ? `${value}%` : "0%",
            background: `linear-gradient(90deg, ${accent}88, ${accent})`,
            borderRadius: "1px",
            transition: `width 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay * 0.001}s`,
            boxShadow: tier === "elite" ? `0 0 8px ${accent}66` : "none",
          }}
        />
      </div>
    </div>
  );
}

function DriverCard({ driver, onClick, index }: { driver: DriverFull; onClick: () => void; index: number }) {
  const cfg = RARITY_CONFIG[driver.rarity];
  const statusCfg = STATUS_CONFIG[driver.status];
  const displayName = driver.nickname ?? driver.name;
  const isPlaceholder = driver.resolvedPortrait.includes("placeholder");
  const topStat = Math.max(driver.speed, driver.skill, driver.stamina, driver.aggression);

  return (
    <button
      onClick={onClick}
      className="driver-card group"
      style={{
        animationDelay: `${index * 40}ms`,
        "--rarity-accent": cfg.accent,
        "--rarity-border": cfg.border,
        "--rarity-glow": cfg.glow,
      } as React.CSSProperties}
      aria-label={`View ${displayName}`}
    >
      {/* Shimmer sweep for legendary */}
      {cfg.shimmer && (
        <div className="driver-card-shimmer" aria-hidden />
      )}

      {/* Portrait section */}
      <div className="driver-card-portrait">
        {/* Carbon noise texture overlay */}
        <div className="absolute inset-0 driver-carbon" />

        {/* Rarity atmosphere glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 90%, ${cfg.glow} 0%, transparent 70%)` }}
        />

        {/* Portrait image */}
        <div className="absolute inset-0">
          <Image
            src={driver.resolvedPortrait}
            alt={displayName}
            fill
            className="object-cover object-top"
            style={{ opacity: isPlaceholder ? 0.35 : 1 }}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
          />
        </div>

        {/* Top-right status pip */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          <span
            className="driver-status-pip"
            style={{
              background: statusCfg.color,
              boxShadow: `0 0 8px ${statusCfg.color}, 0 0 2px ${statusCfg.color}`,
            }}
          />
        </div>

        {/* Top-left rarity marker */}
        <div className="absolute top-2 left-2 z-20">
          <span
            className="driver-rarity-pip"
            style={{ background: cfg.accent + "22", borderColor: cfg.accent + "66", color: cfg.accent }}
          >
            {cfg.label[0]}
          </span>
        </div>

        {/* Bottom gradient overlay into footer */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2/3 pointer-events-none"
          style={{ background: "linear-gradient(to top, #111111 0%, rgba(17,17,17,0.6) 50%, transparent 100%)" }}
        />

        {/* Name overlay at bottom of portrait */}
        <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
          <p
            className="leading-none truncate"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(11px, 2.2vw, 14px)",
              letterSpacing: "0.08em",
              color: "white",
            }}
          >
            {displayName.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Card footer — stats strip */}
      <div className="driver-card-footer">
        <div className="flex items-center justify-between">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)", letterSpacing: "0.1em" }}>
            LV.{driver.level}
          </span>
          <div className="flex gap-0.5">
            {[driver.speed, driver.skill, driver.stamina, driver.aggression].map((val, i) => (
              <div
                key={i}
                className="driver-stat-pip"
                style={{
                  background: val === topStat ? cfg.accent : val >= 70 ? cfg.accent + "55" : "rgba(255,255,255,0.08)",
                  boxShadow: val === topStat ? `0 0 4px ${cfg.accent}88` : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Border glow on hover */}
      <div className="driver-card-hover-border" style={{ "--rarity-accent": cfg.accent } as React.CSSProperties} />
    </button>
  );
}

function DriverModal({ driver, onClose }: { driver: DriverFull; onClose: () => void }) {
  const cfg = RARITY_CONFIG[driver.rarity];
  const statusCfg = STATUS_CONFIG[driver.status];
  const displayName = driver.nickname ?? driver.name;
  const winRate = driver.races > 0 ? Math.round((driver.wins / driver.races) * 100) : 0;
  const isPlaceholder = driver.resolvedPortrait.includes("placeholder");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const xpProgress = Math.min((driver.xp % 1000) / 10, 100);

  return (
    <div
      className="driver-modal-backdrop"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="driver-modal-sheet"
        style={{
          "--rarity-accent": cfg.accent,
          "--rarity-border": cfg.border,
          "--rarity-glow": cfg.glow,
          transform: visible ? "translateY(0)" : "translateY(40px)",
          transition: "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
          borderColor: cfg.border,
        } as React.CSSProperties}
      >
        {/* Rarity accent line at very top */}
        <div style={{ height: "2px", background: `linear-gradient(90deg, transparent 0%, ${cfg.accent} 40%, ${cfg.accent} 60%, transparent 100%)` }} />

        {/* Shimmer for legendary */}
        {cfg.shimmer && <div className="driver-modal-shimmer" aria-hidden />}

        {/* ── PORTRAIT + HEADER ─────────────────────────── */}
        <div className="driver-modal-hero">
          {/* Large portrait */}
          <div className="driver-modal-portrait">
            <div className="absolute inset-0 driver-carbon" style={{ opacity: 0.4 }} />
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(ellipse at 50% 80%, ${cfg.glow} 0%, transparent 65%)` }}
            />
            <Image
              src={driver.resolvedPortrait}
              alt={displayName}
              fill
              className="object-cover object-top"
              style={{ opacity: isPlaceholder ? 0.3 : 1 }}
              sizes="(max-width: 768px) 40vw, 260px"
            />
            {/* Gradient to blend into content */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to right, transparent 40%, #111111 100%), linear-gradient(to top, #111111 0%, transparent 30%)" }}
            />
          </div>

          {/* Identity block */}
          <div className="driver-modal-identity">
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`badge ${cfg.cls}`} style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em" }}>
                {cfg.label}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  color: statusCfg.color,
                  background: statusCfg.bg,
                  border: `1px solid ${statusCfg.color}33`,
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 5, height: 5, background: statusCfg.color, boxShadow: `0 0 6px ${statusCfg.color}` }}
                />
                {statusCfg.label}
              </span>
            </div>

            {/* Driver name */}
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(26px, 6vw, 42px)",
                letterSpacing: "0.04em",
                lineHeight: 1,
                color: "white",
                marginBottom: 4,
              }}
            >
              {displayName.toUpperCase()}
            </h2>

            {driver.nickname && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)", marginBottom: 4 }}>
                born {driver.name}
              </p>
            )}

            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>
              {driver.nationality} · LV.{driver.level}
            </p>

            {/* XP bar */}
            <div className="mt-3">
              <div className="flex justify-between mb-1">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em", color: "var(--color-text-subtle)", textTransform: "uppercase" }}>XP to next level</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: cfg.accent }}>{driver.xp.toLocaleString()}</span>
              </div>
              <div style={{ height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${xpProgress}%`,
                    background: `linear-gradient(90deg, ${cfg.accent}88, ${cfg.accent})`,
                    borderRadius: "1px",
                    transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s",
                    boxShadow: `0 0 8px ${cfg.accent}44`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="driver-modal-close"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--color-border)", margin: "0 16px" }} />

        {/* ── BODY ─────────────────────────────────────── */}
        <div className="driver-modal-body">

          {/* Stats column */}
          <div className="driver-modal-stats-col">
            <p className="modal-section-label">Performance</p>
            <div className="space-y-3">
              <AnimatedStatBar label="Speed"      value={driver.speed}      accent={cfg.accent} delay={100} />
              <AnimatedStatBar label="Skill"      value={driver.skill}      accent={cfg.accent} delay={160} />
              <AnimatedStatBar label="Stamina"    value={driver.stamina}    accent={cfg.accent} delay={220} />
              <AnimatedStatBar label="Aggression" value={driver.aggression} accent={cfg.accent} delay={280} />
              <AnimatedStatBar label="Morale"     value={driver.morale}     accent="#4ade80"    delay={340} />
            </div>
          </div>

          {/* Right column: career + bio */}
          <div className="driver-modal-info-col">
            {/* Career record */}
            <div className="mb-5">
              <p className="modal-section-label">Career Record</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Races",    value: driver.races.toLocaleString(), highlight: false },
                  { label: "Wins",     value: driver.wins.toLocaleString(),  highlight: driver.wins > 0 },
                  { label: "Win Rate", value: `${winRate}%`,                 highlight: winRate >= 50 },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="career-stat-cell"
                    style={{
                      borderColor: s.highlight ? cfg.accent + "44" : "var(--color-border)",
                      background: s.highlight ? cfg.accent + "08" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(18px, 3.5vw, 26px)",
                        letterSpacing: "0.04em",
                        color: s.highlight ? cfg.accent : "white",
                        lineHeight: 1,
                      }}
                    >
                      {s.value}
                    </p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", color: "var(--color-text-muted)", marginTop: 3, textTransform: "uppercase" }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bio */}
            {driver.bio && (
              <div className="mb-5">
                <p className="modal-section-label">Biography</p>
                <p style={{ fontSize: "13px", lineHeight: 1.7, color: "var(--color-text-muted)" }}>
                  {driver.bio}
                </p>
              </div>
            )}

            {/* Base stats footnote */}
            <div className="driver-base-stats">
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", color: "var(--color-text-subtle)", textTransform: "uppercase", marginBottom: 8 }}>
                Base Template
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "SPD", value: driver.base_speed },
                  { label: "SKL", value: driver.base_skill },
                  { label: "STM", value: driver.base_stamina },
                  { label: "AGG", value: driver.base_aggression },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-subtle)", letterSpacing: "0.1em" }}>{s.label}</p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "#3a3a3a", marginTop: 2 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div
        className="w-20 h-20 flex items-center justify-center mb-6 relative overflow-hidden"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="absolute inset-0 driver-carbon opacity-20" />
        <svg viewBox="0 0 64 64" className="w-9 h-9 relative z-10" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: "var(--color-text-subtle)" }}>
          <circle cx="32" cy="22" r="10" />
          <path d="M12 56 Q12 42 32 42 Q52 42 52 56" />
        </svg>
      </div>
      <p className="text-white mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "0.1em" }}>
        NO DRIVERS RECRUITED
      </p>
      <p className="text-sm max-w-xs" style={{ color: "var(--color-text-muted)", lineHeight: 1.7 }}>
        Build your roster. Visit the market to recruit drivers and field them in races.
      </p>
    </div>
  );
}

export default function DriversClient({ data }: { data: { drivers: DriverFull[]; driverCap: number } }) {
  const { drivers, driverCap } = data;
  const [selected, setSelected] = useState<DriverFull | null>(null);

  const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const sorted = [...drivers].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity] || b.level - a.level);

  return (
    <>
      {/* Inject component-scoped styles */}
      <style>{DRIVER_STYLES}</style>

      <div className="drv-page md:ml-16 pb-20 md:pb-6">

        {/* Page Header */}
        <div className="drv-page-header">
          <div className="drv-page-header-inner">
            <div>
              <h1 className="drv-page-title">DRIVERS</h1>
              <p className="drv-page-sub">Your racing roster. Manage talent and performance.</p>
            </div>
            <div className="drv-header-stat">
              <span className="drv-stat-val">{drivers.length}</span>
              <span className="drv-stat-label">/ {driverCap} SLOTS</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="drv-content">
          {/* Rarity legend */}
          {drivers.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap mb-5">
              {(["legendary", "epic", "rare", "common"] as const).map((r) => {
                const count = drivers.filter((d) => d.rarity === r).length;
                if (count === 0) return null;
                const cfg = RARITY_CONFIG[r];
                return (
                  <div key={r} className="flex items-center gap-1.5">
                    <span className={`badge ${cfg.cls} text-[9px] tracking-widest`} style={{ fontFamily: "var(--font-mono)" }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>
                      ×{count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Driver grid */}
          {drivers.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="driver-grid">
              {sorted.map((driver, i) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  index={i}
                  onClick={() => setSelected(driver)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <DriverModal driver={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

// ─── Component-scoped CSS ───────────────────────────────────────────────────
const DRIVER_STYLES = `
  /* ── Page Layout ─────────────────────────────── */
  .drv-page {
    min-height: 100vh;
    background: #080808;
    position: relative;
  }

  /* ── Page Header ──────────────────────────────── */
  .drv-page-header {
    padding: 20px 16px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: linear-gradient(180deg, rgba(232,0,28,0.04) 0%, transparent 100%);
  }
  .drv-page-header-inner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: 16px;
  }
  .drv-page-title {
    font-family: var(--font-display, 'Bebas Neue'), sans-serif;
    font-size: clamp(28px, 5vw, 40px);
    letter-spacing: 0.05em;
    color: #ffffff;
    line-height: 1;
  }
  .drv-page-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    margin-top: 4px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .drv-header-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .drv-stat-val {
    font-family: var(--font-mono, 'JetBrains Mono'), monospace;
    font-size: 18px;
    color: #e8001c;
    letter-spacing: -0.02em;
  }
  .drv-stat-label {
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.1em;
  }

  /* ── Content ──────────────────────────────────── */
  .drv-content {
    padding: 20px 16px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Driver grid */
  .driver-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  @media (min-width: 480px) { .driver-grid { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 768px) { .driver-grid { grid-template-columns: repeat(5, 1fr); gap: 12px; } }
  @media (min-width: 1024px) { .driver-grid { grid-template-columns: repeat(6, 1fr); } }

  /* Carbon texture */
  .driver-carbon {
    background-image:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(255,255,255,0.015) 2px,
        rgba(255,255,255,0.015) 4px
      );
  }

  /* Driver card */
  .driver-card {
    position: relative;
    background: #111111;
    border: 1px solid var(--rarity-border);
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    text-align: left;
    width: 100%;
    animation: driverCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .driver-card:hover {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px var(--rarity-accent, rgba(255,255,255,0.15));
  }
  .driver-card:active { transform: translateY(-1px) scale(0.99); }

  @keyframes driverCardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Card portrait area */
  .driver-card-portrait {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background: #0a0a0a;
    overflow: hidden;
  }

  /* Card footer */
  .driver-card-footer {
    padding: 6px 8px 7px;
    background: #111111;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  /* Stat pip dots */
  .driver-stat-pip {
    width: 5px;
    height: 5px;
    border-radius: 1px;
    transition: background 0.2s ease;
  }

  /* Rarity pip */
  .driver-rarity-pip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0;
    border: 1px solid;
    border-radius: 2px;
  }

  /* Status pip */
  .driver-status-pip {
    display: block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  /* Shimmer sweep */
  .driver-card-shimmer {
    position: absolute;
    inset: 0;
    z-index: 30;
    pointer-events: none;
    background: linear-gradient(105deg, transparent 30%, rgba(201,168,76,0.07) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: shimmerSweep 3.5s ease-in-out infinite;
  }
  @keyframes shimmerSweep {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Hover border overlay */
  .driver-card-hover-border {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    box-shadow: inset 0 0 0 1px var(--rarity-accent);
    transition: opacity 0.25s ease;
    border-radius: 2px;
  }
  .driver-card:hover .driver-card-hover-border { opacity: 0.5; }

  /* Modal backdrop */
  .driver-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(4px);
  }
  @media (min-width: 768px) {
    .driver-modal-backdrop {
      align-items: center;
      padding: 24px;
    }
  }

  /* Modal sheet */
  .driver-modal-sheet {
    position: relative;
    width: 100%;
    background: #111111;
    border: 1px solid;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    max-height: 94dvh;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
  }
  @media (min-width: 768px) {
    .driver-modal-sheet {
      max-width: 720px;
      border-bottom: 1px solid;
      border-radius: 4px;
      max-height: 90dvh;
    }
  }

  /* Modal shimmer */
  .driver-modal-shimmer {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(105deg, transparent 20%, rgba(201,168,76,0.04) 50%, transparent 80%);
    background-size: 300% 100%;
    animation: shimmerSweep 4s ease-in-out infinite;
  }

  /* Hero section — portrait + identity side by side */
  .driver-modal-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
  }
  @media (min-width: 640px) { .driver-modal-hero { padding: 20px 24px; gap: 20px; } }

  /* Modal portrait */
  .driver-modal-portrait {
    position: relative;
    flex-shrink: 0;
    width: 90px;
    height: 120px;
    background: #0a0a0a;
    border-radius: 2px;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .driver-modal-portrait {
      width: 130px;
      height: 172px;
    }
  }

  /* Modal identity */
  .driver-modal-identity {
    flex: 1;
    min-width: 0;
    padding-top: 2px;
  }

  /* Close button */
  .driver-modal-close {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    background: transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .driver-modal-close:hover { color: white; border-color: rgba(255,255,255,0.25); }

  /* Modal body */
  .driver-modal-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
  }
  @media (min-width: 640px) {
    .driver-modal-body {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Stats column */
  .driver-modal-stats-col {
    padding: 16px;
    border-bottom: 1px solid var(--color-border);
  }
  @media (min-width: 640px) {
    .driver-modal-stats-col {
      border-bottom: none;
      border-right: 1px solid var(--color-border);
      padding: 20px 24px;
    }
  }

  /* Info column */
  .driver-modal-info-col {
    padding: 16px;
  }
  @media (min-width: 640px) { .driver-modal-info-col { padding: 20px 24px; } }

  /* Section label */
  .modal-section-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
    margin-bottom: 12px;
  }

  /* Career stat cell */
  .career-stat-cell {
    padding: 10px 8px;
    text-align: center;
    border: 1px solid;
    border-radius: 2px;
  }

  /* Base stats section */
  .driver-base-stats {
    padding: 12px;
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--color-border);
    border-radius: 2px;
  }

  /* Stat row */
  .driver-stat-row {
    /* just a named hook for the component */
  }
`;
