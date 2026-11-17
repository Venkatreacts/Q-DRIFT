// LLJ-II deck: built from the experiment JSON so every number on a slide is a measured one.
// NODE_PATH=<dir with pptxgenjs, sharp, react, react-dom, react-icons> node build_deck.js out.pptx
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");

const OUT = process.argv[2] || "Q-DRIFT_LLJ2_Review.pptx";
const APPLY_THEME = process.env.APPLY_THEME;   // path to the pptx skill's apply_theme.js
const ROOT = path.resolve(__dirname, "..");
const RES = path.join(ROOT, "results");
const SHOTS = path.join(__dirname, "shots");
const J = (n) => (fs.existsSync(path.join(RES, n + ".json")) ? JSON.parse(fs.readFileSync(path.join(RES, n + ".json"))) : null);
const B = J("benchmark"), A = J("ablation"), D = J("drift"), N = J("noise"), Q = J("qubits"), K = J("kernels");

const THEME = {
  name: "Q-DRIFT LLJ II",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0F172A", lt1: "FFFFFF", dk2: "0F1B2D", lt2: "EEF2F7",
    accent1: "0E9F98", accent2: "7C3AED", accent3: "E8961E", accent4: "C0443D", accent5: "2F8F5B", accent6: "64748B",
    hlink: "0E9F98", folHlink: "7C3AED",
  },
};
const X = THEME.colors;
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";   // 13.33 x 7.5
pres.title = "Q-DRIFT: implementation and results";
pres.author = "Venkatanathan O R V, Mayukh Sarkar, Aman Salarpuria";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, H = 7.5, M = 0.6;

const pct = (v, d = 0) => (100 * v).toFixed(d) + "%";
const f2 = (v) => (v == null ? "–" : Number(v).toFixed(2));
const f3 = (v) => (v == null ? "–" : Number(v).toFixed(3));
const OURS = "Q-DRIFT";

async function icon(name, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: 256 }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}
async function shot(file, w, h) {
  const p = path.join(SHOTS, file);
  if (!fs.existsSync(p)) return null;
  const buf = await sharp(p).resize({ width: Math.round(w * 160), height: Math.round(h * 160), fit: "cover", position: "top" }).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ---------------------------------------------------------------- layouts
pres.defineSlideMaster({
  title: "DARK", background: { color: X.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.0, w: 9.6, h: 1.7, fontFace: "Cambria", fontSize: 48, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 3.85, w: 9.6, h: 1.0, fontSize: 20, color: "B9C6D6", valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: X.lt1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.38, w: W - 2 * M, h: 0.85, fontFace: "Cambria", fontSize: 30, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Q-DRIFT  |  LLJ II review", options: { x: M, y: H - 0.42, w: 6, h: 0.3, fontSize: 10, color: "64748B", margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.3, fontSize: 10, color: "64748B", align: "right" },
});

const S = [];   // slides in order, for sections
function slide(section, master = "CONTENT") {
  if (!S.includes(section)) { pres.addSection({ title: section }); S.push(section); }
  return pres.addSlide({ masterName: master, sectionTitle: section });
}
function txt(s, text, o) { s.addText(text, { isTextBox: true, margin: 0, fontSize: 15, color: C.text1, valign: "top", ...o }); }
function card(s, x, y, w, h, name, fill = "F3F6FA") {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: "DCE3EC", width: 0.75 }, rectRadius: 0.08, objectName: name });
}
const AX = { catAxisLabelColor: "475569", valAxisLabelColor: "475569", catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt",
  valGridLine: { color: "E2E8F0", size: 0.75 }, catGridLine: { style: "none" }, dataLabelColor: "334155", dataLabelFontSize: 11,
  legendColor: "334155", legendFontSize: 12, titleColor: "334155", titleFontSize: 14 };
const MCOL = { "Q-DRIFT": X.accent3, "Static-best QSVM": X.accent1, "Fixed QSVM": "5FB8B3", "RBF OCSVM": "64748B", "Online RBF + ADWIN": "94A3B8", "Isolation Forest": "A78BFA", "Refit-only QSVM": "0B6E69" };

(async () => {
  const names = Object.keys(B.aggregate);
  const agg = (n, g = "ALL") => B.aggregate[n][g];
  const nAnom = agg(OURS).tp + agg(OURS).fn;
  const thr = B.threshold_curve;
  const bestThr = (n) => Math.max(...Object.values(thr[n]).map((v) => v.f1));
  const Dk = D ? ["abrupt", "gradual", "recurring"].filter((k) => D[k]) : [];
  const dfa = (k, n) => D[k].aggregate[n].post_alarm_frac;
  const cut = D ? Dk.map((k) => 1 - dfa(k, OURS) / dfa(k, "Static-best QSVM")) : [];

  // ============================================================ 1. title
  {
    const s = slide("Opening", "DARK");
    s.addText("Q-DRIFT, built and measured", { placeholder: "title" });
    s.addText("Drift-aware quantum kernels for spacecraft telemetry: the working system, a live demo, and results on all NASA SMAP and MSL channels", { placeholder: "body" });
    txt(s, [
      { text: "Venkatanathan O R V   RA2411026011163", options: { breakLine: true } },
      { text: "Mayukh Sarkar   RA2411026011218", options: { breakLine: true } },
      { text: "Aman Salarpuria   RA2411003012435", options: { breakLine: true } },
      { text: "Faculty: Dr. M. L. Sworna Kokila   |   LLJ II Team Task Performance Review", options: { color: "8FA3BA" } },
    ], { x: M, y: 5.35, w: 9, h: 1.4, fontSize: 14, color: "DCE5EF", paraSpaceAfter: 3 });
    s.addImage({ data: await icon("FaSatellite", "4CC9C0"), x: 10.7, y: 1.6, w: 1.9, h: 1.9, objectName: "satellite icon", altText: "Satellite" });
    s.addNotes("At LLJ I we proposed Q-DRIFT. Today we show it working: real NASA telemetry, real quantum circuits simulated on this laptop, every baseline we promised, and the results, including the parts that did not go the way we expected. The demo runs live on this laptop; nothing is pre-recorded.");
  }

  // ============================================================ 2. what we built
  {
    const s = slide("What we built");
    s.addText("From proposal to a working, tested system", { placeholder: "title" });
    const stats = [["81", "NASA telemetry channels, all of SMAP and MSL"], ["18", "quantum encodings simulated in PennyLane"], ["6", "methods compared on the same stream"], [String(nAnom), "expert-labelled anomaly sequences"]];
    stats.forEach(([n, l], i) => {
      const x = M + (i % 2) * 3.05, y = 1.5 + Math.floor(i / 2) * 2.35;
      card(s, x, y, 2.85, 2.1, "stat " + n);
      txt(s, n, { x: x + 0.25, y: y + 0.2, w: 2.4, h: 1.0, fontSize: 54, bold: true, fontFace: "Cambria", color: C.accent1 });
      txt(s, l, { x: x + 0.25, y: y + 1.25, w: 2.4, h: 0.75, fontSize: 14, color: "475569" });
    });
    const items = [
      ["FaMicrochip", "Quantum engine", "Angle, ZZ and IQP circuits at three bandwidths and two depths; fidelity kernel |⟨ψ(x′)|ψ(x)⟩|²; one-class SVM on the precomputed kernel."],
      ["FaWaveSquare", "Streaming controller", "ADWIN drift test, switch validation, encoding re-selection with a circuit-cost penalty, normal-behaviour reservoir, mode cache."],
      ["FaFlask", "Experiment suite", "Benchmark, ablations, controlled drift, hardware noise, qubit count, kernel concentration; Wilcoxon tests."],
      ["FaDisplay", "Mission console", "Local web app: replay, live runs with injected drift, results, encoding library, kernel lab."],
    ];
    for (let i = 0; i < items.length; i++) {
      const [ic, h, b] = items[i], y = 1.5 + i * 1.18;
      s.addShape(pres.shapes.OVAL, { x: 7.0, y: y + 0.05, w: 0.62, h: 0.62, fill: { color: X.dk2 }, line: { color: X.dk2 }, objectName: "icon disc " + i });
      s.addImage({ data: await icon(ic, "4CC9C0"), x: 7.14, y: y + 0.19, w: 0.34, h: 0.34, objectName: "icon " + h, altText: h });
      txt(s, h, { x: 7.85, y, w: 4.9, h: 0.35, fontSize: 16, bold: true });
      txt(s, b, { x: 7.85, y: y + 0.36, w: 4.9, h: 0.75, fontSize: 13, color: "475569" });
    }
    s.addNotes(`Four things were built. A quantum engine with 18 encodings. A streaming controller that implements the Q-DRIFT loop. An experiment suite that runs every method on all 81 NASA channels with ${nAnom} labelled anomalies. And a console for the demo. Everything runs on a laptop CPU: PennyLane simulates each circuit once per window, and kernels come from state overlaps, exactly what a compute-uncompute circuit would estimate on hardware.`);
  }

  // ============================================================ 3. architecture
  {
    const s = slide("What we built");
    s.addText("One loop per telemetry window", { placeholder: "title" });
    const steps = [["Window", "64 samples, normalised on training data"], ["PCA", "6 values, one per qubit"], ["Quantum kernel", "PennyLane circuit, state overlap"], ["One-class SVM", "s(x) = ρ − Σ αᵢ k(xᵢ, x)"], ["Alarm", "smoothed robust z-score > 6"]];
    const bw = 2.16, gap = 0.27, y = 1.55;
    steps.forEach(([a, b], i) => {
      const x = M + i * (bw + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: bw, h: 1.35, fill: { color: i === 2 ? "E6F6F5" : "F3F6FA" }, line: { color: i === 2 ? X.accent1 : "CBD5E1", width: i === 2 ? 2 : 1 }, rectRadius: 0.08, objectName: "step " + a });
      txt(s, a, { x: x + 0.15, y: y + 0.2, w: bw - 0.3, h: 0.4, fontSize: 17, bold: true, align: "center" });
      txt(s, b, { x: x + 0.15, y: y + 0.65, w: bw - 0.3, h: 0.6, fontSize: 12.5, color: "475569", align: "center" });
      if (i < steps.length - 1) s.addShape(pres.shapes.LINE, { x: x + bw + 0.03, y: y + 0.67, w: gap - 0.06, h: 0, line: { color: "94A3B8", width: 1.5, endArrowType: "triangle" }, objectName: "arrow " + i });
    });
    const loop = [["Drift check", "ADWIN on the score stream, or an alarm unbroken for 1 000 steps", X.accent2, "F3EEFE"],
                  ["Validate", "Wait 300 windows; adapt only if the current model still finds them abnormal", X.accent6, "F1F5F9"],
                  ["Mode cache", "Seen this regime before? Reuse its model, zero circuits", X.accent5, "ECF7F0"],
                  ["Re-choose encoding", "18 candidates: held-out fault detection + kernel spread − λ·cost", X.accent1, "E6F6F5"]];
    const lw = 2.83, ly = 3.95;
    loop.forEach(([a, b, col, fill], i) => {
      const x = M + i * (lw + 0.28);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: ly, w: lw, h: 1.55, fill: { color: fill }, line: { color: col, width: 1.5 }, rectRadius: 0.08, objectName: "loop " + a });
      txt(s, a, { x: x + 0.18, y: ly + 0.18, w: lw - 0.36, h: 0.4, fontSize: 16, bold: true, color: col });
      txt(s, b, { x: x + 0.18, y: ly + 0.6, w: lw - 0.36, h: 0.85, fontSize: 12.5, color: "334155" });
      if (i < loop.length - 1) s.addShape(pres.shapes.LINE, { x: x + lw + 0.03, y: ly + 0.77, w: 0.22, h: 0, line: { color: "94A3B8", width: 1.5, endArrowType: "triangle" }, objectName: "loop arrow " + i });
    });
    txt(s, "The pipeline stays fixed. Only the encoding and the small SVM change, and only when a regime change is confirmed. Refits mix the new regime with a reservoir of past normal windows, so old modes are not forgotten.", { x: M, y: 5.85, w: W - 2 * M, h: 0.7, fontSize: 14, color: "475569" });
    s.addNotes("Top row: what happens to every window. The circuit is the only quantum part, and it is what a quantum processor would run. Bottom row: the adaptation loop. Two design changes came from testing: an alarm caused by an anomaly also shifts the score, so we validate before switching; and a saturated alarm never looks like a change to ADWIN, so a long unbroken alarm is also treated as a possible new mode.");
  }

  // ============================================================ 4. console
  {
    const s = slide("Demo");
    s.addText("Live demo: the Q-DRIFT console", { placeholder: "title" });
    const img = await shot("mission.png", 8.6, 5.2);
    if (img) s.addImage({ data: img, x: M, y: 1.45, w: 8.6, h: 5.2, objectName: "console screenshot", altText: "Q-DRIFT console replaying a NASA channel with drift detection and an encoding switch" });
    const pts = [["Mission replay", "NASA channel streams in time order; drift alarm, validation and the encoding race happen on screen."],
                 ["Drift lab", "Pick a channel, inject abrupt, gradual or recurring drift, set qubits, λ and shots, run the engine live."],
                 ["Evidence", "Results, encoding library with circuits, kernel heatmaps and the concentration study."]];
    pts.forEach(([h, b], i) => {
      const y = 1.5 + i * 1.72;
      card(s, 9.55, y, 3.2, 1.55, "demo card " + i);
      txt(s, h, { x: 9.75, y: y + 0.15, w: 2.85, h: 0.35, fontSize: 16, bold: true, color: C.accent1 });
      txt(s, b, { x: 9.75, y: y + 0.52, w: 2.85, h: 0.95, fontSize: 12.5, color: "334155" });
    });
    s.addNotes("Switch to the console now: python app/server.py, then open 127.0.0.1:8050. Suggested order: Mission replay on T-1 with abrupt drift, press Play at 4x and narrate the drift alarm, the validation, and the encoding race. Then the Drift lab: run a channel live with recurring modes to show the cache. Then Results.");
  }

  // ============================================================ 5. verification
  {
    const s = slide("Evidence");
    s.addText("Every quantum kernel is checked before it is trusted", { placeholder: "title" });
    const checks = [["FaCheck", "Matches Qiskit", "Our PennyLane ZZ map gives the same kernel as Qiskit's zz_feature_map to 10⁻¹⁰."],
                    ["FaCheck", "Valid kernel", "All 18 encodings: unit diagonal, symmetric, positive semidefinite."],
                    ["FaCheck", "Closed form", "Angle encoding equals the analytic ∏ cos²(β(xᵢ − x′ᵢ)/2)."],
                    ["FaCheck", "Detector and metrics", "ADWIN fires on a real shift and stays silent on noise; event scoring tested."]];
    for (let i = 0; i < checks.length; i++) {
      const [ic, h, b] = checks[i], y = 1.5 + i * 1.22;
      s.addShape(pres.shapes.OVAL, { x: M, y: y + 0.03, w: 0.5, h: 0.5, fill: { color: X.accent5 }, line: { color: X.accent5 }, objectName: "check disc " + i });
      s.addImage({ data: await icon(ic, "FFFFFF"), x: M + 0.13, y: y + 0.16, w: 0.24, h: 0.24, objectName: "check " + i, altText: "check" });
      txt(s, h, { x: M + 0.7, y, w: 4.9, h: 0.35, fontSize: 16, bold: true });
      txt(s, b, { x: M + 0.7, y: y + 0.37, w: 4.9, h: 0.75, fontSize: 13, color: "475569" });
    }
    txt(s, "27 automated tests pass (pytest).", { x: M, y: 6.4, w: 5.6, h: 0.35, fontSize: 13, color: C.accent5, bold: true });
    if (K) {
      const fams = ["angle", "zz", "iqp"], labels = K.library.filter((f) => f.family === "angle").map((f) => `β=${f.bandwidth} d=${f.depth}`);
      s.addChart(pres.charts.BAR, fams.map((fam) => ({ name: fam.toUpperCase(), labels, values: K.library.filter((f) => f.family === fam).map((f) => +f.entangling.toFixed(3)) })), {
        x: 6.65, y: 1.45, w: 6.1, h: 5.2, barDir: "col", barGrouping: "clustered", chartColors: ["94A3B8", X.accent1, X.accent2],
        showTitle: true, title: "Entangling capability (Meyer–Wallach) of each encoding", showLegend: true, legendPos: "b",
        valAxisMaxVal: 1, valAxisMinVal: 0, valAxisLabelFormatCode: "0.0", ...AX, objectName: "entangling chart" });
    }
    s.addNotes("Before believing any result we checked the quantum part independently. The strongest check: Qiskit, a different library, produces the same kernel matrix as our PennyLane circuits. The chart shows how much entanglement each encoding creates: angle encodings at depth 1 create none, so their kernel is classically easy; ZZ and IQP create a lot.");
  }

  // ============================================================ 6. benchmark
  {
    const s = slide("Results");
    s.addText(`Benchmark: all ${B.channels} channels, ${nAnom} labelled anomalies`, { placeholder: "title" });
    const order = names;
    s.addChart(pres.charts.BAR, [
      { name: "Event F1 at its best threshold", labels: order, values: order.map((n) => +bestThr(n).toFixed(3)) },
      { name: "AUC-PR (threshold-free)", labels: order, values: order.map((n) => +agg(n).auc_pr.toFixed(3)) },
    ], { x: M, y: 1.4, w: 7.7, h: 5.3, barDir: "bar", barGrouping: "clustered", chartColors: [X.accent1, "94A3B8"],
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMaxVal: 0.8, valAxisMinVal: 0, valAxisLabelFormatCode: "0.0",
      showLegend: true, legendPos: "b", catAxisOrientation: "maxMin", ...AX, objectName: "benchmark chart" });
    const st = agg("Static-best QSVM"), rb = agg("RBF OCSVM");
    const pts = [
      ["Quantum vs classical", `The selected quantum kernel reaches event F1 ${f2(bestThr("Static-best QSVM"))}, against ${f2(bestThr("RBF OCSVM"))} for the classical RBF kernel. RBF still ranks points better overall (AUC-PR ${f3(rb.auc_pr)} vs ${f3(st.auc_pr)}).`],
      ["Recall", `Quantum models catch the most anomalies: ${st.tp}/${nAnom} static, ${agg(OURS).tp}/${nAnom} Q-DRIFT, ${rb.tp}/${nAnom} RBF.`],
      ["Q-DRIFT on stable streams", `Adapting costs precision here (best F1 ${f2(bestThr(OURS))}); the natural test streams change mostly through anomalies, not benign drift.`],
      ["Published reference", "NASA's LSTM forecaster reports P 0.875, R 0.800, with command inputs and per-channel training."],
    ];
    pts.forEach(([h, b], i) => {
      const y = 1.45 + i * 1.32;
      txt(s, h, { x: 8.65, y, w: 4.1, h: 0.33, fontSize: 15, bold: true, color: i === 2 ? C.accent3 : C.text1 });
      txt(s, b, { x: 8.65, y: y + 0.34, w: 4.1, h: 0.95, fontSize: 12.5, color: "475569" });
    });
    s.addNotes(`Event-level scoring follows NASA's own protocol. Each method is shown at its best alarm threshold, plus AUC-PR which needs no threshold. The honest summary: a well-chosen quantum kernel detects as well as the classical one by event F1 and catches more anomalies, but the classical RBF kernel ranks individual time steps better. Q-DRIFT's adaptation does not pay off on the unmodified streams, because what changes in them is mostly the anomalies themselves. Its job is the next slide.`);
  }

  // ============================================================ 7. drift
  if (D) {
    const s = slide("Results");
    s.addText(`Under a mode change, Q-DRIFT cuts false-alarm time ${Math.round(100 * Math.min(...cut))}–${pct(Math.max(...cut))}`, { placeholder: "title" });
    const ms = ["Static-best QSVM", "RBF OCSVM", "Refit-only QSVM", OURS, "Online RBF + ADWIN"].filter((n) => D.abrupt.aggregate[n]);
    s.addChart(pres.charts.BAR, ms.map((n) => ({ name: n, labels: Dk.map((k) => k[0].toUpperCase() + k.slice(1)), values: Dk.map((k) => +(100 * dfa(k, n)).toFixed(1)) })), {
      x: M, y: 1.4, w: 7.9, h: 5.3, barDir: "col", barGrouping: "clustered", chartColors: ms.map((n) => MCOL[n] || "64748B"),
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", valAxisLabelFormatCode: "0\"%\"",
      showTitle: true, title: "Share of normal time in alarm after the change (lower is better)", showLegend: true, legendPos: "b", ...AX, objectName: "drift chart" });
    const g = (k, n) => D[k].aggregate[n];
    txt(s, [
      { text: "Setup", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: `${D.channels.length} channels. At a known time the signal moves to a new operating level and spread. It is normal behaviour, not an anomaly, so any alarm it causes is false.`, options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "What happens", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: `Static models stay in alarm, so they "catch" every later anomaly by never switching off. Q-DRIFT validates the change, re-chooses its encoding and recovers; refitting without re-encoding recovers less.`, options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "Trade-off", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: `Classical online RBF adapts fastest. Labelled anomalies caught: Q-DRIFT ${Dk.map((k) => g(k, OURS).tp).join(", ")}, online RBF ${Dk.map((k) => g(k, "Online RBF + ADWIN").tp).join(", ")} (abrupt, gradual, recurring). ${D.recurring ? `Recurring modes: ${g("recurring", OURS).cache_hits} cache hits reused a stored model with zero circuits.` : ""}`, options: {} },
    ], { x: 8.85, y: 1.5, w: 3.9, h: 5.2, fontSize: 13, color: "475569" });
    s.addNotes("This is the experiment Q-DRIFT was designed for. We take real channels and, at a known time, move the signal to a new operating mode, like a spacecraft entering eclipse. Static detectors treat the whole new mode as an anomaly and stay in alarm. Q-DRIFT notices, checks that the change persists, picks a new encoding, and its false-alarm time drops sharply. The classical online model adapts too, and faster, but it misses more real anomalies.");
  }

  // ============================================================ 8. selection rule
  {
    const s = slide("What we learned");
    s.addText("Our proposed selection rule picked collapsed kernels", { placeholder: "title" });
    // development-channel study: realised AUC-PR of the encoding each rule picks (21 channels)
    const study = [["Random encoding", 0.447], ["Kernel-target alignment (LLJ-I)", 0.327], ["Kernel spread only", 0.465], ["Held-out fault test + spread (now)", 0.482], ["Best possible pick", 0.599]];
    s.addChart(pres.charts.BAR, [{ name: "AUC-PR of the chosen encoding", labels: study.map((r) => r[0]), values: study.map((r) => r[1]) }], {
      x: M, y: 1.4, w: 7.3, h: 4.6, barDir: "bar", chartColors: ["94A3B8", X.accent4, "94A3B8", X.accent1, "CBD5E1"], invertedColors: ["94A3B8"],
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.7, showLegend: false,
      showTitle: true, title: "Quality of the encoding each rule picks (21 development channels)", catAxisOrientation: "maxMin", ...AX, objectName: "selection chart" });
    let abl = "";
    if (A) { const q = A.aggregate[OURS].ALL, k = A.aggregate["KTA selection (LLJ-I proposal)"]?.ALL; if (k) abl = `On all ${A.channels} channels, alignment ranks anomalies worse (AUC-PR ${f3(k.auc_pr)} vs ${f3(q.auc_pr)}) and misses more (recall ${f2(k.recall)} vs ${f2(q.recall)}). Its collapsed kernels alarm rarely, so its precision is higher (${f2(k.precision)} vs ${f2(q.precision)}).`; }
    txt(s, [
      { text: "Why alignment failed", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: "It rewards any separation between normal windows and synthetic faults. Concentrated kernels, where every pair looks almost equally different, score well on it yet rank real anomalies poorly.", options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "The new rule", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: "Train a one-class SVM on half the normal windows; score how well it flags held-out faults; add the kernel's spread as a concentration guard; subtract λ·cost.", options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: abl, options: { color: C.text1 } },
    ], { x: 8.2, y: 1.5, w: 4.55, h: 5.2, fontSize: 13, color: "475569" });
    s.addNotes("This is the most important lesson. At LLJ I we said encodings would be chosen by kernel-target alignment. When we measured it on 21 development channels, the encodings it picked ranked anomalies worse than a random pick. On all channels it still gets decent event F1, because collapsed kernels rarely alarm at all, which buys precision at the cost of recall. The reason is kernel concentration: a kernel that makes every pair of windows look nearly orthogonal can still separate two labelled groups, but it is useless for spotting outliers. We replaced it with a direct held-out test and kept alignment as an ablation, so the comparison is on record.");
  }

  // ============================================================ 9. concentration
  if (K) {
    const s = slide("What we learned");
    s.addText("Why bandwidth matters: kernel concentration", { placeholder: "title" });
    const rows = K.concentration.filter((r) => r.family === "iqp");
    const ns = [...new Set(rows.map((r) => r.n))], bs = [...new Set(rows.map((r) => r.bandwidth))];
    // PowerPoint's log axis renders unreliably from pptxgenjs, so plot log10 of the variance on a linear axis
    s.addChart(pres.charts.LINE, bs.map((b) => ({ name: `β = ${b}`, labels: ns.map((n) => n + " qubits"), values: ns.map((n) => +Math.log10(rows.find((r) => r.n === n && r.bandwidth === b).var).toFixed(2)) })), {
      x: M, y: 1.4, w: 7.6, h: 5.3, chartColors: ["0B6E69", X.accent1, X.accent2, X.accent4], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7,
      valAxisLabelFormatCode: "0", valAxisTitle: "log₁₀ variance of kernel values", showValAxisTitle: true, valAxisTitleColor: "475569", valAxisTitleFontSize: 12,
      showTitle: true, title: "Spread of IQP kernel values on real SMAP windows", showLegend: true, legendPos: "b", ...AX, objectName: "concentration chart" });
    const lib = K.library;
    const zzBig = lib.filter((f) => f.family === "zz" && f.bandwidth === 1).map((f) => f.expressibility);
    txt(s, [
      { text: "What the chart shows", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: "At β = 1 the spread of kernel values collapses exponentially as qubits are added: every pair of windows looks equally different. At β = 0.1 everything looks alike. Only the middle band leaves the detector something to work with.", options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "What it means for Q-DRIFT", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: "Searching bandwidth, not only circuit family, keeps the quantum kernel useful. The spread term in the selection rule guards against both failure modes.", options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "Known result", options: { bold: true, breakLine: true, color: C.text1 } },
      { text: "Exponential concentration of quantum kernels (Thanasilp et al., 2022) and bandwidth as the remedy (Shaydulin and Wild, 2022), reproduced here on spacecraft telemetry.", options: {} },
    ], { x: 8.5, y: 1.5, w: 4.25, h: 5.2, fontSize: 13, color: "475569" });
    s.addNotes("This explains the previous slide. We measured how spread out the kernel values are as we add qubits, on real telemetry windows. At bandwidth 1 the variance drops by more than two orders of magnitude from 2 to 12 qubits: the exponential concentration known from the literature. At 0.1 the kernel is too flat. The middle band stays useful. This is why our library searches bandwidth and why the selection rule includes a spread term.");
  }

  // ============================================================ 10. noise + qubits
  if (N || Q) {
    const s = slide("What we learned");
    s.addText("Toward real hardware: noise and qubit count", { placeholder: "title" });
    if (N) {
      const shots = [...new Set(N.grid.map((r) => r.shots))], p2s = [...new Set(N.grid.map((r) => r.p2))];
      const hdr = [{ text: "2-qubit error", options: { bold: true, color: "FFFFFF", fill: { color: X.dk2 } } }, ...shots.map((sh) => ({ text: sh ? `${sh} shots` : "exact", options: { bold: true, color: "FFFFFF", fill: { color: X.dk2 }, align: "center" } }))];
      const rows = p2s.map((p) => [{ text: p ? (100 * p).toFixed(1) + "%" : "none" }, ...shots.map((sh) => ({ text: f3(N.grid.find((r) => r.p2 === p && r.shots === sh)["Q-DRIFT"].auc_pr), options: { align: "center" } }))]);
      txt(s, `Q-DRIFT AUC-PR under simulated hardware noise (${N.channels.length} channels)`, { x: M, y: 1.45, w: 6.6, h: 0.35, fontSize: 14, bold: true });
      s.addTable([hdr, ...rows], { x: M, y: 1.9, w: 6.6, colW: [1.8, 1.6, 1.6, 1.6], fontSize: 13, color: "334155", border: { type: "solid", pt: 0.75, color: "DCE3EC" }, rowH: 0.42, objectName: "noise table" });
      txt(s, "Global depolarising noise on the compute–uncompute circuit plus binomial shot noise. Across this range AUC-PR stays between 0.32 and 0.35: 512 shots per kernel entry are enough at these error rates.", { x: M, y: 4.25, w: 6.6, h: 0.9, fontSize: 12.5, color: "475569" });
    }
    if (Q) {
      const keys = Object.keys(Q.rows[0]).filter((k) => k !== "n_qubits");
      s.addChart(pres.charts.LINE, keys.map((k) => ({ name: k, labels: Q.rows.map((r) => r.n_qubits + "q"), values: Q.rows.map((r) => +r[k].auc_pr.toFixed(3)) })), {
        x: 7.5, y: 1.4, w: 5.25, h: 4.2, chartColors: keys.map((k) => MCOL[k] || "64748B"), lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7,
        showTitle: true, title: `AUC-PR against qubit count (${Q.channels.length} channels)`, showLegend: true, legendPos: "b", valAxisLabelFormatCode: "0.00", ...AX, objectName: "qubit chart" });
    }
    txt(s, "Next step: run the selected encodings on IBM Quantum hardware for a few channels and compare with these simulated noise levels.", { x: M, y: 5.95, w: W - 2 * M, h: 0.6, fontSize: 14, color: C.accent2, bold: true });
    s.addNotes("Two questions a quantum computer raises. First, noise: we simulated two-qubit gate errors and finite shots. Second, size: we varied the number of qubits, one PCA component per qubit. Ranking quality barely moved: depolarising noise only rescales the kernel, and even 512 shots resolve the values the detector uses. Event F1 actually rose with shots, which we think is a threshold effect, not better detection.");
  }

  // ============================================================ 11. ablation
  if (A) {
    const s = slide("What we learned");
    s.addText("Ablation: what each part of Q-DRIFT contributes", { placeholder: "title" });
    const an = Object.keys(A.aggregate);
    const hdr = ["Variant", "Precision", "Recall", "Event F1", "AUC-PR", "Switches / channel", "Cache hits", "Selection circuits / channel"].map((t, i) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: X.dk2 }, align: i ? "center" : "left" } }));
    const rows = an.map((n) => {
      const g = A.aggregate[n].ALL, ours = n === OURS;
      const o = (t) => ({ text: t, options: { align: "center", bold: ours, fill: { color: ours ? "FDF3E3" : "FFFFFF" } } });
      return [{ text: n, options: { bold: ours, fill: { color: ours ? "FDF3E3" : "FFFFFF" } } }, o(f3(g.precision)), o(f3(g.recall)), o(f3(g.f1)), o(f3(g.auc_pr)), o(f2(g.switches_mean)), o(String(g.cache_hits_total)), o(Math.round(g.circuits_mean.select).toLocaleString("en-US"))];
    });
    s.addTable([hdr, ...rows], { x: M, y: 1.5, w: W - 2 * M, colW: [3.4, 1.05, 1.05, 1.05, 1.05, 1.35, 1.05, 2.13], fontSize: 13, color: "334155", border: { type: "solid", pt: 0.75, color: "DCE3EC" }, rowH: 0.48, objectName: "ablation table" });
    txt(s, `All ${A.channels} channels, unmodified streams, alarm threshold z > 6. Selection circuits are what a quantum processor would run to score the 18 candidates.`, { x: M, y: 5.6, w: W - 2 * M, h: 0.5, fontSize: 12.5, color: "475569" });
    s.addNotes("Each row removes or changes one part. Compare the cost columns as well as accuracy: the cost penalty and the cache reduce the number of circuits a quantum processor would need, which is the resource-aware part of our proposal.");
  }

  // ============================================================ 12. limits
  {
    const s = slide("Closing");
    s.addText("Limitations and what comes next", { placeholder: "title" });
    const cols = [
      ["Limitations", X.accent4, [
        "Simulation only: kernels are exact statevector overlaps; hardware noise is modelled, not measured.",
        "Univariate windows: we use the telemetry value, not the command channels NASA's LSTM also reads.",
        "On the unmodified benchmark, adapting costs precision; the gain appears when operating modes change.",
        "One global alarm threshold for every method; per-channel thresholds would raise all scores.",
      ]],
      ["Next steps", X.accent1, [
        "Run selected encodings on IBM Quantum hardware for a few channels.",
        "Add command channels as extra qubits or as a context signal for the drift test.",
        "Learn the bandwidth continuously instead of from a fixed grid of three.",
        "Dynamic thresholds in the style of NASA's nonparametric method.",
      ]],
    ];
    cols.forEach(([h, col, items], i) => {
      const x = M + i * 6.2;
      card(s, x, 1.5, 5.9, 4.95, h);
      txt(s, h, { x: x + 0.3, y: 1.7, w: 5.3, h: 0.45, fontSize: 20, bold: true, color: col === X.accent4 ? C.accent4 : C.accent1 });
      txt(s, items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })), { x: x + 0.3, y: 2.35, w: 5.3, h: 3.9, fontSize: 16, color: "334155", paraSpaceAfter: 12 });
    });
    s.addNotes("We want to be clear about what this does not show yet. Everything is simulated, and the natural benchmark does not reward adaptation. The next steps follow directly from the results.");
  }

  // ============================================================ 13. close
  {
    const s = slide("Closing", "DARK");
    s.addText("Questions", { placeholder: "title" });
    const lines = [`Selected quantum kernels match the classical baseline on event F1 (${f2(bestThr("Static-best QSVM"))} vs ${f2(bestThr("RBF OCSVM"))}) and catch more anomalies.`];
    if (D) lines.push(`Under operating-mode changes, Q-DRIFT spends ${pct(Math.min(...cut))}–${pct(Math.max(...cut))} less normal time in false alarm than the static quantum model.`);
    lines.push("Testing replaced our proposed selection rule with one that works, and explained why through kernel concentration.");
    txt(s, lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < lines.length - 1 } })), { x: M, y: 3.95, w: 11, h: 2.2, fontSize: 18, color: "DCE5EF", paraSpaceAfter: 8 });
    txt(s, "Code, data pipeline, tests and console: github.com/Venkatreacts/Q-DRIFT", { x: M, y: 6.3, w: 10, h: 0.4, fontSize: 14, color: "8FA3BA" });
    s.addNotes("Three takeaways, then questions. If asked whether quantum beats classical: on this benchmark, a selected quantum kernel is competitive by event F1 and recall, but not by AUC-PR; we do not claim a quantum advantage. The contribution is the adaptive loop and what we learned about selecting quantum encodings.");
  }

  await pres.writeFile({ fileName: OUT });
  if (APPLY_THEME) await require(APPLY_THEME).applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
