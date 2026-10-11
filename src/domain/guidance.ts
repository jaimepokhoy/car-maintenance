import type { MaintenanceItemId } from './types';

export type DiyLevel = 'easy' | 'moderate' | 'shop';

export interface ItemGuidance {
  /** Rough shop price range in CAD cents, for setting expectations. */
  costCents: [number, number];
  diy: DiyLevel;
}

/**
 * Typical Canadian shop prices (2026) and how DIY-friendly each item is.
 * Rough ranges for setting expectations, not quotes. The plain-language
 * explanations live in the locale files under `guidance.<item>`.
 */
export const GUIDANCE: Record<MaintenanceItemId, ItemGuidance> = {
  oil_change: { costCents: [8_000, 15_000], diy: 'moderate' },
  tire_rotation: { costCents: [3_000, 6_000], diy: 'moderate' },
  brake_inspection: { costCents: [0, 8_000], diy: 'shop' },
  brake_fluid: { costCents: [10_000, 18_000], diy: 'shop' },
  engine_air_filter: { costCents: [3_000, 8_000], diy: 'easy' },
  cabin_air_filter: { costCents: [4_000, 10_000], diy: 'easy' },
  coolant: { costCents: [12_000, 25_000], diy: 'shop' },
  transmission_fluid: { costCents: [15_000, 40_000], diy: 'shop' },
  spark_plugs: { costCents: [15_000, 45_000], diy: 'shop' },
  battery_12v: { costCents: [0, 3_000], diy: 'shop' },
  hv_battery_check: { costCents: [0, 15_000], diy: 'shop' },
  wiper_blades: { costCents: [3_000, 7_000], diy: 'easy' },
};
