import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import Link from "next/link";

interface DashboardData {
  carCount: number;
  driverCount: number;
  activeRaces: number;
  craftingCount: number;
  recentActivity: Array<{ message: string; created_at: number; credits_delta: number }>;
}

async function getDashboardData(userId: number): Promise<DashboardData> {
  const db = await initDb();
  await seedDatabase(db);

  const carCount = (db.prepare("SELECT COUNT(*) as c FROM cars WHERE user_id = ?").get(userId) as { c: number }).c;
  const driverCount = (db.prepare("SELECT COUNT(*) as c FROM drivers WHERE user_id = ?").get(userId) as { c: number }).c;
  const activeRaces = (db.prepare("SELECT COUNT(*) as c FROM races WHERE user_id = ? AND status IN ('scheduled','in_progress')").get(userId) as { c: number }).c;
  const craftingCount = (db.prepare("SELECT COUNT(*) as c FROM crafting_queue WHERE user_id = ? AND status IN ('queued','crafting')").get(userId) as { c: number }).c;
  const recentActivity = db.prepare("SELECT message, created_at, credits_delta FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").all(userId) as Array<{ message: string; created_at: number; credits_delta: number }>;

  return { carCount, driverCount, activeRaces, craftingCount, recentActivity };
}

export default async function GameHQPage() {
  const session = await getSession();
  if (!session) return null;

  const data = await getDashboardData(session.id);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="md:ml-16 pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-6">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p className="section-tag mb-1">{greeting}, {session.username}</p>
          <h1
            className="text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 6vw, 52px)",
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}
          >
            {session.brand_name.toUpperCase()}
          </h1>
          <p className="text-[#444] text-sm mt-2">Brand HQ — Season 01</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Credits", value: session.credits.toLocaleString(), suffix: "CR", color: "#fff" },
            { label: "Prestige", value: session.prestige.toLocaleString(), suffix: "PTS", color: "#c9a84c" },
            { label: "Level", value: String(session.level), suffix: "", color: "#e8001c" },
            { label: "Reputation", value: "—", suffix: "", color: "#555" },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <p className="text-xs text-[#444] tracking-widest uppercase mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                {stat.label}
              </p>
              <p
                className="number-display"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "28px",
                  letterSpacing: "0.04em",
                  color: stat.color,
                }}
              >
                {stat.value}
                {stat.suffix && (
                  <span className="text-xs ml-1" style={{ color: "#444", fontFamily: "var(--font-mono)" }}>
                    {stat.suffix}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Quick status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Cars in Garage", value: data.carCount, href: "/game/garage", cta: data.carCount === 0 ? "Build First Car" : "View Garage" },
            { label: "Drivers", value: data.driverCount, href: "/game/drivers", cta: "Manage Drivers" },
            { label: "Active Races", value: data.activeRaces, href: "/game/race", cta: data.activeRaces === 0 ? "Send to Race" : "View Races" },
            { label: "Crafting", value: data.craftingCount, href: "/game/workshop", cta: data.craftingCount === 0 ? "Start Crafting" : "View Queue" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="card p-4 card-hover cursor-pointer group transition-all duration-200"
            >
              <p className="text-xs text-[#444] tracking-widest uppercase mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                {item.label}
              </p>
              <p
                className="number-display mb-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "36px",
                  color: item.value > 0 ? "#fff" : "#2a2a2a",
                }}
              >
                {item.value}
              </p>
              <p className="text-xs text-[#e8001c] group-hover:text-[#ff1a35] transition-colors">
                {item.cta} →
              </p>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="accent-line" />
            <h2
              className="text-white text-sm tracking-widest uppercase"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.15em" }}
            >
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                href: "/game/workshop",
                title: "Craft Parts",
                desc: "Build components in the workshop",
                icon: "⚙",
              },
              {
                href: "/game/race",
                title: "Start a Race",
                desc: "Send drivers to earn credits & materials",
                icon: "🏁",
              },
              {
                href: "/game/market",
                title: "Visit Market",
                desc: "Buy, sell, and trade with other brands",
                icon: "◈",
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="card p-5 card-hover flex items-start gap-4 group transition-all duration-200"
              >
                <span className="text-2xl flex-shrink-0 mt-0.5 opacity-60">{action.icon}</span>
                <div>
                  <p
                    className="text-white text-sm mb-1"
                    style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
                  >
                    {action.title.toUpperCase()}
                  </p>
                  <p className="text-xs text-[#444]">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity log + Getting started */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Activity */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="accent-line" />
              <h2
                className="text-white text-sm tracking-widest uppercase"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.15em" }}
              >
                Activity
              </h2>
            </div>
            <div className="card">
              {data.recentActivity.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-[#333] text-sm">No activity yet.</p>
                  <p className="text-xs text-[#252525] mt-1">Start racing or crafting to see updates here.</p>
                </div>
              ) : (
                data.recentActivity.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0"
                  >
                    <p className="text-sm text-[#666]">{log.message}</p>
                    {log.credits_delta !== 0 && (
                      <span
                        className="text-xs flex-shrink-0 number-display"
                        style={{
                          color: log.credits_delta > 0 ? "#4ade80" : "#e8001c",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {log.credits_delta > 0 ? "+" : ""}
                        {log.credits_delta.toLocaleString()} CR
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Getting started */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="accent-line" />
              <h2
                className="text-white text-sm tracking-widest uppercase"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.15em" }}
              >
                Getting Started
              </h2>
            </div>
            <div className="card">
              {[
                { label: "Craft your first part", done: false, href: "/game/workshop" },
                { label: "Recruit a driver", done: data.driverCount > 0, href: "/game/drivers" },
                { label: "Build your first car", done: data.carCount > 0, href: "/game/garage" },
                { label: "Enter a race", done: false, href: "/game/race" },
                { label: "List a car on the market", done: false, href: "/game/market" },
              ].map((task, i) => (
                <Link
                  key={i}
                  href={task.href}
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 group hover:bg-white/[0.02] transition-colors"
                >
                  <div
                    className="w-4 h-4 flex-shrink-0 flex items-center justify-center border"
                    style={{
                      borderColor: task.done ? "#4ade80" : "#2a2a2a",
                      background: task.done ? "rgba(74,222,128,0.1)" : "transparent",
                    }}
                  >
                    {task.done && (
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="#4ade80" strokeWidth="2">
                        <path d="M2 6l3 3 5-5"/>
                      </svg>
                    )}
                  </div>
                  <span
                    className="text-sm transition-colors"
                    style={{ color: task.done ? "#3a3a3a" : "#666" }}
                  >
                    {task.label}
                  </span>
                  {!task.done && (
                    <span className="ml-auto text-xs text-[#e8001c] opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
