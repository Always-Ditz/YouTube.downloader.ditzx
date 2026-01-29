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

  // Only allow GET method for download
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET method.'
    });
  }

  try {
    const { url, filename } = req.query;

    // Validate parameters
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Download URL is required'
      });
    }

    const downloadFilename = filename || 'download';

    console.log(`Starting download: ${url}`);
    console.log(`Filename: ${downloadFilename}`);

    // Fetch the file from the URL
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Failed to fetch file: ${response.statusText}`
      });
    }

    // Get content type and size
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    // Set response headers for download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Enable streaming
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the response body chunk by chunk
    const reader = response.body.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Write chunk to response
        res.write(Buffer.from(value));
      }
      
      // End the response
      res.end();
      
      console.log('Download completed successfully');
      
    } catch (streamError) {
      console.error('Error during streaming:', streamError);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error during file streaming',
          message: streamError.message
        });
      }
    }

  } catch (error) {
    console.error('Error in download.js:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
      }
    
