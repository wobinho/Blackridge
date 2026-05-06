"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { resolveArt } from "@/lib/resolveArt";
import type { GaragePageData, GarageCar } from "./page";

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = ["CARS", "FOR SALE"] as const;
type Tab = typeof TABS[number];

// Stat groups matching part categories
const STAT_GROUPS = [
  { label: "ENGINE",     icon: "⚡", stats: [{ key: "stat_speed", abbr: "SPD" }, { key: "stat_acceleration", abbr: "ACCEL" }] },
  { label: "SUSPENSION", icon: "⟳", stats: [{ key: "stat_handling", abbr: "HANDL" }, { key: "stat_stability", abbr: "STAB" }] },
  { label: "CHASSIS",    icon: "□", stats: [{ key: "stat_durability", abbr: "DUR" }, { key: "stat_weight", abbr: "WGHT" }] },
  { label: "BRAKES",     icon: "◉", stats: [{ key: "stat_braking", abbr: "BRK" }, { key: "stat_control", abbr: "CTRL" }] },
  { label: "GEARBOX",    icon: "⚙", stats: [{ key: "stat_shift_speed", abbr: "SHIFT" }, { key: "stat_efficiency", abbr: "EFF" }] },
  { label: "TIRES",      icon: "◎", stats: [{ key: "stat_grip", abbr: "GRIP" }, { key: "stat_cornering", abbr: "CORN" }] },
] as const;

const ALL_STAT_KEYS: (keyof GarageCar)[] = [
  "stat_speed", "stat_acceleration", "stat_handling", "stat_stability",
  "stat_durability", "stat_weight", "stat_braking", "stat_control",
  "stat_shift_speed", "stat_efficiency", "stat_grip", "stat_cornering",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCr(n: number): string {
  return n.toLocaleString();
}

function winRate(wins: number, races: number): string {
  if (races === 0) return "—";
  return `${Math.round((wins / races) * 100)}%`;
}

function getPerformance(car: GarageCar): number {
  return ALL_STAT_KEYS.reduce((sum, key) => sum + ((car[key] as number) || 0), 0);
}


// Archetype accent colors
function archetypeColor(archetype: string): string {
  switch (archetype) {
    case "classic_car": return "#ffffff";
    case "sports_car":  return "#e8001c";
    case "luxury_car":  return "#c9a84c";
    default:            return "#e8001c";
  }
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
    <div className="grg-toast" style={{
      background: toast.type === "ok" ? "rgba(201,168,76,0.1)" : "rgba(232,0,28,0.1)",
      borderColor: toast.type === "ok" ? "rgba(201,168,76,0.4)" : "rgba(232,0,28,0.4)",
      color: toast.type === "ok" ? "#c9a84c" : "#e8001c",
    }}>
      {toast.msg}
    </div>
  );
}

// ─── Car Image ───────────────────────────────────────────────────────────────

function CarImage({ art, name, accent }: { art: string | null; name: string; accent: string }) {
  const src = resolveArt(art, "cars");
  const [imageSrc, setImageSrc] = useState(src);

  return (
    <div className="grg-car-img-wrap">
      <Image
        src={imageSrc}
        alt={name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="grg-car-img"
        onError={() => {
          setImageSrc("/assets/cars/placeholder-4x3.svg");
        }}
      />
      {/* Gradient overlay — bottom fade into card body */}
      <div className="grg-car-img-fade" style={{ "--fade-color": accent } as React.CSSProperties} />
      {/* Top-left accent line */}
      <div className="grg-car-img-accent" style={{ background: accent }} />
    </div>
  );
}

// ─── Car Card ────────────────────────────────────────────────────────────────

function CarCard({
  car,
  onClick,
}: {
  car: GarageCar;
  onClick: (car: GarageCar) => void;
}) {
  const isRacing = car.status === "racing";
  const isForSale = car.status === "for_sale";
  const perf = getPerformance(car);
  const accent = archetypeColor(car.archetype);

  return (
    <div
      className="grg-car-card"
      style={{ "--car-color": accent } as React.CSSProperties}
      onClick={() => onClick(car)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(car)}
    >
      {/* 4:3 Car Image */}
      <CarImage art={car.art} name={car.name} accent={accent} />

      {/* Status overlay on image */}
      <div className="grg-card-status-overlay">
        {isRacing && (
          <div className="grg-status-pill grg-status-racing">
            <span className="grg-racing-dot" /><span>RACING</span>
          </div>
        )}
        {isForSale && (
          <div className="grg-status-pill grg-status-sale">FOR SALE</div>
        )}
      </div>

      {/* Color accent bar */}
      <div className="grg-car-accent" style={{ background: accent }} />

      {/* Header */}
      <div className="grg-car-header">
        <div className="grg-car-title-block">
          <h3 className="grg-car-name">{car.name}</h3>
          <div className="grg-car-meta">
            <span className="grg-car-model">{car.model_code}</span>
            <span className="grg-tier-badge">{car.archetype.replace("_", " ").toUpperCase()}</span>
          </div>
        </div>
        <div className="grg-car-swatch-wrap">
          <div className="grg-color-swatch" style={{ background: car.color }} />
        </div>
      </div>

      {/* Performance score */}
      <div className="grg-perf-block">
        <div className="grg-perf-label-row">
          <span className="grg-perf-label">PERFORMANCE</span>
          <span className="grg-perf-score" style={{ color: accent }}>{perf}</span>
        </div>
      </div>

      {/* Race record */}
      <div className="grg-race-record">
        <div className="grg-record-item">
          <span className="grg-record-label">RACES</span>
          <span className="grg-record-val">{car.total_races}</span>
        </div>
        <div className="grg-record-divider" />
        <div className="grg-record-item">
          <span className="grg-record-label">WINS</span>
          <span className="grg-record-val">{car.total_wins}</span>
        </div>
        <div className="grg-record-divider" />
        <div className="grg-record-item">
          <span className="grg-record-label">WIN RATE</span>
          <span className="grg-record-val">{winRate(car.total_wins, car.total_races)}</span>
        </div>
      </div>

      {/* Sale price if for_sale */}
      {isForSale && car.sale_price != null && (
        <div className="grg-sale-price">
          <span className="grg-sale-label">LISTED AT</span>
          <span className="grg-sale-amount">{fmtCr(car.sale_price)} CR</span>
        </div>
      )}

      {/* Tap hint */}
      <div className="grg-card-tap-hint">
        <span>TAP FOR DETAILS</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  car,
  onClose,
  onListForSale,
  onDelist,
  delistLoading,
}: {
  car: GarageCar;
  onClose: () => void;
  onListForSale: (car: GarageCar) => void;
  onDelist: (car: GarageCar) => void;
  delistLoading: boolean;
}) {
  const isRacing = car.status === "racing";
  const isForSale = car.status === "for_sale";
  const perf = getPerformance(car);
  const accent = archetypeColor(car.archetype);

  return (
    <div className="grg-modal-overlay" onClick={onClose}>
      <div className="grg-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Hero car image */}
        <div className="grg-detail-hero-img">
          <CarImage art={car.art} name={car.name} accent={accent} />
          {/* Status overlay */}
          <div className="grg-card-status-overlay">
            {isRacing && <div className="grg-status-pill grg-status-racing"><span className="grg-racing-dot" /><span>RACING</span></div>}
            {isForSale && <div className="grg-status-pill grg-status-sale">FOR SALE</div>}
          </div>
          {/* Close button pinned top-right */}
          <button className="grg-detail-img-close" onClick={onClose}>✕</button>
        </div>

        {/* Header */}
        <div className="grg-detail-header">
          <div className="grg-detail-header-left">
            <div className="grg-detail-status-row">
              {!isRacing && !isForSale && <span className="grg-detail-status-text">IN GARAGE</span>}
            </div>
            <h2 className="grg-detail-name">{car.name}</h2>
            <div className="grg-detail-sub">
              <span className="grg-car-model">{car.model_code}</span>
              <span className="grg-tier-badge">{car.archetype.replace("_", " ").toUpperCase()}</span>
              <div className="grg-color-swatch" style={{ background: car.color, width: "0.9rem", height: "0.9rem" }} />
            </div>
          </div>
        </div>

        {/* Performance hero */}
        <div className="grg-detail-perf-hero">
          <div className="grg-detail-perf-inner">
            <span className="grg-detail-perf-label">PERFORMANCE</span>
            <span className="grg-detail-perf-num" style={{ color: accent }}>{perf}</span>
          </div>
        </div>

        {/* Stat breakdown by part group */}
        <div className="grg-detail-section-label">STATS BREAKDOWN</div>
        <div className="grg-detail-stat-grid">
          {STAT_GROUPS.map((group) => {
            const groupTotal = group.stats.reduce((s, st) => s + ((car[st.key as keyof GarageCar] as number) || 0), 0);
            return (
              <div key={group.label} className="grg-detail-group">
                <div className="grg-detail-group-header">
                  <span className="grg-detail-group-label">{group.label}</span>
                  <span className="grg-detail-group-total" style={{ color: accent }}>{groupTotal}</span>
                </div>
                {group.stats.map((st) => {
                  const val = (car[st.key as keyof GarageCar] as number) || 0;
                  return (
                    <div key={st.key} className="grg-detail-stat-row">
                      <span className="grg-detail-stat-abbr">{st.abbr}</span>
                      <div className="grg-detail-stat-track">
                        <div
                          className="grg-detail-stat-fill"
                          style={{ width: `${Math.min((val / 200) * 100, 100)}%`, background: accent }}
                        />
                      </div>
                      <span className="grg-detail-stat-num">{val}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Race record */}
        <div className="grg-detail-section-label">RACE RECORD</div>
        <div className="grg-detail-record">
          <div className="grg-detail-record-item">
            <span className="grg-detail-record-val">{car.total_races}</span>
            <span className="grg-detail-record-label">RACES</span>
          </div>
          <div className="grg-record-divider" />
          <div className="grg-detail-record-item">
            <span className="grg-detail-record-val">{car.total_wins}</span>
            <span className="grg-detail-record-label">WINS</span>
          </div>
          <div className="grg-record-divider" />
          <div className="grg-detail-record-item">
            <span className="grg-detail-record-val">{winRate(car.total_wins, car.total_races)}</span>
            <span className="grg-detail-record-label">WIN RATE</span>
          </div>
          <div className="grg-record-divider" />
          <div className="grg-detail-record-item">
            <span className="grg-detail-record-val">{car.total_races - car.total_wins}</span>
            <span className="grg-detail-record-label">LOSSES</span>
          </div>
        </div>

        {/* Sale price if listed */}
        {isForSale && car.sale_price != null && (
          <div className="grg-detail-listed-price">
            <span className="grg-sale-label">LISTED AT</span>
            <span className="grg-sale-amount">{fmtCr(car.sale_price)} CR</span>
          </div>
        )}

        {/* Actions */}
        <div className="grg-detail-actions">
          {!isForSale && !isRacing && (
            <button className="grg-confirm-btn" onClick={() => onListForSale(car)}>
              LIST FOR SALE
            </button>
          )}
          {isRacing && (
            <button className="grg-confirm-btn" disabled>CURRENTLY RACING</button>
          )}
          {isForSale && (
            <button
              className="grg-delist-btn"
              onClick={() => onDelist(car)}
              disabled={delistLoading}
            >
              {delistLoading ? "CANCELLING..." : "CANCEL LISTING"}
            </button>
          )}
          <button className="grg-close-btn" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// ─── List Modal ───────────────────────────────────────────────────────────────

function ListModal({
  car,
  onClose,
  onSuccess,
}: {
  car: GarageCar;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function confirm() {
    const p = parseInt(price, 10);
    if (!p || p <= 0) { setErr("Enter a valid price above 0 CR."); return; }
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/garage/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: car.id, price: p }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Failed to list car."); setLoading(false); return; }
      onSuccess(`${car.name} listed for ${fmtCr(p)} CR`);
    } catch {
      setErr("Network error. Try again.");
      setLoading(false);
    }
  }

  const accent = archetypeColor(car.archetype);

  return (
    <div className="grg-modal-overlay" onClick={onClose}>
      <div className="grg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="grg-modal-header">
          <span className="grg-modal-title">LIST FOR SALE</span>
          <button className="grg-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Car summary */}
        <div className="grg-modal-car-summary">
          <div className="grg-modal-car-accent" style={{ background: accent }} />
          <div className="grg-modal-car-info">
            <span className="grg-modal-car-name">{car.name}</span>
            <span className="grg-modal-car-sub">{car.model_code} · {car.archetype.replace("_", " ").toUpperCase()}</span>
          </div>
          <div className="grg-modal-perf-chip" style={{ borderColor: accent, color: accent }}>
            <span className="grg-modal-perf-num">{getPerformance(car)}</span>
            <span className="grg-modal-perf-lbl">PERF</span>
          </div>
        </div>

        {/* Record */}
        <div className="grg-modal-record">
          <span>{car.total_races} races · {car.total_wins} wins · {winRate(car.total_wins, car.total_races)} win rate</span>
        </div>

        <div className="grg-modal-divider" />

        {/* Price input */}
        <div className="grg-price-field">
          <label className="grg-price-label">SALE PRICE</label>
          <div className="grg-price-input-wrap">
            <input
              className="grg-price-input"
              type="number"
              min={1}
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
              autoFocus
            />
            <span className="grg-price-unit">CR</span>
          </div>
          {err && <p className="grg-price-err">{err}</p>}
          {price && parseInt(price, 10) > 0 && (
            <p className="grg-price-hint">Listing for <strong>{fmtCr(parseInt(price, 10))} CR</strong></p>
          )}
        </div>

        <button
          className="grg-confirm-btn"
          onClick={confirm}
          disabled={loading}
        >
          {loading ? "LISTING..." : "CONFIRM LISTING"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GarageClient({ data }: { data: GaragePageData }) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [tab, setTab] = useState<Tab>("CARS");
  const [detailCar, setDetailCar] = useState<GarageCar | null>(null);
  const [listTarget, setListTarget] = useState<GarageCar | null>(null);
  const [delistLoading, setDelistLoading] = useState<number | null>(null);

  const garageCars = data.cars.filter((c) => c.status !== "for_sale");
  const forSaleCars = data.cars.filter((c) => c.status === "for_sale");

  async function handleDelist(car: GarageCar) {
    if (!car.listing_id) return;
    setDelistLoading(car.id);
    try {
      const res = await fetch("/api/garage/delist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: car.listing_id }),
      });
      const data = await res.json();
      if (!res.ok) { show(data.error ?? "Failed to cancel listing.", "err"); }
      else {
        show(`${car.name} removed from market.`, "ok");
        setDetailCar(null);
        router.refresh();
      }
    } catch {
      show("Network error.", "err");
    } finally {
      setDelistLoading(null);
    }
  }

  function handleListSuccess(msg: string) {
    setListTarget(null);
    setDetailCar(null);
    show(msg, "ok");
    router.refresh();
  }

  function handleOpenDetail(car: GarageCar) {
    setDetailCar(car);
  }

  function handleListFromDetail(car: GarageCar) {
    setDetailCar(null);
    setListTarget(car);
  }

  return (
    <>
      <style>{GARAGE_STYLES}</style>
      <Toast toast={toast} />

      <div className="grg-page">
        {/* Page Header */}
        <div className="grg-page-header">
          <div className="grg-page-header-inner">
            <div>
              <h1 className="grg-page-title">GARAGE</h1>
              <p className="grg-page-sub">Manage your fleet. List cars for sale.</p>
            </div>
            <div className="grg-header-credits">
              <span className="grg-credits-val">{fmtCr(data.credits)}</span>
              <span className="grg-credits-label">CR</span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="grg-tab-bar">
          {TABS.map((t) => (
            <button
              key={t}
              className={`grg-tab-btn${tab === t ? " grg-tab-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "FOR SALE" && forSaleCars.length > 0 && (
                <span className="grg-tab-badge">{forSaleCars.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grg-content">
          {tab === "CARS" && (
            <>
              {garageCars.length === 0 ? (
                <div className="grg-empty">
                  <div className="grg-empty-icon">
                    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 44L8 36 Q10 28 18 24 L26 20 Q28 16 32 16 Q36 16 38 20 L46 24 Q54 28 56 36 L56 44 Z" />
                      <rect x="8" y="42" width="48" height="4" rx="1" />
                      <circle cx="20" cy="46" r="7" strokeWidth="1.5" />
                      <circle cx="44" cy="46" r="7" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <p className="grg-empty-title">NO VEHICLES</p>
                  <p className="grg-empty-sub">Win races or buy from the market to build your fleet.</p>
                </div>
              ) : (
                <div className="grg-grid">
                  {garageCars.map((car) => (
                    <CarCard key={car.id} car={car} onClick={handleOpenDetail} />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "FOR SALE" && (
            <>
              {forSaleCars.length === 0 ? (
                <div className="grg-empty">
                  <div className="grg-empty-icon">
                    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="12" y="16" width="40" height="32" rx="2" />
                      <path d="M12 24h40M24 16v8M40 16v8" />
                      <circle cx="32" cy="38" r="4" />
                    </svg>
                  </div>
                  <p className="grg-empty-title">NOTHING LISTED</p>
                  <p className="grg-empty-sub">Go to your Cars tab and list a vehicle to sell it on the market.</p>
                </div>
              ) : (
                <div className="grg-grid">
                  {forSaleCars.map((car) => (
                    <CarCard key={car.id} car={car} onClick={handleOpenDetail} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {detailCar && !listTarget && (
        <DetailModal
          car={detailCar}
          onClose={() => setDetailCar(null)}
          onListForSale={handleListFromDetail}
          onDelist={handleDelist}
          delistLoading={delistLoading === detailCar.id}
        />
      )}

      {/* List for sale modal */}
      {listTarget && (
        <ListModal
          car={listTarget}
          onClose={() => setListTarget(null)}
          onSuccess={handleListSuccess}
        />
      )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const GARAGE_STYLES = `
/* ── Layout ─────────────────────────────────────────────── */
.grg-page {
  min-height: 100vh;
  background: #080808;
  padding-bottom: 5rem;
}

@media (min-width: 768px) {
  .grg-page { margin-left: 4rem; padding-bottom: 1.5rem; }
}

/* ── Page Header ────────────────────────────────────────── */
.grg-page-header {
  padding: 20px 16px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: linear-gradient(180deg, rgba(232,0,28,0.04) 0%, transparent 100%);
}

.grg-page-header-inner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 16px;
}

.grg-page-title {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: clamp(28px, 5vw, 40px);
  letter-spacing: 0.05em;
  color: #ffffff;
  line-height: 1;
}

.grg-page-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  margin-top: 4px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.grg-header-credits {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.grg-credits-val {
  font-family: var(--font-mono, 'JetBrains Mono'), monospace;
  font-size: 18px;
  color: #c9a84c;
  letter-spacing: -0.02em;
}

.grg-credits-label {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.1em;
}

/* ── Tab Bar ────────────────────────────────────────────── */
.grg-tab-bar {
  display: flex;
  padding: 0 16px;
  gap: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: #080808;
  position: sticky;
  top: 0;
  z-index: 20;
}

.grg-tab-btn {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 15px;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  padding: 12px 20px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.grg-tab-btn:hover:not(.grg-tab-active) { color: rgba(255,255,255,0.6); }

.grg-tab-active {
  color: #ffffff;
  border-bottom-color: #e8001c;
}

.grg-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e8001c;
  color: #fff;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  padding: 0 4px;
  animation: grg-pulse 2s ease-in-out infinite;
}

/* ── Content ────────────────────────────────────────────── */
.grg-content {
  padding: 20px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .grg-content { padding: 20px 16px; }
}

/* ── Grid ───────────────────────────────────────────────── */
.grg-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .grg-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1200px) {
  .grg-grid { grid-template-columns: repeat(3, 1fr); }
}

/* ── Car Image ──────────────────────────────────────────────── */
.grg-car-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #0a0a0a;
}

.grg-car-img {
  object-fit: cover;
  object-position: center;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.grg-car-card:hover .grg-car-img {
  transform: scale(1.04);
}

.grg-car-img-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 30%,
    rgba(17, 17, 17, 0.5) 70%,
    #111111 100%
  );
  pointer-events: none;
}

.grg-car-img-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  opacity: 0.9;
}

/* Status pills on image */
.grg-card-status-overlay {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
}

.grg-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  border-radius: 2px;
  backdrop-filter: blur(8px);
}

.grg-status-racing {
  background: rgba(232, 0, 28, 0.2);
  border: 1px solid rgba(232, 0, 28, 0.5);
  color: #e8001c;
}

.grg-status-sale {
  background: rgba(201, 168, 76, 0.2);
  border: 1px solid rgba(201, 168, 76, 0.5);
  color: #c9a84c;
}

/* ── Car Card ───────────────────────────────────────────── */
.grg-car-card {
  background: #111111;
  border: 1px solid rgba(255,255,255,0.07);
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%);
  cursor: pointer;
}

.grg-car-card:hover {
  border-color: rgba(255,255,255,0.18);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.grg-car-card:focus-visible {
  outline: 1px solid rgba(255,255,255,0.3);
  outline-offset: 2px;
}

.grg-car-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  opacity: 0.8;
  pointer-events: none;
}

/* ── Card Header ────────────────────────────────────────── */
.grg-car-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1rem 1rem 0.75rem 1.25rem;
}

.grg-car-title-block {
  flex: 1;
  min-width: 0;
}

.grg-car-name {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.35rem;
  letter-spacing: 0.06em;
  color: #ffffff;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grg-car-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
}

.grg-car-model {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.65rem;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.08em;
}

.grg-tier-badge {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.06em;
}

.grg-car-swatch-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.grg-color-swatch {
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.15);
  flex-shrink: 0;
}

.grg-status-badge {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.25);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.grg-racing-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #e8001c;
  border-radius: 50%;
  animation: grg-pulse 1s infinite;
  flex-shrink: 0;
}

/* ── Performance Block (card) ───────────────────────────── */
.grg-perf-block {
  padding: 0 1.25rem 0.75rem;
}

.grg-perf-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.grg-perf-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.1em;
}

.grg-perf-score {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.6rem;
  letter-spacing: 0.04em;
  line-height: 1;
}

.grg-perf-track {
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.grg-perf-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Race Record ────────────────────────────────────────── */
.grg-race-record {
  display: flex;
  align-items: center;
  padding: 0.6rem 1.25rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.grg-record-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.grg-record-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.55rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.1em;
}

.grg-record-val {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
}

.grg-record-divider {
  width: 1px;
  height: 1.5rem;
  background: rgba(255,255,255,0.07);
}

/* ── Sale Price ─────────────────────────────────────────── */
.grg-sale-price {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1.25rem;
}

.grg-sale-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.08em;
}

.grg-sale-amount {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 1rem;
  color: #c9a84c;
  letter-spacing: 0.04em;
}

/* ── Tap Hint ───────────────────────────────────────────── */
.grg-card-tap-hint {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  padding: 0.5rem 1rem 0.6rem;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.55rem;
  color: rgba(255,255,255,0.18);
  letter-spacing: 0.08em;
  transition: color 0.2s;
}

.grg-car-card:hover .grg-card-tap-hint {
  color: rgba(255,255,255,0.35);
}

/* ── Empty State ────────────────────────────────────────── */
.grg-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 1.5rem;
  gap: 0.75rem;
}

.grg-empty-icon {
  width: 4rem;
  height: 4rem;
  color: rgba(255,255,255,0.1);
  margin-bottom: 0.5rem;
}

.grg-empty-icon svg {
  width: 100%;
  height: 100%;
}

.grg-empty-title {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.2);
}

.grg-empty-sub {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.2);
  text-align: center;
  max-width: 280px;
  line-height: 1.5;
}

/* ── Toast ──────────────────────────────────────────────── */
.grg-toast {
  position: fixed;
  bottom: 5.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  padding: 0.6rem 1.25rem;
  border: 1px solid;
  border-radius: 2px;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  white-space: nowrap;
  pointer-events: none;
  animation: grg-toast-in 0.2s ease;
}

@media (min-width: 768px) {
  .grg-toast { bottom: 2rem; left: calc(4rem + 50%); }
}

/* ── Detail Modal ───────────────────────────────────────── */
.grg-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(6px);
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

@media (min-width: 640px) {
  .grg-modal-overlay {
    align-items: center;
    padding: 1.5rem;
  }
}

/* Detail modal — tall sheet */
.grg-detail-modal {
  background: #0e0e0e;
  border: 1px solid rgba(255,255,255,0.1);
  border-bottom: none;
  width: 100%;
  max-width: 520px;
  max-height: 92vh;
  overflow-y: auto;
  animation: grg-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

@media (min-width: 640px) {
  .grg-detail-modal {
    border-bottom: 1px solid rgba(255,255,255,0.1);
    animation: grg-modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%);
    max-height: 90vh;
  }
}

/* ── Detail modal hero image ─────────────────────────────── */
.grg-detail-hero-img {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #0a0a0a;
  flex-shrink: 0;
}

.grg-detail-hero-img .grg-car-img-fade {
  background: linear-gradient(
    to bottom,
    transparent 40%,
    rgba(14, 14, 14, 0.6) 75%,
    #0e0e0e 100%
  );
}

.grg-detail-img-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.7);
  font-size: 0.8rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.15s, color 0.15s;
}

.grg-detail-img-close:hover {
  background: rgba(232,0,28,0.3);
  color: #fff;
  border-color: rgba(232,0,28,0.5);
}

.grg-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 0.75rem;
}

.grg-detail-header-left {
  flex: 1;
  min-width: 0;
}

.grg-detail-status-row {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
}

.grg-detail-status-text {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.3);
}

.grg-detail-name {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: clamp(1.6rem, 5vw, 2.2rem);
  letter-spacing: 0.06em;
  color: #ffffff;
  line-height: 1;
}

.grg-detail-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

/* ── Performance Hero ───────────────────────────────────── */
.grg-detail-perf-hero {
  padding: 0.75rem 1.25rem 1rem;
  background: rgba(255,255,255,0.02);
  border-top: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.grg-detail-perf-inner {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.grg-detail-perf-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.12em;
}

.grg-detail-perf-num {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 3rem;
  letter-spacing: 0.02em;
  line-height: 1;
}

.grg-detail-perf-track {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.grg-detail-perf-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Section Label ──────────────────────────────────────── */
.grg-detail-section-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  color: rgba(255,255,255,0.25);
  padding: 0.875rem 1.25rem 0.4rem;
  text-transform: uppercase;
}

/* ── Stat Breakdown Grid ────────────────────────────────── */
.grg-detail-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: rgba(255,255,255,0.05);
  border-top: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.grg-detail-group {
  background: #0e0e0e;
  padding: 0.75rem 1rem;
}

.grg-detail-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.grg-detail-group-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.35);
}

.grg-detail-group-total {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.1rem;
  letter-spacing: 0.04em;
  line-height: 1;
}

.grg-detail-stat-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.grg-detail-stat-row:last-child { margin-bottom: 0; }

.grg-detail-stat-abbr {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.55rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.06em;
  width: 2.5rem;
  flex-shrink: 0;
}

.grg-detail-stat-track {
  flex: 1;
  height: 2px;
  background: rgba(255,255,255,0.06);
  border-radius: 1px;
  overflow: hidden;
}

.grg-detail-stat-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

.grg-detail-stat-num {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  color: rgba(255,255,255,0.55);
  width: 1.5rem;
  text-align: right;
  flex-shrink: 0;
}

/* ── Detail Record ──────────────────────────────────────── */
.grg-detail-record {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.grg-detail-record-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.grg-detail-record-val {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.4rem;
  letter-spacing: 0.04em;
  color: #ffffff;
  line-height: 1;
}

.grg-detail-record-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.52rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.1em;
}

/* ── Detail Listed Price ────────────────────────────────── */
.grg-detail-listed-price {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(201,168,76,0.04);
}

/* ── Detail Actions ─────────────────────────────────────── */
.grg-detail-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.25rem 1.5rem;
}

/* ── Buttons ────────────────────────────────────────────── */
.grg-list-btn {
  width: 100%;
  padding: 0.55rem 1rem;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  background: transparent;
  border: 1px solid rgba(232,0,28,0.5);
  color: #e8001c;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}

.grg-list-btn:hover:not(:disabled) {
  background: rgba(232,0,28,0.08);
  border-color: #e8001c;
}

.grg-list-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.grg-delist-btn {
  width: 100%;
  padding: 0.65rem 1rem;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 0.9rem;
  letter-spacing: 0.12em;
  background: transparent;
  border: 1px solid rgba(201,168,76,0.4);
  color: #c9a84c;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}

.grg-delist-btn:hover:not(:disabled) {
  background: rgba(201,168,76,0.07);
  border-color: #c9a84c;
}

.grg-delist-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.grg-close-btn {
  width: 100%;
  padding: 0.65rem 1rem;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 0.9rem;
  letter-spacing: 0.12em;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.grg-close-btn:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.6);
}

.grg-confirm-btn {
  width: 100%;
  padding: 0.8rem 1.5rem;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1rem;
  letter-spacing: 0.15em;
  background: #e8001c;
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s, background 0.2s;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}

.grg-confirm-btn:hover:not(:disabled) { background: #cc0018; }
.grg-confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── List Modal (sale) ──────────────────────────────────── */
.grg-modal {
  background: #111111;
  border: 1px solid rgba(255,255,255,0.1);
  border-bottom: none;
  width: 100%;
  max-width: 480px;
  padding: 1.5rem;
  animation: grg-slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%);
}

@media (min-width: 640px) {
  .grg-modal {
    border-bottom: 1px solid rgba(255,255,255,0.1);
    animation: grg-modal-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.grg-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.grg-modal-title {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.35rem;
  letter-spacing: 0.1em;
  color: #ffffff;
}

.grg-modal-close {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.15s;
}

.grg-modal-close:hover { color: #ffffff; }

/* Modal car summary */
.grg-modal-car-summary {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  padding: 0.875rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  position: relative;
  overflow: hidden;
}

.grg-modal-car-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.grg-modal-car-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.grg-modal-car-name {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  color: #fff;
}

.grg-modal-car-sub {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.62rem;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.06em;
}

/* Performance chip in list modal */
.grg-modal-perf-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid;
  padding: 0.35rem 0.6rem;
  flex-shrink: 0;
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%);
}

.grg-modal-perf-num {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 1.3rem;
  letter-spacing: 0.04em;
  line-height: 1;
}

.grg-modal-perf-lbl {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.grg-modal-record {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.62rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.04em;
  text-align: center;
  margin-bottom: 1rem;
}

.grg-modal-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin-bottom: 1rem;
}

/* Price field */
.grg-price-field {
  margin-bottom: 1rem;
}

.grg-price-label {
  display: block;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.65rem;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.grg-price-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  transition: border-color 0.2s;
}

.grg-price-input-wrap:focus-within {
  border-color: rgba(201,168,76,0.5);
}

.grg-price-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 0.7rem 0.875rem;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 1.1rem;
  color: #ffffff;
}

.grg-price-input::placeholder { color: rgba(255,255,255,0.15); }
.grg-price-input::-webkit-outer-spin-button,
.grg-price-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.grg-price-input[type=number] { -moz-appearance: textfield; }

.grg-price-unit {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  color: rgba(201,168,76,0.6);
  padding: 0 0.875rem;
  letter-spacing: 0.08em;
}

.grg-price-err {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.65rem;
  color: #e8001c;
  margin-top: 0.4rem;
}

.grg-price-hint {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.65rem;
  color: rgba(201,168,76,0.5);
  margin-top: 0.4rem;
}

.grg-price-hint strong {
  color: #c9a84c;
}

/* ── Keyframes ──────────────────────────────────────────── */
@keyframes grg-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes grg-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes grg-slide-up {
  from { opacity: 0; transform: translateY(100%); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes grg-modal-in {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
`;
