import React, { useEffect, useMemo, useState } from "react";
import Meters from "../components/Meters";
import { NODES } from "../data/nodes";
import { MeterKey, Option } from "../types/game";
import { initialMeters, clampScore, scoreVerdict } from "../utils/score";
import { buildTranscript as buildTranscriptUtil } from "../utils/transcript";

export default function PMAdventureApp() {
  const EMAIL_ENDPOINT = "/api/sendTranscript"; // change if deployed elsewhere
  const [currentId, setCurrentId] = useState<string>("kickoff");
  const [meters, setMeters] = useState<Record<MeterKey, number>>({ ...initialMeters });
  const [history, setHistory] = useState<{ id: string; choice?: string; label?: string }[]>([{ id: "kickoff" }]);
  const [toast, setToast] = useState<string>("");
  const [isDark, setIsDark] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false);

  const node = NODES[currentId];

  const total = useMemo(() => meters.time + meters.cost + meters.scope + meters.stake, [meters]);

  function applyImpact(impact?: Partial<Record<MeterKey, number>>) {
    if (!impact) return;
    setMeters((m) => ({
      time: clampScore(m.time + (impact.time ?? 0)),
      cost: clampScore(m.cost + (impact.cost ?? 0)),
      scope: clampScore(m.scope + (impact.scope ?? 0)),
      stake: clampScore(m.stake + (impact.stake ?? 0)),
    }));
  }

  function onSelect(opt: Option) {
    const isQuiz = !!node.quiz;
    if (isQuiz) {
      if (opt.key === node.quiz!.correctKey) {
        applyImpact(opt.impact);
        setToast(opt.feedback || "");
        advance(opt);
      } else {
        setToast(opt.feedback || "Try again.");
        // stay or loop to given next
        setCurrentId(opt.next);
        setHistory((h) => [...h, { id: node.id, choice: opt.key, label: opt.label }]);
      }
    } else {
      applyImpact(opt.impact);
      setToast(opt.feedback || "");
      advance(opt);
    }
  }

  function advance(opt: Option) {
    // Special handler for download from ending
    if (node.isEnding && opt.key === "t") {
      downloadTranscript();
      return;
    }
    setCurrentId(opt.next);
    setHistory((h) => [...h, { id: opt.next, choice: opt.key, label: opt.label }]);
  }

  function resetGame() {
    setCurrentId("kickoff");
    setMeters({ ...initialMeters });
    setHistory([{ id: "kickoff" }]);
    setToast("");
  }

  function buildTranscript() {
    return buildTranscriptUtil(history, meters, NODES);
  }

  function downloadTranscript() {
    const text = buildTranscript();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pm_adventure_transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function emailTranscript() {
    try {
      const text = buildTranscript();
      const res = await fetch(EMAIL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "PM Adventure Transcript", transcript: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToast("Sent.");
    } catch (e) {
      setToast("Email failed. Check the API endpoint.");
    }
  }

  const endingSummary = useMemo(() => {
    if (!node.isEnding) return "";
    const parts = [
      `Time is ${scoreVerdict(meters.time)}.`,
      `Cost control is ${scoreVerdict(meters.cost)}.`,
      `Scope clarity is ${scoreVerdict(meters.scope)}.`,
      `Stakeholder trust is ${scoreVerdict(meters.stake)}.`,
    ];
    const overall = scoreVerdict(total);
    return `Outcome is ${overall}. ${parts.join(" ")}`;
  }, [node.isEnding, meters, total]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Toggle theme (Shift + D)
      if (e.shiftKey && k === 'd') {
        e.preventDefault();
        const next = !document.documentElement.classList.contains('dark');
        if (next) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', next ? 'dark' : 'light');
        setIsDark(next);
        return;
      }
      // Reset (r)
      if (k === 'r') {
        e.preventDefault();
        resetGame();
        return;
      }
      // Transcript download (t) at ending
      if (k === 't' && node.isEnding) {
        e.preventDefault();
        onSelect({ key: 't', label: 'Download transcript', next: 'ending' });
        return;
      }
      // Options (a,b,c,...) match node.options keys
      const match = node.options.find(o => o.key.toLowerCase() === k);
      if (match) {
        e.preventDefault();
        onSelect(match);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node]);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-10 font-sans">
      <header className="mb-6 md:mb-8">
        <div className="card p-5 md:p-6 bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-soft">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Project Management Adventure</h1>
              <p className="text-sm/6 opacity-95 mt-1">A concise, text‑based simulation for scope, time, cost, and stakeholder tradeoffs.</p>
            </div>
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  const next = !isDark;
                  const root = document.documentElement;
                  if (next) root.classList.add('dark'); else root.classList.remove('dark');
                  localStorage.setItem('theme', next ? 'dark' : 'light');
                  setIsDark(next);
                }}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition"
                aria-label="Toggle dark mode"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  // Sun icon
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 12 2.25Zm0 16.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V19.5a.75.75 0 0 1 .75-.75Zm9-6a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H20.25a.75.75 0 0 1 .75.75Zm-16.5 0a.75.75 0 0 1-.75.75H2.25a.75.75 0 0 1 0-1.5H3.75a.75.75 0 0 1 .75.75Zm12.803 6.053a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06Zm-11.326-11.326a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm12.386 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06Zm-11.326 11.326-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 1 1 1.06 1.06Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  // Moon icon
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M21.752 15.002A9.718 9.718 0 0 1 12.27 22C6.592 22 2 17.408 2 11.73A9.718 9.718 0 0 1 8.998 2.248a.75.75 0 0 1 .94.977 8.218 8.218 0 0 0 10.787 10.787.75.75 0 0 1 .977.99Z" />
                  </svg>
                )}
              </button>
              <div className="pointer-events-none absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
                <div className="rounded-md bg-black/80 text-white text-xs px-2 py-1 shadow">
                  Toggle theme <span className="kbd align-[-1px]">⇧ D</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Meters meters={meters} />

      <section className="mt-6 card p-6 md:p-7 animate-fade-in">
        <div className="text-xs uppercase tracking-wide opacity-60">Location</div>
        <h2 className="text-xl font-semibold">{node.location}</h2>
        <div className="mt-3 space-y-3 leading-relaxed">
          {node.description.map((s, i) => (
            <p key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>{s}</p>
          ))}
          {node.isEnding && (
            <p className="font-medium mt-2 animate-fade-in" style={{ animationDelay: `${node.description.length * 50}ms` }}>{endingSummary}</p>
          )}
        </div>

        {node.quiz && (
          <p className="mt-4 italic">{node.quiz.prompt}</p>
        )}

        <div className="mt-4 grid gap-3">
          {node.options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSelect(opt)}
              className="btn text-left transition-transform hover:-translate-y-0.5"
              title={`Press ${opt.key.toUpperCase()}`}
            >
              <span className="mr-2 font-mono">{opt.key}.</span> {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="relative group">
            <button onClick={resetGame} className="btn" title="Reset (R)">Reset</button>
            <div className="pointer-events-none absolute left-0 top-full mt-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
              <div className="rounded-md bg-black/80 text-white text-xs px-2 py-1 shadow">Reset <span className="kbd align-[-1px]">R</span></div>
            </div>
          </div>
          {node.isEnding && (
            <div className="flex gap-3">
              <div className="relative group">
                <button onClick={() => onSelect({ key: "t", label: "Download transcript", next: "ending" })} className="btn" title="Download transcript (T at ending)">Download transcript</button>
                <div className="pointer-events-none absolute left-0 top-full mt-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
                  <div className="rounded-md bg-black/80 text-white text-xs px-2 py-1 shadow">Download transcript <span className="kbd align-[-1px]">T</span></div>
                </div>
              </div>
              <div className="relative group">
                <button onClick={emailTranscript} className="btn" title="Send transcript via API">Email me the transcript</button>
                <div className="pointer-events-none absolute left-0 top-full mt-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
                  <div className="rounded-md bg-black/80 text-white text-xs px-2 py-1 shadow">Sends via /api/sendTranscript</div>
                </div>
              </div>
            </div>
          )}
          {toast && <span className="text-sm opacity-80">{toast}</span>}
        </div>
      </section>

      <footer className="mt-8 text-xs opacity-60">
        <p>Tip: project choices adjust meters. Keep them balanced for a strong close‑out.</p>
      </footer>
    </div>
  );
}
