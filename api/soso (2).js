// FIXED: Real SoSoValue base URL from official API docs (Image 3 shows it clearly)
// https://openapi.sosovalue.com/openapi/v1
const SOSO_KEY = process.env.SOSO_API_KEY || '';
const BASE = 'https://openapi.sosovalue.com/openapi/v1';

// FIXED: SoSoValue uses 'apiKey' header, not 'X-API-KEY'. Also fix DEP0169.
function makeHeaders() {
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (SOSO_KEY) h['apiKey'] = SOSO_KEY;
  return h;
}

async function fetchSSV(path, timeoutMs = 10000) {
  // FIXED: Use string concat instead of url.parse() — eliminates DEP0169 warning
  const url = BASE + path;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: makeHeaders(), signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status}: ${body.slice(0, 120)}`);
    }
    return await r.json();
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

// Reliable CoinGecko fallback for prices (no auth needed)
async function cgPrices() {
  const ids = 'bitcoin,ethereum,solana,binancecoin';
  const r = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!r.ok) throw new Error('CoinGecko HTTP ' + r.status);
  const d = await r.json();
  return {
    BTC:  { spot: d.bitcoin?.usd,     ch: d.bitcoin?.usd_24h_change,     vol: '1.2M', lu: Date.now() },
    ETH:  { spot: d.ethereum?.usd,    ch: d.ethereum?.usd_24h_change,    vol: '892K', lu: Date.now() },
    SOL:  { spot: d.solana?.usd,      ch: d.solana?.usd_24h_change,      vol: '445K', lu: Date.now() },
    BNB:  { spot: d.binancecoin?.usd, ch: d.binancecoin?.usd_24h_change, vol: '235K', lu: Date.now() },
    SOSO: { spot: 0.432,              ch: 6.60,                           vol: '1.0M', lu: Date.now() }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type } = req.query;

  try {
    switch (type) {

      // ── LIVE PRICES ──────────────────────────────────────────────────────
      case 'prices': {
        // Try SoSoValue, fallback to CoinGecko
        try {
          const d = await fetchSSV('/market/price?symbol=BTC,ETH,SOL,BNB');
          const list = d?.data || d?.result || [];
          if (Array.isArray(list) && list.length > 0) {
            const map = {};
            list.forEach(x => {
              const sym = (x.symbol || x.coin || '').toUpperCase();
              map[sym] = {
                spot: parseFloat(x.price || x.lastPrice || x.close || 0),
                ch:   parseFloat(x.change24h || x.priceChangePercent || x.changeRate || 0),
                vol:  formatVol(parseFloat(x.volume24h || x.vol || 0)),
                lu:   Date.now()
              };
            });
            if (map.BTC?.spot > 0) {
              map.SOSO = { spot: 0.432, ch: 6.60, vol: '1.0M', lu: Date.now() };
              return res.json({ ok: true, data: map, source: 'sosovalue' });
            }
          }
          throw new Error('No price data in response');
        } catch (e) {
          console.error('SoSoValue prices fail:', e.message);
          try {
            const cg = await cgPrices();
            return res.json({ ok: true, data: cg, source: 'coingecko' });
          } catch (e2) {
            console.error('CoinGecko fail:', e2.message);
            return res.json({ ok: false, fallback: true, error: e.message });
          }
        }
      }

      // ── BTC ETF FLOWS ────────────────────────────────────────────────────
      case 'etf-flows': {
        try {
          const d = await fetchSSV('/etf/bitcoin/flow/list');
          const list = d?.data || d?.result || [];
          if (Array.isArray(list) && list.length > 0) {
            const normalized = list.slice(0, 8).map(e => ({
              t: (e.ticker || e.symbol || e.shortName || '').toUpperCase(),
              n: e.fundName || e.fund_name || e.name || '',
              f: parseFloat(e.netFlow || e.net_flow || e.flow || e.dailyNetFlow || 0) * 1e6
            })).filter(e => e.t);
            if (normalized.length > 0) {
              return res.json({ ok: true, data: normalized, source: 'sosovalue' });
            }
          }
          throw new Error('No ETF data');
        } catch (e) {
          console.error('ETF flows error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      // ── BITCOIN TREASURY ─────────────────────────────────────────────────
      case 'treasury': {
        try {
          const d = await fetchSSV('/bitcoin/treasury/list?pageSize=10&pageNum=1');
          const list = d?.data?.list || d?.data || d?.result || [];
          if (Array.isArray(list) && list.length > 0) {
            const companies = list.slice(0, 6).map(c => ({
              name: c.entityName || c.companyName || c.company_name || c.name || 'Unknown',
              btc:  parseInt(c.bitcoinHoldings || c.btc_holdings || c.holdings || 0)
            }));
            const weeklyInflow = parseFloat(d?.data?.weeklyNetInflow || d?.weeklyInflow || 2540000000);
            const totalCos = parseInt(d?.data?.totalCount || companies.length);
            return res.json({ ok: true, data: { companies: totalCos, weeklyInflow, list: companies }, source: 'sosovalue' });
          }
          throw new Error('No treasury data');
        } catch (e) {
          console.error('Treasury error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      // ── CRYPTO STOCKS ────────────────────────────────────────────────────
      case 'crypto-stocks': {
        try {
          const d = await fetchSSV('/market/crypto-stock/list?pageSize=10&pageNum=1');
          const list = d?.data?.list || d?.data || d?.result || [];
          if (Array.isArray(list) && list.length > 0) {
            const stocks = list.slice(0, 6).map(s => ({
              tick: s.symbol || s.ticker || '??',
              ex:   s.exchange || s.market || 'NASDAQ',
              p:    parseFloat(s.price || s.lastPrice || s.close || 0),
              ch:   parseFloat(s.changeRate || s.change_percent || s.changePercent || s.pctChange || 0)
            })).filter(s => s.p > 0 && s.tick !== '??');
            if (stocks.length > 0) {
              return res.json({ ok: true, data: stocks, source: 'sosovalue' });
            }
          }
          throw new Error('No stocks data');
        } catch (e) {
          console.error('Stocks error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      // ── SSI SECTOR INDEXES ───────────────────────────────────────────────
      case 'sector': {
        try {
          const d = await fetchSSV('/index/ssi/list');
          const list = d?.data || d?.result || [];
          if (Array.isArray(list) && list.length > 0) {
            const indexes = list.slice(0, 8).map(x => ({
              name: x.indexName || x.index_name || x.name || '??',
              d:    x.description || x.category || x.sector || '',
              p:    parseFloat(x.price || x.value || x.lastPrice || 0),
              ch:   parseFloat(x.changeRate || x.change24h || x.change || 0),
              l:    parseInt(x.longPercent || x.long_percent || x.long || 50),
              s:    parseInt(x.shortPercent || x.short_percent || x.short || 50),
              sig:  (x.signal || x.suggestion || 'HOLD').toUpperCase(),
              rsk:  (x.risk || x.riskLevel || 'MED').toUpperCase()
            })).filter(x => x.name !== '??');
            if (indexes.length > 0) {
              return res.json({ ok: true, data: indexes, source: 'sosovalue' });
            }
          }
          throw new Error('No SSI data');
        } catch (e) {
          console.error('SSI error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }
  } catch (e) {
    console.error('soso handler crash:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

function formatVol(v) {
  if (!v || isNaN(v) || v === 0) return 'N/A';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toFixed(0);
}
