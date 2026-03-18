// QVIO Voice Engine v2.0
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { text, lang } = req.query;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const safeText = String(text).substring(0, 200);
  const safeLang = String(lang || 'en').replace(/[^a-zA-Z-]/g, '');

  // Try multiple TTS sources
  const sources = [
    // Source 1: Google Translate TTS
    async () => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=${safeLang}&client=tw-ob`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        }
      });
      if (!r.ok) throw new Error('Google TTS failed: ' + r.status);
      return r;
    },
    // Source 2: VoiceRSS (fallback)
    async () => {
      const voiceMap = {
        'hi': 'hi-in', 'ta': 'ta-in', 'te': 'te-in',
        'kn': 'kn-in', 'ml': 'ml-in', 'bn': 'bn-in',
        'en': 'en-in', 'ar': 'ar-sa', 'fr': 'fr-fr',
        'de': 'de-de', 'es': 'es-es', 'ja': 'ja-jp',
        'ko': 'ko-kr', 'ru': 'ru-ru', 'zh': 'zh-cn'
      };
      const hl = voiceMap[safeLang] || 'en-in';
      const url = `https://api.voicerss.org/?key=your_key_here&hl=${hl}&src=${encodeURIComponent(safeText)}&f=16khz_16bit_mono`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('VoiceRSS failed');
      return r;
    }
  ];

  for (const source of sources) {
    try {
      const response = await source();
      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength < 100) continue; // Skip empty responses
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(Buffer.from(audioBuffer));
    } catch (err) {
      console.log('TTS source failed:', err.message);
      continue;
    }
  }

  // All sources failed
  return res.status(500).json({ error: 'All TTS sources unavailable' });
}
