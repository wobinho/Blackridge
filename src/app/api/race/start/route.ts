import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { circuit_id, driver_id, engineer_id, car_id } = body as {
    circuit_id: number;
    driver_id: number;
    engineer_id?: number | null;
    car_id: number;
  };

  if (!circuit_id || !driver_id || !car_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const now = Math.floor(Date.now() / 1000);

  // Validate circuit
  const circuit = db.prepare(
    `SELECT id, duration_seconds, min_speed, min_handling FROM circuits WHERE id = ?`
  ).get(circuit_id) as { id: number; duration_seconds: number; min_speed: number; min_handling: number } | undefined;
  if (!circuit) return NextResponse.json({ error: "Circuit not found" }, { status: 404 });

  // Validate driver belongs to user and is idle
  const driver = db.prepare(
    `SELECT id, status FROM drivers WHERE id = ? AND user_id = ?`
  ).get(driver_id, session.id) as { id: number; status: string } | undefined;
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  if (driver.status !== "idle") return NextResponse.json({ error: "Driver is not available" }, { status: 400 });

  // Validate car belongs to user and is in garage
  const car = db.prepare(
    `SELECT id, status, speed, handling FROM cars WHERE id = ? AND user_id = ?`
  ).get(car_id, session.id) as { id: number; status: string; speed: number; handling: number } | undefined;
  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });
  if (car.status !== "garage") return NextResponse.json({ error: "Car is not available" }, { status: 400 });

  // Check min requirements
  if (circuit.min_speed > 0 && car.speed < circuit.min_speed) {
    return NextResponse.json({ error: `Car speed (${car.speed}) below circuit minimum (${circuit.min_speed})` }, { status: 400 });
  }
  if (circuit.min_handling > 0 && car.handling < circuit.min_handling) {
    return NextResponse.json({ error: `Car handling (${car.handling}) below circuit minimum (${circuit.min_handling})` }, { status: 400 });
  }

  // Validate engineer if provided
  if (engineer_id) {
    const engineer = db.prepare(
      `SELECT id, status FROM engineers WHERE id = ? AND user_id = ?`
    ).get(engineer_id, session.id) as { id: number; status: string } | undefined;
    if (!engineer) return NextResponse.json({ error: "Engineer not found" }, { status: 404 });
    if (engineer.status !== "idle") return NextResponse.json({ error: "Engineer is not available" }, { status: 400 });
  }

  // Check no active race already running with same car/driver/engineer
  const existingRace = db.prepare(
    `SELECT id FROM races WHERE user_id = ? AND status IN ('scheduled','in_progress') AND (car_id = ? OR driver_id = ?)`
  ).get(session.id, car_id, driver_id) as { id: number } | undefined;
  if (existingRace) {
    return NextResponse.json({ error: "Car or driver already in a race" }, { status: 400 });
  }

  const completes_at = now + circuit.duration_seconds;

  // Insert race
  const result = db.prepare(
    `INSERT INTO races (user_id, circuit_id, driver_id, engineer_id, car_id, status, started_at, completes_at)
     VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?)`
  ).run(session.id, circuit_id, driver_id, engineer_id ?? null, car_id, now, completes_at);

  const race_id = result.lastInsertRowid;

  // Lock driver, car, engineer
  db.prepare(`UPDATE drivers SET status = 'racing' WHERE id = ?`).run(driver_id);
  db.prepare(`UPDATE cars SET status = 'racing' WHERE id = ?`).run(car_id);
  if (engineer_id) {
    db.prepare(`UPDATE engineers SET status = 'racing' WHERE id = ?`).run(engineer_id);
  }

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'race_start', ?, ?)`
  ).run(session.id, `Started race at circuit ${circuit_id}`, JSON.stringify({ race_id, circuit_id, driver_id, car_id }));

  return NextResponse.json({ success: true, race_id, completes_at });
}
