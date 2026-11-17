"""Correctness checks for the maths the project rests on. Run: python -m pytest -q"""
import numpy as np
import pytest

from qdrift.adwin import ADWIN
from qdrift.featuremaps import FeatureMap, kernel, library, states
from qdrift.kernels import alignment, depolarize, meyer_wallach, shot_noise
from qdrift.metrics import alarm_events, evaluate

RNG = np.random.default_rng(1)


def test_library_has_18_encodings():
    lib = library(6)
    assert len(lib) == 18 and len({f.key for f in lib}) == 18


@pytest.mark.parametrize("fm", library(4))
def test_kernel_is_valid_fidelity_kernel(fm):
    X = RNG.uniform(-np.pi, np.pi, (25, 4))
    S = states(fm, X)
    assert np.allclose(np.linalg.norm(S, axis=1), 1)            # normalised states
    K = kernel(S, S)
    assert np.allclose(np.diag(K), 1) and np.allclose(K, K.T)    # k(x,x)=1, symmetric
    assert K.min() >= -1e-12 and K.max() <= 1 + 1e-12
    assert np.linalg.eigvalsh(K).min() > -1e-9                   # positive semidefinite


def test_angle_depth1_matches_closed_form():
    # product of RY rotations: k = prod_i cos^2(b (x_i - x'_i) / 2)
    fm = FeatureMap("angle", 0.5, 1, 3)
    x, xp = RNG.uniform(-3, 3, 3), RNG.uniform(-3, 3, 3)
    S = states(fm, np.vstack([x, xp]))
    assert np.isclose(kernel(S[:1], S[1:])[0, 0], np.prod(np.cos(0.5 * (x - xp) / 2) ** 2))


def test_zz_kernel_matches_qiskit():
    """Independent check: our PennyLane ZZ map equals Qiskit's zz_feature_map (linear entanglement)."""
    qiskit = pytest.importorskip("qiskit")
    from qiskit.circuit.library import zz_feature_map
    from qiskit.quantum_info import Statevector
    n, b = 4, 0.5
    fm = FeatureMap("zz", b, 2, n)
    X = RNG.uniform(-np.pi, np.pi, (6, n))
    ours = kernel(states(fm, X), states(fm, X))
    qc = zz_feature_map(n, reps=2, entanglement="linear")
    sv = np.array([Statevector(qc.assign_parameters(b * x)).data for x in X])
    theirs = np.abs(sv.conj() @ sv.T) ** 2
    assert np.allclose(ours, theirs, atol=1e-10)


def test_alignment_perfect_and_bounded():
    y = np.r_[np.ones(5), -np.ones(5)]
    assert np.isclose(alignment(np.outer(y, y), y), 1.0)
    K = np.eye(10)
    assert -1 <= alignment(K, y) <= 1


def test_depolarising_limits():
    fm = FeatureMap("iqp", 1.0, 2, 4)
    K = np.eye(3)
    assert np.allclose(depolarize(K, fm, 0.0), K)
    assert np.allclose(depolarize(K, fm, 1.0), 1 / 16)          # fully mixed -> 2^-n


def test_shot_noise_unbiased():
    K = np.full((40, 40), 0.3)
    est = shot_noise(K, 2000, np.random.default_rng(0))
    assert abs(est[np.triu_indices(40, 1)].mean() - 0.3) < 0.01 and np.allclose(np.diag(est), 1)


def test_meyer_wallach_product_vs_ghz():
    prod = np.zeros(8); prod[0] = 1
    ghz = np.zeros(8); ghz[[0, 7]] = 1 / np.sqrt(2)
    q = meyer_wallach(np.vstack([prod, ghz]).astype(complex), 3)
    assert np.isclose(q[0], 0) and np.isclose(q[1], 1)


def test_adwin_detects_shift_and_not_noise():
    rng = np.random.default_rng(0)
    a = ADWIN(0.002)
    assert not any(a.update(v) for v in rng.uniform(0.3, 0.5, 2000))   # stationary: no alarm
    a = ADWIN(0.002)
    hits = [i for i, v in enumerate(np.r_[rng.uniform(0.3, 0.5, 500), rng.uniform(0.6, 0.8, 500)]) if a.update(v)]
    assert hits and 500 <= hits[0] < 600                                # shift found soon after t=500


def test_event_metrics():
    alarm = np.zeros(1000, bool); alarm[105:110] = True; alarm[700:705] = True
    m = evaluate(alarm, alarm.astype(float), [[100, 200], [400, 450]])
    assert (m["tp"], m["fn"], m["fp"]) == (1, 1, 1) and m["delay"] == 5
    assert alarm_events(alarm) == [(105, 109), (700, 704)]
