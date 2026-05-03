"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";

const NAV_ITEMS = [
  {
    href: "/game",
    label: "HQ",
    icon: (
      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
        <path d="M7 18v-6h6v6"/>
      </svg>
    ),
  },
  {
    href: "/game/garage",
    label: "Garage",
    icon: (
      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 14l2-6h10l2 6H3z"/>
        <path d="M2 14h16v3H2z"/>
        <circle cx="6" cy="15.5" r="1.5"/>
        <circle cx="14" cy="15.5" r="1.5"/>
      </svg>
    ),
  },
  {
    href: "/game/race",
    label: "Race",
    icon: (
      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 10c0-1 .5-2 1.5-2.5L10 4l6.5 3.5C17.5 8 18 9 18 10v3H2v-3z"/>
        <rect x="2" y="13" width="16" height="1.5"/>
        <circle cx="5.5" cy="14.5" r="1.5"/>
        <circle cx="14.5" cy="14.5" r="1.5"/>
      </svg>
    ),
  },
  {
    href: "/game/workshop",
    label: "Workshop",
    icon: (
      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="3"/>
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/>
      </svg>
    ),
  },
  {
    href: "/game/drivers",
    label: "Drivers",
    icon: (
      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="7" r="3"/>
        <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      </svg>
    ),
  },
  {
    href: "/game/market",
    label: "Market",
    icon: (
      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3h2l2.5 9h7l2.5-7H6"/>
        <circle cx="9" cy="17" r="1"/>
        <circle cx="15" cy="17" r="1"/>
      </svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Rankings",
    icon: (
      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="10" width="3" height="7"/>
        <rect x="8.5" y="6" width="3" height="11"/>
        <rect x="14" y="3" width="3" height="14"/>
      </svg>
    ),
  },
];

interface Props {
  user: SessionUser;
}

export default function GameNav({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <>
      {/* Top bar — desktop + mobile */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080808]/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          {/* Brand */}
          <Link href="/game" className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="w-6 h-6 flex-shrink-0">
              <path d="M4 22 L4 18 Q5 14 10 12 L14 10 Q15 8 16 8 Q17 8 18 10 L22 12 Q27 14 28 18 L28 22 Z" fill="#1c1c1c"/>
              <rect x="4" y="20" width="24" height="2" fill="#e8001c"/>
              <circle cx="10" cy="23" r="3" fill="#111" stroke="#222" strokeWidth="1"/>
              <circle cx="22" cy="23" r="3" fill="#111" stroke="#222" strokeWidth="1"/>
              <circle cx="10" cy="23" r="1.5" fill="#e8001c" opacity="0.7"/>
              <circle cx="22" cy="23" r="1.5" fill="#e8001c" opacity="0.7"/>
            </svg>
            <span
              className="text-white hidden sm:block"
              style={{ fontFamily: "var(--font-display)", fontSize: "16px", letterSpacing: "0.2em" }}
            >
              BLACKRIDGE
            </span>
          </Link>

          {/* User stats — desktop */}
          <div className="hidden md:flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#555]">CR</span>
              <span
                className="text-sm text-white number-display"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {user.credits.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-4 bg-white/[0.08]" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#555]">PRESTIGE</span>
              <span
                className="text-sm number-display"
                style={{ color: "#c9a84c", fontFamily: "var(--font-mono)" }}
              >
                {user.prestige.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-4 bg-white/[0.08]" />
            <div
              className="text-xs px-2 py-1 border border-[#e8001c]/30 text-[#e8001c]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              LVL {user.level}
            </div>
          </div>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs text-[#888] leading-none">{user.brand_name}</span>
              <span
                className="text-xs text-[#555] leading-none mt-0.5"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                @{user.username}
              </span>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-2 text-[#444] hover:text-[#888] transition-colors"
              title="Sign out"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 3h4v14h-4M8 14l4-4-4-4M2 10h10"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile stats bar */}
        <div className="flex items-center justify-between px-4 pb-2 md:hidden border-t border-white/[0.04]">
          <div className="flex items-center gap-1 pt-1.5">
            <span className="text-xs text-[#555]">CR</span>
            <span className="text-xs text-white number-display ml-1" style={{ fontFamily: "var(--font-mono)" }}>
              {user.credits.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 pt-1.5">
            <span className="text-xs text-[#555]">PRESTIGE</span>
            <span className="text-xs number-display ml-1" style={{ color: "#c9a84c", fontFamily: "var(--font-mono)" }}>
              {user.prestige.toLocaleString()}
            </span>
          </div>
          <div
            className="text-xs px-1.5 py-0.5 border border-[#e8001c]/30 text-[#e8001c] mt-1.5"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            LVL {user.level}
          </div>
        </div>
      </header>

      {/* Bottom tab nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#080808]/98 border-t border-white/[0.06] safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.slice(0, 6).map((item) => {
            const active =
              item.href === "/game"
                ? pathname === "/game"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 px-2 py-1 transition-colors"
                style={{ color: active ? "#e8001c" : "#444" }}
              >
                {item.icon}
                <span
                  className="text-[10px] leading-none"
                  style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Side nav — desktop */}
      <aside className="hidden md:flex fixed left-0 top-[73px] bottom-0 w-[64px] border-r border-white/[0.05] flex-col items-center gap-1 py-4 bg-[#080808] z-40">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/game"
              ? pathname === "/game"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="relative flex flex-col items-center justify-center w-12 h-12 rounded-sm transition-all duration-150 group"
              style={{
                color: active ? "#e8001c" : "#3a3a3a",
                background: active ? "rgba(232,0,28,0.08)" : "transparent",
              }}
            >
              {item.icon}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#e8001c]" />
              )}
              <span className="absolute left-full ml-3 px-2 py-1 bg-[#1a1a1a] text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/[0.08]" style={{ fontFamily: "var(--font-mono)" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </aside>
    </>
  );
}
