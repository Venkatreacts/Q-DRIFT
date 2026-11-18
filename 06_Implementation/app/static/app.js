"use strict";
/* Q-DRIFT console. Plain JS + canvas, no build step, works offline.
   Modes: served by app/server.py (engine on this machine), or a static export (app/export_static.py)
   whose saved results load from api/*.json and whose live runs, if any, go to a remote engine. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content;
const STATIC = meta("qdrift-static") === "1";
const ENGINE = (meta("qdrift-engine") || "").replace(/\/$/, "");   // remote engine for live runs in a static export

/* Canvas cannot read CSS variables, so resolve each colour token once to rgb through a 1px canvas. */
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const rgbOf = (cssColor) => {
  probe.clearRect(0, 0, 1, 1); probe.fillStyle = cssColor; probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data; return [r, g, b];
};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const C = {}, RGB = {};
const TOKENS = { paper: "--color-paper-3", ink: "--color-ink", "ink-2": "--color-ink-2", muted: "--color-muted", rule: "--color-rule",
  accent: "--color-accent", amber: "--color-accent-2", trace: "--c-trace", score: "--c-score", classic: "--c-classic", label: "--c-label",
  drift: "--c-drift", switch: "--c-switch", angle: "--c-fam-angle", zz: "--c-fam-zz", iqp: "--c-fam-iqp", "heat-lo": "--c-heat-lo", "heat-hi": "--c-heat-hi" };
function readTokens() {
  for (const [k, v] of Object.entries(TOKENS)) { RGB[k] = rgbOf(css(v)); C[k] = `rgb(${RGB[k].join(",")})`; }
}
readTokens();
const FONT = () => css("--font-body") || "monospace";

const fmt = (x, d = 3) => (x == null || Number.isNaN(x) ? "–" : Number(x).toFixed(d));
const fmtInt = (x) => (x == null ? "–" : Math.round(x).toLocaleString("en-US"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const cache = {};
async function api(path, opts) {
  if (!opts && cache[path]) return cache[path];
  let url = path;
  if (STATIC) url = opts ? ENGINE + path : "." + path + ".json";
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText || "request failed");
  const j = await r.json();
  if (!opts) cache[path] = j;
  return j;
}

/* ------------------------------------------------------------------ canvas helpers */
function setup(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = +cv.getAttribute("height");
  cv.style.height = h + "px";
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
function line(ctx, xs, ys, color, width = 1.2, dash = []) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
  let started = false;
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] == null || Number.isNaN(ys[i])) { started = false; continue; }
    started ? ctx.lineTo(xs[i], ys[i]) : ctx.moveTo(xs[i], ys[i]);
    started = true;
  }
  ctx.stroke(); ctx.setLineDash([]);
}
function axisLabel(ctx, text, x, y, align = "left", color = C.muted, weight = 400, size = 11) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${FONT()}`; ctx.textAlign = align; ctx.fillText(text, x, y);
}
/* spread end-of-line labels so none overlap: sort by y, push each down to keep a minimum gap */
function spread(items, gap, lo, hi) {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap;
  const over = s.length ? s[s.length - 1].y - hi : 0;
  if (over > 0) s.forEach((it) => (it.y = Math.max(lo, it.y - over)));
  return s;
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

/* ------------------------------------------------------------------ navigation (state lives in the URL) */
function show(view, push = true) {
  if (!$(`#v-${view}`)) view = "mission";
  $$(".tabs button").forEach((b) => b.dataset.view === view ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $$(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + view));
  (VIEWS[view] || (() => {}))();
  if (view === "mission") requestAnimationFrame(drawMission);
  if (push) {
    const hash = view === "mission" && M.rep ? `#mission/${M.chan}/${M.scn}` : "#" + view;
    if (location.hash !== hash) history.pushState(null, "", hash);
  }
}
$$(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
window.addEventListener("popstate", () => route(false));

/* ------------------------------------------------------------------ engine status */
let ENGINE_OK = !STATIC;
async function checkEngine() {
  const el = $("#engine");
  if (!STATIC) { el.innerHTML = `<span class="live" aria-hidden="true"></span><b>Engine on this machine</b>`; return; }
  if (!ENGINE) { setStaticRun("This is the saved-results copy of the console. Live runs need the engine: run app/server.py on a laptop."); el.innerHTML = "Saved replays only"; return; }
  el.textContent = "Waking the engine…";
  try {
    const r = await fetch(ENGINE + "/api/health", { cache: "no-store" });
    if (!r.ok) throw new Error(r.statusText);
    ENGINE_OK = true; el.innerHTML = `<span class="live" aria-hidden="true"></span><b>Engine online</b>`;
  } catch {
    el.textContent = "Engine offline, saved replays only";
    setStaticRun("The live engine is not reachable right now (it may be waking up; try again in a minute). Saved replays still work.");
  }
}
function setStaticRun(msg) {
  $("#l-run").disabled = true;
  $("#l-out").innerHTML = `<div class="empty"><h2>Live runs are off here</h2><p>${esc(msg)}</p></div>`;
}

/* ------------------------------------------------------------------ shared data */
let CHANNELS = [], LIB = {}, KERN = null;
const LIB_COLORS = {};
async function loadShared() {
  CHANNELS = await api("/api/channels");
  try {
    KERN = await api("/api/results/kernels");
    KERN.library.forEach((f) => {
      f.circuit = f.circuit.replace(/ +State/g, "");   // PennyLane labels the state() return on every wire
      LIB[f.key] = f;
      LIB_COLORS[f.key] = C[f.family] || C.accent;
    });
  } catch (e) { console.warn("kernels.json missing", e); }
  const opts = CHANNELS.map((c) => `<option value="${c.chan}">${c.chan} (${c.spacecraft})</option>`).join("");
  $("#m-chan").innerHTML = opts; $("#l-chan").innerHTML = opts;
}

/* ================================================================== MISSION REPLAY */
const M = { rep: null, chan: null, scn: null, t: 0, playing: false, speed: 160, cmp: "Static-best QSVM", seen: new Set(), last: 0 };
const OURS = "Q-DRIFT";

async function loadMission(cid, scn) {
  M.playing = false; $("#m-play").textContent = "Play";
  M.chan = cid; M.scn = scn;
  $("#m-why").textContent = `Loading the ${cid} replay…`;
  let rep;
  try {
    rep = scn === "none" ? await api(`/api/replay/${cid}`) : await api(`/api/drift/${cid}/${scn}`);
  } catch (e) {
    if (scn === "none" || !ENGINE_OK) {
      clearMission(scn === "none"
        ? "This channel has no saved replay. Run experiments/run_all.py, or use the Drift lab."
        : "No saved run for this channel and drift. Start the engine to compute it live, or pick another channel.");
      return;
    }
    clearMission("No saved run for this channel and drift. Running it live…");
    try { rep = await runLive({ chan: cid, drift: scn }); }
    catch (err) { clearMission(`Live run failed: ${err.message}`); return; }
  }
  setReplay(rep);
}

function clearMission(msg) {
  M.rep = null;
  $("#m-why").textContent = msg; $("#m-enc").textContent = "None yet"; $("#m-circ").textContent = "";
  $("#m-race").innerHTML = ""; $("#m-race").style.height = "0px"; $("#m-log").innerHTML = ""; $("#m-counters").innerHTML = "";
  $("#m-t").textContent = "–";
  for (const id of ["#c-tele", "#c-score", "#c-strip"]) setup($(id));
}

function setReplay(rep) {
  M.rep = rep; M.t = 0; M.seen = new Set();
  const names = Object.keys(rep.methods).filter((n) => n !== OURS);
  if (!names.includes(M.cmp)) M.cmp = names[0];
  $("#m-cmp").innerHTML = names.map((n) => `<option ${n === M.cmp ? "selected" : ""}>${esc(n)}</option>`).join("");
  $("#m-cmp").value = M.cmp;
  $("#k-cmp-name").textContent = M.cmp;
  $("#m-log").innerHTML = "";
  $("#m-race").innerHTML = ""; $("#m-race").style.height = "0px";
  const init = (rep.methods[OURS].events || []).find((e) => e.type === "init");
  setEncoding(init, false);
  $("#m-why").textContent = init ? "Chosen on the training segment before the stream starts. Press Play." : "";
  if (init) logEvent(0, "k-switch", "Start", `with ${esc(init.encoding)}`);
  drawMission();
}

function setEncoding(ev, animate = true) {
  if (!ev) { $("#m-enc").textContent = "None yet"; $("#m-circ").textContent = ""; return; }
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
  const rowH = 16;
  ol.style.height = cands.length * rowH + "px";
  ol.innerHTML = cands.map((c) =>
    `<li data-k="${c.key}"><span>${esc(c.name)}</span><span class="b"></span><span class="v">${fmt(c.score, 2)}</span></li>`).join("");
  const lis = $$("li", ol);
  lis.forEach((li, i) => (li.style.transform = `translateY(${i * rowH}px)`));
  const go = () => lis.forEach((li) => {
    const c = cands.find((x) => x.key === li.dataset.k);
    li.style.transform = `translateY(${sorted.indexOf(c) * rowH}px)`;
    $(".b", li).style.transform = `scaleX(${(0.08 + 0.92 * (c.score - lo) / (hi - lo || 1)).toFixed(3)})`;
    li.classList.toggle("win", c.key === winKey);
  });
  animate ? requestAnimationFrame(() => requestAnimationFrame(go)) : go();
}

function logEvent(t, cls, tag, text) {
  const li = document.createElement("li");
  li.innerHTML = `<span class="t">${fmtInt(t)}</span><span class="${cls}"><span class="tag">${tag}</span>${text}</span>`;
  $("#m-log").prepend(li);
}

function overlapsLabel(a, b, rep) { return rep.anomalies.some(([s, e]) => a <= e && b >= s); }

function stepEvents(t0, t1) {
  const rep = M.rep, m = rep.methods[OURS];
  for (const [a, b] of m.alarm_events) {
    const id = "a" + a;
    if (a <= t1 && !M.seen.has(id)) {
      M.seen.add(id);
      logEvent(a, "k-alarm", "Alarm", overlapsLabel(a, b, rep) ? "matches a NASA-labelled anomaly" : "no matching label (false alarm)");
    }
  }
  for (const ev of m.events) {
    if (ev.type === "init" || ev.t > t1) continue;
    const id = "e" + ev.t + ev.type;
    if (M.seen.has(id)) continue;
    M.seen.add(id);
    if (ev.type === "drift") {
      logEvent(ev.t, "k-drift", "Drift", ev.trigger === "sustained alarm"
        ? "alarm unbroken for 1,000 steps: possible new operating mode"
        : "ADWIN: the score distribution shifted");
      $("#m-why").textContent = "Possible regime change. Collecting 300 windows before deciding whether to adapt.";
    } else if (ev.type === "keep") {
      logEvent(ev.t, "k-cache", "Kept", `current model still fits (median z ${fmt(ev.median_z, 1)}), 0 circuits`);
      $("#m-why").textContent = "The new data still looks normal to the current model, so nothing changes. Transient spikes do not cause a switch.";
    } else if (ev.type === "switch") {
      if (ev.cache_hit) {
        logEvent(ev.t, "k-cache", "Cache", `mode recognised: reused ${esc(ev.encoding)}, 0 circuits`);
        $("#m-why").textContent = "This operating mode was seen before, so the stored model is reused at once.";
        setEncoding(ev);
      } else {
        const n = ev.candidates ? ev.candidates.length : 0;
        const same = ev.from === ev.encoding;
        logEvent(ev.t, "k-switch", "Switch", n ? (same ? `tested ${n} encodings; ${esc(ev.encoding)} still best, refitted` : `tested ${n} encodings, now ${esc(ev.encoding)}`) : "refitted on recent data");
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
  const pad = { l: 40, r: 8, t: 18, b: 18 };
  // size both charts so the whole replay fits the window: what is left after the bar, headers, strip and counters
  const ch = Math.round(Math.max(100, Math.min(220, (innerHeight - 380) / 2)));
  $("#c-tele").setAttribute("height", ch); $("#c-score").setAttribute("height", ch);

  // ---- telemetry
  {
    const { ctx, w, h } = setup($("#c-tele"));
    const X = (i) => pad.l + (i / (T - 1)) * (w - pad.l - pad.r);
    let lo = Infinity, hi = -Infinity;
    for (const v of rep.test) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
    ctx.fillStyle = C.label; ctx.globalAlpha = 0.2;
    for (const [s, e] of rep.anomalies) if (s <= t) ctx.fillRect(X(s), pad.t, Math.max(2, X(Math.min(e, t)) - X(s)), h - pad.t - pad.b);
    ctx.globalAlpha = 1;
    const pts = decimate(rep.test, 0, Math.max(1, t), Math.floor(w));
    line(ctx, pts.map((p) => X(p[0])), pts.map((p) => Y(p[1])), C.trace, 1);
    if (rep.t0 != null && t >= rep.t0) {   // the label sits in the top margin, clear of the trace and the bands
      ctx.fillStyle = C.drift; ctx.fillRect(X(rep.t0) - 1, pad.t - 4, 2, h - pad.t - pad.b + 4);
      axisLabel(ctx, rep.drift_kind + " drift injected", X(rep.t0) + 5, 11, X(rep.t0) > w * 0.7 ? "right" : "left", C.ink, 800);
    }
    axisLabel(ctx, fmt(hi, 1), pad.l - 6, pad.t + 8, "right"); axisLabel(ctx, fmt(lo, 1), pad.l - 6, h - pad.b, "right");
    axisLabel(ctx, "0", pad.l, h - 4); axisLabel(ctx, fmtInt(T), w - pad.r, h - 4, "right");
  }
  // ---- score
  const ours = rep.methods[OURS], cmp = rep.methods[M.cmp];
  {
    const { ctx, w, h } = setup($("#c-score"));
    const X = (i) => pad.l + (i / (T - 1)) * (w - pad.l - pad.r);
    const top = Math.max(rep.z_thr * 3, 12), bot = -4;
    const Y = (v) => pad.t + (1 - (Math.min(Math.max(v, bot), top) - bot) / (top - bot)) * (h - pad.t - pad.b);
    ctx.fillStyle = C.label; ctx.globalAlpha = 0.12;
    for (const [s, e] of rep.anomalies) if (s <= t) ctx.fillRect(X(s), pad.t, Math.max(2, X(Math.min(e, t)) - X(s)), h - pad.t - pad.b);
    ctx.globalAlpha = 1;
    line(ctx, [pad.l, w - pad.r], [Y(rep.z_thr), Y(rep.z_thr)], C.ink, 1, [4, 4]);
    axisLabel(ctx, "alarm", pad.l - 6, Y(rep.z_thr) + 4, "right", C.ink);
    if (cmp) { const p = decimate(cmp.score, 0, Math.max(1, t), Math.floor(w)); line(ctx, p.map((q) => X(q[0])), p.map((q) => Y(q[1])), C.classic, 1); }
    const p = decimate(ours.score, 0, Math.max(1, t), Math.floor(w));
    line(ctx, p.map((q) => X(q[0])), p.map((q) => Y(q[1])), C.score, 1.4);
    for (const d of ours.drift) if (d <= t) { ctx.fillStyle = C.drift; ctx.fillRect(X(d) - 1, pad.t, 2, h - pad.t - pad.b); }
    for (const s of ours.switch) if (s <= t) { ctx.fillStyle = C.switch; ctx.fillRect(X(s) - 5, 2, 10, 10); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(X(s) - 5, 2, 10, 10); }
    for (const [a, b] of ours.alarm_events) if (a <= t) { ctx.fillStyle = C.score; ctx.fillRect(X(a), h - pad.b - 4, Math.max(2, X(Math.min(b, t)) - X(a)), 4); }
  }
  // ---- encoding strip, coloured by circuit family
  {
    const { ctx, w, h } = setup($("#c-strip"));
    const X = (i) => pad.l + (i / (T - 1)) * (w - pad.l - pad.r);
    const runs = ours.encoding;
    for (let i = 0; i < runs.length; i++) {
      const [s, v] = runs[i], e = i + 1 < runs.length ? runs[i + 1][0] : T;
      if (s > t || v < 0) continue;
      const key = KERN ? KERN.library[v]?.key : null;
      ctx.fillStyle = (key && LIB_COLORS[key]) || C.accent;
      ctx.fillRect(X(s), 3, X(Math.min(e, t)) - X(s), h - 6);
      ctx.fillStyle = C.paper; ctx.fillRect(X(s), 3, 1, h - 6);   // a hairline marks each change
    }
  }
  // ---- counters
  const caught = rep.anomalies.filter(([s, e]) => s <= t && ours.alarm_events.some(([a, b]) => a <= Math.min(e, t) && b >= s)).length;
  const due = rep.anomalies.filter(([s]) => s <= t).length;
  const sw = ours.events.filter((e) => e.type === "switch" && e.t <= t);
  const hits = sw.filter((e) => e.cache_hit).length;
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
    [`${caught}/${due}`, "labelled anomalies caught", 1],
    [pctTxt(alarmTime(ours)), `normal time in alarm (${esc(M.cmp)}: ${pctTxt(alarmTime(cmp))})`, 1],
    [ours.drift.filter((d) => d <= t).length, "drifts detected"],
    [sw.length, hits ? `encoding switches, ${hits} from cache` : "encoding switches"],
    [fmtInt(circ), "circuits for selection and training"],
  ].map(([b, s, o]) => `<div class="${o ? "ours" : ""}"><b>${b}</b><span>${s}</span></div>`).join("");
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
const missionChanged = async () => { await loadMission($("#m-chan").value, $("#m-scn").value); history.replaceState(null, "", `#mission/${M.chan}/${M.scn}`); };
$("#m-chan").addEventListener("change", missionChanged);
$("#m-scn").addEventListener("change", missionChanged);
$("#m-cmp").addEventListener("change", () => { M.cmp = $("#m-cmp").value; $("#k-cmp-name").textContent = M.cmp; drawMission(); });
let resizeT;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    drawMission();
    if ($("#v-kernels").classList.contains("on")) drawKernels();
    if ($("#v-method").classList.contains("on")) renderMethod();
    if ($("#v-results").classList.contains("on") && RB) { drawThr(RB); drawScatter(RB, $("#r-sc-cmp").value); }
  }, 120);
});

/* ================================================================== DRIFT LAB */
let running = false;
async function runLive(body) {
  if (running) throw new Error("Another run is still going. Wait for it to finish.");
  running = true;
  const panel = $("#l-out");
  panel.classList.add("busy"); $("#l-run").disabled = true; $("#l-run").textContent = "Running…";
  try {
    return await api("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } finally {
    running = false; panel.classList.remove("busy"); $("#l-run").disabled = !ENGINE_OK; $("#l-run").textContent = "Run live";
  }
}
$("#l-lam").addEventListener("input", () => ($("#l-lam-v").textContent = (+$("#l-lam").value).toFixed(2)));
$("#l-run").addEventListener("click", async () => {
  const body = { chan: $("#l-chan").value, drift: $("#l-drift").value, n_qubits: +$("#l-q").value,
                 lam: +$("#l-lam").value, shots: +$("#l-shots").value };
  const t = performance.now();
  let rep;
  try { rep = await runLive(body); }
  catch (e) { $("#l-out").innerHTML = `<div class="empty"><h2>Run failed</h2><p class="error">${esc(e.message)}</p><p>Try a shorter channel (M-1, T-12) or press Run live again.</p></div>`; return; }
  const secs = ((performance.now() - t) / 1000).toFixed(1);
  const rows = Object.entries(rep.metrics).map(([n, m]) => {
    const r = rep.methods[n];
    const sel = r.circuits.select + r.circuits.fit;
    return `<tr class="${n === OURS ? "ours" : ""}"><td>${esc(n)}</td><td>${m.tp}/${m.tp + m.fn}</td><td>${m.fp}</td><td>${fmt(m.precision, 2)}</td><td>${fmt(m.recall, 2)}</td><td>${fmt(m.auc_pr, 3)}</td><td>${r.switch.length}</td><td>${fmtInt(sel)}</td></tr>`;
  }).join("");
  $("#l-out").innerHTML = `<div class="ph"><h2>${esc(body.chan)}, ${esc(body.drift === "none" ? "no drift" : body.drift + " drift")}</h2><span class="note-s">computed live in ${secs} s</span></div>
    <div class="scroll-x"><table><thead><tr><th>Method</th><th>Anomalies caught</th><th>False alarms</th><th>Precision</th><th>Recall</th><th>AUC-PR</th><th>Switches</th><th>Circuits (select and train)</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p style="margin-top:var(--space-md)"><button class="btn primary" id="l-open">Open in Mission replay</button></p>`;
  $("#l-open").addEventListener("click", () => {
    M.chan = body.chan; M.scn = body.drift; $("#m-chan").value = body.chan; $("#m-scn").value = body.drift;
    show("mission"); setReplay(rep);
  });
});

/* ================================================================== RESULTS */
// Hundman et al., KDD 2018 (telemanom README, default parameters, with pruning)
const NASA_LSTM = { name: "NASA LSTM + dynamic threshold (published)",
  ALL: { precision: 0.875, recall: 0.800 }, SMAP: { precision: 0.855, recall: 0.855 }, MSL: { precision: 0.926, recall: 0.694 } };
let RB = null;
async function renderResults() {
  if (RB) return;
  let B, A, D, N, Q;
  try { B = await api("/api/results/benchmark"); }
  catch { $("#r-body").innerHTML = `<div class="empty"><h2>No benchmark yet</h2><p>Run <code>python experiments/run_all.py</code> (about 40 minutes), then reload.</p></div>`; return; }
  [A, D, N, Q] = await Promise.all(["ablation", "drift", "noise", "qubits"].map((n) => api("/api/results/" + n).catch(() => null)));
  RB = B;
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
    const ref = `<tr><td class="ref">${NASA_LSTM.name}</td><td class="ref">–</td><td class="ref">–</td><td class="ref">${fmt(L.precision)}</td><td class="ref">${fmt(L.recall)}</td><td class="ref">${fmt(2 * L.precision * L.recall / (L.precision + L.recall))}</td><td colspan="5" class="ref-note">A deep forecaster per channel that also reads command channels and prunes alarms. Reference only.</td></tr>`;
    return `<div class="scroll-x"><table><thead><tr><th>Method</th><th>Caught</th><th>False alarms</th><th>Precision</th><th>Recall</th><th>F1</th><th>F0.5</th><th>AUC-PR</th><th>False alarms per 1k steps</th><th>Switches per channel</th><th>Circuits per channel</th></tr></thead><tbody>${rows}${ref}</tbody></table></div>`;
  };
  const W = B.wilcoxon;
  const wil = Object.entries(W).map(([n, r]) => `<tr><td>${esc(n)}</td><td>${fmt(r.auc_pr.mean_diff, 3)}</td><td>${r.auc_pr.wins}–${r.auc_pr.losses}</td><td>${fmt(r.auc_pr.p, 4)}</td><td>${fmt(r.event_f1.mean_diff, 3)}</td><td>${r.event_f1.wins}–${r.event_f1.losses}</td><td>${fmt(r.event_f1.p, 4)}</td></tr>`).join("");
  let html = `
  <section class="well"><div class="ph"><h2>Benchmark: all channels</h2><div class="seg" role="group" aria-label="Mission">
     <button data-g="ALL" aria-pressed="true">Both</button><button data-g="SMAP" aria-pressed="false">SMAP</button><button data-g="MSL" aria-pressed="false">MSL</button></div></div>
     <div id="r-main">${tbl("ALL")}</div>
     <p class="note-s" style="margin-top:var(--space-sm)">Alarm threshold: smoothed robust z-score above ${B.z_thr ?? 6}, the same rule for every method. ${B.channels} channels, ${B.aggregate[OURS].ALL.tp + B.aggregate[OURS].ALL.fn} labelled anomaly sequences. Circuits are what a quantum computer would run for encoding selection and training; scoring adds one circuit per support vector per step.</p></section>
  <div class="grid2">
    <section class="well"><h2>Is the difference real? Wilcoxon signed-rank, per channel</h2>
      <div class="scroll-x" style="margin-top:var(--space-sm)"><table><thead><tr><th>Q-DRIFT against</th><th>Δ AUC-PR</th><th>Wins–losses</th><th>p</th><th>Δ event F1</th><th>Wins–losses</th><th>p</th></tr></thead><tbody>${wil}</tbody></table></div>
      <p class="note-s" style="margin-top:var(--space-sm)">Positive Δ means Q-DRIFT is better. p below 0.05 means the gap is unlikely to be chance across channels.</p></section>
    <figure class="well"><figcaption><h2>Threshold sensitivity</h2></figcaption><canvas class="chart" id="c-thr" height="260" style="margin-top:var(--space-sm)"></canvas>
      <p class="note-s" style="margin-top:var(--space-xs)">Event F1 at every alarm threshold. A method that wins at one threshold only is tuned, not better.</p></figure>
  </div>
  <figure class="well"><figcaption class="ph"><h2>Per-channel AUC-PR</h2><label class="ctl">Q-DRIFT against <select id="r-sc-cmp">${names.filter((n) => n !== OURS).map((n) => `<option>${esc(n)}</option>`).join("")}</select></label></figcaption>
    <canvas class="chart" id="c-scatter" height="320"></canvas><p class="note-s" style="margin-top:var(--space-xs)">Each dot is one NASA channel. Above the diagonal, Q-DRIFT ranks anomalies better on that channel.</p></figure>`;
  if (D) {
    const kinds = ["abrupt", "gradual", "recurring"];
    const mnames = Object.keys(D.abrupt.aggregate);
    const rows = mnames.map((n) => `<tr class="${n === OURS ? "ours" : ""}"><td>${esc(n)}</td>${kinds.map((k) => { const g = D[k].aggregate[n]; return `<td>${g.tp}/${g.tp + g.fn}</td><td>${(100 * g.post_alarm_frac).toFixed(1)}%</td><td>${g.cache_hits || 0}</td>`; }).join("")}</tr>`).join("");
    html += `<section class="well"><h2>Controlled drift: ${D.channels.length} channels with a mode change injected at a known time</h2>
      <div class="scroll-x" style="margin-top:var(--space-sm)"><table><thead><tr><th rowspan="2">Method</th>${kinds.map((k) => `<th colspan="3" style="text-align:center">${k[0].toUpperCase() + k.slice(1)}</th>`).join("")}</tr><tr>${kinds.map(() => "<th>Caught</th><th>False-alarm time</th><th>Cache hits</th>").join("")}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note-s" style="margin-top:var(--space-sm)">The new mode is normal behaviour, not an anomaly. False-alarm time is the share of normal steps after the change spent in alarm (lower is better). Recurring modes test the cache: a stored model comes back with zero circuits.</p></section>`;
  }
  if (A) {
    const an = Object.keys(A.aggregate);
    html += `<section class="well"><h2>Ablation: which part of Q-DRIFT matters</h2><div class="scroll-x" style="margin-top:var(--space-sm)"><table><thead><tr><th>Variant</th><th>Precision</th><th>Recall</th><th>F1</th><th>AUC-PR</th><th>False alarms per 1k</th><th>Switches</th><th>Cache hits</th><th>Selection circuits per channel</th></tr></thead><tbody>${an.map((n) => { const g = A.aggregate[n].ALL; return `<tr class="${n === OURS ? "ours" : ""}"><td>${esc(n)}</td><td>${fmt(g.precision)}</td><td>${fmt(g.recall)}</td><td>${fmt(g.f1)}</td><td>${fmt(g.auc_pr)}</td><td>${fmt(g.false_alarms_per_1k, 2)}</td><td>${fmt(g.switches_mean, 1)}</td><td>${g.cache_hits_total}</td><td>${fmtInt(g.circuits_mean.select)}</td></tr>`; }).join("")}</tbody></table></div></section>`;
  }
  if (N || Q) {
    html += `<div class="grid2">`;
    if (N) {
      const shots = [...new Set(N.grid.map((r) => r.shots))], p2s = [...new Set(N.grid.map((r) => r.p2))];
      html += `<section class="well"><h2>Hardware noise: Q-DRIFT AUC-PR</h2><div class="scroll-x" style="margin-top:var(--space-sm)"><table><thead><tr><th>2-qubit error</th>${shots.map((s) => `<th>${s ? fmtInt(s) + " shots" : "exact"}</th>`).join("")}</tr></thead><tbody>${p2s.map((p) => `<tr><td>${p ? (p * 100).toFixed(1) + "%" : "none"}</td>${shots.map((s) => { const r = N.grid.find((x) => x.p2 === p && x.shots === s); return `<td>${fmt(r?.["Q-DRIFT"].auc_pr)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="note-s" style="margin-top:var(--space-sm)">Simulated depolarising noise on the compute–uncompute circuit plus binomial shot noise, on ${N.channels.length} channels. AUC-PR stays between 0.32 and 0.35: noise only rescales the kernel, and 512 shots still resolve the values the detector uses.</p></section>`;
    }
    if (Q) {
      html += `<section class="well"><h2>Qubit count</h2><div class="scroll-x" style="margin-top:var(--space-sm)"><table><thead><tr><th>Qubits</th>${Object.keys(Q.rows[0]).filter((k) => k !== "n_qubits").map((k) => `<th>${esc(k)} AUC-PR</th>`).join("")}</tr></thead><tbody>${Q.rows.map((r) => `<tr><td>${r.n_qubits}</td>${Object.keys(r).filter((k) => k !== "n_qubits").map((k) => `<td>${fmt(r[k].auc_pr)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="note-s" style="margin-top:var(--space-sm)">One PCA component per qubit, on ${Q.channels.length} channels.</p></section>`;
    }
    html += `</div>`;
  }
  $("#r-body").innerHTML = `<div class="r-stack">${html}</div>`;
  $$("#r-body .seg button").forEach((b) => b.addEventListener("click", () => {
    $$("#r-body .seg button").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("#r-main").innerHTML = tbl(b.dataset.g);
  }));
  drawThr(B); drawScatter(B, $("#r-sc-cmp").value);
  $("#r-sc-cmp").addEventListener("change", () => drawScatter(B, $("#r-sc-cmp").value));
}

/* one look per method: Q-DRIFT is the live cobalt, the rest are ink greys told apart by dash */
const METHOD_STYLE = (n) => n === OURS ? [C.score, 2.4, []] : ({
  "Static-best QSVM": [C.ink, 1.4, []], "Fixed QSVM": [C.ink, 1.2, [6, 3]], "RBF OCSVM": [C.muted, 1.4, []],
  "Online RBF + ADWIN": [C.muted, 1.2, [2, 3]], "Isolation Forest": [C.classic, 1.2, [6, 3]] }[n] || [C.classic, 1, []]);
function drawThr(B) {
  const { ctx, w, h } = setup($("#c-thr"));
  const pad = { l: 40, r: 150, t: 10, b: 30 };
  const names = Object.keys(B.threshold_curve), thr = Object.keys(B.threshold_curve[OURS]).map(Number);
  const X = (i) => pad.l + (i / (thr.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - v) * (h - pad.t - pad.b);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) { line(ctx, [pad.l, w - pad.r], [Y(v), Y(v)], C.rule, 1); axisLabel(ctx, v.toFixed(2), pad.l - 6, Y(v) + 4, "right"); }
  thr.forEach((t, i) => axisLabel(ctx, t, X(i), h - 14, "center"));
  axisLabel(ctx, "alarm threshold (z)", (pad.l + w - pad.r) / 2, h - 1, "center");
  const ends = [];
  names.forEach((n) => {
    const ys = thr.map((t) => Y(B.threshold_curve[n][String(t)].f1));
    const [col, lw, dash] = METHOD_STYLE(n);
    line(ctx, thr.map((_, i) => X(i)), ys, col, lw, dash);
    ends.push({ n, y: ys[ys.length - 1] + 4, col });
  });
  for (const e of spread(ends, 13, pad.t + 8, h - pad.b)) axisLabel(ctx, e.n, w - pad.r + 8, e.y, "left", e.col, e.n === OURS ? 800 : 400);
}
function drawScatter(B, other) {
  const { ctx, w, h } = setup($("#c-scatter"));
  const pad = { l: 48, r: 12, t: 22, b: 30 }, side = Math.min(w - pad.l - pad.r, h - pad.t - pad.b);
  const X = (v) => pad.l + v * side, Y = (v) => pad.t + (1 - v) * side;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(X(0), Y(1), side, side);
  line(ctx, [X(0), X(1)], [Y(0), Y(1)], C.rule, 1, [4, 4]);
  for (const v of [0, 0.5, 1]) { axisLabel(ctx, v.toFixed(1), X(0) - 6, Y(v) + 4, "right"); axisLabel(ctx, v.toFixed(1), X(v), Y(0) + 14, "center"); }
  axisLabel(ctx, `${other} AUC-PR`, X(1), Y(0) + 28, "right");
  axisLabel(ctx, "Q-DRIFT AUC-PR", X(0), pad.t - 8, "left");
  let up = 0, down = 0;
  for (const pc of B.per_channel) {
    const a = pc[OURS].auc_pr, b = pc[other].auc_pr;
    if (a == null || b == null) continue;
    a > b ? up++ : a < b ? down++ : 0;
    const smap = pc[OURS].spacecraft === "SMAP";
    ctx.fillStyle = smap ? C.accent : C.paper; ctx.strokeStyle = smap ? C.accent : C.ink; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(X(b), Y(a), 3.8, 0, 7); ctx.fill(); ctx.stroke();
  }
  const lx = X(0) + side + 20;
  if (lx + 150 < w) {
    axisLabel(ctx, `Q-DRIFT better on ${up},`, lx, Y(1) + 14, "left", C.ink, 800);
    axisLabel(ctx, `worse on ${down}`, lx, Y(1) + 30, "left", C.ink, 800);
    ctx.fillStyle = C.accent; ctx.fillRect(lx, Y(1) + 44, 8, 8); axisLabel(ctx, "SMAP", lx + 14, Y(1) + 52);
    ctx.strokeStyle = C.ink; ctx.strokeRect(lx, Y(1) + 62, 8, 8); axisLabel(ctx, "MSL", lx + 14, Y(1) + 70);
  }
}

/* ================================================================== ENCODINGS */
function renderEncodings() {
  if (!KERN) { $("#e-lib").innerHTML = `<div class="empty"><h2>No encoding data</h2><p>Run <code>python experiments/run_all.py kernels</code>, then reload.</p></div>`; return; }
  const fam = $("#e-fam").value;
  $("#e-lib").innerHTML = KERN.library.filter((f) => !fam || f.family === fam).map((f) => `
    <article class="well card"><div class="card-h"><h3>${esc(f.name)}</h3><p>cost ${fmtInt(f.cost)}</p></div>
      <pre class="circ">${esc(f.circuit)}</pre>
      <dl><dt>Expressibility (KL)</dt><dd>${fmt(f.expressibility, 3)}</dd><dt>Entangling (Meyer-Wallach)</dt><dd>${fmt(Math.abs(f.entangling), 3)}</dd>
          <dt>1-qubit gates</dt><dd>${f.gates_1q}</dd><dt>2-qubit gates</dt><dd>${f.gates_2q}</dd></dl></article>`).join("");
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
    const [lo, hi] = [RGB["heat-lo"], RGB["heat-hi"]];
    let kmin = 1; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (K[i][j] < kmin) kmin = K[i][j];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = Math.sqrt((K[i][j] - kmin) / (1 - kmin || 1));   // stretched to the matrix's own range; dark means similar
      ctx.fillStyle = `rgb(${lo.map((c, k) => Math.round(c + (hi[k] - c) * v)).join(",")})`;
      ctx.fillRect(ox + j * cell, oy + i * cell, Math.ceil(cell), Math.ceil(cell));
    }
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox + side / 2, oy); ctx.lineTo(ox + side / 2, oy + side); ctx.moveTo(ox, oy + side / 2); ctx.lineTo(ox + side, oy + side / 2); ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, side, side);
    axisLabel(ctx, "normal", ox + side / 4, oy + side + 18, "center", C.ink); axisLabel(ctx, "anomalous", ox + 3 * side / 4, oy + side + 18, "center", C.ink);
    const half = n / 2; let nn = 0, na = 0, c1 = 0, c2 = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) continue; if (i < half && j < half) { nn += K[i][j]; c1++; } else if ((i < half) !== (j < half)) { na += K[i][j]; c2++; } }
    $("#k-heat-note").textContent = `Channel ${KERN.chan}. Mean similarity normal–normal ${fmt(nn / c1)}, normal–anomalous ${fmt(na / c2)}. Shades run from ${fmt(kmin, 2)} (pale) to 1 (ink).`;
  }
  {
    const fam = $("#k-fam").value, rows = KERN.concentration.filter((r) => r.family === fam);
    const { ctx, w, h } = setup($("#c-conc"));
    const pad = { l: 52, r: 76, t: 12, b: 28 };
    const ns = [...new Set(rows.map((r) => r.n))], bs = [...new Set(rows.map((r) => r.bandwidth))];
    const lv = rows.map((r) => Math.log10(Math.max(r.var, 1e-8))), lo = Math.floor(Math.min(...lv)), hi = Math.ceil(Math.max(...lv));
    const X = (n) => pad.l + ((n - ns[0]) / (ns[ns.length - 1] - ns[0])) * (w - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (Math.log10(Math.max(v, 1e-8)) - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
    for (let e = lo; e <= hi; e++) { line(ctx, [pad.l, w - pad.r], [Y(10 ** e), Y(10 ** e)], C.rule, 1); axisLabel(ctx, "10^" + e, pad.l - 6, Y(10 ** e) + 4, "right"); }
    ns.forEach((n) => axisLabel(ctx, n + " qubits", X(n), h - 8, "center"));
    const cols = [C.classic, C.zz, C.accent, C.iqp];
    const ends = [];
    bs.forEach((b, i) => {
      const pts = rows.filter((r) => r.bandwidth === b).sort((a, c) => a.n - c.n);
      line(ctx, pts.map((p) => X(p.n)), pts.map((p) => Y(p.var)), cols[i % 4], 2.2);
      ends.push({ n: "β = " + b, y: Y(pts[pts.length - 1].var) + 4, col: cols[i % 4] });
    });
    for (const e of spread(ends, 14, pad.t + 8, h - pad.b)) axisLabel(ctx, e.n, w - pad.r + 8, e.y, "left", e.col, 800);
  }
}
$("#k-fm").addEventListener("change", drawKernels);
$("#k-fam").addEventListener("change", drawKernels);

/* ================================================================== DATASET */
let SPARKS = null;
async function renderDataset() {
  if (!SPARKS) {
    try { SPARKS = await api("/api/sparks"); }
    catch (e) { $("#d-grid").innerHTML = `<p class="error">Could not load the channel previews: ${esc(e.message)}</p>`; return; }
  }
  const sc = $("#d-sc").value, list = CHANNELS.filter((c) => !sc || c.spacecraft === sc);
  $("#d-count").textContent = `${list.length} channels, ${list.reduce((s, c) => s + c.anomalies.length, 0)} labelled anomaly sequences`;
  $("#d-grid").innerHTML = list.map((c) => `<button class="chan" data-c="${c.chan}" aria-label="Replay ${c.chan}, ${c.spacecraft}, ${c.anomalies.length} labelled anomalies"><b>${c.chan}</b><span>${c.spacecraft}</span><canvas height="34"></canvas></button>`).join("");
  $$("#d-grid .chan").forEach((b) => {
    const c = CHANNELS.find((x) => x.chan === b.dataset.c), s = SPARKS[c.chan];
    const { ctx, w, h } = setup($("canvas", b));
    const lo = Math.min(...s), hi = Math.max(...s);
    ctx.fillStyle = C.label; ctx.globalAlpha = 0.3;
    for (const [a, e] of c.anomalies) ctx.fillRect((a / c.length) * w, 0, Math.max(2, ((e - a) / c.length) * w), h);
    ctx.globalAlpha = 1;
    line(ctx, s.map((_, i) => (i / (s.length - 1)) * w), s.map((v) => 2 + (1 - (v - lo) / (hi - lo || 1)) * (h - 4)), C.trace, 1);
    b.addEventListener("click", async () => {
      $("#m-chan").value = c.chan; $("#m-scn").value = "none";
      M.chan = c.chan; M.scn = "none"; show("mission"); await loadMission(c.chan, "none");
      history.replaceState(null, "", `#mission/${c.chan}/none`);
    });
  });
}
$("#d-sc").addEventListener("change", renderDataset);

/* ================================================================== METHOD */
function renderMethod() {
  const cv = $("#c-flow"), { ctx, w, h } = setup(cv);
  const steps = [
    ["Telemetry window", "64 samples, z-normalised on training data"],
    ["PCA to 6 angles", "one value per qubit"],
    ["Quantum kernel", "|⟨ψ(x′)|ψ(x)⟩|² on a PennyLane circuit"],
    ["One-class SVM", "score s(x) = ρ − Σ αᵢ k(xᵢ, x)"],
    ["Alarm", "smoothed score above threshold"],
  ];
  const gap = 18, bw = (w - 40 - gap * (steps.length - 1)) / steps.length, y = 30, bh = 76;
  steps.forEach(([a, b], i) => {
    const x = 20 + i * (bw + gap), q = i === 2;
    ctx.fillStyle = q ? C.ink : C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.fillRect(x, y, bw, bh); ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = q ? C.amber : C.ink; ctx.font = `800 13px ${FONT()}`; ctx.textAlign = "center"; ctx.fillText(a, x + bw / 2, y + 28);
    ctx.fillStyle = q ? C.paper : C["ink-2"]; ctx.font = `400 11px ${FONT()}`; wrap(ctx, b, x + bw / 2, y + 48, bw - 14, 14);
    if (i < steps.length - 1) arrow(ctx, x + bw + 3, y + bh / 2, x + bw + gap - 3, y + bh / 2, C.ink);
  });
  // feedback loop, right to left
  const loop = [["Drift check", "ADWIN, or a 1,000-step alarm"], ["Validate", "still abnormal after 300 windows?"], ["Mode cache", "seen this regime before?"], ["Re-choose encoding", "18 candidates: quality − λ·cost"]];
  const y2 = 196, lgap = 22, lw = (w - 40 - lgap * (loop.length - 1)) / loop.length;
  loop.forEach(([a, b], i) => {
    const x = w - 20 - (i + 1) * lw - i * lgap, last = i === loop.length - 1;
    ctx.fillStyle = C.paper; ctx.strokeStyle = last ? C.accent : C.ink; ctx.lineWidth = 2;
    ctx.fillRect(x, y2, lw, 72); ctx.strokeRect(x, y2, lw, 72);
    ctx.fillStyle = last ? C.accent : C.ink; ctx.font = `800 13px ${FONT()}`; ctx.textAlign = "center"; ctx.fillText(a, x + lw / 2, y2 + 28);
    ctx.fillStyle = C["ink-2"]; ctx.font = `400 11px ${FONT()}`; wrap(ctx, b, x + lw / 2, y2 + 48, lw - 14, 14);
    if (!last) arrow(ctx, x - 3, y2 + 36, x - lgap + 3, y2 + 36, C.ink);
  });
  const sx = 20 + 3 * (bw + gap) + bw / 2;
  arrow(ctx, sx, y + bh + 4, sx, y2 - 6, C.ink);
  axisLabel(ctx, "drift?", sx + 8, (y + bh + y2) / 2 + 4, "left", C.ink, 800);
  const ex = 20 + 2 * (bw + gap) + bw / 2, rx = 20 + lw / 2;
  arrow(ctx, rx, y2 - 4, ex - 10, y + bh + 6, C.accent);
  axisLabel(ctx, "swap encoding, refit", (rx + ex) / 2 - 8, (y + bh + y2) / 2 - 6, "right", C.accent, 800);

  $("#method-text").innerHTML = [
    ["Why a quantum kernel", "A kernel decides which telemetry windows count as similar. A quantum circuit gives a family of similarity measures that a classical computer evaluates only by simulating the circuit; on hardware each entry is one compute–uncompute circuit."],
    ["Why it must adapt", "Spacecraft change operating mode: sunlight and eclipse, instruments on and off, ageing sensors. A detector tuned to one mode raises false alarms in the next. Q-DRIFT notices the change with ADWIN, a test with a guaranteed false-positive bound, and re-chooses how the data is encoded."],
    ["How an encoding is chosen", "Each of the 18 circuits trains a small one-class SVM on half of the recent normal windows and must tell the other half apart from synthetic faults: spikes, level shifts, noise bursts, frozen sensors. That held-out score is combined with the kernel’s spread, which guards against kernel concentration, and penalised by circuit cost λ·Cost(c)/Cost_max. A newcomer must beat the current encoding by a clear margin."],
    ["What we changed after testing", "Our LLJ-I proposal scored encodings by kernel-target alignment. On 21 development channels the encodings it picked ranked anomalies worse than a random pick, because it rewards kernels that have collapsed. Collapsed kernels rarely alarm, so they look precise but miss anomalies. We replaced it with the held-out test and kept alignment as an ablation."],
    ["Not every alarm is a drift", "An anomaly also shifts the score. Before adapting, Q-DRIFT waits 300 windows and checks the most recent half: if the current model still finds it normal, the alarm was transient and nothing changes. An alarm unbroken for 1,000 steps, longer than 80% of labelled anomalies, is treated as a possible new mode."],
    ["Why it stays cheap", "Recognised operating modes reuse their stored model with zero new circuits. Only the small one-class SVM is refitted, on recent windows plus a reservoir of past normal behaviour, so old modes are not forgotten."],
  ].map(([a, b]) => `<article class="well"><h3>${a}</h3><p>${b}</p></article>`).join("");
}
function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(" "); let lineTxt = "", yy = y;
  for (const wd of words) { const t = lineTxt ? lineTxt + " " + wd : wd; if (ctx.measureText(t).width > maxW && lineTxt) { ctx.fillText(lineTxt, x, yy); lineTxt = wd; yy += lh; } else lineTxt = t; }
  ctx.fillText(lineTxt, x, yy);
}
function arrow(ctx, x1, y1, x2, y2, col) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8 * Math.cos(a - 0.45), y2 - 8 * Math.sin(a - 0.45)); ctx.lineTo(x2 - 8 * Math.cos(a + 0.45), y2 - 8 * Math.sin(a + 0.45)); ctx.fill();
}

const VIEWS = { results: renderResults, encodings: renderEncodings, kernels: drawKernels, dataset: renderDataset, method: renderMethod };

/* ------------------------------------------------------------------ routing and boot */
// deep links: #mission/<channel>/<scenario>[/end] or #<view>
async function route(first) {
  const [view, chan, scn, end] = location.hash.slice(1).split("/");
  if (!view || view === "mission") {
    // default showcase: T-1 with an abrupt mode change (adapts, recovers, still catches both later anomalies)
    const start = CHANNELS.find((c) => c.chan === chan) ? chan : (CHANNELS.find((c) => c.chan === "T-1") ? "T-1" : CHANNELS[0].chan);
    const s = ["none", "abrupt", "gradual", "recurring"].includes(scn) ? scn : (chan ? "none" : "abrupt");
    $("#m-chan").value = start; $("#m-scn").value = s;
    if (first || start !== M.chan || s !== M.scn) await loadMission(start, s);
    show("mission", false);
    if (end === "end") $("#m-end").click();
  } else {
    if (first && !M.rep) { $("#m-chan").value = "T-1"; $("#m-scn").value = "abrupt"; loadMission($("#m-chan").value || CHANNELS[0].chan, "abrupt"); }
    show(view, false);
  }
}
(async () => {
  try { await document.fonts.load(`800 13px ${FONT()}`); } catch { /* the fallback face is fine */ }
  try { await loadShared(); }
  catch (e) {
    $("#engine").textContent = "Cannot reach the data";
    $("#m-why").textContent = `Could not load the channel list (${e.message}). Start the server with python app/server.py.`;
    return;
  }
  checkEngine();
  await route(true);
})();
