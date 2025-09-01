export class TranslationService {
  private apiKey: string;
  private endpoint: string;
  private location: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_AZURE_TRANSLATOR_KEY || '';
    this.endpoint = import.meta.env.VITE_AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com/';
    this.location = import.meta.env.VITE_AZURE_TRANSLATOR_REGION || 'eastus';

    if (!this.apiKey) {
      console.warn('⚠️ Azure Translator API key not found in environment variables');
    }
  }

  async translateText(text: string, targetLanguage: string = 'zu'): Promise<string> {
    if (!this.apiKey) {
      console.warn('⚠️ Translation skipped - API key not configured');
      return text;
    }

    try {
      console.log('🌍 Translating text to', targetLanguage);
      const response = await fetch('/api/azure-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, targetLanguage }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Translation failed with status: ${response.status}, details: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log('✅ Azure Translation successful', result);
      
      if (!result || !result.text) {
        throw new Error('Invalid translation response format');
      }
      
      return result.text;
    } catch (error) {
      console.error('❌ Translation error:', error);
      return text; // Return original text if translation fails
    }
  }
}
