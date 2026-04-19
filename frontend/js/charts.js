/* charts.js — All Chart.js visualizations */

const CHART_COLORS = {
  blue:   'rgba(99,  179, 237, 1)',
  coral:  'rgba(252, 129, 129, 1)',
  green:  'rgba(104, 211, 145, 1)',
  purple: 'rgba(183, 148, 244, 1)',
  gold:   'rgba(246, 224,  94, 1)',
  teal:   'rgba(79,  209, 197, 1)',
  orange: 'rgba(251, 182, 101, 1)',
  pink:   'rgba(246, 135, 179, 1)',
};

const PALETTE = Object.values(CHART_COLORS);

const CHART_DEFAULTS = {
  animation: { duration: 1000, easing: 'easeInOutQuart' },
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        font: { family: 'Inter', size: 11 },
        boxWidth: 12,
        padding: 15
      }
    },
    tooltip: {
      backgroundColor: 'rgba(10, 17, 40, 0.95)',
      borderColor: 'rgba(99, 179, 237, 0.3)',
      borderWidth: 1,
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: 'Inter', size: 12, weight: '600' },
      bodyFont: { family: 'Inter', size: 11 }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
    }
  }
};

let charts = {}; // Store chart instances

// ─── Gender Distribution Bar Chart ──────────────────────────────
function renderGenderChart(data) {
  if (charts.gender) charts.gender.destroy();
  const ctx = document.getElementById('genderChart').getContext('2d');

  const topDiseases = data.diseases.slice(0, 12);
  const maleSlice = data.male.slice(0, 12);
  const femaleSlice = data.female.slice(0, 12);
  const shortLabels = topDiseases.map(d => d.length > 16 ? d.slice(0, 14) + '…' : d);

  charts.gender = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shortLabels,
      datasets: [
        {
          label: 'Male',
          data: maleSlice,
          backgroundColor: 'rgba(99, 179, 237, 0.7)',
          borderColor: 'rgba(99, 179, 237, 1)',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Female',
          data: femaleSlice,
          backgroundColor: 'rgba(246, 135, 179, 0.7)',
          borderColor: 'rgba(246, 135, 179, 1)',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, stacked: false },
        y: { ...CHART_DEFAULTS.scales.y, stacked: false }
      }
    }
  });
}

// ─── Disease Prevalence Doughnut ─────────────────────────────────
function renderPrevalenceChart(data) {
  if (charts.prevalence) charts.prevalence.destroy();
  const ctx = document.getElementById('prevalenceChart').getContext('2d');

  const entries = Object.entries(data)
    .filter(([k]) => k !== 'Healthy (No Disease)')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = entries.map(([k]) => k.length > 18 ? k.slice(0, 16) + '…' : k);
  const values = entries.map(([, v]) => v);

  charts.prevalence = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: PALETTE.map(c => c.replace('1)', '0.75)')),
        borderColor: PALETTE,
        borderWidth: 1.5,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      animation: { duration: 1200, easing: 'easeInOutBounce' },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 },
            boxWidth: 10,
            padding: 8
          }
        },
        tooltip: { ...CHART_DEFAULTS.plugins.tooltip }
      }
    }
  });
}

// ─── Age Group Line Chart ────────────────────────────────────────
function renderAgeGroupChart(data) {
  if (charts.ageGroup) charts.ageGroup.destroy();
  const ctx = document.getElementById('ageGroupChart').getContext('2d');

  // Pick top 6 diseases for lines
  const diseasesToShow = data.diseases
    .filter(d => d !== 'Healthy (No Disease)')
    .slice(0, 6);

  const disIdx = diseasesToShow.map(d => data.diseases.indexOf(d));

  const datasets = diseasesToShow.map((disease, i) => {
    const color = PALETTE[i % PALETTE.length];
    return {
      label: disease,
      data: data.data.map(row => row[disIdx[i]] || 0),
      borderColor: color,
      backgroundColor: color.replace('1)', '0.08)'),
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: color,
      fill: false,
      tension: 0.45
    };
  });

  charts.ageGroup = new Chart(ctx, {
    type: 'line',
    data: { labels: data.age_groups, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200, easing: 'easeInOutQuart' },
      plugins: { ...CHART_DEFAULTS.plugins },
      scales: { ...CHART_DEFAULTS.scales },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

// ─── Heatmap (custom CSS grid) ────────────────────────────────────
function renderHeatmap(data) {
  const container = document.getElementById('heatmapContainer');
  container.innerHTML = '';

  const { age_groups, diseases, values } = data;

  // Compute max for normalization
  const maxVal = Math.max(...values.flat().filter(v => v > 0), 1);

  const table = document.createElement('table');
  table.className = 'heatmap-table';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(document.createElement('th')); // empty corner
  diseases.forEach(d => {
    const th = document.createElement('th');
    th.textContent = d.length > 12 ? d.slice(0, 10) + '…' : d;
    th.title = d;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Data rows
  const tbody = document.createElement('tbody');
  age_groups.forEach((ag, ri) => {
    const tr = document.createElement('tr');
    const label = document.createElement('td');
    label.className = 'row-label';
    label.textContent = ag;
    tr.appendChild(label);

    values[ri].forEach((val, ci) => {
      const td = document.createElement('td');
      const intensity = val / maxVal;
      const alpha = 0.1 + intensity * 0.85;
      const hue = 210 - intensity * 60; // blue → coral

      td.className = 'heatmap-cell';
      td.style.background = `hsla(${hue}, 70%, 60%, ${alpha})`;
      td.style.color = intensity > 0.4 ? '#e2e8f0' : '#64748b';
      td.style.fontSize = '0.65rem';
      td.style.fontWeight = '600';
      td.textContent = val > 0 ? val : '—';
      td.title = `${ag} × ${diseases[ci]}: ${val} patients`;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// ─── Risk Trends Line Chart ───────────────────────────────────────
let activeFilters = new Set();

function renderTrendsChart(data) {
  const { decades, diseases } = data;
  const diseaseNames = Object.keys(diseases);
  activeFilters = new Set(diseaseNames.slice(0, 5)); // default show first 5

  // Build filter buttons
  const filterContainer = document.getElementById('trendFilters');
  filterContainer.innerHTML = '';
  diseaseNames.forEach(name => {
    const btn = document.createElement('button');
    btn.className = `trend-filter-btn${activeFilters.has(name) ? ' active' : ''}`;
    btn.textContent = name.length > 18 ? name.slice(0, 16) + '…' : name;
    btn.title = name;
    btn.onclick = () => toggleTrendFilter(name, btn, data);
    filterContainer.appendChild(btn);
  });

  drawTrendsChart(data);
}

function toggleTrendFilter(name, btn, data) {
  if (activeFilters.has(name)) {
    if (activeFilters.size <= 1) return; // keep at least 1
    activeFilters.delete(name);
    btn.classList.remove('active');
  } else {
    activeFilters.add(name);
    btn.classList.add('active');
  }
  drawTrendsChart(data);
}

function drawTrendsChart(data) {
  if (charts.trends) charts.trends.destroy();
  const ctx = document.getElementById('trendsChart').getContext('2d');
  const { decades, diseases } = data;

  const datasets = Object.entries(diseases)
    .filter(([name]) => activeFilters.has(name))
    .map(([name, ageData], i) => {
      const color = PALETTE[i % PALETTE.length];
      return {
        label: name,
        data: decades.map(d => ageData[d] || 0),
        borderColor: color,
        backgroundColor: color.replace('1)', '0.05)'),
        borderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 9,
        pointBackgroundColor: color,
        pointBorderColor: '#060b18',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4
      };
    });

  charts.trends = new Chart(ctx, {
    type: 'line',
    data: {
      labels: decades.map(d => `Age ${d}s`),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeInOutQuart' },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        ...CHART_DEFAULTS.scales,
        y: {
          ...CHART_DEFAULTS.scales.y,
          title: {
            display: true,
            text: 'Patient Count',
            color: '#475569',
            font: { family: 'Inter', size: 10 }
          }
        }
      },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

// ─── Confidence Mini Doughnut (in predict results) ────────────────
let confidenceChart = null;

function renderConfidenceDoughnut(topConfidence, color = '#4facfe') {
  if (confidenceChart) confidenceChart.destroy();

  const ctx = document.getElementById('confidenceDoughnut').getContext('2d');
  const rest = 100 - topConfidence;

  confidenceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [topConfidence, rest],
        backgroundColor: [color, 'rgba(255,255,255,0.04)'],
        borderColor: [color, 'transparent'],
        borderWidth: [2, 0]
      }]
    },
    options: {
      responsive: false,
      cutout: '75%',
      animation: { duration: 1000, easing: 'easeInOutBack' },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      rotation: -90,
      circumference: 360
    }
  });

  // Draw text in center
  const plugin = {
    id: 'centerText',
    afterDraw(chart) {
      const { ctx, chartArea: { left, top, right, bottom } } = chart;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 13px Inter';
      ctx.fillText(`${topConfidence.toFixed(0)}%`, cx, cy);
      ctx.restore();
    }
  };

  // Re-add plugin inline since this is per-instance
  confidenceChart.config.plugins = [plugin];
  confidenceChart.update();
}
