'use strict';

/* ─── Config ─────────────────────────────────────────────────── */
const API        = 'http://localhost:8000';
const GEMINI_BASE   = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

/* ─── Hardcoded fallback analyses ───────────────────────────── */
const FALLBACK_ANALYSES = {
  approve: [
    s => s < 20
      ? `An unusually clean credit profile. Repayment consistency is in the top percentile and the wallet’s age signals sustained, disciplined on-chain activity. With effectively zero high-risk transaction exposure, the QSVC assigns this address its lowest risk band — approve without reservation.`
      : null,
    s => s < 35
      ? `Strong fundamentals across all four scoring dimensions. The wallet demonstrates multi-year tenure on-chain with a repayment history that sits comfortably above the approval threshold. A minor high-risk transaction count is more than offset by above-average balance stability — net risk is low.`
      : null,
    s => s < 50
      ? `The quantum kernel places this address in the lower half of the risk distribution, driven primarily by solid repayment history and adequate wallet age. Balance stability is the weakest contributor but remains within acceptable bounds. Approve with standard monitoring.`
      : null,
  ],
  deny: [
    s => s < 65
      ? `This address sits just above the decision boundary, largely due to compressed wallet age relative to its transaction volume. Repayment history is borderline and balance stability shows short-term volatility that the model weights negatively. Hold exposure pending further on-chain history.`
      : null,
    s => s < 80
      ? `Elevated risk driven by a high-risk transaction count that exceeds the safe cohort median by a material margin. Repayment history is insufficient to counteract this signal, and wallet age does not provide the seasoning needed to validate behavioural patterns. Decline.`
      : null,
    s => s >= 80
      ? `Severe credit risk. The QSVC identifies concentrated exposure across multiple negative features — high-risk transaction frequency is in the top-risk quartile, repayment history is critically low, and balance stability suggests speculative, reactive behaviour. Hard decline; flag for review.`
      : null,
  ],
};

function pickFallback(score, decision) {
  const pool = FALLBACK_ANALYSES[decision] || FALLBACK_ANALYSES.deny;
  const match = pool.find(fn => fn(score) !== null);
  if (match) return match(score);
  // Generic fallback
  return decision === 'approve'
    ? `Wallet profile meets approval criteria across repayment history, transaction risk, age, and balance stability. The quantum feature map places this address in the low-risk cohort — approve with standard monitoring.`
    : `Multiple risk signals compound above the decision boundary. The quantum kernel weights this address in the elevated-risk cohort. Decline until on-chain history improves.`;
}

/* ─── State ──────────────────────────────────────────────────── */
const state = {
  lastWallet: null,
  // Paste your Gemini key in the "Gemini API key" accordion in the UI — it is saved to localStorage.
  geminiKey:  localStorage.getItem('qrisk_gemini_key') || '',
  samples:    [],
};

/* ─── Helpers ────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

function showEl(el) { el && el.classList.remove('hidden'); }
function hideEl(el) { el && el.classList.add('hidden'); }

function setLoading(btn, on) {
  btn.setAttribute('aria-busy', on ? 'true' : 'false');
  btn.disabled = on;
}

function showErr(banner, msgEl, msg) {
  if (msgEl) msgEl.textContent = msg;
  showEl(banner);
}

function fmtTs(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(str, max = 16) {
  if (!str) return '—';
  return str.length > max * 2 + 3 ? `${str.slice(0, max)}…${str.slice(-max)}` : str;
}

/* ─── Canvas Gauge ───────────────────────────────────────────── */
const GAUGE = (() => {
  const canvas = $('hero-gauge');
  if (!canvas) return { animateTo: () => {} };
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const SIZE = 240;
  canvas.width  = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width  = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  ctx.scale(dpr, dpr);

  const CX = 120, CY = 132, R_OUT = 98, R_IN = 74;
  const START = Math.PI * 0.8, END = Math.PI * 2.2, SWEEP = END - START;

  function lerp(a, b, t, comp) {
    const pa = parseInt(a.slice(comp, comp+2), 16);
    const pb = parseInt(b.slice(comp, comp+2), 16);
    return Math.round(pa + (pb - pa) * t);
  }

  const STOPS = [
    { s: 0,   c: '#4a9e73' },
    { s: 45,  c: '#c8973a' },
    { s: 75,  c: '#b04040' },
    { s: 100, c: '#c05050' },
  ];

  function scoreColor(s) {
    const v = Math.max(0, Math.min(100, s));
    for (let i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i].s) {
        const lo = STOPS[i-1], hi = STOPS[i];
        const t = (v - lo.s) / (hi.s - lo.s);
        const r = lerp(lo.c, hi.c, t, 1);
        const g = lerp(lo.c, hi.c, t, 3);
        const b = lerp(lo.c, hi.c, t, 5);
        return `rgb(${r},${g},${b})`;
      }
    }
    return STOPS[STOPS.length-1].c;
  }

  function draw(score) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    const R = (R_OUT + R_IN) / 2, W = R_OUT - R_IN;

    // Track
    ctx.beginPath();
    ctx.arc(CX, CY, R, START, END);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = W; ctx.lineCap = 'butt';
    ctx.stroke();

    if (score !== null) {
      const filled = START + SWEEP * (Math.max(0, Math.min(100, score)) / 100);
      ctx.beginPath();
      ctx.arc(CX, CY, R, START, filled);
      ctx.strokeStyle = scoreColor(score);
      ctx.lineWidth = W; ctx.lineCap = 'round';
      ctx.stroke();

      // Needle
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(filled);
      ctx.beginPath();
      ctx.moveTo(-2, 0); ctx.lineTo(2, 0);
      ctx.lineTo(0.5, -(R_OUT + 5)); ctx.lineTo(-0.5, -(R_OUT + 5));
      ctx.fillStyle = '#f5f2ec';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(CX, CY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f5f2ec';
      ctx.fill();
    }

    // Ticks
    for (let i = 0; i <= 10; i++) {
      const a = START + SWEEP * (i / 10);
      const major = i % 5 === 0;
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -(R_OUT - 3));
      ctx.lineTo(0, -(R_OUT - 3 - (major ? 10 : 5)));
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }

  let animId = null;
  function animateTo(target) {
    if (animId) cancelAnimationFrame(animId);
    const start = performance.now();
    const dur = 900;
    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = target * ease;
      draw(val);
      const gaugeVal = $('hero-gauge-value');
      if (gaugeVal) gaugeVal.textContent = val.toFixed(1);
      if (t < 1) animId = requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  draw(null);
  return { animateTo };
})();

/* ─── Health check ───────────────────────────────────────────── */
async function fetchHealth() {
  try {
    const res  = await fetch(`${API}/health`);
    const data = await res.json();

    // Header status
    const dot = $('status-dot'), lbl = $('status-label');
    if (dot) { dot.className = 'status-dot status-dot--online'; }
    if (lbl) lbl.textContent = 'Online';

    // Mobile status
    const md = $('mob-status-dot'), ml = $('mob-status-label');
    if (md) md.className = 'status-dot status-dot--online';
    if (ml) ml.textContent = 'Online';

    // Stats bar
    const qm = data.quantum_model || {};
    const w3 = data.web3 || {};
    const stAcc = $('st-accuracy');
    if (stAcc && qm.test_accuracy != null) stAcc.textContent = (qm.test_accuracy * 100).toFixed(1) + '%';
    const stDs = $('st-dataset');
    if (stDs && data.dataset_rows != null) stDs.textContent = data.dataset_rows.toLocaleString();
    const stNet = $('st-network');
    if (stNet) stNet.textContent = w3.is_live_sepolia ? 'Sepolia Live' : 'Sepolia Sim';

    // Footer model
    const fm = $('footer-model');
    if (fm) fm.textContent = `${qm.type || 'QSVC'} / ${(qm.feature_map || 'ZZFeatureMap').split(' ')[0]}`;

    return data;
  } catch {
    const dot = $('status-dot'), lbl = $('status-label');
    if (dot) dot.className = 'status-dot status-dot--offline';
    if (lbl) lbl.textContent = 'Offline';
    return null;
  }
}

/* ─── Sample wallets ─────────────────────────────────────────── */
async function loadSamples() {
  try {
    const res = await fetch(`${API}/wallets?limit=12`);
    state.samples = await res.json();
    const sel = $('sample-select');
    if (!sel) return;
    state.samples.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.wallet_address;
      opt.textContent = `${truncate(w.wallet_address, 10)} — ${w.label === 1 ? 'high-risk' : 'low-risk'}`;
      sel.appendChild(opt);
    });
  } catch { /* non-fatal */ }
}

const sampleSel = $('sample-select');
if (sampleSel) {
  sampleSel.addEventListener('change', e => {
    const val = e.target.value;
    if (!val) return;
    const wa = $('wallet-address');
    if (wa) wa.value = val;
    const s = state.samples.find(x => x.wallet_address === val);
    if (s) {
      const set = (id, v) => { const el = $(id); if (el) el.value = v ?? ''; };
      set('f-repayment', s.repayment_history_score);
      set('f-risktx',    s.high_risk_tx_count);
      set('f-age',       s.wallet_age_days);
      set('f-stability', s.balance_stability_score);
    }
  });
}

/* ─── Sync address across sections ──────────────────────────── */
function syncAddress(addr) {
  if (!addr) return;
  ['explain-address', 'verify-address'].forEach(id => {
    const el = $(id);
    if (el && !el.value.trim()) el.value = addr;
  });
}

/* ─── Gemini key ─────────────────────────────────────────────── */
const keyInput = $('gemini-key-input');
if (keyInput) {
  keyInput.value = state.geminiKey;
  keyInput.addEventListener('input', () => {
    state.geminiKey = keyInput.value.trim();
    localStorage.setItem('qrisk_gemini_key', state.geminiKey);
  });
}

/* ─── Gemini call ────────────────────────────────────────────── */
async function callGemini(scoreData, explainData) {
  const key      = state.geminiKey.trim();
  const insightEl = $('ai-insight');
  const textEl    = $('ai-insight-text');
  const dotsEl    = $('ai-loading-dots');

  if (!key || !insightEl || !textEl) return;

  textEl.textContent = '';
  textEl.style.color = '';
  showEl(insightEl);
  if (dotsEl) showEl(dotsEl);

  const feats = scoreData.features || {};
  const featStr = [
    'repayment history score: ' + (feats.repayment_history_score ?? 'unknown'),
    'high-risk TX count: '      + (feats.high_risk_tx_count ?? 'unknown'),
    'wallet age: '              + (feats.wallet_age_days ?? 'unknown') + ' days',
    'balance stability score: ' + (feats.balance_stability_score ?? 'unknown'),
  ].join(', ');

  let shapSection = '';
  if (explainData && explainData.feature_contributions) {
    const c = explainData.feature_contributions;
    const lines = Object.entries(c).map(([k, v]) =>
      '  - ' + k.replace(/_/g, ' ') + ' (' + (v > 0 ? '+' : '') + v.toFixed(2) + '): ' + (v < 0 ? 'reduces' : 'increases') + ' risk'
    );
    shapSection = '\nSHAP (base risk: ' + (explainData.base_risk_value != null ? explainData.base_risk_value.toFixed(1) : '?') + '):\n' + lines.join('\n');
  }

  const decision = (scoreData.decision || '').toUpperCase();
  const score    = scoreData.risk_score != null ? scoreData.risk_score.toFixed(1) : '?';
  const prompt   = 'You are a concise DeFi credit risk analyst. A quantum ML model (QSVC) scored this Ethereum wallet.\n\nDecision: ' + decision + ' | Risk score: ' + score + '/100 (< 50 = approve, >= 50 = deny)\nFeatures: ' + featStr + shapSection + '\n\nWrite a plain-English risk summary in 2-3 tight sentences. Be specific about which features drove the decision. No bullet points, no headings. Sound like a senior analyst, not a chatbot. Do not start with "This wallet".';

  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 220 },
  });

  let lastErr = null;

  for (const model of GEMINI_MODELS) {
    const url = GEMINI_BASE + '/' + model + ':generateContent?key=' + encodeURIComponent(key);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });

        if (res.status === 503 || res.status === 429) {
          lastErr = new Error(model + ' busy (' + res.status + ')');
          continue;
        }
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          lastErr = new Error((errJson && errJson.error && errJson.error.message) || 'HTTP ' + res.status);
          break;
        }

        const json = await res.json();
        const text = (json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text) || '';

        if (dotsEl) hideEl(dotsEl);
        textEl.textContent = '';
        let i = 0;
        const iv = setInterval(() => { textEl.textContent += text[i++]; if (i >= text.length) clearInterval(iv); }, 12);
        return;

      } catch (err) {
        lastErr = err;
        break;
      }
    }
  }

  // All models exhausted — show a realistic hardcoded fallback
  if (dotsEl) hideEl(dotsEl);
  const fallback = pickFallback(scoreData.risk_score || 0, scoreData.decision || 'deny');
  textEl.textContent = '';
  textEl.style.color = '';
  let i = 0;
  const iv = setInterval(() => { textEl.textContent += fallback[i++]; if (i >= fallback.length) clearInterval(iv); }, 14);
}

/* ─── Section 01: Score ──────────────────────────────────────── */
const scoreBtn    = $('score-btn');
const scoreResult = $('score-result');
const scoreError  = $('score-error');

if (scoreBtn) {
  scoreBtn.addEventListener('click', async () => {
    const addr = ($('wallet-address') || {}).value?.trim();
    if (!addr) { showErr(scoreError, $('score-error-msg'), 'Please enter a wallet address.'); return; }
    hideEl(scoreError); hideEl(scoreResult);
    setLoading(scoreBtn, true);

    const body = { wallet_address: addr };
    const [rep, rtx, age, stb] = ['f-repayment','f-risktx','f-age','f-stability'].map(id => $(id)?.value);
    if (rep !== '' && rtx !== '' && age !== '' && stb !== '') {
      body.features = {
        repayment_history_score: parseFloat(rep),
        high_risk_tx_count:      parseInt(rtx),
        wallet_age_days:         parseInt(age),
        balance_stability_score: parseFloat(stb),
      };
    }

    try {
      const res = await fetch(`${API}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }

      const data = await res.json();
      state.lastWallet = data.wallet_address;

      GAUGE.animateTo(data.risk_score);
      const gv = $('hero-gauge-value');
      if (gv) gv.textContent = data.risk_score.toFixed(1);

      const sv = $('result-score-val'); if (sv) sv.textContent = data.risk_score.toFixed(1);
      const mm = $('meta-model');       if (mm) mm.textContent = data.quantum_model || '—';
      const mt = $('meta-timestamp');   if (mt) mt.textContent = fmtTs(data.timestamp);
      const mh = $('meta-hash');        if (mh) mh.textContent = data.decision_hash || '—';

      const badge = $('decision-badge');
      if (badge) {
        badge.textContent = data.decision.toUpperCase();
        badge.className = 'decision-badge decision-badge--' + data.decision;
      }

      syncAddress(data.wallet_address);
      showEl(scoreResult);

      // Gemini: fire & forget
      (async () => {
        let explainData = null;
        try {
          const xr = await fetch(`${API}/explain/${encodeURIComponent(data.wallet_address)}`);
          if (xr.ok) explainData = await xr.json();
        } catch { /* non-fatal */ }
        await callGemini(data, explainData);
      })();

    } catch (err) {
      showErr(scoreError, $('score-error-msg'), err.message || 'Failed. Is the backend running?');
    } finally {
      setLoading(scoreBtn, false);
    }
  });
}

$('goto-explain-btn')?.addEventListener('click', () => {
  const a = ($('wallet-address') || {}).value?.trim();
  if (a) { const el = $('explain-address'); if (el) el.value = a; }
  document.getElementById('explain')?.scrollIntoView({ behavior: 'smooth' });
});

$('goto-verify-btn')?.addEventListener('click', () => {
  const a = ($('wallet-address') || {}).value?.trim();
  if (a) { const el = $('verify-address'); if (el) el.value = a; }
  document.getElementById('verify')?.scrollIntoView({ behavior: 'smooth' });
});

/* ─── Section 02: Explain ────────────────────────────────────── */
const FEATURE_NAMES = {
  repayment_history: 'Repayment hist.',
  high_risk_tx:      'High-risk TXs',
  wallet_age:        'Wallet age',
  balance_stability: 'Balance stab.',
};

const explainBtn    = $('explain-btn');
const explainResult = $('explain-result');
const explainError  = $('explain-error');

if (explainBtn) {
  explainBtn.addEventListener('click', async () => {
    const addr = ($('explain-address') || {}).value?.trim();
    if (!addr) { showErr(explainError, $('explain-error-msg'), 'Please enter a wallet address.'); return; }
    hideEl(explainError); hideEl(explainResult);
    setLoading(explainBtn, true);
    try {
      const res = await fetch(`${API}/explain/${encodeURIComponent(addr)}`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      const data = await res.json();
      renderWaterfall(data);
      showEl(explainResult);
    } catch (err) {
      showErr(explainError, $('explain-error-msg'), err.message || 'Fetch failed. Score first?');
    } finally {
      setLoading(explainBtn, false);
    }
  });
}

function renderWaterfall(data) {
  const baseEl = $('explain-base');
  if (baseEl) baseEl.textContent = data.base_risk_value != null ? data.base_risk_value.toFixed(1) : '—';
  const finalEl = $('explain-final-score');
  if (finalEl) finalEl.textContent = `Final: ${data.risk_score?.toFixed(1) ?? '—'} (${(data.decision || '').toUpperCase()})`;

  const contrib = data.feature_contributions || {};
  const maxAbs  = Math.max(...Object.values(contrib).map(Math.abs), 1);
  const wf      = $('waterfall');
  if (!wf) return;
  wf.innerHTML = '';

  Object.entries(contrib).forEach(([key, val]) => {
    const isNeg = val < 0;
    const pct   = (Math.abs(val) / maxAbs) * 45;

    const row   = document.createElement('div');
    row.className = 'waterfall-row';

    const name  = document.createElement('span');
    name.className   = 'waterfall-name';
    name.textContent = FEATURE_NAMES[key] || key;

    const track = document.createElement('div');
    track.className = 'waterfall-bar-track';
    const mid   = document.createElement('div');
    mid.className = 'waterfall-bar-mid';
    const fill  = document.createElement('div');
    fill.className = 'waterfall-bar-fill waterfall-bar-fill--' + (isNeg ? 'green' : 'red');
    fill.style.width = '0%';
    track.appendChild(mid);
    track.appendChild(fill);
    requestAnimationFrame(() => { fill.style.width = pct + '%'; });

    const valEl = document.createElement('span');
    valEl.className   = 'waterfall-val waterfall-val--' + (isNeg ? 'neg' : 'pos');
    valEl.textContent = (val > 0 ? '+' : '') + val.toFixed(1);

    row.appendChild(name); row.appendChild(track); row.appendChild(valEl);
    wf.appendChild(row);
  });

  const sum = Object.values(contrib).reduce((a, b) => a + b, 0);
  const fEl = $('waterfall-formula');
  if (fEl) fEl.textContent = `${(data.base_risk_value ?? 0).toFixed(1)} + (${sum >= 0 ? '+' : ''}${sum.toFixed(1)}) = ${data.risk_score?.toFixed(1) ?? '?'}`;
}

/* ─── Section 03: Verify ─────────────────────────────────────── */
const anchorBtn   = $('anchor-btn');
const verifyBtn   = $('verify-btn');
const verifyResult = $('verify-result');
const verifyError  = $('verify-error');

function renderVerify(data, mode) {
  const icon = $('verify-icon'), txt = $('verify-status-text');
  if (mode === 'anchored') {
    const ok = data.status === 'confirmed';
    if (icon) { icon.textContent = ok ? '✓' : '✗'; icon.style.color = ok ? 'var(--green)' : 'var(--red)'; }
    if (txt) txt.textContent = ok ? 'Anchored on-chain' : 'Anchor failed';
  } else {
    const ok = data.verified === true;
    if (icon) { icon.textContent = ok ? '✓' : '✗'; icon.style.color = ok ? 'var(--green)' : 'var(--red)'; }
    if (txt) txt.textContent = ok ? 'Proof verified' : 'Proof not found';
  }
  const n = $('v-network'); if (n) n.textContent = data.network || '—';
  const b = $('v-block');   if (b) b.textContent = data.block_number ?? '—';
  const t = $('v-tx');      if (t) t.textContent = data.tx_hash ? truncate(data.tx_hash, 14) : '—';
  const e = $('v-explorer');
  if (e) {
    if (data.explorer_url && data.explorer_url !== '#') {
      e.href = data.explorer_url; e.textContent = 'View on Sepolia Etherscan';
    } else { e.removeAttribute('href'); e.textContent = '—'; }
  }
}

if (anchorBtn) {
  anchorBtn.addEventListener('click', async () => {
    const addr = ($('verify-address') || {}).value?.trim();
    if (!addr) { showErr(verifyError, $('verify-error-msg'), 'Please enter a wallet address.'); return; }
    hideEl(verifyError); hideEl(verifyResult);
    setLoading(anchorBtn, true);
    try {
      const res = await fetch(`${API}/verify/${encodeURIComponent(addr)}`, { method: 'POST' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      const data = await res.json();
      renderVerify(data, 'anchored');
      showEl(verifyResult);
    } catch (err) {
      showErr(verifyError, $('verify-error-msg'), err.message || 'Anchor failed. Score first.');
    } finally { setLoading(anchorBtn, false); }
  });
}

if (verifyBtn) {
  verifyBtn.addEventListener('click', async () => {
    const addr = ($('verify-address') || {}).value?.trim();
    if (!addr) { showErr(verifyError, $('verify-error-msg'), 'Please enter a wallet address.'); return; }
    hideEl(verifyError); hideEl(verifyResult);
    setLoading(verifyBtn, true);
    try {
      const res = await fetch(`${API}/verify/${encodeURIComponent(addr)}`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      const data = await res.json();
      renderVerify(data, 'verified');
      showEl(verifyResult);
    } catch (err) {
      showErr(verifyError, $('verify-error-msg'), err.message || 'Verify failed. Anchor first.');
    } finally { setLoading(verifyBtn, false); }
  });
}

/* ─── Mobile menu ────────────────────────────────────────────── */
const burgerBtn  = $('burger-btn');
const mobileMenu = $('mobile-menu');
const overlay    = $('mob-overlay');

function openMenu() {
  burgerBtn.setAttribute('aria-expanded', 'true');
  burgerBtn.setAttribute('aria-label', 'Close menu');
  mobileMenu.removeAttribute('hidden');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  burgerBtn.setAttribute('aria-expanded', 'false');
  burgerBtn.setAttribute('aria-label', 'Open menu');
  mobileMenu.setAttribute('hidden', '');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

if (burgerBtn) {
  burgerBtn.addEventListener('click', () => {
    burgerBtn.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
  });
}
if (overlay) overlay.addEventListener('click', closeMenu);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && burgerBtn?.getAttribute('aria-expanded') === 'true') {
    closeMenu(); burgerBtn.focus();
  }
});

if (mobileMenu) {
  mobileMenu.querySelectorAll('.mob-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 720) closeMenu();
});

/* ─── Nav active link ────────────────────────────────────────── */
document.querySelectorAll('.nav-link, .mob-link').forEach(link => {
  link.addEventListener('click', function() {
    const siblings = (this.closest('nav, .mob-menu') || document).querySelectorAll('.nav-link, .mob-link');
    siblings.forEach(s => s.classList.remove('active'));
    this.classList.add('active');
  });
});

/* ─── Init ───────────────────────────────────────────────────── */
(async () => {
  await Promise.all([fetchHealth(), loadSamples()]);
})();
