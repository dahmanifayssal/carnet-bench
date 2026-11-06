/* Carnet Bench — mode coach : modifier programme.json et le publier sur GitHub. */
(function () {
  "use strict";
  const { DAYS_LONG, iso, addDays, monday, parseIso, fmtY, esc, slug, versionFor, tempoOf, notesOf, loadProgram } = CB;
  const DRAFT = "carnet-bench.coach.draft", GH = "carnet-bench.coach.github";
  const $ = s => document.querySelector(s);
  const C = { prog: null, original: null, sel: null, msg: "", msgErr: false, busy: false, gh: {} };
  const thisWeek = monday(new Date());

  /* ---------- état ---------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  const sortV = () => C.prog.versions.sort((a, b) => a.from.localeCompare(b.from));
  const curV = () => C.prog.versions.find(v => v.from === C.sel);
  const changed = () => JSON.stringify(C.prog) !== JSON.stringify(C.original);
  const hash = str => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return String(h); };
  function saveDraft() { try { if (changed()) localStorage.setItem(DRAFT, JSON.stringify({ base: hash(JSON.stringify(C.original)), prog: C.prog })); else localStorage.removeItem(DRAFT); } catch (e) {} }
  function knownId(name) {
    const n = slug(name);
    for (const v of C.prog.versions) for (const s of v.sessions) for (const e of s.exercises) if (slug(e.name) === n && e.id) return e.id;
    return null;
  }
  function newExercise() { return { id: "", name: "", sets: 3, reps: "8-10", load: "", rpe: "8", rest: "2 min", tempo: "", goal: "", notes: "", video: false, unit: "reps" }; }
  function status(v) { const now = versionFor(C.prog, thisWeek); return v === now ? "cur" : v.from > thisWeek ? "fut" : "old"; }

  function loadGh() {
    try { C.gh = JSON.parse(localStorage.getItem(GH) || "{}"); } catch (e) { C.gh = {}; }
    if (!C.gh.owner && /\.github\.io$/.test(location.hostname)) {
      C.gh.owner = location.hostname.split(".")[0];
      C.gh.repo = location.pathname.split("/").filter(Boolean)[0] || "";
    }
    C.gh.branch = C.gh.branch || "main";
  }
  function saveGh() { try { localStorage.setItem(GH, JSON.stringify(C.gh)); } catch (e) {} }

  /* ---------- rendu ---------- */
  function render() {
    const v = $("#view");
    if (!C.prog) { v.innerHTML = `<div class="empty"><b>${C.err ? "Programme introuvable" : "Chargement…"}</b>${esc(C.err || "")}</div>`; return; }
    sortV();
    const V = curV();
    v.innerHTML = renderVersions() + (V ? renderEditor(V) : "") + renderPublish();
  }
  function renderVersions() {
    const rows = C.prog.versions.slice().reverse().map(v => {
      const st = status(v);
      return `<div class="exbar" style="padding-block:6px;border-top:1px solid var(--line)">
        <div><b>${esc(v.label || "Sans nom")}</b><br><span class="vtag">À partir du ${fmtY(v.from)}</span>
          ${st === "cur" ? ' <span class="pill cur">En cours</span>' : st === "fut" ? ' <span class="pill fut">À venir</span>' : ""}</div>
        <div class="tools">
          ${v.from === C.sel ? '<span class="pill fut">Ouvert ci-dessous</span>' : `<button class="btn small ghost" data-edit="${v.from}">Modifier</button>`}
        </div></div>`;
    }).join("");
    const next = addDays(thisWeek, 7);
    return `<section class="card">
      <h2>Programmes</h2>
      <p class="last">Chaque programme s'applique à partir d'une semaine, jusqu'au suivant. Les semaines passées gardent leur programme, et l'historique de l'athlète ne change pas.</p>
      ${changed() ? `<div class="banner">Tu as des modifications pas encore publiées. Elles sont gardées sur cet appareil.</div>` : ""}
      <div>${rows}</div>
      <details>
        <summary>+ Nouveau programme (copie d'un existant)</summary>
        <div class="grid" style="margin-top:10px">
          <div class="field wide"><label class="lbl" for="nvFrom">À partir de la semaine du</label><input type="date" id="nvFrom" value="${next}"></div>
          <div class="field wide"><label class="lbl" for="nvLabel">Nom</label><input type="text" id="nvLabel" placeholder="ex. Décembre 2026 — bloc force"></div>
          <div class="field full"><label class="lbl" for="nvBase">Partir de</label><select id="nvBase">
            ${C.prog.versions.slice().reverse().map(v => `<option value="${v.from}"${v.from === C.sel ? " selected" : ""}>${esc(v.label)} (${fmtY(v.from)})</option>`).join("")}
            <option value="">Programme vide</option></select></div>
        </div>
        <div class="row2" style="margin-top:10px"><button class="btn small" id="nvCreate">Créer le programme</button></div>
      </details>
    </section>`;
  }
  function renderEditor(V) {
    const st = status(V);
    const sess = V.sessions.map((s, si) => {
      const ex = s.exercises.map((e, ei) => {
        const p = `data-s="${si}" data-e="${ei}"`;
        return `<div class="exed">
          <div class="exbar"><b>${ei + 1}. ${esc(e.name || "Nouvel exercice")}</b>
            <div class="tools">
              <button ${p} data-act="exUp" aria-label="Monter">↑</button><button ${p} data-act="exDown" aria-label="Descendre">↓</button>
              <button ${p} data-act="exDup" aria-label="Dupliquer">⧉</button><button ${p} data-act="exDel" aria-label="Supprimer">✕</button>
            </div></div>
          <div class="grid">
            <div class="field full"><label class="lbl" for="n-${si}-${ei}">Exercice</label><input id="n-${si}-${ei}" ${p} data-k="name" value="${esc(e.name)}" placeholder="ex. Bench press pausé tempo"></div>
            <div class="field"><label class="lbl" for="s-${si}-${ei}">Séries</label><input id="s-${si}-${ei}" ${p} data-k="sets" inputmode="numeric" value="${esc(e.sets)}"></div>
            <div class="field"><label class="lbl" for="r-${si}-${ei}">${e.unit === "sec" ? "Durée" : "Reps"}</label><input id="r-${si}-${ei}" ${p} data-k="reps" value="${esc(e.reps)}" placeholder="${e.unit === "sec" ? "30 s" : "8-10"}"></div>
            <div class="field"><label class="lbl" for="l-${si}-${ei}">Charge</label><input id="l-${si}-${ei}" ${p} data-k="load" value="${esc(e.load)}" placeholder="kg, PDC…"></div>
            <div class="field"><label class="lbl" for="p-${si}-${ei}">RPE cible</label><input id="p-${si}-${ei}" ${p} data-k="rpe" value="${esc(e.rpe)}" placeholder="8"></div>
            <div class="field"><label class="lbl" for="t-${si}-${ei}">Repos</label><input id="t-${si}-${ei}" ${p} data-k="rest" value="${esc(e.rest)}" placeholder="2 min 30"></div>
            <div class="field"><label class="lbl" for="m-${si}-${ei}">Tempo</label><input id="m-${si}-${ei}" ${p} data-k="tempo" value="${esc((tempoOf(e) || []).join(" "))}" placeholder="3 1 0 0"></div>
            <div class="field wide"><label class="lbl" for="g-${si}-${ei}">Objectif</label><input id="g-${si}-${ei}" ${p} data-k="goal" value="${esc(e.goal)}" placeholder="Force, Hypertrophie…"></div>
            <div class="field full"><label class="lbl" for="o-${si}-${ei}">Indications</label><textarea id="o-${si}-${ei}" ${p} data-k="notes">${esc(notesOf(e))}</textarea></div>
            <label class="check wide"><input type="checkbox" ${p} data-k="video"${e.video ? " checked" : ""}> Demander une vidéo</label>
            <label class="check wide"><input type="checkbox" ${p} data-k="unit"${e.unit === "sec" ? " checked" : ""}> Exercice en secondes</label>
          </div></div>`;
      }).join("");
      return `<section class="card c-${si % 3}">
        <div class="exbar"><h2 style="color:var(--sc)">${esc(s.name || "Séance")}</h2>
          <div class="tools"><button data-s="${si}" data-act="sUp" aria-label="Monter la séance">↑</button><button data-s="${si}" data-act="sDown" aria-label="Descendre la séance">↓</button><button data-s="${si}" data-act="sDel" aria-label="Supprimer la séance">✕</button></div></div>
        <div class="grid">
          <div class="field wide"><label class="lbl" for="sn-${si}">Nom</label><input id="sn-${si}" data-s="${si}" data-sk="name" value="${esc(s.name)}"></div>
          <div class="field wide"><label class="lbl" for="sd-${si}">Jour</label><select id="sd-${si}" data-s="${si}" data-sk="day">${DAYS_LONG.map((d, i) => `<option value="${i}"${+s.day === i ? " selected" : ""}>${d}</option>`).join("")}</select></div>
        </div>
        ${ex}
        <button class="addset" data-s="${si}" data-act="exAdd">+ Ajouter un exercice</button>
      </section>`;
    }).join("");
    return `<section class="card">
      <h2>${esc(V.label || "Programme")}</h2>
      ${st === "old" ? `<div class="banner">Ce programme est déjà passé. Pour changer les prochaines semaines, crée plutôt un nouveau programme.</div>` : ""}
      <div class="grid">
        <div class="field wide"><label class="lbl" for="vLabel">Nom</label><input id="vLabel" data-vk="label" value="${esc(V.label)}"></div>
        <div class="field wide"><label class="lbl" for="vFrom">À partir de la semaine du</label><input type="date" id="vFrom" value="${V.from}"></div>
      </div>
      <div class="row2"><button class="btn small danger" id="vDel"${C.prog.versions.length < 2 ? " disabled" : ""}>Supprimer ce programme</button></div>
    </section>
    ${sess}
    <div class="row2" style="margin-bottom:12px"><button class="btn small ghost" id="sAdd">+ Ajouter une séance</button></div>`;
  }
  function renderPublish() {
    const g = C.gh;
    return `<section class="card">
      <h2>Publier</h2>
      <p class="last">Une fois publié, l'athlète voit le nouveau programme à sa prochaine ouverture de l'appli (1 à 2 minutes après la publication).</p>
      <div class="row2">
        <button class="btn" id="pub"${C.busy ? " disabled" : ""}>${C.busy ? "Publication…" : "Publier sur GitHub"}</button>
        <button class="btn ghost" id="dl">Télécharger programme.json</button>
        ${changed() ? '<button class="btn ghost" id="undo">Annuler mes modifications</button>' : ""}
      </div>
      <p class="status${C.msgErr ? " err" : ""}" style="text-align:left">${esc(C.msg)}</p>
      <details${g.token ? "" : " open"}>
        <summary>Connexion GitHub ${g.token ? "(configurée)" : "(à faire une fois)"}</summary>
        <p class="last">Crée un jeton sur GitHub : <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens</b>. Choisis uniquement ce dépôt, avec la permission <b>Contents : Read and write</b>. Le jeton reste dans ce navigateur, il n'est envoyé qu'à GitHub.</p>
        <div class="grid">
          <div class="field wide"><label class="lbl" for="ghOwner">Compte GitHub</label><input id="ghOwner" data-gh="owner" value="${esc(g.owner || "")}" autocomplete="off"></div>
          <div class="field wide"><label class="lbl" for="ghRepo">Dépôt</label><input id="ghRepo" data-gh="repo" value="${esc(g.repo || "")}" autocomplete="off"></div>
          <div class="field wide"><label class="lbl" for="ghBranch">Branche</label><input id="ghBranch" data-gh="branch" value="${esc(g.branch || "main")}" autocomplete="off"></div>
          <div class="field wide"><label class="lbl" for="ghToken">Jeton</label><input id="ghToken" data-gh="token" type="password" value="${esc(g.token || "")}" autocomplete="off"></div>
        </div>
      </details>
    </section>`;
  }

  /* ---------- préparation et publication ---------- */
  function finalize() {
    const p = clone(C.prog);
    p.updatedAt = iso(new Date());
    p.versions.forEach(v => {
      const used = new Set();
      v.sessions.forEach((s, i) => {
        s.day = +s.day || 0;
        if (!s.id) { let n = i + 1; while (v.sessions.some(x => x.id === "S" + n)) n++; s.id = "S" + n; }
        s.exercises = s.exercises.filter(e => e.name.trim());
        s.exercises.forEach(e => {
          e.name = e.name.trim(); e.sets = Math.max(1, parseInt(e.sets, 10) || 1);
          if (!e.id) e.id = knownId(e.name) || slug(e.name);
          let id = e.id, k = 2; while (used.has(s.id + "/" + id)) id = e.id + "-" + k++;
          e.id = id; used.add(s.id + "/" + id);
        });
      });
    });
    p.versions.sort((a, b) => a.from.localeCompare(b.from));
    return p;
  }
  const b64 = str => { const bytes = new TextEncoder().encode(str); let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin); };
  async function publish() {
    const g = C.gh;
    if (!g.owner || !g.repo || !g.token) { C.msg = "Remplis la connexion GitHub (compte, dépôt, jeton) avant de publier."; C.msgErr = true; render(); return; }
    C.busy = true; C.msg = ""; render();
    const p = finalize(), body = JSON.stringify(p, null, 1) + "\n";
    const url = `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/programme.json`;
    const h = { Authorization: "Bearer " + g.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    try {
      let sha;
      const cur = await fetch(url + "?ref=" + encodeURIComponent(g.branch), { headers: h, cache: "no-store" });
      if (cur.status === 401 || cur.status === 403) throw new Error("Jeton refusé par GitHub. Vérifie qu'il a la permission Contents en écriture sur ce dépôt.");
      if (cur.ok) sha = (await cur.json()).sha; else if (cur.status !== 404) throw new Error("GitHub a répondu " + cur.status + ".");
      const r = await fetch(url, { method: "PUT", headers: h, body: JSON.stringify({ message: "Programme mis à jour par le coach (" + p.updatedAt + ")", content: b64(body), branch: g.branch, sha }) });
      if (r.status === 404) throw new Error("Dépôt ou branche introuvable. Vérifie le compte, le nom du dépôt et la branche.");
      if (r.status === 409) throw new Error("Le fichier a changé entre-temps sur GitHub. Recharge la page puis refais tes modifications.");
      if (!r.ok) throw new Error("Échec de la publication (" + r.status + ").");
      C.prog = p; C.original = clone(p); saveDraft();
      C.msg = "Publié. L'athlète verra le programme d'ici 1 à 2 minutes."; C.msgErr = false;
    } catch (e) { C.msg = e.message || "Échec de la publication."; C.msgErr = true; }
    C.busy = false; render();
  }
  function download() {
    const p = finalize();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 1) + "\n"], { type: "application/json" }));
    a.download = "programme.json"; document.body.appendChild(a); a.click(); a.remove();
    C.msg = "Fichier téléchargé. Sur GitHub, ouvre le dépôt → Add file → Upload files, et remplace programme.json."; C.msgErr = false; render();
  }

  /* ---------- événements ---------- */
  const view = $("#view");
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  view.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    const V = curV();
    if (t.dataset.edit) { C.sel = t.dataset.edit; render(); scrollTo(0, 0); return; }
    if (t.id === "nvCreate") {
      const from = monday(parseIso($("#nvFrom").value || addDays(thisWeek, 7)));
      if (C.prog.versions.some(v => v.from === from)) { alert("Un programme commence déjà la semaine du " + fmtY(from) + ". Modifie-le plutôt."); return; }
      const base = C.prog.versions.find(v => v.from === $("#nvBase").value);
      const nv = base ? clone(base) : { sessions: [{ id: "S1", name: "Séance 1", day: 0, exercises: [] }] };
      nv.from = from; nv.label = $("#nvLabel").value.trim() || "Programme du " + fmtY(from);
      C.prog.versions.push(nv); C.sel = from; saveDraft(); render(); return;
    }
    if (t.id === "vDel" && V) {
      if (!t.dataset.confirm) { t.dataset.confirm = "1"; t.textContent = "Confirmer la suppression"; return; }
      C.prog.versions = C.prog.versions.filter(v => v !== V); C.sel = (versionFor(C.prog, thisWeek) || C.prog.versions[0]).from; saveDraft(); render(); return;
    }
    if (t.id === "sAdd" && V) { V.sessions.push({ id: "", name: "Séance " + (V.sessions.length + 1), day: 0, exercises: [newExercise()] }); saveDraft(); render(); return; }
    if (t.id === "pub") { publish(); return; }
    if (t.id === "dl") { download(); return; }
    if (t.id === "undo") { C.prog = clone(C.original); if (!curV()) C.sel = (versionFor(C.prog, thisWeek) || C.prog.versions[0]).from; saveDraft(); C.msg = ""; render(); return; }
    const act = t.dataset.act; if (!act || !V) return;
    const si = +t.dataset.s, s = V.sessions[si], ei = +t.dataset.e;
    if (act === "sUp") move(V.sessions, si, -1);
    else if (act === "sDown") move(V.sessions, si, 1);
    else if (act === "sDel") { if (!t.dataset.confirm) { t.dataset.confirm = "1"; t.textContent = "Sûr ?"; return; } V.sessions.splice(si, 1); }
    else if (act === "exAdd") s.exercises.push(newExercise());
    else if (act === "exUp") move(s.exercises, ei, -1);
    else if (act === "exDown") move(s.exercises, ei, 1);
    else if (act === "exDup") s.exercises.splice(ei + 1, 0, Object.assign(clone(s.exercises[ei]), { id: "" }));
    else if (act === "exDel") s.exercises.splice(ei, 1);
    saveDraft(); render();
  });
  view.addEventListener("input", e => {
    const t = e.target, V = curV();
    if (t.dataset.gh) { C.gh[t.dataset.gh] = t.value.trim(); saveGh(); return; }
    if (!V) return;
    if (t.dataset.vk) { V[t.dataset.vk] = t.value; saveDraft(); return; }
    if (t.dataset.sk) { V.sessions[+t.dataset.s][t.dataset.sk] = t.dataset.sk === "day" ? +t.value : t.value; saveDraft(); return; }
    if (t.dataset.k) {
      const ex = V.sessions[+t.dataset.s].exercises[+t.dataset.e], k = t.dataset.k;
      if (k === "video") ex.video = t.checked;
      else if (k === "unit") { ex.unit = t.checked ? "sec" : "reps"; saveDraft(); render(); return; }
      else if (k === "notes") ex.notes = t.value;
      else ex[k] = t.value;
      if (k === "tempo" || k === "notes") { ex.tempo = k === "tempo" ? t.value.trim() : (tempoOf(ex) || []).join(" "); ex.notes = notesOf(ex); }
      saveDraft();
    }
  });
  view.addEventListener("change", e => {
    const t = e.target, V = curV();
    if (t.id === "vFrom" && V) {
      const from = monday(parseIso(t.value || V.from));
      if (from !== V.from && C.prog.versions.some(v => v.from === from)) { t.value = V.from; alert("Un autre programme commence déjà cette semaine-là."); return; }
      V.from = from; C.sel = from; saveDraft(); render();
    }
    if (t.dataset.sk === "day" || (t.dataset.k === "name")) render();
  });

  /* ---------- démarrage ---------- */
  loadGh(); render();
  loadProgram().then(p => {
    p.versions.forEach(v => v.sessions.forEach(s => s.exercises.forEach(e => { e.tempo = (tempoOf(e) || []).join(" "); e.notes = notesOf(e); e.reps = e.reps || ""; })));
    C.original = clone(p); C.prog = clone(p);
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
      if (d && d.base === hash(JSON.stringify(C.original))) C.prog = d.prog;
      else if (d) { localStorage.removeItem(DRAFT); C.msg = "Le programme a été mis à jour depuis ton dernier brouillon : le brouillon a été écarté."; }
    } catch (e) {}
    C.sel = (versionFor(C.prog, addDays(thisWeek, 0)) || C.prog.versions[0]).from;
    const fut = C.prog.versions.filter(v => v.from > thisWeek).sort((a, b) => a.from.localeCompare(b.from))[0];
    if (fut) C.sel = fut.from;
    render();
  }).catch(e => { C.err = e.message; render(); });
})();
