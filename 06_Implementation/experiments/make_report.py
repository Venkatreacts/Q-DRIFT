"""Build the LLJ-II project report (HTML, printed to PDF with Edge) from the experiment JSON.

    python experiments/make_report.py      -> report/Q-DRIFT_LLJ2_Report.html (+ figures)
"""
from __future__ import annotations

import html
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "results"
OUT = ROOT / "report"
OUT.mkdir(exist_ok=True)


def J(n):
    p = RES / f"{n}.json"
    return json.loads(p.read_text()) if p.exists() else None


B, A, D, N, Q, K = (J(n) for n in ("benchmark", "ablation", "drift", "noise", "qubits", "kernels"))
OURS = "Q-DRIFT"
e = html.escape
f2 = lambda v: "–" if v is None else f"{v:.2f}"
f3 = lambda v: "–" if v is None else f"{v:.3f}"
COL = {"Q-DRIFT": "#E8961E", "Static-best QSVM": "#0E9F98", "Fixed QSVM": "#5FB8B3", "RBF OCSVM": "#64748B",
       "Online RBF + ADWIN": "#94A3B8", "Isolation Forest": "#A78BFA", "Refit-only QSVM": "#0B6E69"}
plt.rcParams.update({"font.family": "Times New Roman", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})


FIGDIR = OUT / "figs"
FIGDIR.mkdir(exist_ok=True)
_nfig = [0]


def fig(f) -> str:
    """Save as a separate PNG (Word cannot import data-URI images) and return its relative path."""
    _nfig[0] += 1
    name = f"fig{_nfig[0]}.png"
    f.savefig(FIGDIR / name, format="png", dpi=200, bbox_inches="tight")
    plt.close(f)
    return f"figs/{name}"


def table(head, rows, cls=""):
    th = "".join(f"<th>{h}</th>" for h in head)
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'


names = list(B["aggregate"])
agg = lambda n, g="ALL": B["aggregate"][n][g]
best_thr = lambda n, src=B: max(v["f1"] for v in src["threshold_curve"][n].values())
n_anom = agg(OURS)["tp"] + agg(OURS)["fn"]
kinds = [k for k in ("abrupt", "gradual", "recurring") if D and k in D]

# ------------------------------------------------------------------ figures
figs = {}
f, ax = plt.subplots(figsize=(6.6, 2.9))
y = np.arange(len(names))
ax.barh(y - 0.2, [best_thr(n) for n in names], 0.4, color="#0E9F98", label="Event F1 at best threshold")
ax.barh(y + 0.2, [agg(n)["auc_pr"] for n in names], 0.4, color="#94A3B8", label="AUC-PR")
for i, n in enumerate(names):
    ax.text(best_thr(n) + 0.01, i - 0.2, f"{best_thr(n):.2f}", va="center", fontsize=8)
    ax.text(agg(n)["auc_pr"] + 0.01, i + 0.2, f"{agg(n)['auc_pr']:.2f}", va="center", fontsize=8)
ax.set_yticks(y, names); ax.invert_yaxis(); ax.set_xlim(0, 0.75); ax.legend(loc="lower right", fontsize=8, frameon=False)
figs["bench"] = fig(f)

f, ax = plt.subplots(figsize=(6.6, 2.6))
for n, c in B["threshold_curve"].items():
    t = [float(k) for k in c]
    ax.plot(t, [v["f1"] for v in c.values()], marker="o", ms=3, lw=2.2 if n == OURS else 1.2, color=COL.get(n, "#333"), label=n)
ax.axvline(B.get("z_thr", 6), color="#999", ls=":", lw=1)
ax.set_xlabel("alarm threshold (robust z-score)"); ax.set_ylabel("event F1"); ax.legend(fontsize=7.5, ncol=2, frameon=False)
figs["thr"] = fig(f)

if D:
    ms = [m for m in ["Static-best QSVM", "RBF OCSVM", "Refit-only QSVM", OURS, "Online RBF + ADWIN"] if m in D["abrupt"]["aggregate"]]
    f, ax = plt.subplots(figsize=(6.6, 2.7))
    w = 0.8 / len(ms)
    for i, m in enumerate(ms):
        v = [100 * D[k]["aggregate"][m]["post_alarm_frac"] for k in kinds]
        ax.bar(np.arange(len(kinds)) + (i - len(ms) / 2 + 0.5) * w, v, w, color=COL.get(m, "#333"), label=m)
    ax.set_xticks(range(len(kinds)), [k.capitalize() for k in kinds]); ax.set_ylabel("normal time in alarm after change (%)")
    ax.legend(fontsize=7.5, ncol=3, frameon=False, loc="upper center", bbox_to_anchor=(0.5, 1.22))
    figs["drift"] = fig(f)
    # example timeline from a saved replay
    ex = ROOT / "results" / "replay" / "drift" / "T-1_abrupt.json"
    if ex.exists():
        R = json.loads(ex.read_text())
        T = len(R["test"]); t = np.arange(T)
        f, (a1, a2) = plt.subplots(2, 1, figsize=(6.6, 3.4), sharex=True, gridspec_kw={"height_ratios": [1, 1.2]})
        for s0, e0 in R["anomalies"]:
            for a in (a1, a2):
                a.axvspan(s0, e0, color="#C0443D", alpha=0.18, lw=0)
        a1.plot(t, R["test"], lw=0.6, color="#334155"); a1.axvline(R["t0"], color="#7C3AED", lw=1.2); a1.set_ylabel("telemetry")
        a1.text(R["t0"] + 60, max(R["test"]) * 0.95, "mode change", color="#7C3AED", fontsize=8, va="top")
        for m in ("Static-best QSVM", OURS):
            a2.plot(t, np.clip(R["methods"][m]["score"], -5, 40), lw=0.8 if m != OURS else 1.1, color=COL[m], label=m)
        a2.axhline(R["z_thr"], color="#999", ls=":", lw=1)
        for sw in R["methods"][OURS]["switch"]:
            a2.axvline(sw, color="#0E9F98", lw=1, ls="--")
        a2.set_ylabel("anomaly score (z)"); a2.set_xlabel("time step"); a2.legend(fontsize=7.5, frameon=False, loc="upper left")
        figs["timeline"] = fig(f)

if K:
    rows = [r for r in K["concentration"] if r["family"] == "iqp"]
    f, ax = plt.subplots(figsize=(4.6, 2.7))
    for i, b in enumerate(sorted({r["bandwidth"] for r in rows})):
        pts = sorted((r["n"], r["var"]) for r in rows if r["bandwidth"] == b)
        ax.semilogy(*zip(*pts), marker="o", ms=3, lw=1.6, color=plt.cm.viridis(i / 3.5), label=f"β = {b}")
    ax.set_xlabel("qubits"); ax.set_ylabel("variance of kernel values"); ax.legend(fontsize=8, frameon=False)
    figs["conc"] = fig(f)

# ------------------------------------------------------------------ tables
def bench_rows(g):
    rows = []
    for n in names:
        a = agg(n, g)
        nm = f"<b>{e(n)}</b>" if n == OURS else e(n)
        rows.append([nm, f"{a['tp']}/{a['tp'] + a['fn']}", a["fp"], f3(a["precision"]), f3(a["recall"]), f3(a["f1"]),
                     f3(a["auc_pr"]), f2(a["false_alarms_per_1k"])])
    return rows


wil_rows = [[e(n), f"{w['auc_pr']['mean_diff']:+.3f}", f"{w['auc_pr']['wins']}–{w['auc_pr']['losses']}", f"{w['auc_pr']['p']:.4f}",
             f"{w['event_f1']['mean_diff']:+.3f}", f"{w['event_f1']['wins']}–{w['event_f1']['losses']}", f"{w['event_f1']['p']:.4f}"]
            for n, w in B["wilcoxon"].items()]

lib_rows = []
if K:
    for fdef in K["library"]:
        lib_rows.append([e(fdef["name"]), fdef["gates_1q"], fdef["gates_2q"], f"{fdef['cost']:.0f}", f3(fdef["expressibility"]), f3(abs(fdef["entangling"]))])

abl_rows = []
if A:
    for n, a in A["aggregate"].items():
        g = a["ALL"]
        abl_rows.append([f"<b>{e(n)}</b>" if n == OURS else e(n), f3(g["precision"]), f3(g["recall"]), f3(g["f1"]),
                         f2(best_thr(n, A)), f3(g["auc_pr"]), f2(g["switches_mean"]), g["cache_hits_total"], f"{g['circuits_mean']['select']:,.0f}"])

drift_rows = []
if D:
    for m in D["abrupt"]["aggregate"]:
        r = [f"<b>{e(m)}</b>" if m == OURS else e(m)]
        for k in kinds:
            g = D[k]["aggregate"][m]
            r += [f"{g['tp']}/{g['tp'] + g['fn']}", f"{100 * g['post_alarm_frac']:.1f}%"]
        r.append(D["recurring"]["aggregate"][m]["cache_hits"] if "recurring" in D else "–")
        drift_rows.append(r)

noise_tbl = qub_tbl = ""
if N:
    shots = sorted({r["shots"] for r in N["grid"]}, key=lambda s: (s == 0, -s))[::-1]
    shots = [0] + sorted([s for s in shots if s], reverse=True)
    p2s = sorted({r["p2"] for r in N["grid"]})
    noise_tbl = table(["Two-qubit error"] + [f"{s:,} shots" if s else "exact" for s in shots],
                      [[f"{100 * p:.1f}%" if p else "none"] + [f3(next(r for r in N["grid"] if r["p2"] == p and r["shots"] == s)[OURS]["auc_pr"]) for s in shots] for p in p2s])
if Q:
    keys = [k for k in Q["rows"][0] if k != "n_qubits"]
    qub_tbl = table(["Qubits"] + [f"{e(k)} AUC-PR" for k in keys] + [f"{e(k)} F1" for k in keys],
                    [[r["n_qubits"]] + [f3(r[k]["auc_pr"]) for k in keys] + [f3(r[k]["f1"]) for k in keys] for r in Q["rows"]])

# ------------------------------------------------------------------ numbers used in the text
st, rb, qd = agg("Static-best QSVM"), agg("RBF OCSVM"), agg(OURS)
cut = [1 - D[k]["aggregate"][OURS]["post_alarm_frac"] / D[k]["aggregate"]["Static-best QSVM"]["post_alarm_frac"] for k in kinds] if D else [0, 0, 0]
kta = A["aggregate"].get("KTA selection (LLJ-I proposal)", {}).get("ALL") if A else None
qa = A["aggregate"][OURS]["ALL"] if A else None

css = (ROOT.parent / "01_Abstract" / "Q-DRIFT_Abstract.html").read_text(encoding="utf8")
css = css[css.find("<style>") + 7: css.find("</style>")].replace("LLJ 1 Team Task Review", "LLJ II Implementation Report")
css += "\nfigure img { width: 100%; } figure.half img { width: 70%; } td.num, th.num { text-align: right; } .small td, .small th { font-size: 9.5pt; padding: 2.5pt 4pt; }"


def img(key, cap, cls=""):
    return f'<figure class="{cls}"><img src="{figs[key]}" alt="{e(cap)}"></figure><p class="cap">{cap}</p>' if key in figs else ""


body = f"""
<p class="inst">SRM Institute of Science and Technology</p>
<h1>Q-DRIFT: Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry Anomaly Detection</h1>
<p class="sub">LLJ II Team Task Performance Review: implementation, demonstration and results</p>
{table(["Name", "Register number"], [["Venkatanathan O R V", "RA2411026011163"], ["Mayukh Sarkar", "RA2411026011218"], ["Aman Salarpuria", "RA2411003012435"]], "team")}
<table class="meta"><tbody><tr><td>Course</td><td>Quantum Machine Learning</td></tr><tr><td>Faculty</td><td>Dr. M. L. Sworna Kokila</td></tr>
<tr><td>Code and data pipeline</td><td>github.com/Venkatreacts/Q-DRIFT, folder 06_Implementation</td></tr></tbody></table>

<div class="abstract"><h2>Summary</h2>
<p>We implemented the Q-DRIFT system proposed at LLJ I and evaluated it on all {B['channels']} channels of the NASA SMAP/MSL benchmark ({n_anom} labelled anomaly sequences), streamed strictly in time order. Eighteen quantum encodings (angle, ZZ and IQP circuits at three bandwidths and two depths) are simulated in PennyLane; their fidelity kernels drive a one-class SVM. An ADWIN drift test, a switch-validation step, an encoding-selection rule with a circuit-cost penalty, a reservoir of past normal behaviour and a mode cache make the detector adaptive. The quantum kernels are verified against Qiskit to 10<sup>−10</sup>.</p>
<p>A well-selected quantum kernel reaches event-level F1 {f2(best_thr('Static-best QSVM'))} at its best threshold against {f2(best_thr('RBF OCSVM'))} for a classical RBF kernel and catches more anomalies ({st['tp']} vs {rb['tp']} of {n_anom}), but the RBF kernel ranks time steps better (AUC-PR {f3(rb['auc_pr'])} vs {f3(st['auc_pr'])}). On the unmodified streams adaptation costs precision. Under injected operating-mode changes, Q-DRIFT spends {100*min(cut):.0f}–{100*max(cut):.0f}% less normal time in false alarm than the same quantum model without adaptation. Testing also showed that the selection rule we proposed, kernel-target alignment, prefers concentrated kernels; we replaced it with a held-out fault-detection test and explain the failure through kernel concentration.</p>
<p class="kw"><b>Keywords:</b> quantum kernels, one-class SVM, concept drift, ADWIN, kernel concentration, spacecraft telemetry, NASA SMAP/MSL.</p></div>

<h2>1. What was built</h2>
{table(["Component", "Files", "What it does"], [
    ["Data pipeline", "qdrift/data.py", "Loads the 81 labelled channels (P-2's duplicate label rows merged), z-normalises each on its training segment, cuts 64-step windows, compresses each to 6 values by PCA and scales them to angles."],
    ["Encoding library", "qdrift/featuremaps.py", "18 PennyLane circuits; statevectors computed once per window with parameter broadcasting; fidelity kernel |⟨ψ(x′)|ψ(x)⟩|²."],
    ["Kernel analysis", "qdrift/kernels.py", "Kernel-target alignment, expressibility, Meyer–Wallach entanglement, concentration, depolarising and shot-noise models."],
    ["Detectors", "qdrift/models.py", "Quantum one-class SVM on a precomputed kernel; RBF one-class SVM and Isolation Forest baselines."],
    ["Drift test", "qdrift/adwin.py", "ADWIN implemented from equation (3) of the abstract."],
    ["Controller", "qdrift/stream.py", "The Q-DRIFT loop and every baseline, as configurations of one streaming runner."],
    ["Evaluation", "qdrift/metrics.py, experiments/run_all.py", "Event-level and point-wise metrics, Wilcoxon tests, all experiments, JSON output."],
    ["Console", "app/server.py, app/static/", "Local web app: mission replay, live runs with injected drift, results, encoding library, kernel lab."],
    ["Tests", "tests/test_core.py", "27 tests, including the Qiskit cross-check."],
])}
<p class="cap">Table 1. Implementation, in the 06_Implementation folder of the repository.</p>

<h2>2. Method as implemented</h2>
<h3>2.1 Encoding and kernel</h3>
<p>Each window x is scaled by bandwidth β and encoded by U<sub>c</sub>(βx). Angle maps apply R<sub>Y</sub> rotations (depth 2 adds a CNOT ring between layers); ZZ maps follow Havlíček et al. with φ<sub>ij</sub> = (π − x<sub>i</sub>)(π − x<sub>j</sub>) on neighbouring qubits; IQP maps use φ<sub>ij</sub> = x<sub>i</sub>x<sub>j</sub> on all pairs. The kernel k<sub>c</sub>(x, x′) = |⟨0|U<sub>c</sub><sup>†</sup>(βx′)U<sub>c</sub>(βx)|0⟩|² is what one compute–uncompute circuit estimates on hardware; in simulation each window's state is computed once and kernels are inner products. The one-class SVM (ν = 0.05) gives s(x) = ρ − Σ<sub>i</sub> α<sub>i</sub> k(x<sub>i</sub>, x). Scores are converted to a robust z-score (median and MAD on calibration windows), smoothed with an exponential average (0.2), and an alarm is raised above z = {B.get('z_thr', 6)}.</p>
{table(["Encoding", "1-qubit gates", "2-qubit gates", "Cost", "Expressibility (KL)", "Entangling (Q)"], lib_rows, "small")}
<p class="cap">Table 2. The 18-encoding library (6 qubits). Two-qubit gates are CNOT-equivalents (IsingZZ = 2). Cost weights two-qubit gates ×10 over one U<sup>†</sup>U circuit. Expressibility: KL divergence from Haar fidelities (lower is more expressive).</p>
<h3>2.2 Adaptation loop</h3>
<ol>
<li><b>Drift check.</b> ADWIN (δ = 0.002) watches the smoothed score. A saturated score never changes, so an alarm unbroken for 1 000 steps (longer than 80% of labelled anomalies) is also treated as a possible new regime.</li>
<li><b>Validation.</b> The controller collects 300 windows and adapts only if the current model gives the most recent half a median z above 2. A short anomaly that ends inside that period does not cause a switch.</li>
<li><b>Mode cache.</b> A regime signature (level and log-spread of the signal) is compared with stored ones; a match restores the stored model with no new circuits.</li>
<li><b>Encoding selection.</b> On recent windows mixed with remembered normal windows, each candidate trains a one-class SVM on half and scores how well it flags the other half against synthetic faults (spikes, level shifts, noise bursts, freezes, reversals). Quality Q(c) mixes the rank of that held-out AUC (weight 2) with the rank of the kernel's off-diagonal variance (weight 1, a concentration guard); c* = argmax Q(c) − λ·Cost(c)/Cost<sub>max</sub>, λ = 0.1. A new encoding must beat the current one by 0.1.</li>
<li><b>Refit.</b> The SVM is refitted on 125 recent windows plus 125 from a reservoir of past normal windows, so earlier modes are not forgotten.</li>
</ol>
<p>Every switch logs the circuits a quantum processor would run: m(m−1)/2 per kernel matrix, plus one circuit per support vector per scored window.</p>

<h2>3. Verification</h2>
{table(["Check", "Result"], [
    ["PennyLane ZZ kernel vs Qiskit zz_feature_map (independent library)", "Equal to 10<sup>−10</sup>"],
    ["All 18 kernels: unit diagonal, symmetric, positive semidefinite, values in [0, 1]", "Pass"],
    ["Angle encoding vs closed form ∏ cos²(β(x<sub>i</sub> − x′<sub>i</sub>)/2)", "Pass"],
    ["Depolarising model limits (p = 0 gives K, p = 1 gives 2<sup>−n</sup>); shot noise unbiased", "Pass"],
    ["Meyer–Wallach: product state 0, GHZ state 1", "Pass"],
    ["ADWIN: silent on 2 000 stationary samples, detects a mean shift within 100 steps", "Pass"],
    ["Event metrics on a hand-made case", "Pass"],
])}
<p class="cap">Table 3. Automated tests (python -m pytest): 27 passed.</p>

<h2>4. Experimental setup</h2>
<p><b>Data.</b> All {B['channels']} labelled channels of NASA SMAP and MSL [1]; the telemetry value (column 0) of each; training segment for fitting and normalisation only; test segment streamed in order. <b>Metrics.</b> Event level, as in the benchmark paper: a labelled sequence is detected if any alarm event overlaps it; an alarm event overlapping none is a false positive; precision, recall and F1 are micro-averaged over channels. AUC-PR on the point-wise score needs no threshold. Point-adjusted F1 is computed but not reported because it is known to be optimistic [9]. <b>Threshold.</b> One rule for all methods, z = 6, chosen on 21 development channels (every fourth channel); the full threshold curve is reported so no method is judged at a single tuned point. <b>Baselines.</b> Fixed QSVM (textbook ZZ map, β = 1, depth 2), static-best QSVM (encoding chosen once on the training segment with our rule, never adapted), RBF one-class SVM (median-heuristic γ), online RBF with the same ADWIN and refit, Isolation Forest, and NASA's published LSTM as a reference. <b>Hardware.</b> One laptop CPU; the full suite takes about 40 minutes.</p>

<h2>5. Results</h2>
<h3>5.1 Benchmark on unmodified streams</h3>
{table(["Method", "Detected", "False alarms", "Precision", "Recall", "F1", "AUC-PR", "False alarms / 1k steps"], bench_rows("ALL"))}
<p class="cap">Table 4. All {B['channels']} channels at z = {B.get('z_thr', 6)}. NASA LSTM with dynamic thresholds, for reference [1]: precision 0.875, recall 0.800 (uses command channels and per-channel deep models).</p>
{img("bench", "Fig. 1. Event F1 at each method's best threshold, and threshold-free AUC-PR.")}
{img("thr", "Fig. 2. Event F1 against alarm threshold; the dotted line is the threshold used in Table 4.")}
{table(["Q-DRIFT vs", "Δ AUC-PR", "W–L", "p", "Δ event F1", "W–L", "p"], wil_rows)}
<p class="cap">Table 5. Wilcoxon signed-rank tests over channels (positive Δ favours Q-DRIFT).</p>
<p>The selected quantum kernel detects as well as the classical RBF kernel by event F1 at matched best thresholds and catches more of the {n_anom} anomalies, but RBF ranks individual time steps better. The fixed textbook ZZ map has the highest precision because its kernel is concentrated: it rarely alarms and misses about half of the anomalies. On these unmodified streams, Q-DRIFT adapts {qd['switches_mean']:.1f} times per channel on average and this costs precision: what changes in them is mostly the anomalies themselves.</p>

<h3>5.2 Controlled operating-mode changes</h3>
<p>On {len(D['channels']) if D else 0} channels the signal is moved, at a known time, to a new level and spread (abrupt step, 1 500-step ramp, or alternation every 1 200 steps). Labels are unchanged, so alarms caused by the new mode are false.</p>
{table(["Method"] + [f"{k.capitalize()}: detected" if j == 0 else f"{k.capitalize()}: false-alarm time" for k in kinds for j in (0, 1)] + ["Cache hits (recurring)"], drift_rows, "small")}
<p class="cap">Table 6. False-alarm time: share of normal steps after the change spent in alarm (lower is better).</p>
{img("drift", "Fig. 3. Normal time in alarm after the mode change.")}
{img("timeline", "Fig. 4. Channel T-1 with an abrupt mode change (violet). The static quantum model stays in alarm; Q-DRIFT validates the change, switches (dashed) and recovers. Red: NASA-labelled anomaly.")}
<p>Q-DRIFT reduces false-alarm time by {", ".join(f"{100*c:.0f}% ({k})" for c, k in zip(cut, kinds))} relative to the same quantum model without adaptation. Refitting without re-encoding recovers less and raises more separate false alarms ({D['abrupt']['aggregate']['Refit-only QSVM']['post_drift_false_alarms'] if D else '–'} against {D['abrupt']['aggregate'][OURS]['post_drift_false_alarms'] if D else '–'} in the abrupt case), so choosing a new encoding matters beyond refitting. The classical online model adapts fastest but detects fewer labelled anomalies.</p>
<p><b>Why event F1 is not used here.</b> A detector that stays in alarm after the change forms one long alarm event that overlaps every later anomaly, so it scores high recall and few false-alarm events while being useless to an operator. Under drift we therefore report detected anomalies and false-alarm time separately.</p>

<h3>5.3 Ablation</h3>
{table(["Variant", "Precision", "Recall", "F1 (z = 6)", "Best F1", "AUC-PR", "Switches", "Cache hits", "Selection circuits"], abl_rows, "small")}
<p class="cap">Table 7. Each row changes one part of Q-DRIFT; all channels, unmodified streams.</p>
<p>Kernel-target alignment, the rule proposed at LLJ I, selects concentrated kernels. They alarm rarely, which raises precision ({f2(kta['precision']) if kta else '–'} vs {f2(qa['precision']) if qa else '–'}) but lowers recall ({f2(kta['recall']) if kta else '–'} vs {f2(qa['recall']) if qa else '–'}) and ranking quality (AUC-PR {f3(kta['auc_pr']) if kta else '–'} vs {f3(qa['auc_pr']) if qa else '–'}). In a study on the 21 development channels, the encoding chosen by alignment reached AUC-PR 0.327, below a random choice (0.447); the held-out fault test with the spread guard reached 0.482, and the best possible choice 0.599. The gap to that best choice is the main open problem.</p>

<h3>5.4 Kernel concentration</h3>
{img("conc", "Fig. 5. Variance of IQP kernel values on real SMAP windows against qubit count. At β = 1 it collapses exponentially; at β = 0.1 the kernel is nearly constant.", "half")}
<p>This reproduces exponential kernel concentration [6, 7] on spacecraft telemetry and explains both the failure of alignment and why bandwidth, not circuit family, is the most important choice.</p>

<h3>5.5 Toward hardware: noise and qubit count</h3>
{noise_tbl}
<p class="cap">Table 8. Q-DRIFT AUC-PR under simulated two-qubit depolarising error and finite shots ({len(N['channels']) if N else 0} channels).</p>
{qub_tbl}
<p class="cap">Table 9. Effect of qubit count (one PCA component per qubit, {len(Q['channels']) if Q else 0} channels).</p>
<p>Over this range the ranking quality barely moves (AUC-PR 0.32–0.35). Global depolarising noise only rescales kernel values, and 512 shots per entry still resolve the kernel values the detector uses. Event F1 at the fixed threshold rose with finite shots, most likely because shot noise widens the spread of normal scores so fewer windows cross the threshold; we read this as a threshold effect, not better detection.</p>
<p>With more qubits (one PCA component each), AUC-PR rises from 2 to 4 qubits and is flat from 6 to 8 for all three models. Event F1 of the quantum models at the fixed z threshold falls at 6–8 qubits on these channels while RBF's does not; we have not yet separated this threshold effect from detection quality.</p>

<h2>6. Discussion and limitations</h2>
<ul>
<li>We do not claim a quantum advantage: the best classical baseline ranks anomalies better overall, and every kernel here can be simulated classically at 6 qubits.</li>
<li>The adaptive loop is useful when operating modes change; on streams whose only changes are anomalies it costs precision. A deployment would enable it per channel or per mission phase.</li>
<li>Only the telemetry value is used; NASA's LSTM also reads command channels and trains a deep model per channel.</li>
<li>Noise is modelled, not measured. The next step is to run the selected encodings on IBM Quantum hardware for a few channels.</li>
<li>One global threshold is used for fairness; per-channel dynamic thresholds would raise every method's score.</li>
</ul>

<h2>7. How to run</h2>
<pre>cd 06_Implementation
python -m pytest -q                      # 27 tests
python experiments/run_all.py            # all experiments, writes results/*.json
python experiments/make_report.py        # this report
python app/server.py                     # console at http://127.0.0.1:8050</pre>
<p>The NASA data is downloaded once into data/ (Kaggle mirror of the original archive plus labeled_anomalies.csv from the telemanom repository).</p>

<h2>References</h2>
<ol class="refs">
<li>K. Hundman, V. Constantinou, C. Laporte, I. Colwell, T. Soderstrom. Detecting spacecraft anomalies using LSTMs and nonparametric dynamic thresholding. KDD 2018.</li>
<li>V. Havlíček et al. Supervised learning with quantum-enhanced feature spaces. Nature 567, 2019.</li>
<li>M. Schuld, N. Killoran. Quantum machine learning in feature Hilbert spaces. Phys. Rev. Lett. 122, 2019.</li>
<li>A. Bifet, R. Gavaldà. Learning from time-changing data with adaptive windowing. SDM 2007.</li>
<li>B. Schölkopf et al. Estimating the support of a high-dimensional distribution. Neural Computation 13, 2001.</li>
<li>S. Thanasilp, S. Wang, M. Cerezo, Z. Holmes. Exponential concentration in quantum kernel methods. arXiv:2208.11060, 2022.</li>
<li>R. Shaydulin, S. M. Wild. Importance of kernel bandwidth in quantum machine learning. Phys. Rev. A 106, 2022.</li>
<li>N. Cristianini et al. On kernel-target alignment. NeurIPS 2001; C. Cortes, M. Mohri, A. Rostamizadeh. Algorithms for learning kernels based on centered alignment. JMLR 13, 2012.</li>
<li>S. Kim et al. Towards a rigorous evaluation of time-series anomaly detection. AAAI 2022.</li>
<li>S. Sim, P. D. Johnson, A. Aspuru-Guzik. Expressibility and entangling capability of parameterized quantum circuits. Adv. Quantum Technol. 2, 2019.</li>
<li>V. Bergholm et al. PennyLane: automatic differentiation of hybrid quantum-classical computations. arXiv:1811.04968.</li>
</ol>
"""

page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Q-DRIFT LLJ II Report</title><style>{css}</style></head><body>{body}</body></html>"""
(OUT / "Q-DRIFT_LLJ2_Report.html").write_text(page, encoding="utf8")
print("wrote", OUT / "Q-DRIFT_LLJ2_Report.html", "figures:", list(figs))
