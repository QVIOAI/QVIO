export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const RSS_FEEDS = {
    india: [
      'https://feeds.feedburner.com/ndtvnews-top-stories',
      'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
      'https://www.thehindu.com/news/national/feeder/default.rss',
    ],
    world: [
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://rss.reuters.com/reuters/worldNews',
      'https://feeds.skynews.com/feeds/rss/world.xml',
    ],
    tech: [
      'https://feeds.feedburner.com/TechCrunch',
      'https://www.wired.com/feed/rss',
      'https://feeds.arstechnica.com/arstechnica/index',
    ],
    sports: [
      'https://feeds.bbci.co.uk/sport/rss.xml',
      'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms',
      'https://sports.ndtv.com/rss/all',
    ]
  };

  try {
    const category = req.query.category || 'all';
    let feedUrls = [];

    if (category === 'all') {
      Object.values(RSS_FEEDS).forEach(feeds => feedUrls.push(feeds[0]));
    } else {
      feedUrls = RSS_FEEDS[category] || RSS_FEEDS.india;
    }

    const headlines = [];

    await Promise.allSettled(feedUrls.map(async (url) => {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        const xml = await r.text();

        // Parse RSS items
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
        items.slice(0, 3).forEach(item => {
          const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                        item.match(/<title>(.*?)<\/title>/)?.[1] || '';
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
          if (title && title.length > 10) {
            headlines.push({
              title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").trim(),
              time: pubDate ? new Date(pubDate).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : ''
            });
          }
        });
      } catch(e) {}
    }));

    if (headlines.length === 0) {
      return res.status(200).json({ headlines: [], message: 'No news available right now' });
    }

    return res.status(200).json({ headlines: headlines.slice(0, 15) });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
