"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type {
  WorkshopPageData,
  CraftSlot,
  PartTemplate,
  MaterialStock,
  EngineerFull,
  InventoryPart,
  WorkshopUpgrades,
} from "./page";

// ─── Constants ──────────────────────────────────────────────────────────────

const RARITY_CONFIG: Record<string, { label: string; cls: string; accent: string; border: string; glow: string; shimmer: boolean }> = {
  common:    { label: "COMMON",    cls: "badge-common",    accent: "#aaaaaa", border: "rgba(255,255,255,0.1)",   glow: "rgba(180,180,180,0.06)",  shimmer: false },
  uncommon:  { label: "UNCOMMON",  cls: "badge-uncommon",  accent: "#4ade80", border: "rgba(74,222,128,0.25)",   glow: "rgba(74,222,128,0.08)",   shimmer: false },
  rare:      { label: "RARE",      cls: "badge-rare",      accent: "#60a5fa", border: "rgba(59,130,246,0.3)",    glow: "rgba(59,130,246,0.12)",   shimmer: false },
  epic:      { label: "EPIC",      cls: "badge-epic",      accent: "#c084fc", border: "rgba(168,85,247,0.35)",   glow: "rgba(168,85,247,0.14)",   shimmer: false },
  legendary: { label: "LEGENDARY", cls: "badge-legendary", accent: "#c9a84c", border: "rgba(201,168,76,0.45)",   glow: "rgba(201,168,76,0.18)",   shimmer: true  },
  mythical:  { label: "MYTHICAL",  cls: "badge-mythical",  accent: "#f97316", border: "rgba(249,115,22,0.45)",   glow: "rgba(249,115,22,0.18)",   shimmer: true  },
  event:     { label: "EVENT",     cls: "badge-event",     accent: "#e8001c", border: "rgba(232,0,28,0.45)",     glow: "rgba(232,0,28,0.18)",     shimmer: true  },
};

const CATEGORY_ICONS: Record<string, string> = {
  engine:       "M9 3H7a2 2 0 00-2 2v1H3a1 1 0 000 2h2v1a2 2 0 002 2h2m0-8v8m0-8h6m0 0h2a2 2 0 012 2v1h2a1 1 0 010 2h-2v1a2 2 0 01-2 2h-2m0-8v8M9 11h6",
  chassis:      "M4 6h16M4 10h16M4 14h16M4 18h16",
  suspension:   "M12 3v3m0 12v3M3 12h3m12 0h3M6.34 6.34l2.12 2.12m7.08 7.08l2.12 2.12M6.34 17.66l2.12-2.12m7.08-7.08l2.12-2.12",
  aerodynamics: "M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9M3 12h18M12 3v18M7.76 7.76l8.48 8.48M16.24 7.76l-8.48 8.48",
  tyres:        "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0v20M2 12h20",
  brakes:       "M8 6h8v12H8zM4 8h4v8H4zm12 0h4v8h-4z",
  electronics:  "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
};

const UPGRADE_META: Record<string, { icon: string; label: string; description: string; baseCost: number; costScale: number; maxLevel: number; valueLabel: (v: number) => string }> = {
  develop_slots:    { icon: "M4 6h16M4 12h16M4 18h7", label: "Develop Slots", description: "Unlock additional simultaneous crafting slots.", baseCost: 2000, costScale: 2.5, maxLevel: 6,  valueLabel: (v) => `${v} SLOTS` },
  develop_speed:    { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Develop Speed", description: "Reduce part crafting time across all slots.", baseCost: 3000, costScale: 3.0, maxLevel: 5,  valueLabel: (v) => `LVL ${v}` },
  inventory_size:   { icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", label: "Inventory Size", description: "Increase maximum part storage capacity.", baseCost: 1000, costScale: 1.8, maxLevel: 8,  valueLabel: (v) => `${v * 5 + 15} PARTS` },
  engineer_cap:     { icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", label: "Engineer Capacity", description: "Hire more engineers for your workshop.", baseCost: 2500, costScale: 2.0, maxLevel: 10, valueLabel: (v) => `${v} ENG` },
  driver_cap:       { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label: "Driver Capacity", description: "Sign more drivers to your racing team.", baseCost: 2500, costScale: 2.0, maxLevel: 15, valueLabel: (v) => `${v} DRV` },
  garage_cap:       { icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", label: "Garage Capacity", description: "Store more cars in your facility.", baseCost: 1500, costScale: 1.6, maxLevel: 20, valueLabel: (v) => `${v} CARS` },
  market_mat_slots: { icon: "M3 7h18M3 12h18M3 17h10", label: "Market Supply Lines", description: "Unlock +2 additional material slots in the market refresh (max 12 slots total).", baseCost: 3000, costScale: 2.2, maxLevel: 4,  valueLabel: (v) => `${4 + v * 2} SLOTS` },
  market_mat_rarity:{ icon: "M5 3l14 9-14 9V3z", label: "Market Intel", description: "Increases the chance of higher rarity materials appearing in the market refresh.", baseCost: 4000, costScale: 2.8, maxLevel: 5,  valueLabel: (v) => `TIER ${v}` },
};

const MATERIAL_RARITY_COLOR: Record<string, string> = {
  common:    "#aaaaaa",
  uncommon:  "#4ade80",
  rare:      "#60a5fa",
  epic:      "#c084fc",
  legendary: "#c9a84c",
  mythical:  "#f97316",
  event:     "#e8001c",
};

const TABS = ["DEVELOP", "ENGINEERS", "INVENTORY", "UPGRADES"] as const;
type Tab = typeof TABS[number];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCraftTime(seconds: number): string {
  return formatDuration(seconds);
}

function upgradeCost(field: string, currentLevel: number): number {
  const meta = UPGRADE_META[field];
  if (!meta) return Infinity;
  return Math.round(meta.baseCost * Math.pow(meta.costScale, currentLevel - 1));
}

function qualityColor(q: number): string {
  if (q >= 90) return "#c9a84c";
  if (q >= 70) return "#4ade80";
  if (q >= 50) return "#facc15";
  return "#f87171";
}

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategoryIcon({ category, size = 14, color = "currentColor" }: { category: string; size?: number; color?: string }) {
  const d = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.engine;
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0 }} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ─── Countdown Timer ────────────────────────────────────────────────────────

function Countdown({ completesAt, onComplete }: { completesAt: number; onComplete?: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, completesAt - Math.floor(Date.now() / 1000)));
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  useEffect(() => {
    if (remaining <= 0) {
      cbRef.current?.();
      return;
    }
    const id = setInterval(() => {
      const r = Math.max(0, completesAt - Math.floor(Date.now() / 1000));
      setRemaining(r);
      if (r <= 0) cbRef.current?.();
    }, 1000);
    return () => clearInterval(id);
  }, [completesAt, remaining]);

  return <span>{formatDuration(remaining)}</span>;
}

// ─── Materials Strip ─────────────────────────────────────────────────────────

function MaterialsStrip({ materials }: { materials: MaterialStock[] }) {
  return (
    <div className="ws-materials-strip">
      {materials.map((m) => {
        const col = "#888";
        return (
          <div key={m.id} className="ws-material-chip" style={{ borderColor: col + "33" }}>
            <span className="ws-material-dot" style={{ background: col, boxShadow: `0 0 4px ${col}88` }} />
            <span className="ws-material-name">{m.name.split(" ")[0]}</span>
            <span className="ws-material-qty" style={{ color: m.quantity === 0 ? "#555" : col }}>
              {m.quantity}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Craft Slot Card ─────────────────────────────────────────────────────────

function CraftSlotCard({
  slot,
  index,
  onStartBuild,
  onClaim,
  onCancel,
}: {
  slot: CraftSlot;
  index: number;
  onStartBuild: (slotIndex: number) => void;
  onClaim: (queueId: number) => void;
  onCancel: (queueId: number) => void;
}) {
  const [isReady, setIsReady] = useState(slot.status === "completed");

  useEffect(() => {
    setIsReady(slot.status === "completed");
  }, [slot.status]);

  if (slot.status === "idle") {
    return (
      <button
        className="ws-slot ws-slot-idle"
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => onStartBuild(slot.slot_index)}
      >
        <div className="ws-slot-idle-inner">
          <div className="ws-slot-plus">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </div>
          <span className="ws-slot-idle-label">START BUILD</span>
          <span className="ws-slot-num">SLOT {slot.slot_index + 1}</span>
        </div>
        {/* Animated border */}
        <div className="ws-slot-idle-border" />
      </button>
    );
  }

  if (slot.status === "completed" || isReady) {
    return (
      <div className="ws-slot ws-slot-complete" style={{ animationDelay: `${index * 60}ms` }}>
        <div className="ws-slot-complete-glow" />
        <div className="ws-slot-header">
          <span className="ws-slot-num">SLOT {slot.slot_index + 1}</span>
          <span className="ws-slot-done-badge">READY</span>
        </div>
        <div className="ws-slot-body">
          <div className="flex items-center gap-2 mb-1">
            <CategoryIcon category={slot.part_category ?? "engine"} size={13} color="#4ade80" />
            <span className="ws-slot-part-name">{slot.part_name}</span>
          </div>
          {slot.engineer_name && (
            <p className="ws-slot-engineer">by {slot.engineer_name}</p>
          )}
        </div>
        <button
          className="ws-claim-btn"
          onClick={() => slot.queue_id && onClaim(slot.queue_id)}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          CLAIM
        </button>
      </div>
    );
  }

  // crafting
  return (
    <div className="ws-slot ws-slot-crafting" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="ws-slot-header">
        <span className="ws-slot-num">SLOT {slot.slot_index + 1}</span>
        <span className="ws-crafting-badge">CRAFTING</span>
      </div>
      <div className="ws-slot-body">
        <div className="flex items-center gap-2 mb-1">
          <CategoryIcon category={slot.part_category ?? "engine"} size={13} color="#e8001c" />
          <span className="ws-slot-part-name">{slot.part_name}</span>
        </div>
        {slot.engineer_name && (
          <p className="ws-slot-engineer">by {slot.engineer_name}</p>
        )}
      </div>

      {/* Progress bar */}
      {slot.started_at && slot.completes_at && (
        <CraftProgress startedAt={slot.started_at} completesAt={slot.completes_at} />
      )}

      <div className="ws-slot-footer">
        <div className="ws-timer">
          <svg viewBox="0 0 24 24" className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" strokeLinecap="round" />
          </svg>
          {slot.completes_at && (
            <Countdown completesAt={slot.completes_at} onComplete={() => setIsReady(true)} />
          )}
        </div>
        <button
          className="ws-cancel-btn"
          onClick={() => slot.queue_id && onCancel(slot.queue_id)}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

function CraftProgress({ startedAt, completesAt }: { startedAt: number; completesAt: number }) {
  const total = completesAt - startedAt;
  const [pct, setPct] = useState(() => {
    const elapsed = Math.floor(Date.now() / 1000) - startedAt;
    return Math.min(100, (elapsed / total) * 100);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor(Date.now() / 1000) - startedAt;
      setPct(Math.min(100, (elapsed / total) * 100));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, total]);

  return (
    <div className="ws-progress-track">
      <div className="ws-progress-fill" style={{ width: `${pct}%` }} />
      <div className="ws-progress-pulse" style={{ left: `${pct}%` }} />
    </div>
  );
}

// ─── Build Modal ─────────────────────────────────────────────────────────────

function BuildModal({
  slotIndex,
  materials,
  partTemplates,
  engineers,
  onClose,
  onSuccess,
}: {
  slotIndex: number;
  materials: MaterialStock[];
  partTemplates: PartTemplate[];
  engineers: EngineerFull[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPart, setSelectedPart] = useState<PartTemplate | null>(null);
  const [selectedEngineer, setSelectedEngineer] = useState<EngineerFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const matMap = Object.fromEntries(materials.map((m) => [m.id, m.quantity]));
  const categories = ["all", ...Array.from(new Set(partTemplates.map((p) => p.category)))];
  const idleEngineers = engineers.filter((e) => e.status === "idle");

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function canAfford(part: PartTemplate): boolean {
    const ingredients = JSON.parse(part.recipe) as { material_id: number; qty: number }[];
    return ingredients.every((ing) => (matMap[ing.material_id] ?? 0) >= ing.qty);
  }

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 260);
  }

  async function handleConfirm() {
    if (!selectedPart) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workshop/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_template_id: selectedPart.id,
          slot_index: slotIndex,
          engineer_id: selectedEngineer?.id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start build");
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  const filteredParts = activeCategory === "all" ? partTemplates : partTemplates.filter((p) => p.category === activeCategory);

  return (
    <div
      className="ws-modal-backdrop"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="ws-modal-sheet"
        style={{
          transform: visible ? "translateY(0)" : "translateY(40px)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Red accent top line */}
        <div style={{ height: "2px", background: "linear-gradient(90deg, transparent, #e8001c 40%, #e8001c 60%, transparent)" }} />

        {/* Header */}
        <div className="ws-modal-header">
          <div>
            <p className="section-tag mb-0.5">SLOT {slotIndex + 1}</p>
            <h2 className="ws-modal-title">
              {step === 1 ? "SELECT PART" : "ASSIGN ENGINEER"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicators */}
            <div className="flex items-center gap-1.5">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className="ws-step-dot"
                  style={{
                    background: step >= s ? "#e8001c" : "rgba(255,255,255,0.1)",
                    boxShadow: step === s ? "0 0 6px #e8001c88" : "none",
                  }}
                />
              ))}
            </div>
            <button className="ws-modal-close" onClick={handleClose}>
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Step 1: Part selection */}
        {step === 1 && (
          <>
            {/* Category filter */}
            <div className="ws-cat-scroll">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className="ws-cat-btn"
                  style={{
                    color: activeCategory === cat ? "white" : "var(--color-text-muted)",
                    borderColor: activeCategory === cat ? "#e8001c" : "transparent",
                    background: activeCategory === cat ? "rgba(232,0,28,0.1)" : "transparent",
                  }}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === "all" ? "ALL" : categoryLabel(cat)}
                </button>
              ))}
            </div>

            <div className="ws-part-grid">
              {filteredParts.map((part) => {
                const affordable = canAfford(part);
                const ingredients = JSON.parse(part.recipe) as { material_id: number; qty: number }[];
                const isSelected = selectedPart?.id === part.id;

                return (
                  <button
                    key={part.id}
                    className="ws-part-card"
                    style={{
                      opacity: affordable ? 1 : 0.45,
                      borderColor: isSelected ? "#e8001c" : affordable ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                      background: isSelected ? "rgba(232,0,28,0.06)" : "rgba(255,255,255,0.02)",
                      boxShadow: isSelected ? "0 0 0 1px #e8001c44, inset 0 0 20px rgba(232,0,28,0.04)" : "none",
                    }}
                    onClick={() => setSelectedPart(isSelected ? null : part)}
                  >
                    {isSelected && <div className="ws-part-selected-corner" />}
                    <div className="ws-part-card-top">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CategoryIcon category={part.category} size={12} color={isSelected ? "#e8001c" : "#666"} />
                        <span className="ws-part-name">{part.name}</span>
                      </div>
                    </div>
                    <div className="ws-part-craft-time">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l2.5 2.5" strokeLinecap="round" />
                      </svg>
                      {formatCraftTime(part.craft_time)}
                    </div>
                    <div className="ws-part-mats">
                      {ingredients.map((ing) => {
                        const mat = materials.find((m) => m.id === ing.material_id);
                        const have = matMap[ing.material_id] ?? 0;
                        const ok = have >= ing.qty;
                        return (
                          <span
                            key={ing.material_id}
                            className="ws-mat-req"
                            style={{ color: ok ? "var(--color-text-muted)" : "#f87171" }}
                          >
                            {mat?.name.split(" ")[0] ?? `M${ing.material_id}`} ×{ing.qty}
                            {!ok && <span style={{ color: "#f8717188", marginLeft: 2 }}>({have})</span>}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="ws-modal-footer">
              {error && <p className="ws-error">{error}</p>}
              <div className="flex gap-2">
                <button className="btn-secondary text-xs flex-1" onClick={handleClose}>CANCEL</button>
                <button
                  className="btn-primary text-xs flex-1"
                  disabled={!selectedPart}
                  style={{ opacity: selectedPart ? 1 : 0.4 }}
                  onClick={() => setStep(2)}
                >
                  NEXT: ENGINEER
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Engineer selection */}
        {step === 2 && (
          <>
            <div className="ws-modal-body">
              {/* Selected part summary */}
              {selectedPart && (
                <div className="ws-part-summary">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={selectedPart.category} size={12} color="#e8001c" />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "white" }}>{selectedPart.name}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-text-muted)" }}>
                    {formatCraftTime(selectedPart.craft_time)} base
                  </span>
                </div>
              )}

              <p className="ws-modal-section-label mt-4">ASSIGN ENGINEER <span style={{ color: "var(--color-text-subtle)", marginLeft: 8 }}>OPTIONAL</span></p>

              {idleEngineers.length === 0 ? (
                <div className="ws-empty-small">No idle engineers available</div>
              ) : (
                <div className="ws-eng-select-grid">
                  {idleEngineers.map((eng) => {
                    const cfg = RARITY_CONFIG[eng.rarity];
                    const isSelected = selectedEngineer?.id === eng.id;
                    return (
                      <button
                        key={eng.id}
                        className="ws-eng-select-card"
                        style={{
                          borderColor: isSelected ? cfg.accent : "rgba(255,255,255,0.08)",
                          background: isSelected ? cfg.accent + "0a" : "rgba(255,255,255,0.02)",
                          boxShadow: isSelected ? `0 0 0 1px ${cfg.accent}44` : "none",
                        }}
                        onClick={() => setSelectedEngineer(isSelected ? null : eng)}
                      >
                        <div className="ws-eng-select-portrait">
                          <Image src="/assets/drivers/placeholder-3x4.svg" alt={eng.name} fill className="object-cover" style={{ opacity: 0.3 }} sizes="40px" />
                          <div className="ws-eng-select-overlay" style={{ background: cfg.accent + "22" }} />
                        </div>
                        <div className="ws-eng-select-info">
                          <p className="ws-eng-select-name">{eng.nickname ?? eng.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: cfg.accent }}>{cfg.label[0]}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)" }}>LV{eng.level}</span>
                          </div>
                          <div className="ws-eng-select-stats">
                            <span style={{ color: "#4ade80" }}>⚡{eng.craft_speed}</span>
                            <span style={{ color: "#60a5fa" }}>★{eng.quality_bonus}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="ws-eng-check">
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedPart && selectedEngineer && (
                <div className="ws-time-preview">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)", letterSpacing: "0.1em" }}>ESTIMATED TIME</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "#4ade80" }}>
                    {formatCraftTime(Math.max(30, Math.round(selectedPart.craft_time * (1 - Math.min(0.75, (selectedEngineer.craft_speed / 10) * 0.05)))))}
                  </span>
                </div>
              )}
            </div>

            <div className="ws-modal-footer">
              {error && <p className="ws-error">{error}</p>}
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" onClick={() => { setStep(1); setError(null); }}>BACK</button>
                <button
                  className="btn-primary text-xs flex-1"
                  disabled={loading}
                  onClick={handleConfirm}
                >
                  {loading ? "STARTING..." : selectedEngineer ? `START WITH ${(selectedEngineer.nickname ?? selectedEngineer.name).toUpperCase().split(" ")[0]}` : "START BUILD"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Engineer Card ────────────────────────────────────────────────────────────

function EngineerCard({ engineer, index, onClick }: { engineer: EngineerFull; index: number; onClick: () => void }) {
  const cfg = RARITY_CONFIG[engineer.rarity];
  const displayName = engineer.nickname ?? engineer.name;
  const statusColor = engineer.status === "idle" ? "#4ade80" : engineer.status === "crafting" ? "#60a5fa" : "#f97316";

  return (
    <button
      className="ws-eng-card"
      style={{
        "--rarity-accent": cfg.accent,
        "--rarity-border": cfg.border,
        animationDelay: `${index * 40}ms`,
      } as React.CSSProperties}
      onClick={onClick}
    >
      {cfg.shimmer && <div className="ws-shimmer" aria-hidden />}
      <div className="ws-eng-portrait">
        <div className="absolute inset-0 ws-carbon" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 90%, ${cfg.glow} 0%, transparent 70%)` }} />
        <div className="absolute inset-0">
          <Image src="/assets/drivers/placeholder-3x4.svg" alt={displayName} fill className="object-cover object-top" style={{ opacity: 0.3 }} sizes="(max-width: 640px) 33vw, 16vw" />
        </div>
        <div className="absolute top-2 right-2 z-20">
          <span className="ws-status-pip" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
        </div>
        <div className="absolute top-2 left-2 z-20">
          <span className="ws-rarity-pip" style={{ background: cfg.accent + "22", borderColor: cfg.accent + "66", color: cfg.accent }}>
            {cfg.label[0]}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-2/3" style={{ background: "linear-gradient(to top, #111111 0%, rgba(17,17,17,0.6) 50%, transparent 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
          <p className="ws-eng-card-name">{displayName.toUpperCase()}</p>
        </div>
      </div>
      <div className="ws-eng-card-footer">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--color-text-muted)" }}>LV.{engineer.level}</span>
        <div className="flex gap-0.5">
          {[engineer.craft_speed, engineer.quality_bonus, engineer.race_bonus].map((val, i) => (
            <div key={i} className="ws-stat-pip" style={{
              background: val >= 75 ? cfg.accent : val >= 50 ? cfg.accent + "55" : "rgba(255,255,255,0.08)",
            }} />
          ))}
        </div>
      </div>
      <div className="ws-card-hover-border" />
    </button>
  );
}

// ─── Engineer Modal ───────────────────────────────────────────────────────────

function EngineerModal({ engineer, onClose }: { engineer: EngineerFull; onClose: () => void }) {
  const cfg = RARITY_CONFIG[engineer.rarity];
  const displayName = engineer.nickname ?? engineer.name;
  const [visible, setVisible] = useState(false);
  const [animated, setAnimated] = useState(false);
  const statusColor = engineer.status === "idle" ? "#4ade80" : engineer.status === "crafting" ? "#60a5fa" : "#f97316";
  const statusLabel = engineer.status.toUpperCase();

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10);
    const t2 = setTimeout(() => setAnimated(true), 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const xpProgress = Math.min((engineer.xp % 1000) / 10, 100);

  return (
    <div
      className="ws-modal-backdrop"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="ws-modal-sheet"
        style={{
          "--rarity-accent": cfg.accent,
          "--rarity-border": cfg.border,
          transform: visible ? "translateY(0)" : "translateY(40px)",
          transition: "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
          borderColor: cfg.border,
        } as React.CSSProperties}
      >
        <div style={{ height: "2px", background: `linear-gradient(90deg, transparent 0%, ${cfg.accent} 40%, ${cfg.accent} 60%, transparent 100%)` }} />
        {cfg.shimmer && <div className="ws-modal-shimmer" aria-hidden />}

        <div className="ws-modal-hero">
          <div className="ws-modal-portrait">
            <div className="absolute inset-0 ws-carbon" style={{ opacity: 0.4 }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 80%, ${cfg.glow} 0%, transparent 65%)` }} />
            <Image src="/assets/drivers/placeholder-3x4.svg" alt={displayName} fill className="object-cover object-top" style={{ opacity: 0.3 }} sizes="130px" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent 40%, #111111 100%), linear-gradient(to top, #111111 0%, transparent 30%)" }} />
          </div>

          <div className="ws-modal-identity">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`badge ${cfg.cls}`} style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em" }}>{cfg.label}</span>
              <span className="ws-status-tag" style={{ color: statusColor, background: statusColor + "18", borderColor: statusColor + "33" }}>
                <span className="inline-block rounded-full mr-1" style={{ width: 5, height: 5, background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                {statusLabel}
              </span>
            </div>
            <h2 className="ws-modal-name" style={{ color: "white" }}>{displayName.toUpperCase()}</h2>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>
              {engineer.nationality} · LV.{engineer.level}
            </p>
            <div className="mt-3">
              <div className="flex justify-between mb-1">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em", color: "var(--color-text-subtle)", textTransform: "uppercase" }}>XP to next level</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: cfg.accent }}>{engineer.xp.toLocaleString()}</span>
              </div>
              <div style={{ height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: animated ? `${xpProgress}%` : "0%", background: `linear-gradient(90deg, ${cfg.accent}88, ${cfg.accent})`, transition: "width 1s cubic-bezier(0.16,1,0.3,1) 0.3s" }} />
              </div>
            </div>
          </div>

          <button className="ws-modal-close" onClick={handleClose} aria-label="Close">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <div style={{ height: "1px", background: "var(--color-border)", margin: "0 16px" }} />

        <div className="ws-modal-body-grid">
          <div className="ws-modal-stats-col">
            <p className="ws-modal-section-label">Workshop Stats</p>
            <div className="space-y-3">
              {[
                { label: "CRAFT SPEED", value: engineer.craft_speed, color: "#4ade80" },
                { label: "QUALITY BONUS", value: engineer.quality_bonus, color: "#60a5fa" },
                { label: "RACE BONUS", value: engineer.race_bonus, color: "#e8001c" },
              ].map((stat, si) => (
                <div key={stat.label}>
                  <div className="flex justify-between mb-1.5">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>{stat.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: stat.value >= 75 ? stat.color : stat.color + "99" }}>{stat.value}</span>
                  </div>
                  <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: animated ? `${stat.value}%` : "0%",
                      background: `linear-gradient(90deg, ${stat.color}88, ${stat.color})`,
                      transition: `width 0.8s cubic-bezier(0.16,1,0.3,1) ${si * 0.08 + 0.1}s`,
                      boxShadow: stat.value >= 85 ? `0 0 8px ${stat.color}66` : "none",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ws-modal-info-col">
            {engineer.bio && (
              <div>
                <p className="ws-modal-section-label">Profile</p>
                <p style={{ fontSize: "13px", lineHeight: 1.7, color: "var(--color-text-muted)" }}>{engineer.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Part Card ─────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
  common: "#888", rare: "#3b82f6", epic: "#a855f7", legendary: "#c9a84c", mythical: "#e8001c",
};

function InventoryCard({ part, index }: { part: InventoryPart; index: number }) {
  const rarityColor = RARITY_COLORS[part.rarity] ?? "#888";
  const activeStats = [
    { label: "SPD", value: part.stat_speed },
    { label: "ACC", value: part.stat_acceleration },
    { label: "HDL", value: part.stat_handling },
    { label: "STB", value: part.stat_stability },
    { label: "DUR", value: part.stat_durability },
    { label: "WGT", value: part.stat_weight },
    { label: "BRK", value: part.stat_braking },
    { label: "CTL", value: part.stat_control },
    { label: "SFT", value: part.stat_shift_speed },
    { label: "EFF", value: part.stat_efficiency },
    { label: "GRP", value: part.stat_grip },
    { label: "CRN", value: part.stat_cornering },
  ].filter((s) => s.value > 0);

  return (
    <div className="ws-inv-card" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="ws-inv-card-header">
        <div className="ws-inv-cat-badge">
          <CategoryIcon category={part.category} size={10} color="#666" />
          <span>{categoryLabel(part.category)}</span>
        </div>
        <span className="ws-inv-tier" style={{ color: rarityColor, textTransform: "uppercase", fontSize: "9px" }}>{part.rarity}</span>
      </div>
      <p className="ws-inv-name">{part.name}</p>
      <div className="ws-inv-stats">
        {activeStats.map((s) => (
          <div key={s.label} className="ws-inv-stat">
            <span className="ws-inv-stat-label">{s.label}</span>
            <span className="ws-inv-stat-val" style={{ color: rarityColor }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Upgrade Card ─────────────────────────────────────────────────────────────

function UpgradeCard({ field, currentLevel, credits, onUpgrade, loading }: {
  field: string;
  currentLevel: number;
  credits: number;
  onUpgrade: (field: string) => void;
  loading: boolean;
}) {
  const meta = UPGRADE_META[field];
  if (!meta) return null;
  const isMax = currentLevel >= meta.maxLevel;
  const cost = isMax ? 0 : upgradeCost(field, currentLevel);
  const canAfford = credits >= cost;

  return (
    <div className="ws-upgrade-card" style={{ opacity: isMax ? 0.6 : 1 }}>
      <div className="ws-upgrade-card-inner">
        <div className="ws-upgrade-icon">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={meta.icon} />
          </svg>
        </div>
        <div className="ws-upgrade-info">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="ws-upgrade-name">{meta.label}</span>
            <span className="ws-upgrade-value">{meta.valueLabel(currentLevel)}</span>
          </div>
          <p className="ws-upgrade-desc">{meta.description}</p>
          <div className="ws-upgrade-progress">
            {Array.from({ length: meta.maxLevel }, (_, i) => (
              <div
                key={i}
                className="ws-upgrade-pip"
                style={{
                  background: i < currentLevel ? "#e8001c" : "rgba(255,255,255,0.08)",
                  boxShadow: i === currentLevel - 1 ? "0 0 4px #e8001c88" : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="ws-upgrade-action">
        {isMax ? (
          <span className="ws-max-badge">MAX</span>
        ) : (
          <button
            className="ws-upgrade-btn"
            disabled={!canAfford || loading}
            onClick={() => onUpgrade(field)}
            style={{
              background: canAfford ? "#e8001c" : "rgba(255,255,255,0.04)",
              color: canAfford ? "white" : "var(--color-text-muted)",
              cursor: canAfford && !loading ? "pointer" : "not-allowed",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {canAfford
              ? `${cost.toLocaleString()} CR`
              : `NEED ${cost.toLocaleString()} CR`
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WorkshopClient({ data }: { data: WorkshopPageData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("DEVELOP");
  const [buildModalSlot, setBuildModalSlot] = useState<number | null>(null);
  const [selectedEngineer, setSelectedEngineer] = useState<EngineerFull | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [invFilter, setInvFilter] = useState<string>("all");
  const [credits, setCredits] = useState(data.credits);

  useEffect(() => { setCredits(data.credits); }, [data.credits]);

  const handleClaim = useCallback(async (queueId: number) => {
    const res = await fetch("/api/workshop/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue_id: queueId }),
    });
    if (res.ok) router.refresh();
  }, [router]);

  const handleCancel = useCallback(async (queueId: number) => {
    const res = await fetch("/api/workshop/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue_id: queueId }),
    });
    if (res.ok) router.refresh();
  }, [router]);

  const handleUpgrade = useCallback(async (field: string) => {
    setUpgradeLoading(true);
    const res = await fetch("/api/workshop/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field }),
    });
    if (res.ok) {
      const json = await res.json();
      setCredits((c) => c - (json.cost_paid ?? 0));
      router.refresh();
    }
    setUpgradeLoading(false);
  }, [router]);

  const invCategories = ["all", ...Array.from(new Set(data.inventory.map((p) => p.category)))];
  const filteredInventory = invFilter === "all" ? data.inventory : data.inventory.filter((p) => p.category === invFilter);

  return (
    <>
      <style>{WORKSHOP_STYLES}</style>

      <div className="md:ml-16 pb-20 md:pb-6">
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">

          {/* Page Header */}
          <div className="mb-5 animate-fade-up">
            <p className="section-tag mb-1">Manufacturing</p>
            <div className="flex items-end justify-between gap-4">
              <h1 className="text-white leading-none" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 6vw, 48px)", letterSpacing: "0.04em" }}>
                WORKSHOP
              </h1>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>
                {data.craftSlots.filter((s) => s.status !== "idle").length}/{data.upgrades.develop_slots} ACTIVE
              </span>
            </div>
            <span className="accent-line mt-3" />
          </div>

          {/* Tab Bar */}
          <div className="ws-tabs animate-fade-up animate-delay-100">
            {TABS.map((tab) => (
              <button
                key={tab}
                className="ws-tab"
                style={{
                  color: activeTab === tab ? "white" : "var(--color-text-muted)",
                  borderBottom: activeTab === tab ? "2px solid #e8001c" : "2px solid transparent",
                  background: activeTab === tab ? "rgba(232,0,28,0.04)" : "transparent",
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── DEVELOP TAB ─────────────────────────────── */}
          {activeTab === "DEVELOP" && (
            <div className="animate-fade-up">
              <MaterialsStrip materials={data.materials} />
              <div className="ws-slots-grid">
                {data.craftSlots.map((slot, i) => (
                  <CraftSlotCard
                    key={slot.slot_index}
                    slot={slot}
                    index={i}
                    onStartBuild={(idx) => setBuildModalSlot(idx)}
                    onClaim={handleClaim}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── ENGINEERS TAB ───────────────────────────── */}
          {activeTab === "ENGINEERS" && (
            <div className="animate-fade-up">
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {data.engineers.length} / {data.upgrades.engineer_cap} ENGINEERS
                </span>
                {(["legendary", "epic", "rare", "common"] as const).map((r) => {
                  const count = data.engineers.filter((e) => e.rarity === r).length;
                  if (!count) return null;
                  const cfg = RARITY_CONFIG[r];
                  return (
                    <div key={r} className="flex items-center gap-1">
                      <span className={`badge ${cfg.cls} text-[9px]`} style={{ fontFamily: "var(--font-mono)" }}>{cfg.label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-text-muted)" }}>×{count}</span>
                    </div>
                  );
                })}
              </div>

              {data.engineers.length === 0 ? (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon">
                    <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M32 20a8 8 0 100 16 8 8 0 000-16z" />
                      <path d="M20 50 Q20 40 32 40 Q44 40 44 50" />
                      <path d="M14 32h-4M54 32h-4M32 14v-4M32 54v-4" />
                    </svg>
                  </div>
                  <p className="ws-empty-title">NO ENGINEERS</p>
                  <p className="ws-empty-sub">Recruit engineers from the market to speed up crafting.</p>
                </div>
              ) : (
                <div className="ws-eng-grid">
                  {data.engineers.map((eng, i) => (
                    <EngineerCard key={eng.id} engineer={eng} index={i} onClick={() => setSelectedEngineer(eng)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INVENTORY TAB ───────────────────────────── */}
          {activeTab === "INVENTORY" && (
            <div className="animate-fade-up">
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {data.inventory.length} / {data.upgrades.inventory_size * 5 + 15} PARTS
                </span>
              </div>

              {/* Category filter */}
              <div className="ws-cat-scroll mb-4">
                {invCategories.map((cat) => (
                  <button
                    key={cat}
                    className="ws-cat-btn"
                    style={{
                      color: invFilter === cat ? "white" : "var(--color-text-muted)",
                      borderColor: invFilter === cat ? "#e8001c" : "transparent",
                      background: invFilter === cat ? "rgba(232,0,28,0.1)" : "transparent",
                    }}
                    onClick={() => setInvFilter(cat)}
                  >
                    {cat === "all" ? "ALL" : categoryLabel(cat)}
                  </button>
                ))}
              </div>

              {filteredInventory.length === 0 ? (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon">
                    <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="12" y="20" width="40" height="30" rx="1" />
                      <path d="M20 20v-4a4 4 0 018 0v4M36 20v-4a4 4 0 018 0v4" />
                    </svg>
                  </div>
                  <p className="ws-empty-title">
                    {invFilter === "all" ? "INVENTORY EMPTY" : `NO ${invFilter.toUpperCase()} PARTS`}
                  </p>
                  <p className="ws-empty-sub">Craft parts in the Develop tab to fill your inventory.</p>
                </div>
              ) : (
                <div className="ws-inv-grid">
                  {filteredInventory.map((part, i) => (
                    <InventoryCard key={part.id} part={part} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── UPGRADES TAB ────────────────────────────── */}
          {activeTab === "UPGRADES" && (
            <div className="animate-fade-up">
              {/* Credits display */}
              <div className="ws-credits-bar">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#c9a84c" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9 12h6M12 9v6" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", color: "var(--color-text-muted)" }}>AVAILABLE CREDITS</span>
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.04em", color: "#c9a84c" }}>
                  {credits.toLocaleString()}
                </span>
              </div>

              <div className="ws-upgrades-list">
                {Object.keys(UPGRADE_META).map((field) => (
                  <UpgradeCard
                    key={field}
                    field={field}
                    currentLevel={data.upgrades[field as keyof WorkshopUpgrades] as number}
                    credits={credits}
                    onUpgrade={handleUpgrade}
                    loading={upgradeLoading}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Build Modal */}
      {buildModalSlot !== null && (
        <BuildModal
          slotIndex={buildModalSlot}
          materials={data.materials}
          partTemplates={data.partTemplates}
          engineers={data.engineers}
          onClose={() => setBuildModalSlot(null)}
          onSuccess={() => { setBuildModalSlot(null); router.refresh(); }}
        />
      )}

      {/* Engineer Detail Modal */}
      {selectedEngineer && (
        <EngineerModal engineer={selectedEngineer} onClose={() => setSelectedEngineer(null)} />
      )}
    </>
  );
}

// ─── Component-scoped CSS ────────────────────────────────────────────────────
const WORKSHOP_STYLES = `
  /* ── Tab bar ─────────────────────────────────── */
  .ws-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 20px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .ws-tabs::-webkit-scrollbar { display: none; }
  .ws-tab {
    flex-shrink: 0;
    padding: 10px 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  /* ── Materials Strip ─────────────────────────── */
  .ws-materials-strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .ws-materials-strip::-webkit-scrollbar { display: none; }
  .ws-material-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: 1px solid;
    border-radius: 2px;
    background: rgba(255,255,255,0.02);
    flex-shrink: 0;
  }
  .ws-material-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .ws-material-name {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  .ws-material-qty {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    min-width: 1.8ch;
    text-align: right;
  }

  /* ── Craft Slots ─────────────────────────────── */
  .ws-slots-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @media (min-width: 480px) { .ws-slots-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 768px) { .ws-slots-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
  @media (min-width: 1024px) { .ws-slots-grid { grid-template-columns: repeat(3, 1fr); } }

  .ws-slot {
    position: relative;
    border-radius: 2px;
    overflow: hidden;
    min-height: 140px;
    animation: driverCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* Idle slot */
  .ws-slot-idle {
    border: 1px dashed rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.01);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s, background 0.2s;
    text-align: center;
    width: 100%;
  }
  .ws-slot-idle:hover {
    border-color: rgba(232,0,28,0.4);
    background: rgba(232,0,28,0.03);
  }
  .ws-slot-idle:hover .ws-slot-plus { color: #e8001c; border-color: rgba(232,0,28,0.4); }
  .ws-slot-idle-inner { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .ws-slot-plus {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 2px;
    color: var(--color-text-muted);
    transition: color 0.2s, border-color 0.2s;
  }
  .ws-slot-idle-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }
  .ws-slot-num {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.1em;
    color: var(--color-text-subtle);
    position: absolute;
    top: 8px;
    right: 10px;
  }
  .ws-slot-idle-border {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    box-shadow: inset 0 0 0 1px rgba(232,0,28,0.4);
    transition: opacity 0.25s;
  }
  .ws-slot-idle:hover .ws-slot-idle-border { opacity: 1; }

  /* Crafting slot */
  .ws-slot-crafting {
    background: var(--color-surface);
    border: 1px solid rgba(232,0,28,0.2);
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 8px;
  }
  .ws-slot-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ws-crafting-badge {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.12em;
    color: #e8001c;
    background: rgba(232,0,28,0.1);
    border: 1px solid rgba(232,0,28,0.25);
    padding: 2px 6px;
    border-radius: 1px;
  }
  .ws-slot-body { flex: 1; }
  .ws-slot-part-name {
    font-family: var(--font-mono);
    font-size: 11px;
    color: white;
    letter-spacing: 0.04em;
  }
  .ws-slot-engineer {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
  .ws-slot-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
  }
  .ws-timer {
    display: flex;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #e8001c;
    letter-spacing: 0.06em;
  }
  .ws-cancel-btn {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.1em;
    color: var(--color-text-muted);
    background: transparent;
    border: 1px solid var(--color-border);
    padding: 3px 8px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    border-radius: 1px;
  }
  .ws-cancel-btn:hover { color: #f87171; border-color: rgba(248,113,113,0.4); }

  /* Progress bar */
  .ws-progress-track {
    position: relative;
    height: 2px;
    background: rgba(255,255,255,0.06);
    border-radius: 1px;
    overflow: visible;
  }
  .ws-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #e8001c88, #e8001c);
    border-radius: 1px;
    transition: width 1s linear;
  }
  .ws-progress-pulse {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: #e8001c;
    border-radius: 50%;
    box-shadow: 0 0 8px #e8001c;
    animation: pulseDot 1.5s ease-in-out infinite;
  }
  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.7); }
  }

  /* Completed slot */
  .ws-slot-complete {
    background: var(--color-surface);
    border: 1px solid rgba(74,222,128,0.25);
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 8px;
  }
  .ws-slot-complete-glow {
    position: absolute;
    top: 0; left: 0; right: 0; height: 60px;
    background: radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .ws-slot-done-badge {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.12em;
    color: #4ade80;
    background: rgba(74,222,128,0.1);
    border: 1px solid rgba(74,222,128,0.3);
    padding: 2px 6px;
    border-radius: 1px;
    animation: readyPulse 2s ease-in-out infinite;
  }
  @keyframes readyPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .ws-claim-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    width: 100%;
    padding: 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #4ade80;
    background: rgba(74,222,128,0.08);
    border: 1px solid rgba(74,222,128,0.3);
    cursor: pointer;
    border-radius: 1px;
    transition: background 0.15s, box-shadow 0.15s;
    margin-top: auto;
  }
  .ws-claim-btn:hover { background: rgba(74,222,128,0.15); box-shadow: 0 0 12px rgba(74,222,128,0.15); }

  /* ── Engineer Grid ───────────────────────────── */
  .ws-eng-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  @media (min-width: 480px) { .ws-eng-grid { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 768px) { .ws-eng-grid { grid-template-columns: repeat(5, 1fr); gap: 12px; } }
  @media (min-width: 1024px) { .ws-eng-grid { grid-template-columns: repeat(6, 1fr); } }

  /* Engineer Card */
  .ws-eng-card {
    position: relative;
    background: #111111;
    border: 1px solid var(--rarity-border, rgba(255,255,255,0.1));
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
  .ws-eng-card:hover {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px var(--rarity-accent, rgba(255,255,255,0.15));
  }
  .ws-eng-portrait {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background: #0a0a0a;
    overflow: hidden;
  }
  .ws-eng-card-footer {
    padding: 6px 8px 7px;
    background: #111111;
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ws-eng-card-name {
    font-family: var(--font-display);
    font-size: clamp(10px, 2vw, 13px);
    letter-spacing: 0.08em;
    color: white;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ws-status-pip {
    display: block;
    width: 7px; height: 7px;
    border-radius: 50%;
  }
  .ws-rarity-pip {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px;
    font-family: var(--font-mono); font-size: 8px; font-weight: 600;
    border: 1px solid; border-radius: 2px;
  }
  .ws-stat-pip {
    width: 5px; height: 5px; border-radius: 1px;
    transition: background 0.2s;
  }
  .ws-shimmer {
    position: absolute; inset: 0; z-index: 30; pointer-events: none;
    background: linear-gradient(105deg, transparent 30%, rgba(201,168,76,0.07) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: shimmerSweep 3.5s ease-in-out infinite;
  }
  .ws-card-hover-border {
    position: absolute; inset: 0; pointer-events: none;
    opacity: 0; box-shadow: inset 0 0 0 1px var(--rarity-accent);
    transition: opacity 0.25s ease; border-radius: 2px;
  }
  .ws-eng-card:hover .ws-card-hover-border { opacity: 0.5; }
  .ws-carbon {
    background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px);
  }

  /* ── Inventory Grid ──────────────────────────── */
  .ws-inv-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  @media (min-width: 480px) { .ws-inv-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 768px) { .ws-inv-grid { grid-template-columns: repeat(3, 1fr); } }

  .ws-inv-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    padding: 12px;
    animation: driverCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: border-color 0.2s;
  }
  .ws-inv-card:hover { border-color: var(--color-border-strong); }
  .ws-inv-card-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 6px;
  }
  .ws-inv-cat-badge {
    display: flex; align-items: center; gap: 4px;
    font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em;
    color: var(--color-text-muted); text-transform: uppercase;
  }
  .ws-inv-tier {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--color-text-muted); letter-spacing: 0.06em;
  }
  .ws-inv-qty {
    font-family: var(--font-mono); font-size: 10px;
    color: white; background: rgba(255,255,255,0.08);
    padding: 1px 5px; border-radius: 1px; letter-spacing: 0.04em;
  }
  .ws-inv-name {
    font-family: var(--font-mono); font-size: 11px;
    color: white; letter-spacing: 0.04em;
    margin-bottom: 8px; line-height: 1.3;
  }
  .ws-inv-quality {
    display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
  }
  .ws-inv-quality-track {
    flex: 1; height: 2px;
    background: rgba(255,255,255,0.06); border-radius: 1px; overflow: hidden;
  }
  .ws-inv-quality-fill {
    height: 100%; border-radius: 1px; transition: width 0.5s ease;
  }
  .ws-inv-stats {
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .ws-inv-stat {
    display: flex; flex-direction: column; align-items: center;
    min-width: 28px;
  }
  .ws-inv-stat-label {
    font-family: var(--font-mono); font-size: 8px;
    color: var(--color-text-subtle); letter-spacing: 0.08em;
  }
  .ws-inv-stat-val {
    font-family: var(--font-mono); font-size: 11px;
    color: var(--color-text-muted);
  }

  /* ── Category Filter ─────────────────────────── */
  .ws-cat-scroll {
    display: flex; gap: 4px;
    overflow-x: auto; scrollbar-width: none;
    padding-bottom: 4px;
  }
  .ws-cat-scroll::-webkit-scrollbar { display: none; }
  .ws-cat-btn {
    flex-shrink: 0;
    padding: 5px 10px;
    font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em;
    border: 1px solid transparent;
    border-radius: 1px;
    cursor: pointer; transition: all 0.15s;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ── Upgrades ────────────────────────────────── */
  .ws-credits-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: rgba(201,168,76,0.04);
    border: 1px solid rgba(201,168,76,0.15);
    border-radius: 2px;
    margin-bottom: 16px;
  }
  .ws-upgrades-list { display: flex; flex-direction: column; gap: 8px; }
  .ws-upgrade-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    padding: 14px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
    transition: border-color 0.2s;
  }
  .ws-upgrade-card:hover { border-color: var(--color-border-strong); }
  .ws-upgrade-card-inner { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
  .ws-upgrade-icon {
    width: 36px; height: 36px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    color: var(--color-text-muted);
  }
  .ws-upgrade-info { flex: 1; min-width: 0; }
  .ws-upgrade-name {
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.1em; color: white; text-transform: uppercase;
  }
  .ws-upgrade-value {
    font-family: var(--font-mono); font-size: 10px;
    color: #e8001c; letter-spacing: 0.08em; flex-shrink: 0;
  }
  .ws-upgrade-desc {
    font-size: 11px; color: var(--color-text-muted); line-height: 1.5; margin-top: 2px;
  }
  .ws-upgrade-progress {
    display: flex; gap: 3px; margin-top: 8px; flex-wrap: wrap;
  }
  .ws-upgrade-pip {
    width: 10px; height: 3px; border-radius: 1px;
    transition: background 0.2s;
  }
  .ws-upgrade-action { flex-shrink: 0; }
  .ws-upgrade-btn {
    padding: 7px 12px;
    font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em;
    border: none; border-radius: 1px;
    clip-path: polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%);
    transition: opacity 0.15s, box-shadow 0.15s;
    white-space: nowrap;
  }
  .ws-upgrade-btn:not(:disabled):hover { box-shadow: 0 0 12px rgba(232,0,28,0.3); }
  .ws-max-badge {
    display: inline-block; padding: 6px 10px;
    font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em;
    color: #c9a84c; background: rgba(201,168,76,0.1);
    border: 1px solid rgba(201,168,76,0.25); border-radius: 1px;
  }

  /* ── Modal ───────────────────────────────────── */
  .ws-modal-backdrop {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: flex-end; justify-content: center;
    background: rgba(0,0,0,0.88); backdrop-filter: blur(4px);
  }
  @media (min-width: 768px) {
    .ws-modal-backdrop { align-items: center; padding: 24px; }
  }
  .ws-modal-sheet {
    position: relative; width: 100%;
    background: #111111; border: 1px solid var(--color-border);
    border-bottom: none; border-radius: 4px 4px 0 0;
    max-height: 94dvh; overflow-y: auto; overflow-x: hidden;
    scrollbar-width: thin;
  }
  @media (min-width: 768px) {
    .ws-modal-sheet {
      max-width: 680px; border-bottom: 1px solid var(--color-border);
      border-radius: 4px; max-height: 90dvh;
    }
  }
  .ws-modal-shimmer {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: linear-gradient(105deg, transparent 20%, rgba(201,168,76,0.04) 50%, transparent 80%);
    background-size: 300% 100%; animation: shimmerSweep 4s ease-in-out infinite;
  }
  @keyframes shimmerSweep {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .ws-modal-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--color-border);
  }
  @media (min-width: 640px) { .ws-modal-header { padding: 20px 24px 16px; } }
  .ws-modal-title {
    font-family: var(--font-display); font-size: clamp(20px, 5vw, 28px);
    letter-spacing: 0.06em; color: white; line-height: 1;
  }
  .ws-modal-close {
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: 2px;
    background: transparent; cursor: pointer; transition: color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .ws-modal-close:hover { color: white; border-color: rgba(255,255,255,0.25); }
  .ws-step-dot { width: 6px; height: 6px; border-radius: 50%; transition: background 0.2s, box-shadow 0.2s; }
  .ws-modal-body { padding: 16px; }
  @media (min-width: 640px) { .ws-modal-body { padding: 20px 24px; } }
  .ws-modal-section-label {
    font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--color-text-subtle); margin-bottom: 10px; display: block;
  }
  .ws-modal-footer {
    padding: 12px 16px 16px; border-top: 1px solid var(--color-border);
    position: sticky; bottom: 0; background: #111111;
  }
  @media (min-width: 640px) { .ws-modal-footer { padding: 16px 24px 20px; } }

  /* Part grid in modal */
  .ws-part-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 12px 16px;
    max-height: 50vh; overflow-y: auto; scrollbar-width: thin;
  }
  @media (min-width: 480px) { .ws-part-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 640px) { .ws-part-grid { padding: 16px 24px; } }
  .ws-part-card {
    position: relative;
    border: 1px solid; border-radius: 2px;
    padding: 10px; cursor: pointer; text-align: left;
    transition: all 0.15s;
  }
  .ws-part-card:hover { transform: translateY(-1px); }
  .ws-part-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 4px; margin-bottom: 4px; }
  .ws-part-name {
    font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.04em;
    color: white; line-height: 1.3; text-align: left; flex: 1; min-width: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ws-part-tier {
    font-family: var(--font-mono); font-size: 8px; color: #e8001c;
    flex-shrink: 0; letter-spacing: 0.06em;
  }
  .ws-part-craft-time {
    display: flex; align-items: center;
    font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);
    margin-bottom: 6px; letter-spacing: 0.04em;
  }
  .ws-part-mats { display: flex; flex-direction: column; gap: 2px; }
  .ws-mat-req {
    font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.04em; line-height: 1.4;
  }
  .ws-part-selected-corner {
    position: absolute; top: 0; right: 0;
    width: 0; height: 0;
    border-style: solid; border-width: 0 16px 16px 0;
    border-color: transparent #e8001c transparent transparent;
  }
  .ws-part-summary {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; background: rgba(232,0,28,0.05);
    border: 1px solid rgba(232,0,28,0.15); border-radius: 1px;
  }
  .ws-error {
    font-family: var(--font-mono); font-size: 10px; color: #f87171;
    padding: 8px 10px; background: rgba(248,113,113,0.06);
    border: 1px solid rgba(248,113,113,0.2); border-radius: 1px; margin-bottom: 10px;
  }

  /* Engineer select in modal */
  .ws-eng-select-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
    max-height: 35vh; overflow-y: auto; scrollbar-width: thin;
  }
  @media (min-width: 480px) { .ws-eng-select-grid { grid-template-columns: repeat(3, 1fr); } }
  .ws-eng-select-card {
    display: flex; align-items: center; gap: 8px;
    padding: 8px; border: 1px solid; border-radius: 2px;
    cursor: pointer; transition: all 0.15s; position: relative;
    text-align: left;
  }
  .ws-eng-select-portrait {
    position: relative; width: 32px; height: 40px;
    background: #0a0a0a; border-radius: 1px; overflow: hidden; flex-shrink: 0;
  }
  .ws-eng-select-overlay { position: absolute; inset: 0; }
  .ws-eng-select-info { flex: 1; min-width: 0; }
  .ws-eng-select-name {
    font-family: var(--font-mono); font-size: 9px; color: white;
    letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ws-eng-select-stats {
    display: flex; gap: 6px; margin-top: 3px;
    font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.04em;
  }
  .ws-eng-check {
    position: absolute; top: 4px; right: 4px;
    width: 14px; height: 14px; background: #e8001c; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: white;
  }
  .ws-time-preview {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; margin-top: 12px;
    background: rgba(74,222,128,0.04); border: 1px solid rgba(74,222,128,0.15); border-radius: 1px;
  }
  .ws-empty-small {
    font-family: var(--font-mono); font-size: 10px; color: var(--color-text-muted);
    padding: 16px; text-align: center; letter-spacing: 0.08em;
    border: 1px dashed var(--color-border); border-radius: 2px;
  }

  /* ── Engineer Modal ─────────────────────────── */
  .ws-modal-hero {
    position: relative; display: flex; align-items: flex-start;
    gap: 16px; padding: 16px;
  }
  @media (min-width: 640px) { .ws-modal-hero { padding: 20px 24px; gap: 20px; } }
  .ws-modal-portrait {
    position: relative; flex-shrink: 0;
    width: 90px; height: 120px;
    background: #0a0a0a; border-radius: 2px; overflow: hidden;
  }
  @media (min-width: 640px) { .ws-modal-portrait { width: 130px; height: 172px; } }
  .ws-modal-identity { flex: 1; min-width: 0; padding-top: 2px; }
  .ws-modal-name {
    font-family: var(--font-display);
    font-size: clamp(22px, 5vw, 36px); letter-spacing: 0.04em; line-height: 1;
    margin-bottom: 4px;
  }
  .ws-status-tag {
    display: inline-flex; align-items: center;
    padding: 2px 8px; font-family: var(--font-mono); font-size: 9px;
    letter-spacing: 0.1em; border: 1px solid; border-radius: 1px;
  }
  .ws-modal-body-grid {
    display: grid; grid-template-columns: 1fr;
  }
  @media (min-width: 640px) { .ws-modal-body-grid { grid-template-columns: 1fr 1fr; } }
  .ws-modal-stats-col {
    padding: 16px; border-bottom: 1px solid var(--color-border);
  }
  @media (min-width: 640px) {
    .ws-modal-stats-col { border-bottom: none; border-right: 1px solid var(--color-border); padding: 20px 24px; }
  }
  .ws-modal-info-col { padding: 16px; }
  @media (min-width: 640px) { .ws-modal-info-col { padding: 20px 24px; } }

  /* ── Empty states ────────────────────────────── */
  .ws-empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 64px 16px; text-align: center;
  }
  .ws-empty-icon {
    width: 72px; height: 72px; display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--color-border); background: var(--color-surface);
    margin-bottom: 20px; position: relative; overflow: hidden;
  }
  .ws-empty-icon::before {
    content: ''; position: absolute; inset: 0;
    background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px);
  }
  .ws-empty-title {
    font-family: var(--font-display); font-size: 20px; letter-spacing: 0.1em;
    color: white; margin-bottom: 8px;
  }
  .ws-empty-sub { font-size: 13px; color: var(--color-text-muted); max-width: 260px; line-height: 1.7; }

  @keyframes driverCardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
