"""Q-DRIFT: drift-aware quantum kernel adaptation for spacecraft telemetry anomaly detection."""
import sys

# A half-installed pyarrow (no __init__) makes pandas, and through it scikit-learn, crash on import.
# Hide it so pandas falls back to running without pyarrow.
try:
    import pyarrow
    pyarrow.__version__
except Exception:
    sys.modules["pyarrow"] = None
    try:
        import pandas  # noqa: F401  (now imports without pyarrow)
    except ImportError:
        pass                     # no pandas at all (the deployed engine): nothing to repair
    del sys.modules["pyarrow"]   # scikit-learn probes sys.modules["pyarrow"] and expects a real module or none
