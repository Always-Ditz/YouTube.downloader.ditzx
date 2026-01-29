import yt from '@vreden/youtube_scraper';

// Helper function untuk download via external API
async function downloadWithExternalAPI(type, url) {
  const apiType = type === 'audio' ? 'audio' : 'merge';
  
  let attempts = 0;
  const maxAttempts = 30; // Maksimal 30 attempts (60 detik)
  
  while (attempts < maxAttempts) {
    try {
      const res = await fetch(`https://youtubedl.siputzx.my.id/download?type=${apiType}&url=${url}`, {
        headers: { "Accept": "application/json, text/plain, */*" }
      });
      
      const data = await res.json();
      
      if (data.status === "completed") {
        return "https://youtubedl.siputzx.my.id" + data.fileUrl;
      }
      
      // Wait 2 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
    } catch (error) {
      console.error('Download API error:', error);
      throw new Error('Failed to download from external API');
    }
  }
  
  throw new Error('Download timeout - exceeded maximum attempts');
}

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

    console.log(`Processing request - Type: ${type}, URL: ${url}, Quality: ${quality}`);

    // STEP 1: Get metadata using @vreden/youtube_scraper
    let metadata;
    try {
      metadata = await yt.metadata(url);
      console.log('Metadata fetched successfully:', metadata);
    } catch (metaError) {
      console.error('Metadata fetch failed:', metaError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch video metadata',
        message: metaError.message
      });
    }

    // If only metadata is requested - FIXED: Return flat structure
    if (type === 'metadata') {
      return res.status(200).json({
        success: true,
        data: metadata  // ← Flat structure, langsung return metadata dari library
      });
    }

    // STEP 2: Download using external API
    let downloadUrl;
    try {
      if (type === 'audio' || type === 'mp3') {
        console.log('Downloading audio via external API...');
        downloadUrl = await downloadWithExternalAPI('audio', url);
      } else {
        // Default to video
        console.log('Downloading video via external API...');
        downloadUrl = await downloadWithExternalAPI('video', url);
      }
      
      console.log('Download completed:', downloadUrl);
      
    } catch (downloadError) {
      console.error('Download failed:', downloadError);
      return res.status(500).json({
        success: false,
        error: 'Failed to download video/audio',
        message: downloadError.message,
        details: {
          metadata: metadata // Still return metadata even if download fails
        }
      });
    }

    // Return successful response with metadata + download URL
    // FIXED: Flatten the response structure
    return res.status(200).json({
      success: true,
      data: {
        ...metadata,  // Spread all metadata properties (title, author, duration, views, etc)
        download: {
          status: true,
          url: downloadUrl,
          message: 'Download ready',
          type: type === 'audio' ? 'audio' : 'video'
        }
      }
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
