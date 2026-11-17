"""Q-DRIFT demo server: serves the console UI, precomputed results, and live runs of the engine.

    python app/server.py          -> http://127.0.0.1:8050
"""
from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "experiments"))
warnings.filterwarnings("ignore")

from qdrift.data import labels, load_channel        # noqa: E402
from qdrift.drift import inject                     # noqa: E402
from qdrift.metrics import evaluate                 # noqa: E402
from qdrift.stream import ABLATIONS, METHODS, Config, Method, Runner  # noqa: E402
from run_all import _clean, _conv, _replay          # noqa: E402

RES = ROOT / "results"
app = FastAPI(title="Q-DRIFT")
META = labels()


def _file(p: Path):
    if not p.is_file() or RES not in p.resolve().parents:
        raise HTTPException(404, "Result not found. Run experiments/run_all.py first.")
    return FileResponse(p, media_type="application/json")


@app.get("/api/channels")
def channels():
    out = []
    for cid, m in META.items():
        x = np.load(ROOT / "data" / "test" / f"{cid}.npy", mmap_mode="r")
        out.append({"chan": cid, "spacecraft": m["spacecraft"], "anomalies": m["anomaly_sequences"],
                    "classes": m["class"], "length": int(x.shape[0])})
    return out


@app.get("/api/sparks")
def sparks():
    """Every channel's test stream reduced to 160 points, for the dataset overview."""
    out = {}
    for cid in META:
        x = np.load(ROOT / "data" / "test" / f"{cid}.npy", mmap_mode="r")[:, 0]
        idx = np.linspace(0, len(x) - 1, 160).astype(int)
        out[cid] = np.round(np.asarray(x[idx], float), 3).tolist()
    return out


@app.get("/api/results/{name}")
def results(name: str):
    return _file(RES / f"{name}.json")


@app.get("/api/replay/{cid}")
def replay(cid: str):
    return _file(RES / "replay" / f"{cid}.json")


@app.get("/api/drift/{cid}/{kind}")
def drift_replay(cid: str, kind: str):
    return _file(RES / "replay" / "drift" / f"{cid}_{kind}.json")


class RunRequest(BaseModel):
    chan: str
    drift: str = "none"            # none | abrupt | gradual | recurring
    lam: float = 0.1
    n_qubits: int = 6
    shots: int = 0
    p2: float = 0.0


@app.post("/api/run")
def run(req: RunRequest):
    if req.chan not in META:
        raise HTTPException(404, f"Unknown channel {req.chan}")
    if not 2 <= req.n_qubits <= 10:
        raise HTTPException(422, "Choose between 2 and 10 qubits.")
    ch = load_channel(req.chan, META)
    test, t0 = (ch.test, None) if req.drift == "none" else inject(ch, req.drift)
    r = Runner(ch, Config(n_qubits=req.n_qubits, shots=req.shots, p2=req.p2), test)
    methods = {"Q-DRIFT": Method("Q-DRIFT", adapt="reselect", cache=True, lam=req.lam),
               "Static-best QSVM": METHODS["Static-best QSVM"],
               "RBF OCSVM": METHODS["RBF OCSVM"]}
    res = {n: r.run(m) for n, m in methods.items()}
    rep = _replay(ch, res, test, {"drift_kind": req.drift, "t0": t0, "live": True,
                                  "metrics": {n: evaluate(x["alarm"], x["score"], ch.anomalies) for n, x in res.items()}})
    body = json.dumps(_clean(json.loads(json.dumps(rep, default=_conv))), separators=(",", ":"), allow_nan=False)
    del r, res                       # the per-encoding state cache is large; free it before the next run
    return Response(body, media_type="application/json")


app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")

if __name__ == "__main__":
    print("Q-DRIFT console: http://127.0.0.1:8050")
    uvicorn.run(app, host="127.0.0.1", port=8050, log_level="warning")
