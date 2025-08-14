// CommonJS Netlify Function.
// CMC: convert=USD (free plaan lubab 1 valuuta).
// FX: open.er-api.com (võtmeta) + fallback fawazahmed0 currency-api.

const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';

exports.handler = async () => {
  try {
    const key = process.env.CMC_API_KEY;
    if (!key) return json(500, { error: 'Missing CMC_API_KEY environment variable' });

    // 1) USD->EUR kursi toomine (tasuta, võtmeta)
    const usdToEur = await getUsdToEur();
    if (!usdToEur) {
      return json(502, { error: 'FX rate fetch failed', detail: 'Could not resolve USD->EUR from free sources' });
    }

    // 2) CMC: kuni 5000 kirjet, convert=USD (AINULT ÜKS free plaanis)
    const url = new URL(`${CMC_BASE}/cryptocurrency/listings/latest`);
    url.searchParams.set('limit', '5000');
    url.searchParams.set('convert', 'USD');

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-CMC_PRO_API_KEY': key,
        'User-Agent': 'NetlifyCryptoMovers/1.2'
      }
    });

    const text = await res.text();
    if (!res.ok) {
      let detail; try { detail = JSON.parse(text); } catch { detail = text; }
      return json(res.status, { error: `CMC HTTP ${res.status}`, detail });
    }

    let body; try { body = JSON.parse(text); } catch {
      return json(502, { error: 'Invalid JSON from CMC', detail: text?.slice?.(0, 400) });
    }

    const data = Array.isArray(body?.data) ? body.data : [];

    // Eemalda stabiilid
    const stable = new Set(['USDT','USDC','DAI','FDUSD','TUSD','BUSD']);
    const rows = data
      .filter(x => x?.symbol && !stable.has(String(x.symbol).toUpperCase()))
      .map(x => {
        const qUSD = x.quote?.USD || {};
        const price_usd = toNum(qUSD.price);
        return {
          id: x.id,
          name: x.name,
          symbol: String(x.symbol || '').toUpperCase(),
          price_usd,
          price_eur: isNum(price_usd) ? +(price_usd * usdToEur) : null,
          ch1: toNum(qUSD.percent_change_1h),
          ch24: toNum(qUSD.percent_change_24h),
          vol: toNum(qUSD.volume_24h),
          rsi: null
        };
      })
      .filter(r => typeof r.ch24 === 'number');

    const gainers = [...rows].sort((a,b) => (b.ch24 ?? -Infinity) - (a.ch24 ?? -Infinity)).slice(0,10);
    const losers  = [...rows].sort((a,b) => (a.ch24 ??  Infinity) - (b.ch24 ??  Infinity)).slice(0,10);

    return json(200, {
      generated_at: new Date().toISOString(),
      source: 'coinmarketcap + open.er-api.com (fallback: fawazahmed0)',
      usd_to_eur: Math.round(usdToEur * 1e6) / 1e6,
      top_gainers_24h: gainers,
      top_losers_24h: losers
    });

  } catch (e) {
    return json(500, { error: 'Function crashed', detail: String(e?.message || e) });
  }
};

// ---- helpers ----
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj)
  };
}
function toNum(x) { return (x === null || x === undefined) ? null : Number(x); }
function isNum(x) { return typeof x === 'number' && isFinite(x); }

// Tasuta FX: peamine allikas + fallback
async function getUsdToEur() {
  // Primary: open.er-api.com
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { headers: { 'Accept': 'application/json' } });
    if (r.ok) {
      const j = await r.json();
      const v = Number(j?.rates?.EUR);
      if (v && isFinite(v)) return v;
    }
  } catch(_) {}
  // Fallback: fawazahmed0 currency-api (GitHub CDN)
  try {
    const r = await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd.json', { headers: { 'Accept': 'application/json' } });
    if (r.ok) {
      const j = await r.json();
      const v = Number(j?.usd?.eur);
      if (v && isFinite(v)) return v;
    }
  } catch(_) {}
  return null;
}
