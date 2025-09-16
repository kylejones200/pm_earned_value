import { MeterKey } from "../types/game";

export const initialMeters: Record<MeterKey, number> = { time: 0, cost: 0, scope: 0, stake: 0 };

export function clampScore(x: number) {
  return Math.max(-10, Math.min(10, x));
}

export function scoreVerdict(v: number) {
  if (v >= 6) return "excellent";
  if (v >= 2) return "good";
  if (v > -2) return "mixed";
  if (v > -6) return "poor";
  return "critical";
}
