"""Controlled concept drift injected into real telemetry at a known time (abstract section 9).

The operating mode changes (level and spread of the signal) but the change is NOT an anomaly:
labels are untouched, so every alarm it causes outside labelled segments is a false alarm.
"""
from __future__ import annotations

import numpy as np

from .data import Channel


def _mode(x: np.ndarray, mu: float, sd: float) -> np.ndarray:
    return mu + 1.6 * (x - mu) + 1.2 * sd           # new operating mode: shifted level, wider spread


def inject(ch: Channel, kind: str, t0_frac: float = 0.25, ramp: int = 1500, period: int = 1200):
    x = ch.test.copy()
    mu, sd = ch.train.mean(), ch.train.std() + 1e-6
    T = len(x)
    t0 = int(t0_frac * T)
    alt = _mode(x, mu, sd)
    if kind == "abrupt":
        x[t0:] = alt[t0:]
    elif kind == "gradual":
        a = np.clip((np.arange(T) - t0) / ramp, 0, 1)
        x = (1 - a) * x + a * alt
    elif kind == "recurring":                         # e.g. sunlight / eclipse alternating every orbit
        on = ((np.arange(T) - t0) // period) % 2 == 0
        on[:t0] = False
        x[on] = alt[on]
    else:
        raise ValueError(kind)
    return x, t0
