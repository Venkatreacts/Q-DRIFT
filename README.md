# Q-DRIFT

**Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry Anomaly Detection**
LLJ 1 Team Task Review, Quantum Machine Learning. Faculty: Dr. M. L. Sworna Kokila.

| Team member | Register number |
|---|---|
| Venkatanathan O R V | RA2411026011163 |
| Mayukh Sarkar | RA2411026011218 |
| Aman Salarpuria | RA2411003012435 |

Spacecraft telemetry changes when a mission switches operating mode or a sensor ages (concept drift), and a fixed anomaly detector then raises false alarms. Q-DRIFT detects the drift online with ADWIN and swaps the encoding of a quantum-kernel one-class SVM from a small library, scoring candidates by kernel-target alignment minus a quantum-cost penalty. It is designed for the NASA SMAP and MSL telemetry benchmark.

Folders 01–05 are the LLJ I proposal; charts there marked as illustration or hypothesis are not experimental results. Folder `06_Implementation` is the LLJ II implementation, and every number in it is measured.

## Live website

https://q-drift-qml.vercel.app

Arrow keys or swipe to move between sheets, `F` for fullscreen, `A` for the abstract.

## What is in this repository

| Folder | Contents |
|---|---|
| `01_Abstract` | Project abstract as `.docx` (editable), `.pdf` (print copy) and the `.html` source |
| `02_Presentation` | `Q-DRIFT_LLJ1_Review_FINAL.pptx` (16 slides, speaker notes included) and `Q-DRIFT_Presentation_Script.md` |
| `03_Website` | `index.html` and the abstract PDF, deployed on Vercel |
| `04_Earlier_Idea_Q-ConformMed` | The first project idea, not used |
| `05_Source_and_Assets` | Photos and `CREDITS.txt`, plus the scripts that generate the slides, website and Word file |
| `06_Implementation` | **LLJ II.** The working Q-DRIFT system: PennyLane engine, experiments on all 81 NASA channels, demo console, tests, report and deck. Start with its `README.md` and `DEMO.md` |

## Rebuilding

- **Website:** `05_Source_and_Assets/source/qdrift2.tpl.html` is the page template and `inject2.js` embeds the photos from `05_Source_and_Assets/images` (needs Node and `sharp`).
- **Slides:** `05_Source_and_Assets/source/build_pptx.js` (needs `pptxgenjs`).
- **Abstract PDF:** open `01_Abstract/Q-DRIFT_Abstract.html` in Edge or Chrome and print to PDF (A4, no headers and footers).
- **Abstract Word file:** `html2json.py` turns the HTML into blocks and `build_docx.js` (needs `docx`) writes the `.docx`; run `fix_docx.py` on the result.

## Image credits

See `05_Source_and_Assets/CREDITS.txt`. All photos are NASA public domain except the IBM photo (CC BY 2.0) and the cryostat render (CC BY 4.0).
