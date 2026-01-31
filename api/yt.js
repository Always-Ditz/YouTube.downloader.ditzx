import yt from '@vreden/youtube_scraper';
import crypto from 'crypto';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const BASE_URL = 'https://youtubedl.siputzx.my.id';

// Helper function untuk solve Proof of Work
function solvePow(challenge, difficulty) {
  let nonce = 0;
  const prefix = '0'.repeat(difficulty);
  console.log(`[POW] Solving complexity ${difficulty}...`);
  const start = Date.now();
  
  while (true) {
    const hash = crypto.createHash('sha256')
      .update(challenge + nonce.toString())
      .digest('hex');
      
    if (hash.startsWith(prefix)) {
      console.log(`[POW] Done in ${Date.now() - start}ms`);
      return nonce.toString();
    }
    nonce++;
    
    // Safety break untuk mencegah infinite loop (optional)
    if (nonce > 10000000) {
      throw new Error('PoW solving timeout');
    }
  }
}

// Helper function untuk download via external API dengan PoW
async function downloadWithExternalAPI(type, url, apikey = null) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ 
    jar, 
    withCredentials: true,
    headers: { 
      "Accept": "application/json, text/plain, */*"
    }
  }));

  try {
    const downloadType = type === 'audio' || type === 'mp3' ? 'audio' : 'merge';

    // Step 1: Authentication (PoW atau Premium Key)
    if (apikey) {
      console.log(`[AUTH] Using Premium API Key`);
    } else {
      console.log(`[AUTH] Requesting PoW Challenge...`);
      
      // Request PoW challenge
      const { data: challengeData } = await client.post(
        `${BASE_URL}/akumaudownload`, 
        { url, type: downloadType }
      );
      
      const { challenge, difficulty } = challengeData;
      
      // Solve PoW
      const nonce = solvePow(challenge, difficulty);
      
      console.log(`[AUTH] Verifying Session...`);
      
      // Verify session dengan nonce
      await client.post(
        `${BASE_URL}/cekpunyaku`, 
        { url, type: downloadType, nonce }
      );
    }

    // Step 2: Initialize dan poll download status
    console.log(`[TASK] Initializing Download...`);
    
    let attempts = 0;
    const maxAttempts = 30; // Maksimal 30 attempts (90 detik dengan interval 3 detik)
    
    while (attempts < maxAttempts) {
      const { data } = await client.get(`${BASE_URL}/download`, { 
        params: { url, type: downloadType, apikey } 
      });
      
      // Download completed
      if (data.status === 'completed') {
        console.log(`[TASK] Status: COMPLETED`);
        return BASE_URL + data.fileUrl;
      }
      
      // Download failed
      if (data.status === 'failed') {
        console.log(`[TASK] Status: FAILED | Error: ${data.error}`);
        throw new Error(data.error || 'Download failed');
      }
      
      // Still processing
      console.log(`[LOOP] Status: ${data.status} | Progress: ${data.progress || '0%'}`);
      
      // Wait 3 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }
    
    throw new Error('Download timeout - exceeded maximum attempts');
    
  } catch (error) {
    console.error(`[ERROR]`, error.response?.data || error.message);
    throw error;
  }
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
    const { url, quality, type, apikey } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+$/;
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
      console.log('Metadata fetched successfully');
    } catch (metaError) {
      console.error('Metadata fetch failed:', metaError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch video metadata',
        message: metaError.message
      });
    }

    // If only metadata is requested - return flat structure
    if (type === 'metadata') {
      return res.status(200).json({
        success: true,
        data: metadata
      });
    }

    // STEP 2: Download using external API with PoW
    let downloadUrl;
    try {
      console.log('Starting download with PoW authentication...');
      downloadUrl = await downloadWithExternalAPI(type, url, apikey);
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
    return res.status(200).json({
      success: true,
      data: {
        ...metadata,  // Spread all metadata properties
        download: {
          status: true,
          url: downloadUrl,
          message: 'Download ready',
          type: type === 'audio' || type === 'mp3' ? 'audio' : 'video'
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
