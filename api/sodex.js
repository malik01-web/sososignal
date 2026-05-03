export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Try SoDEX endpoints
  const endpoints = [
    'https://mainnet-gw.sodex.dev/api/v1/spot/tickers',
    'https://mainnet-gw.sodex.dev/api/v1/spot',
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'OnchainEdge/2.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) continue;
      const raw = await r.json();
      const items = Array.isArray(raw) ? raw : (raw.data || raw.tickers || raw.list || []);
      if (items.length > 0) {
        const parsed = items.slice(0, 6).map(t => ({
          symbol: t.symbol || t.pair || t.market || '???',
          lastPrice: String(t.lastPrice || t.last || t.price || t.close || '0'),
          priceChange: String(t.priceChange || t.change || t.priceChangePercent || '0'),
          volume: String(t.volume || t.baseVolume || '0'),
          quoteVolume: String(t.quoteVolume || t.volume || '0')
        })).filter(x => x.symbol !== '???' && parseFloat(x.lastPrice) > 0);

        if (parsed.length > 0) {
          res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
          return res.status(200).json({ ok: true, data: parsed, source: 'sodex-live' });
        }
      }
    } catch (e) { continue; }
  }

  // Fallback: CoinGecko for live prices
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true',
      { signal: AbortSignal.timeout(5000) }
    );
    if (r.ok) {
      const d = await r.json();
      const pairs = [
        { id: 'bitcoin',      sym: 'BTC/USDC' },
        { id: 'ethereum',     sym: 'ETH/USDC' },
        { id: 'solana',       sym: 'SOL/USDC' },
        { id: 'binancecoin',  sym: 'BNB/USDC' },
      ].filter(x => d[x.id]).map(x => ({
        symbol: x.sym,
        lastPrice: String(d[x.id].usd || 0),
        priceChange: String((d[x.id].usd_24h_change || 0).toFixed(2)),
        volume: String((d[x.id].usd_24h_vol || 0).toFixed(0)),
        quoteVolume: String((d[x.id].usd_24h_vol || 0).toFixed(0))
      }));

      // Add SOSO manually
      pairs.push({ symbol: 'SOSO/USDC', lastPrice: '0.4320', priceChange: '6.60', volume: '1033194', quoteVolume: '1000000' });

      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
      return res.status(200).json({ ok: true, data: pairs, source: 'coingecko' });
    }
  } catch (e) {}

  // Static fallback
  return res.status(200).json({
    ok: true, source: 'static',
    data: [
      { symbol:'BTC/USDC',  lastPrice:'77115',  priceChange:'1.76', volume:'1240000', quoteVolume:'1200000' },
      { symbol:'ETH/USDC',  lastPrice:'2284',   priceChange:'1.57', volume:'892000',  quoteVolume:'892000'  },
      { symbol:'SOSO/USDC', lastPrice:'0.4320', priceChange:'6.60', volume:'1033194', quoteVolume:'1000000' },
      { symbol:'SOL/USDC',  lastPrice:'84.01',  priceChange:'1.32', volume:'445200',  quoteVolume:'445000'  },
      { symbol:'BNB/USDC',  lastPrice:'643.10', priceChange:'1.01', volume:'234500',  quoteVolume:'234000'  },
    ]
  });
}
