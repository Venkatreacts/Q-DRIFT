"""NASA SMAP/MSL telemetry: loading, windowing and PCA compression to one value per qubit."""
from __future__ import annotations

import ast
import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sklearn.decomposition import PCA

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def labels() -> dict:
    """chan_id -> {spacecraft, anomaly_sequences, class}. P-2 is listed twice in the NASA file; merged."""
    out = {}
    with open(DATA_DIR / "raw" / "labeled_anomalies.csv", newline="") as f:
        for r in csv.DictReader(f):
            seq = ast.literal_eval(r["anomaly_sequences"])
            cls = [c.strip() for c in r["class"].strip("[]").split(",")]
            if r["chan_id"] in out:
                out[r["chan_id"]]["anomaly_sequences"] += seq
                out[r["chan_id"]]["class"] += cls
            else:
                out[r["chan_id"]] = {"spacecraft": r["spacecraft"], "anomaly_sequences": seq, "class": cls}
    return out


@dataclass
class Channel:
    chan_id: str
    spacecraft: str
    train: np.ndarray          # telemetry value (column 0), training segment
    test: np.ndarray           # telemetry value (column 0), test segment
    anomalies: list            # [[start, end], ...] inclusive indices into test
    classes: list

    def point_labels(self) -> np.ndarray:
        y = np.zeros(len(self.test), dtype=bool)
        for s, e in self.anomalies:
            y[s:e + 1] = True
        return y


def load_channel(chan_id: str, meta: dict | None = None) -> Channel:
    row = (labels() if meta is None else meta)[chan_id]
    tr = np.load(DATA_DIR / "train" / f"{chan_id}.npy")[:, 0].astype(float)
    te = np.load(DATA_DIR / "test" / f"{chan_id}.npy")[:, 0].astype(float)
    return Channel(chan_id, row["spacecraft"], tr, te, row["anomaly_sequences"], row["class"])


def windows(series: np.ndarray, w: int) -> np.ndarray:
    """All length-w sliding windows; row t ends at series[t + w - 1]."""
    return np.lib.stride_tricks.sliding_window_view(series, w).copy()


class Encoder:
    """z-normalise on the training segment, then PCA to n_qubits values scaled to about [-pi, pi]."""

    def __init__(self, n_qubits: int = 6, w: int = 64):
        self.n, self.w = n_qubits, w

    def fit(self, train: np.ndarray) -> "Encoder":
        self.mu, self.sd = train.mean(), train.std() + 1e-8
        W = windows((train - self.mu) / self.sd, self.w)
        self.pca = PCA(self.n).fit(W)
        Z = self.pca.transform(W)
        self.zsd = Z.std(0) + 1e-8
        return self

    def raw_windows(self, series: np.ndarray) -> np.ndarray:
        return windows((series - self.mu) / self.sd, self.w)

    def from_windows(self, W: np.ndarray) -> np.ndarray:
        # 3 standard deviations map to pi; clip keeps far outliers on the Bloch sphere's edge
        return np.clip(self.pca.transform(W) / self.zsd, -3, 3) * (np.pi / 3)

    def transform(self, series: np.ndarray) -> np.ndarray:
        return self.from_windows(self.raw_windows(series))


def stream_features(ch: Channel, enc: Encoder) -> np.ndarray:
    """One feature vector per test time step: the window ending at that step (history from train tail)."""
    full = np.concatenate([ch.train[-(enc.w - 1):], ch.test])
    return enc.transform(full)
