// MediMate AI Medicine Assistant Service
// Supports live Generative AI models (Google Gemini, OpenAI, Groq)
// and includes a robust clinical knowledge engine based on NHS & MedlinePlus guidelines.

const fs = require('fs');
const path = require('path');

// Load environment variables from .env if present
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (val) {
              process.env[key] = val;
            }
          }
        }
      });
    } catch (e) {
      console.error('Error reading .env file:', e.message);
    }
  }
}

loadEnv();

function getAIConfig() {
  loadEnv(); // Reload in case .env was edited
  let geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  let openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  let groqKey = (process.env.GROQ_API_KEY || '').trim();

  // Strip accidental enclosing quotes from Vercel UI or shell
  if ((geminiKey.startsWith('"') && geminiKey.endsWith('"')) || (geminiKey.startsWith("'") && geminiKey.endsWith("'"))) {
    geminiKey = geminiKey.slice(1, -1).trim();
  }
  if ((openaiKey.startsWith('"') && openaiKey.endsWith('"')) || (openaiKey.startsWith("'") && openaiKey.endsWith("'"))) {
    openaiKey = openaiKey.slice(1, -1).trim();
  }
  if ((groqKey.startsWith('"') && groqKey.endsWith('"')) || (groqKey.startsWith("'") && groqKey.endsWith("'"))) {
    groqKey = groqKey.slice(1, -1).trim();
  }

  if (geminiKey) {
    return { configured: true, provider: 'gemini', model: 'gemini-3.5-flash', key: geminiKey };
  }
  if (openaiKey) {
    return { configured: true, provider: 'openai', model: 'gpt-4o-mini', key: openaiKey };
  }
  if (groqKey) {
    return { configured: true, provider: 'groq', model: 'llama-3.3-70b-versatile', key: groqKey };
  }
  return { configured: false, provider: 'none', model: 'clinical-engine', key: null };
}

// ============================================================
// CLINICAL DRUG DATABASE (NHS & MedlinePlus Grounded)
// ============================================================

const DRUG_DATABASE = {
  ibuprofen: {
    name: 'Ibuprofen',
    aliases: ['ibuprofen', 'ibuprufen', 'ibuprofin', 'advil', 'motrin', 'nurofen', 'brufen'],
    drugClass: 'Non-steroidal anti-inflammatory drug (NSAID)',
    commonUses: [
      'Relief of mild to moderate pain (headaches, migraines, toothaches)',
      'Musculoskeletal and joint pain (backache, sprains, strains, arthritis)',
      'Period pain (dysmenorrhea)',
      'Reduction of fever and symptomatic inflammatory swelling'
    ],
    mechanism: 'Inhibits cyclooxygenase enzymes (COX-1 and COX-2), reducing the synthesis of prostaglandins that cause pain, swelling, and fever.',
    sideEffects: [
      'Common: Stomach discomfort, indigestion, nausea, heartburn, mild diarrhea',
      'Uncommon but serious: Stomach ulcers, gastrointestinal bleeding (black tarry stools), kidney dysfunction, fluid retention',
      'Allergic: Skin rash, wheezing or worsened asthma symptoms'
    ],
    precautions: [
      'Always take with or after food or with milk to protect stomach lining.',
      'High risk: Individuals with past stomach ulcers, chronic kidney disease, severe heart failure, or uncontrolled hypertension.',
      'Pregnancy: Avoid in pregnancy, particularly after 20 weeks, unless explicitly instructed by an obstetrician (risk of fetal kidney issues or premature ductus arteriosus closure).',
      'Asthma: Roughly 10% of asthma patients experience bronchospasm with NSAIDs (aspirin-sensitive asthma).'
    ],
    interactions: [
      'Blood thinners (Warfarin, Apixaban, Clopidogrel, Aspirin): Significantly elevated risk of severe bleeding.',
      'Blood pressure medicines (ACE inhibitors, ARBs, Beta-blockers, Diuretics): NSAIDs may reduce their effectiveness and increase kidney strain.',
      'Corticosteroids (Prednisolone) or other NSAIDs: Markedly increases gastric ulcer risk.',
      'Lithium or Methotrexate: Ibuprofen can reduce their clearance, causing toxic buildup.'
    ],
    generalUsage: 'Standard adult dose is typically 200mg to 400mg every 4 to 6 hours as needed with food, not exceeding 1200mg per 24 hours for over-the-counter use without medical supervision.',
    emergencyWarning: 'Seek immediate emergency medical help if you experience severe abdominal pain, vomit blood or material that looks like coffee grounds, have black tarry stools, sudden chest pain, or difficulty breathing.',
    sources: [
      { name: 'NHS UK Medicines: Ibuprofen', url: 'https://www.nhs.uk/medicines/ibuprofen-for-adults/' },
      { name: 'MedlinePlus Drug Information: Ibuprofen', url: 'https://medlineplus.gov/druginfo/meds/a682159.html' }
    ]
  },
  dolo: {
    name: 'Dolo (Dolo 650)',
    aliases: ['dolo', 'dolo 650', 'dolo650', 'dolo-650'],
    drugClass: 'Analgesic (pain reliever) and antipyretic (fever reducer) — Brand formulation of Paracetamol (Acetaminophen)',
    commonUses: [
      'Relief of mild to moderate pain (headaches, body aches, toothaches, muscle aches)',
      'Reduction of fever (antipyretic) during viral illnesses, colds, and flu',
      'Management of post-vaccination fever and body discomfort',
      'Osteoarthritis and joint discomfort as a first-line agent when inflammation is mild'
    ],
    mechanism: 'Contains paracetamol (typically 650mg per tablet in Dolo 650 once verified from product packaging). It acts primarily in the central nervous system to inhibit prostaglandin synthesis and regulate hypothalamic temperature centers, reducing fever and dulling pain sensations.',
    sideEffects: [
      'Very well-tolerated at recommended therapeutic doses.',
      'Rare: Mild skin rash, nausea, or allergic reaction.',
      'Severe Overdose Risk: Acute liver damage (hepatotoxicity) if maximum daily allowance is exceeded.'
    ],
    precautions: [
      'Product Verification: Dolo is a brand name. Always verify the exact active ingredient (Paracetamol/Acetaminophen) and strength (typically 650mg) on your specific medicine packaging.',
      'Strict Maximum Limit: Adults must never exceed 4,000 mg (4 grams) of paracetamol in 24 hours. Because Dolo 650 contains 650mg, taking more than 5-6 tablets daily can cause severe liver failure.',
      'Dosing Interval: Leave at least 4 to 6 hours between doses. Never take two tablets at once unless explicitly prescribed by a doctor.',
      'Check Combination Medicines: Many cold, cough, and sinus remedies already contain paracetamol; taking them together with Dolo causes accidental toxic overdose.',
      'Liver Disease & Alcohol: Individuals with chronic liver impairment, hepatitis, or heavy alcohol consumption must use lower doses under medical guidance.'
    ],
    interactions: [
      'Other paracetamol-containing products: Avoid combination to prevent acute liver toxicity.',
      'Warfarin: Frequent regular daily intake of paracetamol over several days can increase bleeding risk (INR monitoring required).',
      'Heavy Alcohol: Significantly increases the risk of paracetamol-induced hepatotoxicity.',
      'Enzyme inducers (e.g., Carbamazepine, Phenytoin): May accelerate formation of toxic paracetamol metabolites.'
    ],
    generalUsage: 'For adults, typically 1 tablet of Dolo 650 every 4 to 6 hours as needed with a glass of water, not exceeding 4000mg total paracetamol in 24 hours. Can be taken with or without food. Always follow your doctor\'s instructions.',
    emergencyWarning: 'If you suspect you or someone else has taken more than the recommended dose, seek emergency medical attention immediately, even if feeling well, as liver damage can occur silently over 24-48 hours. Consult a doctor if fever lasts more than 3 days or pain persists for more than 5 days.',
    sources: [
      { name: 'NHS UK Medicines: Paracetamol', url: 'https://www.nhs.uk/medicines/paracetamol-for-adults/' },
      { name: 'MedlinePlus Drug Information: Acetaminophen', url: 'https://medlineplus.gov/druginfo/meds/a681004.html' }
    ]
  },
  paracetamol: {
    name: 'Paracetamol (Acetaminophen)',
    aliases: ['paracetamol', 'acetaminophen', 'paracetemol', 'paracitamol', 'tylenol', 'crocin', 'panadol', 'calpol'],
    drugClass: 'Analgesic (pain reliever) and antipyretic (fever reducer)',
    commonUses: [
      'Mild to moderate pain relief (headaches, tension headaches, dental pain, earache)',
      'Cold and flu symptom management (fever, sore throat, generalized body aches)',
      'Osteoarthritis and joint discomfort as a first-line agent when inflammation is mild'
    ],
    mechanism: 'Acts primarily in the central nervous system to inhibit prostaglandin synthesis and regulate hypothalamic temperature centers, with minimal peripheral anti-inflammatory action.',
    sideEffects: [
      'Very well-tolerated at recommended therapeutic doses.',
      'Rare: Mild skin rash, allergic reaction.',
      'Severe Overdose Risk: Acute liver damage (hepatotoxicity) if maximum daily allowance is exceeded.'
    ],
    precautions: [
      'Strict maximum limit: Never exceed 4000mg (4 grams) in 24 hours for adults. Leave at least 4 hours between doses.',
      'Check combination medicines: Many cold, cough, and sinus remedies already contain paracetamol; taking them together causes accidental overdose.',
      'Liver disease & alcohol: Individuals with chronic liver impairment, hepatitis, or heavy alcohol consumption must use lower doses under medical guidance.'
    ],
    interactions: [
      'Other paracetamol-containing products: Avoid combination to prevent liver toxicity.',
      'Warfarin: Frequent regular daily intake of paracetamol over several days can increase bleeding risk (INR monitoring required).',
      'Enzyme inducers (e.g., Carbamazepine, Phenytoin): May accelerate formation of toxic paracetamol metabolites.'
    ],
    generalUsage: 'Standard adult dose is 500mg to 1000mg (1 to 2 tablets) every 4 to 6 hours as needed, with a strict maximum of 8 tablets (4000mg) in 24 hours. Can be taken with or without food.',
    emergencyWarning: 'If you suspect you or someone else has taken more than the recommended dose, seek emergency medical attention immediately, even if feeling well, as liver damage can occur silently over 24-48 hours.',
    sources: [
      { name: 'NHS UK Medicines: Paracetamol', url: 'https://www.nhs.uk/medicines/paracetamol-for-adults/' },
      { name: 'MedlinePlus Drug Information: Acetaminophen', url: 'https://medlineplus.gov/druginfo/meds/a681004.html' }
    ]
  },
  metformin: {
    name: 'Metformin',
    aliases: ['metformin', 'metforman', 'glucophage', 'glycomet', 'obimet'],
    drugClass: 'Biguanide anti-diabetic medication',
    commonUses: [
      'First-line treatment for Type 2 diabetes mellitus to control blood sugar levels',
      'Polycystic ovary syndrome (PCOS) off-label to improve insulin sensitivity and ovulatory regularity',
      'Prediabetes management in high-risk individuals when lifestyle measures are insufficient'
    ],
    mechanism: 'Decreases glucose production in the liver, decreases intestinal absorption of glucose, and enhances insulin sensitivity in peripheral tissues.',
    sideEffects: [
      'Common: Diarrhea, nausea, stomach cramps, flatulence, metallic taste in mouth (most common when starting treatment).',
      'Long-term: Vitamin B12 deficiency (periodic screening recommended).',
      'Rare but critical: Lactic acidosis (primarily in patients with severe kidney or heart failure).'
    ],
    precautions: [
      'Take with or immediately after meals to minimize gastrointestinal discomfort.',
      'Kidney function: Regular eGFR blood tests are required; dose reduction or discontinuation needed if kidney function declines.',
      'Medical procedures: Temporarily stop before surgical procedures or contrast-dye imaging scans as advised by your physician.'
    ],
    interactions: [
      'Iodinated contrast media: Must temporarily pause metformin to prevent contrast-induced nephropathy and lactic acidosis.',
      'Heavy alcohol intake: Increases risk of hypoglycemia and lactic acidosis.',
      'Cimetidine: Can reduce metformin renal clearance.'
    ],
    generalUsage: 'Typically started at a low dose (e.g., 500mg once daily with breakfast/dinner) and titrated slowly over weeks to 1000mg-2000mg daily in divided doses. Swallow tablets whole with water.',
    emergencyWarning: 'Seek immediate emergency medical help if you experience unusual muscle pain, severe weakness, difficulty breathing, slow or irregular heartbeat, or severe drowsiness (signs of lactic acidosis).',
    sources: [
      { name: 'NHS UK Medicines: Metformin', url: 'https://www.nhs.uk/medicines/metformin/' },
      { name: 'MedlinePlus: Metformin', url: 'https://medlineplus.gov/druginfo/meds/a684058.html' }
    ]
  },
  atorvastatin: {
    name: 'Atorvastatin',
    aliases: ['atorvastatin', 'lipitor', 'atorva', 'atorlip', 'aztor', 'statin'],
    drugClass: 'HMG-CoA reductase inhibitor (Statin lipid-lowering agent)',
    commonUses: [
      'Lowering LDL ("bad") cholesterol and triglycerides in hyperlipidemia',
      'Raising HDL ("good") cholesterol levels',
      'Primary and secondary prevention of heart attacks, angina, and strokes in cardiovascular disease'
    ],
    mechanism: 'Selectively inhibits 3-hydroxy-3-methylglutaryl-coenzyme A (HMG-CoA) reductase, the rate-limiting enzyme in hepatic cholesterol synthesis, promoting clearance of LDL from blood.',
    sideEffects: [
      'Common: Mild muscle or joint aches, headache, digestive disturbances, mild elevation in blood glucose.',
      'Uncommon/Rare: Significant muscle inflammation (myositis) or severe muscle breakdown (rhabdomyolysis).'
    ],
    precautions: [
      'Report unexplained muscle pain, tenderness, or weakness promptly, especially if accompanied by dark urine or fever.',
      'Avoid drinking large quantities of grapefruit juice (more than 1.2 liters daily), as it blocks the enzyme that metabolizes atorvastatin and elevates drug levels.',
      'Liver function: Periodic liver enzyme monitoring recommended.'
    ],
    interactions: [
      'Other lipid-lowering drugs (Gemfibrozil, high-dose Niacin): Increased risk of severe myopathy.',
      'Certain antibiotics (Clarithromycin, Erythromycin) and antifungals (Itraconazole): Elevates atorvastatin blood levels.',
      'HIV and Hepatitis C protease inhibitors: Requires careful dose adjustment.'
    ],
    generalUsage: 'Usually taken once daily at any time of day (morning or evening), with or without food. Statin therapy is typically a long-term preventive treatment.',
    emergencyWarning: 'Contact your doctor immediately if you notice unexplained muscle pain or weakness, particularly with dark reddish-brown urine or fever.',
    sources: [
      { name: 'NHS UK Medicines: Atorvastatin', url: 'https://www.nhs.uk/medicines/atorvastatin/' },
      { name: 'MedlinePlus: Atorvastatin', url: 'https://medlineplus.gov/druginfo/meds/a600045.html' }
    ]
  },
  amoxicillin: {
    name: 'Amoxicillin',
    aliases: ['amoxicillin', 'amoxycillin', 'moxatag', 'amoxil', 'augmentin'],
    drugClass: 'Penicillin-class beta-lactam antibiotic',
    commonUses: [
      'Bacterial infections of the chest (bronchitis, pneumonia)',
      'Ear, nose, and throat bacterial infections (sinusitis, tonsillitis, otitis media)',
      'Dental abscesses and bacterial skin or urinary tract infections'
    ],
    mechanism: 'Inhibits bacterial cell wall synthesis during active multiplication, resulting in bacterial lysis and death. Ineffective against viral infections like colds and COVID-19.',
    sideEffects: ['Nausea, diarrhea, mild rash, oral or vaginal thrush.'],
    precautions: [
      'Contraindicated in individuals with a confirmed allergy to penicillin or cephalosporins.',
      'Crucial: Always complete the full prescribed course even if symptoms resolve earlier, to prevent antibiotic resistance.'
    ],
    interactions: ['Methotrexate (increased toxicity), Probenecid (prolongs amoxicillin blood levels), oral typhoid vaccine (inactivated).'],
    generalUsage: 'Prescribed as capsules or oral suspension, usually taken 3 times a day (every 8 hours) with or without food.',
    emergencyWarning: 'If you develop swelling of face or throat, hives, or breathing difficulties, call emergency services immediately (anaphylaxis).',
    sources: [{ name: 'NHS UK: Amoxicillin', url: 'https://www.nhs.uk/medicines/amoxicillin/' }]
  },
  omeprazole: {
    name: 'Omeprazole',
    aliases: ['omeprazole', 'prilosec', 'losec', 'omez'],
    drugClass: 'Proton pump inhibitor (PPI)',
    commonUses: [
      'Gastroesophageal reflux disease (GERD) and acid reflux heartburn',
      'Treatment and prevention of stomach and duodenal ulcers',
      'Gastroprotection when taking long-term NSAIDs (like ibuprofen or aspirin)',
      'Part of triple therapy for Helicobacter pylori eradication'
    ],
    mechanism: 'Suppresses gastric acid secretion by specific inhibition of the H+/K+-ATPase enzyme system at the secretory surface of the gastric parietal cell.',
    sideEffects: ['Headache, diarrhea, constipation, abdominal pain, flatulence.'],
    precautions: ['Long-term use may slightly increase risk of bone fractures and hypomagnesemia; discuss treatment duration with your doctor.'],
    interactions: ['Clopidogrel (may reduce antiplatelet efficacy), Diazepam, Methotrexate.'],
    generalUsage: 'Best taken once daily in the morning, 30 to 60 minutes before breakfast with a glass of water. Swallow capsules whole.',
    emergencyWarning: 'Seek immediate evaluation if you have unexpected weight loss, difficulty swallowing, or persistent vomiting.',
    sources: [{ name: 'NHS UK: Omeprazole', url: 'https://www.nhs.uk/medicines/omeprazole/' }]
  },
  aspirin: {
    name: 'Aspirin (Acetylsalicylic Acid)',
    aliases: ['aspirin', 'ecosprin', 'disprin', 'bayer'],
    drugClass: 'NSAID / Antiplatelet agent',
    commonUses: [
      'Low dose (75mg to 100mg daily): Prevention of heart attacks and ischemic strokes in high-risk patients',
      'Higher dose (300mg to 900mg): Short-term relief of pain, fever, and acute migraine'
    ],
    mechanism: 'Irreversibly inhibits platelet cyclooxygenase-1 (COX-1), preventing the synthesis of thromboxane A2 and inhibiting platelet aggregation for the lifespan of the platelet (7-10 days).',
    sideEffects: ['Dyspepsia, mild bleeding tendencies, nausea.'],
    precautions: [
      'Never give aspirin to children or teenagers under 16 years of age due to the risk of Reye\'s syndrome (fatal liver and brain swelling).',
      'High risk with active stomach ulcers or bleeding disorders.'
    ],
    interactions: ['Other blood thinners (Warfarin, Heparin, DOACs), Ibuprofen (blunts aspirin antiplatelet effect if taken concurrently), Methotrexate.'],
    generalUsage: 'Low-dose cardioprotective aspirin is taken once daily after food. Pain-relief doses should not exceed 4000mg per day.',
    emergencyWarning: 'Seek emergency care for signs of internal bleeding: vomiting blood, coffee-ground emesis, or passing black stools.',
    sources: [{ name: 'NHS UK: Aspirin', url: 'https://www.nhs.uk/medicines/aspirin-for-pain-relief/' }]
  },
  cetirizine: {
    name: 'Cetirizine',
    aliases: ['cetirizine', 'zyrtec', 'cetzine', 'alerid'],
    drugClass: 'Second-generation non-sedating antihistamine',
    commonUses: ['Allergic rhinitis (hay fever), itchy watery eyes, runny nose, sneezing, hives (urticaria) and allergic itching.'],
    mechanism: 'Selectively blocks peripheral H1 histamine receptors, reducing allergy symptoms without significant central sedative effects.',
    sideEffects: ['Mild drowsiness in some individuals, dry mouth, headache.'],
    precautions: ['Avoid heavy alcohol intake. Use caution when driving until you know how it affects you.'],
    interactions: ['Sedative medications, tranquilizers, alcohol (increased drowsiness).'],
    generalUsage: 'Typically 10mg once daily (or 5mg twice daily), with or without food.',
    emergencyWarning: 'If symptoms involve tongue swelling, wheezing, or tightness in the throat, treat as anaphylaxis and seek emergency help.',
    sources: [{ name: 'NHS UK: Cetirizine', url: 'https://www.nhs.uk/medicines/cetirizine/' }]
  }
};

// ============================================================
// CONVERSATION CONTEXT & QUERY PARSING HELPERS
// ============================================================

function extractSubjectFromHistory(history) {
  if (!history || !history.length) return null;
  // Look backwards for mentioned drug names
  const allAliases = [];
  for (const [key, drug] of Object.entries(DRUG_DATABASE)) {
    allAliases.push({ key, aliases: drug.aliases });
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const text = (history[i].text || history[i].content || '').toLowerCase();
    for (const item of allAliases) {
      for (const a of item.aliases) {
        if (text.includes(a)) return item.key;
      }
    }
  }
  return null;
}

function detectDrugFromText(text, historyContext) {
  const lower = text.toLowerCase();

  // Direct match against known aliases
  for (const [key, drug] of Object.entries(DRUG_DATABASE)) {
    for (const a of drug.aliases) {
      // Word boundary match or includes with space/punctuation
      const regex = new RegExp(`(^|[\\s,;?.!])${a}([\\s,;?.!]|$)`, 'i');
      if (regex.test(lower) || lower.includes(a)) {
        return key;
      }
    }
  }

  // Check for pronoun or follow-up references: "it", "its", "this medicine", "the drug"
  if (historyContext && (/\b(it|its|this|the medicine|the drug|that|side effects)\b/i.test(lower))) {
    return historyContext;
  }

  return null;
}

// ============================================================
// KNOWLEDGE ENGINE RESPONSE GENERATOR
// ============================================================

function generateClinicalResponse(userQuery, history, userMedications, aiNotice = '') {
  const q = userQuery.trim().toLowerCase();
  const historySubject = extractSubjectFromHistory(history);
  const detectedDrugKey = detectDrugFromText(q, historySubject);
  const drug = detectedDrugKey ? DRUG_DATABASE[detectedDrugKey] : null;

  // 1. SCHEDULED MEDICATIONS CHECK (Must use logged-in user's database records)
  if (
    q.includes('scheduled') ||
    q.includes('what medicine') ||
    q.includes('my medicines') ||
    q.includes('my meds') ||
    q.includes('what pills') ||
    q.includes('prescriptions') ||
    (q.includes('what do i take') && !detectedDrugKey)
  ) {
    if (userMedications && userMedications.length > 0) {
      const activeMeds = userMedications.filter(m => (m.status || 'active') === 'active');
      if (activeMeds.length > 0) {
        const medList = activeMeds.map((m, idx) => {
          const times = Array.isArray(m.times) && m.times.length ? m.times.join(', ') : (m.scheduled_time || '08:00');
          const food = m.food && m.food !== 'any' ? ` (${m.food} food)` : '';
          const doc = m.doctor ? (m.doctor.toLowerCase().startsWith('dr') ? ` — Prescribed by ${m.doctor}` : ` — Prescribed by Dr. ${m.doctor}`) : '';
          return `${idx + 1}. **${m.name}** (${m.strength || 'standard dose'}, ${m.form || 'tablet'}): ${m.dose || '1 dose'} at **${times}**${food}${doc}`;
        }).join('\n');

        return `${aiNotice}Here are your current active scheduled medicines from your verified MediMate health profile:

${medList}

**Important Reminders:**
- Always confirm each dose on your phone after taking it to keep your adherence history accurate.
- If you miss a scheduled time or feel unwell, follow your doctor's instructions or consult your pharmacist.
- Do not stop or alter dosages without clinical consultation.`;
      }
    }
    return `${aiNotice}You currently have **no active scheduled medicines** in your MediMate profile.

To add a medicine:
1. Click the **Medicines** tab in the sidebar or the **Add Medicine** button on your dashboard.
2. Enter your medicine name, strength, dosage times, and doctor's instructions.
3. Save to enable automated smart reminders and adherence tracking.`;
  }

  // 2. SPECIFIC DRUG QUESTIONS
  if (drug) {
    // Specific side effects query
    if (q.includes('side effect') || q.includes('adverse') || q.includes('risk') || q.includes('danger')) {
      return `${aiNotice}### Side Effects and Safety Profile for **${drug.name}** (${drug.drugClass}):

**Common Side Effects:**
${drug.sideEffects.map(s => `- ${s}`).join('\n')}

**Important Warnings & Precautions:**
${drug.precautions.map(p => `- ${p}`).join('\n')}

**Key Drug Interactions:**
${drug.interactions.map(i => `- ${i}`).join('\n')}

**When to Seek Immediate Medical Attention:**
${drug.emergencyWarning}

*Sources: ${drug.sources.map(s => `[${s.name}](${s.url})`).join(' | ')}*
*Disclaimer: Educational information only. Do not stop or change medications without consulting your doctor or pharmacist.*`;
    }

    // Specific interactions query
    if (q.includes('interact') || q.includes('interaction') || q.includes('with other') || q.includes('take with')) {
      return `${aiNotice}### Drug Interactions for **${drug.name}** (${drug.drugClass}):

${drug.name} can interact with several common classes of medications:

${drug.interactions.map(i => `- **${i.split(':')[0]}:** ${i.split(':')[1] || ''}`).join('\n')}

**Precautions & Food:**
${drug.precautions.map(p => `- ${p}`).join('\n')}

**General Rule:** Always inform your doctor and pharmacist of every prescription, over-the-counter medication, and herbal supplement you take.

*Sources: ${drug.sources.map(s => `[${s.name}](${s.url})`).join(' | ')}*`;
    }

    // Comprehensive drug overview (Expected answer format matching medical standards)
    return `${aiNotice}**${drug.name}** is a ${drug.drugClass}. It ${drug.mechanism.toLowerCase()}

**Common uses:**
${drug.commonUses.map(u => `- ${u}`).join('\n')}

**Common side effects:**
${drug.sideEffects.slice(0, 2).map(s => `- ${s}`).join('\n')}

**Important precautions & interactions:**
${drug.precautions.map(p => `- ${p}`).join('\n')}

**General usage:**
${drug.generalUsage}

**When to seek immediate attention:**
${drug.emergencyWarning}

Follow the medicine label or your doctor's instructions. Do not start, stop, or change prescribed medicines based only on AI advice.

*Trusted Sources: ${drug.sources.map(s => `[${s.name}](${s.url})`).join(' • ')}*`;
  }

  // 3. "TAKE AFTER FOOD" EXPLANATION
  if (q.includes('after food') || q.includes('take with food') || q.includes('with meals') || q.includes('food mean')) {
    return `${aiNotice}### What "Take After Food" Means in Medicine

When a prescription or medicine label instructs you to **"Take after food"** or **"Take with meals"**, it means:

1. **Timing:** Take your medicine within **15 to 30 minutes** after having a meal, or with a substantial snack (such as a sandwich, a glass of milk, or yoghurt).
2. **Why It Matters:**
   - **Stomach Protection:** Medications like NSAIDs (**Ibuprofen**, **Aspirin**), steroids (Prednisolone), and **Metformin** can irritate the stomach lining. Food creates a protective physical buffer, significantly reducing heartburn, indigestion, nausea, and ulcer risk.
   - **Absorption:** Some medicines dissolve better and are absorbed more effectively when bile and digestive juices are active during digestion.
3. **What if you have no appetite?** Even a small snack (biscuits, banana, or a glass of milk) is usually sufficient to cushion the stomach.
4. **Contrast with "On an empty stomach" / "Before food":** Means 1 hour before eating or 2 hours after, required for medicines (like thyroid hormone Levothyroxine or certain antibiotics) whose absorption is blocked by food.

*Source: [NHS Medicines Guide — How and When to Take Medicine](https://www.nhs.uk/conditions/medicines-information/)*`;
  }

  // 4. "EXPLAIN HBA1C IN SIMPLE ENGLISH"
  if (q.includes('hba1c') || q.includes('hb a1c') || q.includes('glycated') || (q.includes('a1c') && q.includes('explain'))) {
    return `${aiNotice}### HbA1c (Hemoglobin A1c) Explained in Simple English

**What is HbA1c?**
HbA1c stands for **glycated hemoglobin**. When glucose (sugar) travels in your bloodstream, some of it naturally sticks to hemoglobin, the protein in red blood cells that carries oxygen.

**Why is it so useful?**
- A standard finger-prick blood test only shows your blood sugar at that exact second.
- Red blood cells live for about **8 to 12 weeks (2 to 3 months)**.
- Therefore, HbA1c gives your doctor an accurate **3-month average** of your blood sugar control, unaffected by what you ate yesterday.

**Standard Diagnostic Ranges:**
- **Normal (Healthy non-diabetic):** Below **5.7%** (or below 42 mmol/mol)
- **Prediabetes (Increased risk):** **5.7% to 6.4%** (42 to 47 mmol/mol)
- **Diabetes:** **6.5% or higher** (48 mmol/mol or higher)

**For individuals with diabetes:**
A common general target is often **around 6.5% to 7.0%** (48 to 53 mmol/mol), but your personal target is set by your physician based on your age, lifestyle, and other health conditions.

*Source: [NHS UK — What is HbA1c?](https://www.nhs.uk/conditions/type-2-diabetes/understanding-hba1c/) • [MedlinePlus: Hemoglobin A1c Test](https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/)*`;
  }

  // 5. "WHAT QUESTIONS SHOULD I ASK MY DOCTOR ABOUT THIS REPORT?"
  if (q.includes('question') && (q.includes('doctor') || q.includes('report') || q.includes('test'))) {
    return `${aiNotice}### Recommended Questions to Ask Your Doctor About Your Medical Report:

Taking structured questions to your appointment ensures you leave with complete clarity:

1. **Understanding the Findings:**
   - *"Which results in this report are in the normal range, and which are flagged as high or low?"*
   - *"Are any of these abnormal results unexpected given my health history?"*
2. **Symptoms and Meaning:**
   - *"Do these lab numbers explain the symptoms (fatigue, pain, etc.) I've been experiencing?"*
   - *"Is this a temporary fluctuation, or does it point to an ongoing chronic condition?"*
3. **Treatment & Medications:**
   - *"Do I need to start, adjust, or discontinue any of my current daily medicines?"*
   - *"Are there lifestyle, nutrition, or physical activity changes that could help improve these markers?"*
4. **Next Steps:**
   - *"Do you recommend any follow-up tests or a referral to a specialist?"*
   - *"When should we repeat this test to check if my numbers are improving?"*

**Tip for MediMate Users:** You can upload this report to the **Medical Records** vault in MediMate so your documents are safely stored in one place for future doctor visits.`;
  }

  // 6. EMERGENCY TRIAGE
  if (
    q.includes('chest pain') ||
    q.includes('heart attack') ||
    q.includes('can\'t breathe') ||
    q.includes('shortness of breath') ||
    q.includes('severe bleeding') ||
    q.includes('fainted') ||
    q.includes('stroke') ||
    q.includes('face drooping')
  ) {
    return `🚨 **URGENT MEDICAL WARNING:**
Your symptoms may indicate a medical emergency requiring immediate evaluation.

- **Call emergency services immediately** (e.g., 911, 999, 112, or your local emergency number) or go to the nearest hospital Emergency Room.
- Do not drive yourself if experiencing severe chest pain, shortness of breath, sudden numbness, or dizziness.
- Do not delay seeking emergency care for advice from an AI assistant.`;
  }

  // 6.5. AMBIGUOUS OR UNRECOGNIZED MEDICINE CHECK
  if (
    q.includes('use of') ||
    q.includes('what is') ||
    q.includes('side effect') ||
    q.includes('how to take') ||
    q.includes('dosage of') ||
    q.includes('dose of') ||
    q.includes('tablet') ||
    q.includes('pill') ||
    q.includes('capsule') ||
    q.includes('medicine') ||
    q.includes('drug')
  ) {
    return `${aiNotice}**Medicine Verification Required:**
I could not reliably verify the exact pharmaceutical composition or formulation for the specific medicine you asked about.

**Safety Recommendations:**
1. **Check the Product Label:** Inspect your medicine package, strip, or prescription label to confirm the exact active pharmaceutical ingredient name (e.g. *Paracetamol*, *Ibuprofen*, *Metformin*, *Atorvastatin*, *Amoxicillin*) and strength (mg/mcg).
2. **Consult a Pharmacist:** Because brand formulations vary across manufacturers, always consult a licensed pharmacist or your prescribing doctor to confirm indications, proper usage, and potential interactions with other medications you take.
3. **Ask by Active Ingredient:** If you can identify the generic active ingredient from your packaging, ask me (for example: *"What is the use of paracetamol?"* or *"What is the use of ibuprofen?"*), and I will provide verified clinical information based on NHS and MedlinePlus guidelines.

*Safety Notice: MediMate provides educational guidance and never prescribes medicines, changes doses, or diagnoses medical conditions.*`;
  }

  // 7. GENERAL EDUCATIONAL FALLBACK (Direct, helpful, clear)
  return `${aiNotice}I am your **MediMate Medicine Information Assistant**. I can help you understand:

- **Medicines & Drugs:** Drug classes, common uses, mechanisms, side effects, and precautions (e.g., *Ibuprofen*, *Paracetamol*, *Dolo 650*, *Metformin*, *Atorvastatin*, *Amoxicillin*).
- **Instructions:** Medical directions like *"take after food"*, *"before meals"*, or *"at bedtime"*.
- **Lab & Report Terms:** Simplifying terms like *HbA1c*, *lipid profile*, *eGFR*, or *blood pressure markers*.
- **Your Schedule:** Showing your live active medicines recorded in MediMate.

**Try asking:**
- *"What is the use of dolo?"*
- *"What is the use of ibuprofen?"*
- *"What are the side effects of paracetamol?"*
- *"Can ibuprofen interact with other medicines?"*
- *"What does 'take after food' mean?"*
- *"What medicines do I have scheduled now?"*
- *"Explain HbA1c in simple English"*

*Safety Notice: MediMate provides educational guidance based on NHS and MedlinePlus guidelines. Always verify prescriptions with your licensed healthcare provider.*`;
}

// ============================================================
// LIVE LLM CALLERS (Gemini, OpenAI, Groq)
// ============================================================

async function callGemini(apiKey, primaryModel, userQuery, history, userMedications) {
  const candidateModels = [primaryModel, 'gemini-3.5-flash-lite', 'gemini-3.6-flash'];
  const models = [...new Set(candidateModels)];

  const medContext = (userMedications && userMedications.length > 0)
    ? `Patient's Current Scheduled Medications in MediMate:\n` + userMedications.map(m => `- ${m.name} ${m.strength || ''} (${m.form || 'tablet'}): ${m.dose || '1 dose'} at ${Array.isArray(m.times) ? m.times.join(', ') : m.times} (${m.food || 'any'} food)`).join('\n')
    : `Patient currently has no saved scheduled medications in MediMate.`;

  const systemPrompt = `You are the MediMate Medicine Information Assistant — an expert, compassionate clinical pharmacology assistant designed for patients and caregivers.
Your goal is to answer medicine-related questions with high clinical accuracy, clarity, and empathy.

Context:
${medContext}

Guidelines for Medicine Explanations:
When a user asks about a drug (e.g. "What is the use of ibuprofen?" or "What is the use of dolo?"):
1. Medicine Name and Drug Class (e.g., NSAID, analgesic, statin). For brand products such as Dolo or Dolo 650, explain that its active ingredient is Paracetamol (Acetaminophen), typically 650mg once verified on packaging.
2. Common Uses and conditions it helps treat (e.g. fever reduction, mild to moderate pain).
3. How it generally works in the body.
4. Common Side Effects.
5. Important Warnings, Precautions, and Drug Interactions (strict 4000mg/day paracetamol ceiling to prevent liver toxicity; do not combine with other paracetamol products).
6. Who should consult a healthcare professional before taking it.
7. General Usage Guidance (without prescribing an individualized dose).
8. When urgent medical attention is needed.

Tone & Safety Rules:
- Provide educational information grounded in trustworthy sources (NHS, MedlinePlus, FDA).
- Never diagnose diseases, prescribe personalized doses, or instruct patients to stop or change prescribed medicines without a doctor's consultation.
- If reliable medicine information is unavailable or the medicine is ambiguous, ask the user to verify the exact product and consult a pharmacist.
- If the patient asks about their scheduled medicines, refer accurately to the patient's medication list provided in the context above.
- For emergency symptoms (chest pain, severe breathlessness, anaphylaxis, stroke symptoms), urgently advise immediate emergency services (911/112/999).
- Answer questions directly and concisely in natural, patient-friendly language.`;

  // Build clean, alternating turns starting with user
  const contents = [];
  if (history && history.length > 0) {
    let expectUser = true;
    history.slice(-8).forEach(h => {
      const isUser = (h.role === 'user');
      const text = (h.text || h.content || '').trim();
      if (!text) return;
      if (expectUser && isUser) {
        contents.push({ role: 'user', parts: [{ text }] });
        expectUser = false;
      } else if (!expectUser && !isUser) {
        contents.push({ role: 'model', parts: [{ text }] });
        expectUser = true;
      }
    });
  }

  // Current query is the final user turn
  contents.push({
    role: 'user',
    parts: [{ text: userQuery }]
  });

  let lastError = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        let errBody = '';
        try {
          const errJson = await response.json();
          errBody = errJson.error?.message || JSON.stringify(errJson);
        } catch {
          errBody = await response.text();
        }

        if (response.status === 400) {
          throw new Error(`Invalid Gemini API key or bad request parameters (${errBody})`);
        } else if (response.status === 403) {
          throw new Error(`Gemini API key is unauthorized or Generative Language API is disabled in Google Cloud Console.`);
        } else if (response.status === 429) {
          throw new Error(`Gemini API rate limit or quota exceeded. Please wait a moment.`);
        } else if (response.status === 503) {
          lastError = new Error(`Gemini service temporarily experiencing high demand (503 Service Unavailable).`);
          console.warn(`Model ${model} returned 503 high demand spike, checking fallback model...`);
          continue;
        } else if (response.status === 404) {
          lastError = new Error(`Gemini model ${model} is not available for this API key.`);
          console.warn(`Model ${model} returned 404, checking fallback model...`);
          continue;
        } else {
          throw new Error(`Gemini API error (${response.status}): ${errBody}`);
        }
      }

      const data = await response.json();
      const candidate = data.candidates && data.candidates[0];
      const reply = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;

      if (!reply) {
        throw new Error('Gemini API returned an empty response.');
      }

      return { reply, model };
    } catch (err) {
      if (err.message.includes('503') || err.message.includes('404')) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All candidate Gemini models were unavailable.');
}

async function callOpenAICompatible(url, apiKey, model, userQuery, history, userMedications) {
  const medContext = (userMedications && userMedications.length > 0)
    ? `Patient's Current Scheduled Medications in MediMate:\n` + userMedications.map(m => `- ${m.name} ${m.strength || ''} (${m.form || 'tablet'}): ${m.dose || '1 dose'} at ${Array.isArray(m.times) ? m.times.join(', ') : m.times} (${m.food || 'any'} food)`).join('\n')
    : `Patient currently has no saved scheduled medications in MediMate.`;

  const systemMessage = {
    role: 'system',
    content: `You are the MediMate Clinical Medicine Information Assistant.
Provide clear, accurate, educational information about medicines, medical terms, and scheduled prescriptions.

Context:
${medContext}

Guidelines for Medicine Questions:
When asked about a drug (e.g., "What is the use of ibuprofen?"), explain:
- Medicine name and drug class (e.g. NSAID, analgesic, statin).
- Common uses and conditions treated.
- How it generally works in the body.
- Common side effects.
- Important warnings, precautions, and interactions.
- Who should consult a healthcare professional before taking it.
- General usage guidance (no personalized dosing).
- When urgent medical attention is needed.

Ground answers in NHS and MedlinePlus guidelines.
Safety: Educational only. Never recommend stopping or changing prescribed medicines without consulting a doctor. For emergency symptoms (chest pain, stroke, breathlessness), advise immediate emergency medical care.`
  };

  const messages = [systemMessage];

  if (history && history.length > 0) {
    history.slice(-8).forEach(h => {
      messages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text || h.content || ''
      });
    });
  }

  messages.push({ role: 'user', content: userQuery });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!reply) {
    throw new Error('AI API returned an empty response.');
  }
  return reply;
}

// ============================================================
// MAIN HANDLER FOR SERVER
// ============================================================

async function handleAssistantRequest(payload) {
  const { message, history = [], medications = [], user = null } = payload;
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required.');
  }

  const aiConfig = getAIConfig();

  // If live AI provider is configured, call it
  if (aiConfig.configured) {
    try {
      if (aiConfig.provider === 'gemini') {
        const geminiRes = await callGemini(aiConfig.key, aiConfig.model, message, history, medications);
        return {
          reply: geminiRes.reply,
          provider: 'Google Gemini (' + geminiRes.model + ')',
          configured: true
        };
      } else if (aiConfig.provider === 'openai') {
        const reply = await callOpenAICompatible('https://api.openai.com/v1/chat/completions', aiConfig.key, aiConfig.model, message, history, medications);
        return {
          reply,
          provider: 'OpenAI (' + aiConfig.model + ')',
          configured: true
        };
      } else if (aiConfig.provider === 'groq') {
        const reply = await callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', aiConfig.key, aiConfig.model, message, history, medications);
        return {
          reply,
          provider: 'Groq (' + aiConfig.model + ')',
          configured: true
        };
      }
    } catch (aiError) {
      console.warn('Live AI provider failed, falling back to Clinical Knowledge Engine:', aiError.message);
      const fallbackReply = generateClinicalResponse(
        message,
        history,
        medications,
        `⚠️ *Live AI provider encountered an error (${aiError.message}). Answering using MediMate Clinical Knowledge Base:*\n\n`
      );
      return {
        reply: fallbackReply,
        provider: 'MediMate Clinical Knowledge Base (Fallback)',
        configured: false,
        warning: aiError.message
      };
    }
  }

  // If no AI provider is configured in .env, clearly explain what configuration is missing and use the Clinical Knowledge Engine
  const notice = `*ℹ️ Note: Live Generative AI is not configured (add \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` in your \`.env\` file for custom generative chat). Answering via MediMate Clinical Knowledge Base (NHS & MedlinePlus guidelines):*\n\n`;

  const reply = generateClinicalResponse(message, history, medications, notice);
  return {
    reply,
    provider: 'MediMate Clinical Knowledge Base',
    configured: false
  };
}

module.exports = {
  getAIConfig,
  handleAssistantRequest,
  generateClinicalResponse
};
