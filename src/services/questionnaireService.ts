import { db } from '@/lib/firebase';
import { 
  collection, doc, addDoc, getDocs, query, where, orderBy, 
  serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { QuestionnaireResponse } from '@/types/questionnaire';
import { v4 as uuidv4 } from 'uuid';

export class QuestionnaireService {
  private responsesCollection = 'questionnaireResponses';

  /**
   * Submit questionnaire response after quiz completion
   * @param response Questionnaire response data
   * @returns Response ID
   */
  async submitResponse(response: Omit<QuestionnaireResponse, 'id' | 'submittedAt'>): Promise<string> {
    try {
      const responseId = uuidv4();
      const now = new Date();
      
      const responseData: QuestionnaireResponse = {
        id: responseId,
        submittedAt: now,
        ...response
      };

      // Save to Firestore
      await addDoc(collection(db, this.responsesCollection), {
        ...responseData,
        submittedAt: Timestamp.fromDate(now)
      });

      console.log('Questionnaire response submitted successfully');
      return responseId;
    } catch (error) {
      console.error('Error submitting questionnaire response:', error);
      throw new Error('Failed to submit questionnaire response');
    }
  }

  /**
   * Get questionnaire responses for a specific course (admin/lecturer use)
   * @param courseId Course ID
   * @returns Array of responses
   */
  async getCourseResponses(courseId: string): Promise<QuestionnaireResponse[]> {
    try {
      const q = query(
        collection(db, this.responsesCollection),
        where('courseId', '==', courseId),
        orderBy('submittedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const responses: QuestionnaireResponse[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        responses.push({
          ...data,
          submittedAt: data.submittedAt.toDate()
        } as QuestionnaireResponse);
      });

      return responses;
    } catch (error) {
      console.error('Error getting course responses:', error);
      throw new Error('Failed to get course responses');
    }
  }

  /**
   * Get all questionnaire responses (admin use)
   * @returns Array of all responses
   */
  async getAllResponses(): Promise<QuestionnaireResponse[]> {
    try {
      const q = query(
        collection(db, this.responsesCollection),
        orderBy('submittedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const responses: QuestionnaireResponse[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        responses.push({
          ...data,
          submittedAt: data.submittedAt.toDate()
        } as QuestionnaireResponse);
      });

      return responses;
    } catch (error) {
      console.error('Error getting all responses:', error);
      throw new Error('Failed to get all responses');
    }
  }

  /**
   * Check if user has already submitted questionnaire for a specific quiz
   * @param userId User ID
   * @param quizResultId Quiz result ID
   * @returns Boolean indicating if response exists
   */
  async hasUserSubmittedResponse(userId: string, quizResultId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.responsesCollection),
        where('userId', '==', userId),
        where('quizResultId', '==', quizResultId)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking response existence:', error);
      return false;
    }
  }

  /**
   * Calculate aggregate statistics for questionnaire responses
   * @param responses Array of responses to analyze
   * @returns Aggregated statistics
   */
  calculateAggregateStats(responses: QuestionnaireResponse[]) {
    if (responses.length === 0) {
      return null;
    }

    const scaleQuestions = [
      'aiToolsExperience', 'seekExtraExplanations', 'onlineLearningComfort',
      'easyToAccess', 'clearInstructions', 'responseSpeed',
      'responseAccuracy', 'responseRelevance', 'explanationClarity',
      'helpfulExamples', 'consistentAnswers', 'incorrectAnswers',
      'improvedUnderstanding', 'practicalApplication', 'increasedConfidence',
      'savedTime', 'wouldUseAgain', 'wouldRecommend',
      'dataHandlingComfort', 'appropriateContent',
      'betterThanTextbook', 'usefulFirstStep'
    ];

    const stats: Record<string, { mean: number; median: number; count: number }> = {};
    
    scaleQuestions.forEach(question => {
      const values = responses
        .map(r => r.responses[question as keyof typeof r.responses])
        .filter(v => typeof v === 'number' && v >= 1 && v <= 5) as number[];
      
      if (values.length > 0) {
        const sorted = values.sort((a, b) => a - b);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
        
        stats[question] = {
          mean: Math.round(mean * 100) / 100,
          median: Math.round(median * 100) / 100,
          count: values.length
        };
      }
    });

    // Calculate overall satisfaction score (average of key learning outcome questions)
    const keyQuestions = ['improvedUnderstanding', 'practicalApplication', 'wouldUseAgain', 'wouldRecommend'];
    const keyScores = keyQuestions
      .map(q => stats[q]?.mean)
      .filter(score => typeof score === 'number');
    
    const overallSatisfaction = keyScores.length > 0
      ? keyScores.reduce((sum, score) => sum + score, 0) / keyScores.length
      : 0;

    return {
      totalResponses: responses.length,
      questionStats: stats,
      overallSatisfaction: Math.round(overallSatisfaction * 100) / 100,
      averageQuizScore: responses.reduce((sum, r) => sum + r.metadata.quizScore, 0) / responses.length,
      averageTimeSpent: responses.reduce((sum, r) => sum + r.metadata.timeSpentOnQuiz, 0) / responses.length
    };
  }
}

export const questionnaireService = new QuestionnaireService();