"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GaragePageData, GarageCar } from "./page";

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = ["CARS", "FOR SALE"] as const;
type Tab = typeof TABS[number];

const TIER_LABELS = ["", "I", "II", "III", "IV", "V"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCr(n: number): string {
  return n.toLocaleString();
}

function winRate(wins: number, races: number): string {
  if (races === 0) return "—";
  return `${Math.round((wins / races) * 100)}%`;
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

// ─── Stat Bar ────────────────────────────────────────────────────────────────

function StatBar({ label, value, color = "#e8001c" }: { label: string; value: number; color?: string }) {
  return (
    <div className="grg-stat-row">
      <span className="grg-stat-label">{label}</span>
      <div className="grg-stat-track">
        <div
          className="grg-stat-fill"
          style={{ width: `${Math.min(value, 100)}%`, background: color }}
        />
      </div>
      <span className="grg-stat-num">{value}</span>
    </div>
  );
}

// ─── Car Card ────────────────────────────────────────────────────────────────

function CarCard({
  car,
  onList,
  onDelist,
  loading,
}: {
  car: GarageCar;
  onList?: (car: GarageCar) => void;
  onDelist?: (car: GarageCar) => void;
  loading?: boolean;
}) {
  const isRacing = car.status === "racing";
  const isForSale = car.status === "for_sale";

  return (
    <div
      className="grg-car-card"
      style={{ "--car-color": car.color } as React.CSSProperties}
    >
      {/* Color accent bar */}
      <div className="grg-car-accent" style={{ background: car.color }} />

      {/* Header */}
      <div className="grg-car-header">
        <div className="grg-car-title-block">
          <h3 className="grg-car-name">{car.name}</h3>
          <div className="grg-car-meta">
            <span className="grg-car-model">{car.model_code}</span>
            <span className="grg-tier-badge">TIR {TIER_LABELS[car.tier] ?? car.tier}</span>
          </div>
        </div>
        <div className="grg-car-swatch-wrap">
          <div className="grg-color-swatch" style={{ background: car.color }} />
          <div className="grg-status-badge" data-status={car.status}>
            {isRacing ? (
              <span className="grg-racing-dot" />
            ) : isForSale ? (
              <span style={{ color: "#c9a84c" }}>FOR SALE</span>
            ) : (
              <span>IN GARAGE</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grg-stats-block">
        <StatBar label="SPD" value={car.speed} color={car.color} />
        <StatBar label="HDL" value={car.handling} color={car.color} />
        <StatBar label="DRB" value={car.durability} color={car.color} />
        <StatBar label="ACC" value={car.acceleration} color={car.color} />
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

      {/* Actions */}
      <div className="grg-card-actions">
        {!isForSale && !isRacing && onList && (
          <button
            className="grg-list-btn"
            onClick={() => onList(car)}
            disabled={loading}
          >
            LIST FOR SALE
          </button>
        )}
        {isRacing && (
          <button className="grg-list-btn" disabled>
            RACING
          </button>
        )}
        {isForSale && onDelist && (
          <button
            className="grg-delist-btn"
            onClick={() => onDelist(car)}
            disabled={loading}
          >
            CANCEL LISTING
          </button>
        )}
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

  return (
    <div className="grg-modal-overlay" onClick={onClose}>
      <div className="grg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="grg-modal-header">
          <span className="grg-modal-title">LIST FOR SALE</span>
          <button className="grg-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Car summary */}
        <div className="grg-modal-car-summary">
          <div className="grg-modal-car-accent" style={{ background: car.color }} />
          <div className="grg-modal-car-info">
            <span className="grg-modal-car-name">{car.name}</span>
            <span className="grg-modal-car-sub">{car.model_code} · TIER {TIER_LABELS[car.tier] ?? car.tier}</span>
          </div>
          <div className="grg-modal-color-swatch" style={{ background: car.color }} />
        </div>

        {/* Stats preview */}
        <div className="grg-modal-stats">
          {[
            { label: "SPD", value: car.speed },
            { label: "HDL", value: car.handling },
            { label: "DRB", value: car.durability },
            { label: "ACC", value: car.acceleration },
          ].map((s) => (
            <div key={s.label} className="grg-modal-stat">
              <span className="grg-modal-stat-val" style={{ color: car.color }}>{s.value}</span>
              <span className="grg-modal-stat-label">{s.label}</span>
            </div>
          ))}
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
      else { show(`${car.name} removed from market.`, "ok"); router.refresh(); }
    } catch {
      show("Network error.", "err");
    } finally {
      setDelistLoading(null);
    }
  }

  function handleListSuccess(msg: string) {
    setListTarget(null);
    show(msg, "ok");
    router.refresh();
  }

  return (
    <>
      <style>{GARAGE_STYLES}</style>
      <Toast toast={toast} />

      <div className="grg-page">
        {/* Header */}
        <div className="grg-header">
          <div className="grg-header-inner">
            <div>
              <h1 className="grg-page-title">GARAGE</h1>
              <p className="grg-page-sub">
                {data.cars.length} VEHICLE{data.cars.length !== 1 ? "S" : ""} · {fmtCr(data.credits)} CR
              </p>
            </div>
            <div className="grg-fleet-stat">
              <span className="grg-fleet-num">{data.cars.length}</span>
              <span className="grg-fleet-label">FLEET</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="grg-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`grg-tab${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
                {t === "FOR SALE" && forSaleCars.length > 0 && (
                  <span className="grg-tab-badge">{forSaleCars.length}</span>
                )}
              </button>
            ))}
          </div>
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
                    <CarCard
                      key={car.id}
                      car={car}
                      onList={setListTarget}
                      loading={delistLoading === car.id}
                    />
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
                    <CarCard
                      key={car.id}
                      car={car}
                      onDelist={handleDelist}
                      loading={delistLoading === car.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

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

/* ── Header ─────────────────────────────────────────────── */
.grg-header {
  background: #080808;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 1.5rem 1.25rem 0;
  position: sticky;
  top: 0;
  z-index: 20;
}

@media (min-width: 768px) {
  .grg-header { padding: 2rem 2rem 0; }
}

.grg-header-inner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.grg-page-title {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 2.25rem;
  letter-spacing: 0.08em;
  color: #ffffff;
  line-height: 1;
}

.grg-page-sub {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.7rem;
  color: rgba(255,255,255,0.3);
  margin-top: 0.25rem;
  letter-spacing: 0.06em;
}

.grg-fleet-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.grg-fleet-num {
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 2.5rem;
  color: #e8001c;
  line-height: 1;
}

.grg-fleet-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.1em;
}

/* ── Tabs ───────────────────────────────────────────────── */
.grg-tabs {
  display: flex;
  gap: 0;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.grg-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.grg-tab.active {
  color: #ffffff;
  border-bottom-color: #e8001c;
}

.grg-tab-badge {
  background: #e8001c;
  color: #fff;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Content ────────────────────────────────────────────── */
.grg-content {
  padding: 1.25rem;
}

@media (min-width: 768px) {
  .grg-content { padding: 2rem; }
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

/* ── Car Card ───────────────────────────────────────────── */
.grg-car-card {
  background: #111111;
  border: 1px solid rgba(255,255,255,0.07);
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%);
}

.grg-car-card:hover {
  border-color: rgba(255,255,255,0.14);
  transform: translateY(-1px);
}

.grg-car-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  opacity: 0.8;
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
}

/* ── Stats ──────────────────────────────────────────────── */
.grg-stats-block {
  padding: 0 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.grg-stat-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.grg-stat-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.6rem;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em;
  width: 2rem;
  flex-shrink: 0;
}

.grg-stat-track {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.grg-stat-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
}

.grg-stat-num {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.65rem;
  color: rgba(255,255,255,0.5);
  width: 1.8rem;
  text-align: right;
  flex-shrink: 0;
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

/* ── Card Actions ───────────────────────────────────────── */
.grg-card-actions {
  padding: 0.75rem 1rem;
}

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
  padding: 0.55rem 1rem;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
  font-size: 0.85rem;
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

/* ── Modal ──────────────────────────────────────────────── */
.grg-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(4px);
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

.grg-modal-color-swatch {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  flex-shrink: 0;
}

/* Modal stats row */
.grg-modal-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.grg-modal-stat {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  padding: 0.5rem 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.grg-modal-stat-val {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1;
}

.grg-modal-stat-label {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.55rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.1em;
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

/* Confirm button */
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
