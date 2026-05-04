import path from "path";
import fs from "fs";
import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";

const DB_PATH = path.resolve(process.cwd(), "data/blackridge.db");
const SCHEMA_PATH = path.join(process.cwd(), "src/lib/schema.sql");

let sqlJs: SqlJsStatic | null = null;
let db: SqlJsDatabase | null = null;
let dirty = false;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJs) return sqlJs;
  sqlJs = await initSqlJs();
  return sqlJs;
}

function persist() {
  if (!db || !dirty) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
  dirty = false;
}

// Wrap sql.js into a synchronous-style API matching better-sqlite3
export interface Statement {
  run(...params: unknown[]): { lastInsertRowid: number; changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface DbWrapper {
  prepare(sql: string): Statement;
  pragma(pragma: string): void;
  exec(sql: string): void;
  close(): void;
}

let wrapper: DbWrapper | null = null;

export function getDb(): DbWrapper {
  if (wrapper) return wrapper;
  throw new Error("Database not initialised. Call initDb() first.");
}

export async function initDb(): Promise<DbWrapper> {
  if (wrapper) return wrapper;

  if (!fs.existsSync(DB_PATH)) {
    throw new Error("Database file not found: data/blackridge.db must exist.");
  }

  const SQL = await getSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  db = new SQL.Database(fileBuffer);

  // Apply schema (all CREATE TABLE IF NOT EXISTS — safe to re-run)
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.run(schema);

  // Additive column migrations — each runs only if the column doesn't exist yet
  applyColumnMigrations(db);

  persist();

  wrapper = makeWrapper(db);
  return wrapper;
}

function applyColumnMigrations(database: import("sql.js").Database): void {
  const pending: Array<{ table: string; column: string; def: string }> = [
    { table: "driver_templates", column: "art",              def: "TEXT" },
    { table: "car_templates",    column: "art",              def: "TEXT" },
    { table: "part_templates",   column: "art",              def: "TEXT" },
    { table: "crafting_queue",   column: "engineer_id",      def: "INTEGER" },
    { table: "crafting_queue",   column: "slot_index",       def: "INTEGER NOT NULL DEFAULT 0" },
    { table: "users",            column: "xgear",            def: "INTEGER NOT NULL DEFAULT 0" },
    { table: "circuits",         column: "archetype",        def: "TEXT" },
    { table: "circuits",         column: "min_speed",        def: "INTEGER NOT NULL DEFAULT 0" },
    { table: "circuits",         column: "min_handling",     def: "INTEGER NOT NULL DEFAULT 0" },
    { table: "circuits",         column: "duration_seconds", def: "INTEGER NOT NULL DEFAULT 300" },
    { table: "circuits",         column: "podium_rewards",   def: "TEXT NOT NULL DEFAULT '[]'" },
    { table: "races",            column: "engineer_id",      def: "INTEGER" },
    { table: "races",            column: "completes_at",     def: "INTEGER NOT NULL DEFAULT (unixepoch())" },
    { table: "materials",        column: "art",              def: "TEXT" },
    { table: "part_templates",   column: "rarity",           def: "TEXT NOT NULL DEFAULT 'common'" },
  ];
  for (const m of pending) {
    try {
      const result = database.exec(`PRAGMA table_info(${m.table})`);
      const names = (result[0]?.values ?? []).map((r) => r[1] as string);
      if (!names.includes(m.column)) {
        database.run(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.def}`);
      }
    } catch {
      // table may not exist yet — schema handles creation
    }
  }
}

function makeWrapper(database: SqlJsDatabase): DbWrapper {
  return {
    prepare(sql: string): Statement {
      return {
        run(...params: unknown[]) {
          database.run(sql, params as never[]);
          dirty = true;
          persist();
          // sql.js doesn't expose lastInsertRowid directly; query it
          const rows = database.exec("SELECT last_insert_rowid() as id");
          const lastInsertRowid = rows[0]?.values[0]?.[0] as number ?? 0;
          return { lastInsertRowid, changes: database.getRowsModified() };
        },
        get(...params: unknown[]) {
          const stmt = database.prepare(sql);
          stmt.bind(params as never[]);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params: unknown[]) {
          const stmt = database.prepare(sql);
          stmt.bind(params as never[]);
          const rows: unknown[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      };
    },
    pragma(_pragma: string) {
      // WAL and foreign_keys handled at open time via schema
    },
    exec(sql: string) {
      database.run(sql);
      dirty = true;
      persist();
    },
    close() {
      persist();
      database.close();
      wrapper = null;
      db = null;
    },
  };
}

export function closeDb(): void {
  wrapper?.close();
}
