import fetch from 'node-fetch';

export const handler = async function(event) {
  console.log('Azure Translator Proxy function invoked');
  
  const AZURE_KEY = process.env.AZURE_TRANSLATOR_KEY || process.env.VITE_AZURE_TRANSLATOR_KEY;
  const AZURE_REGION = process.env.AZURE_TRANSLATOR_REGION || process.env.VITE_AZURE_TRANSLATOR_REGION || 'eastus';
  const AZURE_ENDPOINT = process.env.AZURE_TRANSLATOR_ENDPOINT || process.env.VITE_AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com/';

  if (!AZURE_KEY) {
    console.error('Azure Translator key not found in environment variables');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Azure Translator key not set in environment variables.' })
    };
  }

  try {
    const { text, targetLanguage = 'zu' } = JSON.parse(event.body);

    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Text to translate is required.' })
      };
    }

    const response = await fetch(
      `${AZURE_ENDPOINT}/translate?api-version=3.0&to=${targetLanguage}`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Ocp-Apim-Subscription-Region': AZURE_REGION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ text }]),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Azure Translation error:', error);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Translation failed: ${error}` })
      };
    }

    const data = await response.json();
    if (!data || !data[0] || !data[0].translations || !data[0].translations[0]) {
      throw new Error('Invalid response from Azure Translator API');
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        text: data[0].translations[0].text,
        from: data[0].detectedLanguage?.language || 'en',
        to: targetLanguage
      })
    };
  } catch (error) {
    console.error('Error in Azure Translator proxy:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error in Azure Translator proxy',
        details: error.message 
      })
    };
  }
};
