// CommonJS Netlify Function – Moonshotid (<$100M cap) CoinGecko pealt (tasuta).
const CG = 'https://api.coingecko.com/api/v3';

exports.handler = async () => {
  try {
    // 1) Võta kuni 500 väikest koini (cap ASC), 7p % näitajad kohe kaasas.
    const page1 = await cg('/coins/markets', {
      vs_currency: 'usd', order: 'market_cap_asc', per_page: 250, page: 1,
      sparkline: false, price_change_percentage: '1h,24h,7d'
    });
    const page2 = await cg('/coins/markets', {
      vs_currency: 'usd', order: 'market_cap_asc', per_page: 250, page: 2,
      sparkline: false, price_change_percentage: '1h,24h,7d'
    });
    const all = [...page1, ...page2];

    // 2) Esmane filter: cap < 100M, hind > 0, 7d % > 0 (hinna trend)
    let candidates = all.filter(c =>
      isNum(c.market_cap) && c.market_cap > 0 && c.market_cap < 100_000_000 &&
      isNum(c.current_price) && c.current_price > 0 &&
      isNum(c.price_change_percentage_7d_in_currency) &&
      c.price_change_percentage_7d_in_currency > 0
    );

    // 3) Võta likviidsuse järgi top (24h volume desc) – piirame 25 peale, et mitte limiiti lõhkuda
    candidates.sort((a,b) => (b.total_volume ?? 0) - (a.total_volume ?? 0));
    const toCheck = candidates.slice(0, 25);

    // 4) Kontrolli 7 päeva mahu trendi ja arvuta lihtne skoor
    const out = [];
    for (const c of toCheck) {
      const chart = await cg(`/coins/${c.id}/market_chart`, {
        vs_currency: 'usd', days: 7, interval: 'daily'
      });
      const vols = Array.isArray(chart?.total_volumes) ? chart.total_volumes.map(v => v[1]) : [];
      const prices = Array.isArray(chart?.prices) ? chart.prices.map(v => v[1]) : [];

      const avgVol = mean(vols.slice(0, Math.max(0, vols.length - 1)));
      const lastVol = vols[vols.length - 1] ?? null;
      const volUp = isNum(avgVol) && isNum(lastVol) ? (lastVol > avgVol * 1.2) : false;

      const p7 = prices[0], pNow = prices[prices.length - 1];
      const pxUp = (isNum(p7) && isNum(pNow) && pNow > p7);

      const score =
        (volUp ? 1 : 0) +
        (pxUp ? 1 : 0) +
        ((c.price_change_percentage_24h_in_currency ?? 0) > 0 ? 0.5 : 0) +
        Math.min((c.total_volume ?? 0) / 1e6, 1) * 0.5;

      out.push({
        id: c.id,
        name: c.name,
        symbol: String(c.symbol || '').toUpperCase(),
        price_usd: num(c.current_price),
        mcap: num(c.market_cap),
        vol24: num(c.total_volume),
        ch24: num(c.price_change_percentage_24h_in_currency),
        ch7: num(c.price_change_percentage_7d_in_currency),
        score: Math.round(score * 100) / 100,
        vol_up: volUp,
        px_up: pxUp
      });
    }

    out.sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
    const top = out.slice(0, 15);

    return json(200, {
      generated_at: new Date().toISOString(),
      count: top.length,
      items: top
    });
  } catch (e) {
    return json(500, { error: 'Moonshots failed', detail: String(e?.message || e) });
  }
};

// ---- helpers ----
async function cg(path, params={}) {
  const url = new URL(CG + path);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`CG ${path} HTTP ${r.status}`);
  return r.json();
}
function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}
function num(x){ return (x===null||x===undefined)?null:Number(x) }
function isNum(x){ return typeof x==='number' && isFinite(x) }
function mean(arr){ if(!arr.length) return null; return arr.reduce((a,b)=>a+(Number(b)||0),0)/arr.length; }
