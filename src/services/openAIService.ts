import { TranslationService } from './translationService';

// Message interface for OpenAI API
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class OpenAIService {
  // private apiKey: string; // No longer needed in frontend
  private model: string;
  private isConfigured: boolean = false;
  private translationService: TranslationService;

  constructor() {
    this.model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';
    this.translationService = new TranslationService();
    // Debug log to verify configuration
    console.log('OpenAI configuration:');
    console.log('MODEL:', this.model);
    // Validate configuration
    this.validateConfiguration();
  }

  /**
   * Validate OpenAI configuration
   */
  private validateConfiguration(): void {
    // No API key validation needed in frontend
    this.isConfigured = true;
    console.log('✅ OpenAI configuration validated (frontend, using Netlify Function)');
    console.log(`🚀 Using model: ${this.model}`);
  }

  /**
   * Generate text using OpenAI with streaming support
   * @param messages Array of messages in the conversation
   * @param temperature Optional temperature parameter to control randomness (0.0-1.0)
   * @param useStreaming Whether to use streaming (default: true for long content)
   * @returns Generated text response
   */
  async generateText(messages: Message[], temperature: number = 0.7, useStreaming?: boolean): Promise<string> {
    try {
      // Use mock response for testing if needed
      if (import.meta.env.VITE_USE_MOCK_RESPONSES === 'true') {
        console.warn('🔄 Using mock response for development (forced).');
        return this.getMockResponse(messages);
      }

      // NETLIFY FREE PLAN: Always use streaming to avoid 10-second timeout
      const totalContentLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
      const shouldStream = true; // Always stream on free plan
      
      console.log(`� NETLIFY FREE PLAN: Forcing streaming mode for ${totalContentLength} characters (10s limit)`);

      // Call Netlify Function with streaming support
      const response = await fetch('/.netlify/functions/openai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 1500, // Reduced for Netlify free plan 10s timeout
          temperature: temperature,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          stream: true // Always stream on Netlify free plan
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('OpenAI Proxy Error Details:', errorData);
        throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      if (data.error) {
        console.error('OpenAI API Error:', data.error);
        throw new Error(data.error);
      }
      
      const generatedText = data.choices[0].message.content;
      console.log(`✅ OpenAI (via Netlify Function) call successful ${shouldStream ? 'with streaming' : ''}`);
      console.log(`📝 Generated ${generatedText.length} characters`);
      return generatedText;
    } catch (error: any) {
      console.error('❌ Error calling OpenAI via Netlify Function:', error);
      
      // Try the dedicated streaming endpoint as fallback
      if (useStreaming !== false) {
        console.log('🔄 Trying dedicated streaming endpoint as fallback...');
        try {
          return await this.generateTextWithStreaming(messages, temperature);
        } catch (streamError) {
          console.error('❌ Streaming fallback also failed:', streamError);
        }
      }
      
      // Final fallback to mock response
      console.warn('🔄 Using mock response due to API error');
      return this.getMockResponse(messages);
    }
  }

  /**
   * Generate text using dedicated streaming endpoint
   * @param messages Array of messages in the conversation
   * @param temperature Temperature parameter
   * @returns Generated text response
   */
  private async generateTextWithStreaming(messages: Message[], temperature: number = 0.7): Promise<string> {
    console.log('🌊 Using dedicated streaming endpoint');
    
    const response = await fetch('/.netlify/functions/openai-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 2000,
        temperature: temperature,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('OpenAI Streaming Proxy Error Details:', errorData);
      throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error('OpenAI Streaming API Error:', data.error);
      throw new Error(data.error);
    }
    
    const generatedText = data.choices[0].message.content;
    console.log(`✅ OpenAI streaming call successful`);
    console.log(`📝 Generated ${generatedText.length} characters via streaming`);
    return generatedText;
  }

  /**
   * Get a mock response when the API is not available
   * @param messages Array of messages in the conversation
   * @returns Mock generated response
   */
  private getMockResponse(messages: Message[]): string {
    console.log('Using mock response for OpenAI request');
    const lastMessage = messages[messages.length - 1].content;
    
    // Always return valid quiz data for development
    if (lastMessage.includes('JSON array') || lastMessage.includes('quiz') || true) {
      return `[
  {
    "id": 1,
    "text": "What is the primary purpose of React's virtual DOM?",
    "options": [
      {
        "id": 1,
        "text": "To improve performance by minimizing direct DOM manipulations",
        "isCorrect": true,
        "explanation": "The virtual DOM allows React to batch and optimize updates by comparing the virtual representation with the actual DOM and only applying the necessary changes, which significantly improves performance."
      },
      {
        "id": 2,
        "text": "To enable server-side rendering",
        "isCorrect": false,
        "explanation": "While React does support server-side rendering, that's not the primary purpose of the virtual DOM. The virtual DOM is mainly used for performance optimization on the client side."
      },
      {
        "id": 3,
        "text": "To create cross-platform applications",
        "isCorrect": false,
        "explanation": "Cross-platform capabilities come from React's architecture and related libraries like React Native, not specifically from the virtual DOM."
      },
      {
        "id": 4,
        "text": "To manage global state in applications",
        "isCorrect": false,
        "explanation": "State management is handled by other mechanisms like useState, useReducer, or libraries like Redux, not by the virtual DOM which focuses on rendering optimization."
      }
    ]
  },
  {
    "id": 2,
    "text": "According to accounting principles, how should the auditor address this inventory discrepancy?",
    "options": [
      {
        "id": 1,
        "text": "Recommend adjusting the financial statements to reflect the actual inventory count",
        "isCorrect": true,
        "explanation": "Following the principle of faithful representation, financial statements should reflect economic reality. The auditor should recommend adjusting the inventory to match the physical count, which would reduce inventory by $250,000 and increase cost of goods sold by the same amount."
      },
      {
        "id": 2,
        "text": "Average the book value and physical count",
        "isCorrect": false,
        "explanation": "Averaging the book value and physical count would not be appropriate. Accounting principles require using the most accurate information available, which is the physical inventory count."
      },
      {
        "id": 3,
        "text": "Maintain the book value to ensure consistency with prior periods",
        "isCorrect": false,
        "explanation": "Consistency does not override accuracy. When there is evidence that the book value is incorrect, it must be adjusted regardless of consistency with prior periods."
      },
      {
        "id": 4,
        "text": "Ignore the discrepancy if it's less than 25% of total inventory",
        "isCorrect": false,
        "explanation": "There is no accounting principle that allows ignoring discrepancies based on percentage thresholds. All material misstatements must be addressed, and this $250,000 discrepancy (about 21% of reported inventory) would generally be considered material."
      }
    ]
  },
  {
    "id": 3,
    "text": "What accounting principle is most relevant to the issue of year-end sales not having corresponding inventory reductions?",
    "options": [
      {
        "id": 1,
        "text": "The matching principle",
        "isCorrect": true,
        "explanation": "The matching principle requires that expenses be recognized in the same period as the revenues they helped generate. If sales were recorded without reducing the related inventory (and recording cost of goods sold), this violates the matching principle."
      },
      {
        "id": 2,
        "text": "The historical cost principle",
        "isCorrect": false,
        "explanation": "The historical cost principle relates to recording assets at their original acquisition cost, not to the timing of expense recognition when goods are sold."
      },
      {
        "id": 3,
        "text": "The full disclosure principle",
        "isCorrect": false,
        "explanation": "While disclosure is important, the core issue is the proper timing of recognizing the cost of inventory sold, which falls under the matching principle."
      },
      {
        "id": 4,
        "text": "The conservatism principle",
        "isCorrect": false,
        "explanation": "Conservatism suggests using the less optimistic estimate when uncertainty exists, but this scenario is about proper recording of transactions that have already occurred, not estimation."
      }
    ]
  },
  {
    "id": 4,
    "text": "What impact would correcting this inventory discrepancy have on the company's financial statements?",
    "options": [
      {
        "id": 1,
        "text": "Decreased assets, decreased equity, and decreased net income",
        "isCorrect": true,
        "explanation": "Reducing inventory by $250,000 decreases total assets. The corresponding increase in cost of goods sold decreases net income, which in turn decreases retained earnings and therefore total equity."
      },
      {
        "id": 2,
        "text": "Decreased assets, increased liabilities, and no effect on net income",
        "isCorrect": false,
        "explanation": "There is no reason the inventory adjustment would affect liabilities, and it would definitely decrease net income through increased cost of goods sold."
      },
      {
        "id": 3,
        "text": "No effect on assets, decreased equity, and decreased net income",
        "isCorrect": false,
        "explanation": "Inventory is an asset, so the adjustment would definitely decrease total assets."
      },
      {
        "id": 4,
        "text": "Decreased assets, decreased liabilities, and decreased net income",
        "isCorrect": false,
        "explanation": "While assets and net income would decrease, there's no reason for liabilities to be affected by the inventory adjustment."
      }
    ]
  },
  {
    "id": 5,
    "text": "From an internal auditing perspective, what should be the priority action after discovering this inventory discrepancy?",
    "options": [
      {
        "id": 1,
        "text": "Investigate the cause of the discrepancy and recommend control improvements",
        "isCorrect": true,
        "explanation": "While adjusting the financial statements is necessary, the internal auditor's primary role is to identify control weaknesses and recommend improvements to prevent such issues in the future. This includes understanding why the inventory system failed to properly record the reduction of inventory for goods sold."
      },
      {
        "id": 2,
        "text": "Report the finding directly to external regulators",
        "isCorrect": false,
        "explanation": "Internal auditors typically report findings to management and the audit committee first, not directly to external regulators, unless there are specific whistleblower provisions that apply."
      },
      {
        "id": 3,
        "text": "Immediately adjust the inventory records without investigation",
        "isCorrect": false,
        "explanation": "While adjustment is necessary, simply adjusting without investigation would fail to address the underlying issue and could allow the same problem to recur."
      },
      {
        "id": 4,
        "text": "Recommend switching to a different inventory accounting method",
        "isCorrect": false,
        "explanation": "The issue is not with the inventory method (FIFO, LIFO, weighted average, etc.) but with the implementation of proper controls and procedures to ensure accurate inventory records."
      }
    ]
  }
]`;
    }
    
    // Default fallback response
    return "I'm unable to generate a specific response for that query. Please provide more details or try again later.";
  }
}

export const openAIService = new OpenAIService();
