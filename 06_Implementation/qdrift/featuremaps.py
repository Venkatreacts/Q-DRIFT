"""Feature-map library: angle, ZZ and IQP encodings x 3 bandwidths x 2 depths, simulated with PennyLane.

States are computed once per window with PennyLane parameter broadcasting; the fidelity kernel is
then |<psi(x)|psi(x')>|^2, exactly what a hardware compute-uncompute circuit U(x')^dag U(x) estimates.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations

import numpy as np
import pennylane as qml

FAMILIES = ("angle", "zz", "iqp")
BANDWIDTHS = (0.1, 0.3, 1.0)
DEPTHS = (1, 2)


@dataclass(frozen=True)
class FeatureMap:
    family: str
    bandwidth: float
    depth: int
    n_qubits: int = 6

    @property
    def name(self) -> str:
        return f"{self.family.upper()} b={self.bandwidth:g} d={self.depth}"

    @property
    def key(self) -> str:
        return f"{self.family}-{self.bandwidth:g}-{self.depth}"

    def pairs(self):
        n = self.n_qubits
        if self.family == "iqp":
            return list(combinations(range(n), 2))
        if self.family == "zz":
            return [(i, i + 1) for i in range(n - 1)]
        return [(i, (i + 1) % n) for i in range(n)] if self.depth > 1 else []  # CNOT ring between angle layers

    def gate_counts(self) -> tuple[int, int]:
        """(single-qubit, two-qubit CNOT-equivalent) gates in one U(x). IsingZZ = 2 CNOTs + 1 RZ."""
        n, p = self.n_qubits, len(self.pairs())
        if self.family == "angle":
            return n * self.depth, p * (self.depth - 1)
        return (2 * n + p) * self.depth, 2 * p * self.depth

    def cost(self) -> float:
        """Relative hardware cost of one kernel circuit U(x')^dag U(x): two-qubit gates weighted 10x."""
        one, two = self.gate_counts()
        return 2 * (one + 10 * two)

    def circuit(self, x):
        """Apply U(x) for x of shape (..., n_qubits); broadcasts over the leading axis."""
        n, b = self.n_qubits, self.bandwidth
        x = b * x
        for layer in range(self.depth):
            if self.family == "angle":
                if layer:
                    for i, j in self.pairs():
                        qml.CNOT([i, j])
                for i in range(n):
                    qml.RY(x[..., i], i)
            else:
                for i in range(n):
                    qml.Hadamard(i)
                    qml.RZ(2 * x[..., i] if self.family == "zz" else x[..., i], i)
                for i, j in self.pairs():
                    if self.family == "zz":   # Havlicek et al. ZZ map: phi_ij = (pi - x_i)(pi - x_j)
                        qml.IsingZZ(2 * (np.pi - x[..., i]) * (np.pi - x[..., j]), [i, j])
                    else:                     # IQP map: phi_ij = x_i x_j on all pairs
                        qml.IsingZZ(x[..., i] * x[..., j], [i, j])


def library(n_qubits: int = 6) -> list[FeatureMap]:
    return [FeatureMap(f, b, d, n_qubits) for f in FAMILIES for b in BANDWIDTHS for d in DEPTHS]


@lru_cache(maxsize=None)
def _qnode(fm: FeatureMap):
    dev = qml.device("default.qubit", wires=fm.n_qubits)

    @qml.qnode(dev)
    def state(x):
        fm.circuit(x)
        return qml.state()

    return state


def states(fm: FeatureMap, X: np.ndarray, chunk: int = 4096) -> np.ndarray:
    """Statevectors (len(X), 2**n) for every row of X."""
    X = np.atleast_2d(np.asarray(X, float))
    q = _qnode(fm)
    out = [np.asarray(q(X[i:i + chunk])).reshape(-1, 2 ** fm.n_qubits) for i in range(0, len(X), chunk)]
    return np.concatenate(out) if out else np.zeros((0, 2 ** fm.n_qubits), complex)


def kernel(SA: np.ndarray, SB: np.ndarray) -> np.ndarray:
    """Fidelity kernel k(a, b) = |<a|b>|^2 from precomputed statevectors."""
    return np.abs(SA.conj() @ SB.T) ** 2


def draw(fm: FeatureMap) -> str:
    text = qml.draw(_qnode(fm), decimals=None, max_length=200)(np.linspace(0.1, 0.6, fm.n_qubits))
    return "\n".join(line.replace("  State", "").rstrip() for line in text.splitlines())
