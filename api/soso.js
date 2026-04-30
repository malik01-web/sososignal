const BASE = 'https://openapi.sosovalue.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SOSO_KEY = process.env.SOSO_API_KEY;
  if (!SOSO_KEY) return res.status(500).json({ error: 'SOSO_API_KEY not set' });

  const headers = {
    'x-soso-api-key': SOSO_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const { type, ticker, id } = req.query;

  try {
    // Multi ETF flows - use summary-history which is confirmed working
    if (type === 'etf-flows') {
      // First get ETF list for BTC
      const listRes = await fetch(`${BASE}/etfs?symbol=BTC&country_code=US`, { headers });
      const listData = listRes.ok ? await listRes.json() : [];
      const etfList = Array.isArray(listData) ? listData.slice(0, 5) : [];

      if (etfList.length > 0) {
        // Fetch snapshot for each ETF
        const snapshots = await Promise.allSettled(
          etfList.map(etf =>
            fetch(`${BASE}/etfs/${etf.ticker}/market-snapshot`, { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => d ? { ...d, ticker: etf.ticker, name: etf.name } : null)
              .catch(() => null)
          )
        );
        const flows = snapshots
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.value);
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        return res.status(200).json({ ok: true, data: flows, source: 'snapshot' });
      }

      // Fallback: use summary history
      const sumRes = await fetch(`${BASE}/etfs/summary-history?symbol=BTC&country_code=US&limit=1`, { headers });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json({ ok: true, data: [], summary: Array.isArray(sumData) ? sumData[0] : sumData, source: 'summary' });
      }

      return res.status(200).json({ ok: true, data: [], source: 'empty' });
    }

    let url = '';
    let cache = 60;

    if (type === 'etf-summary') {
      url = `${BASE}/etfs/summary-history?symbol=BTC&country_code=US&limit=7`;
      cache = 300;
    } else if (type === 'etf-list') {
      url = `${BASE}/etfs?symbol=BTC&country_code=US`;
      cache = 3600;
    } else if (type === 'etf-snapshot') {
      if (!ticker) return res.status(400).json({ error: 'ticker required' });
      url = `${BASE}/etfs/${ticker}/market-snapshot`;
      cache = 60;
    } else if (type === 'treasury') {
      url = `${BASE}/btc-treasuries`;
      cache = 300;
    } else if (type === 'currency') {
      if (!id) return res.status(400).json({ error: 'id required' });
      url = `${BASE}/currencies/${id}/market-snapshot`;
      cache = 30;
    } else if (type === 'crypto-stocks') {
      url = `${BASE}/crypto-stocks`;
      cache = 300;
    } else if (type === 'stock-snapshot') {
      if (!ticker) return res.status(400).json({ error: 'ticker required' });
      url = `${BASE}/crypto-stocks/${ticker}/market-snapshot`;
      cache = 30;
    } else if (type === 'sector') {
      url = `${BASE}/currencies/sector-spotlight`;
      cache = 300;
    } else {
      return res.status(400).json({ error: 'Unknown type: ' + type });
    }

    const r = await fetch(url, { headers });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: `SoSoValue ${r.status}`, raw: text.slice(0,200) });

    let data;
    try { data = JSON.parse(text); } catch(e) {
      return res.status(500).json({ error: 'Invalid JSON', raw: text.slice(0,200) });
    }

    res.setHeader('Cache-Control', `s-maxage=${cache}, stale-while-revalidate`);
    return res.status(200).json({ ok: true, data });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
