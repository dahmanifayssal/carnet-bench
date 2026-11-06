/* Carnet Bench — appli de l'athlète.
   Programme : programme.json (mis à jour par le coach).
   Séances et bilans : enregistrés dans ce navigateur (localStorage). Penser à exporter une sauvegarde. */
(function () {
  "use strict";
  const { DAYS, iso, addDays, monday, fmt, esc, num, versionFor, tempoOf, notesOf, restSec, loadProgram } = CB;
  const KEY = "carnet-bench.v1";
  const S = { tab: "seance", week: monday(new Date()), session: null, prog: null, logs: {}, reviews: {}, progEx: null, err: null };
  const $ = s => document.querySelector(s);
  const todayIso = iso(new Date());
  let needsRender = false, saveT = null;

  /* ---------- stockage local ---------- */
  function loadStore() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || "{}"); S.logs = d.logs || {}; S.reviews = d.reviews || {}; S.lastBackup = d.lastBackup || null; } catch (e) { S.storeErr = true; }
    try { const t = localStorage.getItem("cb.tab"); if (t) S.tab = t; } catch (e) {}
    try { navigator.storage?.persist?.(); } catch (e) {}
  }
  function persist() {
    clearTimeout(saveT);
    setStatus("Enregistrement…");
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify({ logs: S.logs, reviews: S.reviews, lastBackup: S.lastBackup })); setStatus("Enregistré sur ce téléphone"); }
      catch (e) { setStatus("Impossible d'enregistrer (stockage plein ou bloqué)", true); }
    }, 300);
  }
  function setStatus(t, err) { const el = $("#saveStatus"); if (el) { el.textContent = t; el.classList.toggle("err", !!err); } }
  addEventListener("pagehide", () => { if (saveT) { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify({ logs: S.logs, reviews: S.reviews, lastBackup: S.lastBackup })); } catch (e) {} } });

  /* ---------- programme ---------- */
  const ver = () => versionFor(S.prog, S.week);
  const sessDef = id => ver()?.sessions.find(s => s.id === id);
  const logId = (w, s) => w + "_" + s;
  const getLog = (w, s) => S.logs[logId(w, s)];
  function sessionState(w, s) {
    const l = getLog(w, s); if (!l) return "todo";
    const def = versionFor(S.prog, w)?.sessions.find(x => x.id === s);
    let tot = 0, done = 0;
    (def?.exercises || []).forEach(e => { tot += +e.sets || 0; (l.entries?.[e.id]?.sets || []).forEach(x => { if (x.done) done++; }); });
    if (!done) return "todo"; return done >= tot ? "done" : "part";
  }
  const sortedLogs = () => Object.values(S.logs).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  function lastPerf(exId, beforeDate, excludeId) {
    const L = sortedLogs().filter(l => logId(l.week, l.session) !== excludeId && (l.date || "") < beforeDate);
    for (let i = L.length - 1; i >= 0; i--) { const en = L[i].entries?.[exId]; if (en && en.sets?.some(x => x.r || x.w)) return { date: L[i].date, sets: en.sets }; }
    return null;
  }
  const setsText = (sets, unit) => sets.filter(x => x.r || x.w).map(x => { const w = x.w && x.w !== "—" ? x.w : ""; return esc(x.r || "?") + (unit === "sec" ? " s" : "") + (w ? " × " + esc(w) : ""); }).join(" · ");
  const rpeText = sets => { const r = sets.map(x => x.rpe).filter(Boolean); return r.length ? "RPE " + r.join(", ") : ""; };

  function ensureLog(w, s) {
    const id = logId(w, s);
    if (!S.logs[id]) { const def = sessDef(s); S.logs[id] = { week: w, session: s, date: addDays(w, def?.day || 0), sleep: "", comment: "", entries: {} }; }
    return S.logs[id];
  }
  function entryFor(l, exId) {
    const def = sessDef(S.session).exercises.find(x => x.id === exId);
    const en = l.entries[exId] || (l.entries[exId] = { name: def.name, sets: [] });
    return { en, def };
  }
  const touch = l => { l.updatedAt = new Date().toISOString(); persist(); };

  /* ---------- rendu ---------- */
  function render() {
    const a = document.activeElement;
    if (a && $("#view").contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== "range" && a.type !== "file") { needsRender = true; return; }
    needsRender = false;
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === S.tab));
    $("#weekbar").hidden = S.tab === "progres";
    $("#wkLabel").innerHTML = "Semaine du " + fmt(S.week) + (S.week === monday(new Date()) ? "<small>Cette semaine</small>" : "<small>au " + fmt(addDays(S.week, 6)) + "</small>");
    $("#block").textContent = ver()?.label || "";
    const v = $("#view");
    if (!S.prog) { v.innerHTML = S.err ? `<div class="empty"><b>Programme indisponible</b>${esc(S.err)}</div>` : `<div class="empty"><b>Chargement du programme…</b></div>`; return; }
    v.innerHTML = (S.storeErr ? `<div class="banner">Ce navigateur bloque l'enregistrement local : tes séances ne seront pas gardées. Ouvre l'appli dans un onglet normal (pas en navigation privée).</div>` : "") +
      (S.tab === "seance" ? renderSession() : S.tab === "progres" ? renderProgress() : renderReview());
  }
  function pickDefaultSession() {
    const ss = ver()?.sessions || []; if (!ss.length) { S.session = null; return; }
    if (S.week === monday(new Date())) {
      const k = (new Date().getDay() + 6) % 7;
      const t = ss.find(s => s.day === k); if (t) { S.session = t.id; return; }
      const nx = ss.find(s => s.day >= k && sessionState(S.week, s.id) !== "done"); if (nx) { S.session = nx.id; return; }
    }
    S.session = (ss.find(s => sessionState(S.week, s.id) !== "done") || ss[0]).id;
  }

  function renderSession() {
    const V = ver(); if (!V || !V.sessions.length) return `<div class="empty"><b>Pas de séance prévue</b>Le coach n'a pas encore mis de programme pour cette semaine.</div>`;
    if (!S.session || !sessDef(S.session)) pickDefaultSession();
    const tabs = V.sessions.map((s, i) => {
      const st = sessionState(S.week, s.id), d = addDays(S.week, s.day);
      const lab = st === "done" ? "✓ Faite" : st === "part" ? "En cours" : (d === todayIso ? "Aujourd'hui" : "À faire");
      return `<button class="sess c-${i % 3}" data-sess="${esc(s.id)}" aria-pressed="${s.id === S.session}"><b>${esc(s.name)}</b><small>${DAYS[s.day]} ${fmt(d)}</small><span class="st ${st}">${lab}</span></button>`;
    }).join("");
    const si = V.sessions.findIndex(s => s.id === S.session);
    const def = V.sessions[si], id = logId(S.week, S.session), l = S.logs[id] || { entries: {} };
    const date = addDays(S.week, def.day);
    const ex = def.exercises.map((e, i) => {
      const en = l.entries?.[e.id], prev = lastPerf(e.id, date, id);
      const sets = +e.sets || 1, n = Math.max(sets, en?.sets?.length || 0);
      const tempo = tempoOf(e), notes = notesOf(e);
      const allDone = en && en.sets?.length >= sets && en.sets.slice(0, sets).every(x => x.done);
      const loads = (e.load || "").split("/").map(x => x.trim());
      let rows = "";
      for (let k = 0; k < n; k++) {
        const x = en?.sets?.[k] || {}, p = prev?.sets?.[k] || prev?.sets?.[prev.sets.length - 1] || {};
        const phW = p.w || (e.load && e.load !== "—" ? loads[Math.min(k, loads.length - 1)] : "");
        const phR = p.r || (e.unit === "sec" ? "30" : (String(e.reps || "").match(/\d+/) || [""])[0]);
        rows += `<div class="set${x.done ? " done" : ""}" data-ex="${esc(e.id)}" data-k="${k}">
          <span class="n">${k + 1}</span>
          <input id="r-${esc(e.id)}-${k}" inputmode="numeric" data-f="r" value="${esc(x.r)}" placeholder="${esc(phR)}" aria-label="Série ${k + 1} ${e.unit === "sec" ? "secondes" : "répétitions"}">
          <input id="w-${esc(e.id)}-${k}" inputmode="decimal" data-f="w" value="${esc(x.w)}" placeholder="${esc(phW)}" aria-label="Série ${k + 1} charge">
          <input id="p-${esc(e.id)}-${k}" inputmode="decimal" data-f="rpe" value="${esc(x.rpe)}" placeholder="${esc(/^\d/.test(e.rpe) ? e.rpe : "")}" aria-label="Série ${k + 1} RPE">
          <button class="tick" data-tick aria-label="Valider la série ${k + 1}">✓</button></div>`;
      }
      return `<article class="ex${allDone ? " complete" : ""}">
        <div class="ex-h">
          <div class="ex-t"><h3>${esc(e.name)}</h3><span class="idx">${i + 1}/${def.exercises.length}</span></div>
          <div class="chips">${e.goal ? `<span class="chip goal">${esc(e.goal)}</span>` : ""}${e.video ? '<span class="chip cam">● Filme ta série</span>' : ""}</div>
          ${tempo ? `<div class="tempo" title="Tempo : descente, pause en bas, montée, pause en haut">${["Desc.", "Pause", "Mont.", "Pause"].map((t, j) => `<span>${esc(tempo[j] ?? "")}<small>${t}</small></span>`).join("")}</div>` : ""}
          ${notes ? `<div class="notes">${esc(notes)}</div>` : ""}
          <div class="last">${prev ? `Dernière fois (${fmt(prev.date)}) : <b class="num">${setsText(prev.sets, e.unit)}</b>${rpeText(prev.sets) ? " — " + rpeText(prev.sets) : ""}` : "Pas encore d'historique pour cet exercice."}</div>
        </div>
        <div class="presc">
          <div><div class="lbl">Séries × reps</div><div class="v num">${sets}${e.reps ? " × " + esc(e.reps) : ""}</div></div>
          <div><div class="lbl">Charge coach</div><div class="v num">${esc(e.load || "—")}</div></div>
          <div><div class="lbl">RPE cible</div><div class="v">${esc(e.rpe || "—")}</div></div>
          <div><div class="lbl">Repos</div><div class="v">${esc(e.rest || "—")}</div></div>
        </div>
        <div class="sets">
          <div class="set head"><span></span><span>${e.unit === "sec" ? "Sec." : "Reps"}</span><span>Kg</span><span>RPE</span><span></span></div>
          ${rows}
          <button class="addset" data-add="${esc(e.id)}">+ Ajouter une série</button>
        </div></article>`;
    }).join("");
    return `<div class="sessions">${tabs}</div><div class="c-${si % 3}">${ex}</div>
      <section class="card">
        <h2>Après la séance</h2>
        <div class="field"><label class="lbl" for="sleep">Sommeil la nuit d'avant</label><input type="text" id="sleep" data-meta="sleep" value="${esc(l.sleep)}" placeholder="ex. 7 h, bien dormi"></div>
        <div class="field"><label class="lbl" for="comment">Commentaire</label><textarea id="comment" data-meta="comment" placeholder="Sensations, douleur, ce qui a bien marché…">${esc(l.comment)}</textarea></div>
        <div class="status" id="saveStatus"></div>
      </section>`;
  }

  function allExercises() {
    const m = new Map(), cur = ver();
    (cur?.sessions || []).forEach(s => s.exercises.forEach(e => { if (!m.has(e.id)) m.set(e.id, { id: e.id, name: e.name, cur: true, unit: e.unit }); }));
    (S.prog?.versions || []).forEach(v => v.sessions.forEach(s => s.exercises.forEach(e => { if (!m.has(e.id)) m.set(e.id, { id: e.id, name: e.name, cur: false, unit: e.unit }); })));
    sortedLogs().forEach(l => Object.entries(l.entries || {}).forEach(([k, v]) => { if (!m.has(k)) m.set(k, { id: k, name: v.name || k, cur: false }); }));
    return [...m.values()];
  }
  function series(exId) {
    const out = [];
    sortedLogs().forEach(l => {
      const en = l.entries?.[exId]; if (!en) return;
      const sets = en.sets.filter(x => x.r || x.w); if (!sets.length) return;
      let best = NaN, e1 = NaN, vol = 0;
      sets.forEach(x => { const w = num(x.w), r = num(x.r); if (!isNaN(w)) { best = isNaN(best) ? w : Math.max(best, w); if (!isNaN(r)) { vol += w * r; const e = w * (1 + r / 30); e1 = isNaN(e1) ? e : Math.max(e1, e); } } });
      out.push({ date: l.date, sets, best, e1, vol });
    });
    return out;
  }
  function chart(pts) {
    const P = pts.filter(p => !isNaN(p.best));
    if (P.length < 2) return `<p class="last">Il faut au moins deux séances chiffrées pour tracer la courbe.</p>`;
    const W = 600, H = 220, l = 40, r = 14, t = 14, b = 28;
    const vals = P.flatMap(p => [p.best, p.e1]).filter(v => !isNaN(v));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const span = Math.max(hi - lo, 5); lo = Math.floor((lo - span * .15) / 5) * 5; hi = Math.ceil((hi + span * .15) / 5) * 5;
    const x = i => l + (W - l - r) * (i / (P.length - 1)), y = v => t + (H - t - b) * (1 - (v - lo) / (hi - lo));
    const step = (hi - lo) / 4; let g = "";
    for (let i = 0; i <= 4; i++) { const v = lo + step * i; g += `<line x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v * 10) / 10}</text>`; }
    const path = k => P.map((p, i) => isNaN(p[k]) ? "" : `${i && !isNaN(P[i - 1][k]) ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
    const area = `M${x(0)},${y(P[0].best)}` + P.map((p, i) => `L${x(i)},${y(p.best)}`).join("") + `L${x(P.length - 1)},${H - b}L${x(0)},${H - b}Z`;
    const lab = P.map((p, i) => (P.length <= 8 || i % Math.ceil(P.length / 6) === 0 || i === P.length - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${fmt(p.date)}</text>` : "").join("");
    const dots = P.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.best)}" r="${i === P.length - 1 ? 5 : 3}" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"><title>${fmt(p.date)} : ${p.best} kg</title></circle>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution de la charge">${g}
      <path d="${area}" fill="var(--accent)" opacity=".08"/>
      <path d="${path("e1")}" fill="none" stroke="var(--plate)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="${path("best")}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>${dots}${lab}</svg>
      <div class="legend"><span><i style="background:var(--accent)"></i>Charge max de la séance (kg)</span><span><i style="background:var(--plate)"></i>1RM estimé (Epley)</span></div>`;
  }
  function renderProgress() {
    const ex = allExercises();
    if (!ex.length) return `<div class="empty"><b>Rien à afficher</b>Enregistre une première séance.</div>`;
    if (!S.progEx || !ex.find(e => e.id === S.progEx)) S.progEx = (ex.find(e => e.id === "bench-pause") || ex[0]).id;
    const pts = series(S.progEx), nums = pts.filter(p => !isNaN(p.best));
    const best = nums.length ? Math.max(...nums.map(p => p.best)) : null;
    const e1 = nums.filter(p => !isNaN(p.e1)); const be1 = e1.length ? Math.max(...e1.map(p => p.e1)) : null;
    const opt = arr => arr.map(e => `<option value="${esc(e.id)}"${e.id === S.progEx ? " selected" : ""}>${esc(e.name)}</option>`).join("");
    const cur = ex.filter(e => e.cur), old = ex.filter(e => !e.cur);
    const unit = ex.find(e => e.id === S.progEx)?.unit;
    return `<section class="card">
      <div class="field"><label class="lbl" for="progSel">Exercice</label><select id="progSel">
        <optgroup label="Programme actuel">${opt(cur)}</optgroup>${old.length ? `<optgroup label="Anciens exercices">${opt(old)}</optgroup>` : ""}</select></div>
      <div class="stats">
        <div class="stat"><div class="lbl">Charge max</div><div class="v num">${best != null ? best + " kg" : "—"}</div></div>
        <div class="stat"><div class="lbl">1RM estimé</div><div class="v num">${be1 != null ? Math.round(be1 * 2) / 2 + " kg" : "—"}</div></div>
        <div class="stat"><div class="lbl">Séances</div><div class="v num">${pts.length}</div></div>
      </div>${chart(pts)}</section>
      <section class="card"><h2>Historique</h2>
      ${pts.length ? `<div class="hist">${pts.slice().reverse().map(p => `<div class="r"><span class="d num">${fmt(p.date)}</span><span class="num">${setsText(p.sets, unit)}${rpeText(p.sets) || p.vol ? `<br><span class="last">${rpeText(p.sets)}${p.vol ? (rpeText(p.sets) ? " · " : "") + "tonnage " + Math.round(p.vol) + " kg" : ""}</span>` : ""}</span></div>`).join("")}</div>` : `<p class="last">Aucune série enregistrée pour cet exercice.</p>`}
      </section>`;
  }

  const RQ = [["fatigue", "Fatigue nerveuse, sensation de fatigue"], ["courbatures", "Courbatures"], ["appreciation", "Appréciation de la sélection d'exercices"]];
  const RT = [["douleurs", "Douleur(s), raideur(s) ou gêne(s) ?"], ["technique", "Technique(s) à retravailler ? Incertitudes d'exécution ?"], ["conditions", "Conditions inhabituelles, facteurs extérieurs ?"], ["bilan", "Bilan"]];
  function weekSummary() {
    const V = ver(); let sets = 0, ton = 0, done = 0;
    (V?.sessions || []).forEach(s => {
      const l = getLog(S.week, s.id); if (sessionState(S.week, s.id) === "done") done++;
      Object.values(l?.entries || {}).forEach(en => en.sets.forEach(x => { if (x.done || x.r) { sets++; const w = num(x.w), r = num(x.r); if (!isNaN(w) && !isNaN(r)) ton += w * r; } }));
    });
    return { sets, ton, done, total: V?.sessions.length || 0 };
  }
  function renderReview() {
    const r = S.reviews[S.week] || {}, sm = weekSummary();
    const back = S.lastBackup ? "Dernière sauvegarde : " + fmt(S.lastBackup.slice(0, 10)) : "Aucune sauvegarde pour l'instant.";
    return `<section class="card"><h2>Ta semaine</h2>
      <div class="stats">
        <div class="stat"><div class="lbl">Séances</div><div class="v num">${sm.done}/${sm.total}</div></div>
        <div class="stat"><div class="lbl">Séries</div><div class="v num">${sm.sets}</div></div>
        <div class="stat"><div class="lbl">Tonnage</div><div class="v num">${sm.ton ? Math.round(sm.ton).toLocaleString("fr-BE") + " kg" : "—"}</div></div>
      </div></section>
    <section class="card"><h2>Retour sur la semaine</h2>
      ${RQ.map(([k, t]) => `<div class="scale"><div class="row"><label class="lbl" for="rv-${k}">${t}</label><span class="val num" id="rvv-${k}">${r[k] != null && r[k] !== "" ? r[k] : "–"}<small class="lbl"> /10</small></span></div>
        <input type="range" id="rv-${k}" data-rv="${k}" min="0" max="10" step="1" value="${r[k] != null && r[k] !== "" ? r[k] : 5}"></div>`).join("")}
      ${RT.map(([k, t]) => `<div class="field"><label class="lbl" for="rv-${k}">${t}</label><textarea id="rv-${k}" data-rv="${k}">${esc(r[k])}</textarea></div>`).join("")}
      <div class="status" id="saveStatus"></div>
      <button class="btn" id="copyCoach">Copier le résumé pour le coach</button>
      <p class="last" id="copyMsg"></p>
    </section>
    <section class="card"><h2>Sauvegarde</h2>
      <p class="last">Tes séances sont enregistrées uniquement sur ce téléphone. Exporte une sauvegarde de temps en temps (ex. une fois par semaine) pour ne rien perdre si tu changes d'appareil ou vides ton navigateur.</p>
      <div class="row2"><button class="btn small" id="exportBtn">Exporter une sauvegarde</button><button class="btn small ghost" id="importBtn">Importer une sauvegarde</button></div>
      <p class="last" id="backupMsg">${back}</p>
    </section>`;
  }
  function coachText() {
    const V = ver(), r = S.reviews[S.week] || {}; let o = `Semaine du ${fmt(S.week)}\n`;
    (V?.sessions || []).forEach(s => {
      const l = getLog(S.week, s.id); o += `\n${s.name.toUpperCase()} (${DAYS[s.day]} ${fmt(addDays(S.week, s.day))})\n`;
      if (!l) { o += "  pas faite\n"; return; }
      s.exercises.forEach(e => {
        const st = (l.entries?.[e.id]?.sets || []).filter(x => x.r || x.w);
        o += `- ${e.name} : ${st.length ? st.map(x => (x.r || "?") + (x.w ? "×" + x.w : "")).join(", ") + (st.some(x => x.rpe) ? " | RPE " + st.map(x => x.rpe || "?").join(",") : "") : "—"}\n`;
      });
      if (l.sleep) o += `  Sommeil : ${l.sleep}\n`; if (l.comment) o += `  Commentaire : ${l.comment}\n`;
    });
    o += "\nRETOUR SUR SEMAINE\n";
    RQ.forEach(([k, t]) => o += `- ${t} : ${r[k] != null && r[k] !== "" ? r[k] + "/10" : "—"}\n`);
    RT.forEach(([k, t]) => { if (r[k]) o += `- ${t} ${r[k]}\n`; });
    return o;
  }

  /* ---------- sauvegarde ---------- */
  function exportBackup() {
    const data = { app: "carnet-bench", version: 1, exportedAt: new Date().toISOString(), logs: S.logs, reviews: S.reviews };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "carnet-bench-sauvegarde-" + iso(new Date()) + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    S.lastBackup = new Date().toISOString(); persist(); const m = $("#backupMsg"); if (m) m.textContent = "Sauvegarde téléchargée.";
  }
  $("#importFile").addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    const m = $("#backupMsg");
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== "carnet-bench" || !d.logs) throw new Error("format");
      let n = 0;
      for (const [k, v] of Object.entries(d.logs)) { const cur = S.logs[k]; if (!cur || (v.updatedAt || "") > (cur.updatedAt || "")) { S.logs[k] = v; n++; } }
      for (const [k, v] of Object.entries(d.reviews || {})) { const cur = S.reviews[k]; if (!cur || (v.updatedAt || "") > (cur.updatedAt || "")) S.reviews[k] = v; }
      persist(); render(); const mm = $("#backupMsg"); if (mm) mm.textContent = n + " séance(s) importée(s). Les séances plus récentes déjà présentes ont été gardées.";
    } catch (err) { if (m) m.textContent = "Ce fichier n'est pas une sauvegarde Carnet Bench."; }
  });

  /* ---------- événements ---------- */
  document.querySelector(".tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    S.tab = b.dataset.tab; try { localStorage.setItem("cb.tab", S.tab); } catch (_) {}
    render(); scrollTo(0, 0);
  });
  $("#prevWk").onclick = () => { S.week = addDays(S.week, -7); S.session = null; render(); };
  $("#nextWk").onclick = () => { S.week = addDays(S.week, 7); S.session = null; render(); };
  const view = $("#view");
  view.addEventListener("click", e => {
    const s = e.target.closest("[data-sess]"); if (s) { S.session = s.dataset.sess; render(); return; }
    const add = e.target.closest("[data-add]");
    if (add) {
      const l = ensureLog(S.week, S.session), { en, def } = entryFor(l, add.dataset.add);
      while (en.sets.length < +def.sets) en.sets.push({ r: "", w: "", rpe: "", done: false });
      en.sets.push({ r: "", w: "", rpe: "", done: false }); touch(l); render(); return;
    }
    const tk = e.target.closest("[data-tick]");
    if (tk) {
      const row = tk.closest(".set"), k = +row.dataset.k;
      const l = ensureLog(S.week, S.session), { en, def } = entryFor(l, row.dataset.ex);
      while (en.sets.length <= k) en.sets.push({ r: "", w: "", rpe: "", done: false });
      const x = en.sets[k]; x.done = !x.done;
      if (x.done) {
        row.querySelectorAll("input").forEach(inp => { const f = inp.dataset.f; if (!x[f] && inp.placeholder && f !== "rpe") x[f] = inp.placeholder; });
        const sec = restSec(def.rest); if (sec) startTimer(sec, def.name);
      }
      touch(l); render(); return;
    }
    if (e.target.id === "copyCoach") {
      const t = coachText(), msg = $("#copyMsg");
      try { navigator.clipboard.writeText(t).then(() => msg.textContent = "Copié. Colle-le dans ton message au coach.", () => showText(t)); } catch (_) { showText(t); }
    }
    if (e.target.id === "exportBtn") exportBackup();
    if (e.target.id === "importBtn") $("#importFile").click();
  });
  function showText(t) { const msg = $("#copyMsg"); msg.innerHTML = `<textarea id="coachTxt" style="width:100%;min-height:200px" readonly>${esc(t)}</textarea>`; const ta = $("#coachTxt"); ta.focus(); ta.select(); }
  view.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.f) {
      const row = t.closest(".set"), k = +row.dataset.k;
      const l = ensureLog(S.week, S.session), { en } = entryFor(l, row.dataset.ex);
      while (en.sets.length <= k) en.sets.push({ r: "", w: "", rpe: "", done: false });
      en.sets[k][t.dataset.f] = t.value.trim(); touch(l); return;
    }
    if (t.dataset.meta) { const l = ensureLog(S.week, S.session); l[t.dataset.meta] = t.value; touch(l); return; }
    if (t.dataset.rv) {
      const r = S.reviews[S.week] || (S.reviews[S.week] = { week: S.week });
      r[t.dataset.rv] = t.type === "range" ? +t.value : t.value;
      if (t.type === "range") { const v = $("#rvv-" + t.dataset.rv); if (v) v.firstChild.textContent = t.value; }
      r.updatedAt = new Date().toISOString(); persist();
    }
  });
  view.addEventListener("change", e => { if (e.target.id === "progSel") { S.progEx = e.target.value; render(); } });
  view.addEventListener("focusout", () => { setTimeout(() => { if (needsRender && !view.contains(document.activeElement)) render(); }, 0); });

  /* ---------- minuteur de repos ---------- */
  let tEnd = 0, tInt = null, beeped = false, wake = null, actx = null;
  function beep() {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.value = .15; o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + .35); } catch (_) {}
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (_) {}
  }
  function startTimer(sec, name) {
    tEnd = Date.now() + sec * 1000; beeped = false;
    $("#dockW").textContent = "Repos · " + name; $("#dock").classList.add("on"); $("#dock").classList.remove("over");
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch (_) {}
    try { navigator.wakeLock?.request("screen").then(w => wake = w, () => {}); } catch (_) {}
    clearInterval(tInt); tick(); tInt = setInterval(tick, 250);
  }
  function tick() {
    const left = Math.round((tEnd - Date.now()) / 1000), a = Math.abs(left);
    $("#dockT").textContent = (left < 0 ? "+" : "") + Math.floor(a / 60) + ":" + String(a % 60).padStart(2, "0");
    if (left <= 0) { $("#dock").classList.add("over"); if (!beeped) { beeped = true; beep(); } }
  }
  function stopTimer() { clearInterval(tInt); $("#dock").classList.remove("on", "over"); try { wake && wake.release(); wake = null; } catch (_) {} }
  $("#dockPlus").onclick = () => { tEnd += 30000; $("#dock").classList.remove("over"); beeped = tEnd <= Date.now(); tick(); };
  $("#dockStop").onclick = stopTimer;

  /* ---------- démarrage ---------- */
  loadStore(); render();
  loadProgram().then(p => { S.prog = p; pickDefaultSession(); render(); })
    .catch(e => { S.err = "Impossible de charger programme.json. Vérifie ta connexion puis recharge la page. (" + e.message + ")"; render(); });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
