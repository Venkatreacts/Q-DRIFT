"use strict";
/* Q-DRIFT console. Plain JS + canvas, no build step, works offline. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const C = {};
["ground", "panel", "rule", "ink", "ink-2", "ink-3", "trace", "score", "label", "drift", "quantum", "classic", "good"]
  .forEach((k) => (C[k] = css("--" + k)));
const fmt = (x, d = 3) => (x == null || Number.isNaN(x) ? "–" : Number(x).toFixed(d));
const fmtInt = (x) => (x == null ? "–" : Math.round(x).toLocaleString("en-US"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const cache = {};
async function api(path, opts) {
  if (!opts && cache[path]) return cache[path];
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText);
  const j = await r.json();
  if (!opts) cache[path] = j;
  return j;
}

/* ------------------------------------------------------------------ canvas helpers */
function setup(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = +cv.getAttribute("height");
  cv.style.height = h + "px";
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
function line(ctx, xs, ys, color, width = 1.2) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  let started = false;
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] == null || Number.isNaN(ys[i])) { started = false; continue; }
    started ? ctx.lineTo(xs[i], ys[i]) : ctx.moveTo(xs[i], ys[i]);
    started = true;
  }
  ctx.stroke();
}
function axisLabel(ctx, text, x, y, align = "left", color = C["ink-3"]) {
  ctx.fillStyle = color; ctx.font = "11px Archivo, sans-serif"; ctx.textAlign = align; ctx.fillText(text, x, y);
}
/* min/max decimation so 8 000 points draw crisply in ~900 px */
function decimate(arr, n0, n1, px) {
  const n = n1 - n0, out = [];
  if (n <= px * 2) { for (let i = n0; i < n1; i++) out.push([i, arr[i]]); return out; }
  const step = n / px;
  for (let b = 0; b < px; b++) {
    const a = Math.floor(n0 + b * step), e = Math.min(n1, Math.floor(n0 + (b + 1) * step));
    let lo = Infinity, hi = -Infinity, il = a, ih = a;
    for (let i = a; i < e; i++) { const v = arr[i]; if (v < lo) { lo = v; il = i; } if (v > hi) { hi = v; ih = i; } }
    if (il < ih) out.push([il, lo], [ih, hi]); else out.push([ih, hi], [il, lo]);
  }
  return out;
}

/* ------------------------------------------------------------------ navigation */
function show(view) {
  $$(".rail button").forEach((b) => b.dataset.view === view ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $$(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + view));
  (VIEWS[view] || (() => {}))();
  if (view === "mission") requestAnimationFrame(drawMission);
}
$$(".rail button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

/* ------------------------------------------------------------------ shared data */
let CHANNELS = [], LIB = {}, KERN = null;
const LIB_COLORS = {};
async function loadShared() {
  CHANNELS = await api("/api/channels");
  try {
    KERN = await api("/api/results/kernels");
    KERN.library.forEach((f, i) => {
      f.circuit = f.circuit.replace(/ +State/g, "");   // PennyLane labels the state() return on every wire
      LIB[f.key] = f;
      const hue = { angle: 205, zz: 170, iqp: 285 }[f.family];
      LIB_COLORS[f.key] = `hsl(${hue} ${45 + 15 * f.depth}% ${38 + 12 * Math.log2(f.bandwidth * 10 + 1)}%)`;
    });
  } catch (e) { console.warn("kernels.json missing", e); }
  const opts = CHANNELS.map((c) => `<option value="${c.chan}">${c.chan} · ${c.spacecraft}</option>`).join("");
  $("#m-chan").innerHTML = opts; $("#l-chan").innerHTML = opts;
}

/* ================================================================== MISSION REPLAY */
const M = { rep: null, t: 0, playing: false, speed: 160, cmp: "Static-best QSVM", seen: new Set(), last: 0 };
const OURS = "Q-DRIFT";

async function loadMission(cid, scn) {
  M.playing = false; $("#m-play").textContent = "Play";
  let rep;
  try {
    rep = scn === "none" ? await api(`/api/replay/${cid}`) : await api(`/api/drift/${cid}/${scn}`);
  } catch (e) {
    $("#m-why").textContent = scn === "none"
      ? "This channel has not been run yet. Run experiments/run_all.py, or use the Drift lab."
      : "No saved run for this channel and scenario. Running it live…";
    if (scn === "none") return;
    rep = await runLive({ chan: cid, drift: scn });
  }
  setReplay(rep);
}

function setReplay(rep) {
  M.rep = rep; M.t = 0; M.seen = new Set();
  const names = Object.keys(rep.methods).filter((n) => n !== OURS);
  $("#m-cmp").innerHTML = names.map((n) => `<option ${n === M.cmp ? "selected" : ""}>${esc(n)}</option>`).join("");
  if (!names.includes(M.cmp)) M.cmp = names[0];
  $("#m-cmp").value = M.cmp;
  $("#k-cmp-name").textContent = M.cmp;
  $("#m-log").innerHTML = "";
  $("#m-race").innerHTML = ""; $("#m-race").style.height = "0px";
  const init = (rep.methods[OURS].events || []).find((e) => e.type === "init");
  setEncoding(init, false);
  $("#m-why").textContent = init ? "Chosen on the training segment before the stream starts." : "";
  if (init) logEvent(0, "k-switch", `Start with ${init.encoding}`);
  drawMission();
}

function setEncoding(ev, animate = true) {
  if (!ev) { $("#m-enc").textContent = "—"; $("#m-circ").textContent = ""; return; }
  $("#m-enc").textContent = ev.encoding;
  const f = LIB[ev.key];
  $("#m-circ").textContent = f ? f.circuit : "";
  $("#m-sel-note").textContent = ev.circuits != null ? `${fmtInt(ev.circuits)} circuits` : "";
  if (ev.candidates) race(ev.candidates, ev.key, animate);
}

function race(cands, winKey, animate) {
  const ol = $("#m-race");
  const sorted = [...cands].sort((a, b) => b.score - a.score);
  const lo = Math.min(...cands.map((c) => c.score)), hi = Math.max(...cands.map((c) => c.score));
  const rowH = 19;
  ol.style.height = cands.length * rowH + "px";
  ol.innerHTML = cands.map((c) =>
    `<li data-k="${c.key}"><span>${esc(c.name)}</span><span class="b" style="width:0%"></span><span class="v">${fmt(c.score, 2)}</span></li>`).join("");
  const lis = $$("li", ol);
  lis.forEach((li, i) => (li.style.transform = `translateY(${i * rowH}px)`));
  const go = () => lis.forEach((li) => {
    const c = cands.find((x) => x.key === li.dataset.k);
    const rank = sorted.indexOf(c);
    li.style.transform = `translateY(${rank * rowH}px)`;
    $(".b", li).style.width = (8 + 92 * (c.score - lo) / (hi - lo || 1)) + "%";
    li.classList.toggle("win", c.key === winKey);
  });
  animate ? requestAnimationFrame(() => requestAnimationFrame(go)) : go();
}

function logEvent(t, cls, text) {
  const li = document.createElement("li");
  li.innerHTML = `<span class="t">${fmtInt(t)}</span><span class="${cls}">${text}</span>`;
  $("#m-log").prepend(li);
}

function overlapsLabel(a, b, rep) { return rep.anomalies.some(([s, e]) => a <= e && b >= s); }

function stepEvents(t0, t1) {
  const rep = M.rep, m = rep.methods[OURS];
  for (const [a, b] of m.alarm_events) {
    const id = "a" + a;
    if (a <= t1 && !M.seen.has(id)) {
      M.seen.add(id);
      const hit = overlapsLabel(a, b, rep);
      logEvent(a, "k-alarm", hit ? "Alarm: matches a NASA-labelled anomaly" : "Alarm with no matching label (false alarm)");
    }
  }
  for (const ev of m.events) {
    if (ev.type === "init" || ev.t > t1) continue;
    const id = "e" + ev.t + ev.type;
    if (M.seen.has(id)) continue;
    M.seen.add(id);
    if (ev.type === "drift") {
      logEvent(ev.t, "k-drift", ev.trigger === "sustained alarm"
        ? "Alarm unbroken for 1 000 steps: possible new operating mode"
        : "ADWIN: score distribution shifted");
      $("#m-why").textContent = "Possible regime change. Collecting 300 windows before deciding whether to adapt.";
    } else if (ev.type === "keep") {
      logEvent(ev.t, "k-cache", `Checked: current model still fits (median z ${fmt(ev.median_z, 1)}). Kept, 0 circuits`);
      $("#m-why").textContent = "The new data still looks normal to the current model, so nothing is changed. Transient spikes do not cause a switch.";
    } else if (ev.type === "switch") {
      if (ev.cache_hit) {
        logEvent(ev.t, "k-cache", `Mode recognised: reused ${esc(ev.encoding)} from cache, 0 circuits`);
        $("#m-why").textContent = "This operating mode was seen before, so the stored model is reused instantly.";
        setEncoding(ev);
      } else {
        const n = ev.candidates ? ev.candidates.length : 0;
        const same = ev.from === ev.encoding;
        logEvent(ev.t, "k-switch", n ? (same ? `Tested ${n} encodings; ${esc(ev.encoding)} still best, refitted` : `Tested ${n} encodings, switched to ${esc(ev.encoding)}`) : `Refitted on recent data`);
        $("#m-why").textContent = n
          ? `${n} encodings scored on the new regime: how well each separates held-out normal windows from synthetic faults, minus circuit cost.`
          : "Model refitted on the new regime.";
        setEncoding(ev);
      }
    }
  }
}

function drawMission() {
  const rep = M.rep;
  if (!rep || !$("#v-mission").classList.contains("on")) return;
  const T = rep.test.length, t = Math.min(M.t, T);
  $("#m-t").textContent = fmtInt(t) + " / " + fmtInt(T);

  // ---- telemetry
  {
    const { ctx, w, h } = setup($("#c-tele"));
    const pad = { l: 34, r: 8, t: 8, b: 18 };
    const X = (i) => pad.l + (i / (T - 1)) * (w - pad.l - pad.r);
    let lo = Infinity, hi = -Infinity;
    for (const v of rep.test) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
    ctx.fillStyle = C.label; ctx.globalAlpha = 0.28;
    for (const [s, e] of rep.anomalies) if (s <= t) ctx.fillRect(X(s), pad.t, Math.max(2, X(Math.min(e, t)) - X(s)), h - pad.t - pad.b);
    ctx.globalAlpha = 1;
    if (rep.t0 != null && t >= rep.t0) { ctx.fillStyle = C.drift; ctx.fillRect(X(rep.t0) - 1, pad.t, 2, h - pad.t - pad.b); axisLabel(ctx, rep.drift_kind + " drift", X(rep.t0) + 4, pad.t + 10, "left", C.drift); }
    const pts = decimate(rep.test, 0, Math.max(1, t), Math.floor(w));
    line(ctx, pts.map((p) => X(p[0])), pts.map((p) => Y(p[1])), C.trace, 1);
    axisLabel(ctx, fmt(hi, 1), pad.l - 4, pad.t + 8, "right"); axisLabel(ctx, fmt(lo, 1), pad.l - 4, h - pad.b, "right");
    axisLabel(ctx, "0", pad.l, h - 4); axisLabel(ctx, fmtInt(T), w - pad.r, h - 4, "right");
  }
  // ---- score
  const ours = rep.methods[OURS], cmp = rep.methods[M.cmp];
  {
    const { ctx, w, h } = setup($("#c-score"));
    const pad = { l: 34, r: 8, t: 8, b: 18 };
    const X = (i) => pad.l + (i / (T - 1)) * (w - pad.l - pad.r);
    const top = Math.max(rep.z_thr * 3, 12), bot = -4;
    const Y = (v) => pad.t + (1 - (Math.min(Math.max(v, bot), top) - bot) / (top - bot)) * (h - pad.t - pad.b);
    ctx.strokeStyle = C.rule; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(rep.z_thr)); ctx.lineTo(w - pad.r, Y(rep.z_thr)); ctx.stroke(); ctx.setLineDash([]);
    axisLabel(ctx, "alarm", pad.l - 4, Y(rep.z_thr) + 4, "right");
    ctx.fillStyle = C.label; ctx.globalAlpha = 0.16;
    for (const [s, e] of rep.anomalies) if (s <= t) ctx.fillRect(X(s), pad.t, Math.max(2, X(Math.min(e, t)) - X(s)), h - pad.t - pad.b);
    ctx.globalAlpha = 1;
    if (cmp) { const p = decimate(cmp.score, 0, Math.max(1, t), Math.floor(w)); line(ctx, p.map((q) => X(q[0])), p.map((q) => Y(q[1])), C.classic, 1); }
    const p = decimate(ours.score, 0, Math.max(1, t), Math.floor(w));
    line(ctx, p.map((q) => X(q[0])), p.map((q) => Y(q[1])), C.score, 1.4);
    for (const d of ours.drift) if (d <= t) { ctx.fillStyle = C.drift; ctx.fillRect(X(d) - 1, pad.t, 2, h - pad.t - pad.b); }
    for (const s of ours.switch) if (s <= t) { ctx.fillStyle = C.quantum; ctx.beginPath(); ctx.arc(X(s), pad.t + 5, 4, 0, 7); ctx.fill(); }
    for (const [a, b] of ours.alarm_events) if (a <= t) { ctx.fillStyle = C.score; ctx.fillRect(X(a), h - pad.b - 4, Math.max(2, X(Math.min(b, t)) - X(a)), 4); }
  }
  // ---- encoding strip
  {
    const { ctx, w, h } = setup($("#c-strip"));
    const X = (i) => 34 + (i / (T - 1)) * (w - 42);
    const runs = ours.encoding;
    for (let i = 0; i < runs.length; i++) {
      const [s, v] = runs[i], e = i + 1 < runs.length ? runs[i + 1][0] : T;
      if (s > t || v < 0) continue;
      const key = KERN ? KERN.library[v]?.key : null;
      ctx.fillStyle = (key && LIB_COLORS[key]) || C.quantum;
      ctx.fillRect(X(s), 4, X(Math.min(e, t)) - X(s), h - 8);
    }
  }
  // ---- counters
  const caught = rep.anomalies.filter(([s, e]) => s <= t && ours.alarm_events.some(([a, b]) => a <= Math.min(e, t) && b >= s)).length;
  const due = rep.anomalies.filter(([s]) => s <= t).length;
  const sw = ours.events.filter((e) => e.type === "switch" && e.t <= t);
  const circ = ours.events.filter((e) => e.t <= t).reduce((s, e) => s + (e.circuits || 0), 0);
  // share of normal (unlabelled) steps so far spent in alarm: honest even when a model never switches its alarm off
  const alarmTime = (m) => {
    if (!m || t < 1) return 0;
    let on = 0, normal = 0;
    const lab = new Uint8Array(Math.ceil(t));
    for (const [s0, e0] of rep.anomalies) for (let i = s0; i <= Math.min(e0, t - 1); i++) lab[i] = 1;
    const al = new Uint8Array(Math.ceil(t));
    for (const [a0, b0] of m.alarm_events) for (let i = a0; i <= Math.min(b0, t - 1); i++) al[i] = 1;
    for (let i = 0; i < lab.length; i++) if (!lab[i]) { normal++; on += al[i]; }
    return normal ? on / normal : 0;
  };
  const pctTxt = (v) => (100 * v).toFixed(v < 0.1 ? 1 : 0) + "%";
  $("#m-counters").innerHTML = [
    [`${caught} / ${due}`, "labelled anomalies caught"],
    [pctTxt(alarmTime(ours)), `normal time in alarm (${esc(M.cmp)}: ${pctTxt(alarmTime(cmp))})`],
    [ours.drift.filter((d) => d <= t).length, "drifts detected"],
    [`${sw.length}${sw.filter((e) => e.cache_hit).length ? " (" + sw.filter((e) => e.cache_hit).length + " cached)" : ""}`, "encoding switches"],
    [fmtInt(circ), "circuits for selection and training"],
  ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join("");
}

function tick(ts) {
  if (!M.playing || !M.rep) return;
  const dt = Math.min(0.1, (ts - (M.last || ts)) / 1000);
  M.last = ts;
  const t0 = M.t;
  M.t = Math.min(M.rep.test.length, M.t + M.speed * dt);
  stepEvents(t0, M.t);
  drawMission();
  if (M.t >= M.rep.test.length) { M.playing = false; $("#m-play").textContent = "Replay"; return; }
  requestAnimationFrame(tick);
}
$("#m-play").addEventListener("click", () => {
  if (!M.rep) return;
  if (M.t >= M.rep.test.length) setReplay(M.rep);
  M.playing = !M.playing;
  $("#m-play").textContent = M.playing ? "Pause" : "Play";
  M.last = 0;
  if (M.playing) requestAnimationFrame(tick);
});
$("#m-end").addEventListener("click", () => { if (!M.rep) return; M.playing = false; $("#m-play").textContent = "Replay"; stepEvents(0, M.rep.test.length); M.t = M.rep.test.length; drawMission(); });
$$(".seg button[data-speed]").forEach((b) => b.addEventListener("click", () => {
  M.speed = +b.dataset.speed; $$(".seg button[data-speed]").forEach((x) => x.setAttribute("aria-pressed", x === b));
}));
$("#m-chan").addEventListener("change", () => loadMission($("#m-chan").value, $("#m-scn").value));
$("#m-scn").addEventListener("change", () => loadMission($("#m-chan").value, $("#m-scn").value));
$("#m-cmp").addEventListener("change", () => { M.cmp = $("#m-cmp").value; $("#k-cmp-name").textContent = M.cmp; drawMission(); });
window.addEventListener("resize", () => { drawMission(); if ($("#v-kernels").classList.contains("on")) drawKernels(); });

/* ================================================================== DRIFT LAB */
async function runLive(body) {
  const panel = $("#l-out");
  panel.classList.add("busy"); $("#l-run").disabled = true;
  try {
    return await api("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } finally { panel.classList.remove("busy"); $("#l-run").disabled = false; }
}
$("#l-lam").addEventListener("input", () => ($("#l-lam-v").textContent = (+$("#l-lam").value).toFixed(2)));
$("#l-run").addEventListener("click", async () => {
  const body = { chan: $("#l-chan").value, drift: $("#l-drift").value, n_qubits: +$("#l-q").value,
                 lam: +$("#l-lam").value, shots: +$("#l-shots").value };
  const t = performance.now();
  let rep;
  try { rep = await runLive(body); } catch (e) { $("#l-out").innerHTML = `<p>Run failed: ${esc(e.message)}</p>`; return; }
  const secs = ((performance.now() - t) / 1000).toFixed(1);
  const rows = Object.entries(rep.metrics).map(([n, m]) => {
    const r = rep.methods[n];
    const sel = r.circuits.select + r.circuits.fit;
    return `<tr class="${n === OURS ? "ours" : ""}"><td>${esc(n)}</td><td>${m.tp}/${m.tp + m.fn}</td><td>${m.fp}</td><td>${fmt(m.precision, 2)}</td><td>${fmt(m.recall, 2)}</td><td>${fmt(m.auc_pr, 3)}</td><td>${r.switch.length}</td><td>${fmtInt(sel)}</td></tr>`;
  }).join("");
  $("#l-out").innerHTML = `<div class="ph"><h2>${esc(body.chan)} · ${esc(body.drift === "none" ? "no drift" : body.drift + " drift")}</h2><span class="small muted">computed live in ${secs} s</span></div>
    <div class="scroll-x"><table><thead><tr><th>Method</th><th>Anomalies caught</th><th>False alarms</th><th>Precision</th><th>Recall</th><th>AUC-PR</th><th>Switches</th><th>Circuits (select + train)</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p style="margin:12px 0 0"><button class="btn primary" id="l-open">Open in Mission replay</button></p>`;
  $("#l-open").addEventListener("click", () => { show("mission"); setReplay(rep); });
});

/* ================================================================== RESULTS */
// Hundman et al., KDD 2018 (telemanom README, default parameters, with pruning)
const NASA_LSTM = { name: "NASA LSTM + dynamic threshold (published)",
  ALL: { precision: 0.875, recall: 0.800 }, SMAP: { precision: 0.855, recall: 0.855 }, MSL: { precision: 0.926, recall: 0.694 } };
let resultsDone = false;
async function renderResults() {
  if (resultsDone) return;
  let B, A, D, N, Q;
  try { B = await api("/api/results/benchmark"); } catch { $("#r-body").innerHTML = `<p class="muted">No benchmark yet. Run <code>python experiments/run_all.py</code>.</p>`; return; }
  [A, D, N, Q] = await Promise.all(["ablation", "drift", "noise", "qubits"].map((n) => api("/api/results/" + n).catch(() => null)));
  resultsDone = true;
  const names = Object.keys(B.aggregate);
  const best = (g, k, low) => { const v = names.map((n) => B.aggregate[n][g][k]); return low ? Math.min(...v) : Math.max(...v); };
  const tbl = (g) => {
    const rows = names.map((n) => {
      const a = B.aggregate[n][g], all = B.aggregate[n].ALL;
      const cell = (k, d, low) => `<td class="${a[k] === best(g, k, low) ? "best" : ""}">${fmt(a[k], d)}</td>`;
      const circ = all.circuits_mean ? all.circuits_mean.select + all.circuits_mean.fit : 0;
      return `<tr class="${n === OURS ? "ours" : ""}"><td>${esc(n)}</td><td>${a.tp}/${a.tp + a.fn}</td><td>${a.fp}</td>${cell("precision", 3)}${cell("recall", 3)}${cell("f1", 3)}${cell("f05", 3)}${cell("auc_pr", 3)}${cell("false_alarms_per_1k", 2, true)}<td>${fmt(all.switches_mean, 1)}</td><td>${circ ? fmtInt(circ) : "–"}</td></tr>`;
    }).join("");
    const L = NASA_LSTM[g];
    const ref = `<tr><td class="muted">${NASA_LSTM.name}</td><td class="muted">–</td><td class="muted">–</td><td class="muted">${fmt(L.precision)}</td><td class="muted">${fmt(L.recall)}</td><td class="muted">${fmt(2 * L.precision * L.recall / (L.precision + L.recall))}</td><td colspan="5" class="muted" style="text-align:left">deep forecaster per channel, also reads command channels, pruned alarms; reference only</td></tr>`;
    return `<div class="scroll-x"><table><thead><tr><th>Method</th><th>Caught</th><th>False alarms</th><th>Precision</th><th>Recall</th><th>F1</th><th>F0.5</th><th>AUC-PR</th><th>False alarms / 1k steps</th><th>Switches / channel</th><th>Circuits / channel</th></tr></thead><tbody>${rows}${ref}</tbody></table></div>`;
  };
  const W = B.wilcoxon;
  const wil = Object.entries(W).map(([n, r]) => `<tr><td>${esc(n)}</td><td>${fmt(r.auc_pr.mean_diff, 3)}</td><td>${r.auc_pr.wins}–${r.auc_pr.losses}</td><td>${fmt(r.auc_pr.p, 4)}</td><td>${fmt(r.event_f1.mean_diff, 3)}</td><td>${r.event_f1.wins}–${r.event_f1.losses}</td><td>${fmt(r.event_f1.p, 4)}</td></tr>`).join("");
  let html = `
  <div class="panel"><div class="ph"><h2>Benchmark: all channels</h2><div class="seg" role="group" aria-label="Mission">
     <button data-g="ALL" aria-pressed="true">Both</button><button data-g="SMAP" aria-pressed="false">SMAP</button><button data-g="MSL" aria-pressed="false">MSL</button></div></div>
     <div id="r-main">${tbl("ALL")}</div>
     <p class="small muted" style="margin:10px 0 0">Alarm threshold: smoothed robust z-score above ${B.z_thr ?? 6}, the same rule for every method. ${B.channels} channels, ${B.aggregate[OURS].ALL.tp + B.aggregate[OURS].ALL.fn} labelled anomaly sequences. Circuits are those a quantum computer would run for encoding selection and training (scoring adds one circuit per support vector per step).</p></div>
  <div class="grid2" style="margin-top:14px">
    <div class="panel"><h2>Is the difference real? Wilcoxon signed-rank, per channel</h2>
      <div class="scroll-x"><table><thead><tr><th>Q-DRIFT vs</th><th>Δ AUC-PR</th><th>W–L</th><th>p</th><th>Δ event F1</th><th>W–L</th><th>p</th></tr></thead><tbody>${wil}</tbody></table></div>
      <p class="small muted" style="margin:8px 0 0">Positive Δ means Q-DRIFT is better. p &lt; 0.05 means the gap is unlikely to be chance across channels.</p></div>
    <div class="panel"><h2>Threshold sensitivity</h2><canvas class="chart" id="c-thr" height="240"></canvas>
      <p class="small muted" style="margin:6px 0 0">Event F1 for every alarm threshold. A method that only wins at one threshold is tuned, not better.</p></div>
  </div>
  <div class="panel" style="margin-top:14px"><div class="ph"><h2>Per-channel AUC-PR</h2><label class="small">Q-DRIFT against <select id="r-sc-cmp">${names.filter((n) => n !== OURS).map((n) => `<option>${esc(n)}</option>`).join("")}</select></label></div>
    <canvas class="chart" id="c-scatter" height="300"></canvas><p class="small muted" style="margin:6px 0 0">Each dot is one NASA channel. Above the diagonal, Q-DRIFT ranks anomalies better on that channel.</p></div>`;
  if (D) {
    const kinds = ["abrupt", "gradual", "recurring"];
    const mnames = Object.keys(D.abrupt.aggregate);
    const rows = mnames.map((n) => `<tr class="${n === OURS ? "ours" : ""}"><td>${esc(n)}</td>${kinds.map((k) => { const g = D[k].aggregate[n]; return `<td>${g.tp}/${g.tp + g.fn}</td><td>${(100 * g.post_alarm_frac).toFixed(1)}%</td><td>${g.cache_hits || 0}</td>`; }).join("")}</tr>`).join("");
    html += `<div class="panel" style="margin-top:14px"><h2>Controlled drift: ${D.channels.length} channels with a mode change injected at a known time</h2>
      <div class="scroll-x"><table><thead><tr><th rowspan="2">Method</th>${kinds.map((k) => `<th colspan="3" style="text-align:center">${k}</th>`).join("")}</tr><tr>${kinds.map(() => "<th>Caught</th><th>False-alarm time</th><th>Cache hits</th>").join("")}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small muted" style="margin:8px 0 0">The new mode is normal behaviour, not an anomaly. False-alarm time is the share of normal time steps after the change during which the detector is in alarm (lower is better). Caught counts labelled anomalies found. Recurring modes test the cache: a stored model comes back with zero circuits.</p></div>`;
  }
  if (A) {
    const an = Object.keys(A.aggregate);
    html += `<div class="panel" style="margin-top:14px"><h2>Ablation: which part of Q-DRIFT matters</h2><div class="scroll-x"><table><thead><tr><th>Variant</th><th>Precision</th><th>Recall</th><th>F1</th><th>AUC-PR</th><th>False alarms / 1k</th><th>Switches</th><th>Cache hits</th><th>Selection circuits / channel</th></tr></thead><tbody>${an.map((n) => { const g = A.aggregate[n].ALL; return `<tr class="${n === OURS ? "ours" : ""}"><td>${esc(n)}</td><td>${fmt(g.precision)}</td><td>${fmt(g.recall)}</td><td>${fmt(g.f1)}</td><td>${fmt(g.auc_pr)}</td><td>${fmt(g.false_alarms_per_1k, 2)}</td><td>${fmt(g.switches_mean, 1)}</td><td>${g.cache_hits_total}</td><td>${fmtInt(g.circuits_mean.select)}</td></tr>`; }).join("")}</tbody></table></div></div>`;
  }
  if (N || Q) {
    html += `<div class="grid2" style="margin-top:14px">`;
    if (N) {
      const shots = [...new Set(N.grid.map((r) => r.shots))], p2s = [...new Set(N.grid.map((r) => r.p2))];
      html += `<div class="panel"><h2>Hardware noise: Q-DRIFT AUC-PR</h2><div class="scroll-x"><table><thead><tr><th>2-qubit error</th>${shots.map((s) => `<th>${s ? fmtInt(s) + " shots" : "exact"}</th>`).join("")}</tr></thead><tbody>${p2s.map((p) => `<tr><td>${p ? (p * 100).toFixed(1) + "%" : "none"}</td>${shots.map((s) => { const r = N.grid.find((x) => x.p2 === p && x.shots === s); return `<td>${fmt(r?.["Q-DRIFT"].auc_pr)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="small muted" style="margin:8px 0 0">Simulated: global depolarising noise on the compute–uncompute circuit plus binomial shot noise, on ${N.channels.length} channels. Over this range AUC-PR stays between 0.32 and 0.35: depolarising noise only rescales the kernel, and 512 shots per entry still resolve the values the detector uses.</p></div>`;
    }
    if (Q) {
      html += `<div class="panel"><h2>Qubit count</h2><div class="scroll-x"><table><thead><tr><th>Qubits</th>${Object.keys(Q.rows[0]).filter((k) => k !== "n_qubits").map((k) => `<th>${esc(k)} AUC-PR</th>`).join("")}</tr></thead><tbody>${Q.rows.map((r) => `<tr><td>${r.n_qubits}</td>${Object.keys(r).filter((k) => k !== "n_qubits").map((k) => `<td>${fmt(r[k].auc_pr)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="small muted" style="margin:8px 0 0">One PCA component per qubit, on ${Q.channels.length} channels.</p></div>`;
    }
    html += `</div>`;
  }
  $("#r-body").innerHTML = html;
  $$("#r-body .seg button").forEach((b) => b.addEventListener("click", () => {
    $$("#r-body .seg button").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("#r-main").innerHTML = tbl(b.dataset.g);
  }));
  drawThr(B); drawScatter(B, $("#r-sc-cmp").value);
  $("#r-sc-cmp").addEventListener("change", () => drawScatter(B, $("#r-sc-cmp").value));
}

const METHOD_COLORS = (n) => n === OURS ? C.score : { "Static-best QSVM": C.quantum, "Fixed QSVM": "#3b8f8a", "RBF OCSVM": C.classic, "Online RBF + ADWIN": "#c2d3ea", "Isolation Forest": "#7a6a9e" }[n] || C["ink-3"];
function drawThr(B) {
  const { ctx, w, h } = setup($("#c-thr"));
  const pad = { l: 36, r: 120, t: 10, b: 24 };
  const names = Object.keys(B.threshold_curve), thr = Object.keys(B.threshold_curve[OURS]).map(Number);
  const X = (i) => pad.l + (i / (thr.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - v) * (h - pad.t - pad.b);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) { ctx.strokeStyle = C.rule; ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke(); axisLabel(ctx, v.toFixed(2), pad.l - 4, Y(v) + 4, "right"); }
  thr.forEach((t, i) => axisLabel(ctx, t, X(i), h - 6, "center"));
  names.forEach((n, j) => {
    const ys = thr.map((t) => Y(B.threshold_curve[n][String(t)].f1));
    line(ctx, thr.map((_, i) => X(i)), ys, METHOD_COLORS(n), n === OURS ? 2.2 : 1.2);
    axisLabel(ctx, n, w - pad.r + 6, ys[ys.length - 1] + 4 + (j - names.length / 2) * 0, "left", METHOD_COLORS(n));
  });
  axisLabel(ctx, "threshold (z)", pad.l, h - 6 + 0, "left");
}
function drawScatter(B, other) {
  const { ctx, w, h } = setup($("#c-scatter"));
  const pad = { l: 40, r: 12, t: 10, b: 28 }, side = Math.min(w - pad.l - pad.r, h - pad.t - pad.b);
  const X = (v) => pad.l + v * side, Y = (v) => pad.t + (1 - v) * side;
  ctx.strokeStyle = C.rule; ctx.strokeRect(X(0), Y(1), side, side);
  ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
  axisLabel(ctx, other + " →", X(1), Y(0) + 20, "right"); axisLabel(ctx, "Q-DRIFT ↑", X(0) - 6, Y(1) + 10, "right");
  let up = 0, down = 0;
  for (const pc of B.per_channel) {
    const a = pc[OURS].auc_pr, b = pc[other].auc_pr;
    if (a == null || b == null) continue;
    a > b ? up++ : a < b ? down++ : 0;
    ctx.fillStyle = pc[OURS].spacecraft === "SMAP" ? C.score : C.quantum; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(X(b), Y(a), 3.5, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  axisLabel(ctx, `Q-DRIFT better on ${up}, worse on ${down}`, X(0) + side + 12, Y(1) + 14, "left", C.ink);
  axisLabel(ctx, "amber: SMAP   teal: MSL", X(0) + side + 12, Y(1) + 32, "left");
}

/* ================================================================== ENCODINGS */
function renderEncodings() {
  if (!KERN) { $("#e-lib").innerHTML = `<p class="muted">Run the kernel analysis first.</p>`; return; }
  const fam = $("#e-fam").value;
  $("#e-lib").innerHTML = KERN.library.filter((f) => !fam || f.family === fam).map((f) => `
    <div class="panel card"><h3><span>${esc(f.name)}</span><span class="small muted">cost ${fmtInt(f.cost)}</span></h3>
      <pre class="circ">${esc(f.circuit)}</pre>
      <dl><dt>Expressibility</dt><dd>${fmt(f.expressibility, 3)}</dd><dt>Entangling</dt><dd>${fmt(Math.abs(f.entangling), 3)}</dd>
          <dt>1-qubit gates</dt><dd>${f.gates_1q}</dd><dt>2-qubit gates</dt><dd>${f.gates_2q}</dd></dl></div>`).join("");
}
$("#e-fam").addEventListener("change", renderEncodings);

/* ================================================================== KERNEL LAB */
function drawKernels() {
  if (!KERN) return;
  if (!$("#k-fm").options.length) {
    $("#k-fm").innerHTML = KERN.library.map((f) => `<option value="${f.key}">${esc(f.name)}</option>`).join("");
    $("#k-fm").value = KERN.library.find((f) => f.family === "iqp" && f.bandwidth === 0.3 && f.depth === 1)?.key || KERN.library[0].key;
  }
  const K = KERN.heatmaps[$("#k-fm").value];
  {
    const { ctx, w, h } = setup($("#c-heat"));
    const n = K.length, side = Math.min(w, h) - 30, cell = side / n, ox = (w - side) / 2, oy = 4;
    let kmin = 1; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (K[i][j] < kmin) kmin = K[i][j];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = (K[i][j] - kmin) / (1 - kmin || 1);   // stretch to the matrix's own range
      ctx.fillStyle = `hsl(176 ${30 + 40 * v}% ${8 + 62 * Math.sqrt(v)}%)`;
      ctx.fillRect(ox + j * cell, oy + i * cell, Math.ceil(cell), Math.ceil(cell));
    }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ox + side / 2, oy); ctx.lineTo(ox + side / 2, oy + side); ctx.moveTo(ox, oy + side / 2); ctx.lineTo(ox + side, oy + side / 2); ctx.stroke();
    axisLabel(ctx, "normal", ox + side / 4, oy + side + 16, "center"); axisLabel(ctx, "anomalous", ox + 3 * side / 4, oy + side + 16, "center");
    const half = n / 2; let nn = 0, na = 0, c1 = 0, c2 = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) continue; if (i < half && j < half) { nn += K[i][j]; c1++; } else if ((i < half) !== (j < half)) { na += K[i][j]; c2++; } }
    $("#k-heat-note").textContent = `Channel ${KERN.chan}. Mean similarity normal–normal ${fmt(nn / c1)}, normal–anomalous ${fmt(na / c2)}. Colours are stretched from ${fmt(kmin, 2)} (dark) to 1 (bright).`;
  }
  {
    const fam = $("#k-fam").value, rows = KERN.concentration.filter((r) => r.family === fam);
    const { ctx, w, h } = setup($("#c-conc"));
    const pad = { l: 46, r: 80, t: 10, b: 26 };
    const ns = [...new Set(rows.map((r) => r.n))], bs = [...new Set(rows.map((r) => r.bandwidth))];
    const lv = rows.map((r) => Math.log10(Math.max(r.var, 1e-8))), lo = Math.floor(Math.min(...lv)), hi = Math.ceil(Math.max(...lv));
    const X = (n) => pad.l + ((n - ns[0]) / (ns[ns.length - 1] - ns[0])) * (w - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (Math.log10(Math.max(v, 1e-8)) - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
    for (let e = lo; e <= hi; e++) { ctx.strokeStyle = C.rule; ctx.beginPath(); ctx.moveTo(pad.l, Y(10 ** e)); ctx.lineTo(w - pad.r, Y(10 ** e)); ctx.stroke(); axisLabel(ctx, "1e" + e, pad.l - 4, Y(10 ** e) + 4, "right"); }
    ns.forEach((n) => axisLabel(ctx, n + "q", X(n), h - 8, "center"));
    bs.forEach((b, i) => {
      const pts = rows.filter((r) => r.bandwidth === b).sort((a, c) => a.n - c.n);
      const col = `hsl(${176 + i * 30} 55% ${45 + i * 10}%)`;
      line(ctx, pts.map((p) => X(p.n)), pts.map((p) => Y(p.var)), col, 2);
      axisLabel(ctx, "β = " + b, w - pad.r + 6, Y(pts[pts.length - 1].var) + 4, "left", col);
    });
  }
}
$("#k-fm").addEventListener("change", drawKernels);
$("#k-fam").addEventListener("change", drawKernels);

/* ================================================================== DATASET */
let SPARKS = null;
async function renderDataset() {
  if (!SPARKS) SPARKS = await api("/api/sparks");
  const sc = $("#d-sc").value, list = CHANNELS.filter((c) => !sc || c.spacecraft === sc);
  $("#d-count").textContent = `${list.length} channels, ${list.reduce((s, c) => s + c.anomalies.length, 0)} labelled anomaly sequences`;
  $("#d-grid").innerHTML = list.map((c) => `<button class="chan" data-c="${c.chan}"><b>${c.chan}</b><span>${c.spacecraft} · ${c.anomalies.length}</span><canvas height="34"></canvas></button>`).join("");
  $$("#d-grid .chan").forEach((b) => {
    const c = CHANNELS.find((x) => x.chan === b.dataset.c), s = SPARKS[c.chan];
    const { ctx, w, h } = setup($("canvas", b));
    let lo = Math.min(...s), hi = Math.max(...s);
    ctx.fillStyle = C.label; ctx.globalAlpha = 0.45;
    for (const [a, e] of c.anomalies) ctx.fillRect((a / c.length) * w, 0, Math.max(2, ((e - a) / c.length) * w), h);
    ctx.globalAlpha = 1;
    line(ctx, s.map((_, i) => (i / (s.length - 1)) * w), s.map((v) => 2 + (1 - (v - lo) / (hi - lo || 1)) * (h - 4)), C.trace, 1);
    b.addEventListener("click", () => { $("#m-chan").value = c.chan; $("#m-scn").value = "none"; show("mission"); loadMission(c.chan, "none"); });
  });
}
$("#d-sc").addEventListener("change", renderDataset);

/* ================================================================== METHOD */
function renderMethod() {
  const cv = $("#c-flow"), { ctx, w, h } = setup(cv);
  const steps = [
    ["Telemetry window", "64 samples, z-normalised on training data"],
    ["PCA → 6 angles", "one value per qubit"],
    ["Quantum kernel", "|⟨ψ(x′)|ψ(x)⟩|² on a PennyLane circuit"],
    ["One-class SVM", "score s(x) = ρ − Σ αᵢ k(xᵢ, x)"],
    ["Alarm", "smoothed score above threshold"],
  ];
  const bw = (w - 40) / steps.length - 16, y = 30, bh = 74;
  steps.forEach(([a, b], i) => {
    const x = 20 + i * (bw + 16);
    ctx.fillStyle = C.panel; ctx.strokeStyle = i === 2 ? C.quantum : C.rule; ctx.lineWidth = i === 2 ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = "600 14px Archivo, sans-serif"; ctx.textAlign = "center"; ctx.fillText(a, x + bw / 2, y + 30);
    ctx.fillStyle = C["ink-2"]; ctx.font = "11.5px Archivo, sans-serif"; wrap(ctx, b, x + bw / 2, y + 50, bw - 14, 14);
    if (i < steps.length - 1) arrow(ctx, x + bw + 2, y + bh / 2, x + bw + 14, y + bh / 2, C["ink-3"]);
  });
  // feedback loop
  const loop = [["Drift check", "ADWIN, or a 1 000-step alarm", C.drift], ["Validate", "still abnormal after 300 windows?", C["ink-2"]], ["Mode cache", "seen this regime before?", C.good], ["Re-choose encoding", "18 candidates: quality − λ·cost", C.quantum]];
  const y2 = 180, lw = (w - 40) / loop.length - 20;
  loop.forEach(([a, b, col], i) => {
    const x = w - 20 - (i + 1) * (lw + 20) + 20;
    ctx.fillStyle = C.panel; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y2, lw, 70, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.font = "600 14px Archivo, sans-serif"; ctx.textAlign = "center"; ctx.fillText(a, x + lw / 2, y2 + 28);
    ctx.fillStyle = C["ink-2"]; ctx.font = "11.5px Archivo, sans-serif"; ctx.fillText(b, x + lw / 2, y2 + 48);
    if (i < loop.length - 1) arrow(ctx, x - 2, y2 + 35, x - 18, y2 + 35, C["ink-3"]);
  });
  const sx = 20 + 3 * (bw + 16) + bw / 2;
  arrow(ctx, sx, y + bh + 4, sx, y2 - 6, C.drift);
  const ex = 20 + 2 * (bw + 16) + bw / 2;
  arrow(ctx, w - 20 - loop.length * (lw + 20) + 20 + lw / 2, y2 - 4, ex, y + bh + 6, C.quantum);
  axisLabel(ctx, "swap encoding, refit", ex + 8, y2 - 30, "left", C.quantum);
  axisLabel(ctx, "drift?", sx + 8, y2 - 30, "left", C.drift);

  $("#method-text").innerHTML = [
    ["Why a quantum kernel", "A kernel decides which telemetry windows count as similar. A quantum circuit gives a family of similarity measures that a classical computer evaluates only by simulating the circuit; on hardware each entry is one compute–uncompute circuit."],
    ["Why it must adapt", "Spacecraft change operating mode: sunlight and eclipse, instrument on and off, ageing sensors. A detector tuned to one mode raises false alarms in the next. Q-DRIFT notices the change with ADWIN, a test with a guaranteed false-positive bound, and re-chooses how the data is encoded."],
    ["How an encoding is chosen", "Each of the 18 circuits trains a small one-class SVM on half of the recent normal windows and must tell the other half apart from synthetic faults: spikes, level shifts, noise bursts, frozen sensors. That held-out score is combined with the kernel's spread, which guards against kernel concentration, and penalised by circuit cost λ·Cost(c)/Cost_max. A newcomer must beat the current encoding by a clear margin."],
    ["What we changed after testing", "Our LLJ-I proposal scored encodings by kernel-target alignment. On 21 development channels the encodings it picked ranked anomalies worse than a random pick, because it rewards kernels that have collapsed. Collapsed kernels rarely alarm, so they look precise but miss anomalies. We replaced it with the held-out test above and kept alignment as an ablation."],
    ["Not every alarm is a drift", "An anomaly also shifts the score. Before adapting, Q-DRIFT waits 300 windows and checks the most recent half: if the current model still finds it normal, the alarm was transient and nothing changes. A saturated alarm that lasts 1 000 steps, longer than 80% of labelled anomalies, is treated as a possible new mode."],
    ["Why it stays cheap", "Recognised operating modes reuse their stored model with zero new circuits. Only the small one-class SVM is refitted, on recent windows plus a reservoir of past normal behaviour, so old modes are not forgotten."],
  ].map(([a, b]) => `<div class="panel"><h3>${a}</h3><p class="muted" style="margin:0">${b}</p></div>`).join("");
}
function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(" "); let lineTxt = "", yy = y;
  for (const wd of words) { const t = lineTxt ? lineTxt + " " + wd : wd; if (ctx.measureText(t).width > maxW && lineTxt) { ctx.fillText(lineTxt, x, yy); lineTxt = wd; yy += lh; } else lineTxt = t; }
  ctx.fillText(lineTxt, x, yy);
}
function arrow(ctx, x1, y1, x2, y2, col) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 7 * Math.cos(a - 0.45), y2 - 7 * Math.sin(a - 0.45)); ctx.lineTo(x2 - 7 * Math.cos(a + 0.45), y2 - 7 * Math.sin(a + 0.45)); ctx.fill();
}

const VIEWS = { results: renderResults, encodings: renderEncodings, kernels: drawKernels, dataset: renderDataset, method: renderMethod };

/* ------------------------------------------------------------------ boot */
(async () => {
  await loadShared();
  // deep links: #mission/<channel>/<scenario>[/end] or #<view>
  const [view, chan, scn, end] = location.hash.slice(1).split("/");
  // default showcase: T-1 with an abrupt mode change (adapts, recovers, still catches both later anomalies)
  const start = CHANNELS.find((c) => c.chan === chan) ? chan : (CHANNELS.find((c) => c.chan === "T-1") ? "T-1" : CHANNELS[0].chan);
  $("#m-chan").value = start;
  $("#m-scn").value = ["none", "abrupt", "gradual", "recurring"].includes(scn) ? scn : (chan ? "none" : "abrupt");
  await loadMission(start, $("#m-scn").value);
  if (end === "end") $("#m-end").click();
  if (view && view !== "mission" && VIEWS[view] !== undefined || ["lab", "team"].includes(view)) show(view);
})();
