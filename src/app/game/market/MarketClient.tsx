"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type {
  MarketPageData,
  MarketMaterialSlot,
  MarketPartListing,
  MarketCarListing,
  GachaDriverTemplate,
  GachaEngineerTemplate,
} from "./page";

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = ["MATERIALS", "PARTS", "CARS", "RECRUIT"] as const;
type Tab = typeof TABS[number];

const MAT_RARITY_COLOR: Record<string, string> = {
  common:    "#aaaaaa",
  uncommon:  "#4ade80",
  rare:      "#60a5fa",
  epic:      "#c084fc",
  legendary: "#c9a84c",
  mythical:  "#f97316",
  event:     "#e8001c",
};

const RARITY_CONFIG: Record<string, { label: string; accent: string; border: string; glow: string; shimmer: boolean }> = {
  common:    { label: "COMMON",    accent: "#aaaaaa", border: "rgba(255,255,255,0.1)",  glow: "rgba(180,180,180,0.06)",  shimmer: false },
  uncommon:  { label: "UNCOMMON",  accent: "#4ade80", border: "rgba(74,222,128,0.25)",  glow: "rgba(74,222,128,0.08)",   shimmer: false },
  rare:      { label: "RARE",      accent: "#60a5fa", border: "rgba(59,130,246,0.3)",   glow: "rgba(59,130,246,0.12)",   shimmer: false },
  epic:      { label: "EPIC",      accent: "#c084fc", border: "rgba(168,85,247,0.35)",  glow: "rgba(168,85,247,0.14)",   shimmer: false },
  legendary: { label: "LEGENDARY", accent: "#c9a84c", border: "rgba(201,168,76,0.45)",  glow: "rgba(201,168,76,0.18)",   shimmer: true  },
  mythical:  { label: "MYTHICAL",  accent: "#f97316", border: "rgba(249,115,22,0.45)",  glow: "rgba(249,115,22,0.18)",   shimmer: true  },
  event:     { label: "EVENT",     accent: "#e8001c", border: "rgba(232,0,28,0.45)",    glow: "rgba(232,0,28,0.18)",     shimmer: true  },
};

const CATEGORY_ICONS: Record<string, string> = {
  engine:       "M9 3H7a2 2 0 00-2 2v1H3a1 1 0 000 2h2v1a2 2 0 002 2h2m0-8v8m0-8h6m0 0h2a2 2 0 012 2v1h2a1 1 0 010 2h-2v1a2 2 0 01-2 2h-2m0-8v8M9 11h6",
  chassis:      "M4 6h16M4 10h16M4 14h16M4 18h16",
  suspension:   "M12 3v3m0 12v3M3 12h3m12 0h3M6.34 6.34l2.12 2.12m7.08 7.08l2.12 2.12M6.34 17.66l2.12-2.12m7.08-7.08l2.12-2.12",
  aerodynamics: "M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9M3 12h18",
  tires:        "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4a6 6 0 100 12A6 6 0 0012 6z",
  brakes:       "M8 6h8v12H8zM4 8h4v8H4zm12 0h4v8h-4z",
  electronics:  "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCr(n: number): string {
  return n.toLocaleString();
}

function fmtDuration(s: number): string {
  if (s <= 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const show = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function Toast({ toast }: { toast: { msg: string; type: "ok" | "err" } | null }) {
  if (!toast) return null;
  return (
    <div
      className="mkt-toast"
      style={{
        background: toast.type === "ok" ? "rgba(74,222,128,0.12)" : "rgba(232,0,28,0.12)",
        borderColor: toast.type === "ok" ? "rgba(74,222,128,0.35)" : "rgba(232,0,28,0.35)",
        color: toast.type === "ok" ? "#4ade80" : "#e8001c",
      }}
    >
      {toast.msg}
    </div>
  );
}

// ─── Countdown ───────────────────────────────────────────────────────────────

function RefreshCountdown({ refreshAt, onZero }: { refreshAt: number; onZero?: () => void }) {
  const [rem, setRem] = useState(() => Math.max(0, refreshAt - Math.floor(Date.now() / 1000)));
  const cbRef = useRef(onZero);
  cbRef.current = onZero;

  useEffect(() => {
    if (rem <= 0) { cbRef.current?.(); return; }
    const id = setInterval(() => {
      const r = Math.max(0, refreshAt - Math.floor(Date.now() / 1000));
      setRem(r);
      if (r <= 0) cbRef.current?.();
    }, 1000);
    return () => clearInterval(id);
  }, [refreshAt, rem]);

  if (rem <= 0) return <span className="mkt-refresh-badge mkt-refresh-active">REFRESHING…</span>;
  return (
    <div className="mkt-refresh-row">
      <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0115.5-2M20 15a8 8 0 01-15.5 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Refreshes in</span>
      <span className="mkt-refresh-time">{fmtDuration(rem)}</span>
    </div>
  );
}

// ─── Category Icon ───────────────────────────────────────────────────────────

function CatIcon({ cat, size = 12, color = "currentColor" }: { cat: string; size?: number; color?: string }) {
  const d = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.engine;
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0 }} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ─── TAB 1: MATERIALS ────────────────────────────────────────────────────────

function MaterialSlotCard({
  slot,
  credits,
  onBuy,
}: {
  slot: MarketMaterialSlot;
  credits: number;
  onBuy: (slotIndex: number, qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const rarityKey = (slot as { rarity?: string }).rarity ?? "common";
  const col = MAT_RARITY_COLOR[rarityKey] ?? "#888";
  const totalCost = slot.price_per_unit * qty;
  const canAfford = credits >= totalCost;
  const isEmpty = slot.quantity === 0;

  const handleBuy = async () => {
    setLoading(true);
    await onBuy(slot.slot_index, qty);
    setLoading(false);
    setQty(1);
  };

  const artSrc = slot.art
    ? `/assets/materials/${slot.art}.png`
    : `/assets/materials/placeholder-1x1.png`;

  const maxQty = Math.min(slot.quantity, 99);

  return (
    <div
      className="mkt-mat-card"
      style={{ "--mat-accent": col, borderColor: col + "30" } as React.CSSProperties}
    >
      {/* Art hero — top square area */}
      <div className="mkt-mat-art-hero" style={{ background: `radial-gradient(circle at 60% 40%, ${col}18, ${col}05 65%, transparent)` }}>
        <div className="mkt-mat-art-glow" style={{ background: col + "18", boxShadow: `0 0 40px ${col}30` }} />
        <Image
          src={artSrc}
          alt={slot.name}
          width={80}
          height={80}
          className="mkt-mat-art-img"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/materials/placeholder-1x1.png"; }}
          unoptimized
        />
        {/* Rarity accent corner */}
        <div className="mkt-mat-rarity-corner" style={{ background: col }} />
        {/* Stock badge on image */}
        <div className="mkt-mat-stock-badge" style={{ color: isEmpty ? "#555" : col, borderColor: isEmpty ? "rgba(255,255,255,0.06)" : col + "40", background: isEmpty ? "rgba(0,0,0,0.7)" : col + "14" }}>
          {isEmpty ? "SOLD OUT" : `×${slot.quantity.toLocaleString()} avail.`}
        </div>
      </div>

      {/* Bottom content area */}
      <div className="mkt-mat-content">
        {/* Name */}
        <p className="mkt-mat-name">{slot.name}</p>

        {/* Price row */}
        <div className="mkt-mat-price-row">
          <span className="mkt-mat-price" style={{ color: isEmpty ? "#444" : "white" }}>
            {fmtCr(slot.price_per_unit)}<span className="mkt-mat-price-unit"> CR</span>
          </span>
          <span className="mkt-mat-per-unit">/ unit</span>
        </div>

        {/* Stepper + buy */}
        <div className="mkt-mat-controls">
          <div className="mkt-stepper">
            <button className="mkt-stepper-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || isEmpty}>
              <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10" /></svg>
            </button>
            <span className="mkt-stepper-val">{qty}</span>
            <button className="mkt-stepper-btn" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty || isEmpty}>
              <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>
            </button>
          </div>
          <button
            className="mkt-buy-btn"
            style={{
              background: (!canAfford || isEmpty || loading) ? "transparent" : col + "1a",
              borderColor: (!canAfford || isEmpty || loading) ? "rgba(255,255,255,0.07)" : col + "60",
              color: (!canAfford || isEmpty || loading) ? "#444" : col,
            }}
            onClick={handleBuy}
            disabled={!canAfford || isEmpty || loading}
          >
            {loading ? "…" : isEmpty ? "SOLD" : !canAfford ? "NO CR" : `BUY · ${fmtCr(totalCost)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialsTab({
  slots,
  credits,
  matNextRefresh,
  onBuy,
  onRefresh,
}: {
  slots: MarketMaterialSlot[];
  credits: number;
  matNextRefresh: number;
  onBuy: (slotIndex: number, qty: number) => Promise<void>;
  onRefresh: () => void;
}) {
  return (
    <div className="mkt-tab-content">
      <div className="mkt-section-header">
        <div>
          <p className="mkt-section-tag">Raw Resources</p>
          <h2 className="mkt-section-title">MATERIALS MARKET</h2>
        </div>
        <RefreshCountdown refreshAt={matNextRefresh} onZero={onRefresh} />
      </div>
      <div className="mkt-mat-grid">
        {slots.map((slot) => (
          <MaterialSlotCard key={slot.slot_index} slot={slot} credits={credits} onBuy={onBuy} />
        ))}
      </div>
    </div>
  );
}

// ─── TAB 2: PARTS ────────────────────────────────────────────────────────────

function PartCard({
  listing,
  credits,
  onBuy,
}: {
  listing: MarketPartListing;
  credits: number;
  onBuy: (listingId: number) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const canAfford = credits >= listing.price;
  const isEmpty = listing.quantity === 0;
  const deal = listing.price < listing.sell_price;

  const handleBuy = async () => {
    setLoading(true);
    await onBuy(listing.id);
    setLoading(false);
  };

  const rarityKey = (listing as { rarity?: string }).rarity ?? "common";
  const cfg = RARITY_CONFIG[rarityKey] ?? RARITY_CONFIG["common"];
  const partArtSrc = listing.art
    ? `/assets/parts/${listing.art}.png`
    : `/assets/parts/placeholder-1x1.png`;

  const CATEGORY_STATS: Record<string, [{ label: string; v: number }, { label: string; v: number }]> = {
    engine:      [{ label: "SPEED",      v: listing.stat_speed },       { label: "ACCELERATION", v: listing.stat_acceleration }],
    suspension:  [{ label: "HANDLING",   v: listing.stat_handling },    { label: "STABILITY",    v: listing.stat_stability }],
    chassis:     [{ label: "DURABILITY", v: listing.stat_durability },  { label: "WEIGHT",       v: listing.stat_weight }],
    brakes:      [{ label: "BRAKING",    v: listing.stat_braking },     { label: "CONTROL",      v: listing.stat_control }],
    gearbox:     [{ label: "SHIFT SPD",  v: listing.stat_shift_speed }, { label: "EFFICIENCY",   v: listing.stat_efficiency }],
    tires:       [{ label: "GRIP",       v: listing.stat_grip },        { label: "CORNERING",    v: listing.stat_cornering }],
  };
  const catStats = CATEGORY_STATS[listing.category] ?? [
    { label: "SPEED", v: listing.stat_speed },
    { label: "ACCELERATION", v: listing.stat_acceleration },
  ];

  return (
    <div
      className="mkt-part-card"
      style={{ animationDelay: `${listing.id * 30}ms`, borderColor: cfg.border, "--part-accent": cfg.accent } as React.CSSProperties}
    >
      {/* Full-card background image */}
      <Image
        src={partArtSrc}
        alt={listing.name}
        fill
        className="mkt-part-bg-img"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/parts/placeholder-1x1.png"; }}
        unoptimized
      />

      {/* Scrim — gradient so text is readable */}
      <div className="mkt-part-scrim" style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 40%, rgba(8,8,8,0.92) 72%, #080808 100%)` }} />

      {/* Rarity accent glow */}
      <div className="mkt-part-rarity-glow" style={{ background: `radial-gradient(ellipse at 50% 100%, ${cfg.accent}22, transparent 65%)` }} />

      {/* Accent top line */}
      <div className="mkt-part-accent-line" style={{ background: `linear-gradient(90deg, ${cfg.accent}cc, ${cfg.accent}33, transparent)` }} />

      {/* Content overlay */}
      <div className="mkt-part-overlay">
        {/* Top row: category + rarity */}
        <div className="mkt-part-hero-top">
          <div className="mkt-part-cat-row">
            <CatIcon cat={listing.category} size={9} color={cfg.accent} />
            <span className="mkt-part-cat" style={{ color: cfg.accent }}>{listing.category.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="mkt-part-rarity-badge" style={{ color: cfg.accent, borderColor: cfg.accent + "55", background: "rgba(0,0,0,0.6)" }}>
              {cfg.label}
            </span>
            {listing.quantity <= 1 && !isEmpty && (
              <span className="mkt-part-last-badge">LAST</span>
            )}
          </div>
        </div>

        {/* Spacer pushes content to bottom */}
        <div style={{ flex: 1 }} />

        {/* Bottom content */}
        <div className="mkt-part-body">
          <p className="mkt-part-name">{listing.name}</p>
          <span className="mkt-part-qty-label">
            {isEmpty ? "Out of stock" : `×${listing.quantity} in stock`}
          </span>

          <div className="mkt-part-stats">
            {catStats.map((s) => (
              <div key={s.label} className="mkt-part-stat">
                <span className="mkt-part-stat-v" style={{ color: cfg.accent }}>{s.v}</span>
                <span className="mkt-part-stat-k">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="mkt-part-footer">
            <div className="mkt-part-price-block">
              <span className="mkt-part-price">{fmtCr(listing.price)}</span>
              <span className="mkt-part-price-cr"> CR</span>
              {deal && <span className="mkt-part-deal">DEAL</span>}
            </div>
            <button
              className="mkt-part-buy-btn"
              onClick={handleBuy}
              disabled={!canAfford || isEmpty || loading}
              style={{
                background: (!canAfford || isEmpty) ? "rgba(0,0,0,0.5)" : `${cfg.accent}28`,
                borderColor: (!canAfford || isEmpty) ? "rgba(255,255,255,0.1)" : `${cfg.accent}77`,
                color: (!canAfford || isEmpty) ? "#555" : cfg.accent,
              }}
            >
              {loading ? "…" : isEmpty ? "SOLD" : !canAfford ? "NO CR" : "BUY"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PartsTab({
  listings,
  credits,
  partNextRefresh,
  onBuy,
  onRefresh,
}: {
  listings: MarketPartListing[];
  credits: number;
  partNextRefresh: number;
  onBuy: (listingId: number) => Promise<void>;
  onRefresh: () => void;
}) {
  return (
    <div className="mkt-tab-content">
      <div className="mkt-section-header">
        <div>
          <p className="mkt-section-tag">Available Components</p>
          <h2 className="mkt-section-title">PARTS MARKET</h2>
        </div>
        <RefreshCountdown refreshAt={partNextRefresh} onZero={onRefresh} />
      </div>
      {listings.length === 0 ? (
        <div className="mkt-empty">
          <svg viewBox="0 0 64 64" className="w-12 h-12 mb-4" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: "#333" }}>
            <rect x="8" y="16" width="48" height="36" rx="2" /><path d="M16 16V10h32v6M32 28v8M24 32h16" />
          </svg>
          <p className="mkt-empty-title">NO PARTS AVAILABLE</p>
          <p className="mkt-empty-sub">Check back after the next refresh.</p>
        </div>
      ) : (
        <div className="mkt-parts-grid">
          {listings.map((l) => (
            <PartCard key={l.id} listing={l} credits={credits} onBuy={onBuy} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TAB 3: CARS ─────────────────────────────────────────────────────────────

function CarListingCard({
  listing,
  credits,
  onBuyClick,
}: {
  listing: MarketCarListing;
  credits: number;
  onBuyClick: (listing: MarketCarListing) => void;
}) {
  const canAfford = credits >= listing.price;
  const winRate = listing.total_races > 0 ? Math.round((listing.total_wins / listing.total_races) * 100) : 0;

  return (
    <div className="mkt-car-card" style={{ animationDelay: `${listing.listing_id * 40}ms` }}>
      {/* Color swatch header */}
      <div className="mkt-car-swatch" style={{ background: `linear-gradient(135deg, ${listing.color}33, ${listing.color}11)`, borderBottom: `1px solid ${listing.color}22` }}>
        <div className="flex items-center gap-2">
          <div className="mkt-car-color-dot" style={{ background: listing.color, boxShadow: `0 0 8px ${listing.color}66` }} />
          <span className="mkt-car-model-code">{listing.model_code}</span>
        </div>
        <span className="mkt-car-tier-badge">{listing.archetype.replace("_", " ").toUpperCase()}</span>
      </div>

      <div className="mkt-car-body">
        <p className="mkt-car-name">{listing.car_name}</p>
        <p className="mkt-car-template">{listing.template_name}</p>

        {/* Stats row */}
        <div className="mkt-car-stats">
          {[
            { k: "SPD", v: listing.stat_speed },
            { k: "HDL", v: listing.stat_handling },
            { k: "DUR", v: listing.stat_durability },
            { k: "ACC", v: listing.stat_acceleration },
          ].map((s) => (
            <div key={s.k} className="mkt-car-stat">
              <span className="mkt-car-stat-k">{s.k}</span>
              <span className="mkt-car-stat-v">{s.v}</span>
            </div>
          ))}
        </div>

        {/* Race record */}
        <div className="mkt-car-record">
          <span className="mkt-car-record-val">{listing.total_races}</span>
          <span className="mkt-car-record-lbl">RACES</span>
          <span className="mkt-car-sep" />
          <span className="mkt-car-record-val" style={{ color: listing.total_wins > 0 ? "#c9a84c" : undefined }}>{listing.total_wins}</span>
          <span className="mkt-car-record-lbl">WINS</span>
          <span className="mkt-car-sep" />
          <span className="mkt-car-record-val">{winRate}%</span>
          <span className="mkt-car-record-lbl">RATE</span>
        </div>

        {/* Seller */}
        <div className="mkt-car-seller">
          <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span>{listing.seller_brand} · @{listing.seller_name}</span>
        </div>
      </div>

      <div className="mkt-car-footer">
        <div>
          <span className="mkt-car-price">{fmtCr(listing.price)}</span>
          <span className="mkt-car-price-cr"> CR</span>
        </div>
        <button
          className="mkt-car-buy-btn"
          onClick={() => onBuyClick(listing)}
          disabled={!canAfford}
          style={{ opacity: canAfford ? 1 : 0.4 }}
        >
          {canAfford ? "BUY" : "NEED CR"}
        </button>
      </div>
    </div>
  );
}

function CarConfirmModal({
  listing,
  credits,
  onConfirm,
  onClose,
  loading,
}: {
  listing: MarketCarListing;
  credits: number;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const winRate = listing.total_races > 0 ? Math.round((listing.total_wins / listing.total_races) * 100) : 0;

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="mkt-modal-backdrop"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.2s" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mkt-confirm-sheet" style={{ transform: visible ? "translateY(0)" : "translateY(32px)", transition: "transform 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
        <div className="mkt-confirm-header">
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Confirm Purchase</p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.06em", color: "white" }}>{listing.car_name.toUpperCase()}</h3>
          </div>
          <button className="mkt-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>

        <div className="mkt-confirm-body">
          <div className="mkt-car-stats" style={{ marginBottom: 12 }}>
            {[{ k: "SPD", v: listing.stat_speed }, { k: "HDL", v: listing.stat_handling }, { k: "DUR", v: listing.stat_durability }, { k: "ACC", v: listing.stat_acceleration }].map((s) => (
              <div key={s.k} className="mkt-car-stat" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="mkt-car-stat-k">{s.k}</span>
                <span className="mkt-car-stat-v">{s.v}</span>
              </div>
            ))}
          </div>
          <div className="mkt-car-record" style={{ marginBottom: 12 }}>
            <span className="mkt-car-record-val">{listing.total_races}</span><span className="mkt-car-record-lbl">RACES</span>
            <span className="mkt-car-sep" />
            <span className="mkt-car-record-val">{listing.total_wins}</span><span className="mkt-car-record-lbl">WINS</span>
            <span className="mkt-car-sep" />
            <span className="mkt-car-record-val">{winRate}%</span><span className="mkt-car-record-lbl">WIN RATE</span>
          </div>
          <div className="mkt-car-seller" style={{ marginBottom: 16 }}>
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span>Seller: {listing.seller_brand} · @{listing.seller_name}</span>
          </div>
        </div>

        <div style={{ height: "1px", background: "var(--color-border)", margin: "0 16px" }} />

        <div className="mkt-confirm-footer">
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)", letterSpacing: "0.1em" }}>PURCHASE PRICE</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.06em", color: "white" }}>
              {fmtCr(listing.price)} <span style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>CR</span>
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: credits - listing.price < 0 ? "#e8001c" : "#4ade80" }}>
              Balance after: {fmtCr(credits - listing.price)} CR
            </p>
          </div>
          <div className="flex gap-2">
            <button className="mkt-confirm-cancel-btn" onClick={onClose}>CANCEL</button>
            <button className="mkt-confirm-ok-btn" onClick={onConfirm} disabled={loading}>
              {loading ? "BUYING…" : "CONFIRM"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarsTab({
  listings,
  credits,
  onBuy,
}: {
  listings: MarketCarListing[];
  credits: number;
  onBuy: (listingId: number) => Promise<void>;
}) {
  const [confirmListing, setConfirmListing] = useState<MarketCarListing | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!confirmListing) return;
    setLoading(true);
    await onBuy(confirmListing.listing_id);
    setLoading(false);
    setConfirmListing(null);
  };

  return (
    <div className="mkt-tab-content">
      <div className="mkt-section-header">
        <div>
          <p className="mkt-section-tag">Player Listings</p>
          <h2 className="mkt-section-title">CARS MARKET</h2>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>{listings.length} LISTED</span>
      </div>

      {listings.length === 0 ? (
        <div className="mkt-empty">
          <svg viewBox="0 0 64 64" className="w-12 h-12 mb-4" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: "#333" }}>
            <path d="M8 44l6-18h36l6 18H8z" /><circle cx="20" cy="50" r="4" /><circle cx="44" cy="50" r="4" /><path d="M14 36h36" />
          </svg>
          <p className="mkt-empty-title">NO CARS LISTED</p>
          <p className="mkt-empty-sub">Check back later or list your own from the Garage.</p>
        </div>
      ) : (
        <div className="mkt-cars-grid">
          {listings.map((l) => (
            <CarListingCard key={l.listing_id} listing={l} credits={credits} onBuyClick={setConfirmListing} />
          ))}
        </div>
      )}

      {confirmListing && (
        <CarConfirmModal
          listing={confirmListing}
          credits={credits}
          onConfirm={handleConfirm}
          onClose={() => setConfirmListing(null)}
          loading={loading}
        />
      )}
    </div>
  );
}

// ─── TAB 4: RECRUIT (GACHA) ───────────────────────────────────────────────────

type GachaResult = {
  template_id: number;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  is_new: boolean;
};

function GachaCard({
  result,
  index,
  isFlipped,
  isSelected,
  onClick,
}: {
  result: GachaResult | null; // null = face-down
  index: number;
  isFlipped: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = result ? RARITY_CONFIG[result.rarity] : null;
  const isLegendary = result?.rarity === "legendary";
  const isEpic = result?.rarity === "epic";

  return (
    <div
      className="gacha-card-wrap"
      onClick={onClick}
      style={{ cursor: isFlipped ? "default" : "pointer" }}
    >
      <div
        className="gacha-card-inner"
        style={{
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: `transform 0.55s cubic-bezier(0.16,1,0.3,1) ${isFlipped ? index * 60 : 0}ms`,
        }}
      >
        {/* Back face */}
        <div className="gacha-card-face gacha-card-back">
          <div className="gacha-card-back-texture" />
          <div className="gacha-card-back-q">?</div>
          <div className="gacha-card-back-pulse" />
        </div>

        {/* Front face */}
        <div
          className="gacha-card-face gacha-card-front"
          style={{
            borderColor: cfg?.border ?? "rgba(255,255,255,0.1)",
            boxShadow: isSelected
              ? `0 0 24px ${cfg?.accent ?? "#fff"}66, 0 0 0 2px ${cfg?.accent ?? "#fff"}44`
              : isEpic || isLegendary
              ? `0 0 16px ${cfg?.accent ?? "#fff"}44`
              : "none",
          }}
        >
          {isLegendary && <div className="gacha-legendary-shimmer" />}
          {/* Portrait area */}
          <div className="gacha-card-portrait">
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 80%, ${cfg?.glow ?? "rgba(0,0,0,0)"} 0%, transparent 70%)` }} />
            <Image
              src="/assets/drivers/placeholder-3x4.svg"
              alt={result?.name ?? ""}
              fill
              className="object-cover object-top"
              style={{ opacity: 0.3 }}
              sizes="80px"
            />
          </div>
          {/* Bottom info */}
          <div className="gacha-card-info">
            <div
              className="gacha-card-rarity-pip"
              style={{ background: cfg?.accent ?? "#aaa", boxShadow: `0 0 4px ${cfg?.accent ?? "#aaa"}88` }}
            />
            <p className="gacha-card-name">{result?.name?.split(" ")[0] ?? ""}</p>
          </div>
          {result?.is_new && (
            <div className="gacha-card-new-badge">NEW</div>
          )}
          {isSelected && (
            <div className="gacha-card-selected-ring" style={{ borderColor: cfg?.accent ?? "#fff" }} />
          )}
        </div>
      </div>
    </div>
  );
}

function GachaRevealModal({
  banner,
  results,
  onRecruit,
  onSkip,
}: {
  banner: "driver" | "engineer";
  results: GachaResult[];
  onRecruit: (templateId: number) => Promise<void>;
  onSkip: () => void;
}) {
  const [flipped, setFlipped] = useState<boolean[]>(new Array(10).fill(false));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [allRevealed, setAllRevealed] = useState(false);
  const [recruiting, setRecruiting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }, []);

  const handleCardClick = (idx: number) => {
    if (flipped[idx]) return;

    // Flip chosen card
    const newFlipped = [...flipped];
    newFlipped[idx] = true;
    setFlipped(newFlipped);
    setSelectedIdx(idx);

    // After short delay, flip all remaining cards with stagger
    setTimeout(() => {
      const finalFlipped = new Array(10).fill(true);
      setFlipped(finalFlipped);
      setTimeout(() => setAllRevealed(true), 10 * 60 + 600);
    }, 600);
  };

  const selectedResult = selectedIdx !== null ? results[selectedIdx] : null;
  const cfg = selectedResult ? RARITY_CONFIG[selectedResult.rarity] : null;

  const handleRecruit = async () => {
    if (!selectedResult) return;
    setRecruiting(true);
    await onRecruit(selectedResult.template_id);
    setRecruiting(false);
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onSkip, 260);
  };

  return (
    <div
      className="gacha-reveal-backdrop"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }}
    >
      <div
        className="gacha-reveal-sheet"
        style={{ transform: visible ? "translateY(0)" : "translateY(50px)", transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Header */}
        <div className="gacha-reveal-header">
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {banner.toUpperCase()} BANNER PULL
            </p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "20px", letterSpacing: "0.08em", color: "white" }}>
              {selectedIdx === null ? "SELECT A CARD" : "YOU SELECTED"}
            </h3>
          </div>
          <button className="mkt-modal-close" onClick={handleClose} aria-label="Close">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>

        {/* Card grid */}
        <div className="gacha-grid">
          {results.map((r, i) => (
            <GachaCard
              key={i}
              result={r}
              index={i}
              isFlipped={flipped[i]}
              isSelected={selectedIdx === i}
              onClick={() => handleCardClick(i)}
            />
          ))}
        </div>

        {/* Selected result panel */}
        {selectedResult && allRevealed && (
          <div
            className="gacha-result-panel"
            style={{
              borderColor: cfg?.border ?? "rgba(255,255,255,0.1)",
              background: `linear-gradient(135deg, ${cfg?.glow ?? "rgba(0,0,0,0)"}, transparent)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="gacha-result-rarity"
                    style={{ color: cfg?.accent, borderColor: cfg?.accent + "44", background: cfg?.accent + "14" }}
                  >
                    {cfg?.label}
                  </span>
                  {selectedResult.is_new && (
                    <span className="gacha-result-new">NEW RECRUIT</span>
                  )}
                </div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "0.06em", color: "white" }}>
                  {selectedResult.name.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="mkt-confirm-cancel-btn" onClick={handleClose}>SKIP</button>
              {selectedResult.is_new ? (
                <button
                  className="gacha-recruit-btn"
                  style={{ background: cfg?.accent + "22", borderColor: cfg?.accent + "66", color: cfg?.accent }}
                  onClick={handleRecruit}
                  disabled={recruiting}
                >
                  {recruiting ? "RECRUITING…" : "RECRUIT"}
                </button>
              ) : (
                <button className="gacha-recruit-btn gacha-recruit-owned" disabled>
                  ALREADY OWNED
                </button>
              )}
            </div>
          </div>
        )}

        {selectedIdx === null && (
          <p className="gacha-hint">Tap any card to reveal your selection</p>
        )}
      </div>
    </div>
  );
}

function BannerCard({
  banner,
  pity,
  xgear,
  onRoll,
  loading,
}: {
  banner: "driver" | "engineer";
  pity: number;
  xgear: number;
  onRoll: () => void;
  loading: boolean;
}) {
  const canRoll = xgear >= 100;
  const isDriver = banner === "driver";
  const pityPct = (pity / 20) * 100;

  const patternColor = isDriver ? "#e8001c" : "#c9a84c";
  const bgGrad = isDriver
    ? "radial-gradient(ellipse at 30% 50%, rgba(232,0,28,0.12) 0%, transparent 60%), linear-gradient(135deg, #0a0a0a 0%, #111 100%)"
    : "radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.1) 0%, transparent 60%), linear-gradient(135deg, #0a0a0a 0%, #111 100%)";

  return (
    <div className="gacha-banner-card" style={{ background: bgGrad }}>
      {/* Decorative grid overlay */}
      <div className="gacha-banner-grid" style={{ borderColor: patternColor + "08" }} />

      {/* Diagonal accent line */}
      <div className="gacha-banner-diag" style={{ background: `linear-gradient(90deg, transparent, ${patternColor}18, transparent)` }} />

      <div className="gacha-banner-body">
        {/* Left: art placeholder */}
        <div className="gacha-banner-art" style={{ borderColor: patternColor + "22" }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 60%, ${patternColor}18, transparent 70%)` }} />
          <div className="gacha-banner-art-icon">
            {isDriver ? (
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: patternColor + "66" }}>
                <circle cx="32" cy="22" r="12" /><path d="M10 56 Q10 40 32 40 Q54 40 54 56" /><path d="M22 36l-4 8M42 36l4 8" />
              </svg>
            ) : (
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: patternColor + "66" }}>
                <rect x="16" y="8" width="32" height="12" rx="2" /><path d="M20 20v28M44 20v28M12 32h40M24 48h16" /><circle cx="20" cy="52" r="4" /><circle cx="44" cy="52" r="4" />
              </svg>
            )}
          </div>
        </div>

        {/* Right: info */}
        <div className="gacha-banner-info">
          <div className="mb-3">
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: patternColor + "aa", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {isDriver ? "Racing Division" : "Workshop Division"}
            </p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 4vw, 28px)", letterSpacing: "0.06em", color: "white", lineHeight: 1 }}>
              {isDriver ? "DRIVER" : "ENGINEER"} BANNER
            </h3>
          </div>

          {/* Odds */}
          <div className="gacha-banner-odds">
            {[
              { label: "Common", pct: "60%", color: "#aaaaaa" },
              { label: "Rare",   pct: "30%", color: "#60a5fa" },
              { label: "Epic+",  pct: "10%", color: "#c084fc" },
            ].map((o) => (
              <div key={o.label} className="gacha-odd-row">
                <span className="gacha-odd-dot" style={{ background: o.color }} />
                <span className="gacha-odd-label">{o.label}</span>
                <span className="gacha-odd-pct" style={{ color: o.color }}>{o.pct}</span>
              </div>
            ))}
          </div>

          {/* Pity bar */}
          <div className="gacha-pity-row">
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)", letterSpacing: "0.1em" }}>PITY</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: pity >= 15 ? "#c084fc" : "var(--color-text-muted)" }}>{pity}/20</span>
            </div>
            <div className="gacha-pity-track">
              <div
                className="gacha-pity-fill"
                style={{
                  width: `${pityPct}%`,
                  background: pity >= 15 ? "linear-gradient(90deg, #60a5fa88, #c084fc)" : `linear-gradient(90deg, ${patternColor}88, ${patternColor})`,
                }}
              />
            </div>
          </div>

          {/* Roll button */}
          <button
            className="gacha-roll-btn"
            onClick={onRoll}
            disabled={!canRoll || loading}
            style={{
              background: canRoll && !loading ? `linear-gradient(135deg, ${patternColor}22, ${patternColor}0a)` : "transparent",
              borderColor: canRoll && !loading ? patternColor + "66" : "rgba(255,255,255,0.1)",
              color: canRoll && !loading ? patternColor : "#555",
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {loading ? "ROLLING…" : canRoll ? "ROLL · 100 XG" : "NEED 100 XG"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecruitTab({
  driverTemplates,
  engineerTemplates,
  xgear,
  pity,
  onRoll,
}: {
  driverTemplates: GachaDriverTemplate[];
  engineerTemplates: GachaEngineerTemplate[];
  xgear: number;
  pity: { driver: number; engineer: number };
  onRoll: (banner: "driver" | "engineer") => Promise<GachaResult[] | null>;
}) {
  const [rolling, setRolling] = useState<"driver" | "engineer" | null>(null);
  const [revealData, setRevealData] = useState<{ banner: "driver" | "engineer"; results: GachaResult[] } | null>(null);
  const router = useRouter();
  const { toast, show } = useToast();

  const handleRoll = async (banner: "driver" | "engineer") => {
    setRolling(banner);
    const results = await onRoll(banner);
    setRolling(null);
    if (results) setRevealData({ banner, results });
  };

  const handleRecruit = async (templateId: number) => {
    if (!revealData) return;
    try {
      const res = await fetch("/api/market/gacha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner: revealData.banner, template_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        show(data.error ?? "Recruitment failed", "err");
        return;
      }
      show(`${data.recruited} recruited!`, "ok");
      setRevealData(null);
      router.refresh();
    } catch {
      show("Network error", "err");
    }
  };

  const handleSkip = () => {
    setRevealData(null);
    router.refresh();
  };

  return (
    <div className="mkt-tab-content">
      <Toast toast={toast} />
      <div className="mkt-section-header">
        <div>
          <p className="mkt-section-tag">Premium Recruitment</p>
          <h2 className="mkt-section-title">RECRUIT</h2>
        </div>
        <div className="gacha-xgear-display">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#c9a84c" strokeWidth="1.5">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#c9a84c44" />
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "20px", letterSpacing: "0.06em", color: "#c9a84c" }}>{xgear.toLocaleString()}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#c9a84c88", letterSpacing: "0.08em" }}>XGEAR</span>
        </div>
      </div>

      <div className="gacha-banners-grid">
        <BannerCard banner="driver" pity={pity.driver} xgear={xgear} onRoll={() => handleRoll("driver")} loading={rolling === "driver"} />
        <BannerCard banner="engineer" pity={pity.engineer} xgear={xgear} onRoll={() => handleRoll("engineer")} loading={rolling === "engineer"} />
      </div>

      {/* Pool preview */}
      <div className="gacha-pool-preview">
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-subtle)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Driver Pool</p>
        <div className="gacha-pool-grid">
          {driverTemplates.map((t) => {
            const cfg = RARITY_CONFIG[t.rarity];
            return (
              <div key={t.id} className="gacha-pool-chip" style={{ borderColor: cfg.accent + "33" }}>
                <span className="gacha-pool-dot" style={{ background: cfg.accent }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)" }}>{t.name.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-subtle)", letterSpacing: "0.14em", textTransform: "uppercase", margin: "12px 0" }}>Engineer Pool</p>
        <div className="gacha-pool-grid">
          {engineerTemplates.map((t) => {
            const cfg = RARITY_CONFIG[t.rarity];
            return (
              <div key={t.id} className="gacha-pool-chip" style={{ borderColor: cfg.accent + "33" }}>
                <span className="gacha-pool-dot" style={{ background: cfg.accent }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)" }}>{t.name.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {revealData && (
        <GachaRevealModal
          banner={revealData.banner}
          results={revealData.results}
          onRecruit={handleRecruit}
          onSkip={handleSkip}
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketClient({ data }: { data: MarketPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("MATERIALS");
  const { toast, show } = useToast();

  const handleMatBuy = async (slotIndex: number, qty: number) => {
    try {
      const res = await fetch("/api/market/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_index: slotIndex, quantity: qty }),
      });
      const json = await res.json();
      if (!res.ok) { show(json.error ?? "Purchase failed", "err"); return; }
      show(`Purchased! Cost: ${fmtCr(json.cost)} CR`, "ok");
      router.refresh();
    } catch { show("Network error", "err"); }
  };

  const handlePartBuy = async (listingId: number) => {
    try {
      const res = await fetch("/api/market/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, quantity: 1 }),
      });
      const json = await res.json();
      if (!res.ok) { show(json.error ?? "Purchase failed", "err"); return; }
      show(`Part purchased! Cost: ${fmtCr(json.cost)} CR`, "ok");
      router.refresh();
    } catch { show("Network error", "err"); }
  };

  const handleCarBuy = async (listingId: number) => {
    try {
      const res = await fetch("/api/market/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const json = await res.json();
      if (!res.ok) { show(json.error ?? "Purchase failed", "err"); return; }
      show(`Car acquired! Cost: ${fmtCr(json.cost)} CR`, "ok");
      router.refresh();
    } catch { show("Network error", "err"); }
  };

  const handleGachaRoll = async (banner: "driver" | "engineer"): Promise<GachaResult[] | null> => {
    try {
      const res = await fetch("/api/market/gacha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner }),
      });
      const json = await res.json();
      if (!res.ok) { show(json.error ?? "Roll failed", "err"); return null; }
      router.refresh();
      return json.results as GachaResult[];
    } catch { show("Network error", "err"); return null; }
  };

  return (
    <>
      <style>{MARKET_STYLES}</style>
      <div className="md:ml-16 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6">

          {/* Page header */}
          <div className="mb-5 animate-fade-up">
            <p className="section-tag mb-1">Blackridge Exchange</p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 6vw, 48px)", letterSpacing: "0.04em", color: "white", lineHeight: 1 }}>
                MARKET
              </h1>
              <div className="flex items-center gap-4">
                <div className="mkt-balance-chip">
                  <span className="mkt-balance-val">{fmtCr(data.credits)}</span>
                  <span className="mkt-balance-label">CR</span>
                </div>
                <div className="mkt-balance-chip" style={{ borderColor: "rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.04)" }}>
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#c9a84c" strokeWidth="1.5">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#c9a84c33" />
                  </svg>
                  <span className="mkt-balance-val" style={{ color: "#c9a84c" }}>{data.xgear.toLocaleString()}</span>
                  <span className="mkt-balance-label" style={{ color: "#c9a84c88" }}>XG</span>
                </div>
              </div>
            </div>
            <span className="accent-line mt-3" />
          </div>

          {/* Tab bar */}
          <div className="mkt-tab-bar animate-fade-up animate-delay-100">
            {TABS.map((t) => (
              <button
                key={t}
                className={`mkt-tab-btn ${tab === t ? "mkt-tab-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Toast */}
          <Toast toast={toast} />

          {/* Tab content */}
          <div className="animate-fade-up animate-delay-200">
            {tab === "MATERIALS" && (
              <MaterialsTab
                slots={data.materialSlots}
                credits={data.credits}
                matNextRefresh={data.matNextRefresh}
                onBuy={handleMatBuy}
                onRefresh={() => router.refresh()}
              />
            )}
            {tab === "PARTS" && (
              <PartsTab
                listings={data.partListings}
                credits={data.credits}
                partNextRefresh={data.partNextRefresh}
                onBuy={handlePartBuy}
                onRefresh={() => router.refresh()}
              />
            )}
            {tab === "CARS" && (
              <CarsTab
                listings={data.carListings}
                credits={data.credits}
                onBuy={handleCarBuy}
              />
            )}
            {tab === "RECRUIT" && (
              <RecruitTab
                driverTemplates={data.driverTemplates}
                engineerTemplates={data.engineerTemplates}
                xgear={data.xgear}
                pity={data.pity}
                onRoll={handleGachaRoll}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Component-scoped CSS ─────────────────────────────────────────────────────
const MARKET_STYLES = `
  /* ── Tab bar ── */
  .mkt-tab-bar {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 20px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .mkt-tab-bar::-webkit-scrollbar { display: none; }
  .mkt-tab-btn {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--color-text-muted);
    padding: 10px 14px;
    border-bottom: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .mkt-tab-btn:hover { color: white; }
  .mkt-tab-active { color: white !important; border-bottom-color: #e8001c !important; }

  /* ── Tab content ── */
  .mkt-tab-content { padding-top: 4px; }

  /* ── Section header ── */
  .mkt-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .mkt-section-tag {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
    margin-bottom: 4px;
  }
  .mkt-section-title {
    font-family: var(--font-display);
    font-size: clamp(20px, 4vw, 30px);
    letter-spacing: 0.06em;
    color: white;
    line-height: 1;
  }

  /* ── Balance chip ── */
  .mkt-balance-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid var(--color-border);
    background: rgba(255,255,255,0.02);
  }
  .mkt-balance-val {
    font-family: var(--font-mono);
    font-size: 13px;
    color: white;
    font-weight: 500;
  }
  .mkt-balance-label {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: 0.08em;
  }

  /* ── Refresh row ── */
  .mkt-refresh-row {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 0.06em;
  }
  .mkt-refresh-time {
    color: white;
    font-weight: 500;
  }
  .mkt-refresh-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    padding: 3px 8px;
    border: 1px solid;
  }
  .mkt-refresh-active {
    color: #e8001c;
    border-color: rgba(232,0,28,0.4);
    background: rgba(232,0,28,0.08);
    animation: mktPulse 1s ease-in-out infinite;
  }
  @keyframes mktPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  /* ── Toast ── */
  .mkt-toast {
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    padding: 10px 20px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    border: 1px solid;
    white-space: nowrap;
    pointer-events: none;
    animation: toastIn 0.2s ease;
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── Empty state ── */
  .mkt-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 16px;
    text-align: center;
  }
  .mkt-empty-title {
    font-family: var(--font-display);
    font-size: 20px;
    letter-spacing: 0.1em;
    color: #333;
    margin-bottom: 6px;
  }
  .mkt-empty-sub {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-subtle);
  }

  /* ── Material grid ── */
  .mkt-mat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  @media (min-width: 640px) { .mkt-mat-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1024px) { .mkt-mat-grid { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 1280px) { .mkt-mat-grid { grid-template-columns: repeat(5, 1fr); } }

  /* ── Material card — vertical card with art hero ── */
  .mkt-mat-card {
    position: relative;
    background: #111111;
    border: 1px solid;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: mktCardIn 0.35s cubic-bezier(0.16,1,0.3,1) both;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .mkt-mat-card:hover {
    border-color: var(--mat-accent, rgba(255,255,255,0.2)) !important;
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  }

  /* Art hero area — square, prominent */
  .mkt-mat-art-hero {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .mkt-mat-art-glow {
    position: absolute;
    width: 60%;
    height: 60%;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
  }
  .mkt-mat-art-img {
    position: relative;
    z-index: 1;
    width: 54%;
    height: 54%;
    object-fit: contain;
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.6));
  }
  .mkt-mat-rarity-corner {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 18px 18px 0;
    border-color: transparent var(--mat-accent, #888) transparent transparent;
    opacity: 0.8;
  }
  .mkt-mat-stock-badge {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px 8px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.06em;
    font-weight: 600;
    border-top: 1px solid;
    text-align: center;
    backdrop-filter: blur(4px);
  }

  /* Content area */
  .mkt-mat-content {
    display: flex;
    flex-direction: column;
    padding: 10px 10px 10px;
    gap: 6px;
  }
  .mkt-mat-name {
    font-family: var(--font-mono);
    font-size: 10px;
    color: white;
    letter-spacing: 0.04em;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mkt-mat-price-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .mkt-mat-price {
    font-family: var(--font-display);
    font-size: 16px;
    letter-spacing: 0.04em;
    line-height: 1;
  }
  .mkt-mat-price-unit {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: 0.08em;
  }
  .mkt-mat-per-unit {
    font-family: var(--font-mono);
    font-size: 8px;
    color: var(--color-text-subtle);
    letter-spacing: 0.06em;
  }

  /* Controls row: stepper + buy */
  .mkt-mat-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mkt-stepper {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .mkt-stepper-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    border: none;
  }
  .mkt-stepper-btn:hover:not(:disabled) { color: white; background: rgba(255,255,255,0.06); }
  .mkt-stepper-btn:disabled { opacity: 0.25; cursor: default; }
  .mkt-stepper-val {
    width: 28px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 11px;
    color: white;
    border-left: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
    padding: 4px 0;
    line-height: 1;
  }
  .mkt-buy-btn {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    border: 1px solid;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mkt-buy-btn:not(:disabled):hover { filter: brightness(1.25); }
  .mkt-buy-btn:disabled { cursor: default; }

  /* ── Parts grid ── */
  .mkt-parts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  @media (min-width: 640px) { .mkt-parts-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1024px) { .mkt-parts-grid { grid-template-columns: repeat(4, 1fr); } }

  /* ── Part card — full-bleed image, content overlaid ── */
  .mkt-part-card {
    position: relative;
    background: #0d0d0d;
    border: 1px solid;
    aspect-ratio: 3 / 4;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: mktCardIn 0.35s cubic-bezier(0.16,1,0.3,1) both;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .mkt-part-card:hover {
    border-color: var(--part-accent, rgba(255,255,255,0.25)) !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .mkt-part-card:hover .mkt-part-bg-img {
    transform: scale(1.04);
  }

  /* Full-card background image */
  .mkt-part-bg-img {
    object-fit: cover;
    object-position: center;
    transition: transform 0.4s ease;
    z-index: 0;
  }

  /* Gradient scrim — darkens bottom for text legibility */
  .mkt-part-scrim {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  /* Rarity glow at bottom */
  .mkt-part-rarity-glow {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

  /* Top accent line */
  .mkt-part-accent-line {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    z-index: 4;
  }

  /* Full overlay flex container */
  .mkt-part-overlay {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    padding: 8px;
  }

  /* Top row: category + rarity */
  .mkt-part-hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }
  .mkt-part-cat-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .mkt-part-cat {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.1em;
    font-weight: 600;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  }
  .mkt-part-rarity-badge {
    font-family: var(--font-mono);
    font-size: 7px;
    letter-spacing: 0.1em;
    padding: 2px 5px;
    border: 1px solid;
    flex-shrink: 0;
    white-space: nowrap;
    backdrop-filter: blur(4px);
  }
  .mkt-part-last-badge {
    font-family: var(--font-mono);
    font-size: 7px;
    letter-spacing: 0.1em;
    padding: 2px 5px;
    border: 1px solid rgba(249,115,22,0.5);
    background: rgba(0,0,0,0.6);
    color: #f97316;
    flex-shrink: 0;
    backdrop-filter: blur(4px);
  }

  /* Bottom content: name, stock, stats, footer */
  .mkt-part-body {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .mkt-part-name {
    font-family: var(--font-mono);
    font-size: 11px;
    color: white;
    letter-spacing: 0.03em;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    text-shadow: 0 1px 6px rgba(0,0,0,0.9);
  }
  .mkt-part-qty-label {
    font-family: var(--font-mono);
    font-size: 9px;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.06em;
  }

  /* Stats grid — always 2 cols, one per influenced stat */
  .mkt-part-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .mkt-part-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px;
    background: rgba(0,0,0,0.6);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(6px);
  }
  .mkt-part-stat-v {
    font-family: var(--font-display);
    font-size: 22px;
    letter-spacing: 0.04em;
    line-height: 1;
  }
  .mkt-part-stat-k {
    font-family: var(--font-mono);
    font-size: 8px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* Footer: price + buy */
  .mkt-part-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-top: 6px;
    margin-top: 2px;
  }
  .mkt-part-price-block {
    display: flex;
    align-items: baseline;
    gap: 3px;
    flex-wrap: wrap;
  }
  .mkt-part-price {
    font-family: var(--font-display);
    font-size: 17px;
    letter-spacing: 0.04em;
    color: white;
    line-height: 1;
    text-shadow: 0 1px 6px rgba(0,0,0,0.9);
  }
  .mkt-part-price-cr {
    font-family: var(--font-mono);
    font-size: 9px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.1em;
  }
  .mkt-part-deal {
    font-family: var(--font-mono);
    font-size: 7px;
    color: #4ade80;
    letter-spacing: 0.1em;
    padding: 1px 4px;
    border: 1px solid rgba(74,222,128,0.3);
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
  }
  .mkt-part-buy-btn {
    padding: 6px 12px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    border: 1px solid;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
    white-space: nowrap;
    backdrop-filter: blur(6px);
  }
  .mkt-part-buy-btn:not(:disabled):hover { filter: brightness(1.25); }
  .mkt-part-buy-btn:disabled { cursor: default; }

  /* ── Cars grid ── */
  .mkt-cars-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 640px) { .mkt-cars-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .mkt-cars-grid { grid-template-columns: repeat(3, 1fr); } }

  /* ── Car card ── */
  .mkt-car-card {
    background: #111111;
    border: 1px solid var(--color-border);
    overflow: hidden;
    animation: mktCardIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
    transition: border-color 0.2s;
  }
  .mkt-car-card:hover { border-color: rgba(255,255,255,0.15); }
  .mkt-car-swatch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
  }
  .mkt-car-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .mkt-car-model-code {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 0.12em;
  }
  .mkt-car-tier-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    color: #c9a84c;
    border: 1px solid rgba(201,168,76,0.3);
    background: rgba(201,168,76,0.08);
    padding: 2px 6px;
    letter-spacing: 0.1em;
  }
  .mkt-car-body { padding: 12px; }
  .mkt-car-name {
    font-family: var(--font-display);
    font-size: 18px;
    letter-spacing: 0.06em;
    color: white;
    line-height: 1;
    margin-bottom: 2px;
  }
  .mkt-car-template {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: 0.1em;
    margin-bottom: 10px;
  }
  .mkt-car-stats {
    display: flex;
    gap: 5px;
    margin-bottom: 10px;
  }
  .mkt-car-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    flex: 1;
    padding: 5px 4px;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--color-border);
  }
  .mkt-car-stat-k {
    font-family: var(--font-mono);
    font-size: 7px;
    color: var(--color-text-subtle);
    letter-spacing: 0.1em;
  }
  .mkt-car-stat-v {
    font-family: var(--font-mono);
    font-size: 14px;
    color: white;
    font-weight: 500;
  }
  .mkt-car-record {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .mkt-car-record-val {
    font-family: var(--font-mono);
    font-size: 12px;
    color: white;
    font-weight: 500;
  }
  .mkt-car-record-lbl {
    font-family: var(--font-mono);
    font-size: 8px;
    color: var(--color-text-subtle);
    letter-spacing: 0.1em;
  }
  .mkt-car-sep {
    width: 1px;
    height: 12px;
    background: var(--color-border);
  }
  .mkt-car-seller {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-subtle);
    letter-spacing: 0.06em;
  }
  .mkt-car-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-top: 1px solid var(--color-border);
    background: rgba(255,255,255,0.01);
  }
  .mkt-car-price {
    font-family: var(--font-display);
    font-size: 22px;
    letter-spacing: 0.04em;
    color: white;
  }
  .mkt-car-price-cr {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 0.1em;
  }
  .mkt-car-buy-btn {
    padding: 8px 18px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    background: rgba(232,0,28,0.1);
    border: 1px solid rgba(232,0,28,0.3);
    color: #e8001c;
    cursor: pointer;
    transition: all 0.15s;
  }
  .mkt-car-buy-btn:not(:disabled):hover { background: rgba(232,0,28,0.2); }
  .mkt-car-buy-btn:disabled { cursor: default; }

  /* ── Modal shared ── */
  .mkt-modal-backdrop {
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
    .mkt-modal-backdrop { align-items: center; padding: 24px; }
  }
  .mkt-modal-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    background: transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .mkt-modal-close:hover { color: white; border-color: rgba(255,255,255,0.25); }

  /* ── Car confirm modal ── */
  .mkt-confirm-sheet {
    width: 100%;
    background: #111111;
    border: 1px solid var(--color-border);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    max-height: 90dvh;
    overflow-y: auto;
  }
  @media (min-width: 768px) {
    .mkt-confirm-sheet { max-width: 480px; border-bottom: 1px solid; border-radius: 4px; max-height: 80dvh; }
  }
  .mkt-confirm-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
  }
  .mkt-confirm-body { padding: 0 16px 12px; }
  .mkt-confirm-footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    flex-wrap: wrap;
  }
  .mkt-confirm-cancel-btn {
    padding: 9px 16px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .mkt-confirm-cancel-btn:hover { color: white; border-color: rgba(255,255,255,0.25); }
  .mkt-confirm-ok-btn {
    padding: 9px 20px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    background: rgba(232,0,28,0.14);
    border: 1px solid rgba(232,0,28,0.45);
    color: #e8001c;
    cursor: pointer;
    transition: background 0.15s;
  }
  .mkt-confirm-ok-btn:hover:not(:disabled) { background: rgba(232,0,28,0.24); }
  .mkt-confirm-ok-btn:disabled { opacity: 0.5; cursor: default; }

  /* ── GACHA: Banners ── */
  .gacha-banners-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }
  @media (min-width: 768px) { .gacha-banners-grid { grid-template-columns: repeat(2, 1fr); } }

  .gacha-banner-card {
    position: relative;
    border: 1px solid rgba(255,255,255,0.08);
    overflow: hidden;
    padding: 0;
  }
  .gacha-banner-grid {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(0deg, var(--border-color, rgba(255,255,255,0.03)) 0, var(--border-color, rgba(255,255,255,0.03)) 1px, transparent 1px, transparent 32px),
                      repeating-linear-gradient(90deg, var(--border-color, rgba(255,255,255,0.03)) 0, var(--border-color, rgba(255,255,255,0.03)) 1px, transparent 1px, transparent 32px);
    pointer-events: none;
  }
  .gacha-banner-diag {
    position: absolute;
    top: 0; bottom: 0;
    left: -20%;
    width: 60%;
    transform: skewX(-12deg);
    pointer-events: none;
  }
  .gacha-banner-body {
    position: relative;
    display: flex;
    gap: 16px;
    padding: 16px;
    z-index: 1;
  }
  .gacha-banner-art {
    position: relative;
    width: 80px;
    height: 100px;
    flex-shrink: 0;
    border: 1px solid;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .gacha-banner-art-icon {
    width: 56px;
    height: 56px;
    position: relative;
    z-index: 1;
  }
  @media (min-width: 480px) {
    .gacha-banner-art { width: 100px; height: 120px; }
    .gacha-banner-art-icon { width: 72px; height: 72px; }
  }
  .gacha-banner-info { flex: 1; min-width: 0; }
  .gacha-banner-odds {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 10px;
  }
  .gacha-odd-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .gacha-odd-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .gacha-odd-label {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: 0.08em;
    flex: 1;
  }
  .gacha-odd-pct {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }
  .gacha-pity-row { margin-bottom: 10px; }
  .gacha-pity-track {
    height: 2px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }
  .gacha-pity-fill {
    height: 100%;
    transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
    border-radius: 1px;
  }
  .gacha-roll-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 10px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    border: 1px solid;
    cursor: pointer;
    transition: all 0.2s;
  }
  .gacha-roll-btn:not(:disabled):hover { filter: brightness(1.2); transform: translateY(-1px); }
  .gacha-roll-btn:disabled { cursor: default; }

  /* ── XGEAR display ── */
  .gacha-xgear-display {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid rgba(201,168,76,0.2);
    background: rgba(201,168,76,0.04);
  }

  /* ── Gacha reveal ── */
  .gacha-reveal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,0.95);
    backdrop-filter: blur(8px);
  }
  @media (min-width: 768px) {
    .gacha-reveal-backdrop { align-items: center; padding: 24px; }
  }
  .gacha-reveal-sheet {
    width: 100%;
    background: #080808;
    border: 1px solid var(--color-border);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    max-height: 96dvh;
    overflow-y: auto;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  @media (min-width: 768px) {
    .gacha-reveal-sheet { max-width: 640px; border-bottom: 1px solid; border-radius: 4px; max-height: 92dvh; }
  }
  .gacha-reveal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  /* ── Gacha card grid ── */
  .gacha-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    padding: 16px;
  }
  @media (min-width: 480px) { .gacha-grid { gap: 10px; } }

  /* ── Gacha card ── */
  .gacha-card-wrap {
    perspective: 600px;
    aspect-ratio: 3 / 4;
  }
  .gacha-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
  }
  .gacha-card-face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border: 1px solid;
    overflow: hidden;
  }
  .gacha-card-back {
    background: #111111;
    border-color: rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gacha-card-back-texture {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 6px);
  }
  .gacha-card-back-q {
    position: relative;
    z-index: 1;
    font-family: var(--font-display);
    font-size: clamp(20px, 5vw, 32px);
    color: rgba(255,255,255,0.2);
    letter-spacing: 0;
  }
  .gacha-card-back-pulse {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(232,0,28,0.08), transparent 70%);
    animation: cardPulse 2.5s ease-in-out infinite;
  }
  @keyframes cardPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
  .gacha-card-front {
    background: #0a0a0a;
    transform: rotateY(180deg);
    display: flex;
    flex-direction: column;
  }
  .gacha-card-portrait {
    position: relative;
    flex: 1;
    overflow: hidden;
    background: #0d0d0d;
  }
  .gacha-card-info {
    padding: 5px 6px;
    display: flex;
    align-items: center;
    gap: 5px;
    background: #111;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .gacha-card-rarity-pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .gacha-card-name {
    font-family: var(--font-mono);
    font-size: 8px;
    color: white;
    letter-spacing: 0.06em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .gacha-card-new-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-family: var(--font-mono);
    font-size: 7px;
    letter-spacing: 0.1em;
    color: #4ade80;
    border: 1px solid rgba(74,222,128,0.4);
    background: rgba(74,222,128,0.1);
    padding: 1px 4px;
  }
  .gacha-card-selected-ring {
    position: absolute;
    inset: -2px;
    border: 2px solid;
    pointer-events: none;
    animation: selRing 0.4s ease;
  }
  @keyframes selRing {
    from { opacity: 0; transform: scale(1.05); }
    to { opacity: 1; transform: scale(1); }
  }
  .gacha-legendary-shimmer {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    background: linear-gradient(105deg, transparent 30%, rgba(201,168,76,0.15) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: shimmerSweep 2.5s ease-in-out infinite;
  }
  @keyframes shimmerSweep {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Gacha result panel ── */
  .gacha-result-panel {
    margin: 0 16px 16px;
    padding: 14px;
    border: 1px solid;
    background: rgba(0,0,0,0.4);
    animation: mktCardIn 0.3s ease both;
  }
  .gacha-result-rarity {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    padding: 2px 8px;
    border: 1px solid;
  }
  .gacha-result-new {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    color: #4ade80;
    border: 1px solid rgba(74,222,128,0.35);
    background: rgba(74,222,128,0.08);
    padding: 2px 8px;
  }
  .gacha-recruit-btn {
    padding: 9px 20px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    border: 1px solid;
    cursor: pointer;
    transition: filter 0.15s, transform 0.15s;
  }
  .gacha-recruit-btn:not(:disabled):hover { filter: brightness(1.2); transform: translateY(-1px); }
  .gacha-recruit-owned {
    color: #555 !important;
    background: transparent !important;
    border-color: rgba(255,255,255,0.08) !important;
    cursor: default !important;
  }

  /* ── Gacha hint ── */
  .gacha-hint {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-subtle);
    letter-spacing: 0.1em;
    padding: 12px 16px 20px;
    animation: mktPulse 2s ease-in-out infinite;
  }

  /* ── Gacha pool preview ── */
  .gacha-pool-preview {
    padding: 16px;
    border: 1px solid var(--color-border);
    background: rgba(255,255,255,0.01);
  }
  .gacha-pool-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .gacha-pool-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border: 1px solid;
    background: rgba(255,255,255,0.02);
  }
  .gacha-pool-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── Card animation ── */
  @keyframes mktCardIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
