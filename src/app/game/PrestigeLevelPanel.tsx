"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  currentLevel: number;
  prestige: number;
  credits: number;
  levelReq: { prestige_cost: number; credits_cost: number } | null;
}

export default function PrestigeLevelPanel({ currentLevel, prestige, credits, levelReq }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const atMax = currentLevel >= 10;
  const canLevelUp = levelReq
    ? prestige >= levelReq.prestige_cost && credits >= levelReq.credits_cost
    : false;

  const prestigePct = levelReq
    ? Math.min(100, Math.round((prestige / levelReq.prestige_cost) * 100))
    : 100;
  const creditsPct = levelReq
    ? Math.min(100, Math.round((credits / levelReq.credits_cost) * 100))
    : 100;

  async function handleLevelUp() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/prestige/levelup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Level up failed");
      } else {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          router.refresh();
        }, 1200);
      }
    });
  }

  if (atMax) {
    return (
      <div className="mb-8" style={panelStyle}>
        <div style={panelInner}>
          <div style={leftCol}>
            <div style={levelBadgeStyle}>
              <span style={levelNumStyle}>{currentLevel}</span>
              <span style={levelLabelStyle}>MAX</span>
            </div>
          </div>
          <div style={rightCol}>
            <div style={titleStyle}>PRESTIGE RANK</div>
            <div style={maxStyle}>Maximum level reached. Legend status achieved.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8" style={panelStyle}>
      <div style={panelInner}>
        {/* Left: level badge */}
        <div style={leftCol}>
          <div style={levelBadgeStyle}>
            <span style={levelNumStyle}>{currentLevel}</span>
            <span style={levelLabelStyle}>LVL</span>
          </div>
          <div style={arrowStyle}>→</div>
          <div style={{ ...levelBadgeStyle, opacity: canLevelUp ? 1 : 0.3 }}>
            <span style={levelNumStyle}>{currentLevel + 1}</span>
            <span style={levelLabelStyle}>LVL</span>
          </div>
        </div>

        {/* Right: requirements + button */}
        <div style={rightCol}>
          <div style={titleStyle}>LEVEL UP</div>

          {/* Prestige bar */}
          <div style={reqRowStyle}>
            <div style={reqLabelStyle}>PRESTIGE</div>
            <div style={barTrackStyle}>
              <div style={{ ...barFillStyle, width: `${prestigePct}%`, background: "#c9a84c" }} />
            </div>
            <div style={reqValStyle}>
              <span style={{ color: prestige >= (levelReq?.prestige_cost ?? 0) ? "#c9a84c" : "#e8001c" }}>
                {prestige.toLocaleString()}
              </span>
              <span style={{ color: "#333" }}>/{levelReq?.prestige_cost.toLocaleString()}</span>
            </div>
          </div>

          {/* Credits bar */}
          <div style={reqRowStyle}>
            <div style={reqLabelStyle}>CREDITS</div>
            <div style={barTrackStyle}>
              <div style={{ ...barFillStyle, width: `${creditsPct}%`, background: "#4ade80" }} />
            </div>
            <div style={reqValStyle}>
              <span style={{ color: credits >= (levelReq?.credits_cost ?? 0) ? "#4ade80" : "#e8001c" }}>
                {credits.toLocaleString()}
              </span>
              <span style={{ color: "#333" }}>/{levelReq?.credits_cost.toLocaleString()}</span>
            </div>
          </div>

          {error && <div style={errorStyle}>{error}</div>}
          {success && <div style={successStyle}>LEVEL UP! Advancing to Level {currentLevel + 1}…</div>}

          <button
            onClick={handleLevelUp}
            disabled={!canLevelUp || isPending}
            style={{
              ...levelUpBtnStyle,
              ...(canLevelUp && !isPending ? levelUpBtnActiveStyle : {}),
              opacity: !canLevelUp || isPending ? 0.4 : 1,
              cursor: !canLevelUp || isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "LEVELLING UP…" : "LEVEL UP"}
          </button>
        </div>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f0f0f 0%, #111111 100%)",
  border: "1px solid rgba(201,168,76,0.15)",
  borderRadius: "4px",
  overflow: "hidden",
  position: "relative",
};

const panelInner: React.CSSProperties = {
  display: "flex",
  gap: "20px",
  padding: "18px 20px",
  alignItems: "center",
};

const leftCol: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
};

const rightCol: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const levelBadgeStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  width: "52px",
  height: "52px",
  border: "1px solid rgba(201,168,76,0.3)",
  borderRadius: "3px",
  background: "rgba(201,168,76,0.06)",
};

const levelNumStyle: React.CSSProperties = {
  fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif",
  fontSize: "26px",
  lineHeight: 1,
  color: "#c9a84c",
  letterSpacing: "0.04em",
};

const levelLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "8px",
  color: "rgba(201,168,76,0.5)",
  letterSpacing: "0.1em",
};

const arrowStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "14px",
  color: "rgba(255,255,255,0.2)",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif",
  fontSize: "13px",
  letterSpacing: "0.15em",
  color: "rgba(255,255,255,0.4)",
  marginBottom: "10px",
};

const reqRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "6px",
};

const reqLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "9px",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.3)",
  width: "60px",
  flexShrink: 0,
};

const barTrackStyle: React.CSSProperties = {
  flex: 1,
  height: "3px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: "2px",
  overflow: "hidden",
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "2px",
  transition: "width 0.4s ease",
};

const reqValStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "9px",
  letterSpacing: "-0.01em",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const levelUpBtnStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "8px 20px",
  background: "transparent",
  border: "1px solid rgba(201,168,76,0.3)",
  color: "#c9a84c",
  fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif",
  fontSize: "14px",
  letterSpacing: "0.12em",
  borderRadius: "2px",
  clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)",
  transition: "background 0.2s, border-color 0.2s",
};

const levelUpBtnActiveStyle: React.CSSProperties = {
  background: "rgba(201,168,76,0.12)",
  borderColor: "rgba(201,168,76,0.6)",
};

const maxStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "11px",
  color: "rgba(201,168,76,0.5)",
  letterSpacing: "0.04em",
};

const errorStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#e8001c",
  fontFamily: "var(--font-mono, monospace)",
  marginTop: "6px",
};

const successStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#4ade80",
  fontFamily: "var(--font-mono, monospace)",
  marginTop: "6px",
  letterSpacing: "0.04em",
};
