"""ADWIN drift detector (Bifet & Gavalda 2007), implemented directly from equation (3) of the abstract.

Keeps a window W of recent values; drift is flagged when for some split W0|W1
    |mean(W0) - mean(W1)| >= eps_cut,  eps_cut = sqrt( 1/(2m) * ln(4|W|/delta) ),  m = 1/(1/n0 + 1/n1).
On drift the older part W0 is dropped. Values are assumed to lie in [0, 1] (the bound is for that range).
"""
from __future__ import annotations

import numpy as np


class ADWIN:
    def __init__(self, delta: float = 0.002, max_window: int = 1000, min_side: int = 30, check_every: int = 5):
        self.delta, self.max_window, self.min_side, self.check_every = delta, max_window, min_side, check_every
        self.reset()

    def reset(self):
        self.w: list[float] = []
        self._t = 0

    def update(self, v: float) -> bool:
        self.w.append(float(v))
        if len(self.w) > self.max_window:
            self.w.pop(0)
        self._t += 1
        n = len(self.w)
        if n < 2 * self.min_side or self._t % self.check_every:
            return False
        a = np.asarray(self.w)
        cs = np.cumsum(a)
        n0 = np.arange(self.min_side, n - self.min_side + 1)
        n1 = n - n0
        mu0 = cs[n0 - 1] / n0
        mu1 = (cs[-1] - cs[n0 - 1]) / n1
        m = 1.0 / (1.0 / n0 + 1.0 / n1)
        eps = np.sqrt(np.log(4 * n / self.delta) / (2 * m))
        hit = np.abs(mu0 - mu1) >= eps
        if hit.any():
            cut = n0[np.argmax(hit)]           # earliest split that fails
            self.w = self.w[cut:]
            return True
        return False
