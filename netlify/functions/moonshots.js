// CommonJS Netlify Function – Moonshotid (<$100M cap) CoinGecko pealt (tasuta).
const CG = 'https://api.coingecko.com/api/v3';

// Väike viide, et CoinGecko't mitte "koputada"
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

exports.handler = async () => {
  try {
    // Võtame kuni 4 lehte (1000 koini) turukapitali ASC järgi – väiksed esimesena
    const pages = [];
    for (let p = 1; p <= 4; p++) {
      pages.push(cg('/coins/markets', {
        vs_currency: 'usd',
        order: 'market_cap_asc',
        per_page: 250,
        page: p,
        sparkline: false,
        price_change_percentage: '1h,24h,7d'
      }));
      await sleep(200); // viisakuspaus
    }
    const all = (await Promise.all(pages)).flat();

    // Esmane filter: cap < 100M, hind > 0
    let base = all.filter(c =>
      isNum(c.market_cap) && c.market_cap > 0 && c.market_cap < 100_000_000 &&
      isNum(c.current_price) && c.current_price > 0
    );

    // Sorteerime 24h mahu järgi (likviidsus)
    base.sort((a,b) => (b.total_volume ?? 0) - (a.total_volume ?? 0));

    // Vali kuni 40 kandidaati süvavaatluseks (7p volume chart)
    const toCheck = base.slice(0, 40);

    const out = [];
    for (const c of toCheck) {
      // Püüame võtta 7 päeva graafiku; kui ebaõnnestub, teeme heuristika vaid hinna põhjal
      let volUp = null, pxUp = null;
      try {
        const chart = await cg(`/coins/${c.id}/market_chart`, {
          vs_currency: 'usd', days: 7, interval: 'daily'
        });
        const vols = Array.isArray(chart?.total_volumes) ? chart.total_volumes.map(v => v[1]) : [];
        const prices = Array.isArray(chart?.prices) ? chart.prices.map(v => v[1]) : [];
        const avgVol = mean(vols.slice(0, Math.max(0, vols.length - 1)));
        const lastVol = vols[vols.length - 1] ?? null;
        volUp = (isNum(avgVol) && isNum(lastVol)) ? (lastVol > avgVol * 1.2) : null;
        const p7 = prices[0], pNow = prices[prices.length - 1];
        pxUp = (isNum(p7) && isNum(pNow)) ? (pNow > p7) : null;
      } catch { /* ignoreerime – jätkame hinna % järgi */ }

      const ch7 = num(c.price_change_percentage_7d_in_currency);
      const ch24 = num(c.price_change_percentage_24h_in_currency);

      // Heuristika: nõuame vähemalt üht signaali (kas 7d hind ↑ või volUp true)
      const hasSignal = (isNum(ch7) && ch7 > 0) || (volUp === true);

      if (hasSignal) {
        // Skoor: mahukasv + hinna 7d kasv; väike boonus 24h > 0; likviidsus boonus
        const score =
          (volUp === true ? 1.0 : 0) +
          ((isNum(ch7) && ch7 > 0) ? Math.min(ch7 / 30, 1) * 1.0 : 0) +
          ((isNum(ch24) && ch24 > 0) ? 0.3 : 0) +
          Math.min((c.total_volume ?? 0) / 2e6, 1) * 0.4;

        out.push({
          id: c.id,
          name: c.name,
          symbol: String(c.symbol || '').toUpperCase(),
          price_usd: num(c.current_price),
          mcap: num(c.market_cap),
          vol24: num(c.total_volume),
          ch24,
          ch7,
          vol_up: (volUp === true),
          px_up: (pxUp === true),
          score: Math.round(score * 100) / 100
        });
      }

      await sleep(150); // väike viide iga graafikupäringu järel
    }

    // Kui out jäi väga väikseks (nt CG throttling), täida baasselektsioonist hinnatrendiga
    if (out.length < 5) {
      const fallback = base
        .filter(c => (num(c.price_change_percentage_7d_in_currency) ?? 0) > 0)
        .slice(0, 15 - out.length)
        .map(c => ({
          id: c.id,
          name: c.name,
          symbol: String(c.symbol || '').toUpperCase(),
          price_usd: num(c.current_price),
          mcap: num(c.market_cap),
          vol24: num(c.total_volume),
          ch24: num(c.price_change_percentage_24h_in_currency),
          ch7: num(c.price_change_percentage_7d_in_currency),
          vol_up: null,
          px_up: null,
          score: Math.round(((c.price_change_percentage_7d_in_currency ?? 0) / 30) * 100) / 100
        }));
      out.push(...fallback);
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
