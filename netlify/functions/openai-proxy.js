import fetch from 'node-fetch';

export const handler = async function(event) {
  console.log('OpenAI Proxy function invoked');
  
  // Check for API key in Netlify environment variables
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  
  // Validate API key format
  if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key');
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Missing OpenAI API key',
        debug: { 
          keyExists: !!OPENAI_API_KEY,
          keyLength: OPENAI_API_KEY?.length,
          envVars: {
            hasOpenAIKey: !!process.env.OPENAI_API_KEY,
            hasViteOpenAIKey: !!process.env.VITE_OPENAI_API_KEY
          }
        }
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
    console.log('Request body parsed successfully');
  } catch (err) {
    console.error('Failed to parse request body:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'Invalid request body format.',
        details: err.message
      })
    };
  }

  // Validate request body
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    console.error('Invalid request format - missing or invalid messages array');
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Invalid request format. Messages array is required.',
        details: { receivedBody: body }
      })
    };
  }

  try {
    // Always use gpt-4o-mini model
    const requestBody = {
      ...body,
      model: 'gpt-4o-mini',
      max_tokens: body.max_tokens || 2000,
      temperature: body.temperature || 0.7
    };

    console.log('Sending request to OpenAI API...', {
      model: requestBody.model,
      messageCount: requestBody.messages.length
    });

    // Set up AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data.error || data
      });
      
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || 'OpenAI API request failed',
          details: {
            status: response.status,
            message: data.error?.message,
            timestamp: new Date().toISOString()
          }
        })
      };
    }

    console.log('OpenAI API request successful with model: gpt-4o-mini');
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error in OpenAI proxy function:', error);
    
    // Check if it's an abort error (timeout)
    if (error.name === 'AbortError') {
      return {
        statusCode: 504,
        body: JSON.stringify({ 
          error: 'Request timed out',
          details: 'The OpenAI API request took too long to respond'
        })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error in OpenAI proxy',
        details: error.message 
      })
    };
  }
};
