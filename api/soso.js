const BASE = 'https://openapi.sosovalue.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KEY = process.env.SOSO_API_KEY;
  if (!KEY) return res.status(500).json({ ok: false, error: 'SOSO_API_KEY missing' });

  const H = {
    'x-soso-api-key': KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'OnchainEdge/2.0'
  };

  const { type } = req.query;

  const get = async (url, cache = 60) => {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
    const d = await r.json();
    res.setHeader('Cache-Control', `s-maxage=${cache}, stale-while-revalidate`);
    return d;
  };

  try {
    // ETF flows — confirmed working endpoint
    if (type === 'etf-flows') {
      try {
        const d = await get(`${BASE}/etfs/summary-history?symbol=BTC&country_code=US&limit=3`, 300);
        const arr = Array.isArray(d) ? d : (d.data || []);
        const latest = arr[0] || {};

        // Try individual ETF snapshots for breakdown
        const tickers = ['IBIT','FBTC','GBTC','ARKB','BITB'];
        const snaps = await Promise.allSettled(
          tickers.map(t => fetch(`${BASE}/etfs/${t}/market-snapshot`, { headers: H })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (!d) return null;
              const flow = parseFloat(d.net_inflow || d.netInflow || d.daily_net_inflow || d.inflow || 0);
              const names = { IBIT:'BlackRock', FBTC:'Fidelity', GBTC:'Grayscale', ARKB:'ARK', BITB:'Bitwise' };
              return { t, n: names[t] || t, f: flow };
            })
            .catch(() => null))
        );

        const etfList = snaps.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);

        return res.status(200).json({
          ok: true,
          data: etfList.length > 0 ? etfList : null,
          totalNet: parseFloat(latest.total_net_inflow || 0),
          totalAssets: parseFloat(latest.total_net_assets || 0),
          date: latest.date || null,
          summary: latest
        });
      } catch (e) {
        console.error('ETF flows error:', e.message);
        return res.status(200).json({ ok: false, error: e.message, fallback: true });
      }
    }

    // BTC Treasury
    if (type === 'treasury') {
      try {
        const d = await get(`${BASE}/btc-treasuries`, 600);
        return res.status(200).json({ ok: true, data: d });
      } catch (e) {
        return res.status(200).json({ ok: false, error: e.message });
      }
    }

    // Sector/SSI (for sector-spotlight)
    if (type === 'sector') {
      // This endpoint may not exist — return fallback gracefully
      return res.status(200).json({ ok: false, error: 'Endpoint not available on demo plan' });
    }

    // Crypto stocks
    if (type === 'crypto-stocks') {
      return res.status(200).json({ ok: false, error: 'Endpoint not available on demo plan' });
    }

    // Currency price (not available on demo plan either)
    if (type === 'currency') {
      return res.status(200).json({ ok: false, error: 'Endpoint not available on demo plan' });
    }

    return res.status(400).json({ ok: false, error: 'Unknown type: ' + type });

  } catch (e) {
    console.error('soso handler error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
