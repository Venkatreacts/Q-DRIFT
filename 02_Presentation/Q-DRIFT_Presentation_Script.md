# Q-DRIFT presentation script

Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry Anomaly Detection
LLJ 1 Team Task Review. Faculty: Dr. M. L. Sworna Kokila. About 13 minutes.

| Speaker | Name | Register number | Slides |
|---|---|---|---|
| 1 | Venkatanathan O R V | RA2411026011163 | 1 to 5 |
| 2 | Mayukh Sarkar | RA2411026011218 | 6 to 10 |
| 3 | Aman Salarpuria | RA2411003012435 | 11 to 16 |

Text in *[brackets]* is a cue for where to point or pause, not a line to say.

---

## Slide 1: Title (Venkatanathan, about 1 min 30 s)

*(Walk up. Don't greet. Look at the audience for 2 seconds, then speak slowly, like reading a log.)*

"2:47 AM. Mission control, NASA Jet Propulsion Laboratory, California.

685 kilometres above the Earth, a satellite is crossing into darkness.

2:49. An alarm. *Anomaly detected.* The engineer on duty checks it. Everything is fine. She clears it.

2:53. Another alarm. Fine.

3:10. Alarm. Fine.

By 4:30 she has cleared thirty-seven alarms, and every single one was false.

So she does what any of us would do. She mutes it.

*(pause)*

4:31. Alarm number thirty-eight.

This one is real.

And nobody is looking.

*(longer pause)*

That's the alarm that ends missions. And this isn't just a story. In July 2015, only months after launch, the radar on NASA's SMAP satellite went silent, and it never came back.

Here's the twist. The spacecraft wasn't confused. The AI was. The satellite had simply moved into a new phase of its orbit, and the AI was still judging it by yesterday's idea of normal.

So we asked one question: what if the AI could notice that the world had changed, and change the way it sees in seconds, without anyone retraining it? And what if it did that using quantum computing?

*(Now smile and greet.)*

Good morning, respected faculty. I'm Venkatanathan, with Mayukh and Aman. This is our project: **Q-DRIFT, Drift-Aware Quantum Kernel Adaptation for Spacecraft Telemetry Anomaly Detection.**

I'll walk you through the problem, Mayukh will show you our method, and Aman will show you how we'll prove it works."

---

## Slide 2: Spacecraft talk through telemetry (Venkatanathan, about 1 min)

"So how does a spacecraft tell us it's in trouble? Through telemetry.

*[Point to the photos]* These are two real NASA missions. On the left, SMAP, orbiting Earth and measuring soil moisture. On the right, the Curiosity rover, driving on Mars since 2012.

Every second, they send home a stream of sensor readings: temperatures, battery levels, position, and the commands they're running. That stream is telemetry.

NASA's Jet Propulsion Laboratory released real data from these two missions: 82 sensor channels and 105 anomalies, labelled by experts from real incident reports. It was published by Hundman and colleagues at KDD in 2018.

No toy data. These are real faults from real spacecraft, and they're exactly what we'll use."

---

## Slide 3: The problem: "normal" keeps changing (Venkatanathan, about 1 min 15 s)

"Remember those thirty-seven false alarms? This slide shows exactly why they happen.

*[Point to the chart]* This line is one sensor. On the left, the AI learns what normal looks like: the blue band.

Then, at the orange line, the spacecraft changes mode. Maybe an instrument switches on, or it enters Earth's shadow. The readings jump to a new level. For the spacecraft, that's perfectly normal. But the AI still believes the old band, so it cries false alarm, again and again, while the real fault, circled in red, gets buried.

This is called **concept drift**: the data itself changes over time. It comes in three forms:
- **abrupt**: a sudden new mode
- **gradual**: a sensor slowly ageing
- **recurring**: day and night, on every single orbit

In simple words, when normal changes, an old model either cries wolf or misses the real wolf."

---

## Slide 4: Quantum kernels in 60 seconds (Venkatanathan, about 1 min 15 s)

"Our model uses quantum machine learning, specifically a quantum kernel. No heavy maths, I promise.

*[Point to the dots]* On the left, normal readings in blue and abnormal readings in red are tangled together. No straight line can separate them.

A quantum feature map is a small quantum circuit that lifts these readings into a huge quantum space. There, the tangle comes apart, and a simple line separates them.

The kernel is a similarity score: how alike are two readings in that quantum space? A Quantum Support Vector Machine then draws a boundary around normal. Anything outside it is an anomaly.

And here's the key insight: the way you encode the data, the feature map, decides almost everything. Yet today, everyone picks that encoding once, and never changes it again."

---

## Slide 5: What others built, and the missing piece (Venkatanathan, about 1 min)

"We studied the research and asked every paper five questions. Is it quantum? Is it tested on real spacecraft? Does it detect anomalies? Does it adapt to drift? Does it count the quantum cost?

- NASA's own LSTM method works on this exact data, but it's classical and only adjusts thresholds.
- Quantum one-class SVMs from 2024 detect anomalies, but not on spacecraft data, and they never adapt.
- Quantum autoencoders are the same story.
- Research on tuning quantum kernels shows the encoding matters, but they tune it once, offline.
- Drift detectors like ADWIN notice change, but they aren't quantum and don't fix anything.

*[Point to the highlighted row]* Every piece exists separately. To our knowledge, nobody has put them together.

Mayukh will show you how we do."

---

## Slide 6: Our idea in one picture (Mayukh, about 1 min)

"Thank you, Venkatanathan.

Think about your phone camera. When you walk from bright sunlight into a dark room, you don't buy a new phone; the camera switches mode. That's our whole idea.

*[Top lane]* A normal quantum model picks its encoding once. Mode A, it works. Drift hits. Mode B: false alarms, missed faults.

*[Bottom lane]* Q-DRIFT watches for drift. The moment it detects one, it tests a few alternative encodings on the newest data and switches to the best one. Mode B, and it works again.

No retraining from scratch. **Swap the encoding, keep the model.**"

---

## Slide 7: Our novelty (Mayukh, about 1 min)

"So what's new? Three things.

**One, drift-triggered re-encoding.** The quantum feature map is re-chosen online, every time drift is detected. Existing work fixes it once at training time.

**Two, real spacecraft data.** To our knowledge, quantum models have never been tested on NASA's SMAP and MSL telemetry.

**Three, resource-aware adaptation.** Quantum computing time is expensive, so every switch is charged for its circuit runs, and we balance accuracy against that cost.

This isn't just 'quantum ML on a new dataset'. It's a new **adaptive mechanism** for quantum models."

---

## Slide 8: The Q-DRIFT system (Mayukh, about 1 min 30 s)

"Here's the full system. Top row, left to right:

1. Telemetry streams in from SMAP or Curiosity.
2. We take a window of recent readings and compress it with PCA to 4 to 8 numbers, one per qubit.
3. The quantum one-class SVM scores how unusual that window is.
4. If the score crosses the threshold, an alarm goes to the mission team.

Now the clever part, the bottom row.

5. A drift detector called ADWIN watches the stream of scores. When their average suddenly shifts, it raises a flag: the world has changed.
6. The controller tests encodings from our library and swaps the best one into the quantum model. That's the violet arrow.

The library is small and fixed: angle, ZZ and IQP encodings, each at a few bandwidths and depths."

---

## Slide 9: How the controller picks (Mayukh, about 1 min)

"How does it choose? Three steps.

1. Take the newest data after the drift.
2. Score every candidate with **kernel-target alignment**, which simply asks: does this encoding keep normal readings close together and unusual ones far apart? It's cheap, with no full training.
3. Subtract a penalty for how many quantum circuit runs that encoding needs.

*[Point to the bars]* In this illustration, not real results, ZZ at bandwidth 0.5 wins. The formula is exactly that rule: best quality minus lambda times cost."

---

## Slide 10: Detect, test, switch (Mayukh, about 1 min)

"Here's how it plays out over time. This line is the anomaly score.

1. *[Orange]* Drift starts. With the old encoding, scores shoot past the alarm line.
2. *[Red]* ADWIN detects the shift.
3. *[Shaded region]* The controller tests encodings on this fresh data.
4. *[Green]* It switches, and the scores drop back to normal.

And for recurring drift, like day and night, Q-DRIFT **remembers** which encoding worked for each mode, so next time it switches instantly.

Aman will now show you how we'll prove all of this."

---

## Slide 11: How we will test it (Aman, about 1 min)

"Thank you, Mayukh. An idea is only as good as its proof, so here's our plan.

- **Data:** the real NASA benchmark. SMAP has 55 channels and 69 anomaly sequences, and Curiosity has 27 channels and 36. We process it strictly in time order, so the model never sees the future.
- **Drift:** natural mode changes, plus abrupt, gradual and recurring drift that we inject at known times, so we can measure exactly how fast we react.
- **Fair opponents:** a fixed quantum SVM, a quantum SVM tuned once offline, a classical SVM, and an online classical model. If classical wins, we'll say so honestly.
- **Tools:** PennyLane or Qiskit, scikit-learn, and the river library for ADWIN."

---

## Slide 12: How we will measure success (Aman, about 1 min)

"We don't judge by accuracy alone. We measure four things:

1. **Event-level F1:** did we catch whole fault events?
2. **False alarms:** remember that engineer at 4:30 AM? Every false alarm costs trust.
3. **Detection delay and recovery time:** how fast we notice drift, and how fast we bounce back.
4. **Circuit evaluations:** the quantum cost of adapting.

*[Point to the chart]* This chart is our hypothesis, not results. Drift hits at window 4. The fixed model falls and stays down. Q-DRIFT falls, then recovers within a few windows. Proving this is the core experiment of our project."

---

## Slide 13: Known challenges, and our plan (Aman, about 1 min)

"We also want to be honest about the weak spots.

1. **Benchmark flaws.** Wu and Keogh showed that some anomaly benchmarks, including this one, have labelling issues and scoring tricks that inflate results. So we use strict event-level scoring.
2. **Quantum kernels can flatten.** With too many qubits, every similarity value looks the same. We stay at 4 to 8 qubits and tune the bandwidth.
3. **Kernels get expensive.** Every pair of samples needs a circuit run, so we use sliding windows and count every evaluation.
4. **No promised speed-up.** We don't claim quantum beats classical. Our contribution is the adaptation mechanism."

---

## Slide 14: Why it matters (Aman, about 45 s)

"So who benefits?

- **Mission teams:** fewer false alarms, so the real one gets noticed.
- **Satellite fleets:** thousands of satellites, all constantly changing modes. Fixed models can't keep up.
- **Quantum ML research:** a first step toward quantum models that keep learning after deployment.
- **Beyond space:** power grids, factories and hospital monitors. Anywhere normal changes, this applies."

---

## Slide 15: References (Aman, about 15 s)

"These are our key references: the NASA JPL benchmark, quantum one-class SVMs, research on tuning quantum kernels, the ADWIN drift detector, and the benchmark critique that shaped how we evaluate."

---

## Slide 16: Conclusion (Aman, about 1 min)

"Let's go back to 4:31 AM. Alarm number thirty-eight.

It was missed because the AI was watching a spacecraft that had changed, with eyes that hadn't.

Q-DRIFT gives it new eyes:
- It **detects** when normal has changed.
- It **adapts** by swapping its quantum encoding, without retraining from scratch.
- It **stays affordable** by counting the quantum cost of every switch.

So the next time an alarm flashes at 4:31 in the morning, someone will trust it.

*(pause)*

Thank you. We're happy to take your questions."

---

## If the faculty asks

- **"Why quantum, if classical might be just as accurate?"** We're not claiming quantum is more accurate. Quantum kernels depend heavily on their encoding, and nobody has made that encoding adapt after deployment. That mechanism is our contribution.
- **"Isn't this just retraining?"** No. We keep the whole pipeline and only switch the encoding from a small library, using a cheap score. We'll also measure how much cheaper it is.
- **"How do you detect drift?"** ADWIN, a well-known detector with statistical guarantees. We also inject drift at known times to measure the delay exactly.
- **"Real quantum hardware?"** Simulation on 4 to 8 qubits first. If time allows, we'll validate on IBM's free cloud quantum computers.

## Delivery notes

- The 2015 SMAP radar failure is a real event. The 3 AM alarm story is an illustrative scenario. Present it as "imagine this" if a faculty member asks.
- Say the timestamps slowly and leave real silence after "nobody is looking".
- If you need to cut time, shorten slide 15 to one sentence.
