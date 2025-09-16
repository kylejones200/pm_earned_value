import { Node, MeterKey } from "../types/game";

export function buildTranscript(
  history: { id: string; choice?: string; label?: string }[],
  meters: Record<MeterKey, number>,
  nodes: Record<string, Node>
) {
  const lines: string[] = [];
  lines.push("Project Management Adventure – Transcript");
  lines.push(new Date().toISOString());
  lines.push("");
  history.forEach((h, i) => {
    const n = nodes[h.id];
    lines.push(`${i + 1}. ${n.location}`);
    if (h.label) lines.push(`   Choice: ${h.label}`);
  });
  lines.push("");
  lines.push(
    `Scores – Time: ${meters.time}, Cost: ${meters.cost}, Scope: ${meters.scope}, Stake: ${meters.stake}`
  );
  return lines.join("\n");
}
