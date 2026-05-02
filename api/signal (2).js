export default async function handler(req, res) {
  // Allow both GET (chat) and POST (signal)
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt, mode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    // Use json_object mode only for signal (not chat)
    const isSignal = mode !== 'chat';

    const body = {
      // ✅ FIXED: mixtral-8x7b-32768 was deprecated. Use llama3-70b-8192
      model: 'llama3-70b-8192',
      messages: [
        {
          role: 'system',
          content: isSignal
            ? 'You are a crypto market analyst. Output ONLY valid JSON with no markdown, no code blocks, no extra text.'
            : 'You are OnchainEdge AI, a concise crypto market analyst. Give direct, data-driven answers in 2-3 sentences. Mention specific numbers when available.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
      // ✅ FIXED: Only use json_object mode for signal generation, not chat
      ...(isSignal ? { response_format: { type: 'json_object' } } : {})
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify(body)
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API Error (${response.status}):`, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    res.status(200).json({ result: content, ok: true });

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Groq API timeout after 20s' });
    }
    console.error('Signal handler error:', error);
    res.status(500).json({ error: error.message });
  }
}
