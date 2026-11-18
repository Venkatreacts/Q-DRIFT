"""Export the console as a static site (for Vercel or any static host).

    python deploy/export_static.py [--engine https://<user>-<space>.hf.space]

Writes deploy/dist/: the console files plus every GET response the console makes, as api/**/*.json.
With --engine, the Drift lab sends live runs to that server (app/server.py allows cross-origin calls);
without it, live runs are switched off and the saved replays and results still work.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
OUT = Path(__file__).resolve().parent / "dist"
RES = ROOT / "results"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default="", help="base URL of a running app/server.py for live runs")
    a = ap.parse_args()

    from app.server import channels, sparks   # noqa: E402  (reads data/ for channel lengths and previews)

    if OUT.exists():                       # keep .vercel so redeploys go to the same project
        for p in OUT.iterdir():
            if p.name not in (".vercel", ".gitignore", ".env.local"):
                shutil.rmtree(p) if p.is_dir() else p.unlink()
    shutil.copytree(ROOT / "app" / "static", OUT, dirs_exist_ok=True)
    html = (OUT / "index.html").read_text(encoding="utf8")
    tags = '<meta name="qdrift-static" content="1">\n'
    if a.engine:
        tags += f'<meta name="qdrift-engine" content="{a.engine.rstrip("/")}">\n'
    assert "<title>" in html
    (OUT / "index.html").write_text(html.replace("<title>", tags + "<title>", 1), encoding="utf8")

    api = OUT / "api"
    (api / "results").mkdir(parents=True)
    (api / "channels.json").write_text(json.dumps(channels(), separators=(",", ":")), encoding="utf8")
    (api / "sparks.json").write_text(json.dumps(sparks(), separators=(",", ":")), encoding="utf8")
    for p in RES.glob("*.json"):
        shutil.copy(p, api / "results" / p.name)
    (api / "replay").mkdir()
    for p in (RES / "replay").glob("*.json"):
        shutil.copy(p, api / "replay" / p.name)
    n = 0
    for p in (RES / "replay" / "drift").glob("*_*.json"):          # <chan>_<kind>.json  ->  drift/<chan>/<kind>.json
        cid, kind = p.stem.rsplit("_", 1)
        (api / "drift" / cid).mkdir(parents=True, exist_ok=True)
        shutil.copy(p, api / "drift" / cid / f"{kind}.json")
        n += 1
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1e6
    print(f"wrote {OUT} ({size:.0f} MB): {len(list((api / 'replay').glob('*.json')))} replays, {n} drift replays,"
          f" engine {'= ' + a.engine if a.engine else 'off'}")


if __name__ == "__main__":
    main()
