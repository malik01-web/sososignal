const BASE = 'https://openapi.sosovalue.com/openapi/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KEY = process.env.SOSO_API_KEY;
  if (!KEY) return res.status(500).json({ ok: false, error: 'SOSO_API_KEY missing' });

  const H = {
    'x-soso-api-key': KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const { type } = req.query;

  const get = async (path, cache = 60) => {
    const url = BASE + path;
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 100)}`);
    const d = JSON.parse(text);
    res.setHeader('Cache-Control', `s-maxage=${cache}, stale-while-revalidate`);
    return d;
  };

  try {
    if (type === 'etf-flows') {
      // ETF summary history - confirmed working
      let summaryData = null;
      try {
        const d = await get('/etfs/summary-history?symbol=BTC&country_code=US&limit=1', 300);
        const arr = Array.isArray(d) ? d : (d.data || []);
        summaryData = arr[0] || null;
      } catch (e) {
        console.error('ETF summary error:', e.message);
      }

      // Individual ETF snapshots
      const tickers = [
        { t: 'IBIT', n: 'BlackRock' },
        { t: 'FBTC', n: 'Fidelity' },
        { t: 'GBTC', n: 'Grayscale' },
        { t: 'ARKB', n: 'ARK' },
        { t: 'BITB', n: 'Bitwise' }
      ];

      const snaps = await Promise.allSettled(
        tickers.map(({ t, n }) =>
          fetch(`${BASE}/etfs/${t}/market-snapshot`, { headers: H, signal: AbortSignal.timeout(5000) })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (!d) return null;
              const flow = parseFloat(d.net_inflow || d.netInflow || d.daily_net_inflow || d.inflow || 0);
              return { t, n, f: flow, price: d.mkt_price || 0, assets: d.net_assets || 0 };
            })
            .catch(() => null)
        )
      );

      const etfList = snaps
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

      const totalNet = summaryData
        ? parseFloat(summaryData.total_net_inflow || 0)
        : etfList.reduce((a, e) => a + (e.f || 0), 0);

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      return res.status(200).json({
        ok: true,
        data: etfList,
        totalNet,
        totalAssets: parseFloat(summaryData?.total_net_assets || 0),
        date: summaryData?.date || null
      });
    }

    if (type === 'treasury') {
      try {
        const d = await get('/btc-treasuries', 600);
        return res.status(200).json({ ok: true, data: d });
      } catch (e) {
        return res.status(200).json({ ok: false, error: e.message });
      }
    }

    if (type === 'etf-list') {
      try {
        const d = await get('/etfs?symbol=BTC&country_code=US', 3600);
        return res.status(200).json({ ok: true, data: d });
      } catch (e) {
        return res.status(200).json({ ok: false, error: e.message });
      }
    }

    return res.status(400).json({ ok: false, error: 'Unknown type: ' + type });

  } catch (e) {
    console.error('soso error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
