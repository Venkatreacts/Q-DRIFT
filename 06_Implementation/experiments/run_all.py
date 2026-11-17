"""Run every experiment and write JSON results for the report and the demo app.

    python experiments/run_all.py                 # everything
    python experiments/run_all.py benchmark drift # selected parts
Parts: benchmark, ablation, drift, noise, qubits, kernels
"""
from __future__ import annotations

import json
import os
import sys
import time
import warnings
from pathlib import Path

import numpy as np
from joblib import Parallel, delayed
from scipy.stats import wilcoxon

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
warnings.filterwarnings("ignore")

from qdrift.data import labels, load_channel                      # noqa: E402
from qdrift.drift import inject                                   # noqa: E402
from qdrift.featuremaps import FeatureMap, draw, kernel, library, states  # noqa: E402
from qdrift.kernels import concentration, entangling_capability, expressibility  # noqa: E402
from qdrift.metrics import aggregate, alarm_events, evaluate, f1                # noqa: E402
from qdrift.stream import ABLATIONS, METHODS, Config, Runner      # noqa: E402

OUT = ROOT / "results"
REPLAY = OUT / "replay"
JOBS = int(os.environ.get("QDRIFT_JOBS", 2))   # this laptop has little free memory; 1 is safest
THRESHOLDS = [3, 4, 5, 6, 7, 8, 10, 12]


def _clean(o):
    """NaN is not valid JSON (browsers reject it); write null instead."""
    if isinstance(o, float) and o != o:
        return None
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    return o


def _json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_clean(json.loads(json.dumps(obj, default=_conv))), separators=(",", ":"), allow_nan=False))


def _conv(o):
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return None if np.isnan(o) else round(float(o), 5)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, FeatureMap):
        return o.key
    raise TypeError(type(o))


def _rle(a):
    """Run-length encode an integer series as [[start, value], ...]."""
    a = np.asarray(a)
    ch = np.r_[0, np.flatnonzero(np.diff(a)) + 1]
    return [[int(i), int(a[i])] for i in ch]


def _replay(ch, results, test, extra=None):
    rep = {"chan": ch.chan_id, "spacecraft": ch.spacecraft, "classes": ch.classes,
           "anomalies": ch.anomalies, "train": np.round(ch.train[::4], 4), "test": np.round(test, 4),
           "z_thr": Config().z_thr, "methods": {}}
    for name, r in results.items():
        rep["methods"][name] = {
            "score": np.round(np.clip(r["score"], -50, 200), 3),
            "alarm_events": alarm_events(r["alarm"]),
            "drift": r["drift"], "switch": r["switch"], "encoding": _rle(r["encoding"]),
            "events": r["events"], "circuits": r["circuits"],
        }
    rep.update(extra or {})
    return rep


def _metrics_all_thr(r, segs):
    out = {}
    for thr in THRESHOLDS:
        m = evaluate(r["score"] > thr, r["score"], segs)
        out[str(thr)] = {k: m[k] for k in ("tp", "fp", "fn")}
    return out


def _bench_one(cid, methods, tag):
    ch = load_channel(cid)
    r = Runner(ch, Config())
    res = {n: r.run(m) for n, m in methods.items()}
    rows = {}
    for name, r in res.items():
        m = evaluate(r["alarm"], r["score"], ch.anomalies)
        m.update(chan=cid, spacecraft=ch.spacecraft, switches=len(r["switch"]),
                 cache_hits=sum(1 for e in r["events"] if e.get("cache_hit")),
                 circuits=r["circuits"], runtime_s=r["runtime_s"],
                 thr=_metrics_all_thr(r, ch.anomalies))
        rows[name] = m
    if tag == "benchmark":
        _json(REPLAY / f"{cid}.json", _replay(ch, res, ch.test))
    return rows


def _summarise(per_chan, methods):
    out = {"per_channel": per_chan, "aggregate": {}, "wilcoxon": {}, "threshold_curve": {}}
    for name in methods:
        rows = [pc[name] for pc in per_chan]
        out["aggregate"][name] = {g: aggregate([r for r in rows if g == "ALL" or r["spacecraft"] == g])
                                  for g in ("ALL", "SMAP", "MSL")}
        circ = [r["circuits"] for r in rows]
        out["aggregate"][name]["ALL"]["circuits_mean"] = {k: float(np.mean([c[k] for c in circ])) for k in circ[0]}
        out["aggregate"][name]["ALL"]["switches_mean"] = float(np.mean([r["switches"] for r in rows]))
        out["aggregate"][name]["ALL"]["cache_hits_total"] = int(sum(r["cache_hits"] for r in rows))
        out["aggregate"][name]["ALL"]["runtime_mean_s"] = float(np.mean([r["runtime_s"] for r in rows]))
        curve = {}
        for thr in THRESHOLDS:
            tp = sum(r["thr"][str(thr)]["tp"] for r in rows)
            fp = sum(r["thr"][str(thr)]["fp"] for r in rows)
            fn = sum(r["thr"][str(thr)]["fn"] for r in rows)
            p, rc = tp / max(tp + fp, 1), tp / max(tp + fn, 1)
            curve[str(thr)] = {"precision": p, "recall": rc, "f1": f1(p, rc)}
        out["threshold_curve"][name] = curve
    ref = list(methods)[0]
    for name in list(methods)[1:]:
        res = {}
        for metric in ("auc_pr", "event_f1"):
            def val(r):
                return r["auc_pr"] if metric == "auc_pr" else f1(r["precision"], r["recall"])
            a = np.array([val(pc[ref]) for pc in per_chan])
            b = np.array([val(pc[name]) for pc in per_chan])
            ok = ~(np.isnan(a) | np.isnan(b))
            d = a[ok] - b[ok]
            try:
                p = float(wilcoxon(a[ok], b[ok]).pvalue) if np.any(d != 0) else 1.0
            except ValueError:
                p = 1.0
            res[metric] = {"mean_diff": float(d.mean()), "wins": int((d > 0).sum()),
                           "losses": int((d < 0).sum()), "ties": int((d == 0).sum()), "p": p}
        out["wilcoxon"][name] = res
    return out


def benchmark(tag="benchmark", methods=METHODS):
    chans = list(labels())
    t = time.time()
    per = Parallel(n_jobs=JOBS, verbose=0)(delayed(_bench_one)(c, methods, tag) for c in chans)
    out = _summarise(per, methods)
    out["channels"] = len(chans)
    out["wall_s"] = time.time() - t
    _json(OUT / f"{tag}.json", out)
    a = out["aggregate"]
    for n in methods:
        g = a[n]["ALL"]
        print(f"{tag:9s} {n:30s} P={g['precision']:.3f} R={g['recall']:.3f} F1={g['f1']:.3f} "
              f"AUCPR={g['auc_pr']:.3f} FA/1k={g['false_alarms_per_1k']:.2f}")
    return out


def ablation():
    return benchmark("ablation", ABLATIONS)


# ---------------------------------------------------------------- controlled drift
DRIFT_METHODS = {k: METHODS[k] for k in ("Q-DRIFT", "Static-best QSVM", "Fixed QSVM", "RBF OCSVM", "Online RBF + ADWIN")}
DRIFT_METHODS["Refit-only QSVM"] = ABLATIONS["refit only (no re-encoding)"]


def _drift_one(cid, kind):
    ch = load_channel(cid)
    test, t0 = inject(ch, kind)
    r = Runner(ch, Config(), test)
    res = {n: r.run(m) for n, m in DRIFT_METHODS.items()}
    rows = {}
    for name, x in res.items():
        m = evaluate(x["alarm"], x["score"], ch.anomalies)
        normal_after = ~ch.point_labels()
        normal_after[:t0] = False
        post = x["alarm"][normal_after]          # alarm time on normal steps after the mode change
        normal_post = np.ones(len(test), bool)
        for s, e in ch.anomalies:
            normal_post[s:e + 1] = False
        fa = [ev for ev in alarm_events(x["alarm"]) if ev[0] >= t0 and normal_post[ev[0]:ev[1] + 1].all()]
        m.update(post_drift_false_alarms=len(fa), post_alarm_frac=float(post.mean()),
                 switches=len(x["switch"]), cache_hits=sum(1 for e in x["events"] if e.get("cache_hit")),
                 circuits=x["circuits"], chan=cid, spacecraft=ch.spacecraft)
        rows[name] = m
    _json(REPLAY / "drift" / f"{cid}_{kind}.json", _replay(ch, res, test, {"drift_kind": kind, "t0": t0}))
    return rows


def drift(n_chan=24):
    meta = labels()
    # channels with the longest test streams give room for the drift to play out
    chans = sorted(meta, key=lambda c: -len(np.load(ROOT / "data" / "test" / f"{c}.npy", mmap_mode="r")))[:n_chan]
    out = {}
    prev = json.loads((OUT / "drift.json").read_text()) if (OUT / "drift.json").exists() else {}
    out.update({k: v for k, v in prev.items() if k in ("abrupt", "gradual", "recurring")})
    for kind in ("abrupt", "gradual", "recurring"):
        if kind in out:
            continue
        per = Parallel(n_jobs=JOBS)(delayed(_drift_one)(c, kind) for c in chans)
        agg = {}
        for name in DRIFT_METHODS:
            rows = [p[name] for p in per]
            g = aggregate(rows)
            g.update(post_drift_false_alarms=int(sum(r["post_drift_false_alarms"] for r in rows)),
                     post_alarm_frac=float(np.mean([r["post_alarm_frac"] for r in rows])),
                     switches=float(np.mean([r["switches"] for r in rows])),
                     cache_hits=int(sum(r["cache_hits"] for r in rows)),
                     circuits_select=float(np.mean([r["circuits"]["select"] for r in rows])))
            agg[name] = g
            print(f"drift {kind:9s} {name:22s} F1={g['f1']:.3f} postFA={g['post_drift_false_alarms']:4d} "
                  f"alarm%={100*g['post_alarm_frac']:.1f} cache={g['cache_hits']}")
        out[kind] = {"aggregate": agg, "per_channel": per}
        out["channels"] = chans
        _json(OUT / "drift.json", out)          # saved after each kind, so a crash keeps finished work


# ---------------------------------------------------------------- hardware-noise study
def _noise_one(cid, p2, shots):
    ch = load_channel(cid)
    r = Runner(ch, Config(p2=p2, shots=shots))
    out = {}
    for name in ("Q-DRIFT", "Static-best QSVM"):
        x = r.run(METHODS[name])
        m = evaluate(x["alarm"], x["score"], ch.anomalies)
        out[name] = {k: m[k] for k in ("tp", "fp", "fn", "auc_pr")}
    return out


def noise(n_chan=12):
    chans = list(labels())[:: max(1, len(labels()) // n_chan)][:n_chan]
    grid = [(p2, s) for p2 in (0.0, 0.005, 0.02) for s in (0, 4096, 512)]
    out = {"channels": chans, "grid": []}
    for p2, s in grid:
        per = Parallel(n_jobs=JOBS)(delayed(_noise_one)(c, p2, s) for c in chans)
        row = {"p2": p2, "shots": s}
        for name in ("Q-DRIFT", "Static-best QSVM"):
            g = aggregate([dict(p[name], delay=np.nan, false_alarms_per_1k=np.nan, point_f1=np.nan, pa_f1=np.nan)
                           for p in per])
            row[name] = {"f1": g["f1"], "auc_pr": g["auc_pr"], "precision": g["precision"], "recall": g["recall"]}
        out["grid"].append(row)
        print(f"noise p2={p2:<6} shots={s:<5} F1 qdrift={row['Q-DRIFT']['f1']:.3f} AUCPR={row['Q-DRIFT']['auc_pr']:.3f}")
    _json(OUT / "noise.json", out)


# ---------------------------------------------------------------- qubit count
def _qubit_one(cid, n):
    ch = load_channel(cid)
    r = Runner(ch, Config(n_qubits=n))
    out = {}
    for name in ("Q-DRIFT", "Static-best QSVM", "RBF OCSVM"):
        x = r.run(METHODS[name])
        m = evaluate(x["alarm"], x["score"], ch.anomalies)
        out[name] = {k: m[k] for k in ("tp", "fp", "fn", "auc_pr")}
    return out


def qubits(n_chan=12):
    chans = list(labels())[:: max(1, len(labels()) // n_chan)][:n_chan]
    out = {"channels": chans, "rows": []}
    for n in (2, 4, 6, 8):
        per = Parallel(n_jobs=JOBS)(delayed(_qubit_one)(c, n) for c in chans)
        row = {"n_qubits": n}
        for name in ("Q-DRIFT", "Static-best QSVM", "RBF OCSVM"):
            g = aggregate([dict(p[name], delay=np.nan, false_alarms_per_1k=np.nan, point_f1=np.nan, pa_f1=np.nan)
                           for p in per])
            row[name] = {"f1": g["f1"], "auc_pr": g["auc_pr"]}
        out["rows"].append(row)
        print("qubits", n, {k: round(v["f1"], 3) for k, v in row.items() if isinstance(v, dict)})
    _json(OUT / "qubits.json", out)


# ---------------------------------------------------------------- kernel analysis for the app
def kernels(chan="G-6", conc_chan="P-1"):
    from qdrift.data import Encoder
    lib = library(6)
    out = {"library": [], "concentration": [], "heatmaps": {}, "chan": chan, "conc_chan": conc_chan}
    for fm in lib:
        one, two = fm.gate_counts()
        out["library"].append({"key": fm.key, "name": fm.name, "family": fm.family, "bandwidth": fm.bandwidth,
                               "depth": fm.depth, "gates_1q": one, "gates_2q": two, "cost": fm.cost(),
                               "expressibility": expressibility(fm), "entangling": entangling_capability(fm),
                               "circuit": draw(fm)})
        print("lib", fm.name)
    ch = load_channel(conc_chan)  # needs varied training data (D-7's training signal is constant)
    for n in (2, 4, 6, 8, 10, 12):
        enc = Encoder(n, 64).fit(ch.train)
        X = enc.transform(ch.train)[::7][:200]
        for fam, d in (("iqp", 2), ("zz", 2), ("angle", 1)):
            for b in (0.1, 0.25, 0.5, 1.0):
                out["concentration"].append({"n": n, "family": fam, "bandwidth": b,
                                             "var": concentration(FeatureMap(fam, b, d, n), X)})
        print("conc", n)
    ch = load_channel(chan)
    # kernel heatmaps: 60 normal training windows then 60 windows from labelled anomalies
    enc = Encoder(6, 64).fit(ch.train)
    Xn = enc.transform(ch.train)[::20][:60]
    full = np.concatenate([ch.train[-63:], ch.test])
    Xs = enc.transform(full)
    ai = np.concatenate([np.arange(s, e + 1) for s, e in ch.anomalies])
    Xa = Xs[ai[np.linspace(0, len(ai) - 1, 60).astype(int)]]
    for fm in lib:
        S = states(fm, np.vstack([Xn, Xa]))
        out["heatmaps"][fm.key] = np.round(kernel(S, S), 3)
    _json(OUT / "kernels.json", out)


PARTS = {"benchmark": benchmark, "ablation": ablation, "drift": drift, "noise": noise,
         "qubits": qubits, "kernels": kernels}

if __name__ == "__main__":
    for p in (sys.argv[1:] or list(PARTS)):
        t = time.time()
        PARTS[p]()
        print(f"== {p} done in {time.time() - t:.0f}s", flush=True)
