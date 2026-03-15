// QVIO Chat Backend v2.0 — Streaming
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, stream } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const keys = [
      process.env.GROQ_API_KEY,
      ...Array.from({length: 59}, (_, i) => process.env[`GROQ_KEY_${i + 2}`])
    ].filter(Boolean);

    if (keys.length === 0) return res.status(500).json({ error: 'No API keys' });

    // Try each key
    let lastError = null;
    for (let i = 0; i < keys.length; i++) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keys[i]}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.82,
            max_tokens: 2048,
            stream: stream === true  // Enable streaming if requested
          })
        });

        if (groqRes.status === 429 || groqRes.status === 401) {
          lastError = `Key ${i+1} failed (${groqRes.status})`;
          continue;
        }

        if (!groqRes.ok) {
          const err = await groqRes.json();
          lastError = err.error?.message || 'Groq error';
          continue;
        }

        // STREAMING MODE
        if (stream === true) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const reader = groqRes.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            res.write(chunk);
          }
          res.end();
          return;
        }

        // NON-STREAMING MODE (fallback)
        const data = await groqRes.json();
        return res.status(200).json(data);

      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    return res.status(429).json({ error: 'All keys exhausted: ' + lastError });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
