// Centralized upgrade definitions
// Each field stores LEVEL (0 = no upgrades applied)
// Actual game value = base + level * increment

export const UPGRADE_DEFS: Record<string, { base: number; increment: number; maxLevel: number }> = {
  develop_slots:       { base: 2,   increment: 1,   maxLevel: 8  },
  develop_speed:       { base: 0,   increment: 5,   maxLevel: 10 },  // 5 = 5% reduction
  inventory_size:      { base: 30,  increment: 10,  maxLevel: 12 },  // parts inventory
  inventory_mats_size: { base: 200, increment: 100, maxLevel: 18 },  // materials inventory
  engineer_cap:        { base: 4,   increment: 2,   maxLevel: 23 },
  driver_cap:          { base: 4,   increment: 2,   maxLevel: 23 },
  garage_cap:          { base: 10,  increment: 5,   maxLevel: 18 },
  market_mat_slots:    { base: 4,   increment: 2,   maxLevel: 4  },
  market_mat_rarity:   { base: 0,   increment: 1,   maxLevel: 5  },
};

export function getActualValue(field: string, level: number): number {
  const def = UPGRADE_DEFS[field];
  if (!def) return level;
  return def.base + level * def.increment;
}

export function getMaxLevel(field: string): number {
  return UPGRADE_DEFS[field]?.maxLevel ?? 0;
}
