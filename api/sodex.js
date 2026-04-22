export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type } = req.query;

  try {
    let url = '';
    if (type === 'tickers') {
      url = 'https://mainnet-gw.sodex.dev/api/v1/spot/tickers';
    } else if (type === 'perps') {
      url = 'https://mainnet-gw.sodex.dev/api/v1/perps/tickers';
    } else {
      url = 'https://mainnet-gw.sodex.dev/api/v1/spot/tickers';
    }

    const r = await fetch(url, {
      headers: { 'User-Agent': 'OnchainEdge/1.0', 'Accept': 'application/json' }
    });

    if (!r.ok) throw new Error('SoDEX API error: ' + r.status);
    const data = await r.json();

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({ ok: true, data });

  } catch (e) {
    // Fallback with realistic SoDEX data if API unreachable
    return res.status(200).json({
      ok: false,
      fallback: true,
      data: [
        { symbol: 'BTC/USDC', lastPrice: '84250.00', priceChange: '2.41', volume: '1243800' },
        { symbol: 'ETH/USDC', lastPrice: '2391.50', priceChange: '3.05', volume: '892300' },
        { symbol: 'SOSO/USDC', lastPrice: '0.4319', priceChange: '6.60', volume: '1033194' },
        { symbol: 'SOL/USDC', lastPrice: '88.47', priceChange: '3.17', volume: '445200' },
        { symbol: 'BNB/USDC', lastPrice: '643.10', priceChange: '1.01', volume: '234500' },
      ],
      error: e.message
    });
  }
}
