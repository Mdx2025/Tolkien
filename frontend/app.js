// app.js
// In dev auto-use http://127.0.0.1:8000.
// In prod (Vercel), set window.API_BASE = "https://your-backend-domain".
const isLocal = /^(localhost|127\.)/.test(location.hostname);
const API_BASE = (window.API_BASE || (isLocal ? 'http://127.0.0.1:8000' : '')).replace(/\/+$/, '');

function $(id){ return document.getElementById(id); }
const fmtUSD = (n) => `$${(Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
const fmtPct = (n) => `${(n>=0?'+':'')}${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1})}%`;

// Special price formatter for very small numbers
const fmtPrice = (n) => {
  const p = Number(n) || 0;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(8)}`;
  if (p > 0) return `$${p.toExponential(2)}`;
  return '$0.00';
};

// ----- Cache helpers (avoid zero flicker) -----
const CACHE_KEY = 'tolkien_dashboard_cache_v1';
const loadCache = () => { try{ const s = localStorage.getItem(CACHE_KEY); return s? JSON.parse(s): null; }catch{ return null; } };
const saveCache = (d) => { try{ localStorage.setItem(CACHE_KEY, JSON.stringify(d)); }catch{} };
const isUsable = (d) => !!d && (Number(d.price_usd) > 0 || Number(d.market_cap_usd) > 0 || (Array.isArray(d.transactions) && d.transactions.length>0));

function setWidth(el, pct){ if(!el) return; const v=Math.max(0, Math.min(100, Number(pct)||0)); el.style.width=`${v}%`; }

function renderDashboard(d){
  if ($('statPrice'))    $('statPrice').textContent    = fmtPrice(d.price_usd);
  if ($('statVolume'))   $('statVolume').textContent   = fmtPct(d.volume_change_pct);
  if ($('statBuybacks')) $('statBuybacks').textContent = fmtUSD(d.buybacks_usd);
  if ($('statBurned'))   $('statBurned').textContent   = fmtUSD(d.burned_usd);

  if ($('goalLabel'))    $('goalLabel').textContent    = `(${fmtUSD(d.market_cap_usd)} / ${fmtUSD(d.next_goal_usd)})`;
  if ($('goalPctLabel')) $('goalPctLabel').textContent = `${d.next_goal_progress_pct}%`;
  setWidth($('goalFill'), d.next_goal_progress_pct);

  if ($('burnPctLabel')) $('burnPctLabel').textContent = `${d.supply_burned_pct}%`;
  setWidth($('burnFill'), d.supply_burned_pct);

  // Update contract address
  if ($('contractAddress') && d.token_mint) {
    $('contractAddress').textContent = d.token_mint;
  }

  const list = $('txList'); if (!list) return;
  const cards = (d.transactions || []).map(tx => {
    const icon  = tx.kind==='burn'?'🔥':tx.kind==='buyback'?'🌀':tx.kind==='claim'?'💸':'ℹ️';
    const title = tx.kind==='burn'?'Burn transaction':tx.kind==='buyback'?'Buy-back':tx.kind==='claim'?'Claim creator fee':'Event';
    const meta  = `${(tx.kind||'').toUpperCase()} — ${tx.amount_sol??0} SOL`;
    const desc  = tx.description || '';
    const when  = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '';
    const href  = tx.signature ? `https://solscan.io/tx/${tx.signature}` : '#';
    const safe  = tx.signature ? `target="_blank" rel="noreferrer"` : '';
    return `
      <div class="card compact skinny flex-shrink-0 snap-start">
        <div class="flex items-center justify-center text-4xl text-neon mb-3">${icon}</div>
        <h3 class="font-semibold mb-1">${title}</h3>
        <div class="meta mb-2">${meta}</div>
        <p class="text-xs mb-4">${desc}<br><span class="opacity-60">${when}</span></p>
        <div><a href="${href}" ${safe} class="card-button block text-center">VIEW TRANSACTION</a></div>
      </div>`;
  });
  list.innerHTML = cards.join('') || `<div class="text-sm opacity-70 px-2">No recent transactions.</div>`;
}

async function fetchDashboard(){
  try{
    if (!API_BASE) return;
    const r = await fetch(`${API_BASE}/dashboard`, {cache:'no-store'});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    // Only render if usable. Persist last good.
    if (isUsable(data)) {
      saveCache(data);
      renderDashboard(data);
    }
  }catch(err){
    console.error('Fetch dashboard failed:', err);
  }
}

// Initial paint: use cache to avoid zero flicker
const initial = loadCache();
if (initial) renderDashboard(initial);
fetchDashboard();
setInterval(fetchDashboard, 5000);
