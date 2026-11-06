/* Carnet Bench — fonctions partagées entre l'appli (index.html) et le mode coach (coach.html). */
(function (g) {
  "use strict";
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const DAYS_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseIso = s => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
  const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
  const monday = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return iso(x); };
  const fmt = s => { const d = parseIso(s); return d.getDate() + " " + MONTHS[d.getMonth()]; };
  const fmtY = s => fmt(s) + " " + parseIso(s).getFullYear();
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = v => { if (v == null) return NaN; const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const slug = s => String(s || "exercice").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "exercice";

  /* Version du programme en vigueur pour une semaine donnée (lundi ISO). */
  function versionFor(prog, week) {
    const vs = (prog?.versions || []).slice().sort((a, b) => a.from.localeCompare(b.from));
    let v = null;
    for (const x of vs) if (x.from <= week) v = x;
    return v || vs[0] || null;
  }

  /* Tempo : champ dédié, ou ancien format "Tempo 3 1 0 0" dans les remarques. */
  function tempoOf(ex) {
    if (ex.tempo && /\d/.test(ex.tempo)) return ex.tempo.trim().split(/[\s-]+/).slice(0, 4);
    const m = (ex.notes || "").match(/tempo\s+(\d)\s+(\d)\s+(\d)\s+(\d)/i);
    return m ? [m[1], m[2], m[3], m[4]] : null;
  }
  const notesOf = ex => (ex.notes || "").replace(/tempo\s+\d\s+\d\s+\d\s+\d\s*\n?/i, "").trim();

  function restSec(t) {
    if (!t) return 0; t = String(t).toLowerCase();
    if (/superset/.test(t)) return 0;
    let m = t.match(/(\d+)\s*(?:-\s*\d+)?\s*min(?:\s*(\d+))?/);
    if (m) return +m[1] * 60 + (m[2] ? +m[2] : 0);
    m = t.match(/(\d+)\s*s/);
    return m ? +m[1] : 0;
  }

  async function loadProgram() {
    const r = await fetch("programme.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("programme.json introuvable (" + r.status + ")");
    return r.json();
  }

  g.CB = { MONTHS, DAYS, DAYS_LONG, pad, iso, parseIso, addDays, monday, fmt, fmtY, esc, num, slug, versionFor, tempoOf, notesOf, restSec, loadProgram };
})(window);
