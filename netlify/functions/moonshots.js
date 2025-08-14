// Moonshotid (< $100M cap) – CoinPaprika (võtmeta) + LunarCrush (tasuta võtmega, kui olemas)
// CommonJS Netlify Function

const PAPRIKA = 'https://api.coinpaprika.com/v1';
const LC = 'https://api.lunarcrush.com/v2'; // v2 free endpoint

exports.handler = async () => {
  try {
    // 1) Tõmba KÕIK tickers Paprika'st (quotes=USD)
    // NB! See on 1 päring ja tuleb järjest – filterdame serveris
    const tickers = await jget(`${PAPRIKA}/tickers`, { quotes: 'USD' });

    // 2) Filtreeri moonshot-kandidaadid: cap < $100M, hind > 0, maht > 50k
    const base = (tickers || [])
      .map(t => {
        const q = t.quotes?.USD || {};
        return {
          id: t.id,
          name: t.name,
          symbol: String(t.symbol || '').toUpperCase(),
          price_usd: num(q.price),
          mcap: num(q.market_cap),
          vol24: num(q.volume_24h),
          ch1: num(q.percent_change_1h),
          ch24: num(q.percent_change_24h),
          ch7: num(q.percent_change_7d)
        };
      })
      .filter(x =>
        isNum(x.mcap) && x.mcap > 0 && x.mcap < 100_000_000 &&
        isNum(x.price_usd) && x.price_usd > 0 &&
        isNum(x.vol24) && x.vol24 >= 50_000
      );

    // 3) Võta likviidsuse järgi esimesed ~120; neist skoorime
    base.sort((a,b) => (b.vol24 ?? 0) - (a.vol24 ?? 0));
    const shortlist = base.slice(0, 120);

    // 4) Võta LunarCrush sotsiaal (kui võti on olemas); batche 25 kaupa
    const lcKey = process.env.LUNARCRUSH_API_KEY || '';
    let socialMap = new Map();
    if (lcKey) {
      const symbols = [...new Set(shortlist.map(x => x.symbol).filter(Boolean))];
      const batches = chunk(symbols, 25);
      const results = [];
      for (const batch of batches) {
        const qs = new URLSearchParams({
          data: 'assets',
          symbol: batch.join(','),
          key: lcKey
        });
        try {
          const r = await fetch(`${LC}?${qs}`, { headers: { 'Accept':'application/json' }});
          const txt = await r.text();
          if (!r.ok) continue;
          const j = JSON.parse(txt);
          const arr = Array.isArray(j?.data) ? j.data : [];
          for (const it of arr) {
            // v2 väljad: symbol, galaxy_score, social_volume_24h, social_score
            socialMap.set(String(it.symbol).toUpperCase(), {
              galaxy: toNum(it.galaxy_score),
              social_volume_24h: toNum(it.social_volume_24h),
              social_score: toNum(it.social_score)
            });
          }
        } catch { /* ignore */ }
      }
    }

    // 5) Lõplik skoor: 7d price ↑, 24h % ↑, vol24/mcap, + social (kui olemas)
    const withScore = shortlist.map(x => {
      const social = socialMap.get(x.symbol) || null;

      // normaliseerimised (pehmed capid, et mitte ülevõimendada)
      const s_price7  = clamp((x.ch7 ?? 0) / 30, 0, 1);       // 0..1
      const s_ch24    = clamp((x.ch24 ?? 0) / 15, -1, 1);     // -1..1 (kasutame ainult positiivset osa)
      const s_liq     = clamp((x.vol24 ?? 0) / Math.max(1, x.mcap), 0, 1); // vol/mcap 0..1
      const s_social  = social && isNum(social.galaxy) ? clamp(social.galaxy / 100, 0, 1) :
                        social && isNum(social.social_score) ? clamp(social.social_score / 100, 0, 1) :
                        0;

      const score = round2(
        (s_price7 * 0.45) +
        (Math.max(0, s_ch24) * 0.15) +
        (s_liq * 0.20) +
        (s_social * 0.20)
      );

      return {
        ...x,
        social: social ? {
          galaxy: social.galaxy ?? null,
          social_volume_24h: social.social_volume_24h ?? null
        } : null,
        score
      };
    });

    // 6) Sorteeri ja tagasta top 15
    withScore.sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
    const out = withScore.slice(0, 15);

    return json(200, {
      generated_at: new Date().toISOString(),
      source: `coinpaprika${lcKey ? ' + lunarcrush' : ''}`,
      items: out
    });
  } catch (e) {
    return json(500, { error: 'moonshots failed', detail: String(e?.message || e) });
  }
};

// --- utils ---
async function jget(url, params = {}) {
  const u = new URL(url);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, String(v)));
  const r = await fetch(u, { headers: { 'Accept':'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} at ${u}`);
  return r.json();
}
function json(code, obj){ return { statusCode: code, headers: { 'Content-Type':'application/json','Cache-Control':'no-store' }, body: JSON.stringify(obj) }; }
function num(x){ return (x===null||x===undefined)?null:Number(x) }
function toNum(x){ return (x===null||x===undefined || x==='') ? null : Number(x) }
function isNum(x){ return typeof x==='number' && isFinite(x) }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function round2(x){ return Math.round(x*100)/100; }
function chunk(arr, n){ const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
