export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoints = [
    'https://mainnet-gw.sodex.dev/api/v1/spot/tickers',
    'https://mainnet-gw.sodex.dev/api/v1/spot',
    'https://mainnet-gw.sodex.dev/api/v1/markets',
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'OnchainEdge/2.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) continue;
      const d = await r.json();
      const items = Array.isArray(d) ? d : (d.data || d.tickers || d.list || d.result || []);
      if (items.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
        return res.status(200).json({ ok: true, data: items, source: 'live', url });
      }
    } catch (e) { continue; }
  }

  // Use CoinGecko for fallback SoDEX-equivalent prices (free, no key)
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,sosovalue&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true', {
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      const d = await r.json();
      const fmt = (n) => n > 1e6 ? '$' + (n/1e6).toFixed(1)+'M' : n > 1e3 ? '$' + (n/1e3).toFixed(0)+'K' : '$'+n.toFixed(0);
      const pairs = [
        { id: 'bitcoin', sym: 'BTC/USDC' },
        { id: 'ethereum', sym: 'ETH/USDC' },
        { id: 'solana', sym: 'SOL/USDC' },
        { id: 'binancecoin', sym: 'BNB/USDC' },
      ].filter(x => d[x.id]).map(x => ({
        symbol: x.sym,
        lastPrice: d[x.id].usd?.toString(),
        priceChange: d[x.id].usd_24h_change?.toFixed(2),
        volume: d[x.id].usd_24h_vol?.toFixed(0),
        quoteVolume: d[x.id].usd_24h_vol?.toFixed(0)
      }));

      // Add SOSO if available
      if (d['sosovalue']) {
        pairs.push({ symbol: 'SOSO/USDC', lastPrice: d['sosovalue'].usd?.toString(), priceChange: d['sosovalue'].usd_24h_change?.toFixed(2), volume: '0', quoteVolume: '0' });
      } else {
        pairs.push({ symbol: 'SOSO/USDC', lastPrice: '0.432', priceChange: '6.60', volume: '1033194', quoteVolume: '1000000' });
      }

      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
      return res.status(200).json({ ok: true, data: pairs, source: 'coingecko-fallback' });
    }
  } catch (e) {}

  // Static fallback
  res.setHeader('Cache-Control', 's-maxage=30');
  return res.status(200).json({
    ok: true, fallback: true, source: 'static',
    data: [
      { symbol:'BTC/USDC', lastPrice:'77115', priceChange:'1.76', volume:'1240000', quoteVolume:'1200000' },
      { symbol:'ETH/USDC', lastPrice:'2284', priceChange:'1.57', volume:'892000', quoteVolume:'892000' },
      { symbol:'SOSO/USDC', lastPrice:'0.4320', priceChange:'6.60', volume:'1033194', quoteVolume:'1000000' },
      { symbol:'SOL/USDC', lastPrice:'84.01', priceChange:'1.32', volume:'445200', quoteVolume:'445000' },
      { symbol:'BNB/USDC', lastPrice:'643.10', priceChange:'1.01', volume:'234500', quoteVolume:'234000' },
    ]
  });
}
