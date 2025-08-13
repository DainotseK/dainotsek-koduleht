import { fetch as undiciFetch } from 'undici';

const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';

export default async () => {
  try {
    const key = process.env.CMC_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing CMC_API_KEY env var' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Võtame kuni 5000 coin’i (CMC tasuta plaani piires)
    const url = new URL(`${CMC_BASE}/cryptocurrency/listings/latest`);
    url.searchParams.set('limit', '5000');
    url.searchParams.set('convert', 'USD,EUR');

    const res = await undiciFetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-CMC_PRO_API_KEY': key,
        'User-Agent': 'NetlifyCryptoMovers/1.0'
      }
    });
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: `CMC HTTP ${res.status}`, detail: txt }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      });
    }
    const json = await res.json();
    const data = Array.isArray(json?.data) ? json.data : [];

    // Eemaldame stabiilid
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
          price_usd: qUSD.price ?? null,
          price_eur: qEUR.price ?? null,
          ch1: qUSD.percent_change_1h ?? null,
          ch24: qUSD.percent_change_24h ?? null,
          vol: qUSD.volume_24h ?? null,
          // Hoidkem väljad samade nimedega, mida front ootab
          rsi: null // CMC ei anna sparkline'i – jätame tühjaks
        };
      })
      // eemaldame objektid, kus ch24 puudub (et sort toimiks)
      .filter(r => typeof r.ch24 === 'number');

    const gainers = [...rows].sort((a,b) => (b.ch24 ?? -Infinity) - (a.ch24 ?? -Infinity)).slice(0,10);
    const losers  = [...rows].sort((a,b) => (a.ch24 ?? Infinity) - (b.ch24 ?? Infinity)).slice(0,10);

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      source: 'coinmarketcap',
      top_gainers_24h: gainers,
      top_losers_24h: losers
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Server error', detail: String(e?.message || e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};
