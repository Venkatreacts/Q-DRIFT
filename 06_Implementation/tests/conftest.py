import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import qdrift  # noqa: E402,F401  (applies the pyarrow guard before sklearn loads)
