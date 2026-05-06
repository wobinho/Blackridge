// Centralized upgrade definitions
// Each field stores LEVEL (0 = no upgrades applied)
// Actual game value = base + level * increment

export const UPGRADE_DEFS: Record<string, { base: number; increment: number; maxLevel: number }> = {
  develop_slots:       { base: 2,   increment: 1,   maxLevel: 8  },  // max 10 slots
  develop_speed:       { base: 0,   increment: 5,   maxLevel: 10 },  // max -50% reduction
  inventory_size:      { base: 20,  increment: 10,  maxLevel: 18 },  // max 200 parts
  inventory_mats_size: { base: 200, increment: 100, maxLevel: 18 },  // max 2000 mats
  engineer_cap:        { base: 4,   increment: 2,   maxLevel: 18 },  // max 40
  driver_cap:          { base: 4,   increment: 2,   maxLevel: 18 },  // max 40
  garage_cap:          { base: 20,  increment: 10,  maxLevel: 18 },  // max 200
  market_mat_slots:    { base: 4,   increment: 2,   maxLevel: 4  },  // max 12
};

export function getActualValue(field: string, level: number): number {
  const def = UPGRADE_DEFS[field];
  if (!def) return level;
  return def.base + level * def.increment;
}

export function getMaxLevel(field: string): number {
  return UPGRADE_DEFS[field]?.maxLevel ?? 0;
}
