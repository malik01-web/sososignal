export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  // Try models in order — use llama-3.3-70b-versatile (supports json_object)
  const models = ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'gemma2-9b-it'];

  for (const model of models) {
    try {
      const isJsonRequest = prompt.includes('STRICT JSON') || prompt.includes('Return:') || prompt.includes('"signal"');

      const body = {
        model,
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: isJsonRequest
              ? 'You are a professional crypto analyst. Always respond with valid JSON only. No markdown, no explanation, just the JSON object.'
              : 'You are OnchainEdge AI, a professional crypto market analyst. Give concise, data-driven responses in 2-3 sentences.'
          },
          { role: 'user', content: prompt }
        ]
      };

      // Only add response_format for models that support it
      if (isJsonRequest && model === 'llama-3.3-70b-versatile') {
        body.response_format = { type: 'json_object' };
      }

      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
        body: JSON.stringify(body)
      });

      if (!r.ok) {
        const err = await r.text();
        console.error(`Groq ${model} failed: ${r.status} ${err.slice(0, 100)}`);
        continue; // try next model
      }

      const d = await r.json();
      const result = d.choices?.[0]?.message?.content || '';
      return res.status(200).json({ result });

    } catch (e) {
      console.error(`Model ${model} error:`, e.message);
      continue;
    }
  }

  return res.status(500).json({ error: 'All Groq models failed' });
}
