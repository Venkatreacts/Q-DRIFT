"""Kernel analysis: target alignment, hardware-noise models, expressibility and entangling capability."""
from __future__ import annotations

import numpy as np

from .featuremaps import FeatureMap, kernel, states


def alignment(K: np.ndarray, y: np.ndarray, centered: bool = True) -> float:
    """Kernel-target alignment A(K, y) = <K, yy^T>_F / (||K||_F ||yy^T||_F)  (Cristianini et al. 2001).

    centered=True uses centred alignment (Cortes et al. 2012), which ignores the constant offset that
    makes every fidelity kernel look partly aligned.
    """
    Y = np.outer(y, y).astype(float)
    if centered:
        n = len(y)
        H = np.eye(n) - 1.0 / n
        K = H @ K @ H
    den = np.linalg.norm(K) * np.linalg.norm(Y)
    return float((K * Y).sum() / den) if den > 0 else 0.0


def depolarize(K: np.ndarray, fm: FeatureMap, p2: float) -> np.ndarray:
    """Global depolarising model of the compute-uncompute circuit.

    Each two-qubit gate fails with probability p2; with survival f = (1 - p2)^G the measured fidelity
    is f * k + (1 - f) / 2^n (a fully mixed state hits |0...0> with probability 2^-n).
    """
    G = 2 * fm.gate_counts()[1]
    f = (1 - p2) ** G
    return f * K + (1 - f) / 2 ** fm.n_qubits


def shot_noise(K: np.ndarray, shots: int, rng: np.random.Generator) -> np.ndarray:
    """Finite-shot estimate: each kernel entry is the frequency of the all-zero outcome over `shots` runs."""
    Kc = np.clip(K, 0, 1)
    est = rng.binomial(shots, Kc) / shots
    if est.shape[0] == est.shape[1] and np.allclose(K, K.T):
        est = np.triu(est, 1) + np.triu(est, 1).T
        np.fill_diagonal(est, 1.0)
    return est


def expressibility(fm: FeatureMap, n_pairs: int = 3000, bins: int = 75, seed: int = 0) -> float:
    """KL divergence of the state-fidelity distribution from the Haar distribution (Sim et al. 2019).

    Lower = more expressive. Inputs are drawn uniformly from the encoder range [-pi, pi].
    """
    rng = np.random.default_rng(seed)
    X = rng.uniform(-np.pi, np.pi, (2 * n_pairs, fm.n_qubits))
    S = states(fm, X)
    F = np.abs(np.sum(S[:n_pairs].conj() * S[n_pairs:], axis=1)) ** 2
    edges = np.linspace(0, 1, bins + 1)
    P, _ = np.histogram(F, edges)
    P = P / P.sum()
    N = 2 ** fm.n_qubits
    Q = (1 - edges[:-1]) ** (N - 1) - (1 - edges[1:]) ** (N - 1)   # Haar: P(F) = (N-1)(1-F)^(N-2)
    m = P > 0
    return float(np.sum(P[m] * np.log(P[m] / np.maximum(Q[m], 1e-300))))


def meyer_wallach(S: np.ndarray, n: int) -> np.ndarray:
    """Meyer-Wallach entanglement Q in [0, 1] for each statevector row of S."""
    psi = S.reshape(len(S), *([2] * n))
    purity = np.zeros(len(S))
    for k in range(n):
        a = np.moveaxis(psi, k + 1, 1).reshape(len(S), 2, -1)
        rho = a @ a.conj().transpose(0, 2, 1)
        purity += np.real(np.einsum("bij,bji->b", rho, rho))
    return 2 * (1 - purity / n)


def entangling_capability(fm: FeatureMap, n: int = 2000, seed: int = 0) -> float:
    rng = np.random.default_rng(seed)
    S = states(fm, rng.uniform(-np.pi, np.pi, (n, fm.n_qubits)))
    return float(meyer_wallach(S, fm.n_qubits).mean())


def concentration(fm: FeatureMap, X: np.ndarray) -> float:
    """Variance of off-diagonal kernel values; exponential decay with qubits signals kernel concentration."""
    S = states(fm, X)
    K = kernel(S, S)
    return float(K[np.triu_indices(len(K), 1)].var())
