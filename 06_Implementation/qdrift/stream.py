"""Q-DRIFT streaming controller and the baselines it is compared with.

Every method sees the telemetry strictly in time order. A method is a combination of
  model : quantum | rbf | iforest
  init  : fixed (textbook ZZ map) | kta (best library encoding on the training segment)
  adapt : none | refit (same encoding, refit on recent data) | reselect (Q-DRIFT: re-choose the encoding)
  cache : reuse the model learnt for a recurring operating mode
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field

import numpy as np
from scipy.stats import rankdata
from sklearn.metrics import roc_auc_score
from sklearn.svm import OneClassSVM

from .adwin import ADWIN
from .data import Channel, Encoder
from .featuremaps import FeatureMap, kernel, library, states
from .kernels import alignment
from .models import IForest, QuantumOCSVM, RBFOCSVM

TEXTBOOK = FeatureMap("zz", 1.0, 2)


@dataclass
class Method:
    name: str
    model: str = "quantum"
    init: str = "kta"
    adapt: str = "none"
    cache: bool = False
    lam: float = 0.1
    criterion: str = "sep"


METHODS = {m.name: m for m in [
    Method("Q-DRIFT", adapt="reselect", cache=True),
    Method("Fixed QSVM", init="fixed"),
    Method("Static-best QSVM"),
    Method("RBF OCSVM", model="rbf"),
    Method("Online RBF + ADWIN", model="rbf", adapt="refit"),
    Method("Isolation Forest", model="iforest"),
]}
ABLATIONS = {m.name: m for m in [
    Method("Q-DRIFT", adapt="reselect", cache=True),
    Method("no cache", adapt="reselect", cache=False),
    Method("no cost penalty (lam=0)", adapt="reselect", cache=True, lam=0.0),
    Method("high cost penalty (lam=0.5)", adapt="reselect", cache=True, lam=0.5),
    Method("KTA selection (LLJ-I proposal)", adapt="reselect", cache=True, criterion="kta"),
    Method("refit only (no re-encoding)", adapt="refit", cache=True),
    Method("no adaptation", adapt="none"),
]}


@dataclass
class Config:
    n_qubits: int = 6
    w: int = 64
    m_fit: int = 250          # windows used to fit the one-class SVM
    settle: int = 300         # windows collected after a drift alarm before switching
    m_sel: int = 80           # recent normal windows used to score encodings (half fit, half held out)
    ewma: float = 0.2
    z_thr: float = 6.0        # alarm when the smoothed robust z-score exceeds this
    delta: float = 0.002      # ADWIN confidence
    accept_z: float = 2.0     # switch only if the current model scores the new regime above this median z
    hysteresis: float = 0.1   # a new encoding must beat the current one by this much
    persist: int = 1000       # an unbroken alarm this long (longer than 80% of labelled anomalies) may be a new regime
    p2: float = 0.0           # two-qubit depolarising error (noise study)
    shots: int = 0            # 0 = exact kernel
    seed: int = 0
    lib: list = field(default=None)

    def __post_init__(self):
        if self.lib is None:
            self.lib = library(self.n_qubits)


def _perturb(W: np.ndarray, rng) -> np.ndarray:
    """Synthetic abnormal copies of normal windows: spikes, level shifts, noise bursts, freezes, drops."""
    out = W.copy()
    n, w = W.shape
    kind = rng.integers(0, 5, n)
    sd = W.std() + 1e-6
    for i in range(n):
        k = kind[i]
        if k == 0:
            out[i, rng.integers(w // 2, w)] += rng.choice([-1, 1]) * 5 * sd
        elif k == 1:
            out[i, w // 2:] += rng.choice([-1, 1]) * 2.5 * sd
        elif k == 2:
            out[i] += rng.normal(0, 1.5 * sd, w)
        elif k == 3:
            out[i, w // 3:] = out[i, w // 3]
        else:
            out[i] = out[i][::-1] * rng.choice([-1, 1])
    return out


def _even(idx: np.ndarray, m: int) -> np.ndarray:
    return idx if len(idx) <= m else idx[np.linspace(0, len(idx) - 1, m).astype(int)]


class Runner:
    """Runs one method over one channel; returns per-step series plus an event log."""

    def __init__(self, ch: Channel, cfg: Config = None, test_series: np.ndarray | None = None):
        self.ch, self.cfg = ch, cfg or Config()
        self.enc = Encoder(self.cfg.n_qubits, self.cfg.w).fit(ch.train)
        self.test = ch.test if test_series is None else test_series
        full = np.concatenate([ch.train[-(self.cfg.w - 1):], self.test])
        self.Rw = self.enc.raw_windows(full)                 # raw normalised windows of the stream
        self.X = self.enc.from_windows(self.Rw)              # qubit angles per test step
        Rtr = self.enc.raw_windows(ch.train)
        self.Xtr = self.enc.from_windows(Rtr)
        self.Rtr = Rtr
        self.rng = np.random.default_rng(self.cfg.seed)
        self._S = {}

    # statevectors of every stream window, computed once per encoding
    def S(self, fm: FeatureMap) -> np.ndarray:
        if fm not in self._S:
            self._S[fm] = states(fm, self.X)
        return self._S[fm]

    def select(self, Xn, Rn, lam, criterion="sep"):
        """Choose an encoding for the current regime (equation 5): c* = argmax_c Q(c) - lam * Cost(c)/Cost_max.

        Recent normal windows are split in two; a one-class SVM is fitted on one half and must tell the other
        half apart from synthetic faults made from it (spikes, level shifts, noise bursts, freezes, reversals).
          criterion="sep": Q = rank-mix of that held-out AUC (weight 2) and the off-diagonal kernel variance
                           (weight 1, a guard against exponential kernel concentration), scaled to [0, 1].
          criterion="kta": Q = centred kernel-target alignment, the criterion proposed in the LLJ-I abstract.
        """
        idx = _even(np.arange(len(Xn)), self.cfg.m_sel)
        tr, ho = idx[::2], idx[1::2]
        neg = self.enc.from_windows(_perturb(Rn[ho], self.rng))
        Xh = np.vstack([Xn[ho], neg])
        y = np.r_[np.ones(len(ho)), -np.ones(len(neg))]
        cmax = max(fm.cost() for fm in self.cfg.lib)
        table = []
        for fm in self.cfg.lib:
            St, Sh = states(fm, Xn[tr]), states(fm, Xh)
            K = kernel(St, St)
            svm = OneClassSVM(kernel="precomputed", nu=0.05).fit(K)
            s = -svm.decision_function(kernel(Sh, St))
            table.append({"key": fm.key, "name": fm.name,
                          "auc": float(roc_auc_score(y < 0, s)),
                          "variance": float(K[np.triu_indices(len(K), 1)].var()),
                          "alignment": alignment(kernel(Sh, Sh), y),
                          "cost": fm.cost() / cmax})
        n = len(table)
        if criterion == "kta":
            q = np.array([r["alignment"] for r in table])
        else:
            q = (2 * rankdata([r["auc"] for r in table]) + rankdata([r["variance"] for r in table]) - 3) / (3 * (n - 1))
        for r, qi in zip(table, q):
            r["quality"] = float(qi)
            r["score"] = float(qi - lam * r["cost"])
        best = max(range(n), key=lambda i: table[i]["score"])
        m_t, m_h = len(tr), len(Xh)
        circuits = n * (m_t * (m_t - 1) // 2 + m_h * m_t + m_h * (m_h - 1) // 2)
        return self.cfg.lib[best], table, circuits

    def fit(self, method, fm, Xf):
        cfg = self.cfg
        if method.model == "quantum":
            mdl = QuantumOCSVM(fm, cfg.p2, cfg.shots, cfg.seed)
            mdl.fit(states(fm, Xf))
        else:
            mdl = (RBFOCSVM() if method.model == "rbf" else IForest()).fit(Xf)
        return mdl

    def score(self, mdl, a, b=None, X=None):
        if X is not None:
            return mdl.score_states(states(mdl.fm, X)) if mdl.kind == "quantum" else mdl.score(X)
        sl = slice(a, b)
        return mdl.score_states(self.S(mdl.fm)[sl]) if mdl.kind == "quantum" else mdl.score(self.X[sl])

    def run(self, method: Method) -> dict:
        cfg, T = self.cfg, len(self.X)
        t0 = time.perf_counter()
        self.rng = np.random.default_rng(cfg.seed)     # same synthetic negatives for every method
        events = []
        circ = {"select": 0, "fit": 0, "score": 0}

        # ---- initial model on the training segment
        fit_idx = _even(np.arange(len(self.Xtr)), cfg.m_fit)
        fm = None
        if method.model == "quantum":
            if method.init == "fixed":
                fm = FeatureMap(TEXTBOOK.family, TEXTBOOK.bandwidth, TEXTBOOK.depth, cfg.n_qubits)
                table = None
            else:
                fm, table, c = self.select(self.Xtr, self.Rtr, method.lam, method.criterion)
                circ["select"] += c
        mdl = self.fit(method, fm, self.Xtr[fit_idx])
        circ["fit"] += mdl.circuits_fit
        if fm is not None:
            events.append({"t": 0, "type": "init", "encoding": fm.name, "key": fm.key, "candidates": table,
                           "circuits": circ["select"] + circ["fit"]})
        cal = self.score(mdl, None, X=self.Xtr)
        med, mad = np.median(cal), 1.4826 * np.median(np.abs(cal - np.median(cal))) + 1e-9

        raw = self.score(mdl, 0, T)
        z = (raw - med) / mad
        ew = np.empty(T)
        alarm = np.zeros(T, bool)
        drift_pts, switch_pts = [], []
        enc_series = np.full(T, -1)
        lib_keys = [f.key for f in cfg.lib]
        adwin = ADWIN(cfg.delta)
        cache = []                       # [(signature, model, med, mad, fm)]
        res_X, res_R = self.Xtr[fit_idx], self.Rtr[fit_idx]   # normal windows seen so far (features, raw)
        last_switch = 0
        pending = None
        e = 0.0
        sv_per_step = mdl.n_sv
        run_len = 0

        for t in range(T):
            e = z[t] if t == 0 else cfg.ewma * z[t] + (1 - cfg.ewma) * e
            ew[t] = e
            alarm[t] = e > cfg.z_thr
            circ["score"] += sv_per_step
            if fm is not None:
                enc_series[t] = lib_keys.index(fm.key) if fm.key in lib_keys else -1
            if method.adapt == "none":
                continue
            run_len = run_len + 1 if alarm[t] else 0
            if pending is None:
                shifted = adwin.update(np.clip((e + 2) / 12, 0, 1))
                # a saturated score never "changes", so ADWIN cannot see it: a long unbroken alarm also counts
                sustained = run_len >= cfg.persist
                if shifted or sustained:
                    drift_pts.append(t)
                    pending = t + cfg.settle
                    events.append({"t": t, "type": "drift", "trigger": "adwin" if shifted else "sustained alarm"})
                    run_len = 0
            elif t >= pending:
                lo = max(0, t - cfg.settle + 1)
                idx = np.arange(lo, t + 1)
                seg = self.test[lo:t + 1]
                sig = np.array([seg.mean(), np.log(seg.std() + 1e-6)])
                sig = (sig - [self.enc.mu, np.log(self.enc.sd)]) / [self.enc.sd, 1]
                # validate before swapping: if the current model still finds the new regime normal,
                # the alarm came from a transient (often the anomaly itself), so keep the model.
                tail = idx[len(idx) // 2:]                       # the most recent half of the settle window
                if np.median(z[tail]) < cfg.accept_z:
                    events.append({"t": t, "type": "keep", "median_z": float(np.median(z[tail]))})
                    adwin.reset()
                    pending = None
                    continue
                hit = None
                if method.cache:
                    for i, (s, *_rest) in enumerate(cache):
                        if np.abs(s - sig).max() < 0.25:
                            hit = i
                            break
                ev = {"t": t, "type": "switch", "from": fm.name if fm else method.model}
                spent = circ["select"] + circ["fit"]
                if hit is not None:
                    _, mdl, med, mad, fm = cache[hit]
                    ev.update(cache_hit=True, encoding=fm.name if fm else method.model, key=fm.key if fm else None)
                else:
                    table = None
                    if method.model == "quantum" and method.adapt == "reselect":
                        # score encodings on the new regime plus remembered normal behaviour
                        ri = self.rng.choice(len(res_X), min(len(res_X), len(tail)), replace=False)
                        new_fm, table, c = self.select(np.vstack([self.X[tail], res_X[ri]]),
                                                       np.vstack([self.Rw[tail], res_R[ri]]),
                                                       method.lam, method.criterion)
                        circ["select"] += c
                        cur = next(r["score"] for r in table if r["key"] == fm.key)
                        best = next(r["score"] for r in table if r["key"] == new_fm.key)
                        if best > cur + cfg.hysteresis:               # switch only for a clear gain
                            fm = new_fm
                        for r in table:
                            r["chosen"] = r["key"] == fm.key
                    # recent windows (minus ones already alarming, unless the whole regime moved) + reservoir
                    quiet = idx[~alarm[idx]]
                    recent = quiet if len(quiet) >= len(idx) // 2 else idx
                    Xr = self.X[_even(recent, cfg.m_fit // 2)]
                    Xo = res_X[self.rng.choice(len(res_X), min(len(res_X), cfg.m_fit // 2), replace=False)]
                    Xf = np.vstack([Xr, Xo])
                    mdl = self.fit(method, fm, Xf)
                    circ["fit"] += mdl.circuits_fit
                    cal = self.score(mdl, None, X=np.vstack([self.X[idx], res_X]))  # mostly held-out
                    med, mad = np.median(cal), 1.4826 * np.median(np.abs(cal - np.median(cal))) + 1e-9
                    if method.cache:
                        cache.append((sig, mdl, med, mad, fm))
                    ev.update(cache_hit=False, encoding=fm.name if fm else method.model,
                              key=fm.key if fm else None, candidates=table)
                ev["circuits"] = circ["select"] + circ["fit"] - spent
                events.append(ev)
                switch_pts.append(t)
                past = np.arange(last_switch, t + 1)
                past = past[~alarm[past]]
                if len(past):
                    pi = _even(past, 100)
                    res_X, res_R = np.vstack([res_X, self.X[pi]]), np.vstack([res_R, self.Rw[pi]])
                    if len(res_X) > 600:
                        keep = self.rng.choice(len(res_X), 600, replace=False)
                        res_X, res_R = res_X[keep], res_R[keep]
                last_switch = t
                sv_per_step = mdl.n_sv
                if t + 1 < T:
                    z[t + 1:] = (self.score(mdl, t + 1, T) - med) / mad
                adwin.reset()
                pending = None

        return {
            "method": method.name, "config": {k: v for k, v in asdict(method).items()},
            "score": ew, "alarm": alarm, "drift": drift_pts, "switch": switch_pts,
            "encoding": enc_series, "events": events, "circuits": circ,
            "runtime_s": time.perf_counter() - t0,
        }


def run_channel(ch: Channel, methods=None, cfg: Config = None, test_series=None) -> dict:
    r = Runner(ch, cfg, test_series)
    return {name: r.run(m) for name, m in (methods or METHODS).items()}
