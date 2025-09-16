import React from "react";
import { MeterKey } from "../types/game";
import { scoreVerdict } from "../utils/score";

function Bar({ value }: { value: number }) {
  const perc = ((value + 10) / 20) * 100; // map -10..10 to 0..100
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
        style={{ width: `${perc}%` }}
      />
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const verdict = scoreVerdict(value);
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide opacity-60">{label}</span>
        <span className="text-xs opacity-60">{value}</span>
      </div>
      <div className="mt-2"><Bar value={value} /></div>
      <div className="mt-1 text-xs opacity-70">{verdict}</div>
    </div>
  );
}

export default function Meters({ meters }: { meters: Record<MeterKey, number> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Meter label="Time" value={meters.time} />
      <Meter label="Cost" value={meters.cost} />
      <Meter label="Scope" value={meters.scope} />
      <Meter label="Stakeholders" value={meters.stake} />
    </div>
  );
}
