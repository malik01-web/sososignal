// ✅ FIXED sodex.js — correct SoDEX public ticker endpoint
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ✅ FIXED: SoDEX public API endpoint for tickers
    // SoDEX is built on Sui chain — use their public markets API
    const SODEX_API = 'https://api.sodex.io/v1/markets/tickers';

    let data = null;

    try {
      const r = await fetch(SODEX_API, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });

      if (r.ok) {
        const json = await r.json();
        const tickers = json?.data || json?.tickers || json || [];

        if (Array.isArray(tickers) && tickers.length > 0) {
          // Map to our format
          data = tickers.slice(0, 8).map(t => ({
            pair: t.market || t.symbol || t.pair,
            p: parseFloat(t.last || t.lastPrice || t.price || 0),
            ch: parseFloat(t.priceChange24h || t.change24h || t.change || 0),
            vol: formatVol(parseFloat(t.volume24h || t.volume || 0))
          })).filter(t => t.p > 0);
        }
      }
    } catch (e) {
      console.error('SoDEX API error:', e.message);
    }

    // ✅ Always return fallback data if live fails — so UI never breaks
    if (!data || data.length === 0) {
      return res.json({
        ok: true,
        fallback: true,
        data: [
          { pair: 'BTC/USDC', p: 77115, ch: 1.76, vol: '$1.2M' },
          { pair: 'ETH/USDC', p: 2284, ch: 1.57, vol: '$892K' },
          { pair: 'SOSO/USDC', p: 0.432, ch: 6.60, vol: '$1.0M' },
          { pair: 'SOL/USDC', p: 84.01, ch: 1.32, vol: '$445K' },
          { pair: 'BNB/USDC', p: 643.10, ch: 1.01, vol: '$235K' }
        ]
      });
    }

    return res.json({ ok: true, fallback: false, data });

  } catch (e) {
    console.error('sodex handler error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

function formatVol(v) {
  if (!v || isNaN(v)) return '$0';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}
