// News + Market momentum -> Buy/Hold/Sell signals per Top-50 assets.
// Inputs: optional POST body { coins: [{id, symbol, name}, ...] } (CoinGecko ids).
// If not provided, falls back to CoinGecko Top50.
// Sources: CoinGecko (momentum), CoinDesk/CoinTelegraph/Decrypt (RSS),
//          Nitter mirrors (Musk, Trump, CZ, Vitalik). No API keys required.

const CG = 'https://api.coingecko.com/api/v3';
const NEWS_FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed'
];
const NITTER_BASES = ['https://nitter.net','https://nitter.poast.org','https://nitter.fdn.fr','https://nitter.cz'];
const TWITTER_FEEDS = ['/elonmusk/rss','/realDonaldTrump/rss','/cz_binance/rss','/VitalikButerin/rss'];

const BULL = ['etf approval','etf inflow','partnership','integration','mainnet','upgrade','halving','custody','adoption','bullish','record inflow','buy','accumulate','listing','merger','funding','treasury'];
const BEAR = ['ban','hack','exploit','lawsuit','charges','sec sues','fine','outage','rug','delist','sell-off','bearish','crash','scam','downtime'];

exports.handler = async (event) => {
  const errors = [];
  try {
    // --- 0) Read optional coin list from POST body ---
    let coins = [];
    if (event.httpMethod === 'POST' && event.body) {
      try {
        const body = JSON.parse(event.body);
        if (Array.isArray(body?.coins)) coins = body.coins
          .filter(c => c && (c.id || c.symbol || c.name))
          .map(c => ({
            id: String(c.id || '').trim(),
            symbol: String(c.symbol || '').toUpperCase().trim(),
            name: String(c.name || '').trim()
          }));
      } catch (e) {
        errors.push('body-parse:' + e.message);
      }
    }

    // If no coins provided, fetch CoinGecko Top 50 list
    if (!coins.length) {
      const url = new URL(CG + '/coins/markets');
      url.searchParams.set('vs_currency','usd');
      url.searchParams.set('order','market_cap_desc');
      url.searchParams.set('per_page','50');
      url.searchParams.set('page','1');
      url.searchParams.set('sparkline','false');
      const top = await safeFetchJSON(url.toString()).catch(e=>{errors.push('cg-top50:'+e.message); return [];});
      coins = (Array.isArray(top)?top:[]).map(c => ({
        id: c.id, symbol: String(c.symbol||'').toUpperCase(), name: c.name
      }));
    }

    // Build dynamic matcher from coins list (symbol exact word + name)
    const dynMap = coins.map(c => ({
      id: c.id,
      asset: (c.symbol || c.name || '').toUpperCase(),
      symbol: c.symbol,
      name: c.name,
      re: buildAssetRegex(c.symbol, c.name)
    }));

    // --- 1) Market momentum only for these ids ---
    const idsCsv = coins.map(c=>c.id).filter(Boolean).join(',');
    const mom = await getMarketMomentum(idsCsv).catch(e => { errors.push('cg-mom:'+e.message); return new Map(); });

    // --- 2) Gather headlines (news + socials) ---
    const newsItems = await fetchManyRSS(NEWS_FEEDS).catch(e => { errors.push('rss:'+e.message); return []; });
    let socialItems = [];
    for (const base of NITTER_BASES) {
      try {
        socialItems = await fetchManyRSS(TWITTER_FEEDS.map(p => base + p));
        if (socialItems.length) break;
      } catch (e) { errors.push('nitter('+base+'):'+e.message); }
    }
    const items = [...newsItems, ...socialItems];

    // --- 3) Score and map items to provided assets only ---
    const scored = items.map(i => {
      const t = (i.title || '').toLowerCase();
      let s = 0;
      if (BULL.some(k => t.includes(k))) s += 1;
      if (BEAR.some(k => t.includes(k))) s -= 1;
      if (/elon musk|@elonmusk|doge/.test(t)) s += 0.5;        // Musk bias -> DOGE (if in list)
      if (/donald trump|@realdonaldtrump|bitcoin/.test(t)) s += 0.3; // Trump -> BTC (if in list)
      if (/cz|binance|bnb/.test(t)) s += 0.4;                   // CZ/Binance -> BNB
      if (/vitalik|ethereum|eth\b/.test(t)) s += 0.4;           // Vitalik/ETH

      // match to the dynamic asset set
      const matched = dynMap.filter(m => m.re.test(t)).map(m => m.asset);
      return { ...i, sentiment: +s.toFixed(2), assets: matched };
    });

    // --- 4) Aggregate per asset in provided set ---
    const byAsset = {};
    for (const c of dynMap) {
      const mentions = scored.filter(x => x.assets.includes(c.asset));
      const sentSum = mentions.reduce((a,b)=>a+(b.sentiment||0),0);
      const sentAvg = mentions.length ? sentSum/mentions.length : 0;

      const m = mom.get(c.id) || {};
      const momScore = (isNum(m.ch24) ? clamp(m.ch24/5, -1, 1) * 0.6 : 0)
                     + (isNum(m.ch7)  ? clamp(m.ch7 /15, -1, 1) * 0.4 : 0);

      const newsScore = clamp(sentAvg, -1.2, 1.2);
      const score = +((newsScore * 0.45) + (momScore * 0.55)).toFixed(2);
      const action = score >= 0.35 ? 'Buy' : score <= -0.35 ? 'Sell' : 'Hold';
      const confidence = Math.abs(score) >= 0.7 ? 'High' : Math.abs(score) >= 0.45 ? 'Med' : 'Low';

      const reasons = [];
      if (newsScore >  0.4) reasons.push('positive news flow');
      if (newsScore < -0.4) reasons.push('negative news flow');
      if ((m.ch24 ?? 0) >  2) reasons.push('24h momentum ↑');
      if ((m.ch24 ?? 0) < -2) reasons.push('24h momentum ↓');
      if ((m.ch7  ?? 0) >  5) reasons.push('7d trend ↑');
      if ((m.ch7  ?? 0) < -5) reasons.push('7d trend ↓');

      byAsset[c.asset] = {
        id: c.id,
        asset: c.asset,
        symbol: c.symbol,
        name: c.name,
        mentions: mentions.length,
        newsScore: +newsScore.toFixed(2),
        mom: { ch24: m.ch24 ?? null, ch7: m.ch7 ?? null },
        score, action, confidence,
        reasons: reasons.slice(0,3),
        headlines: mentions.slice(0,3).map(h => ({ title: h.title, link: h.link, sentiment: h.sentiment }))
      };
    }

    const signals = Object.values(byAsset).sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));

    return json(200, {
      generated_at: new Date().toISOString(),
      scope: 'top50-linked',
      count: signals.length,
      signals,
      diagnostics: { errors, news_count: newsItems.length, social_count: socialItems.length, mom_size: mom.size }
    });

  } catch (e) {
    return json(200, {
      generated_at: new Date().toISOString(),
      scope: 'top50-linked',
      count: 0,
      signals: [],
      diagnostics: { fatal: String(e?.message || e) }
    });
  }
};

// -------- helpers --------
function buildAssetRegex(symbol, name){
  const parts = [];
  if (symbol) parts.push(`\\b${escapeReg(symbol)}\\b`);
  if (name) {
    // match whole name, ignore case; handle tokens with dots/slashes
    parts.push(`\\b${escapeReg(name)}\\b`);
  }
  // Join with | and add i flag in test
  return new RegExp(parts.join('|'), 'i');
}

async function getMarketMomentum(idsCsv){
  const url = new URL(CG + '/coins/markets');
  url.searchParams.set('vs_currency','usd');
  url.searchParams.set('order','market_cap_desc');
  url.searchParams.set('per_page','250');
  url.searchParams.set('page','1');
  url.searchParams.set('sparkline','false');
  url.searchParams.set('price_change_percentage','1h,24h,7d');
  if (idsCsv) url.searchParams.set('ids', idsCsv);

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
  const items = [];
  for (const xml of texts) items.push(...parseRSS(xml));
  return items;
}

async function safeFetchJSON(url, timeoutMs = 12000){
  const txt = await safeFetchText(url, timeoutMs);
  try { return JSON.parse(txt); } catch { return {}; }
}
async function safeFetchText(url, timeoutMs = 12000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'Accept':'*/*' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
function parseRSS(xml){
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
function json(code, obj){ return { statusCode: code, headers: { 'Content-Type':'application/json','Cache-Control':'no-store' }, body: JSON.stringify(obj) }; }
function toNum(x){ return (x===null||x===undefined||x==='') ? null : Number(x) }
function isNum(x){ return typeof x==='number' && isFinite(x) }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function escapeReg(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
