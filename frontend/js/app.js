/* app.js — Main application logic, API calls, state management */

const API_BASE = 'http://localhost:5000/api';

// ─── State ──────────────────────────────────────────────────────
let state = {
  age: 30,
  gender: 'Male',
  stats: null,
  prevalenceData: null,
  trendsData: null,
  heatmapData: null,
  lastPrediction: null
};

// ─── Disease metadata for encyclopedia ──────────────────────────
const DISEASE_META = {
  "Hypertension":          { ageRange: "25–90", genderBias: "Male-slight",   icon: "🫀" },
  "Type 2 Diabetes":       { ageRange: "30–85", genderBias: "Equal",         icon: "🩸" },
  "Coronary Artery Disease":{ ageRange: "35–90", genderBias: "Male-dominant", icon: "💔" },
  "Asthma":                { ageRange: "2–70",  genderBias: "Female-slight",  icon: "🫁" },
  "COPD":                  { ageRange: "40–90", genderBias: "Male",           icon: "🌬️" },
  "Migraine":              { ageRange: "10–65", genderBias: "Female-dominant",icon: "🧠" },
  "Osteoporosis":          { ageRange: "45–95", genderBias: "Female-dominant",icon: "🦴" },
  "Anxiety Disorder":      { ageRange: "15–70", genderBias: "Female",         icon: "😰" },
  "Thyroid Disorders":     { ageRange: "20–80", genderBias: "Female-dominant",icon: "🦋" },
  "Anemia":                { ageRange: "10–80", genderBias: "Female",         icon: "🔴" },
  "Obesity":               { ageRange: "15–80", genderBias: "Equal",          icon: "⚖️" },
  "Arthritis":             { ageRange: "30–90", genderBias: "Female-slight",  icon: "🦴" },
  "Depression":            { ageRange: "15–80", genderBias: "Female",         icon: "💙" },
  "Kidney Disease":        { ageRange: "35–90", genderBias: "Male",           icon: "🫘" },
  "Liver Disease":         { ageRange: "25–85", genderBias: "Male",           icon: "🟤" },
  "Healthy (No Disease)":  { ageRange: "1–50",  genderBias: "Equal",          icon: "✅" }
};

const RISK_COLORS = {
  'High':   '#fa709a',
  'Medium': '#f6e05e',
  'Low':    '#43e97b'
};

const AGE_GROUPS = [
  [0,  17,  "Child/Teen"],
  [18, 29,  "Young Adult (18-29)"],
  [30, 44,  "Adult (30-44)"],
  [45, 59,  "Middle-Aged (45-59)"],
  [60, 74,  "Senior (60-74)"],
  [75, 120, "Elderly (75+)"]
];

// ─── API Helpers ────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

// ─── Age Group from age ─────────────────────────────────────────
function getAgeGroup(age) {
  for (const [lo, hi, label] of AGE_GROUPS) {
    if (age >= lo && age <= hi) return label;
  }
  return 'Unknown';
}

// ─── Initialize App ─────────────────────────────────────────────
async function initApp() {
  // Check API health
  try {
    const health = await apiFetch('/health');
    updateNavStatus(true);
    if (health.total_records) {
      document.getElementById('heroRecords').textContent = health.total_records.toLocaleString() + '+';
    }
  } catch (e) {
    updateNavStatus(false);
    showToast('⚠️ Backend offline. Start Flask server.', 'error', 6000);
  }

  // Load all analytics in parallel
  try {
    const [statsData, prevData, trendData, heatData] = await Promise.all([
      apiFetch('/stats'),
      apiFetch('/analysis/prevalence'),
      apiFetch('/analysis/trends'),
      apiFetch('/analysis/heatmap')
    ]);

    state.stats = statsData;
    state.prevalenceData = prevData;
    state.trendsData = trendData;
    state.heatmapData = heatData;

    populateStats(statsData);
    renderGenderChart(prevData.disease_by_gender);
    renderPrevalenceChart(prevData.disease_prevalence);
    renderAgeGroupChart(prevData.disease_by_age_group);
    renderHeatmap(heatData);
    renderTrendsChart(trendData);
    populateInsights(statsData);
    populateEncyclopedia();

    // Observe entrance animations
    setTimeout(observeEntrance, 100);

  } catch (e) {
    console.error('Failed to load analytics:', e);
    showToast('Could not load analytics data.', 'error');
  }
}

// ─── Populate Hero Stats ────────────────────────────────────────
function populateStats(data) {
  const recEl = document.getElementById('statRecords');
  animateCounter(recEl, data.total_records, '+');

  document.getElementById('statDiseases').textContent = data.total_diseases;

  // Update hero insights
  const hrEl = document.getElementById('heroRecords');
  hrEl.textContent = data.total_records.toLocaleString() + '+';
}

// ─── Populate Insights section ──────────────────────────────────
function populateInsights(data) {
  animateCounter(document.getElementById('insightRecords'), data.total_records, '');
  document.getElementById('insightDiseases').textContent = data.total_diseases;
  animateCounter(document.getElementById('insightMale'), Math.round(data.male_pct), '%');
  animateCounter(document.getElementById('insightFemale'), Math.round(data.female_pct), '%');
  document.getElementById('insightAgeRange').textContent = `${data.age_min}–${data.age_max}`;
  document.getElementById('insightAvgAge').textContent = data.age_mean;
}

// ─── Populate Encyclopedia ──────────────────────────────────────
function populateEncyclopedia() {
  const ADVICE_MAP = {
    "Hypertension": "Monitor blood pressure regularly, reduce sodium intake, exercise daily, limit alcohol.",
    "Type 2 Diabetes": "Monitor blood glucose, maintain healthy weight, eat low-glycemic foods, exercise regularly.",
    "Coronary Artery Disease": "Regular cardiac check-ups, heart-healthy diet, quit smoking, manage stress.",
    "Asthma": "Avoid triggers, use prescribed inhalers, monitor peak flow, avoid smoking environments.",
    "COPD": "Quit smoking immediately, use bronchodilators, pulmonary rehabilitation, regular lung function tests.",
    "Migraine": "Track triggers, stay hydrated, avoid bright lights, consult neurologist.",
    "Osteoporosis": "Calcium & Vitamin D supplements, weight-bearing exercises, DEXA scan, avoid falls.",
    "Anxiety Disorder": "Practice mindfulness, cognitive-behavioral therapy, regular sleep, limit caffeine.",
    "Thyroid Disorders": "Regular TSH blood tests, take prescribed thyroid medication, monitor symptoms.",
    "Anemia": "Iron-rich diet, Vitamin B12 and folate intake, treat underlying causes.",
    "Obesity": "Balanced caloric deficit diet, aerobic exercise, behavioral therapy.",
    "Arthritis": "Anti-inflammatory diet, joint-friendly exercises, physical therapy, NSAIDs as advised.",
    "Depression": "Psychotherapy, medication if needed, regular exercise, maintain social connections.",
    "Kidney Disease": "Low-protein diet, control BP and diabetes, stay hydrated, regular kidney tests.",
    "Liver Disease": "Avoid alcohol, hepatitis vaccinations, healthy diet, regular liver function tests.",
    "Healthy (No Disease)": "Maintain lifestyle, annual health check-ups, balanced diet, regular exercise."
  };

  const grid = document.getElementById('encGrid');
  grid.innerHTML = '';

  Object.entries(DISEASE_META).forEach(([name, meta]) => {
    const card = document.createElement('div');
    card.className = 'enc-card';
    card.innerHTML = `
      <div class="enc-card-header">
        <div class="enc-name">${meta.icon} ${name}</div>
        <div class="enc-gender-bias">${meta.genderBias}</div>
      </div>
      <div class="enc-age-range">📅 Peak risk: Ages ${meta.ageRange}</div>
      <div class="enc-advice">${ADVICE_MAP[name] || 'Consult your physician regularly.'}</div>
    `;
    card.onclick = () => {
      card.classList.toggle('expanded');
    };
    grid.appendChild(card);
  });
}

// ─── Nav Status ─────────────────────────────────────────────────
function updateNavStatus(online) {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  dot.className = `status-dot ${online ? 'online' : 'offline'}`;
  text.textContent = online ? 'API Online' : 'Offline';
}

// ─── Gender Selection ────────────────────────────────────────────
function selectGender(gender) {
  state.gender = gender;
  document.getElementById('genderMale').classList.toggle('active', gender === 'Male');
  document.getElementById('genderFemale').classList.toggle('active', gender === 'Female');
}

// ─── Age Slider ──────────────────────────────────────────────────
const ageSlider = document.getElementById('ageSlider');
const ageDisplay = document.getElementById('ageDisplay');
const ageGroupBadge = document.getElementById('ageGroupBadge');

ageSlider.addEventListener('input', () => {
  state.age = parseInt(ageSlider.value);
  ageDisplay.textContent = state.age;
  ageGroupBadge.textContent = getAgeGroup(state.age);
  updateSliderFill(ageSlider);
});

// Init slider fill
updateSliderFill(ageSlider);
ageGroupBadge.textContent = getAgeGroup(30);

// ─── Run Prediction ──────────────────────────────────────────────
async function runPrediction() {
  const btn = document.getElementById('predictBtn');
  const btnText = document.getElementById('predictBtnText');
  const spinner = document.getElementById('predictSpinner');

  // Loading state
  btn.disabled = true;
  btnText.textContent = 'Analyzing...';
  spinner.style.display = 'block';

  // Show placeholder while loading
  document.getElementById('resultsPlaceholder').style.display = 'flex';
  document.getElementById('predictionResults').style.display = 'none';

  try {
    const result = await apiPost('/predict', { age: state.age, gender: state.gender });
    state.lastPrediction = result;
    displayPredictionResults(result);
  } catch (e) {
    showToast(`Prediction failed: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Analyze Risk Profile';
    spinner.style.display = 'none';
  }
}

// ─── Display Prediction Results ──────────────────────────────────
function displayPredictionResults(data) {
  const { age, gender, age_group, predictions, future_risks } = data;

  // Profile
  document.getElementById('profileIcon').textContent = gender === 'Male' ? '👨' : '👩';
  document.getElementById('profileName').textContent = `${gender}, Age ${age}`;
  document.getElementById('profileAgeGroup').textContent = age_group;

  // Top confidence mini doughnut
  const topConf = predictions[0].confidence;
  const rColor = RISK_COLORS[predictions[0].risk_level] || '#4facfe';
  setTimeout(() => renderConfidenceDoughnut(topConf, rColor), 100);

  // Disease cards
  const cardsContainer = document.getElementById('diseaseCards');
  cardsContainer.innerHTML = '';

  const maxConf = predictions[0].confidence;

  predictions.forEach((pred, i) => {
    const card = document.createElement('div');
    card.className = 'disease-card';
    card.style.animationDelay = `${i * 80}ms`;

    const barWidth = maxConf > 0 ? (pred.confidence / maxConf * 100) : 0;
    const barColor = i === 0 ? rColor : PALETTE[(i+2) % PALETTE.length];

    card.innerHTML = `
      <span class="dc-rank">#${i + 1}</span>
      <div class="dc-name" title="${pred.advice}">${DISEASE_META[pred.disease]?.icon || '🔬'} ${pred.disease}</div>
      <div class="dc-bar-wrap">
        <div class="dc-bar" style="width: ${barWidth}%; background: ${barColor}"></div>
      </div>
      <span class="dc-pct">${pred.confidence}%</span>
      <span class="dc-risk risk-${pred.risk_level.toLowerCase()}">${pred.risk_level}</span>
    `;

    // Tooltip on hover for advice
    card.title = pred.advice;
    cardsContainer.appendChild(card);
  });

  // Future risks
  const futureContainer = document.getElementById('futureRisks');
  futureContainer.innerHTML = '';

  Object.entries(future_risks).forEach(([futureAge, risks]) => {
    if (parseInt(futureAge) <= age) return;
    const card = document.createElement('div');
    card.className = 'future-card';
    const top = risks[0];
    const yearsDiff = parseInt(futureAge) - age;
    card.innerHTML = `
      <div class="future-age">In ${yearsDiff} years (Age ${futureAge})</div>
      <div class="future-disease">${DISEASE_META[top.disease]?.icon || '🔬'} ${top.disease}</div>
      <div class="future-pct">${top.confidence}% risk</div>
    `;
    futureContainer.appendChild(card);
  });

  // Show results
  document.getElementById('resultsPlaceholder').style.display = 'none';
  const resultsEl = document.getElementById('predictionResults');
  resultsEl.style.display = 'block';
  resultsEl.style.animation = 'none';
  void resultsEl.offsetWidth;
  resultsEl.style.animation = 'fadeIn 0.4s ease';

  showToast('✅ Analysis complete!', 'success');

  // Scroll to results on mobile
  if (window.innerWidth < 768) {
    setTimeout(() => {
      document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });
    }, 200);
  }
}

// ─── Boot ────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initApp);
