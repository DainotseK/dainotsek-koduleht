// News + Market momentum -> Buy/Hold/Sell signals per asset (robust + fallbacks).
// Sources: CoinGecko (market momentum), CoinDesk/CoinTelegraph/Decrypt (RSS),
//          Nitter mirrors for X/Twitter (Musk, Trump, CZ, Vitalik).
// No API keys required.

const CG = 'https://api.coingecko.com/api/v3';

const NEWS_FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed'
];

// try multiple Nitter instances in order; skip quietly if down
const NITTER_BASES = ['https://nitter.net','https://nitter.poast.org','https://nitter.fdn.fr','https://nitter.cz'];
const TWITTER_FEEDS = ['/elonmusk/rss','/realDonaldTrump/rss','/cz_binance/rss','/VitalikButerin/rss'];

// keyword sentiment (very lightweight)
const BULL = ['etf approval','etf inflow','partnership','integration','mainnet','upgrade','halving','custody','adoption','bullish','record inflow','buy','accumulate','listing','merger','funding'];
const BEAR = ['ban','hack','exploit','lawsuit','charges','sec sues','fine','outage','rug','delist','sell-off','bearish','crash','scam','downtime'];

const MAP = [
  { re:/\bbitcoin|\bbtc\b/i,             asset:'BTC',  ids:['bitcoin'] },
  { re:/\beth(ereum)?\b|\bsolidity\b/i,  asset:'ETH',  ids:['ethereum'] },
  { re:/\bdoge|dogecoin\b/i,             asset:'DOGE', ids:['dogecoin'] },
  { re:/\bbnb\b|\bbinance\b/i,           asset:'BNB',  ids:['binancecoin'] },
  { re:/\bsolana|\bsol\b/i,              asset:'SOL',  ids:['solana'] },
  { re:/\bxrp\b|\bripple\b/i,            asset:'XRP',  ids:['ripple'] },
  { re:/\bcardano|\bada\b/i,             asset:'ADA',  ids:['cardano'] },
  { re:/\btron|\btrx\b/i,                asset:'TRX',  ids:['tron'] },
];

exports.handler = async () => {
  const errors = []; // collect non-fatal errors for diagnostics in response
  try {
    // 1) Market momentum (CoinGecko Top-100). If fails, continue with empty map.
    const momentum = await getMarketMomentum().catch(e => { errors.push('cg:'+e.message); return new Map(); });

    // 2) Collect headlines from news RSS
    const newsItems = await fetchManyRSS(NEWS_FEEDS).catch(e => { errors.push('rss:'+e.message); return []; });

    // 3) Collect socials via first working Nitter base (non-fatal if all down)
    let socialItems = [];
    for (const base of NITTER_BASES) {
      try {
        const feeds = TWITTER_FEEDS.map(p => base + p);
        socialItems = await fetchManyRSS(feeds);
        if (socialItems.length > 0) break;
      } catch (e) {
        errors.push('nitter('+base+'):'+e.message);
        continue;
      }
    }

    const items = [...newsItems, ...socialItems];

    // 4) Score items & map to assets
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

    // 5) Aggregate per asset: newsScore + momentum -> action
    const byAsset = {};
    for (const {asset, ids} of MAP) {
      const mentions = scored.filter(x => x.assets.includes(asset));
      const sentSum = mentions.reduce((a,b)=>a+(b.sentiment||0),0);
      const sentAvg = mentions.length ? sentSum/mentions.length : 0;

      // market momentum from first cg id, else 0
      const m = momentum.get(ids[0]) || {};
      const momScore =
        (isNum(m.ch24) ? clamp(m.ch24/5, -1, 1) * 0.6 : 0) +
        (isNum(m.ch7)  ? clamp(m.ch7/15, -1, 1) * 0.4 : 0);

      const newsScore = clamp(sentAvg, -1.2, 1.2);
      const score = +( (newsScore * 0.45) + (momScore * 0.55) ).toFixed(2);

      const action = score >= 0.35 ? 'Buy' : score <= -0.35 ? 'Sell' : 'Hold';
      const confidence = Math.abs(score) >= 0.7 ? 'High' : Math.abs(score) >= 0.45 ? 'Med' : 'Low';

      const reasons = [];
      if (newsScore >  0.4) reasons.push('positive news flow');
      if (newsScore < -0.4) reasons.push('negative news flow');
      if ((m.ch24 ?? 0) >  2) reasons.push('24h momentum ↑');
      if ((m.ch24 ?? 0) < -2) reasons.push('24h momentum ↓');
      if ((m.ch7  ?? 0) >  5) reasons.push('7d trend ↑');
      if ((m.ch7  ?? 0) < -5) reasons.push('7d trend ↓');

      byAsset[asset] = {
        asset,
        mentions: mentions.length,
        newsScore: +newsScore.toFixed(2),
        mom: { ch24: m.ch24 ?? null, ch7: m.ch7 ?? null },
        score, action, confidence,
        reasons: reasons.slice(0,3),
        headlines: mentions.slice(0,3).map(h => ({ title: h.title, link: h.link, sentiment: h.sentiment }))
      };
    }

    const signals = Object.values(byAsset).sort((a,b)=>Math.abs(b.score)-Math.abs(a.score)).slice(0,12);

    return json(200, {
      generated_at: new Date().toISOString(),
      signals,
      diagnostics: { sources_ok: { news: newsItems.length, social: socialItems.length, cg: momentum.size }, errors }
    });

  } catch (e) {
    // hard catch should not happen; still return 200 with diagnostics, not 500
    return json(200, {
      generated_at: new Date().toISOString(),
      signals: [],
      diagnostics: { fatal: String(e?.message || e) }
    });
  }
};

// ---------------- helpers ----------------
async function getMarketMomentum() {
  // fetch top-100 markets once; tolerant to partial failures
  const url = new URL(CG + '/coins/markets');
  url.searchParams.set('vs_currency','usd');
  url.searchParams.set('order','market_cap_desc');
  url.searchParams.set('per_page','100');
  url.searchParams.set('page','1');
  url.searchParams.set('price_change_percentage','1h,24h,7d');

  const j = await safeFetchJSON(url.toString());
  const map = new Map();
  (Array.isArray(j) ? j : []).forEach(c => {
    map.set(c.id, {
      ch1: toNum(c.price_change_percentage_1h_in_currency),
      ch24: toNum(c.price_change_percentage_24h_in_currency),
      ch7: toNum(c.price_change_percentage_7d_in_currency),
      vol: toNum(c.total_volume)
    });
  });
  return map;
}

async function fetchManyRSS(urls) {
  const results = await Promise.allSettled(urls.map(u => safeFetchText(u)));
  const texts = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  // parse each RSS text safely
  const items = [];
  for (const xml of texts) items.push(...parseRSS(xml));
  return items;
}

async function safeFetchJSON(url, timeoutMs = 12000) {
  const resText = await safeFetchText(url, timeoutMs);
  try {
    return JSON.parse(resText);
  } catch {
    return {};
  }
}

async function safeFetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'Accept':'*/*' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

function parseRSS(xml) {
  // resilient RSS parser via regex (no deps)
  if (!xml || typeof xml !== 'string') return [];
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const titleRe = /<title>([\s\S]*?)<\/title>/i;
  const linkRe  = /<link>([\s\S]*?)<\/link>/i;
  const dateRe  = /<pubDate>([\s\S]*?)<\/pubDate>/i;

  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    const title = (titleRe.exec(block)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
    const link  = (linkRe.exec(block)?.[1] || '').trim();
    const pubDate = (dateRe.exec(block)?.[1] || '').trim();
    if (title) items.push({ source:'news', title, link, pubDate });
  }
  return items;
}

function json(code, obj){
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj)
  };
}
function toNum(x){ return (x===null||x===undefined||x==='') ? null : Number(x) }
function isNum(x){ return typeof x==='number' && isFinite(x) }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
