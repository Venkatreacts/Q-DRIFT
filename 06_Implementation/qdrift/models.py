"""Anomaly scorers. Quantum: one-class SVM on a precomputed fidelity kernel. Classical baselines: RBF OCSVM, Isolation Forest.

All scorers return s(x) = rho - sum_i alpha_i k(x_i, x)  (larger = more anomalous), equation (2) of the abstract.
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM

from .featuremaps import FeatureMap, kernel
from .kernels import depolarize, shot_noise

NU = 0.05


class QuantumOCSVM:
    kind = "quantum"

    def __init__(self, fm: FeatureMap, p2: float = 0.0, shots: int = 0, seed: int = 0):
        self.fm, self.p2, self.shots = fm, p2, shots
        self.rng = np.random.default_rng(seed)

    def _k(self, SA, SB):
        K = kernel(SA, SB)
        if self.p2:
            K = depolarize(K, self.fm, self.p2)
        if self.shots:
            K = shot_noise(K, self.shots, self.rng)
        return K

    def fit(self, S_fit: np.ndarray):
        K = self._k(S_fit, S_fit)
        self.svm = OneClassSVM(kernel="precomputed", nu=NU).fit(K)
        sv = self.svm.support_
        self.S_sv, self.alpha, self.rho = S_fit[sv], self.svm.dual_coef_[0], -self.svm.intercept_[0]
        m = len(S_fit)
        self.circuits_fit = m * (m - 1) // 2      # one compute-uncompute circuit per kernel entry
        return self

    @property
    def n_sv(self) -> int:
        return len(self.S_sv)

    def score_states(self, S: np.ndarray) -> np.ndarray:
        return self.rho - self._k(S, self.S_sv) @ self.alpha

    def nearest(self, S: np.ndarray) -> np.ndarray:
        """Index (into the support set) of the most similar normal pattern, for alarm explanations."""
        return np.argmax(kernel(S, self.S_sv), axis=1)


class RBFOCSVM:
    kind = "rbf"
    circuits_fit = 0
    n_sv = 0

    def fit(self, X: np.ndarray):
        d2 = ((X[:, None] - X[None]) ** 2).sum(-1)
        pos = d2[d2 > 0]
        self.gamma = 1.0 / np.median(pos) if len(pos) else 1.0   # median heuristic; constant data -> 1
        self.svm = OneClassSVM(kernel="rbf", gamma=self.gamma, nu=NU).fit(X)
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        return -self.svm.decision_function(X)


class IForest:
    kind = "iforest"
    circuits_fit = 0
    n_sv = 0

    def fit(self, X: np.ndarray):
        self.m = IsolationForest(n_estimators=200, random_state=0).fit(X)
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        return -self.m.score_samples(X)
