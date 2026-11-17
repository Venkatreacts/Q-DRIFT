const fs = require("fs");
const path = require("path");
const D = require("docx");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, Tab, TabStopType, VerticalAlign, Math: MathEl, MathRun, MathFraction, MathRadical,
  MathSubScript, MathSuperScript, MathSubSuperScript, MathSum, MathSquareBrackets,
} = D;

const OUT = process.argv[2];
const HERE = __dirname;
const blocks = JSON.parse(fs.readFileSync(path.join(HERE, "abstract.json"), "utf8"));

// ---- page: A4, 20mm top/bottom/left, 18mm right
const PAGE_W = 11906, PAGE_H = 16838, M_T = 1134, M_B = 1134, M_L = 1134, M_R = 1021;
const CONTENT_W = PAGE_W - M_L - M_R; // 9751
const FONT = "Times New Roman", MONO = "Consolas", MATHFONT = "Cambria Math";
const BODY = 22, SMALL = 21, CAP = 20; // half-points

const run = (r, base = {}) => {
  if (r.br) return new TextRun({ break: 1 });
  return new TextRun({
    text: r.t, font: FONT, size: base.size || BODY, bold: r.b || base.bold, italics: r.i || base.italics,
    subScript: !!r.sub, superScript: !!r.sup, color: base.color,
  });
};
const runsOf = (runs, base) => runs.map((r) => run(r, base));
const plain = (runs) => runs.map((r) => r.t || " ").join("");

// ---- numbering: bullets + one reference per ordered list (so each restarts at 1)
const numberingConfig = [
  { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
];
let olCount = 0;
const olRefs = [];
const newOl = () => {
  const ref = "ol" + ++olCount;
  numberingConfig.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] });
  return ref;
};

// ---- borders / shading helpers
const line = (c = "555555", sz = 4) => ({ style: BorderStyle.SINGLE, size: sz, color: c });
const cellBorders = { top: line(), left: line(), bottom: line(), right: line() };
const boxBorder = { top: line("555555", 6), left: line("555555", 6), bottom: line("555555", 6), right: line("555555", 6) };
const boxProps = (on) => (on ? { border: boxBorder, shading: { type: ShadingType.CLEAR, fill: "F7F9FB", color: "auto" }, indent: { left: 140, right: 140 } } : {});

// ---- equations
const r = (t) => new MathRun(t);
const sub = (b, s) => new MathSubScript({ children: [r(b)], subScript: [r(s)] });
const sup = (b, s) => new MathSuperScript({ children: [r(b)], superScript: [r(s)] });
const EQ = {
  1: [sub("k", "c"), r("(x, x′) = "), new MathSuperScript({
    children: [r("|⟨0|"), new MathSubSuperScript({ children: [r("U")], subScript: [r("c")], superScript: [r("†")] }), r("(βx′)"), sub("U", "c"), r("(βx)|0⟩|")],
    superScript: [r("2")],
  })],
  2: [r("s(x) = ρ − "), new MathSubScript({ children: [r("Σ")], subScript: [r("i")] }), r(" "), sub("α", "i"), sub("k", "c"), r("("), sub("x", "i"), r(", x)")],
  3: [r("|"), sub("μ̂", "W₀"), r(" − "), sub("μ̂", "W₁"), r("| ≥ "), sub("ε", "cut"), r(",    "), sub("ε", "cut"), r(" = "),
    new MathRadical({ children: [new MathFraction({ numerator: [r("1")], denominator: [r("2m")] }), r(" ln "), new MathFraction({ numerator: [r("4|W|")], denominator: [r("δ")] })] }),
    r(",    m = "), new MathFraction({ numerator: [r("1")], denominator: [r("1/"), sub("n", "0"), r(" + 1/"), sub("n", "1")] })],
  4: [r("A("), sub("K", "c"), r(", y) = "), new MathFraction({
    numerator: [new MathSubScript({ children: [r("⟨"), sub("K", "c"), r(", y"), sup("y", "T"), r("⟩")], subScript: [r("F")] })],
    denominator: [new MathSubScript({ children: [r("‖"), sub("K", "c"), r("‖")], subScript: [r("F")] }), r(" "), new MathSubScript({ children: [r("‖y"), sup("y", "T"), r("‖")], subScript: [r("F")] })],
  })],
  5: [sup("c", "*"), r(" = "), new MathSubScript({ children: [r("arg max")], subScript: [r("c")] }), r(" "), new MathSquareBrackets({
    children: [r("A("), sub("K", "c"), r(", y) − λ · "), new MathFraction({ numerator: [r("Cost(c)")], denominator: [sub("Cost", "max")] })],
  })],
};
const eqPara = (n) => new Paragraph({
  tabStops: [{ type: TabStopType.CENTER, position: Math.round(CONTENT_W / 2) }, { type: TabStopType.RIGHT, position: CONTENT_W }],
  spacing: { before: 80, after: 140 }, keepLines: true,
  children: [new TextRun({ children: [new Tab()] }), new MathEl({ children: EQ[n] }), new TextRun({ children: [new Tab(), `(${n})`], font: FONT, size: BODY })],
});

// ---- figures
const FIG = {
  1: { file: "fig1.png", w: 1520, h: 460, alt: "Concept drift: a fixed model's normal band no longer fits the data after a mode change" },
  2: { file: "fig2.png", w: 1520, h: 800, alt: "Q-DRIFT system architecture with seven components" },
};
const figPara = (n) => {
  const f = FIG[n]; const W = 640;
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 40 },
    children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(HERE, f.file)), transformation: { width: W, height: Math.round(W * f.h / f.w) }, altText: { title: `Figure ${n}`, description: f.alt, name: `fig${n}` } })],
  });
};

// ---- tables
const makeTable = (b) => {
  const nCols = b.widths.length;
  const cols = b.widths.map((p) => Math.round((p / 100) * CONTENT_W));
  cols[nCols - 1] += CONTENT_W - cols.reduce((a, c) => a + c, 0);
  const meta = b.cls.includes("meta"), team = b.cls.includes("team");
  const rows = b.rows.map((row, ri) => new TableRow({
    tableHeader: row.every((c) => c.th) && ri === 0, cantSplit: true,
    children: row.map((c, ci) => {
      const head = c.th;
      const shade = head ? "E9EDF3" : meta && ci === 0 ? "F2F4F7" : undefined;
      return new TableCell({
        width: { size: cols[ci], type: WidthType.DXA }, borders: cellBorders, verticalAlign: VerticalAlign.TOP,
        shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: "auto" } : undefined,
        margins: { top: 50, bottom: 50, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: team ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 0, line: 252 },
          children: runsOf(c.runs, { size: SMALL, bold: head || (meta && ci === 0) }),
        })],
      });
    }),
  }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cols, rows });
};

// ---- build children
const children = [];
let curOl = null;
let firstH1 = true;
for (const b of blocks) {
  switch (b.type) {
    case "h":
      if (b.level === 1) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 160 }, children: [new TextRun({ text: plain(b.runs), font: FONT, size: 36, bold: true })] }));
      } else {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1, keepNext: true, alignment: b.box ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: b.box ? 60 : 280, after: 100 },
          border: b.box ? undefined : { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
          ...(b.box ? boxProps(true) : {}),
          children: [new TextRun({ text: plain(b.runs), font: FONT, size: 26, bold: true, color: "111111" })],
        }));
      }
      break;
    case "p": {
      const cls = b.cls;
      if (cls.includes("inst")) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: runsOf(b.runs, { size: 24, bold: true }) }));
      else if (cls.includes("sub")) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: runsOf(b.runs, { size: 23, italics: true }) }));
      else if (cls.includes("cap")) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 160 }, children: runsOf(b.runs, { size: CAP, italics: true }) }));
      else children.push(new Paragraph({
        alignment: b.box ? AlignmentType.JUSTIFIED : AlignmentType.JUSTIFIED, spacing: { after: b.box ? 0 : 110, line: 276 },
        keepNext: false, ...(b.box ? { ...boxProps(true), spacing: { after: 110, line: 276 } } : {}),
        children: runsOf(b.runs, { size: cls.includes("kw") ? SMALL : BODY }),
      }));
      break;
    }
    case "li": {
      if (b.ordered) { if (!curOl) curOl = newOl(); }
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED, spacing: { after: 50, line: 270 },
        numbering: { reference: b.ordered ? curOl : "bul", level: 0 }, children: runsOf(b.runs, { size: BODY }),
      }));
      break;
    }
    case "olend": curOl = null; children.push(new Paragraph({ spacing: { after: 60 }, children: [] })); break;
    case "table":
      children.push(makeTable(b));
      children.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
      break;
    case "fig": children.push(figPara(b.n)); break;
    case "eq": children.push(eqPara(b.n)); break;
    case "pre":
      b.lines.filter((l, i, a) => !(i === 0 && l.trim() === "") && !(i === a.length - 1 && l.trim() === "")).forEach((l) => children.push(new Paragraph({
        spacing: { after: 0, line: 250 }, keepLines: true, keepNext: true,
        border: boxBorder, shading: { type: ShadingType.CLEAR, fill: "F3F5F8", color: "auto" }, indent: { left: 100, right: 100 },
        children: [new TextRun({ text: l.length ? l : " ", font: MONO, size: 17 })],
      })));
      children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      break;
  }
}

const doc = new Document({
  creator: "Venkatanathan O R V, Mayukh Sarkar, Aman Salarpuria",
  title: "Q-DRIFT: Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry Anomaly Detection",
  description: "Project abstract, LLJ 1 Team Task Review",
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  numbering: { config: numberingConfig },
  sections: [{
    properties: { titlePage: true, page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: M_T, bottom: M_B, left: M_L, right: M_R } } },
    headers: {
      first: new Header({ children: [new Paragraph({ children: [] })] }),
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Q-DRIFT · LLJ 1 Team Task Review", font: FONT, size: 18, italics: true, color: "555555" })] })] }),
    },
    footers: {
      first: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "555555" })] })] }),
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "555555" })] })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, Math.round(buf.length / 1024) + " KB"); });
