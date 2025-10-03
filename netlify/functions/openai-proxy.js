import fetch from 'node-fetch';

export const handler = async function(event) {
  // Minimal logging for production
  if (process.env.NODE_ENV === 'development') {
    console.log('OpenAI Proxy function invoked');
  }
  
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  // Check for API key in Netlify environment variables
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  
  // Validate API key format
  if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key');
    return {
      statusCode: 500,
      headers: corsHeaders,
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
      headers: corsHeaders,
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
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Invalid request format. Messages array is required.',
        details: { receivedBody: body }
      })
    };
  }

  try {
    // Always use gpt-4o-mini model with streaming for Netlify free plan
    const requestBody = {
      ...body,
      model: 'gpt-4o-mini',
      max_tokens: body.max_tokens || 1500, // Reduced for faster response
      temperature: body.temperature || 0.7,
      stream: true // ALWAYS stream on free plan to avoid 10s timeout
    };

    console.log('🚨 Netlify FREE PLAN: Using streaming to avoid 10s timeout', {
      model: requestBody.model,
      messageCount: requestBody.messages.length,
      maxTokens: requestBody.max_tokens
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: errorData.error?.message || errorData.message || 'OpenAI API request failed',
          details: {
            status: response.status,
            message: errorData.error?.message || errorData.message,
            timestamp: new Date().toISOString()
          }
        })
      };
    }

    // Handle streaming response
    if (requestBody.stream) {
      console.log('Processing streamed response');
      let fullContent = '';
      const chunks = [];
      
      // Read the stream
      const reader = response.body;
      let buffer = '';
      
      for await (const chunk of reader) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                chunks.push(content);
              }
            } catch (e) {
              // Skip invalid JSON chunks
              continue;
            }
          }
        }
      }
      
      console.log('Stream completed, total content length:', fullContent.length);
      
      // Return the accumulated content in the same format as non-streaming
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          choices: [{
            message: {
              content: fullContent,
              role: 'assistant'
            },
            finish_reason: 'stop'
          }],
          usage: {
            total_tokens: Math.ceil(fullContent.length / 4) // Rough estimate
          }
        })
      };
    } else {
      // Handle non-streaming response
      const data = await response.json();
      console.log('OpenAI API request successful with model: gpt-4o-mini');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data)
      };
    }
    
  } catch (error) {
    console.error('Error in OpenAI proxy function:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error in OpenAI proxy',
        details: error.message 
      })
    };
  }
};
