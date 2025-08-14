// CommonJS Netlify Function – News + Market momentum -> Buy/Hold/Sell signals per asset.

const CG = 'https://api.coingecko.com/api/v3';
const NEWS_FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed'
];
const NITTER_BASES = ['https://nitter.net','https://nitter.poast.org','https://nitter.fdn.fr'];
const TWITTER_FEEDS = ['/elonmusk/rss','/realDonaldTrump/rss','/cz_binance/rss','/VitalikButerin/rss'];

// Märksõna-põhine sentiment
const BULL = ['etf approval','etf inflow','partnership','integration','mainnet','upgrade','halving','custody','adoption','bullish','record inflow','buy','accumulate'];
const BEAR = ['ban','hack','exploit','lawsuit','charges','sec sues','fine','outage','rug','delist','sell-off','bearish','crash','scam'];
const MAP = [
  { re:/\bbitcoin|\bbtc\b/i, asset:'BTC', ids:['bitcoin'] },
  { re:/\beth(ereum)?\b|\bsolidity\b/i, asset:'ETH', ids:['ethereum'] },
  { re:/\bdoge|dogecoin\b/i, asset:'DOGE', ids:['dogecoin'] },
  { re:/\bbnb\b|\bbinance\b/i, asset:'BNB', ids:['binancecoin'] },
  { re:/\bsolana|\bsol\b/i, asset:'SOL', ids:['solana'] },
  { re:/\bxrp\b|\bripple\b/i, asset:'XRP', ids:['ripple'] },
  { re:/\bcardano|\bada\b/i, asset:'ADA', ids:['cardano'] },
  { re:/\btron|\btrx\b/i, asset:'TRX', ids:['tron'] },
];

exports.handler = async () => {
  try {
    // 1) Võta turumoment CoinGecko Top-100 jaoks (USD)
    const mk = await cg('/coins/markets', {
      vs_currency: 'usd', order: 'market_cap_desc', per_page: 100, page: 1,
      sparkline: false, price_change_percentage: '1h,24h,7d'
    });
    const mom = new Map(mk.map(c => [c.id, {
      ch1: num(c.price_change_percentage_1h_in_currency),
      ch24: num(c.price_change_percentage_24h_in_currency),
      ch7: num(c.price_change_percentage_7d_in_currency),
      vol: num(c.total_volume)
    }]));

    // 2) Uudiste + sotsiaalsete pealkirjade kogumine
    const items = [];
    for (const feed of NEWS_FEEDS) {
      const xml = await getText(feed);
      items.push(...parseRSS(xml, 'news'));
    }
    for (const base of NITTER_BASES) {
      try {
        for (const path of TWITTER_FEEDS) {
          const xml = await getText(base + path);
          items.push(...parseRSS(xml, 'social'));
        }
        break;
      } catch { continue; }
    }

    // 3) Skoori pealkirjad, seo varadega
    const scored = items.map(i => {
      const t = (i.title || '').toLowerCase();
      let s = 0;
      if (BULL.some(k => t.includes(k))) s += 1;
      if (BEAR.some(k => t.includes(k))) s -= 1;
      if (/elon musk|@elonmusk|doge/.test(t)) s += 0.5;
      if (/donald trump|@realdonaldtrump|bitcoin/.test(t)) s += 0.3;
      if (/cz|binance|bnb/.test(t)) s += 0.4;
      if (/vitalik|ethereum|eth\b/.test(t)) s += 0.4;

      const assets = [];
      for (const m of MAP) if (m.re.test(t)) assets.push(m.asset);
      return { ...i, sentiment: +s.toFixed(2), assets };
    });

    // 4) Agregeeri per-asset: sentiment + turumoment
    const byAsset = {};
    for (const {asset, ids} of MAP) {
      const mentions = scored.filter(x => x.assets.includes(asset));
      const sentSum = mentions.reduce((a,b)=>a+(b.sentiment||0),0);
      const sentAvg = mentions.length ? sentSum/mentions.length : 0;

      // turumoment: võta esimese id mom, kui puudub – 0
      const m = mom.get(ids[0]) || {};
      const momScore =
        (isNum(m.ch24) ? clamp(m.ch24/5, -1, 1) * 0.6 : 0) +    // 24h tugevam kaal
        (isNum(m.ch7)  ? clamp(m.ch7/15, -1, 1) * 0.4 : 0);     // 7d lisab veidi

      // uudisedkaal
      const newsScore = clamp(sentAvg, -1.2, 1.2);

      // koondskoor
      const score = +( (newsScore * 0.45) + (momScore * 0.55) ).toFixed(2);

      const action = score >= 0.35 ? 'Buy' : score <= -0.35 ? 'Sell' : 'Hold';
      const conf = Math.abs(score) >= 0.7 ? 'High' : Math.abs(score) >= 0.45 ? 'Med' : 'Low';

      // põhjused (lühidalt)
      const reasons = [];
      if (newsScore > 0.4) reasons.push('positive news flow');
      if (newsScore < -0.4) reasons.push('negative news flow');
      if ((m.ch24 ?? 0) > 2) reasons.push('24h momentum ↑');
      if ((m.ch24 ?? 0) < -2) reasons.push('24h momentum ↓');
      if ((m.ch7 ?? 0) > 5) reasons.push('7d trend ↑');
      if ((m.ch7 ?? 0) < -5) reasons.push('7d trend ↓');

      byAsset[asset] = {
        asset,
        mentions: mentions.length,
        newsScore: +newsScore.toFixed(2),
        mom: { ch24: m.ch24 ?? null, ch7: m.ch7 ?? null },
        score,
        action,
        confidence: conf,
        reasons: reasons.slice(0,3),
        headlines: mentions.slice(0,3).map(x=>({title:x.title, link:x.link, sentiment:x.sentiment}))
      };
    }

    const signals = Object.values(byAsset)
      .sort((a,b)=>Math.abs(b.score)-Math.abs(a.score))
      .slice(0, 12);

    return json(200, { generated_at: new Date().toISOString(), signals });
  } catch (e) {
    return json(500, { error: 'news-signals failed', detail: String(e?.message || e) });
  }
};

// ------- helpers -------
async function cg(path, params={}) {
  const url = new URL(CG + path);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`CG ${path} HTTP ${r.status}`);
  return r.json();
}
async function getText(url){
  const r = await fetch(url, { headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } });
  if (!r.ok) throw new Error(`Fetch ${url} -> ${r.status}`);
  return r.text();
}
function json(code, obj){ return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) }; }
function num(x){ return (x===null||x===undefined)?null:Number(x) }
function isNum(x){ return typeof x==='number' && isFinite(x) }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
