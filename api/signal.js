// DUAL-MODEL AI SIGNAL ENGINE
// Model 1 (llama3-70b-8192): Primary market analysis + signal generation
// Model 2 (llama-3.1-8b-instant): Independent risk checker & contrarian validator

async function callGroq(model, systemPrompt, userPrompt, timeoutMs = 20000) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not configured');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
        // NO response_format — llama3-70b-8192 does NOT support it on Groq (causes HTTP 400)
      })
    });
    clearTimeout(t);
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`Groq ${r.status}: ${body.slice(0, 200)}`);
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || '';
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(stripped); } catch {}
  const m = stripped.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { prompt, mode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  // CHAT MODE
  if (mode === 'chat') {
    try {
      const reply = await callGroq(
        'llama3-70b-8192',
        'You are OnchainEdge AI, a concise crypto analyst. Answer in 2-3 sentences with specific data. No markdown.',
        prompt
      );
      return res.json({ ok: true, result: reply });
    } catch (e) {
      console.error('Chat error:', e.message);
      return res.json({ ok: false, error: e.message });
    }
  }

  // NEWS MODE
  if (mode === 'news') {
    try {
      const reply = await callGroq(
        'llama-3.1-8b-instant',
        'You are a crypto news analyst. State in 1-2 sentences if this headline is BULLISH, BEARISH, or NEUTRAL for crypto and why. No markdown.',
        prompt,
        10000
      );
      return res.json({ ok: true, result: reply });
    } catch (e) {
      console.error('News error:', e.message);
      return res.json({ ok: false, error: e.message });
    }
  }

  // SIGNAL MODE — DUAL MODEL
  const M1_SYS = `You are an expert crypto trading signal AI.
Analyze the market data and output ONLY a raw JSON object.
Start with { end with }. No backticks, no markdown, no text outside JSON.
Required keys: signal, confidence, reasoning, risk_level, timeframe, factors, risks, contrarian
- signal: BUY, SELL, HOLD, or NEUTRAL
- confidence: integer 0-100
- reasoning: 2-3 sentences with specific numbers
- risk_level: LOW, MED, or HIGH
- timeframe: e.g. "3-7 days"
- factors: array of 3 strings
- risks: array of 2 strings
- contrarian: 1 sentence`;

  const M2_SYS = `You are a crypto risk management AI.
Output ONLY a raw JSON object. Start with { end with }. No markdown.
Required keys: risk_verdict, risk_level, risk_score, warnings, recommendation
- risk_verdict: SAFE_TO_TRADE, CAUTION, HIGH_RISK, or EXTREME_RISK
- risk_level: LOW, MED, HIGH, or EXTREME
- risk_score: integer 0-100 (100 = max risk)
- warnings: array of 2 strings
- recommendation: 1 sentence`;

  const [m1, m2] = await Promise.allSettled([
    callGroq('llama3-70b-8192',       M1_SYS, prompt,                              22000),
    callGroq('llama-3.1-8b-instant',  M2_SYS, `Risk check this market:\n${prompt}`, 12000)
  ]);

  const model1Raw = m1.status === 'fulfilled' ? m1.value : null;
  const model2Raw = m2.status === 'fulfilled' ? m2.value : null;
  const model1Err = m1.status === 'rejected'  ? m1.reason?.message : null;
  const model2Err = m2.status === 'rejected'  ? m2.reason?.message : null;

  if (model1Err) console.error('Model1 error:', model1Err);
  if (model2Err) console.error('Model2 error:', model2Err);

  const r1 = extractJSON(model1Raw);
  const r2 = extractJSON(model2Raw);

  if (r1 && !['BUY','SELL','HOLD','NEUTRAL'].includes(r1.signal)) {
    console.error('Invalid signal:', r1.signal);
  }

  const validSignal = r1 && ['BUY','SELL','HOLD','NEUTRAL'].includes(r1.signal);

  return res.json({
    ok: validSignal || !!r2,
    // Model 1 output
    signal:     validSignal ? r1.signal      : null,
    confidence: validSignal ? r1.confidence  : null,
    reasoning:  validSignal ? r1.reasoning   : null,
    risk_level: validSignal ? r1.risk_level  : null,
    timeframe:  r1?.timeframe  || '3-7 days',
    factors:    r1?.factors    || [],
    risks:      r1?.risks      || [],
    contrarian: r1?.contrarian || null,
    // Model 2 risk check
    riskCheck: r2 ? {
      verdict:        r2.risk_verdict    || null,
      level:          r2.risk_level      || null,
      score:          r2.risk_score      || null,
      warnings:       r2.warnings        || [],
      recommendation: r2.recommendation  || null
    } : null,
    engines: {
      primary:        validSignal ? 'llama3-70b-8192'       : null,
      riskCheck:      r2          ? 'llama-3.1-8b-instant'  : null,
      primaryError:   model1Err   || null,
      riskError:      model2Err   || null
    }
  });
}
