export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const feeds = [
    { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph' },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
    { url: 'https://decrypt.co/feed', source: 'Decrypt' },
  ];

  for (const feed of feeds) {
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 OnchainEdge/1.0' }
      });
      if (!r.ok) continue;
      const xml = await r.text();

      // Parse RSS items
      const items = [];
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const match of itemMatches) {
        const block = match[1];
        const title = decode(extract(block, 'title'));
        const link = extract(block, 'link') || extract(block, 'guid');
        const pubDate = extract(block, 'pubDate');
        const category = extract(block, 'category') || 'CRYPTO';
        if (title && link) {
          items.push({
            title,
            url: link.trim(),
            source: feed.source,
            published_on: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
            categories: category,
          });
        }
        if (items.length >= 8) break;
      }

      if (items.length > 0) {
        return res.status(200).json({ items, source: feed.source });
      }
    } catch (e) {
      continue;
    }
  }

  return res.status(500).json({ error: 'All news feeds failed' });
}

function extract(text, tag) {
  const m = text.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`));
  return m ? (m[1] || m[2] || '').trim() : '';
}

function decode(str) {
  return str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/<[^>]+>/g,'');
}
