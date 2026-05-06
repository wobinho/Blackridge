"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { resolveArt } from "@/lib/resolveArt";
import type { RacePageData, RaceCircuit, UserDriver, UserEngineer, UserCar, ActiveRace } from "./page";

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const show = useCallback((msg: string, type: "error" | "success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<string, string> = {
  common: "#aaaaaa",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#c9a84c",
};

const DIFF_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%)",
  2: "linear-gradient(135deg, #1e2430 0%, #111820 100%)",
  3: "linear-gradient(135deg, #2a1a1a 0%, #150d0d 100%)",
  4: "linear-gradient(135deg, #3a1010 0%, #200808 100%)",
  5: "linear-gradient(135deg, #5a0808 0%, #2d0404 100%)",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}S RACE`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}M ${s}S RACE` : `${m} MIN RACE`;
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="race-diff-dot"
          style={{ background: i < level ? "#e8001c" : "rgba(255,255,255,0.15)" }}
        />
      ))}
    </div>
  );
}

// ─── Circuit Card ─────────────────────────────────────────────────────────────
function CircuitCard({
  circuit,
  onEnter,
  isActive,
  canAfford,
}: {
  circuit: RaceCircuit;
  onEnter: () => void;
  isActive: boolean;
  canAfford: boolean;
}) {
  // Parse first-place podium rewards for preview
  const podium1 = (() => {
    try {
      const arr = JSON.parse(circuit.podium_rewards) as Array<{
        position: number; credits_bonus: number; xgear_bonus: number; mat_count: number; prestige_bonus: number;
      }>;
      return arr.find((p) => p.position === 1) ?? null;
    } catch { return null; }
  })();

  const disabled = isActive || !canAfford;

  const circuitImgSrc = circuit.art
    ? `/assets/races/${circuit.art}.png`
    : null;

  return (
    <div className={`race-circuit-card ${isActive ? "race-circuit-active" : ""} ${!canAfford && !isActive ? "race-circuit-cant-afford" : ""}`}>
      {/* Circuit image section */}
      <div
        className="race-circuit-img-wrap"
        style={{ background: DIFF_GRADIENTS[circuit.difficulty] ?? DIFF_GRADIENTS[1] }}
      >
        {circuitImgSrc && (
          <Image
            src={circuitImgSrc}
            alt={circuit.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="race-circuit-img"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {/* Overlay gradient */}
        <div className="race-circuit-img-overlay" style={{ background: DIFF_GRADIENTS[circuit.difficulty] ?? DIFF_GRADIENTS[1] }} />

        {/* Badges row on top of image */}
        <div className="race-circuit-header-inner">
          <DifficultyDots level={circuit.difficulty} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="race-field-badge">{circuit.field_size} CARS</span>
            <span className="race-duration-badge">{formatDuration(circuit.duration_seconds)}</span>
          </div>
        </div>
        {/* Diagonal accent line */}
        <div className="race-circuit-slash" />
      </div>

      <div className="race-circuit-body">
        <div className="race-circuit-title-row">
          <div>
            <h3 className="race-circuit-name">{circuit.name}</h3>
            <p className="race-circuit-location">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "inline", marginRight: 4 }}>
                <circle cx="5" cy="4" r="2.5" stroke="#e8001c" strokeWidth="1.2" />
                <path d="M5 6.5 L5 9" stroke="#e8001c" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {circuit.location}
            </p>
          </div>
        </div>

        {circuit.description && (
          <p className="race-circuit-desc">{circuit.description}</p>
        )}

        {/* 1st place reward preview */}
        {podium1 && (
          <div className="race-podium-preview">
            <span className="race-podium-label">1ST PLACE</span>
            <div className="race-podium-rewards">
              {podium1.credits_bonus > 0 && (
                <span className="race-reward-cr">+{podium1.credits_bonus.toLocaleString()} CR</span>
              )}
              {podium1.xgear_bonus > 0 && (
                <span className="race-reward-xg">+{podium1.xgear_bonus} XG</span>
              )}
              {podium1.mat_count > 0 && (
                <span className="race-reward-mat">×{podium1.mat_count} MAT</span>
              )}
              {podium1.prestige_bonus > 0 && (
                <span className="race-reward-prestige">+{podium1.prestige_bonus} PST</span>
              )}
            </div>
          </div>
        )}

        {/* Entry cost + button */}
        <div className="race-entry-row">
          <div className="race-entry-cost">
            <span className="race-entry-cost-label">ENTRY</span>
            <span className={`race-entry-cost-val ${!canAfford ? "race-entry-cant" : ""}`}>
              {circuit.entry_cost.toLocaleString()} CR
            </span>
          </div>
          <button
            className={`race-enter-btn ${!canAfford && !isActive ? "race-enter-btn-broke" : ""}`}
            onClick={onEnter}
            disabled={disabled}
          >
            {isActive ? "RACING…" : !canAfford ? "INSUFFICIENT CR" : "ENTER RACE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Race Standings Modal ─────────────────────────────────────────────────────
type NpcEntry = {
  id: number; name: string;
  stat_speed: number; stat_acceleration: number; stat_handling: number; stat_stability: number;
  stat_durability: number; stat_weight: number; stat_braking: number; stat_control: number;
  stat_shift_speed: number; stat_efficiency: number; stat_grip: number; stat_cornering: number;
};
type StandingEntry = { label: string; isPlayer: boolean; score: number; position: number };

function npcPerformance(n: NpcEntry): number {
  return n.stat_speed + n.stat_acceleration + n.stat_handling + n.stat_stability
       + n.stat_durability + n.stat_weight + n.stat_braking + n.stat_control
       + n.stat_shift_speed + n.stat_efficiency + n.stat_grip + n.stat_cornering;
}

function makeSeededRand(seed: number) {
  return (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };
}

function RaceStandingsModal({
  race,
  serverNow,
  onClose,
}: {
  race: ActiveRace;
  serverNow: number;
  onClose: () => void;
}) {
  const totalSecs = race.completes_at - race.started_at;
  const elapsed = serverNow - race.started_at;
  const progress = Math.min(1, Math.max(0, elapsed / totalSecs));

  const npcs: NpcEntry[] = (() => {
    try { return JSON.parse(race.npc_field) as NpcEntry[]; } catch { return []; }
  })();

  const seededRand = useCallback(makeSeededRand(race.id * 13337), [race.id]);

  const [standings, setStandings] = useState<StandingEntry[]>(() => {
    const driverBoost = (race.driver_speed + race.driver_skill) * 0.12;
    const engBoost = race.engineer_bonus * 0.05;
    const playerRawScore = race.car_performance + driverBoost + engBoost;
    const entries: StandingEntry[] = [
      { label: `${race.car_name} · ${race.driver_name}`, isPlayer: true, score: playerRawScore, position: 0 },
      ...npcs.map((n) => ({
        label: n.name,
        isPlayer: false,
        score: npcPerformance(n),
        position: 0,
      })),
    ];
    return rank(entries);
  });

  function rank(entries: StandingEntry[]): StandingEntry[] {
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    return sorted.map((e, i) => ({ ...e, position: i + 1 }));
  }

  const progressPct = Math.round(progress * 100);
  const lap = Math.ceil(progress * (race.field_size > 6 ? 5 : 3));
  const totalLaps = race.field_size > 6 ? 5 : 3;

  return (
    <div className="standings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="standings-modal">
        {/* Header */}
        <div className="standings-header">
          <div className="standings-header-left">
            <div className="standings-circuit-name">{race.circuit_name}</div>
            <div className="standings-meta">
              LAP {Math.min(lap, totalLaps)}/{totalLaps}
              <span className="standings-meta-sep">·</span>
              {progressPct}% COMPLETE
            </div>
          </div>
          <div className="standings-header-right">
            <button className="standings-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="standings-progress-track">
          <div className="standings-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Live feed */}
        <div className="standings-body">
          <div className="standings-feed-label">
            <span className="standings-feed-dot" />
            LIVE STANDINGS
          </div>
          <div className="standings-list">
            {standings.map((entry, idx) => {
              const posLabel = `P${entry.position}`;
              const posColor = entry.position === 1 ? "#c9a84c" : entry.position === 2 ? "#b0bec5" : entry.position === 3 ? "#cd7f32" : "rgba(255,255,255,0.25)";
              return (
                <div
                  key={entry.label}
                  className={`standings-row ${entry.isPlayer ? "standings-row-player" : ""}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="standings-pos" style={{ color: posColor }}>{posLabel}</div>
                  <div className="standings-bar-wrap">
                    <div className="standings-entry-name">{entry.label}</div>
                    <div className="standings-bar-track">
                      <div
                        className={`standings-bar-fill ${entry.isPlayer ? "standings-bar-player" : ""}`}
                        style={{ width: `${Math.min(100, (entry.score / 120) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {entry.isPlayer && <div className="standings-you-badge">YOU</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="standings-footer">
          <span className="standings-footer-note">Standings update every 2 seconds · Final result on completion</span>
        </div>
      </div>
    </div>
  );
}

// ─── Active Race Card ──────────────────────────────────────────────────────────
function ActiveRaceCard({
  race,
  serverNow,
  onResult,
  onClaimed,
}: {
  race: ActiveRace;
  serverNow: number;
  onResult: (result: RaceResult) => void;
  onClaimed: (id: number) => void;
}) {
  const initialSecs = race.completes_at - serverNow;
  const [secs, setSecs] = useState(Math.max(0, initialSecs));
  const [claiming, setClaiming] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const claimedRef = useRef(false);

  const claim = useCallback(async () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    setClaiming(true);
    try {
      const res = await fetch("/api/race/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race_id: race.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      onResult(data as RaceResult);
      onClaimed(race.id);
    } catch {
      claimedRef.current = false;
      setClaiming(false);
    }
  }, [race.id, onResult, onClaimed]);

  useEffect(() => {
    // Already past completes_at when the page loaded — claim immediately
    if (initialSecs <= 0) {
      claim();
      return;
    }
    const iv = setInterval(() => {
      setSecs((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(iv);
          claim();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      <div
        className="race-active-card"
        onClick={() => !claiming && setShowStandings(true)}
        style={{ cursor: claiming ? "default" : "pointer" }}
      >
        <div className="race-active-pulse" />
        <div className="race-active-info">
          <div className="race-active-circuit">{race.circuit_name}</div>
          <div className="race-active-crew">
            <span>{race.car_name}</span>
            <span className="race-active-sep">·</span>
            <span>{race.driver_name}</span>
            {race.engineer_name && (
              <>
                <span className="race-active-sep">·</span>
                <span>{race.engineer_name}</span>
              </>
            )}
          </div>
        </div>
        <div className="race-active-right">
          {claiming ? (
            <span className="race-claiming-badge">CLAIMING…</span>
          ) : (
            <div className="race-active-right-live">
              <span className="race-countdown">{formatCountdown(secs)}</span>
              <span className="race-view-standings">VIEW ›</span>
            </div>
          )}
        </div>
      </div>
      {showStandings && (
        <RaceStandingsModal
          race={race}
          serverNow={serverNow}
          onClose={() => setShowStandings(false)}
        />
      )}
    </>
  );
}

// ─── Race Result ──────────────────────────────────────────────────────────────
type RaceResult = {
  position: number;
  field_size: number;
  credits_earned: number;
  xgear_earned: number;
  prestige_earned: number;
  materials: Array<{ name: string; qty: number }>;
};

const POSITION_LABELS: Record<number, string> = { 1: "1ST", 2: "2ND", 3: "3RD" };
const POSITION_COLORS: Record<number, string> = {
  1: "#c9a84c",
  2: "#b0bec5",
  3: "#cd7f32",
};

function ResultOverlay({ result, onClose }: { result: RaceResult; onClose: () => void }) {
  const posLabel = POSITION_LABELS[result.position] ?? `P${result.position}`;
  const posColor = POSITION_COLORS[result.position] ?? "rgba(255,255,255,0.4)";
  const isPodium = result.position <= 3;

  return (
    <div className="race-result-overlay">
      <div className="race-result-card race-result-slide-up">
        <div className="race-result-pos-wrap" style={{ color: posColor }}>
          <span className="race-result-pos">{posLabel}</span>
          <span className="race-result-pos-label">
            FINISH · {result.field_size} CAR FIELD
          </span>
        </div>

        <div className="race-result-divider" />

        {isPodium ? (
          <div className="race-result-rewards">
            {result.credits_earned > 0 && (
              <div className="race-result-reward-item">
                <span className="race-result-reward-label">CREDITS</span>
                <span className="race-result-reward-val" style={{ color: "#c9a84c" }}>
                  +{result.credits_earned.toLocaleString()} CR
                </span>
              </div>
            )}
            {result.xgear_earned > 0 && (
              <div className="race-result-reward-item">
                <span className="race-result-reward-label">XGEAR</span>
                <span className="race-result-reward-val" style={{ color: "#818cf8" }}>
                  +{result.xgear_earned} XG
                </span>
              </div>
            )}
            {result.prestige_earned > 0 && (
              <div className="race-result-reward-item">
                <span className="race-result-reward-label">PRESTIGE</span>
                <span className="race-result-reward-val" style={{ color: "#e8001c" }}>
                  +{result.prestige_earned} PST
                </span>
              </div>
            )}
            {result.materials?.map((m, i) => (
              <div key={i} className="race-result-reward-item">
                <span className="race-result-reward-label">{m.name.toUpperCase()}</span>
                <span className="race-result-reward-val">×{m.qty}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0 20px", color: "rgba(255,255,255,0.25)", fontSize: "12px", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
            FINISHED P{result.position} — NO REWARD THIS TIME
          </div>
        )}

        <button className="race-result-close" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────
type EntryStep = "driver" | "engineer" | "car" | "confirm";

function EntryModal({
  circuit,
  drivers,
  engineers,
  cars,
  onClose,
  onStart,
}: {
  circuit: RaceCircuit;
  drivers: UserDriver[];
  engineers: UserEngineer[];
  cars: UserCar[];
  onClose: () => void;
  onStart: (driverId: number, engineerId: number | null, carId: number) => Promise<void>;
}) {
  const [step, setStep] = useState<EntryStep>("driver");
  const [selectedDriver, setSelectedDriver] = useState<UserDriver | null>(null);
  const [selectedEngineer, setSelectedEngineer] = useState<UserEngineer | null>(null);
  const [engineerSkipped, setEngineerSkipped] = useState(false);
  const [selectedCar, setSelectedCar] = useState<UserCar | null>(null);
  const [starting, setStarting] = useState(false);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");

  const idleDrivers = drivers.filter((d) => d.status === "idle");
  const idleEngineers = engineers.filter((e) => e.status === "idle");
  const garageCars = cars.filter((c) => c.status === "garage");

  const advance = (nextStep: EntryStep) => {
    setAnimDir("forward");
    setTimeout(() => setStep(nextStep), 10);
  };
  const goBack = (prevStep: EntryStep) => {
    setAnimDir("back");
    setTimeout(() => setStep(prevStep), 10);
  };

  const engineerBoost = selectedEngineer?.race_bonus ?? 0;
  const finalSpeed = selectedDriver && selectedCar
    ? Math.round(selectedCar.stat_speed + selectedDriver.speed / 10 + engineerBoost * 0.3)
    : 0;
  const finalHandling = selectedDriver && selectedCar
    ? Math.round(selectedCar.stat_handling + selectedDriver.skill / 10 + engineerBoost * 0.2)
    : 0;

  const animClass = `race-step-${animDir}`;

  return (
    <div className="race-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="race-modal">
        {/* Header */}
        <div className="race-modal-header">
          <div>
            <div className="race-modal-circuit">{circuit.name}</div>
            <div className="race-modal-steps">
              {(["driver", "engineer", "car", "confirm"] as EntryStep[]).map((s, i) => (
                <span
                  key={s}
                  className={`race-modal-step-dot ${step === s ? "active" : ""} ${
                    (["driver", "engineer", "car", "confirm"].indexOf(step) > i) ? "done" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          <button className="race-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Step content */}
        <div className="race-modal-body">

          {/* STEP: DRIVER */}
          {step === "driver" && (
            <div className={`race-step ${animClass}`}>
              <div className="race-step-title">SELECT DRIVER</div>
              {idleDrivers.length === 0 ? (
                <div className="race-empty">All drivers are currently busy.</div>
              ) : (
                <div className="race-select-grid">
                  {drivers.map((d) => {
                    const idle = d.status === "idle";
                    const sel = selectedDriver?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        className={`race-select-card ${sel ? "selected" : ""} ${!idle ? "disabled" : ""}`}
                        onClick={() => idle && setSelectedDriver(d)}
                        style={{ "--rc": RARITY_COLOR[d.rarity] } as React.CSSProperties}
                        disabled={!idle}
                      >
                        <div className="race-select-card-rarity-bar" />
                        <div className="race-select-card-portrait">
                          <img src="/assets/drivers/placeholder-3x4.svg" alt={d.name} />
                          {!idle && <div className="race-select-card-busy">BUSY</div>}
                        </div>
                        <div className="race-select-card-info">
                          <div className="race-select-card-name">{d.name}</div>
                          <div className="race-select-card-rarity" style={{ color: RARITY_COLOR[d.rarity] }}>
                            {d.rarity.toUpperCase()}
                          </div>
                          <div className="race-select-stats">
                            <span>SPD <b>{d.speed}</b></span>
                            <span>SKL <b>{d.skill}</b></span>
                            <span>STM <b>{d.stamina}</b></span>
                            <span>AGG <b>{d.aggression}</b></span>
                          </div>
                          <div className="race-select-record">
                            {d.wins}W / {d.races}R
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="race-step-actions">
                <button className="btn-secondary" onClick={onClose}>CANCEL</button>
                <button
                  className="btn-primary"
                  disabled={!selectedDriver}
                  onClick={() => advance("engineer")}
                >
                  NEXT →
                </button>
              </div>
            </div>
          )}

          {/* STEP: ENGINEER */}
          {step === "engineer" && (
            <div className={`race-step ${animClass}`}>
              <div className="race-step-title">SELECT ENGINEER <span className="race-step-optional">(OPTIONAL)</span></div>
              <div className="race-select-grid">
                {/* Skip option */}
                <button
                  className={`race-select-card race-skip-card ${engineerSkipped && !selectedEngineer ? "selected" : ""}`}
                  onClick={() => { setSelectedEngineer(null); setEngineerSkipped(true); }}
                >
                  <div className="race-skip-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                      <path d="M8 12h8M14 9l3 3-3 3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="race-select-card-info">
                    <div className="race-select-card-name">NO ENGINEER</div>
                    <div className="race-select-card-rarity" style={{ color: "rgba(255,255,255,0.4)" }}>SKIP</div>
                    <div className="race-select-stats"><span>RACE BONUS <b>+0</b></span></div>
                  </div>
                </button>
                {engineers.map((e) => {
                  const idle = e.status === "idle";
                  const sel = selectedEngineer?.id === e.id;
                  return (
                    <button
                      key={e.id}
                      className={`race-select-card ${sel ? "selected" : ""} ${!idle ? "disabled" : ""}`}
                      onClick={() => { if (idle) { setSelectedEngineer(e); setEngineerSkipped(false); } }}
                      style={{ "--rc": RARITY_COLOR[e.rarity] } as React.CSSProperties}
                      disabled={!idle}
                    >
                      <div className="race-select-card-rarity-bar" />
                      <div className="race-select-card-portrait">
                        <img src="/assets/drivers/placeholder-3x4.svg" alt={e.name} />
                        {!idle && <div className="race-select-card-busy">BUSY</div>}
                      </div>
                      <div className="race-select-card-info">
                        <div className="race-select-card-name">{e.name}</div>
                        <div className="race-select-card-rarity" style={{ color: RARITY_COLOR[e.rarity] }}>
                          {e.rarity.toUpperCase()}
                        </div>
                        <div className="race-select-stats">
                          <span>RCE <b>{e.race_bonus}</b></span>
                          <span>SPD <b>{e.craft_speed}</b></span>
                          <span>QLT <b>{e.quality_bonus}</b></span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="race-step-actions">
                <button className="btn-secondary" onClick={() => goBack("driver")}>← BACK</button>
                <button
                  className="btn-primary"
                  disabled={!selectedEngineer && !engineerSkipped}
                  onClick={() => advance("car")}
                >
                  NEXT →
                </button>
              </div>
            </div>
          )}

          {/* STEP: CAR */}
          {step === "car" && (
            <div className={`race-step ${animClass}`}>
              <div className="race-step-title">SELECT CAR</div>
              {garageCars.length === 0 ? (
                <div className="race-empty">No cars available in garage.</div>
              ) : (
                <div className="race-select-grid race-select-grid-car">
                  {cars.map((c) => {
                    const available = c.status === "garage";
                    const sel = selectedCar?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        className={`race-select-card race-car-card ${sel ? "selected" : ""} ${!available ? "disabled" : ""}`}
                        onClick={() => available && setSelectedCar(c)}
                        disabled={!available}
                      >
                        <div className="race-car-color-bar" style={{ background: c.color }} />
                        <div className="race-car-portrait">
                          <img src={resolveArt(c.art, "cars")} alt={c.name} />
                          {!available && <div className="race-select-card-busy">{c.status.replace("_", " ").toUpperCase()}</div>}
                        </div>
                        <div className="race-select-card-info">
                          <div className="race-select-card-name">{c.name}</div>
                          <div className="race-car-code">{c.model_code}</div>
                          <div className="race-select-stats race-car-stats">
                            <span>SPD <b>{c.stat_speed}</b></span>
                            <span>HND <b>{c.stat_handling}</b></span>
                            <span>DUR <b>{c.stat_durability}</b></span>
                            <span>ACC <b>{c.stat_acceleration}</b></span>
                          </div>
                          <div className="race-car-wear">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 8 L5 2 L8 8" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                            </svg>
                            {c.total_races} races run
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="race-step-actions">
                <button className="btn-secondary" onClick={() => goBack("engineer")}>← BACK</button>
                <button
                  className="btn-primary"
                  disabled={!selectedCar}
                  onClick={() => advance("confirm")}
                >
                  NEXT →
                </button>
              </div>
            </div>
          )}

          {/* STEP: CONFIRM */}
          {step === "confirm" && selectedDriver && selectedCar && (
            <div className={`race-step ${animClass}`}>
              <div className="race-step-title">CONFIRM ENTRY</div>

              <div className="race-confirm-grid">
                <div className="race-confirm-item">
                  <div className="race-confirm-label">DRIVER</div>
                  <div className="race-confirm-val" style={{ color: RARITY_COLOR[selectedDriver.rarity] }}>
                    {selectedDriver.name}
                  </div>
                </div>
                <div className="race-confirm-item">
                  <div className="race-confirm-label">ENGINEER</div>
                  <div className="race-confirm-val" style={{ color: selectedEngineer ? RARITY_COLOR[selectedEngineer.rarity] : "rgba(255,255,255,0.3)" }}>
                    {selectedEngineer?.name ?? "None"}
                  </div>
                </div>
                <div className="race-confirm-item">
                  <div className="race-confirm-label">CAR</div>
                  <div className="race-confirm-val">{selectedCar.name}</div>
                </div>
              </div>

              <div className="race-confirm-stats">
                <div className="race-confirm-stat">
                  <span className="race-confirm-stat-label">FINAL SPEED</span>
                  <span className="race-confirm-stat-val">{finalSpeed}</span>
                </div>
                <div className="race-confirm-stat">
                  <span className="race-confirm-stat-label">FINAL HANDLING</span>
                  <span className="race-confirm-stat-val">{finalHandling}</span>
                </div>
                <div className="race-confirm-stat">
                  <span className="race-confirm-stat-label">ENG BOOST</span>
                  <span className="race-confirm-stat-val" style={{ color: engineerBoost > 0 ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                    +{engineerBoost}
                  </span>
                </div>
                <div className="race-confirm-stat">
                  <span className="race-confirm-stat-label">DURATION</span>
                  <span className="race-confirm-stat-val">{formatDuration(circuit.duration_seconds)}</span>
                </div>
                <div className="race-confirm-stat">
                  <span className="race-confirm-stat-label">FIELD SIZE</span>
                  <span className="race-confirm-stat-val">{circuit.field_size}</span>
                </div>
              </div>

              <div className="race-confirm-notice">
                Entry fee of <span style={{ color: "#c9a84c" }}>{circuit.entry_cost.toLocaleString()} CR</span> will be charged.
                The driver, engineer, and car will be unavailable until the race completes.
              </div>

              <div className="race-step-actions">
                <button className="btn-secondary" onClick={() => goBack("car")}>← BACK</button>
                <button
                  className="btn-primary race-start-btn"
                  disabled={starting}
                  onClick={async () => {
                    setStarting(true);
                    await onStart(selectedDriver.id, selectedEngineer?.id ?? null, selectedCar.id);
                    setStarting(false);
                  }}
                >
                  {starting ? "STARTING…" : "START RACE"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function RaceClient({ data }: { data: RacePageData }) {
  const router = useRouter();
  const { toast, show: showToast } = useToast();
  const [tab, setTab] = useState<"STANDARD" | "EVENT">("STANDARD");
  const [entryCircuit, setEntryCircuit] = useState<RaceCircuit | null>(null);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set());
  const userCredits = data.credits;

  const visibleActiveRaces = data.activeRaces.filter((r) => !claimedIds.has(r.id));

  const activeCircuitIds = new Set(
    data.activeRaces
      .filter((r) => r.status === "scheduled" || r.status === "in_progress")
      .map((r) => r.circuit_id)
  );

  const handleStartRace = async (
    circuitId: number,
    driverId: number,
    engineerId: number | null,
    carId: number
  ) => {
    try {
      const res = await fetch("/api/race/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit_id: circuitId, driver_id: driverId, engineer_id: engineerId, car_id: carId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to start race");
      setEntryCircuit(null);
      router.refresh();
    } catch (e) {
      showToast((e as Error).message);
      throw e;
    }
  };

  const handleResult = (result: RaceResult) => {
    setRaceResult(result);
  };

  const handleClaimed = (id: number) => {
    setClaimedIds((prev) => new Set([...prev, id]));
  };

  return (
    <>
      <style>{RACE_STYLES}</style>

      {/* Toast */}
      {toast && (
        <div className={`race-toast ${toast.type === "success" ? "race-toast-ok" : "race-toast-err"}`}>
          {toast.msg}
        </div>
      )}

      <div className="race-page md:ml-16 pb-20 md:pb-6">
        {/* Page header */}
        <div className="race-page-header">
          <div className="race-page-header-inner">
            <div>
              <h1 className="race-page-title">RACE HQ</h1>
              <p className="race-page-sub">Deploy cars. Earn rewards. Build prestige.</p>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
            <div className="race-header-credits">
              <span className="race-credits-val">{data.credits.toLocaleString()}</span>
              <span className="race-credits-label">CR</span>
            </div>
            <div className="race-header-credits">
              <span className="race-credits-val" style={{ color: "#818cf8" }}>{data.xgear.toLocaleString()}</span>
              <span className="race-credits-label">XG</span>
            </div>
          </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="race-tab-bar">
          {(["STANDARD", "EVENT"] as const).map((t) => (
            <button
              key={t}
              className={`race-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "STANDARD" && visibleActiveRaces.length > 0 && (
                <span className="race-tab-badge">{visibleActiveRaces.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── STANDARD TAB ── */}
        {tab === "STANDARD" && (
          <div className="race-tab-content">
            {/* Active Races */}
            {visibleActiveRaces.length > 0 && (
              <section className="race-section">
                <div className="race-section-label">
                  <span className="race-section-dot" />
                  ACTIVE RACES
                </div>
                <div className="race-active-list">
                  {visibleActiveRaces.map((r) => (
                    <ActiveRaceCard
                      key={r.id}
                      race={r}
                      serverNow={data.serverNow}
                      onResult={handleResult}
                      onClaimed={handleClaimed}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Circuits */}
            <section className="race-section">
              {data.activeRaces.length > 0 && (
                <div className="race-section-label">
                  <span className="race-section-dot-grey" />
                  CIRCUITS
                </div>
              )}
              <div className="race-circuits-grid">
                {data.circuits.map((c) => (
                  <CircuitCard
                    key={c.id}
                    circuit={c}
                    onEnter={() => setEntryCircuit(c)}
                    isActive={activeCircuitIds.has(c.id)}
                    canAfford={userCredits >= c.entry_cost}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── EVENT TAB ── */}
        {tab === "EVENT" && (
          <div className="race-tab-content">
            <div className="race-event-placeholder">
              <div className="race-event-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect x="8" y="28" width="48" height="8" rx="1" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <rect x="8" y="28" width="12" height="8" rx="1" fill="#e8001c" fillOpacity="0.3" stroke="#e8001c" strokeWidth="1.5" />
                  <rect x="44" y="28" width="12" height="8" rx="1" fill="#e8001c" fillOpacity="0.3" stroke="#e8001c" strokeWidth="1.5" />
                  <path d="M20 20 L20 28 M20 36 L20 44" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <path d="M44 20 L44 28 M44 36 L44 44" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <circle cx="32" cy="32" r="4" fill="#e8001c" />
                  <path d="M14 20 L50 20 M14 44 L50 44" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
                </svg>
              </div>
              <div className="race-event-title">EVENT RACES</div>
              <div className="race-event-sub">
                Coming Soon — Special limited-time race events with exclusive rewards will appear here.
              </div>
              <div className="race-event-badge">LOCKED</div>
            </div>
          </div>
        )}
      </div>

      {/* Entry Modal */}
      {entryCircuit && (
        <EntryModal
          circuit={entryCircuit}
          drivers={data.userDrivers}
          engineers={data.userEngineers}
          cars={data.userCars}
          onClose={() => setEntryCircuit(null)}
          onStart={(driverId, engineerId, carId) =>
            handleStartRace(entryCircuit.id, driverId, engineerId, carId)
          }
        />
      )}

      {/* Result Overlay */}
      {raceResult && (
        <ResultOverlay
          result={raceResult}
          onClose={() => {
            setRaceResult(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const RACE_STYLES = `
/* Page Layout */
.race-page {
  min-height: 100vh;
  background: #080808;
  position: relative;
}

/* Header */
.race-page-header {
  padding: 20px 16px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: linear-gradient(180deg, rgba(232,0,28,0.04) 0%, transparent 100%);
}
.race-page-header-inner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 16px;
}
.race-page-title {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: clamp(28px, 5vw, 40px);
  letter-spacing: 0.05em;
  color: #ffffff;
  line-height: 1;
}
.race-page-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  margin-top: 4px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.race-header-credits {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.race-credits-val {
  font-family: var(--font-mono, 'JetBrains Mono'), monospace;
  font-size: 18px;
  color: #c9a84c;
  letter-spacing: -0.02em;
}
.race-credits-label {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.1em;
}

/* Tab Bar */
.race-tab-bar {
  display: flex;
  padding: 0 16px;
  gap: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: #080808;
  position: sticky;
  top: 0;
  z-index: 10;
}
.race-tab {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 15px;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  padding: 12px 20px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
  position: relative;
}
.race-tab.active {
  color: #ffffff;
  border-bottom-color: #e8001c;
}
.race-tab:hover:not(.active) {
  color: rgba(255,255,255,0.6);
}
.race-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e8001c;
  color: white;
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  padding: 0 4px;
  margin-left: 6px;
  vertical-align: middle;
  animation: race-pulse 2s ease-in-out infinite;
}

/* Tab content */
.race-tab-content {
  padding: 20px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Section */
.race-section { margin-bottom: 28px; }
.race-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 13px;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.4);
  margin-bottom: 12px;
}
.race-section-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #e8001c;
  animation: race-pulse 2s ease-in-out infinite;
}
.race-section-dot-grey {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
}

/* Circuits Grid */
.race-circuits-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) {
  .race-circuits-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .race-circuits-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Circuit Card */
.race-circuit-card {
  background: #111111;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
  clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%);
}
.race-circuit-card:hover {
  border-color: rgba(232,0,28,0.3);
  transform: translateY(-1px);
}
.race-circuit-active {
  border-color: rgba(232,0,28,0.4) !important;
  opacity: 0.7;
}

/* ── Circuit Image ───────────────────────────────────────────── */
.race-circuit-img-wrap {
  position: relative;
  width: 100%;
  height: 140px;
  overflow: hidden;
}

.race-circuit-img {
  object-fit: cover;
  object-position: center 40%;
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.race-circuit-card:hover .race-circuit-img {
  transform: scale(1.06);
}

.race-circuit-img-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  pointer-events: none;
}

.race-circuit-header-inner {
  position: absolute;
  bottom: 8px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  z-index: 2;
}
.race-circuit-slash {
  position: absolute;
  top: 0;
  right: 0;
  width: 60px;
  height: 60px;
  background: rgba(232,0,28,0.08);
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  z-index: 2;
}

.race-diff-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  transition: background 0.2s;
}
.race-duration-badge {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.05em;
  background: rgba(0,0,0,0.4);
  padding: 2px 6px;
  border-radius: 2px;
}

.race-circuit-body { padding: 14px 14px 16px; }
.race-circuit-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.race-circuit-name {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: #ffffff;
  line-height: 1;
}
.race-circuit-location {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  margin-top: 3px;
  letter-spacing: 0.04em;
}
.race-circuit-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  line-height: 1.5;
  margin-bottom: 10px;
}


.race-field-badge {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.06em;
  background: rgba(232,0,28,0.2);
  border: 1px solid rgba(232,0,28,0.3);
  padding: 2px 6px;
  border-radius: 2px;
}

.race-podium-preview {
  margin-bottom: 10px;
  padding: 8px 10px;
  background: rgba(201,168,76,0.04);
  border: 1px solid rgba(201,168,76,0.1);
  border-radius: 2px;
}
.race-podium-label {
  font-family: var(--font-mono, monospace);
  font-size: 8px;
  letter-spacing: 0.1em;
  color: rgba(201,168,76,0.5);
  display: block;
  margin-bottom: 5px;
}
.race-podium-rewards {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.race-entry-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.race-entry-cost {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.race-entry-cost-label {
  font-family: var(--font-mono, monospace);
  font-size: 8px;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
}
.race-entry-cost-val {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  letter-spacing: -0.01em;
}
.race-entry-cant { color: #e8001c !important; }

.race-reward-cr {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: #c9a84c;
  letter-spacing: -0.01em;
}
.race-reward-prestige {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: #e8001c;
}
.race-reward-xg {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: #818cf8;
}
.race-reward-mat {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: rgba(255,255,255,0.4);
}

.race-circuit-cant-afford {
  opacity: 0.7;
}

.race-enter-btn {
  flex: 1;
  background: rgba(232,0,28,0.1);
  border: 1px solid rgba(232,0,28,0.4);
  color: #e8001c;
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 14px;
  letter-spacing: 0.1em;
  padding: 9px 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
  white-space: nowrap;
}
.race-enter-btn:hover:not(:disabled) {
  background: rgba(232,0,28,0.2);
  border-color: rgba(232,0,28,0.7);
}
.race-enter-btn:disabled {
  cursor: not-allowed;
}
.race-enter-btn-broke {
  background: rgba(255,255,255,0.03) !important;
  border-color: rgba(255,255,255,0.1) !important;
  color: rgba(255,255,255,0.25) !important;
}

/* Active Race Cards */
.race-active-list { display: flex; flex-direction: column; gap: 8px; }
.race-active-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #111111;
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 3px solid #e8001c;
  border-radius: 3px;
  padding: 12px 14px;
  position: relative;
  overflow: hidden;
}
.race-active-pulse {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: #e8001c;
  animation: race-pulse 1.5s ease-in-out infinite;
}
.race-active-info { flex: 1; min-width: 0; }
.race-active-circuit {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 15px;
  letter-spacing: 0.06em;
  color: #ffffff;
}
.race-active-crew {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.race-active-sep { margin: 0 5px; color: rgba(255,255,255,0.2); }
.race-active-right { flex-shrink: 0; }
.race-countdown {
  font-family: var(--font-mono, monospace);
  font-size: 20px;
  color: #e8001c;
  letter-spacing: 0.05em;
}
.race-claiming-badge {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  animation: race-pulse 1s ease-in-out infinite;
}

/* Event Placeholder */
.race-event-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: #111111;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  text-align: center;
  padding: 40px 24px;
}
.race-event-icon { margin-bottom: 20px; opacity: 0.6; }
.race-event-title {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 32px;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.7);
  margin-bottom: 10px;
}
.race-event-sub {
  font-size: 13px;
  color: rgba(255,255,255,0.3);
  max-width: 320px;
  line-height: 1.6;
  margin-bottom: 20px;
}
.race-event-badge {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 4px 12px;
  border-radius: 2px;
}

/* Result Overlay */
.race-result-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 16px;
}
@media (min-width: 640px) {
  .race-result-overlay { align-items: center; }
}
.race-result-card {
  background: #111111;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 32px 28px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}
.race-result-slide-up {
  animation: race-slide-up 0.4s cubic-bezier(0.16,1,0.3,1) both;
}
.race-result-pos-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}
.race-result-pos {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 96px;
  line-height: 0.9;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px currentColor;
}
.race-result-pos-label {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 14px;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.4);
  margin-top: 4px;
}
.race-result-divider {
  width: 40px;
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 0 auto 20px;
}
.race-result-rewards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}
.race-result-reward-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.race-result-reward-label {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 13px;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.4);
}
.race-result-reward-val {
  font-family: var(--font-mono, monospace);
  font-size: 15px;
  color: #ffffff;
  letter-spacing: -0.01em;
}
.race-result-close {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 16px;
  letter-spacing: 0.1em;
  padding: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.2s;
}
.race-result-close:hover { background: rgba(255,255,255,0.1); }

/* Modal */
.race-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
  padding: 0;
}
@media (min-width: 640px) {
  .race-modal-overlay {
    align-items: center;
    padding: 16px;
  }
}
.race-modal {
  background: #0e0e0e;
  border: 1px solid rgba(255,255,255,0.1);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@media (min-width: 640px) {
  .race-modal {
    border-bottom: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    max-height: 85vh;
  }
}
.race-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.race-modal-circuit {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 20px;
  letter-spacing: 0.06em;
  color: #ffffff;
}
.race-modal-steps {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.race-modal-step-dot {
  width: 20px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255,255,255,0.15);
  transition: background 0.3s;
}
.race-modal-step-dot.active { background: #e8001c; }
.race-modal-step-dot.done { background: rgba(232,0,28,0.4); }
.race-modal-close {
  color: rgba(255,255,255,0.4);
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}
.race-modal-close:hover { color: #ffffff; }

.race-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Step Transitions */
.race-step { animation-duration: 0.25s; animation-fill-mode: both; }
.race-step-forward { animation-name: race-step-in-fwd; }
.race-step-back { animation-name: race-step-in-back; }

/* Selection Grid */
.race-select-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
@media (min-width: 480px) {
  .race-select-grid { grid-template-columns: repeat(3, 1fr); }
}
.race-select-grid-car { grid-template-columns: 1fr; }
@media (min-width: 480px) {
  .race-select-grid-car { grid-template-columns: repeat(2, 1fr); }
}

.race-step-title {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 18px;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.7);
  margin-bottom: 14px;
}
.race-step-optional {
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em;
}

/* Select Card */
.race-select-card {
  background: #161616;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 3px;
  padding: 0;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.race-select-card:hover:not(.disabled) {
  border-color: rgba(255,255,255,0.2);
  background: #1a1a1a;
}
.race-select-card.selected {
  border-color: var(--rc, #e8001c) !important;
  background: #1c1c1c;
  box-shadow: 0 0 12px rgba(232,0,28,0.12);
}
.race-select-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.race-select-card-rarity-bar {
  height: 2px;
  background: var(--rc, #aaaaaa);
  width: 100%;
  flex-shrink: 0;
}
.race-select-card-portrait {
  width: 100%;
  aspect-ratio: 3/2;
  overflow: hidden;
  background: #0d0d0d;
  position: relative;
  flex-shrink: 0;
}
.race-select-card-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.7;
}
.race-select-card-busy {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.5);
}
.race-select-card-info {
  padding: 8px 10px 10px;
  flex: 1;
}
.race-select-card-name {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: #ffffff;
  line-height: 1.1;
}
.race-select-card-rarity {
  font-size: 9px;
  letter-spacing: 0.1em;
  margin: 2px 0 6px;
}
.race-select-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  color: rgba(255,255,255,0.4);
}
.race-select-stats b { color: rgba(255,255,255,0.75); font-weight: 600; }
.race-select-record {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  margin-top: 5px;
}

/* Skip Card */
.race-skip-card {
  border-style: dashed !important;
  align-items: center;
  padding: 16px 10px;
  flex-direction: row;
  gap: 10px;
}
.race-skip-icon { flex-shrink: 0; }

/* Car Card */
.race-car-card { flex-direction: row; align-items: stretch; }
.race-car-color-bar { width: 4px; flex-shrink: 0; }
.race-car-portrait {
  width: 100px;
  flex-shrink: 0;
  background: #0d0d0d;
  position: relative;
  overflow: hidden;
}
.race-car-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.6;
}
.race-car-code {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.race-car-stats { gap: 4px 10px; }
.race-car-wear {
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  margin-top: 6px;
  font-family: var(--font-mono, monospace);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Confirm Step */
.race-confirm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 16px;
}
.race-confirm-item {
  background: #131313;
  padding: 12px;
  text-align: center;
}
.race-confirm-label {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 6px;
}
.race-confirm-val {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #ffffff;
  line-height: 1.2;
}

.race-confirm-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
@media (min-width: 400px) {
  .race-confirm-stats { grid-template-columns: repeat(3, 1fr); }
}
.race-confirm-stat {
  background: #131313;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 3px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.race-confirm-stat-label {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3);
}
.race-confirm-stat-val {
  font-family: var(--font-mono, monospace);
  font-size: 22px;
  color: #ffffff;
  letter-spacing: -0.02em;
}
.race-confirm-notice {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  line-height: 1.5;
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 3px;
  background: rgba(232,0,28,0.04);
}

/* Step Actions */
.race-step-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 4px;
}
.race-start-btn {
  font-size: 16px !important;
  padding: 12px 28px !important;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
}

/* Empty State */
.race-empty {
  font-size: 13px;
  color: rgba(255,255,255,0.3);
  text-align: center;
  padding: 40px 0;
}

/* Toast */
.race-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 13px;
  font-family: var(--font-mono, monospace);
  white-space: nowrap;
  animation: race-slide-up 0.3s ease both;
}
@media (min-width: 768px) { .race-toast { bottom: 24px; } }
.race-toast-err { background: #2d0808; border: 1px solid #e8001c; color: #ff6b6b; }
.race-toast-ok  { background: #0d2b0d; border: 1px solid #4ade80; color: #4ade80; }

/* View standings hint */
.race-active-right-live {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.race-view-standings {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(232,0,28,0.5);
  transition: color 0.2s;
}
.race-active-card:hover .race-view-standings {
  color: #e8001c;
}

/* Standings Modal */
.standings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 150;
  padding: 0;
}
@media (min-width: 640px) {
  .standings-overlay {
    align-items: center;
    padding: 16px;
  }
}
.standings-modal {
  background: #0e0e0e;
  border: 1px solid rgba(255,255,255,0.1);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: race-slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both;
}
@media (min-width: 640px) {
  .standings-modal {
    border-bottom: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    max-height: 80vh;
  }
}
.standings-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.standings-header-left {}
.standings-circuit-name {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 22px;
  letter-spacing: 0.06em;
  color: #ffffff;
  line-height: 1;
}
.standings-meta {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em;
  margin-top: 5px;
}
.standings-meta-sep { margin: 0 6px; color: rgba(255,255,255,0.15); }
.standings-header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.standings-countdown {
  font-family: var(--font-mono, monospace);
  font-size: 22px;
  color: #e8001c;
  letter-spacing: 0.05em;
}
.standings-close {
  color: rgba(255,255,255,0.4);
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}
.standings-close:hover { color: #ffffff; }
.standings-progress-track {
  height: 2px;
  background: rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.standings-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #e8001c, #ff4444);
  transition: width 1s linear;
}
.standings-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.standings-feed-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 12px;
}
.standings-feed-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #e8001c;
  animation: race-pulse 1.2s ease-in-out infinite;
}
.standings-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.standings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #131313;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 3px;
  transition: border-color 0.4s, background 0.4s;
  animation: standings-row-in 0.3s ease both;
}
.standings-row-player {
  background: rgba(232,0,28,0.05);
  border-color: rgba(232,0,28,0.2) !important;
}
.standings-pos {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 18px;
  letter-spacing: 0.04em;
  min-width: 28px;
  text-align: center;
  line-height: 1;
}
.standings-bar-wrap {
  flex: 1;
  min-width: 0;
}
.standings-entry-name {
  font-family: var(--font-display, 'Bebas Neue'), sans-serif;
  font-size: 13px;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 5px;
}
.standings-row-player .standings-entry-name { color: #ffffff; }
.standings-bar-track {
  height: 3px;
  background: rgba(255,255,255,0.07);
  border-radius: 2px;
  overflow: hidden;
}
.standings-bar-fill {
  height: 100%;
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
  transition: width 1.8s cubic-bezier(0.4,0,0.2,1);
}
.standings-bar-player {
  background: linear-gradient(90deg, #e8001c, #ff6b6b);
}
.standings-you-badge {
  font-family: var(--font-mono, monospace);
  font-size: 8px;
  letter-spacing: 0.12em;
  color: #e8001c;
  border: 1px solid rgba(232,0,28,0.4);
  padding: 2px 5px;
  border-radius: 2px;
  flex-shrink: 0;
}
.standings-footer {
  padding: 10px 20px 14px;
  border-top: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
}
.standings-footer-note {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  color: rgba(255,255,255,0.18);
  letter-spacing: 0.06em;
}

@keyframes standings-row-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Keyframes */
@keyframes race-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes race-slide-up {
  from { transform: translateY(24px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes race-step-in-fwd {
  from { transform: translateX(24px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes race-step-in-back {
  from { transform: translateX(-24px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
`;
