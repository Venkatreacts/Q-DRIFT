"""Upload the engine and console to a Hugging Face Docker Space.

    pip install huggingface_hub
    hf auth login                      # a token with write access
    python deploy/hf_space.py [--space <user>/qdrift]

The Space builds deploy/space/Dockerfile and serves app/server.py on port 7860, with the NASA data
and saved results, so live runs work there. Its URL is https://<user>-<name>.hf.space.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent
SPACE = Path(__file__).resolve().parent / "space"
KEEP = ["qdrift/*.py", "app/server.py", "app/static/**", "experiments/run_all.py", "results/**",
        "data/train/*.npy", "data/test/*.npy", "data/raw/labeled_anomalies.csv"]


def main():
    api = HfApi()
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", default=f"{api.whoami()['name']}/qdrift")
    a = ap.parse_args()
    api.create_repo(a.space, repo_type="space", space_sdk="docker", exist_ok=True)
    api.upload_folder(repo_id=a.space, repo_type="space", folder_path=ROOT, allow_patterns=KEEP,
                      commit_message="Q-DRIFT engine, console, data and results")
    api.upload_folder(repo_id=a.space, repo_type="space", folder_path=SPACE, commit_message="Docker setup")
    user, name = a.space.split("/")
    print(f"Space: https://huggingface.co/spaces/{a.space}")
    print(f"App:   https://{user.lower()}-{name.lower()}.hf.space   (first build takes a few minutes)")


if __name__ == "__main__":
    main()
