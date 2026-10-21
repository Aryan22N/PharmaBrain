/**
 * Clinical reference dictionary providing authoritative descriptions, mechanisms of action,
 * and therapeutic indications for medications, conditions, and allergens.
 */

export interface MedicationInfo {
  drugClass: string;
  mechanism: string;
  indications: string;
  precautions: string;
}

export interface ConditionInfo {
  overview: string;
  clinicalImpact: string;
  management: string;
}

export interface AllergyInfo {
  allergenClass: string;
  reactionProfile: string;
  precautions: string;
}

const MEDICATION_DICTIONARY: Record<string, MedicationInfo> = {
  loperamide: {
    drugClass: "Synthetic Opioid / Antidiarrheal Agent",
    mechanism: "Acts directly on circular and longitudinal intestinal muscles through opioid receptors in the gut wall, slowing peristalsis and prolonging gastrointestinal transit time while enhancing fluid and electrolyte reabsorption.",
    indications: "Symptomatic control and relief of acute nonspecific diarrhea and chronic diarrhea associated with inflammatory bowel disease (IBD). Also used for reducing ileostomy volume discharge.",
    precautions: "Contraindicated in children under 2 years, acute ulcerative colitis, or diarrhea associated with bacterial enteritis. Discontinue if abdominal distension occurs.",
  },
  pantoprazole: {
    drugClass: "Proton Pump Inhibitor (PPI)",
    mechanism: "Irreversibly inhibits the gastric H+/K+-ATPase proton pump on the secretory surface of parietal cells, effectively blocking the final step of gastric acid secretion.",
    indications: "Short-term and maintenance treatment of Gastroesophageal Reflux Disease (GERD), erosive esophagitis, gastric and duodenal ulcers, and pathological hypersecretory conditions (Zollinger-Ellison syndrome).",
    precautions: "Take 30-60 minutes before breakfast. Prolonged use may require monitoring of magnesium, calcium, and vitamin B12 levels.",
  },
  paracetamol: {
    drugClass: "Non-Opioid Analgesic & Antipyretic",
    mechanism: "Centrally inhibits cyclooxygenase (COX-3 / COX variants) in the central nervous system, reducing prostaglandin synthesis in the brain while modulating descending serotonergic inhibitory pathways. Has negligible peripheral anti-inflammatory activity.",
    indications: "First-line management for mild-to-moderate pain (headache, musculoskeletal pain, post-operative discomfort) and reduction of fever.",
    precautions: "Do not exceed maximum daily dosage of 4,000 mg (4 g) across all products. Use with caution in patients with hepatic impairment or chronic alcohol intake.",
  },
  acetaminophen: {
    drugClass: "Non-Opioid Analgesic & Antipyretic",
    mechanism: "Inhibits central prostaglandin synthesis to elevate pain thresholds and reset hypothalamic thermoregulatory centers.",
    indications: "Symptomatic treatment of acute headache, arthralgia, myalgia, dysmenorrhea, and febrile conditions.",
    precautions: "Monitor total daily cumulative dose to avoid hepatotoxicity. Caution in chronic liver disease.",
  },
  "ors (oral rehydration salts)": {
    drugClass: "Oral Electrolyte & Fluid Replacement",
    mechanism: "Exploits the intestinal sodium-glucose cotransporter (SGLT1) in the brush border membrane, where glucose facilitates active sodium and secondary water reabsorption regardless of secretory diarrhea.",
    indications: "Prevention and rapid correction of dehydration, electrolyte deficit, and metabolic acidosis secondary to acute diarrheal illnesses, gastroenteritis, or excessive fluid loss.",
    precautions: "Reconstitute with correct volume of potable water. Do not boil solution after reconstitution. Use within 24 hours.",
  },
  ors: {
    drugClass: "Oral Electrolyte & Fluid Replacement",
    mechanism: "Glucose-mediated active sodium and water absorption across the small bowel mucosal barrier.",
    indications: "Correction of mild-to-moderate dehydration due to diarrhea, vomiting, or excessive perspiration.",
    precautions: "Ensure accurate dilution in designated water volume to avoid hypernatremia or osmotic exacerbation.",
  },
  aceclofenac: {
    drugClass: "NSAID (Phenylacetic Acid Derivative)",
    mechanism: "Inhibits cyclooxygenase (COX-1 and COX-2) enzymes, suppressing prostaglandin E2 production and down-regulating inflammatory cytokines like IL-1beta and TNF-alpha.",
    indications: "Relief of pain and inflammation in osteoarthritis, rheumatoid arthritis, ankylosing spondylitis, and acute dental or musculoskeletal pain.",
    precautions: "Should be taken with or after food. Co-prescribe with gastroprotective agent (PPI) in patients with prior peptic ulcer disease.",
  },
  thiocolchicoside: {
    drugClass: "Centrally Acting Muscle Relaxant / Glycinergic Agonist",
    mechanism: "Selective agonist at GABA-A and strychnine-sensitive glycine receptors in the spinal cord, producing muscle relaxation without sedative depression.",
    indications: "Adjuvant treatment of painful acute contractures in spinal, orthopedic, and musculoskeletal disorders.",
    precautions: "Avoid long-term administration. Not recommended during pregnancy, lactation, or in patients prone to seizure disorders.",
  },
  amoxicillin: {
    drugClass: "Aminopenicillin Beta-Lactam Antibiotic",
    mechanism: "Binds to penicillin-binding proteins (PBPs), inhibiting bacterial peptidoglycan cell wall synthesis and causing osmotic lysis of susceptible bacteria.",
    indications: "Infections of the upper and lower respiratory tract, otitis media, urinary tract infections, and Helicobacter pylori eradication.",
    precautions: "Contraindicated in true penicillin-allergic patients. Complete full course to prevent antimicrobial resistance.",
  },
  azithromycin: {
    drugClass: "Macrolide Antibiotic",
    mechanism: "Reversibly binds to the 50S ribosomal subunit of susceptible microorganisms, inhibiting RNA-dependent protein synthesis.",
    indications: "Community-acquired pneumonia, acute bacterial exacerbations of COPD, chlamydial infections, and atypical mycobacterial prophylaxis.",
    precautions: "Monitor for QT prolongation in high-risk patients. Take 1 hour before or 2 hours after meals.",
  },
  metformin: {
    drugClass: "Biguanide Antihyperglycemic",
    mechanism: "Decreases hepatic gluconeogenesis, decreases intestinal absorption of glucose, and improves insulin sensitivity by increasing peripheral glucose uptake and utilization via AMP-activated protein kinase (AMPK).",
    indications: "First-line oral pharmacotherapy for Type 2 Diabetes Mellitus in adults and children >= 10 years of age.",
    precautions: "Take with meals to minimize gastrointestinal discomfort. Monitor eGFR; temporarily hold prior to iodinated contrast procedures.",
  },
  amlodipine: {
    drugClass: "Dihydropyridine Calcium Channel Blocker",
    mechanism: "Inhibits transmembrane influx of calcium ions into vascular smooth muscle and cardiac muscle, causing peripheral arterial vasodilation and decreased systemic vascular resistance.",
    indications: "Essential hypertension and chronic stable or vasospastic angina pectoris.",
    precautions: "Monitor for peripheral edema and dizziness. Dose reduction may be indicated in severe hepatic impairment.",
  },
  telmisartan: {
    drugClass: "Angiotensin II Receptor Blocker (ARB)",
    mechanism: "Selectively blocks the binding of angiotensin II to AT1 receptors in vascular smooth muscle and adrenal glands, inducing vasodilation and reducing aldosterone secretion.",
    indications: "Essential hypertension and cardiovascular risk reduction in patients unable to tolerate ACE inhibitors.",
    precautions: "Contraindicated in pregnancy (fetal toxicity). Monitor serum potassium and renal function periodically.",
  },
  atorvastatin: {
    drugClass: "HMG-CoA Reductase Inhibitor (Statin)",
    mechanism: "Competitively inhibits 3-hydroxy-3-methylglutaryl-coenzyme A reductase, the rate-limiting step in cholesterol biosynthesis, up-regulating hepatic LDL receptors.",
    indications: "Primary and secondary prevention of atherosclerotic cardiovascular events; primary hypercholesterolemia and mixed dyslipidemia.",
    precautions: "Take at bedtime or evening. Monitor liver enzymes periodically and report unexplained muscle pain or weakness.",
  },
};

const CONDITION_DICTIONARY: Record<string, ConditionInfo> = {
  hypertension: {
    overview: "Chronic cardiovascular condition characterized by persistently elevated systemic arterial blood pressure exceeding 130/80 mmHg (AHA/ACC 2017 Guideline criteria).",
    clinicalImpact: "Accelerates arterial atherosclerosis, increases left ventricular afterload, and predisposes to myocardial infarction, stroke, heart failure, and chronic kidney disease.",
    management: "Target blood pressure < 130/80 mmHg through dietary sodium restriction (DASH diet), regular aerobic exercise, stress reduction, and guideline-directed pharmacotherapy.",
  },
  "essential hypertension": {
    overview: "Primary hypertension with multifactorial genetic, environmental, and neurohormonal etiologies in the absence of an identifiable secondary cause.",
    clinicalImpact: "Major modifiable risk factor for cerebrovascular accidents, coronary artery disease, and hypertensive nephrosclerosis.",
    management: "Combination antihypertensive therapy (e.g. ARB/ACEi + DHP-CCB or thiazide-like diuretic) combined with home blood pressure monitoring.",
  },
  diabetes: {
    overview: "Metabolic disorder characterized by persistent hyperglycemia resulting from progressive insulin secretion deficiency on a background of insulin resistance (ADA 2024 Standards of Care).",
    clinicalImpact: "Predisposes to microvascular complications (diabetic retinopathy, nephropathy, peripheral neuropathy) and macrovascular atherosclerotic events.",
    management: "Individualized HbA1c target (< 7.0%), structured carbohydrate moderation, continuous glucose monitoring, and organ-protective pharmacotherapy.",
  },
  "type 2 diabetes": {
    overview: "Progressive metabolic syndrome driven by peripheral insulin resistance and subsequent pancreatic beta-cell decompensation.",
    clinicalImpact: "Elevated risk of cardiovascular mortality, diabetic kidney disease, peripheral arterial disease, and sensory neuropathy.",
    management: "First-line metformin, sodium-glucose cotransporter-2 (SGLT2) inhibitors or GLP-1 receptor agonists, medical nutrition therapy, and regular retinal/podiatric screening.",
  },
  gerd: {
    overview: "Gastroesophageal Reflux Disease; retrograde flow of acidic gastroduodenal contents into the esophagus causing mucosal inflammation and troublesome symptoms.",
    clinicalImpact: "Chronic erosive esophagitis, stricture formation, Barrett's esophagus, and chronic nocturnal cough or laryngitis.",
    management: "Acid suppression with proton pump inhibitors (PPIs) or H2-receptor antagonists, weight loss, avoidance of late meals, and head-of-bed elevation.",
  },
  gastritis: {
    overview: "Inflammation, irritation, or erosion of the gastric mucosal lining caused by acid hypersecretion, H. pylori infection, NSAID toxicity, or stress.",
    clinicalImpact: "Epigastric burning, nausea, postprandial dyspepsia, and potential progression to peptic ulceration or upper gastrointestinal bleeding.",
    management: "Short-course proton pump inhibitor therapy, eradication of H. pylori if confirmed, elimination of mucosal irritants (NSAIDs, alcohol, spicy foods).",
  },
  asthma: {
    overview: "Chronic inflammatory disorder of the tracheobronchial tree characterized by episodic airflow obstruction, bronchial hyperresponsiveness, and variable symptoms.",
    clinicalImpact: "Exacerbations leading to acute respiratory distress, hypoxemia, sleep disturbance, and limitation of physical activity.",
    management: "Stepwise management using inhaled corticosteroids (ICS) combined with long-acting beta2-agonists (LABA), allergen avoidance, and peak flow monitoring.",
  },
  hypothyroidism: {
    overview: "Endocrine disorder resulting from insufficient synthesis and secretion of thyroid hormones (free T4 and T3) by the thyroid gland.",
    clinicalImpact: "Systemic metabolic deceleration leading to fatigue, weight gain, bradycardia, cold intolerance, constipation, and hypercholesterolemia.",
    management: "Levothyroxine monotherapy with periodic serum TSH titration to achieve euthyroid reference levels (0.5 - 4.5 mIU/L).",
  },
  dyslipidemia: {
    overview: "Disorder of lipoprotein metabolism characterized by elevated low-density lipoprotein cholesterol (LDL-C), hypertriglyceridemia, or reduced HDL-C.",
    clinicalImpact: "Key driver of vascular endothelial dysfunction and coronary, cerebral, and peripheral atherosclerosis.",
    management: "Moderate-to-high intensity statin therapy, dietary saturated fat restriction, and surveillance of fasting lipid panels.",
  },
};

const ALLERGY_DICTIONARY: Record<string, AllergyInfo> = {
  penicillin: {
    allergenClass: "Beta-Lactam Antibacterial Class",
    reactionProfile: "IgE-mediated Type I hypersensitivity (urticaria, angioedema, bronchospasm, anaphylaxis) or T-cell mediated delayed maculopapular rash.",
    precautions: "Strictly avoid all penicillin derivatives (amoxicillin, ampicillin, piperacillin). Exercise caution with first-generation cephalosporins.",
  },
  aceclofenac: {
    allergenClass: "Non-Steroidal Anti-Inflammatory Drug (NSAID)",
    reactionProfile: "Cross-reactive or selective cyclooxygenase-1 (COX-1) mediated pseudoallergic reaction (urticaria, angioedema, bronchospasm, or cutaneous drug eruption).",
    precautions: "Exercise extreme vigilance with other NSAIDs (ibuprofen, diclofenac, naproxen). Consider paracetamol in lower doses or selective COX-2 inhibitors under medical supervision.",
  },
  paracetamol: {
    allergenClass: "Aniline Analgesic / Antipyretic",
    reactionProfile: "Cutaneous reactions including fixed drug eruption, generalized pruritus, urticaria, or very rarely severe cutaneous adverse reactions (SCARs / SJS-TEN).",
    precautions: "Discontinue all acetaminophen-containing combination analgesics and cold preparations immediately upon allergic symptoms.",
  },
  thiocolchicoside: {
    allergenClass: "Colchicine Derivative Muscle Relaxant",
    reactionProfile: "Pruritus, cutaneous erythema, urticaria, facial angioedema, and very rarely bronchospasm or anaphylactoid episodes.",
    precautions: "Avoid re-administration of thiocolchicoside and related colchicine congeners. Report any cutaneous rash immediately.",
  },
  sulfa: {
    allergenClass: "Sulfonamide Antimicrobial Class",
    reactionProfile: "Delayed-type hypersensitivity rash, Stevens-Johnson syndrome, drug-induced liver injury, or acute urticaria.",
    precautions: "Avoid sulfamethoxazole/trimethoprim (Bactrim) and related antibiotic sulfonamides.",
  },
  aspirin: {
    allergenClass: "Salicylate / Cyclooxygenase Inhibitor",
    reactionProfile: "Aspirin-exacerbated respiratory disease (AERD / Samter's triad), nasal polyposis, acute bronchospasm, and facial angioedema.",
    precautions: "Strictly avoid aspirin and non-selective NSAIDs. Acetaminophen < 1,000 mg may be tolerated as an alternative.",
  },
};

export function getMedicationDescription(name: string, indication?: string | null): MedicationInfo {
  const cleanName = (name || "").toLowerCase().trim();
  for (const [key, info] of Object.entries(MEDICATION_DICTIONARY)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return {
        ...info,
        indications: indication && indication.trim() ? `${indication} • ${info.indications}` : info.indications,
      };
    }
  }

  return {
    drugClass: "Clinical Therapeutic Agent",
    mechanism: "Pharmacologically active substance prescribed to manage symptoms, correct physiological dysfunction, or address clinical diagnostic findings.",
    indications: indication && indication.trim() ? indication : "Prescribed for therapeutic clinical management as documented in patient prescription history.",
    precautions: "Adhere to the prescribed dosage, frequency, and duration. Consult attending clinician before adjusting or discontinuing therapy.",
  };
}

export function getConditionDescription(name: string, notes?: string | null): ConditionInfo {
  const cleanName = (name || "").toLowerCase().trim();
  for (const [key, info] of Object.entries(CONDITION_DICTIONARY)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return {
        ...info,
        overview: notes && notes.trim() ? `${notes} • ${info.overview}` : info.overview,
      };
    }
  }

  return {
    overview: notes && notes.trim() ? notes : `Documented clinical condition requiring clinical monitoring, symptom assessment, and therapeutic follow-up.`,
    clinicalImpact: "Ongoing physiological management to prevent secondary complications and maintain outpatient functional health status.",
    management: "Regular clinical follow-up examinations, therapeutic compliance, and periodic diagnostic biomarker monitoring.",
  };
}

export function getAllergyDescription(name: string, reaction?: string | null): AllergyInfo {
  const cleanName = (name || "").toLowerCase().trim();
  for (const [key, info] of Object.entries(ALLERGY_DICTIONARY)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return {
        ...info,
        reactionProfile: reaction && reaction.trim() ? `${reaction} (${info.reactionProfile})` : info.reactionProfile,
      };
    }
  }

  return {
    allergenClass: "Clinical Hypersensitivity Flag",
    reactionProfile: reaction && reaction.trim() ? reaction : "Documented adverse immune or pseudoallergic response triggered upon exposure.",
    precautions: "Avoid re-exposure to this agent and chemically related pharmacological classes. Inform hospital pharmacy and nursing team prior to medication administration.",
  };
}
