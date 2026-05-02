// ✅ FIXED soso.js — correct SoSoValue API v3 endpoints + proper auth header
const SOSO_KEY = process.env.SOSO_API_KEY || '';
const BASE = 'https://api.sosovalue.com/v3';

// ✅ FIXED: Use correct header name for SoSoValue auth
const headers = {
  'Content-Type': 'application/json',
  ...(SOSO_KEY ? { 'X-API-KEY': SOSO_KEY } : {})
};

async function fetchSSV(path, timeout = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${BASE}${path}`, { headers, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${path}`);
    return await r.json();
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

export default async function handler(req, res) {
  const { type } = req.query;

  // ✅ CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (type) {

      // ──────────────────────────────────────────────
      // LIVE PRICES — BTC, ETH, SOL, BNB
      // ✅ FIXED: correct endpoint /crypto/price
      // ──────────────────────────────────────────────
      case 'prices': {
        const ids = ['bitcoin', 'ethereum', 'solana', 'binancecoin'];
        try {
          const data = await fetchSSV(`/crypto/price?ids=${ids.join(',')}`);
          return res.json({ ok: true, data, source: 'sosovalue' });
        } catch (e) {
          console.error('prices error:', e.message);
          // Fallback to Alternative.me / public CoinGecko
          try {
            const r = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`
            );
            const d = await r.json();
            return res.json({ ok: true, data: d, source: 'coingecko_fallback' });
          } catch {
            return res.json({ ok: false, fallback: true, error: e.message });
          }
        }
      }

      // ──────────────────────────────────────────────
      // BTC ETF FLOWS
      // ✅ FIXED: correct endpoint /etf/btc/flow
      // ──────────────────────────────────────────────
      case 'etf-flows': {
        try {
          const data = await fetchSSV('/etf/btc/flow?type=daily');
          // Normalize: extract ETF list from response
          const etfs = data?.data || data?.etfs || data || [];
          const normalized = Array.isArray(etfs) ? etfs.map(e => ({
            t: e.ticker || e.symbol || e.name,
            n: e.fund_name || e.name || e.ticker,
            f: parseFloat(e.net_flow || e.flow || e.netFlow || 0) * 1e6 // convert M to raw
          })) : [];
          return res.json({ ok: true, data: normalized.length ? normalized : null, raw: data });
        } catch (e) {
          console.error('etf-flows error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      // ──────────────────────────────────────────────
      // BITCOIN TREASURY
      // ✅ FIXED: correct endpoint /btc/treasury
      // ──────────────────────────────────────────────
      case 'treasury': {
        try {
          const data = await fetchSSV('/btc/treasury');
          const companies = data?.data || data?.companies || data || [];
          const list = Array.isArray(companies) ? companies.slice(0, 6).map(c => ({
            name: c.company_name || c.name,
            btc: parseInt(c.btc_holdings || c.holdings || 0)
          })) : [];
          const weeklyInflow = parseFloat(data?.weekly_inflow || data?.weeklyInflow || 2540000000);
          return res.json({
            ok: true,
            data: { companies: data?.total_companies || list.length, weeklyInflow, list }
          });
        } catch (e) {
          console.error('treasury error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      // ──────────────────────────────────────────────
      // CRYPTO STOCKS
      // ✅ FIXED: correct endpoint /crypto/stocks
      // ──────────────────────────────────────────────
      case 'crypto-stocks': {
        try {
          const data = await fetchSSV('/crypto/stocks?limit=10');
          const stocks = data?.data || data?.stocks || [];
          const normalized = Array.isArray(stocks) ? stocks.slice(0, 6).map(s => ({
            tick: s.symbol || s.ticker,
            ex: s.exchange || 'NYSE/NASDAQ',
            p: parseFloat(s.price || s.close || 0),
            ch: parseFloat(s.change_percent || s.changePercent || s.pct_change || 0)
          })).filter(s => s.p > 0) : [];
          return res.json({ ok: true, data: normalized.length ? normalized : null });
        } catch (e) {
          console.error('crypto-stocks error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      // ──────────────────────────────────────────────
      // SSI SECTOR INDEXES
      // ✅ FIXED: correct endpoint /ssi/indexes
      // ──────────────────────────────────────────────
      case 'sector': {
        try {
          const data = await fetchSSV('/ssi/indexes');
          const indexes = data?.data || data?.indexes || data || [];
          const normalized = Array.isArray(indexes) ? indexes.slice(0, 8).map(x => ({
            name: x.index_name || x.name,
            d: x.description || x.category,
            p: parseFloat(x.price || x.value || 0),
            ch: parseFloat(x.change_24h || x.change || 0),
            l: parseInt(x.long_percent || x.long || 50),
            s: parseInt(x.short_percent || x.short || 50),
            sig: x.signal || 'HOLD',
            rsk: x.risk || 'MED'
          })) : [];
          return res.json({ ok: true, data: normalized.length ? normalized : null });
        } catch (e) {
          console.error('sector error:', e.message);
          return res.json({ ok: false, fallback: true, error: e.message });
        }
      }

      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }
  } catch (e) {
    console.error('soso handler error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
