import fetch from 'node-fetch';

export const handler = async function(event) {
  console.log('OpenAI Streaming function invoked');
  
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
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
  
  if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Missing OpenAI API key'
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
        error: 'Invalid request format. Messages array is required.'
      })
    };
  }

  try {
    // Always use streaming and gpt-4o-mini model
    const requestBody = {
      ...body,
      model: 'gpt-4o-mini',
      max_tokens: body.max_tokens || 2000,
      temperature: body.temperature || 0.7,
      stream: true // Force streaming
    };

    console.log('Sending streaming request to OpenAI API...', {
      model: requestBody.model,
      messageCount: requestBody.messages.length
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
      
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'OpenAI API request failed',
          details: errorText
        })
      };
    }

    // Process streaming response and accumulate content
    console.log('Processing streamed response...');
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
              
              // Send progress update every 100 characters
              if (fullContent.length % 100 === 0) {
                console.log(`Streaming progress: ${fullContent.length} characters`);
              }
            }
          } catch (e) {
            // Skip invalid JSON chunks
            continue;
          }
        }
      }
    }
    
    console.log(`Stream completed successfully! Total content length: ${fullContent.length} characters`);
    
    // Return the accumulated content in the same format as non-streaming
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        choices: [{
          message: {
            content: fullContent,
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: {
          total_tokens: Math.ceil(fullContent.length / 4), // Rough estimate
          prompt_tokens: Math.ceil(JSON.stringify(requestBody.messages).length / 4),
          completion_tokens: Math.ceil(fullContent.length / 4)
        },
        model: requestBody.model,
        streaming: true
      })
    };
    
  } catch (error) {
    console.error('Error in OpenAI streaming function:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error in OpenAI streaming proxy',
        details: error.message 
      })
    };
  }
};