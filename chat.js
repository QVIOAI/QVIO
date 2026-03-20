// QVIO Chat Backend — 1000 Key Rotation
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

    // Collect all keys - supports up to 1000
    const keys = [];
    // GROQ_API_KEY = key 1
    if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
    // GROQ_KEY_2 through GROQ_KEY_1000
    for (let i = 2; i <= 1000; i++) {
      const k = process.env[`GROQ_KEY_${i}`];
      if (k) keys.push(k);
    }

    if (keys.length === 0) return res.status(500).json({ error: 'No API keys configured' });

    // Smart rotation - pick random key to distribute load
    const shuffled = keys.sort(() => Math.random() - 0.5);

    let lastError = null;
    for (const key of shuffled) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.82,
            max_tokens: 2048,
            stream: stream === true
          })
        });

        if (groqRes.status === 429 || groqRes.status === 401) {
          lastError = `Key failed (${groqRes.status})`;
          continue;
        }

        if (!groqRes.ok) {
          const err = await groqRes.json().catch(() => ({}));
          lastError = err.error?.message || `Error ${groqRes.status}`;
          continue;
        }

        // STREAMING
        if (stream === true) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          const reader = groqRes.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value));
          }
          res.end();
          return;
        }

        // NON-STREAMING
        const data = await groqRes.json();
        return res.status(200).json(data);

      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    return res.status(429).json({ error: `All ${keys.length} keys exhausted. Last error: ${lastError}` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
