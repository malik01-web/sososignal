// FIXED sodex.js — robust price parsing, never returns undefined
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Always-good fallback
  const FALLBACK = [
    { pair: 'BTC/USDC',  p: 77115,  ch: 1.76, vol: '$1.2M' },
    { pair: 'ETH/USDC',  p: 2284,   ch: 1.57, vol: '$892K' },
    { pair: 'SOSO/USDC', p: 0.432,  ch: 6.60, vol: '$1.0M' },
    { pair: 'SOL/USDC',  p: 84.01,  ch: 1.32, vol: '$445K' },
    { pair: 'BNB/USDC',  p: 643.10, ch: 1.01, vol: '$235K' }
  ];

  try {
    let data = null;

    // Try multiple possible SoDEX API endpoints
    const ENDPOINTS = [
      'https://api.sodex.io/v1/markets/tickers',
      'https://api.sodex.io/v1/tickers',
      'https://sodex.io/api/tickers'
    ];

    for (const endpoint of ENDPOINTS) {
      try {
        const r = await fetch(endpoint, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        if (!r.ok) continue;
        const json = await r.json();

        // Try all possible response shapes
        const raw = json?.data || json?.tickers || json?.markets || json?.result || json;
        const arr = Array.isArray(raw) ? raw : (Array.isArray(json) ? json : null);
        if (!arr || arr.length === 0) continue;

        const parsed = arr.slice(0, 8).map(t => {
          // FIXED: Try every possible field name for price
          const price = parseFloat(
            t.last ?? t.lastPrice ?? t.price ?? t.close ??
            t.current_price ?? t.last_price ?? 0
          );
          const change = parseFloat(
            t.priceChange24h ?? t.change24h ?? t.change ??
            t.price_change_24h ?? t.changePercent ?? 0
          );
          const vol = parseFloat(
            t.volume24h ?? t.volume ?? t.vol ?? t.quoteVolume ?? 0
          );
          const pair = (t.market ?? t.symbol ?? t.pair ?? t.name ?? '').toUpperCase();
          // Only include if price is a valid positive number
          if (!pair || !isFinite(price) || price <= 0) return null;
          return { pair, p: price, ch: change, vol: formatVol(vol) };
        }).filter(Boolean);

        if (parsed.length > 0) { data = parsed; break; }
      } catch { continue; }
    }

    if (!data || data.length === 0) {
      return res.json({ ok: true, fallback: true, data: FALLBACK });
    }
    return res.json({ ok: true, fallback: false, data });

  } catch (e) {
    console.error('sodex handler error:', e.message);
    return res.json({ ok: true, fallback: true, data: FALLBACK });
  }
}

function formatVol(v) {
  if (!v || isNaN(v) || v === 0) return '$0';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}
