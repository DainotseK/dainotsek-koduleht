// CommonJS Netlify Function – Uudised & sotsiaal + lihtne sentiment.

const NEWS_FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed'
];

// Nitter instantsid (vahel üks maas, proovime järgemööda)
const NITTER_BASES = [
  'https://nitter.net', 'https://nitter.poast.org', 'https://nitter.fdn.fr'
];
const TWITTER_FEEDS = [
  '/elonmusk/rss',
  '/realDonaldTrump/rss',
  '/cz_binance/rss',
  '/VitalikButerin/rss'
];

const BULL = ['etf approval','etf inflow','partnership','integration','mainnet','upgrade','halving','custody','adoption','bullish','record inflow','buy','accumulate'];
const BEAR = ['ban','hack','exploit','lawsuit','charges','sec sues','fine','outage','rug','delist','sell-off','bearish','crash','scam'];
const ASSET_MAP = [
  { re:/\bbitcoin|\bbtc\b/i, asset:'BTC' },
  { re:/\beth(ereum)?\b|\bsolidity\b/i, asset:'ETH' },
  { re:/\bdoge|dogecoin\b/i, asset:'DOGE' },
  { re:/\bbnb\b|\bbinance\b/i, asset:'BNB' },
  { re:/\bsolana|\bsol\b/i, asset:'SOL' },
  { re:/\bxrp\b|\bripple\b/i, asset:'XRP' },
  { re:/\bcardano|\bada\b/i, asset:'ADA' },
  { re:/\btron|\btrx\b/i, asset:'TRX' },
];

exports.handler = async () => {
  try {
    const items = [];

    // 1) Uudiste RSS
    for (const feed of NEWS_FEEDS) {
      const xml = await getText(feed);
      items.push(...parseRSS(xml, 'news'));
    }

    // 2) Sotsiaal – Nitter peeglid
    for (const base of NITTER_BASES) {
      try {
        for (const path of TWITTER_FEEDS) {
          const xml = await getText(base + path);
          items.push(...parseRSS(xml, 'social'));
        }
        break; // üks töötas, piisab
      } catch(_) { continue; }
    }

    // 3) Skorime + varade kaardistus
    const scored = items.map(i => {
      const t = (i.title || '').toLowerCase();
      let s = 0;
      if (BULL.some(k => t.includes(k))) s += 1;
      if (BEAR.some(k => t.includes(k))) s -= 1;

      if (/elon musk|@elonmusk|doge/i.test(t)) s += 0.5;
      if (/donald trump|@realdonaldtrump|bitcoin/i.test(t)) s += 0.3;
      if (/cz|binance|bnb/i.test(t)) s += 0.4;
      if (/vitalik|ethereum|eth\b/i.test(t)) s += 0.4;

      const assets = matchAssets(t);
      return { ...i, sentiment: +s.toFixed(2), assets };
    });

    // 4) Agregeeri “bias by asset”
    const perAsset = {};
    for (const it of scored) {
      for (const a of it.assets) {
        perAsset[a] = perAsset[a] || { count:0, sum:0 };
        perAsset[a].count += 1;
        perAsset[a].sum += it.sentiment;
      }
    }
    const bias = Object.entries(perAsset)
      .map(([asset, v]) => ({
        asset,
        mentions: v.count,
        score: +(v.sum / Math.max(1,v.count)).toFixed(2),
        direction: v.sum > 0.5 ? 'UP' : v.sum < -0.5 ? 'DOWN' : 'SIDE'
      }))
      .sort((a,b) => Math.abs(b.score)-Math.abs(a.score))
      .slice(0, 12);

    const latest = scored
      .sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 50)
      .map(x => ({ source:x.source, title:x.title, link:x.link, pubDate:x.pubDate, sentiment:x.sentiment, assets:x.assets }));

    return json(200, { generated_at: new Date().toISOString(), bias, latest });
  } catch (e) {
    return json(500, { error: 'news-sentiment failed', detail: String(e?.message || e) });
  }
};

// ------- helpers -------
async function getText(url){
  const r = await fetch(url, { headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } });
  if (!r.ok) throw new Error(`Fetch ${url} -> ${r.status}`);
  return r.text();
}
function parseRSS(xml, source){
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
    if (title) items.push({ source, title, link, pubDate });
  }
  return items;
}
function matchAssets(text){
  const set = new Set();
  for (const m of ASSET_MAP) if (m.re.test(text)) set.add(m.asset);
  return Array.from(set);
}
function json(code, obj){ return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) }; }
