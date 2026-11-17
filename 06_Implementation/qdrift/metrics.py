"""Evaluation metrics.

event-level (Hundman et al. 2018, the NASA benchmark's own protocol):
  a labelled anomaly sequence is a true positive if any alarm event overlaps it; an alarm event that
  overlaps no labelled sequence is a false positive.
point-wise: precision/recall/F1 per time step, and threshold-free average precision (AUC-PR).
point-adjusted F1 is reported for comparison with the literature but is known to be optimistic
(Kim et al., AAAI 2022), so it is never the headline number.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import average_precision_score


def alarm_events(alarm: np.ndarray, gap: int = 100) -> list[tuple[int, int]]:
    """Merge alarm time steps closer than `gap` into [start, end] events."""
    idx = np.flatnonzero(alarm)
    if not len(idx):
        return []
    ev, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > gap:
            ev.append((int(s), int(p)))
            s = i
        p = i
    ev.append((int(s), int(p)))
    return ev


def evaluate(alarm: np.ndarray, score: np.ndarray, segments, n: int | None = None) -> dict:
    n = len(alarm) if n is None else n
    y = np.zeros(n, bool)
    for s, e in segments:
        y[s:e + 1] = True
    ev = alarm_events(alarm)
    hit = [any(a <= e and b >= s for a, b in ev) for s, e in segments]
    fp_ev = [1 for a, b in ev if not any(a <= e and b >= s for s, e in segments)]
    tp, fn, fp = sum(hit), len(segments) - sum(hit), len(fp_ev)
    delays = []
    for (s, e), h in zip(segments, hit):
        if h:
            first = np.flatnonzero(alarm[s:e + 1])
            delays.append(int(first[0]) if len(first) else 0)
    # point-adjusted: a whole segment counts as detected if any point in it alarms
    pa = alarm.copy()
    for (s, e), h in zip(segments, hit):
        if alarm[s:e + 1].any():
            pa[s:e + 1] = True
    def prf(pred):
        tpp = int((pred & y).sum())
        p = tpp / max(pred.sum(), 1)
        r = tpp / max(y.sum(), 1)
        return p, r, (2 * p * r / (p + r) if p + r else 0.0)
    pp, pr, pf = prf(alarm)
    _, _, paf = prf(pa)
    finite = np.nan_to_num(score, nan=0.0, posinf=1e6, neginf=-1e6)
    return {
        "tp": tp, "fn": fn, "fp": fp,
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "recall": tp / (tp + fn) if tp + fn else 0.0,
        "point_precision": pp, "point_recall": pr, "point_f1": pf, "pa_f1": paf,
        "auc_pr": float(average_precision_score(y, finite)) if y.any() else float("nan"),
        "delay": float(np.mean(delays)) if delays else float("nan"),
        "false_alarms_per_1k": 1000 * fp / n,
    }


def f1(p: float, r: float) -> float:
    return 2 * p * r / (p + r) if p + r else 0.0


def aggregate(rows: list[dict]) -> dict:
    """Micro-average event counts over channels (the NASA paper's convention)."""
    tp = sum(r["tp"] for r in rows); fp = sum(r["fp"] for r in rows); fn = sum(r["fn"] for r in rows)
    p = tp / (tp + fp) if tp + fp else 0.0
    rc = tp / (tp + fn) if tp + fn else 0.0
    mean = lambda k: float(np.nanmean([r[k] for r in rows]))
    return {"tp": tp, "fp": fp, "fn": fn, "precision": p, "recall": rc, "f1": f1(p, rc),
            "f05": (1.25 * p * rc / (0.25 * p + rc)) if p + rc else 0.0,
            "auc_pr": mean("auc_pr"), "point_f1": mean("point_f1"), "pa_f1": mean("pa_f1"),
            "delay": mean("delay"), "false_alarms_per_1k": mean("false_alarms_per_1k")}
