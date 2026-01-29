import yt from '@vreden/youtube_scraper';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST method.'
    });
  }

  try {
    const { query } = req.body;

    // Validate query
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    console.log(`Searching YouTube for: ${query}`);

    // Search YouTube
    const results = await yt.search(query);

    // Check if results are valid
    if (!results || !results.results) {
      return res.status(500).json({
        success: false,
        error: 'Failed to search YouTube',
        details: results
      });
    }

    // Filter only video results (exclude playlists, channels, etc.)
    const videoResults = results.results.filter(item => item.type === 'video');

    // Return successful response
    return res.status(200).json({
      success: true,
      data: videoResults,
      total: videoResults.length
    });

  } catch (error) {
    console.error('Error in search.js:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
