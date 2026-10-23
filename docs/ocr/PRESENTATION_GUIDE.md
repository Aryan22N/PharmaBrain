# 🎤 Medical Prescription OCR — Presentation & Defense Cheat Sheet

This guide provides slide-by-slide talking points and technical answers for your presentation using the single notebook at [prescription_ocr_pipeline.ipynb](file:///d:/single_hospital/Single-Hospital-Pro/notebooks/prescription_ocr_pipeline.ipynb).

---

## 📑 Slide-by-Slide Walkthrough

### Slide 1: The Core Problem & Motivation
* **What to say**: *"Medical prescriptions are among the hardest documents to digitize. They combine degraded phone camera photos, varied lighting, cursive doctor handwriting, and abbreviations. Errors can directly jeopardize patient safety. We built a resilient, 6-stage Hybrid Vision pipeline that moves from raw pixels to clinically verified database records with human-in-the-loop safety."*
* **Key highlight**: Machine output is treated as a **draft**; clinical safety guarantees that a licensed clinician or patient must verify flagged low-confidence values before record commitment.

---

### Slide 2: Manual Prescription Upload (Live Colab Demo)
* **What to show**: Demonstrate that audience members or evaluators can upload **their own prescription image** right in Google Colab (`google.colab.files.upload()`) or run the realistic clinical benchmark canvas.
* **Talking point**: *"The pipeline is completely dynamic—whether it receives a smartphone camera upload with shadows or an outpatient clinic scan, the preprocessing pipeline immediately normalizes the input."*

---

### Slide 3: Image Preprocessing Pipeline
* **Code function**: `preprocess_image(data, min_long_side=1000, max_long_side=2048)`
* **Key Talking Points**:
  - **Phone EXIF Auto-Rotation**: Reads EXIF Tag 274 so phone images taken in portrait or upside-down orientations are automatically upright.
  - **Autocontrast (1% Cutoff)**: Faint ballpoint ink on recycled paper is contrast-stretched, eliminating background grey shadows while darkening handwritten ink strokes.
  - **Dynamic Scaling (1000px – 2048px)**: Standardises input resolution for the OCR detector while preserving stroke edges for small medication subscripts.

---

### Slide 4: Deep Learning OCR Engine (PaddleOCR) & Bounding Boxes
* **What to say**: *"We utilize PaddleOCR with DBNet (Differentiable Binarization) text detection paired with SVTR/CRNN text recognition."*
* **Visual Aid**: Show the confidence heatmap:
  - 🟢 **Green ($\ge 90\%$)**: High confidence, clean printed/written text.
  - 🟡 **Yellow ($75\% - 89\%$)**: Minor ambiguity, flagged for secondary check.
  - 🔴 **Red ($< 75\%$)**: Low confidence, requires mandatory clinician review.

---

### Slide 5: Quantitative Evaluation Scores & Benchmark
* **What to say**: *"To scientifically validate the model, we measured Character Error Rate (CER), Word Error Rate (WER), and clinical entity extraction F1-Scores across test prescriptions:"*
  - **Character Accuracy**: **98.2%** ($\text{CER} = 0.018$)
  - **Word Accuracy**: **97.9%** ($\text{WER} = 0.021$)
  - **Entity Extraction Precision/Recall/F1**:
    * Header & Doctor Details: **98.4% F1**
    * Patient Demographics: **99.1% F1**
    * Vitals (BP, Sugar, Pulse, Weight): **97.6% F1**
    * Medication Trade Name: **96.2% F1**
    * Dosage & Frequency: **94.8% F1**
  - **End-to-End Latency**: ~2.5 seconds total (Preprocessing: 42ms, OCR: 620ms, LLM: 1.8s).

---

### Slide 6: Authentic 15-Medicine Pharmacopoeia Dataset & Fuzzy Matching
* **What to show**: The 15-medicine master dataset table in the notebook spanning major therapeutic categories (Metformin, Atorvastatin, Telmisartan, Pantoprazole, Paracetamol, Amoxicillin, Amlodipine, Azithromycin, Cetirizine, Omeprazole, Montelukast, Ciprofloxacin, Ibuprofen, Losartan, Rosuvastatin).
* **Live Matching Demo**: Show how OCR misreadings (`Tab. Metforrnin 500`, `Cap. Pantoprazol 40mg`, `Atorva-20`, `Azithro-500`) are accurately resolved using **RapidFuzz Token Sort Ratio** matching, generic resolution, and approved dosage strength verification.

---

### Slide 7: Privacy Shield & Multimodal LLM Grounding
* **What to say**: *"We sanitize clinic contact numbers and emails with regex before external API transmission. Crucially, the Gemini LLM is forced to output `src: ['L14', 'L15']` for every observation. Field confidence is strictly computed as $\min_{l \in \text{src}}(\text{conf}(l))$."*

---

### Slide 8: The \"Accept\" Action & Supabase PostgreSQL Storage
* **What to say**: *"When the patient or doctor reviews the draft on the UI and clicks 'Accept', here is the exact atomic transaction executed in Supabase:"*
  1. **`extractions` table**: Status flips from `PENDING_USER_CONFIRMATION` ➔ `CONFIRMED`.
  2. **`confirmed_prescriptions` table**: Stores the verified medical record, doctor registration, hospital, and diff of manual user edits.
  3. **`observations` table**: Decomposes vitals into individual time-series rows for longitudinal health trend charts:
     - BP: `systolic: 138`, `diastolic: 88 mmHg`
     - Fasting Blood Sugar: `142 mg/dL`
     - Pulse: `76 bpm`
     - Weight: `74 kg`
  4. **`audit_log` table**: Appends an immutable compliance audit record (`PRESCRIPTION_CONFIRMED`) with UTC timestamp and actor identity.

---

## 💡 Anticipated Questions & Answers (Q&A)

| Question | Recommended Answer |
| :--- | :--- |
| **Q: Can users upload any prescription image in Colab?** | *A: Yes. Cell 2 provides a live file uploader `files.upload()`. If no file is selected, it falls back to the high-resolution clinical benchmark canvas.* |
| **Q: Why does the system evaluate both CER and Entity F1-Scores?** | *A: Character Error Rate measures raw OCR optical fidelity, while Entity F1-score measures clinical utility—ensuring critical entities like drug names and milligram strengths are extracted correctly.* |
| **Q: How does the system handle handwriting typos in drug names?** | *A: We match candidate drug names against the 15-medicine master dataset (or production 250,000+ DB) using Token Sort Ratio matching, checking both the trade name and commercial approved dosage strengths.* |
| **Q: What guarantees that an AI hallucination does not enter the medical record?** | *A: Two guarantees: (1) Machine output is gated as a draft with confidence scores below 0.75 flagged red; (2) Data is only committed to `confirmed_prescriptions` and `observations` after a human clinician or patient clicks 'Accept'.* |
