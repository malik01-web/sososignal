export default async function handler(req, res) {
  // Use the same base URL environment variable as your soso.js file
  const baseUrl = process.env.SOSO_API_URL || 'https://api.sosovalue.com/v1'; 
  
  try {
    // Fetching from the Hot News endpoint based on the documentation
    const response = await fetch(`${baseUrl}/news/hot`, {
      headers: {
        'Authorization': `Bearer ${process.env.SOSO_API_KEY}` 
      }
    });
    
    if (!response.ok) throw new Error(`SoSoValue News API returned ${response.status}`);
    
    const rawData = await response.json();
    
    // Your frontend index.html explicitly looks for an "items" array (if(n&&n.items)).
    // APIs often return arrays under a "data" key, so we map it here safely to prevent frontend breaks.
    const mappedItems = rawData.data || rawData.items || rawData || [];
    
    // Cache for 60 seconds to respect the SoSoValue rate limits
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    
    // Return the JSON structure your frontend requires
    res.status(200).json({ items: mappedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
