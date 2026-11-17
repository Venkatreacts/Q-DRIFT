# Demo run sheet (LLJ II review)

About 6 minutes. Everything runs on this laptop; no internet needed.

## Before the review

1. Close other heavy programs. The engine needs about 1 GB of free memory.
2. Start the console from the `06_Implementation` folder:

   ```
   python app/server.py
   ```

3. Open http://127.0.0.1:8050 in Edge or Chrome. Press F11 for full screen.
4. Check that the Results page shows tables. If it says "No benchmark yet", run `python experiments/run_all.py` (takes about 40 minutes).

## Script

**1. Mission replay with abrupt drift (2 min).** Open `http://127.0.0.1:8050/#mission/T-1/abrupt`. Set speed to 4× and press **Play**.

- "This is real telemetry from NASA's SMAP satellite, streamed in time order. Red bands are anomalies labelled by NASA engineers."
- When the violet line appears: "Here the operating mode changes. A static detector, the grey line, stays in alarm from now on."
- When the log says *Possible regime change*: "Q-DRIFT does not react immediately. It collects 300 windows and checks whether the current model really finds them abnormal. This stops a single anomaly from triggering a switch."
- When the encodings race: "Now all 18 quantum encodings are scored on the new regime. Each one trains a small model and must flag held-out synthetic faults. The winner, minus its circuit cost, is swapped in."
- Point at the counters: false alarms for Q-DRIFT against the static model, and the number of circuits a quantum processor would have run.

**2. Drift lab, live (2 min).** Open **Drift lab**. Choose channel `M-1`, drift **Recurring modes**, 6 qubits, λ = 0.10, shots *exact*. Press **Run live**.

- "This runs the whole engine now, on this laptop: PennyLane circuits, the SVM, ADWIN, everything."
- Read the table: anomalies caught, false alarms, switches, circuits.
- Press **Open in Mission replay** and press **Show all**. Point at a green log line *reused … from cache, 0 circuits* if one appears: "the mode came back, so the stored model was reused instantly."
- Optional: set shots to 1 024 and run again, to show the effect of finite measurements.

**3. Evidence (2 min).**

- **Results**: the benchmark table on all 81 channels, the Wilcoxon tests, the threshold curve, the drift table.
- **Kernel lab**: switch the heatmap between `IQP b=0.1 d=1`, `IQP b=0.3 d=1` and `ZZ b=1 d=2`. "Too narrow a bandwidth and every window looks the same; too wide and every window looks different. In between, normal windows resemble each other and anomalies stand apart." Then the concentration chart.
- **Encoding library**: the circuits themselves.

## If something goes wrong

- Page blank or "Run failed": the server window shows the error. Restart it with `python app/server.py`.
- A live run is slow: the laptop is short of memory. Use a shorter channel (`M-1`, `T-12`, `M-5`) or the saved replays in Mission replay.
- Port 8050 busy: stop the old server window first.

## Likely questions

**Is this really quantum?** The kernels come from PennyLane circuit simulations. The test suite checks them against Qiskit, an independent library, to 10⁻¹⁰. On hardware, each kernel entry is one compute–uncompute circuit; the console counts how many a processor would run.

**Does quantum beat classical?** Not overall. A well-chosen quantum kernel matches the RBF kernel on event F1 and catches more anomalies, but RBF ranks time steps better (AUC-PR). We do not claim a quantum advantage.

**Then what is the contribution?** The adaptive loop. Under operating-mode changes Q-DRIFT spends far less time in false alarm than a fixed quantum model. Testing also showed that our proposed selection rule (kernel-target alignment) fails because of kernel concentration, and we replaced it.

**Why not run on IBM hardware?** Not yet. The noise study suggests it is feasible: at 0.5–2% two-qubit error and 512 shots, AUC-PR stays within 0.32–0.35. It is the first next step.
