export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SOSO_KEY = process.env.SOSO_API_KEY;
  if (!SOSO_KEY) return res.status(500).json({ error: 'SoSoValue key not configured' });

  const { type } = req.query;

  try {
    let url = '';
    if (type === 'etf') {
      // BTC Spot ETF current metrics
      url = 'https://openapi.sosovalue.com/api/v2/etf/bitcoin/metrics';
    } else if (type === 'news') {
      // Featured crypto news - BTC currencyId
      url = 'https://openapi.sosovalue.com/api/v1/news/featured/currency?currencyId=1673723677362319866&pageNum=1&pageSize=6&categoryList=1,2';
    } else {
      return res.status(400).json({ error: 'Unknown type' });
    }

    const r = await fetch(url, {
      headers: {
        'x-soso-api-key': SOSO_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: 'SoSoValue API error: ' + err.slice(0, 100) });
    }

    const data = await r.json();

    // Add cache headers to reduce repeat calls (cache 1 hour)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
