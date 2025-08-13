// CommonJS (Netlify Functions): ei kasuta ESM ega undici't
// Kasutab Node 18 sisseehitatud fetch'i

const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';

exports.handler = async () => {
  try {
    const key = process.env.CMC_API_KEY;
    if (!key) {
      return json(500, { error: 'Missing CMC_API_KEY environment variable' });
    }

    const url = new URL(`${CMC_BASE}/cryptocurrency/listings/latest`);
    url.searchParams.set('limit', '5000');   // kuni 5000 kirjet
    url.searchParams.set('convert', 'USD,EUR');
    // (vajadusel võiks lisada start=1)

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-CMC_PRO_API_KEY': key,
        'User-Agent': 'NetlifyCryptoMovers/1.0'
      }
    });

    // Kui CMC tagastab vea, anna detailne sisu edasi
    const text = await res.text();
    if (!res.ok) {
      // püüa JSON-iks parsida, kui võimalik
      let detail;
      try { detail = JSON.parse(text); } catch(e) { detail = text; }
      return json(res.status, { error: `CMC HTTP ${res.status}`, detail });
    }

    let jsonBody;
    try { jsonBody = JSON.parse(text); } catch(e) {
      return json(502, { error: 'Invalid JSON from CMC', detail: text?.slice?.(0, 400) });
    }

    const data = Array.isArray(jsonBody?.data) ? jsonBody.data : [];

    // Eemalda stabiilid
    const stable = new Set(['USDT','USDC','DAI','FDUSD','TUSD','BUSD']);
    const rows = data
      .filter(x => x?.symbol && !stable.has(String(x.symbol).toUpperCase()))
      .map(x => {
        const qUSD = x.quote?.USD || {};
        const qEUR = x.quote?.EUR || {};
        return {
          id: x.id,
          name: x.name,
          symbol: String(x.symbol || '').toUpperCase(),
          price_usd: num(qUSD.price),
          price_eur: num(qEUR.price),
          ch1: num(qUSD.percent_change_1h),
          ch24: num(qUSD.percent_change_24h),
          vol: num(qUSD.volume_24h),
          rsi: null
        };
      })
      .filter(r => typeof r.ch24 === 'number');

    const gainers = [...rows].sort((a,b) => (b.ch24 ?? -Infinity) - (a.ch24 ?? -Infinity)).slice(0,10);
    const losers  = [...rows].sort((a,b) => (a.ch24 ??  Infinity) - (b.ch24 ??  Infinity)).slice(0,10);

    return json(200, {
      generated_at: new Date().toISOString(),
      source: 'coinmarketcap',
      top_gainers_24h: gainers,
      top_losers_24h: losers
    });

  } catch (e) {
    return json(500, { error: 'Function crashed', detail: String(e?.message || e) });
  }
};

// --- helpers ---
function json(code, obj) {
  return {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(obj)
  };
}
function num(x) {
  return (x === null || x === undefined) ? null : Number(x);
}
