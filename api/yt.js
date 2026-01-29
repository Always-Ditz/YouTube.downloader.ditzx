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
    const { url, quality, type } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    let result;

    // Process based on type
    if (type === 'audio' || type === 'mp3') {
      // Download Audio MP3
      const audioQuality = quality || 128;
      console.log(`Downloading audio: ${url} with quality ${audioQuality}kbps`);
      
      result = await yt.ytmp3(url, audioQuality);
      
    } else if (type === 'video' || type === 'mp4') {
      // Download Video MP4
      const videoQuality = quality || 720;
      console.log(`Downloading video: ${url} with quality ${videoQuality}p`);
      
      result = await yt.ytmp4(url, videoQuality);
      
    } else if (type === 'metadata') {
      // Get metadata only
      console.log(`Fetching metadata: ${url}`);
      
      result = await yt.metadata(url);
      
    } else {
      // Default to video if type not specified
      const videoQuality = quality || 720;
      console.log(`Downloading video (default): ${url} with quality ${videoQuality}p`);
      
      result = await yt.ytmp4(url, videoQuality);
    }

    // Check if result is valid
    if (!result || !result.status) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process YouTube video',
        details: result
      });
    }

    // Return successful response
    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error in yt.js:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
