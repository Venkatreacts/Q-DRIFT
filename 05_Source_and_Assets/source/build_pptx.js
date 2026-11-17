const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
const { applyTheme } = require("C:/Users/Admin/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/8b07a3a3-de0b-405e-8df1-1378e6472307/795802e4-1b99-48f7-97fc-977d80188832/skills/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "deck.pptx";
const IMGDIR = "C:/Users/Public/qdrift/img/";

const THEME = {
  name: "Q-DRIFT",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0F172A", lt1: "FFFFFF", dk2: "0B1026", lt2: "EEF2F7",
    accent1: "0891B2", accent2: "7C3AED", accent3: "F59E0B", accent4: "E11D48", accent5: "10B981", accent6: "64748B",
    hlink: "0891B2", folHlink: "7C3AED",
  },
};
const HEX = THEME.colors;
const MATH = "Cambria Math";
const TEAM = ["Venkatanathan O R V", "Mayukh Sarkar", "Aman Salarpuria"];

async function icon(name, color = "#FFFFFF") {
  const Comp = fa[name];
  if (!Comp) throw new Error("missing icon " + name);
  return png(ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color, size: 256 })));
}
async function png(svg) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function photo(file, wIn, hIn, o = {}) {
  const W = Math.round(wIn * 200), H = Math.round(hIn * 200);
  let img = sharp(IMGDIR + file).resize({ width: W, height: H, fit: o.fit || "cover", position: o.position || "centre", background: o.bg || { r: 0, g: 0, b: 0, alpha: 0 } });
  if (o.png) return "image/png;base64," + (await img.png().toBuffer()).toString("base64");
  return "image/jpeg;base64," + (await img.jpeg({ quality: 86 }).toBuffer()).toString("base64");
}

// ---------- seeded noise ----------
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const noise = (a) => (rnd() - 0.5) * 2 * a;

function telemetrySVG() {
  seed = 11;
  let d = "";
  for (let x = 0; x <= 1200; x += 6) {
    let y = (x < 540 ? 170 : 95) + Math.sin(x / 40) * 8 + noise(9);
    if (x >= 954 && x <= 990) y = 22 + noise(4);
    d += (x === 0 ? "M" : " L") + x + " " + y.toFixed(1);
  }
  const tri = [600, 690, 780, 870, 1050, 1140].map((x) => `<path d="M${x} 40 L${x + 14} 64 L${x - 14} 64 z" fill="#F59E0B"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" width="2400" height="600">
<rect x="0" y="145" width="1200" height="50" fill="#0891B2" fill-opacity="0.13"/>
<line x1="0" y1="145" x2="1200" y2="145" stroke="#0891B2" stroke-width="2" stroke-dasharray="8 8"/>
<line x1="0" y1="195" x2="1200" y2="195" stroke="#0891B2" stroke-width="2" stroke-dasharray="8 8"/>
<line x1="540" y1="0" x2="540" y2="300" stroke="#F59E0B" stroke-width="4" stroke-dasharray="12 8"/>
<path d="${d}" stroke="#334155" stroke-width="3.5" fill="none" stroke-linejoin="round"/>
${tri}
<circle cx="972" cy="22" r="16" fill="none" stroke="#E11D48" stroke-width="5"/>
</svg>`;
}

function driftMiniSVG(type, color) {
  seed = type === "abrupt" ? 3 : type === "gradual" ? 5 : 9;
  let d = "";
  for (let x = 0; x <= 300; x += 4) {
    let m;
    if (type === "abrupt") m = x < 150 ? 85 : 35;
    else if (type === "gradual") m = x < 60 ? 85 : x > 240 ? 35 : 85 - ((x - 60) / 180) * 50;
    else m = Math.floor(x / 60) % 2 === 0 ? 85 : 35;
    const y = m + noise(5);
    d += (x === 0 ? "M" : " L") + x + " " + y.toFixed(1);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="900" height="360"><path d="${d}" stroke="#${color}" stroke-width="4" fill="none" stroke-linejoin="round"/></svg>`;
}

function kernelSVG() {
  seed = 21;
  let dots = "";
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = rnd() * 38; dots += `<circle cx="${150 + r * Math.cos(a)}" cy="${130 + r * Math.sin(a)}" r="9" fill="#0891B2"/>`; }
  for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28, r = 88 + noise(8); dots += `<circle cx="${150 + r * Math.cos(a)}" cy="${130 + r * Math.sin(a)}" r="9" fill="#E11D48"/>`; }
  for (let i = 0; i < 16; i++) dots += `<circle cx="${430 + i * 16 + noise(4)}" cy="${78 + noise(14)}" r="9" fill="#0891B2"/>`;
  for (let i = 0; i < 20; i++) dots += `<circle cx="${425 + i * 13 + noise(4)}" cy="${195 + noise(14)}" r="9" fill="#E11D48"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 260" width="1750" height="650">
${dots}
<path d="M318 130 L372 130" stroke="#7C3AED" stroke-width="6"/><path d="M372 116 L396 130 L372 144 z" fill="#7C3AED"/>
<line x1="410" y1="136" x2="700" y2="136" stroke="#0F172A" stroke-width="3" stroke-dasharray="10 8"/>
</svg>`;
}

function streamSVG() {
  seed = 31;
  let d = "";
  for (let x = 0; x <= 1200; x += 5) {
    let m = 200;
    if (x >= 420 && x < 800) m = 200 - Math.min(1, (x - 420) / 60) * 110;
    if (x >= 800 && x < 860) m = 90 + ((x - 800) / 60) * 110;
    const y = m + noise(x >= 420 && x < 800 ? 14 : 9);
    d += (x === 0 ? "M" : " L") + x + " " + y.toFixed(1);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 260" width="2400" height="520">
<rect x="600" y="0" width="200" height="260" fill="#7C3AED" fill-opacity="0.12"/>
<line x1="0" y1="125" x2="1200" y2="125" stroke="#E11D48" stroke-width="3" stroke-dasharray="10 8"/>
<line x1="420" y1="0" x2="420" y2="260" stroke="#F59E0B" stroke-width="4" stroke-dasharray="10 8"/>
<line x1="520" y1="0" x2="520" y2="260" stroke="#E11D48" stroke-width="4"/>
<line x1="800" y1="0" x2="800" y2="260" stroke="#10B981" stroke-width="5"/>
<path d="${d}" stroke="#334155" stroke-width="3.5" fill="none" stroke-linejoin="round"/>
</svg>`;
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "LLJ 1 Team";
  pres.title = "Q-DRIFT: Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const S = pres.shapes;

  const names = ["FaSatellite", "FaSatelliteDish", "FaRocket", "FaTemperatureHalf", "FaBolt", "FaCompass", "FaTerminal", "FaTriangleExclamation", "FaArrowsRotate", "FaLayerGroup", "FaChartLine", "FaBullseye", "FaStopwatch", "FaMicrochip", "FaAtom", "FaMagnifyingGlass", "FaLightbulb", "FaCodeBranch", "FaScaleBalanced", "FaCode", "FaDatabase", "FaBookOpen", "FaShieldHalved", "FaCameraRetro", "FaGaugeHigh", "FaListCheck", "FaCircleCheck", "FaCircleXmark", "FaClockRotateLeft", "FaSliders", "FaPuzzlePiece", "FaUserAstronaut", "FaEarthAmericas", "FaIndustry", "FaFlask", "FaWaveSquare", "FaFilter", "FaMemory", "FaBell", "FaUsers", "FaArrowRight", "FaTags", "FaCubes"];
  const I = {};
  for (const n of names) I[n] = await icon(n);
  const Iarrow = await icon("FaArrowRight", "#64748B");

  const P = {
    earth: await photo("earth.jpg", 6.2, 6.2),
    smapT: await photo("smap_model.png", 2.6, 3.1, { fit: "contain", png: true }),
    smapCard: await photo("smap_model.png", 2.9, 2.75, { fit: "contain", png: true }),
    curCard: await photo("curiosity.jpg", 2.9, 2.75),
    ibm: await photo("ibmq.jpg", 4.6, 3.4),
    jpl: await photo("jpl_sfof.jpg", 4.6, 3.8),
    curEnd: await photo("curiosity.jpg", 4.6, 4.6),
    smapMini: await photo("smap_model.png", 1.0, 1.0, { fit: "contain", png: true }),
    curMini: await photo("curiosity.jpg", 1.0, 1.0),
  };
  const G = {
    telem: await png(telemetrySVG()),
    abrupt: await png(driftMiniSVG("abrupt", HEX.accent4)),
    gradual: await png(driftMiniSVG("gradual", HEX.accent3)),
    recurring: await png(driftMiniSVG("recurring", HEX.accent2)),
    kernel: await png(kernelSVG()),
    stream: await png(streamSVG()),
  };

  // ---------- layouts ----------
  const pill = (n, color) => ({
    text: { text: "SPEAKER " + n, options: { shape: S.ROUNDED_RECTANGLE, rectRadius: 0.21, x: 11.0, y: 0.48, w: 1.75, h: 0.42, fill: { color }, color: C.background1, fontSize: 12, bold: true, align: "center", valign: "middle", charSpacing: 2, margin: 0 } },
  });
  pres.defineSlideMaster({
    title: "TITLE_SPACE",
    background: { color: "000000" },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.7, w: 6.6, h: 1.25, fontSize: 60, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.05, w: 6.4, h: 1.3, fontSize: 22, color: C.background2, valign: "top", align: "left", margin: 0 }, text: "" } },
    ],
  });
  [1, 2, 3].forEach((n) => {
    const color = [C.accent1, C.accent2, C.accent5][n - 1];
    pres.defineSlideMaster({
      title: "CONTENT_S" + n,
      background: { color: C.background1 },
      objects: [
        { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.38, w: 10.2, h: 0.75, fontSize: 32, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
        pill(n, color),
        { text: { text: "Q-DRIFT  |  LLJ 1 Team Task Review", options: { x: 0.6, y: 7.02, w: 8, h: 0.3, fontSize: 10, color: C.accent6, margin: 0, isTextBox: true } } },
      ],
      slideNumber: { x: 12.25, y: 7.02, w: 0.5, h: 0.3, fontSize: 10, color: HEX.accent6, align: "right" },
    });
  });
  pres.defineSlideMaster({
    title: "DARK_S3",
    background: { color: C.text2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.38, w: 10.2, h: 0.75, fontSize: 32, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } },
      pill(3, C.accent5),
    ],
    slideNumber: { x: 12.25, y: 7.02, w: 0.5, h: 0.3, fontSize: 10, color: "CBD5E1", align: "right" },
  });

  // ---------- helpers ----------
  const card = (s, x, y, w, h, fill = C.background2, name = "card", line) =>
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: line ? { color: line, width: 1.5 } : { color: fill, width: 0.5 }, objectName: name, shadow: { type: "outer", color: "0B1026", opacity: 0.12, blur: 8, offset: 2, angle: 90 } });
  const iconCircle = (s, img, x, y, d, fill, name = "icon") => {
    s.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0.5 }, objectName: name + " circle" });
    const p = d * 0.24;
    s.addImage({ data: img, x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, objectName: name, altText: name });
  };
  const txt = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, valign: "top", ...o });
  const chip = (s, text, x, y, w, h, fill, color, o = {}) =>
    s.addText(text, { shape: S.ROUNDED_RECTANGLE, rectRadius: Math.min(0.15, h / 2), x, y, w, h, fill: { color: fill, ...(o.transparency ? { transparency: o.transparency } : {}) }, line: { color: o.line || fill, width: o.line ? 1.25 : 0.5 }, color, fontSize: o.fontSize || 14, bold: o.bold, italic: o.italic, align: "center", valign: "middle", margin: 0, objectName: "chip", fontFace: o.fontFace });
  const arrowLine = (s, x, y, w, h, color = C.accent6, o = {}) =>
    s.addShape(S.LINE, { x, y, w, h, flipH: o.flipH, flipV: o.flipV, line: { color, width: 2.25, endArrowType: o.begin ? undefined : "triangle", beginArrowType: o.begin ? "triangle" : undefined }, objectName: "arrow" });
  const credit = (s, t, x, y, w, color = C.accent6) => txt(s, t, { x, y, w, h: 0.25, fontSize: 10, italic: true, color });
  const simple = (s, text) => {
    s.addShape(S.ROUNDED_RECTANGLE, { x: 0.6, y: 6.25, w: 12.15, h: 0.6, rectRadius: 0.12, fill: { color: C.accent1, transparency: 90 }, line: { color: C.accent1, width: 1 }, objectName: "simple words band" });
    iconCircle(s, I.FaLightbulb, 0.75, 6.32, 0.46, C.accent3, "idea");
    txt(s, [{ text: "In simple words:  ", options: { bold: true, color: C.text2 } }, { text, options: { color: C.text1 } }], { x: 1.38, y: 6.25, w: 11.2, h: 0.6, fontSize: 15, valign: "middle" });
  };
  const sec1 = "Speaker 1 - Problem and Background", sec2 = "Speaker 2 - Q-DRIFT Method", sec3 = "Speaker 3 - Evaluation and Plan";

  // =====================================================================
  pres.addSection({ title: sec1 });

  // 1 ---- Title
  {
    const s = pres.addSlide({ masterName: "TITLE_SPACE", sectionTitle: sec1 });
    s.addImage({ data: P.earth, x: 7.0, y: 0.65, w: 6.2, h: 6.2, objectName: "Earth photo", altText: "Earth seen from Apollo 17" });
    s.addImage({ data: P.smapT, x: 6.55, y: 0.35, w: 2.4, h: 2.86, objectName: "SMAP satellite", altText: "NASA SMAP satellite" });
    txt(s, "LLJ 1  ·  TEAM TASK REVIEW  ·  QML", { x: 0.8, y: 0.7, w: 6.0, h: 0.35, fontSize: 13, bold: true, color: "22D3EE", charSpacing: 3 });
    s.addText("Q-DRIFT", { placeholder: "title" });
    s.addText("Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry Anomaly Detection", { placeholder: "body", bullet: false });
    let cx = 0.8;
    ["Quantum SVM", "Concept Drift", "NASA Telemetry"].forEach((c) => {
      const w = 0.3 + c.length * 0.105;
      chip(s, c, cx, 4.55, w, 0.38, "000000", "22D3EE", { line: "22D3EE", fontSize: 12 });
      cx += w + 0.18;
    });
    TEAM.forEach((m, i) => txt(s, [
      { text: m, options: { bold: true, fontSize: 15, color: C.background1, breakLine: true } },
      { text: "Reg. No. ________", options: { fontSize: 12, color: "CBD5E1" } },
    ], { x: 0.8 + i * 2.2, y: 5.75, w: 2.0, h: 0.7 }));
    credit(s, "Images: NASA (public domain)", 10.6, 7.05, 2.5, "94A3B8");
    s.addNotes(
`SPEAKER 1 — Title (about 30 seconds)

Good morning, respected faculty. We are a team of three. I am Venkatanathan, with Mayukh and Aman.

Our project is called Q-DRIFT — Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry Anomaly Detection.

In one simple sentence: satellites and rovers constantly send sensor data back to Earth. Their "normal" behaviour keeps changing over time. We are building a quantum machine learning model that notices when "normal" has changed, and automatically adapts itself — without being retrained from scratch.

I will explain the problem and the background. Mayukh will explain our method. Aman will explain how we will test it.`);
  }

  // 2 ---- Telemetry: real missions
  {
    const s = pres.addSlide({ masterName: "CONTENT_S1", sectionTitle: sec1 });
    s.addText("Spacecraft talk to us through telemetry", { placeholder: "title" });
    // photo cards
    card(s, 0.6, 1.45, 2.95, 4.4, C.text2, "SMAP card");
    s.addImage({ data: P.smapCard, x: 0.63, y: 1.5, w: 2.9, h: 2.75, objectName: "SMAP satellite photo", altText: "NASA SMAP satellite" });
    txt(s, [{ text: "SMAP satellite", options: { bold: true, fontSize: 17, color: C.background1, breakLine: true } }, { text: "Orbits Earth, measures soil moisture", options: { fontSize: 13, color: "CBD5E1" } }], { x: 0.8, y: 4.35, w: 2.6, h: 0.8 });
    chip(s, "55 sensor channels", 0.8, 5.3, 2.55, 0.42, C.accent1, C.background1, { bold: true, fontSize: 13 });
    card(s, 3.75, 1.45, 2.95, 4.4, C.text2, "MSL card");
    s.addImage({ data: P.curCard, x: 3.78, y: 1.5, w: 2.9, h: 2.75, objectName: "Curiosity rover photo", altText: "Curiosity rover selfie on Mars" });
    txt(s, [{ text: "Curiosity rover (MSL)", options: { bold: true, fontSize: 17, color: C.background1, breakLine: true } }, { text: "Drives on Mars since 2012", options: { fontSize: 13, color: "CBD5E1" } }], { x: 3.95, y: 4.35, w: 2.6, h: 0.8 });
    chip(s, "27 sensor channels", 3.95, 5.3, 2.55, 0.42, C.accent1, C.background1, { bold: true, fontSize: 13 });
    credit(s, "Photos: NASA/JPL-Caltech (public domain)", 0.6, 5.9, 6.1);

    txt(s, "What is telemetry?", { x: 7.05, y: 1.45, w: 5.6, h: 0.45, fontSize: 19, bold: true, color: C.text2 });
    txt(s, "A constant stream of sensor readings sent to Earth:", { x: 7.05, y: 1.9, w: 5.6, h: 0.35, fontSize: 15, color: C.text1 });
    const items = [[I.FaTemperatureHalf, C.accent4, "Temperature"], [I.FaBolt, C.accent3, "Battery & power"], [I.FaCompass, C.accent2, "Position & attitude"], [I.FaTerminal, C.accent1, "Commands sent"]];
    items.forEach(([img, col, t], i) => {
      const x = 7.05 + (i % 2) * 2.85, y = 2.4 + Math.floor(i / 2) * 0.8;
      iconCircle(s, img, x, y, 0.58, col, t);
      txt(s, t, { x: x + 0.7, y, w: 2.1, h: 0.58, fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    });
    card(s, 7.05, 4.15, 5.7, 1.9, C.background2, "dataset stats");
    [["82", "channels"], ["105", "labelled anomalies"], ["~496k", "readings"]].forEach(([n, l], i) => {
      const x = 7.2 + i * 1.85;
      txt(s, n, { x, y: 4.3, w: 1.75, h: 0.75, fontSize: 34, bold: true, color: C.accent1, fontFace: "Cambria", align: "center", valign: "middle" });
      txt(s, l, { x, y: 5.05, w: 1.75, h: 0.5, fontSize: 13, color: C.text1, align: "center" });
    });
    credit(s, "NASA JPL benchmark — Hundman et al., KDD 2018", 7.2, 5.65, 5.4);
    simple(s, "spacecraft constantly send sensor data home. NASA released real, labelled data from two missions.");
    s.addNotes(
`SPEAKER 1 — Telemetry (about 1 minute)

Let me start with the real-world setting.

[Point to photos] These are two real NASA missions. On the left, the SMAP satellite, which orbits Earth and measures soil moisture. On the right, the Curiosity rover, which has been driving on Mars since 2012.

Both constantly send telemetry back to Earth — telemetry simply means a live stream of sensor readings: temperatures, battery and power levels, position, and the commands being executed.

Engineers at NASA's Jet Propulsion Laboratory released a real benchmark from these two missions in 2018 — Hundman and colleagues, published at KDD. It has 82 sensor channels — 55 from SMAP and 27 from Curiosity — and 105 anomalies that were labelled by experts from real incident reports.

An anomaly is anything unusual — a heater failing, a voltage dropping — that engineers need to catch early. That is the data we will use.`);
  }

  // 3 ---- Problem: drift
  {
    const s = pres.addSlide({ masterName: "CONTENT_S1", sectionTitle: sec1 });
    s.addText("The problem: “normal” keeps changing", { placeholder: "title" });
    card(s, 0.6, 1.45, 12.15, 2.95, C.background2, "telemetry chart card");
    s.addImage({ data: G.telem, x: 0.85, y: 1.85, w: 11.65, h: 2.33, objectName: "telemetry trace", altText: "Sensor trace that shifts level after a mode change, causing false alarms" });
    txt(s, "Old normal (what the model learned)", { x: 0.9, y: 1.52, w: 4.5, h: 0.3, fontSize: 13, bold: true, color: C.accent1 });
    txt(s, "Mode change", { x: 6.15, y: 1.52, w: 1.6, h: 0.3, fontSize: 13, bold: true, color: C.accent3 });
    txt(s, [{ text: "▲ ", options: { color: C.accent3 } }, { text: "false alarms     ", options: { color: C.text2 } }, { text: "○ ", options: { color: C.accent4 } }, { text: "real anomaly", options: { color: C.text2 } }], { x: 8.6, y: 1.52, w: 4.0, h: 0.3, fontSize: 13, bold: true, align: "right" });
    const types = [[G.abrupt, C.accent4, "Abrupt drift", "Sudden switch — e.g. a new operating mode"], [G.gradual, C.accent3, "Gradual drift", "Slow change — e.g. a sensor wearing out"], [G.recurring, C.accent2, "Recurring drift", "Modes that come back — e.g. day / night orbit"]];
    types.forEach(([img, col, h, d], i) => {
      const x = 0.6 + i * 4.15;
      card(s, x, 4.6, 3.85, 1.45, C.background1, h, "E2E8F0");
      s.addImage({ data: img, x: x + 0.2, y: 4.78, w: 1.3, h: 0.52, objectName: h + " sketch", altText: h + " sketch" });
      txt(s, [{ text: h, options: { bold: true, fontSize: 16, color: col, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.text1 } }], { x: x + 1.65, y: 4.72, w: 2.05, h: 1.25 });
    });
    simple(s, "when a spacecraft's \"normal\" changes, an old model either cries wolf or misses real problems.");
    s.addNotes(
`SPEAKER 1 — The problem: concept drift (about 1 minute 15 seconds)

Here is the core problem. [Point to the chart] This line is one sensor. On the left, the model learns what "normal" looks like — the shaded teal band.

Then, at the orange dashed line, the spacecraft changes its operating mode — maybe a new instrument is switched on. The readings move to a new level. That is completely normal for the spacecraft — but the model still thinks "normal" means the old band. So it raises false alarms again and again — the orange triangles. And worse, a real anomaly — the red circle — gets lost in the noise.

This is called concept drift: the data distribution changes over time.

[Point to the bottom cards] There are three types. Abrupt drift — a sudden switch, like a new operating mode. Gradual drift — a slow change, like a sensor wearing out. And recurring drift — modes that come back, like day and night on every orbit.

In simple words: when "normal" changes, an old model either cries wolf, or misses real problems.`);
  }

  // 4 ---- Quantum kernels
  {
    const s = pres.addSlide({ masterName: "CONTENT_S1", sectionTitle: sec1 });
    s.addText("Quantum kernels in 60 seconds", { placeholder: "title" });
    card(s, 0.6, 1.45, 4.6, 4.4, C.text2, "IBM photo card");
    s.addImage({ data: P.ibm, x: 0.6, y: 1.45, w: 4.6, h: 3.4, objectName: "IBM quantum computer photo", altText: "IBM Quantum System One" });
    txt(s, [{ text: "A real quantum computer", options: { bold: true, fontSize: 16, color: C.background1, breakLine: true } }, { text: "We use 4–8 qubits on a simulator", options: { fontSize: 13, color: "CBD5E1" } }], { x: 0.85, y: 4.98, w: 4.2, h: 0.65 });
    credit(s, "IBM Quantum System One — Photo: IBM Research, CC BY 2.0", 0.6, 5.9, 4.6);

    card(s, 5.45, 1.45, 7.3, 2.75, C.background2, "kernel card");
    s.addImage({ data: G.kernel, x: 5.65, y: 1.85, w: 6.9, h: 2.56 * 0.92, objectName: "feature map illustration", altText: "Tangled points become separable after a quantum feature map" });
    txt(s, "Tangled in normal space", { x: 5.65, y: 1.5, w: 3.0, h: 0.32, fontSize: 13, bold: true, color: C.text2, align: "center" });
    txt(s, "Separated in quantum space", { x: 9.6, y: 1.5, w: 3.0, h: 0.32, fontSize: 13, bold: true, color: C.accent2, align: "center" });
    const rows = [
      [I.FaLayerGroup, C.accent2, "Feature map", "a small circuit turns sensor readings into a quantum state"],
      [I.FaScaleBalanced, C.accent1, "Kernel = similarity", "k(x, x′) = |⟨φ(x)|φ(x′)⟩|² — how alike two readings are"],
      [I.FaBullseye, C.accent5, "Quantum SVM", "draws a boundary around “normal”; outside = anomaly"],
    ];
    rows.forEach(([img, col, h, d], i) => {
      const y = 4.35 + i * 0.6;
      iconCircle(s, img, 5.45, y, 0.5, col, h);
      txt(s, [{ text: h + ":  ", options: { bold: true, color: C.text2 } }, { text: d, options: { color: C.text1 } }], { x: 6.1, y, w: 6.65, h: 0.5, fontSize: 14, valign: "middle" });
    });
    simple(s, "a quantum kernel is a smart way to measure how similar two readings are. The encoding circuit matters a lot.");
    s.addNotes(
`SPEAKER 1 — Quantum kernels in 60 seconds (about 1 minute 15 seconds)

Our model is a Quantum Support Vector Machine, which uses something called a quantum kernel. Let me explain simply.

[Point to the dot picture] On the left, normal points in teal and abnormal points in red are tangled together — you cannot separate them with a straight line.

A quantum feature map is a small quantum circuit that takes the sensor readings and turns them into a quantum state. In that much larger "quantum space", the points can become separable — on the right, a simple line splits them.

The kernel is just a similarity score: how alike are two readings once they are in quantum space. The formula is the overlap of their two quantum states.

Then the Support Vector Machine draws a boundary around "normal". Anything outside the boundary is flagged as an anomaly.

[Point to the photo] This is IBM's quantum computer. In our project we will use 4 to 8 qubits on a simulator.

The key point for our idea: how you encode the data — the feature map — matters a lot. And today, it is chosen once and never changed.`);
  }

  // 5 ---- Gap table
  {
    const s = pres.addSlide({ masterName: "CONTENT_S1", sectionTitle: sec1 });
    s.addText("What others built — and the missing piece", { placeholder: "title" });
    const Y = "✓", N = "✗", H = "◐";
    const hdr = ["Prior work", "Quantum model", "Spacecraft telemetry", "Anomaly detection", "Adapts to drift online", "Tracks quantum cost"].map((t, i) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 }, fontSize: 13, align: i === 0 ? "left" : "center", valign: "middle" } }));
    const mk = (v) => ({ text: v, options: { align: "center", valign: "middle", fontSize: 20, bold: true, color: v === Y ? C.accent5 : v === N ? C.accent4 : C.accent3 } });
    const rowsData = [
      ["LSTM + dynamic thresholds — Hundman et al. (NASA JPL), 2018", N, Y, Y, H, N],
      ["Quantum one-class SVM — Kölle et al., 2024", Y, N, Y, N, Y],
      ["Quantum autoencoders for time series — 2024–25", Y, N, Y, N, N],
      ["Trainable / bandwidth-tuned quantum kernels — 2022", Y, N, N, N, N],
      ["Classical drift detectors (ADWIN, Page-Hinkley)", N, N, H, Y, N],
    ];
    const body = rowsData.map((r) => [{ text: r[0], options: { fontSize: 13, color: C.text1, valign: "middle" } }, ...r.slice(1).map(mk)]);
    const ours = [{ text: "Q-DRIFT (ours)", options: { bold: true, fontSize: 15, color: C.background1, fill: { color: C.accent1 }, valign: "middle" } }, ...[Y, Y, Y, Y, Y].map((v) => ({ text: v, options: { align: "center", valign: "middle", fontSize: 20, bold: true, color: C.background1, fill: { color: C.accent1 } } }))];
    s.addTable([hdr, ...body, ours], {
      x: 0.6, y: 1.45, w: 12.15, colW: [4.65, 1.5, 1.5, 1.5, 1.5, 1.5], rowH: [0.62, 0.55, 0.55, 0.55, 0.55, 0.55, 0.58],
      border: { type: "solid", pt: 0.75, color: "CBD5E1" }, fill: { color: C.background1 }, fontFace: "Calibri", margin: [0.03, 0.1, 0.03, 0.1], objectName: "gap table",
    });
    txt(s, [{ text: "✓ yes   ", options: { color: C.accent5, bold: true } }, { text: "◐ partly   ", options: { color: C.accent3, bold: true } }, { text: "✗ no", options: { color: C.accent4, bold: true } }], { x: 0.6, y: 5.55, w: 4, h: 0.3, fontSize: 12 });
    txt(s, "To our knowledge, no published work tests quantum models on NASA SMAP/MSL, or re-encodes a quantum kernel when drift is detected.", { x: 0.6, y: 5.85, w: 12.15, h: 0.35, fontSize: 14, italic: true, color: C.text2 });
    simple(s, "others built the pieces separately. Nobody has a quantum model that adapts itself to spacecraft drift.");
    s.addNotes(
`SPEAKER 1 — Literature gap (about 1 minute)

We compared existing work on five questions: Is it quantum? Is it tested on spacecraft telemetry? Does it detect anomalies? Does it adapt online when drift happens? And does it track the quantum cost?

Row 1: NASA JPL's own method, Hundman 2018, uses LSTM neural networks with dynamic thresholds on this exact data — but it is classical, and it only adjusts thresholds, not the model.
Row 2: Kölle and colleagues, 2024, built quantum one-class SVMs for anomaly detection and reduced their cost — but on standard datasets, no drift.
Row 3: Quantum autoencoders for time-series anomalies, 2024–25 — again, no drift and no spacecraft data.
Row 4: Trainable and bandwidth-tuned quantum kernels from 2022 show the encoding matters — but they tune it once, offline.
Row 5: Classical drift detectors like ADWIN and Page-Hinkley detect change — but they are not quantum.

[Point to the teal row] To our knowledge, no published work tests quantum models on the NASA SMAP and MSL data, or re-encodes a quantum kernel when drift is detected. That is our gap.

Now Mayukh will explain our method.`);
  }

  // =====================================================================
  pres.addSection({ title: sec2 });

  // 6 ---- Idea in one picture
  {
    const s = pres.addSlide({ masterName: "CONTENT_S2", sectionTitle: sec2 });
    s.addText("Our idea in one picture", { placeholder: "title" });
    const lane = (y, title, sub, col, img, segs, line) => {
      card(s, 0.6, y, 12.15, 2.05, C.background1, title, line);
      iconCircle(s, img, 0.85, y + 0.65, 0.75, col, title);
      txt(s, [{ text: title, options: { bold: true, fontSize: 19, color: col, breakLine: true } }, { text: sub, options: { fontSize: 13, color: C.accent6 } }], { x: 1.75, y: y + 0.6, w: 2.6, h: 0.9 });
      segs.forEach(([t, fill, tc, x, w], k) => chip(s, t, x, y + 0.55, w, 0.95, fill, tc, { bold: true, fontSize: 14 }));
    };
    lane(1.45, "Fixed quantum model", "encoding chosen once", C.accent6, I.FaMicrochip, [
      ["Mode A\n✓ works", C.accent5, C.background1, 4.5, 2.2],
      ["⚡ drift", C.accent3, C.text1, 6.85, 1.35],
      ["Mode B\n✗ false alarms, missed faults", C.accent4, C.background1, 8.35, 4.15],
    ], "E2E8F0");
    lane(3.75, "Q-DRIFT", "re-encodes when drift is found", C.accent2, I.FaAtom, [
      ["Mode A\n✓ encoding #1", C.accent5, C.background1, 4.5, 2.2],
      ["⚡ drift\ndetected", C.accent3, C.text1, 6.85, 1.35],
      ["test & switch\nto encoding #4", C.accent2, C.background1, 8.35, 2.0],
      ["Mode B\n✓ works again", C.accent5, C.background1, 10.5, 2.0],
    ], HEX.accent2);
    txt(s, "No retraining from scratch — we only swap how the data is encoded, picked from a small library.", { x: 0.6, y: 5.75, w: 12.15, h: 0.4, fontSize: 16, italic: true, bold: true, color: C.accent2, align: "center", valign: "middle" });
    simple(s, "when the spacecraft changes, our model changes its \"lens\" instead of starting over.");
    s.addNotes(
`SPEAKER 2 — Our idea in one picture (about 1 minute)

Thank you, Venkatanathan. Here is our whole idea in one picture.

[Top lane] A normal quantum model picks its encoding once. In mode A it works fine. Then drift happens — and in mode B it produces false alarms and misses real faults, because its encoding no longer fits the data.

[Bottom lane] Q-DRIFT works differently. In mode A it uses encoding number 1. When drift is detected, it quickly tests a few alternative encodings on the most recent data, and switches to the best one — here, encoding number 4. In mode B, it works well again.

The important part: we do not retrain everything from scratch. We only swap how the data is encoded, chosen from a small library. Think of it like changing the lens on a camera when you go from daylight to night — the camera is the same, the lens changes.`);
  }

  // 7 ---- Novelty
  {
    const s = pres.addSlide({ masterName: "CONTENT_S2", sectionTitle: sec2 });
    s.addText("Our novelty: three contributions", { placeholder: "title" });
    const cards = [
      [I.FaArrowsRotate, C.accent2, "01", "Drift-triggered re-encoding", "The quantum feature map is re-selected online whenever drift is detected — not fixed at training time.", "“Change the lens, not the camera.”"],
      [I.FaSatellite, C.accent1, "02", "Real spacecraft telemetry", "Continual evaluation on NASA SMAP & MSL streams — not only toy or network-traffic datasets.", "“Tested on real NASA missions.”"],
      [I.FaGaugeHigh, C.accent3, "03", "Resource-aware adaptation", "Counts the quantum cost of every switch (circuit evaluations) and balances it against accuracy.", "“Smart and affordable.”"],
    ];
    cards.forEach(([img, col, num, h, d, q], i) => {
      const x = 0.6 + i * 4.15;
      card(s, x, 1.45, 3.85, 4.15, C.background2, "novelty " + num);
      iconCircle(s, img, x + 0.35, 1.75, 0.95, col, h);
      txt(s, num, { x: x + 2.4, y: 1.7, w: 1.15, h: 0.8, fontSize: 40, bold: true, color: "CBD5E1", align: "right", fontFace: "Cambria" });
      txt(s, h, { x: x + 0.35, y: 2.9, w: 3.2, h: 0.75, fontSize: 20, bold: true, color: C.text2 });
      txt(s, d, { x: x + 0.35, y: 3.65, w: 3.2, h: 1.25, fontSize: 14, color: C.text1 });
      txt(s, q, { x: x + 0.35, y: 4.95, w: 3.2, h: 0.5, fontSize: 15, italic: true, bold: true, color: col });
    });
    txt(s, "We propose an adaptive learning mechanism — not just QML applied to a new dataset.", { x: 0.6, y: 5.68, w: 12.15, h: 0.45, fontSize: 17, italic: true, bold: true, color: C.accent2, align: "center", valign: "middle" });
    simple(s, "a quantum model that adapts itself, tested on real NASA data, while keeping quantum cost in check.");
    s.addNotes(
`SPEAKER 2 — Novelty (about 1 minute)

Our novelty has three parts.

One — Drift-triggered re-encoding. The quantum feature map is re-selected online whenever drift is detected. Existing work chooses it once, at training time. "Change the lens, not the camera."

Two — Real spacecraft telemetry. To our knowledge, quantum models have not been tested on the NASA SMAP and MSL telemetry streams. Most quantum anomaly papers use network-traffic or synthetic data.

Three — Resource-aware adaptation. Quantum computing time is expensive. So we count exactly how many circuit evaluations every switch costs, and balance that cost against accuracy.

So our contribution is an adaptive learning mechanism — not just quantum machine learning applied to a new dataset.`);
  }

  // 8 ---- Architecture
  {
    const s = pres.addSlide({ masterName: "CONTENT_S2", sectionTitle: sec2 });
    s.addText("The Q-DRIFT system", { placeholder: "title" });
    const bw = 2.7, gap = 0.45, by = 1.5, bh = 1.95;
    const xs = [0.6, 3.75, 6.9, 10.05];
    const top = [
      ["Telemetry stream", "SMAP / MSL sensor readings", C.background2, C.text2, I.FaSatelliteDish, C.accent1],
      ["Windows + PCA", "Recent window → 4–8 numbers (one per qubit)", C.background2, C.text2, I.FaFilter, C.accent6],
      ["Quantum kernel OC-SVM", "Current feature map → anomaly score", C.accent2, C.background1, I.FaAtom, C.text2],
      ["Alarm", "Score above threshold → alert mission team", C.accent4, C.background1, I.FaBell, C.text2],
    ];
    top.forEach(([h, d, fill, tc, img, ic], i) => {
      card(s, xs[i], by, bw, bh, fill, h);
      iconCircle(s, img, xs[i] + 0.2, by + 0.2, 0.6, ic, h);
      chip(s, String(i + 1), xs[i] + bw - 0.6, by + 0.22, 0.4, 0.4, C.background1, C.text2, { bold: true, fontSize: 13, line: "CBD5E1" });
      txt(s, [{ text: h, options: { bold: true, fontSize: 16, color: tc, breakLine: true } }, { text: d, options: { fontSize: 13, color: tc } }], { x: xs[i] + 0.2, y: by + 0.9, w: bw - 0.35, h: 1.0 });
      if (i < 3) arrowLine(s, xs[i] + bw + 0.05, by + bh / 2, gap - 0.1, 0);
    });
    // bottom row
    const ry = 4.05, rh = 1.95;
    card(s, 10.05, ry, bw, rh, C.background2, "drift detector", HEX.accent3);
    iconCircle(s, I.FaMagnifyingGlass, 10.25, ry + 0.2, 0.6, C.accent3, "detector");
    chip(s, "5", 10.05 + bw - 0.6, ry + 0.22, 0.4, 0.4, C.background1, C.text2, { bold: true, fontSize: 13, line: "CBD5E1" });
    txt(s, [{ text: "Drift detector", options: { bold: true, fontSize: 16, color: C.text2, breakLine: true } }, { text: "ADWIN watches the score stream for a shift", options: { fontSize: 13, color: C.text1 } }], { x: 10.25, y: ry + 0.9, w: 2.35, h: 1.0 });
    card(s, 6.9, ry, bw, rh, C.background2, "controller", HEX.accent2);
    iconCircle(s, I.FaSliders, 7.1, ry + 0.2, 0.6, C.accent2, "controller");
    chip(s, "6", 6.9 + bw - 0.6, ry + 0.22, 0.4, 0.4, C.background1, C.text2, { bold: true, fontSize: 13, line: "CBD5E1" });
    txt(s, [{ text: "Feature-map controller", options: { bold: true, fontSize: 16, color: C.text2, breakLine: true } }, { text: "Tests candidates, picks best, swaps it in", options: { fontSize: 13, color: C.text1 } }], { x: 7.1, y: ry + 0.9, w: 2.35, h: 1.0 });
    // arrows: alarm/score -> detector (down), detector -> controller (left), controller -> kernel (up)
    arrowLine(s, 11.4, by + bh, 0, ry - (by + bh) - 0.03, C.accent3);
    arrowLine(s, 9.65, ry + rh / 2, 0.35, 0, C.accent6, { begin: true });
    s.addShape(S.LINE, { x: 8.25, y: by + bh, w: 0, h: ry - (by + bh), line: { color: C.accent2, width: 2.25, beginArrowType: "triangle" }, objectName: "swap arrow" });
    txt(s, "swap feature map", { x: 8.35, y: 3.55, w: 1.6, h: 0.35, fontSize: 12, bold: true, color: C.accent2 });
    // library
    card(s, 0.6, ry, 5.95, rh, C.text2, "library");
    iconCircle(s, I.FaCubes, 0.85, ry + 0.2, 0.6, C.accent2, "library");
    txt(s, [{ text: "Candidate library", options: { bold: true, fontSize: 16, color: C.background1, breakLine: true } }, { text: "small, fixed set of encodings", options: { fontSize: 13, color: "CBD5E1" } }], { x: 1.6, y: ry + 0.2, w: 4.7, h: 0.7 });
    ["Angle (RY)", "ZZ map", "IQP"].forEach((t, k) => chip(s, t, 0.85 + k * 1.85, ry + 1.0, 1.7, 0.38, C.accent2, C.background1, { bold: true, fontSize: 13 }));
    txt(s, "× bandwidth {0.1, 0.5, 1}  × depth {1, 2}", { x: 0.85, y: ry + 1.45, w: 5.5, h: 0.35, fontSize: 13, color: "CBD5E1", fontFace: MATH });
    simple(s, "the model scores data, a watchdog spots drift, and a controller swaps in a better quantum encoding.");
    s.addNotes(
`SPEAKER 2 — The Q-DRIFT system (about 1 minute 30 seconds)

Here is the complete system. Top row, left to right:

1. The telemetry stream — live sensor readings from SMAP or Curiosity.
2. We take a recent time window and compress it with PCA to 4 to 8 numbers — one per qubit.
3. The quantum kernel one-class SVM uses the current feature map to produce an anomaly score.
4. If the score crosses the threshold, an alarm goes to the mission team.

Now the adaptive part — bottom row.

5. A drift detector called ADWIN — Adaptive Windowing, from Bifet and Gavaldà, 2007 — watches the stream of scores. If the average suddenly shifts, it signals drift.
6. The feature-map controller then tests the candidates from a small library on the most recent data, picks the best one, and swaps it into the quantum model — the violet upward arrow.

[Point to the library] The library is small and fixed: three encoding types — angle encoding, the ZZ feature map and IQP — each with a few bandwidth and depth settings. Bandwidth is a scaling knob that research by Shaydulin and Wild showed is critical for quantum kernels.`);
  }

  // 9 ---- How the controller picks
  {
    const s = pres.addSlide({ masterName: "CONTENT_S2", sectionTitle: sec2 });
    s.addText("How the controller picks a new encoding", { placeholder: "title" });
    card(s, 0.6, 1.45, 6.6, 4.6, C.background2, "scores card");
    txt(s, "Score of each candidate on the latest window", { x: 0.85, y: 1.6, w: 6.1, h: 0.4, fontSize: 15, bold: true, color: C.text2 });
    const cand = [["Angle  ·  bw 1", 0.62], ["ZZ  ·  bw 1", 0.71], ["IQP  ·  bw 1", 0.58], ["ZZ  ·  bw 0.5", 0.86], ["IQP  ·  bw 0.5", 0.69], ["Angle  ·  depth 2", 0.66]];
    const best = 3;
    cand.forEach(([n, v], i) => {
      const y = 2.15 + i * 0.58;
      txt(s, n, { x: 0.85, y, w: 1.9, h: 0.45, fontSize: 13, color: C.text2, bold: i === best, valign: "middle" });
      s.addShape(S.ROUNDED_RECTANGLE, { x: 2.8, y: y + 0.07, w: 3.6 * v, h: 0.32, rectRadius: 0.06, fill: { color: i === best ? C.accent2 : "CBD5E1" }, line: { color: i === best ? C.accent2 : "CBD5E1", width: 0.5 }, objectName: "bar " + n });
      txt(s, v.toFixed(2) + (i === best ? "  ← chosen" : ""), { x: 2.85 + 3.6 * v, y, w: 1.4, h: 0.45, fontSize: 13, bold: i === best, color: i === best ? C.accent2 : C.accent6, valign: "middle" });
    });
    txt(s, "Illustration — numbers are not results", { x: 0.85, y: 5.65, w: 6.1, h: 0.3, fontSize: 12, italic: true, color: C.accent6 });

    const steps = [
      [I.FaClockRotateLeft, "Take recent data", "Use the last N windows after the drift alarm."],
      [I.FaListCheck, "Score every candidate", "Kernel-target alignment: does this kernel separate normal from unusual?"],
      [I.FaScaleBalanced, "Balance quality vs cost", "Pick the best score minus a penalty for circuit evaluations."],
    ];
    steps.forEach(([img, h, d], i) => {
      const y = 1.5 + i * 1.2;
      iconCircle(s, img, 7.5, y, 0.7, C.accent2, h);
      txt(s, [{ text: (i + 1) + ". " + h, options: { bold: true, fontSize: 17, color: C.text2, breakLine: true } }, { text: d, options: { fontSize: 14, color: C.text1 } }], { x: 8.4, y: y - 0.02, w: 4.35, h: 1.1 });
    });
    s.addText("best = argmax  [ Alignment − λ · Cost ]", { shape: S.ROUNDED_RECTANGLE, rectRadius: 0.1, x: 7.5, y: 5.15, w: 5.25, h: 0.5, fill: { color: C.text2 }, line: { color: C.text2, width: 0.5 }, color: C.background1, fontFace: MATH, fontSize: 16, align: "center", valign: "middle", margin: 0, objectName: "selection rule" });
    iconCircle(s, I.FaCameraRetro, 7.5, 5.72, 0.45, C.accent3, "camera");
    txt(s, "Like choosing the right camera lens for the light.", { x: 8.05, y: 5.72, w: 4.7, h: 0.45, fontSize: 13, italic: true, color: C.text2, valign: "middle" });
    simple(s, "after drift, we quickly test a few encodings on fresh data and keep the best affordable one.");
    s.addNotes(
`SPEAKER 2 — How the controller picks (about 1 minute 15 seconds)

How does the controller decide which encoding to use? Three steps.

1. Take recent data — the last few windows after the drift alarm.
2. Score every candidate in the library. We use a measure called kernel-target alignment, from Hubregtsen and colleagues, 2022. In simple words, it checks: does this kernel put normal readings close together and unusual readings far apart? It is cheap to compute — no full retraining.
3. Balance quality against cost. Each candidate needs a different number of quantum circuit runs. So we pick the candidate with the best score minus a penalty for cost — that is the formula at the bottom. Lambda controls how much we care about cost.

[Point to the bars] In this illustration — these are not results — the ZZ feature map with bandwidth 0.5 scores highest, so it is chosen.

It is like choosing the right camera lens for the lighting conditions.`);
  }

  // 10 ---- Detect & switch timeline
  {
    const s = pres.addSlide({ masterName: "CONTENT_S2", sectionTitle: sec2 });
    s.addText("Detect, test, switch — in real time", { placeholder: "title" });
    card(s, 0.6, 1.45, 12.15, 3.15, C.background2, "stream card");
    txt(s, "Anomaly score over time", { x: 0.85, y: 1.55, w: 4, h: 0.32, fontSize: 14, bold: true, color: C.text2 });
    txt(s, "– – alarm threshold", { x: 9.5, y: 1.55, w: 3.0, h: 0.32, fontSize: 13, bold: true, color: C.accent4, align: "right" });
    s.addImage({ data: G.stream, x: 0.85, y: 1.95, w: 11.65, h: 2.52, objectName: "score stream", altText: "Anomaly score rises after drift and returns to normal after switching encodings" });
    const mark = (n, x, col) => chip(s, n, x - 0.2, 4.05, 0.4, 0.4, col, C.background1, { bold: true, fontSize: 14 });
    const px = (v) => 0.85 + v * (11.65 / 1200);
    mark("1", px(420), C.accent3); mark("2", px(520), C.accent4); mark("3", px(700), C.accent2); mark("4", px(800), C.accent5);
    const legend = [["1", C.accent3, "Drift starts", "mode changes; scores rise"], ["2", C.accent4, "Drift detected", "ADWIN raises a flag"], ["3", C.accent2, "Test candidates", "on the shaded recent window"], ["4", C.accent5, "Switch encoding", "scores return to normal"]];
    legend.forEach(([n, col, h, d], i) => {
      const x = 0.6 + i * 3.1;
      chip(s, n, x, 4.8, 0.45, 0.45, col, C.background1, { bold: true, fontSize: 15 });
      txt(s, [{ text: h, options: { bold: true, fontSize: 15, color: C.text2, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.text1 } }], { x: x + 0.6, y: 4.75, w: 2.4, h: 0.75 });
    });
    iconCircle(s, I.FaMemory, 0.6, 5.62, 0.48, C.accent2, "memory");
    txt(s, "Recurring drift? Q-DRIFT remembers which encoding worked for each mode and reuses it instantly.", { x: 1.2, y: 5.6, w: 11.5, h: 0.52, fontSize: 14, italic: true, bold: true, color: C.text2, valign: "middle" });
    simple(s, "spot the change, test a few options on fresh data, switch — and remember it for next time.");
    s.addNotes(
`SPEAKER 2 — Detect, test, switch (about 1 minute)

Here is what happens over time. This line is the anomaly score. Below the red dashed threshold means normal.

1. At the orange line, drift starts — the spacecraft changes mode, and with the old encoding the scores rise above the threshold. Without adaptation, every point here would be a false alarm.
2. Shortly after, at the red line, ADWIN detects that the average score has shifted, and raises a flag.
3. During the shaded window, the controller tests the candidate encodings on this fresh data.
4. At the green line, it switches to the best encoding — and the scores return to normal.

[Point to the bottom line] And for recurring drift — like day and night on every orbit — Q-DRIFT remembers which encoding worked for each mode, so next time it can reuse it instantly instead of searching again.

Now Aman will explain how we will test all of this.`);
  }

  // =====================================================================
  pres.addSection({ title: sec3 });

  // 11 ---- Experimental setup
  {
    const s = pres.addSlide({ masterName: "CONTENT_S3", sectionTitle: sec3 });
    s.addText("How we will test it", { placeholder: "title" });
    // datasets card with photos
    card(s, 0.6, 1.45, 5.95, 2.2, C.background2, "datasets");
    s.addImage({ data: P.smapMini, x: 0.85, y: 1.7, w: 0.95, h: 0.95, objectName: "SMAP thumbnail", altText: "SMAP satellite" });
    s.addImage({ data: P.curMini, x: 0.85, y: 2.65, w: 0.85, h: 0.85, objectName: "Curiosity thumbnail", altText: "Curiosity rover" });
    txt(s, [{ text: "Real NASA data", options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } }, { text: "SMAP: 55 channels, 69 anomaly sequences", options: { fontSize: 14, color: C.text1, breakLine: true } }, { text: "MSL (Curiosity): 27 channels, 36 sequences", options: { fontSize: 14, color: C.text1, breakLine: true } }, { text: "Processed as a stream, in time order", options: { fontSize: 14, color: C.text1 } }], { x: 2.0, y: 1.65, w: 4.4, h: 1.9 });
    // drift scenarios
    card(s, 6.8, 1.45, 5.95, 2.2, C.background2, "drift scenarios");
    iconCircle(s, I.FaWaveSquare, 7.05, 1.7, 0.7, C.accent3, "drift");
    txt(s, [{ text: "Drift scenarios", options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } }, { text: "Natural mode changes in the data", options: { fontSize: 14, color: C.text1 } }], { x: 7.95, y: 1.68, w: 4.6, h: 0.8 });
    [["Abrupt", C.accent4], ["Gradual", C.accent3], ["Recurring", C.accent2]].forEach(([t, col], k) => chip(s, t + " (injected)", 7.05 + k * 1.85, 2.85, 1.75, 0.45, col, C.background1, { bold: true, fontSize: 12 }));
    // baselines
    card(s, 0.6, 3.85, 5.95, 2.2, C.background2, "baselines");
    iconCircle(s, I.FaScaleBalanced, 0.85, 4.05, 0.6, C.accent2, "baselines");
    txt(s, "Fair baselines", { x: 1.6, y: 4.1, w: 4.6, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    s.addText(["Fixed quantum SVM", "Statically optimised quantum SVM", "Classical SVM (RBF kernel)", "Online classical model with drift detector"].map((t, k, a) => ({ text: t, options: { bullet: true, breakLine: k < a.length - 1 } })), { isTextBox: true, x: 0.85, y: 4.8, w: 5.5, h: 1.2, fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 2 });
    // tools
    card(s, 6.8, 3.85, 5.95, 2.2, C.background2, "tools");
    iconCircle(s, I.FaCode, 7.05, 4.05, 0.6, C.accent5, "tools");
    txt(s, "Tools", { x: 7.8, y: 4.1, w: 4.6, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    s.addText(["PennyLane / Qiskit — 4–8 qubit simulator", "scikit-learn — one-class SVM with precomputed kernels", "river — ADWIN drift detector", "Python on a laptop / Colab"].map((t, k, a) => ({ text: t, options: { bullet: true, breakLine: k < a.length - 1 } })), { isTextBox: true, x: 7.05, y: 4.8, w: 5.5, h: 1.2, fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 2 });
    simple(s, "real NASA data, three kinds of drift, and four fair opponents — including classical models.");
    s.addNotes(
`SPEAKER 3 — How we will test it (about 1 minute)

Thank you, Mayukh. How will we prove Q-DRIFT works?

Data: the real NASA benchmark — SMAP with 55 channels and 69 anomaly sequences, and Curiosity with 27 channels and 36 sequences. We process it as a stream, strictly in time order, so the model never sees the future.

Drift scenarios: the data already contains natural mode changes. On top of that, we inject controlled abrupt, gradual and recurring drift, so we know exactly when drift happens and can measure how fast we react.

Baselines — we compare against four opponents: a fixed quantum SVM; a quantum SVM whose encoding was optimised once, offline; a classical SVM with the standard RBF kernel; and an online classical model with its own drift detector. If a classical model wins, we will report it honestly.

Tools: PennyLane or Qiskit for 4 to 8 qubit simulations, scikit-learn for the one-class SVM, and the river library for the ADWIN drift detector.`);
  }

  // 12 ---- Metrics + chart
  {
    const s = pres.addSlide({ masterName: "CONTENT_S3", sectionTitle: sec3 });
    s.addText("How we will measure success", { placeholder: "title" });
    const metrics = [
      [I.FaBullseye, C.accent1, "Event-level F1 & PR-AUC", "Catches whole anomaly events"],
      [I.FaBell, C.accent4, "False alarms", "Fewer wasted alerts for engineers"],
      [I.FaStopwatch, C.accent3, "Detection delay & recovery", "How fast we react to drift"],
      [I.FaMicrochip, C.accent2, "Circuit evaluations / sample", "The quantum cost of adapting"],
    ];
    metrics.forEach(([img, col, h, d], i) => {
      const y = 1.5 + i * 1.15;
      iconCircle(s, img, 0.6, y, 0.72, col, h);
      txt(s, [{ text: h, options: { bold: true, fontSize: 17, color: C.text2, breakLine: true } }, { text: d, options: { fontSize: 14, color: C.text1 } }], { x: 1.5, y: y - 0.02, w: 4.4, h: 0.95 });
    });
    card(s, 6.1, 1.45, 6.65, 4.6, C.background1, "chart card", "E2E8F0");
    const labels = ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10"];
    s.addChart(pres.charts.LINE, [
      { name: "Fixed QSVM", labels, values: [0.82, 0.83, 0.81, 0.52, 0.5, 0.49, 0.48, 0.47, 0.49, 0.48] },
      { name: "Statically optimised QSVM", labels, values: [0.84, 0.85, 0.84, 0.6, 0.58, 0.57, 0.57, 0.56, 0.57, 0.56] },
      { name: "Q-DRIFT", labels, values: [0.82, 0.83, 0.81, 0.58, 0.71, 0.78, 0.8, 0.81, 0.8, 0.81] },
    ], {
      x: 6.25, y: 1.55, w: 6.35, h: 4.4,
      showTitle: true, title: "Expected F1 around a drift at w4 (hypothesis — not results)", titleFontSize: 13, titleColor: HEX.dk2, titleFontFace: "+mn-lt",
      chartColors: [HEX.accent4, HEX.accent6, HEX.accent2], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
      valAxisMinVal: 0.4, valAxisMaxVal: 0.9, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0.0",
      valAxisLabelColor: HEX.accent6, catAxisLabelColor: HEX.accent6, valAxisLabelFontSize: 11, catAxisLabelFontSize: 11,
      valAxisLabelFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E2E8F0", size: 0.75 }, catGridLine: { style: "none" },
      showCatAxisTitle: true, catAxisTitle: "Time window", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11, catAxisTitleFontFace: "+mn-lt",
      showLegend: true, legendPos: "b", legendFontSize: 11, legendColor: HEX.dk1, legendFontFace: "+mn-lt", objectName: "hypothesis chart",
    });
    simple(s, "success = catch real faults, raise fewer false alarms, recover fast after drift, at low quantum cost.");
    s.addNotes(
`SPEAKER 3 — How we will measure success (about 1 minute)

We measure four things — not just accuracy.

1. Event-level F1 and PR-AUC — did we catch whole anomaly events, not just individual points?
2. False alarms — every false alarm wastes an engineer's time.
3. Detection delay and recovery time — how quickly we notice drift, and how fast performance comes back.
4. Circuit evaluations per sample — the quantum cost of adapting.

[Point to the chart] This chart is our hypothesis, not results. Drift happens at window 4. We expect the fixed quantum model, in red, to drop and stay low. The statically optimised one, in grey, starts slightly better but also stays low. Q-DRIFT, in violet, also drops at first — but recovers within a few windows once it switches encoding. Testing this is the main experiment of our project.`);
  }

  // 13 ---- Risks & how we handle them
  {
    const s = pres.addSlide({ masterName: "CONTENT_S3", sectionTitle: sec3 });
    s.addText("Known challenges — and our plan", { placeholder: "title" });
    const rows = [
      [I.FaTags, C.accent4, "Benchmark label issues", "Researchers (Wu & Keogh) showed SMAP/MSL have flaws and some scoring tricks inflate results.", "Use strict event-level scoring (no “point-adjust”); optionally also test on ESA’s 2024 satellite benchmark."],
      [I.FaWaveSquare, C.accent3, "Quantum kernels can “flatten”", "With many qubits, all similarity values look the same (exponential concentration).", "Stay at 4–8 qubits and include bandwidth in the library."],
      [I.FaMicrochip, C.accent2, "Kernel cost grows fast", "A kernel needs every pair of samples — cost grows with n².", "Sliding windows + subsampling; count every circuit evaluation."],
      [I.FaScaleBalanced, C.accent1, "No promised quantum speed-up", "Classical models may match us on accuracy.", "We report honestly; our contribution is the adaptation mechanism."],
    ];
    txt(s, "Challenge", { x: 1.45, y: 1.45, w: 5.1, h: 0.35, fontSize: 13, bold: true, color: C.accent6, charSpacing: 1 });
    txt(s, "How we handle it", { x: 7.05, y: 1.45, w: 5.6, h: 0.35, fontSize: 13, bold: true, color: C.accent5, charSpacing: 1 });
    rows.forEach(([img, col, h, d, fix], i) => {
      const y = 1.85 + i * 1.07;
      card(s, 0.6, y, 12.15, 0.95, i % 2 ? C.background1 : C.background2, "risk " + h, i % 2 ? "E2E8F0" : undefined);
      iconCircle(s, img, 0.75, y + 0.17, 0.6, col, h);
      txt(s, [{ text: h, options: { bold: true, fontSize: 15, color: C.text2, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.text1 } }], { x: 1.45, y: y + 0.08, w: 5.3, h: 0.82, valign: "middle" });
      s.addImage({ data: Iarrow, x: 6.75, y: y + 0.36, w: 0.22, h: 0.22, objectName: "arrow" });
      txt(s, fix, { x: 7.05, y: y + 0.08, w: 5.55, h: 0.82, fontSize: 14, color: C.text2, bold: true, valign: "middle" });
    });
    simple(s, "we know the weak spots of quantum ML and of this dataset, and we designed the study around them.");
    s.addNotes(
`SPEAKER 3 — Known challenges (about 1 minute)

We want to be honest about the challenges, and show our plan for each.

1. Benchmark label issues. Wu and Keogh showed that popular anomaly benchmarks, including SMAP and MSL, have flaws, and some scoring tricks — called point-adjust — make results look better than they are. So we use strict event-level scoring, and if time allows we also test on the European Space Agency's 2024 satellite anomaly benchmark.

2. Quantum kernels can "flatten". With many qubits, all similarity values become almost the same — this is called exponential concentration. So we stay at 4 to 8 qubits, and bandwidth is part of our library, which is known to help.

3. Kernel cost grows fast — every pair of samples needs a circuit run. We use sliding windows and subsampling, and we count every evaluation.

4. No promised quantum speed-up. Classical models may match us on accuracy. We will report that honestly — our contribution is the adaptation mechanism, not a speed-up claim.`);
  }

  // 14 ---- Plan & roles
  {
    const s = pres.addSlide({ masterName: "CONTENT_S3", sectionTitle: sec3 });
    s.addText("Work plan and team roles", { placeholder: "title" });
    const phases = [["Title, literature & gap", "Weeks 1–2", true], ["Data stream + baselines", "Weeks 3–5", false], ["Library, detector, controller", "Weeks 6–8", false], ["Experiments, paper, demo", "Weeks 9–12", false]];
    const px = (i) => 0.6 + i * 3.1 + 1.3;
    s.addShape(S.LINE, { x: px(0), y: 1.85, w: px(3) - px(0), h: 0, line: { color: "CBD5E1", width: 3 }, objectName: "timeline" });
    phases.forEach(([h, wk, done], i) => {
      const x = px(i);
      s.addText(done ? "✓" : String(i + 1), { shape: S.OVAL, x: x - 0.32, y: 1.53, w: 0.64, h: 0.64, fill: { color: done ? C.accent5 : C.background1 }, line: { color: done ? C.accent5 : C.accent1, width: 2 }, color: done ? C.background1 : C.accent1, fontSize: 18, bold: true, align: "center", valign: "middle", margin: 0, objectName: "phase " + (i + 1) });
      txt(s, [{ text: h, options: { bold: true, fontSize: 15, color: C.text2, breakLine: true } }, { text: wk + (done ? "  ·  done" : ""), options: { fontSize: 13, color: done ? C.accent5 : C.accent6 } }], { x: x - 1.4, y: 2.35, w: 2.8, h: 0.95, align: "center" });
    });
    const roles = [[I.FaDatabase, C.accent1, TEAM[0], "Data & baselines", "SMAP/MSL streaming pipeline, drift injection, classical baselines"], [I.FaAtom, C.accent2, TEAM[1], "Quantum kernels", "Feature-map library and quantum one-class SVM"], [I.FaSliders, C.accent5, TEAM[2], "Adaptation & evaluation", "ADWIN detector, controller, metrics and cost tracking"]];
    roles.forEach(([img, col, h, role, d], i) => {
      const x = 0.6 + i * 4.15;
      card(s, x, 3.55, 3.85, 2.45, C.background2, "role " + h);
      iconCircle(s, img, x + 0.3, 3.8, 0.85, col, h);
      txt(s, [{ text: h, options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } }, { text: role, options: { fontSize: 14, bold: true, color: col } }], { x: x + 1.35, y: 3.85, w: 2.35, h: 0.8 });
      txt(s, d, { x: x + 0.3, y: 4.85, w: 3.3, h: 1.0, fontSize: 14, color: C.text1 });
    });
    simple(s, "phase 1 is done today. Each of us owns one clear part of the system.");
    s.addNotes(
`SPEAKER 3 — Work plan and roles (about 45 seconds)

Our plan has four phases. Phase one — the title, literature survey and research gap — is complete; that is what we presented today.

Weeks 3 to 5: build the streaming data pipeline and the baseline models.
Weeks 6 to 8: build the feature-map library, the drift detector and the controller.
Weeks 9 to 12: run all experiments, write the paper, and prepare a demo.

Roles: Venkatanathan owns the data pipeline and classical baselines. Mayukh owns the quantum kernels. I own the adaptation logic and the evaluation.`);
  }

  // 15 ---- Impact with JPL photo
  {
    const s = pres.addSlide({ masterName: "CONTENT_S3", sectionTitle: sec3 });
    s.addText("Why it matters", { placeholder: "title" });
    card(s, 0.6, 1.45, 4.6, 4.4, C.text2, "JPL photo card");
    s.addImage({ data: P.jpl, x: 0.6, y: 1.45, w: 4.6, h: 3.8, objectName: "JPL mission control photo", altText: "NASA JPL Space Flight Operations Facility" });
    txt(s, "NASA JPL mission operations — where telemetry is watched 24/7", { x: 0.8, y: 5.28, w: 4.2, h: 0.5, fontSize: 13, bold: true, color: C.background1, valign: "middle" });
    credit(s, "Photo: NASA (public domain)", 0.6, 5.9, 4.6);
    const tiles = [
      [I.FaUserAstronaut, C.accent1, "Mission teams", "Fewer false alarms, faster warnings when something really breaks."],
      [I.FaSatellite, C.accent3, "Satellite fleets", "Thousands of satellites change modes constantly — models must adapt."],
      [I.FaAtom, C.accent2, "Quantum ML research", "A first step toward quantum models that keep learning after deployment."],
      [I.FaIndustry, C.accent5, "Beyond space", "Same idea fits power grids, factories and medical monitors."],
    ];
    tiles.forEach(([img, col, h, d], i) => {
      const x = 5.45 + (i % 2) * 3.7, y = 1.45 + Math.floor(i / 2) * 2.35;
      card(s, x, y, 3.45, 2.15, C.background2, h);
      iconCircle(s, img, x + 0.25, y + 0.25, 0.7, col, h);
      txt(s, h, { x: x + 1.1, y: y + 0.3, w: 2.2, h: 0.6, fontSize: 17, bold: true, color: C.text2, valign: "middle" });
      txt(s, d, { x: x + 0.25, y: y + 1.05, w: 3.0, h: 1.0, fontSize: 14, color: C.text1 });
    });
    simple(s, "smarter monitoring for space missions — and a reusable idea for any system whose \"normal\" changes.");
    s.addNotes(
`SPEAKER 3 — Why it matters (about 45 seconds)

[Point to the photo] This is NASA JPL's mission operations room, where telemetry is watched around the clock. Engineers there deal with false alarms every day.

Q-DRIFT helps:
Mission teams — fewer false alarms and faster warnings when something really breaks.
Satellite fleets — today there are thousands of satellites, constantly changing modes. Fixed models cannot keep up.
Quantum ML research — this is a first step toward quantum models that keep learning after they are deployed.
And beyond space — the same idea applies to power grids, factories and medical monitors — anywhere "normal" changes over time.`);
  }

  // 16 ---- References
  {
    const s = pres.addSlide({ masterName: "CONTENT_S3", sectionTitle: sec3 });
    s.addText("Key references", { placeholder: "title" });
    const refs = [
      "K. Hundman et al., “Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding,” KDD 2018. arXiv:1802.04431",
      "M. Kölle et al., “Towards Efficient Quantum Anomaly Detection: One-Class SVMs using Variable Subsampling and Randomized Measurements,” ICAART 2024.",
      "T. Hubregtsen et al., “Training Quantum Embedding Kernels on Near-Term Quantum Computers,” Phys. Rev. A 106, 042431, 2022.",
      "R. Shaydulin and S. M. Wild, “Importance of Kernel Bandwidth in Quantum Machine Learning,” arXiv:2111.05451, 2022.",
      "S. Thanasilp et al., “Exponential concentration in quantum kernel methods,” Nature Communications, 2024. arXiv:2208.11060",
      "A. Bifet and R. Gavaldà, “Learning from Time-Changing Data with Adaptive Windowing,” SIAM SDM 2007.",
      "J. Gama et al., “A Survey on Concept Drift Adaptation,” ACM Computing Surveys 46(4), 2014.",
      "R. Wu and E. Keogh, “Current Time Series Anomaly Detection Benchmarks are Flawed and are Creating the Illusion of Progress,” arXiv:2009.13807, 2020–22.",
      "Quantum autoencoders for time-series anomaly detection, arXiv:2410.04154 (2024).  ·  ESA Anomaly Detection Benchmark, arXiv:2406.17826 (2024).",
    ];
    s.addText(refs.map((r, k) => ({ text: r, options: { bullet: { type: "number" }, breakLine: k < refs.length - 1 } })), { isTextBox: true, x: 0.6, y: 1.45, w: 12.15, h: 4.75, fontSize: 15, color: C.text1, paraSpaceAfter: 8, valign: "top", margin: 0 });
    txt(s, "Image credits: Earth, SMAP, Curiosity, JPL — NASA / JPL-Caltech (public domain). IBM Quantum System One — IBM Research, CC BY 2.0. All via Wikimedia Commons.", { x: 0.6, y: 6.3, w: 12.15, h: 0.5, fontSize: 11, italic: true, color: C.accent6 });
    s.addNotes(
`SPEAKER 3 — References (about 15 seconds)

These are our key references. The NASA JPL benchmark from Hundman 2018; quantum one-class SVMs from Kölle 2024; trainable and bandwidth-tuned quantum kernels from Hubregtsen and from Shaydulin and Wild; the ADWIN drift detector; and the Wu and Keogh benchmark critique that shapes our evaluation. Image credits are at the bottom.`);
  }

  // 17 ---- Conclusion
  {
    const s = pres.addSlide({ masterName: "DARK_S3", sectionTitle: sec3 });
    s.addText("A quantum model that keeps up with change", { placeholder: "title" });
    const take = [
      [I.FaMagnifyingGlass, C.accent3, "Detects", "notices when a spacecraft’s “normal” has changed"],
      [I.FaArrowsRotate, C.accent2, "Adapts", "swaps its quantum encoding — no retraining from scratch"],
      [I.FaGaugeHigh, C.accent5, "Stays affordable", "counts and limits the quantum cost of every switch"],
    ];
    take.forEach(([img, col, h, d], i) => {
      const y = 1.6 + i * 1.2;
      iconCircle(s, img, 0.6, y, 0.85, col, h);
      txt(s, [{ text: h, options: { bold: true, fontSize: 22, color: C.background1, breakLine: true } }, { text: d, options: { fontSize: 16, color: "CBD5E1" } }], { x: 1.7, y: y - 0.02, w: 6.3, h: 1.05 });
    });
    s.addImage({ data: P.curEnd, x: 8.3, y: 1.35, w: 4.45, h: 4.45, objectName: "Curiosity rover", altText: "Curiosity rover on Mars" });
    credit(s, "Curiosity rover — NASA/JPL-Caltech/MSSS", 8.3, 5.85, 4.45, "94A3B8");
    txt(s, "Thank you — questions?", { x: 0.6, y: 5.65, w: 7.5, h: 0.9, fontSize: 38, bold: true, color: "22D3EE", fontFace: "Cambria", valign: "middle" });
    s.addNotes(
`SPEAKER 3 — Conclusion (about 45 seconds)

To conclude: Q-DRIFT is a quantum model that keeps up with change.

It Detects — it notices when a spacecraft's "normal" has changed.
It Adapts — it swaps its quantum encoding, without retraining from scratch.
And it Stays affordable — it counts and limits the quantum cost of every switch.

Thank you. We are happy to take your questions.

---------------------------------------------
LIKELY QUESTIONS — suggested answers (any speaker)

Q: Why quantum at all? Won't a classical model do the same?
A: Possibly, on accuracy — and we will report that honestly. Our research question is whether a quantum kernel can adapt its encoding online under drift. That mechanism does not exist yet for quantum models, and quantum kernels are known to be very sensitive to encoding choice, which makes adaptation especially important for them.

Q: Isn't this just retraining the model?
A: No. Full retraining refits everything. We keep the pipeline and only switch the feature map from a small, pre-defined library, choosing it with a cheap score (kernel-target alignment). We also measure exactly how much cheaper that is.

Q: How do you know drift has happened in real data?
A: We use ADWIN, a well-established detector with statistical guarantees on false alarms. For controlled tests, we also inject drift at known times so we can measure detection delay precisely.

Q: The SMAP/MSL benchmark has been criticised. Why use it?
A: It is the most widely used real spacecraft benchmark. We follow Wu and Keogh's advice: strict event-level scoring, no point-adjust, and optionally the newer ESA 2024 benchmark as a second dataset.

Q: Will you use real quantum hardware?
A: Main experiments are on simulators with 4–8 qubits. If time allows, we will run the final chosen kernels on IBM's free cloud quantum computers.

Q: What about labels — anomaly detection usually has few?
A: We train on normal data only (one-class SVM). Labels are used only for evaluation, and the selection score uses recent windows that the model believes are normal.`);
  }

  await pres.writeFile({ fileName: OUT });
  if (!process.env.SKIP_THEME) await applyTheme(OUT, THEME);
  console.log("wrote " + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
