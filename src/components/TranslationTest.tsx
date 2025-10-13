import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translationService } from '@/services/translationService';

export const TranslationTest = () => {
  const [inputText, setInputText] = useState('Hello, how are you today?');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    try {
      const result = await translationService.translateText(inputText, 'zu');
      setTranslatedText(result);
      console.log('✅ Translation completed:', result);
    } catch (error) {
      console.error('❌ Translation failed:', error);
      setTranslatedText('Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Translation Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">English Text:</label>
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter text to translate"
          />
        </div>
        
        <Button 
          onClick={handleTranslate}
          disabled={isTranslating || !inputText.trim()}
          className="w-full"
        >
          {isTranslating ? 'Translating...' : 'Translate to Zulu'}
        </Button>
        
        {translatedText && (
          <div>
            <label className="block text-sm font-medium mb-2">Zulu Translation:</label>
            <div className="p-3 bg-blue-50 rounded-lg border">
              {translatedText}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};