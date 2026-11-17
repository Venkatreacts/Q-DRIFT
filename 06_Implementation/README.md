# Q-DRIFT implementation (LLJ II)

Drift-aware quantum kernel anomaly detection on the NASA SMAP/MSL telemetry benchmark, running entirely on a laptop.

- **Engine** (`qdrift/`): 18 PennyLane encodings (angle, ZZ, IQP × 3 bandwidths × 2 depths), fidelity-kernel one-class SVM, ADWIN drift test, switch validation, encoding selection with a circuit-cost penalty, normal-behaviour reservoir, mode cache.
- **Experiments** (`experiments/run_all.py`): benchmark on all 81 channels, ablations, controlled drift, hardware-noise and qubit-count studies, kernel analysis, Wilcoxon tests.
- **Console** (`app/`): local web app for the demo, with mission replay, live runs with injected drift, results, encoding library and kernel lab.
- **Report and deck** (`experiments/make_report.py`, `deck/build_deck.js`): every number is read from `results/*.json`.
- **Tests** (`tests/`): 27 checks, including a cross-check of our kernels against Qiskit.

## Setup

Python 3.11+ with the packages in `requirements.txt`. Download the data once into `data/`:

```
data/raw/smap_msl.zip            Kaggle mirror: patrickfleith/nasa-anomaly-detection-dataset-smap-msl
data/raw/labeled_anomalies.csv   https://raw.githubusercontent.com/khundman/telemanom/master/labeled_anomalies.csv
```

Then extract `data/data/train/*.npy` and `data/data/test/*.npy` into `data/train/` and `data/test/`.

## Run

```
python -m pytest -q                      # tests
python experiments/run_all.py            # all experiments (about 40 min; QDRIFT_JOBS=1 if memory is short)
python experiments/make_report.py        # report/Q-DRIFT_LLJ2_Report.html
python app/server.py                     # console at http://127.0.0.1:8050
```

Deep links into the console: `#mission/T-1/abrupt` opens a replay, and `#results`, `#kernels` and `#encodings` open those views. See `DEMO.md` for the review run sheet.

## Headline results

See `report/Q-DRIFT_LLJ2_Report.pdf`. In short:
- A selected quantum kernel matches a classical RBF kernel on event-level F1 and catches more anomalies. RBF ranks time steps better (AUC-PR).
- Under injected operating-mode changes, Q-DRIFT spends much less normal time in false alarm than the same quantum model without adaptation.
- On the unmodified streams, adaptation costs precision.
- Kernel-target alignment, the selection rule proposed at LLJ I, prefers concentrated kernels. It was replaced by a held-out fault-detection test.
