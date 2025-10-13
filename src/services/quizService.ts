import { db } from '@/lib/firebase';
import { 
  collection, doc, getDoc, updateDoc, addDoc, setDoc,
  serverTimestamp, getDocs, query, where, Timestamp 
} from 'firebase/firestore';
import { 
  Course, 
  Quiz, 
  QuizQuestion, 
  QuizResult, 
  QuizAnswer,
  LeaderboardEntry,
  QuizAnalytics,
  QuestionAnalytics,
  UserQuizResult
} from '@/types';
import { openAIService } from './openAIService';
import { v4 as uuidv4 } from 'uuid';

export class QuizService {
  private coursesCollection = 'courses';
  private quizResultsCollection = 'quizResults';
  private quizAnswersCollection = 'quizAnswers';
  private quizAnalyticsCollection = 'quizAnalytics';

  /**
   * Starts a new AI-powered quiz based on course content
   * @param courseId The ID of the course to generate a quiz for
   * @param userId The ID of the user taking the quiz
   * @param numQuestions Number of questions to generate (default: 5)
   * @param customPrompt Optional custom prompt from the lecturer
   * @param temperature Optional temperature setting (0.0-1.0)
   */
  async startQuiz(
    courseId: string, 
    userId: string, 
    numQuestions: number = 5,
    customPrompt?: string,
    temperature: number = 0.7,
    translateTo?: string
  ): Promise<{
    quiz: Quiz,
    quizResultId: string,
    generatedAt: Date
  }> {
    try {
      // Development logging only
      if (import.meta.env.MODE === 'development') {
        console.log(`Starting AI quiz for course ${courseId} with ${numQuestions} questions`);
        console.log(`Using temperature: ${temperature}`);
        if (customPrompt) console.log(`Using custom prompt engineering`);
      }
      
      // Get the course content
      const courseRef = doc(db, this.coursesCollection, courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data() as Course;
      
      // Enhanced content analysis and formatting
      const sectionsWithSubtitles = this.analyzeCourseContent(courseData);
      const contentForPrompt = this.formatContentForPrompt(sectionsWithSubtitles);
      
      // Validate that we have sufficient content
      if (!contentForPrompt || contentForPrompt.trim().length < 100) {
        throw new Error(`Insufficient course content for quiz generation. Course "${courseData.title}" needs more detailed content sections to create meaningful questions.`);
      }
      
      // Development logging to verify content is being used
      if (import.meta.env.MODE === 'development') {
        console.log(`📚 Course Data Retrieved:`, {
          title: courseData.title,
          contentSections: courseData.content?.length || 0,
          totalContentLength: courseData.content?.reduce((total, item) => total + (item.content?.length || 0), 0) || 0
        });
        console.log(`📋 Analyzed Content Sections:`, sectionsWithSubtitles.length);
        console.log(`📝 Content for Prompt Length:`, contentForPrompt.length);
        console.log(`📄 Content Preview:`, contentForPrompt.substring(0, 300) + "...");
        console.log(`✅ Content validation passed - sufficient content available for quiz generation`);
      }
      
      const generatedAt = new Date();
      
      // Your detailed instructions for quiz generation
      const defaultQuizPrompt = `
CRITICAL: You MUST use the actual course content provided below, NOT just the course title. Generate questions based on the specific concepts, details, and information contained within the course content sections.

INSTRUCTIONS:
1. Content Analysis: Thoroughly analyze the provided course content sections below. Extract key concepts, facts, procedures, and important details from the ACTUAL CONTENT TEXT.
2. Section-Based Questions: Create ${numQuestions} multiple-choice questions based ONLY on information found in the course content sections provided below.
3. Question Attribution: Each question MUST:
   - Be answerable using information from the provided course content
   - Reference specific details, concepts, or procedures mentioned in the content
   - Focus on important concepts from the actual course material (not general knowledge)
   - Test comprehension of the specific content provided
4. Answer Structure: Include 4 answer options for each question with only one correct answer
5. Detailed Explanations: Provide comprehensive explanations that:
   - Quote or reference specific parts of the course content
   - Explain why the correct answer is right based on the provided material
   - Reference the specific course section/subtitle where the information was found
   - Briefly explain why incorrect options are wrong

IMPORTANT: If the course content is insufficient or empty, return an error message instead of generating generic questions.

Question Format:
\`\`\`
Question X: [Question text]
Section: [Course Section/Subtitle Name]

A) [Option A]
B) [Option B] 
C) [Option C]
D) [Option D]

Correct Answer: [Letter]
Explanation: [Detailed explanation referencing the course section and explaining the correct answer]
\`\`\`

Requirements:
- Ensure questions cover different sections/subtitles proportionally
- Vary question difficulty levels
- Focus on practical application of concepts when possible
- Include the course section reference for each question

Course: "${courseData.title}"
Course Description: "${courseData.description}"

COURSE CONTENT SECTIONS (Base all questions on this specific content):
${contentForPrompt}

REMINDER: Generate questions based ONLY on the content above, not general knowledge about the course title.

Return as JSON array:
[{"id":1,"text":"Question text","section":"Course Section/Subtitle Name","options":[{"id":1,"text":"Option A","isCorrect":false,"explanation":"Why this is wrong"},{"id":2,"text":"Option B","isCorrect":true,"explanation":"This is correct because [detailed explanation referencing the course section]"},{"id":3,"text":"Option C","isCorrect":false,"explanation":"Why this is wrong"},{"id":4,"text":"Option D","isCorrect":false,"explanation":"Why this is wrong"}]}]`;

      // Handle custom prompt with proper format conversion for free plan
      let finalPrompt: string;
      if (customPrompt) {
        // Convert your custom prompt format to work with free plan JSON optimization
        finalPrompt = this.convertCustomPromptForFreePlan(
          customPrompt, 
          contentForPrompt, 
          courseData, 
          numQuestions
        );
      } else {
        finalPrompt = defaultQuizPrompt;
      }

      // For Netlify free plan: Use chunked processing for large content
      let questionsJson: string;
      if (contentForPrompt.length > 2000) {
        if (import.meta.env.MODE === 'development') {
          console.log('🚨 Large content detected - using chunked processing for free plan');
        }
        questionsJson = await this.generateQuizInChunks(sectionsWithSubtitles, courseData, numQuestions, temperature, customPrompt, translateTo);
      } else {
        questionsJson = await openAIService.generateText([
          { 
            role: "system", 
            content: "You are an expert quiz generator. CRITICAL: You must use ONLY the actual course content provided in the user message, not general knowledge or assumptions. Base all questions on specific information, concepts, and details found in the provided course material. Extract key concepts from the course sections and create questions that test comprehension of the specific content provided. Reference source sections in explanations. Return valid JSON only." 
          },
          { role: "user", content: finalPrompt }
        ], temperature, true, translateTo); // Force streaming for long content with optional translation
      }
      
      // 3) Parse and clean up the response (supports both JSON and text formats)
      const questionsData = this.parseQuestionsFlexible(questionsJson);
      
      // Quality check: Ensure questions are based on content, not just title
      if (import.meta.env.MODE === 'development') {
        console.log(`🔍 Quality Check: Generated ${questionsData.length} questions`);
        questionsData.forEach((q, index) => {
          console.log(`Q${index + 1}: ${q.text.substring(0, 80)}...`);
          if (q.section) console.log(`   Section: ${q.section}`);
        });
      }
      
      // 4) Create a new quiz object
      const quiz: Quiz = {
        id: `quiz_ai_${Date.now()}`,
        title: `AI Quiz: ${courseData.title}`,
        courseId: courseId,
        questions: questionsData.map(q => ({
          id: `q_${q.id}`,
          question: q.text,
          options: q.options.map(o => o.text),
          correctAnswer: q.options.findIndex(o => o.isCorrect),
          explanation: q.options.find(o => o.isCorrect)?.explanation || ''
        }))
      };
      
      // 5) Save the quiz result to Firebase
      const quizResultId = uuidv4();
      await addDoc(collection(db, this.quizResultsCollection), {
        id: quizResultId,
        userId: userId,
        courseId: courseId,
        contentSummary: courseData.title,
        questionsJson: questionsJson,
        generatedAt: Timestamp.fromDate(generatedAt),
        attemptedAt: null,
        score: 0,
        isCompleted: false
      });
      
      return {
        quiz,
        quizResultId,
        generatedAt
      };
    } catch (error) {
      console.error('Error generating AI quiz:', error);
      throw new Error('Failed to generate AI quiz');
    }
  }

  /**
   * Submit quiz answers and calculate results
   * @param quizResultId The ID of the quiz result document
   * @param userId The ID of the user submitting the quiz
   * @param submission The user's quiz submission with answers
   */
  async submitQuiz(quizResultId: string, userId: string, submission: {
    questions: { questionId: string, selectedOptionId: number }[]
  }): Promise<{
    score: number,
    selectedAnswers: Record<string, boolean>,
    explanations: Record<string, string>,
    correctAnswers: Record<string, string>,
    userAnswers: Record<string, string>,
    attemptedAt: Date,
    isNewHighScore: boolean,
    previousHighScore: number
  }> {
    try {
      // 1) Load the quiz result
      const quizResultsRef = collection(db, this.quizResultsCollection);
      const q = query(quizResultsRef, where("id", "==", quizResultId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Quiz result not found');
      }
      
      const quizResultDoc = snapshot.docs[0];
      const quizResult = quizResultDoc.data() as any;
      
      if (quizResult.userId !== userId) {
        throw new Error('Unauthorized access to quiz result');
      }
      
      if (quizResult.isCompleted) {
        throw new Error('Quiz already submitted');
      }
      
      // 2) Parse the questions JSON
      const questions = this.deserializeQuestions(quizResult.questionsJson);
      
      // 2.1) Check user's previous highest score for this course
      const previousScores = await this.getUserCourseScores(userId, quizResult.courseId);
      const previousHighScore = previousScores.length > 0 ? Math.max(...previousScores) : 0;
      
      // 3) Calculate results
      const attemptedAt = new Date();
      let correctCount = 0;
      const selectedAnswers: Record<string, boolean> = {};
      const explanations: Record<string, string> = {};
      const correctAnswers: Record<string, string> = {};
      const userAnswers: Record<string, string> = {};
      
      // Process each submitted answer
      for (const answer of submission.questions) {
        const questionId = answer.questionId;
        const selectedOptionId = answer.selectedOptionId;
        
        // Find the corresponding question in our parsed data
        const questionData = questions.find(q => `q_${q.id}` === questionId);
        
        if (!questionData) {
          console.error(`Question with ID ${questionId} not found`);
          continue;
        }
        
        const selectedOption = questionData.options[selectedOptionId];
        const correctOption = questionData.options.find(o => o.isCorrect);
        
        if (!selectedOption || !correctOption) {
          console.error(`Invalid option data for question ${questionId}`);
          continue;
        }
        
        const isCorrect = selectedOption.isCorrect;
        if (isCorrect) correctCount++;
        
        selectedAnswers[questionId] = isCorrect;
        explanations[questionId] = selectedOption.explanation;
        correctAnswers[questionId] = correctOption.text;
        userAnswers[questionId] = selectedOption.text;
        
        // Save individual answer
        await addDoc(collection(db, this.quizAnswersCollection), {
          quizResultId: quizResultId,
          userId: userId,
          questionId: questionId,
          selectedOptionId: selectedOptionId,
          isCorrect: isCorrect,
          submittedAt: Timestamp.fromDate(attemptedAt)
        });
      }
      
      // 4) Calculate score as percentage
      const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
      
      // 4.1) Determine if this is a new high score
      const isNewHighScore = score > previousHighScore;
      
      // 5) Update the quiz result
      await updateDoc(quizResultDoc.ref, {
        attemptedAt: Timestamp.fromDate(attemptedAt),
        score: score,
        isCompleted: true
      });
      
      return {
        score,
        selectedAnswers,
        explanations,
        correctAnswers,
        userAnswers,
        attemptedAt,
        isNewHighScore,
        previousHighScore
      };
    } catch (error) {
      console.error('Error submitting quiz:', error);
      throw new Error('Failed to submit quiz');
    }
  }

  /**
   * Get leaderboard entries for quizzes
   * @param courseId Optional course ID to filter by
   * @param topCount Number of entries to return
   */
  async getLeaderboard(courseId?: string, topCount: number = 10): Promise<LeaderboardEntry[]> {
    try {
      // 1) Query completed quiz results
      let quizResultsRef = collection(db, this.quizResultsCollection);
      let q = query(quizResultsRef, where("isCompleted", "==", true));
      
      // Filter by course if provided
      if (courseId) {
        q = query(q, where("courseId", "==", courseId));
      }
      
      const snapshot = await getDocs(q);
      
      // 2) Map to leaderboard entries
      const entries: Record<string, LeaderboardEntry[]> = {};
      
      for (const quizDoc of snapshot.docs) {
        const data = quizDoc.data() as any;
        const userId = data.userId;
        const userName = await this.getUserName(userId);
        const courseRef = await getDoc(doc(db, this.coursesCollection, data.courseId));
        const courseName = courseRef.exists() ? (courseRef.data() as any)?.title || 'Unknown Course' : 'Unknown Course';
        
        const generatedAt = data.generatedAt?.toDate() || new Date();
        const attemptedAt = data.attemptedAt?.toDate() || new Date();
        const timeTaken = attemptedAt.getTime() - generatedAt.getTime();
        
        const entry: LeaderboardEntry = {
          id: quizDoc.id,
          userId: userId,
          userName: userName,
          courseId: data.courseId,
          courseName: courseName,
          score: data.score,
          timeTaken: timeTaken,
          attemptedAt: attemptedAt
        };
        
        if (!entries[userId]) {
          entries[userId] = [];
        }
        entries[userId].push(entry);
      }
      
      // 3) Pick each user's best attempt (highest score, then fastest)
      const bestPerUser = Object.values(entries).map(userEntries => {
        return userEntries
          .sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return a.timeTaken - b.timeTaken;
          })[0];
      });
      
      // 4) Sort and return top N entries
      return bestPerUser
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          return a.timeTaken - b.timeTaken;
        })
        .slice(0, topCount);
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw new Error('Failed to get leaderboard');
    }
  }

  /**
   * Check if a user has attempted a quiz for a course
   * @param userId User ID to check
   * @param courseId Course ID to check
   */
  async hasAttempted(userId: string, courseId: string): Promise<boolean> {
    try {
      const quizResultsRef = collection(db, this.quizResultsCollection);
      const q = query(
        quizResultsRef,
        where("userId", "==", userId),
        where("courseId", "==", courseId),
        where("isCompleted", "==", true)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking quiz attempts:', error);
      return false;
    }
  }

  /**
   * Get a user's name from their ID
   * @param userId User ID to lookup
   */
  private async getUserName(userId: string): Promise<string> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data().displayName || 'Anonymous User';
      }
      return 'Anonymous User';
    } catch (error) {
      console.error('Error getting user name:', error);
      return 'Anonymous User';
    }
  }

  /**
   * Parse and clean the JSON response from Azure OpenAI
   * @param rawJson The raw JSON string from the AI
   */
  private deserializeQuestions(rawJson: string): Array<{
    id: number;
    text: string;
    options: Array<{
      id: number;
      text: string;
      isCorrect: boolean;
      explanation: string;
    }>;
  }> {
    try {
      // Clean up the JSON string - remove markdown code blocks if present
      let clean = rawJson.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      
      // Ensure it starts with an array
      if (!clean.startsWith('[')) {
        clean = '[' + clean + ']';
      }
      
      // Remove trailing commas which can cause JSON parse errors
      clean = clean.replace(/,\s*([}\]])/g, '$1');
      
      // Parse the JSON
      const parsed = JSON.parse(clean);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing quiz questions JSON:', error);
      return [];
    }
  }

  /**
   * Generate AI quiz questions based on course content
   * @param courseId The ID of the course
   * @param numQuestions Number of questions to generate
   * @param customPrompt Optional custom prompt from the lecturer
   * @param temperature Optional temperature setting (0.0-1.0)
   */
  async generateAIQuiz(
    courseId: string, 
    numQuestions: number = 5,
    customPrompt?: string,
    temperature: number = 0.7
  ): Promise<Quiz> {
    const { quiz } = await this.startQuiz(courseId, 'system', numQuestions, customPrompt, temperature);
    return quiz;
  }

  /**
   * Save quiz results
   * @param courseId The ID of the course
   * @param userId The ID of the user
   * @param score The user's score
   */
  async saveQuizResult(courseId: string, userId: string, score: number): Promise<void> {
    try {
      await addDoc(collection(db, this.quizResultsCollection), {
        courseId,
        userId,
        score,
        isCompleted: true,
        generatedAt: serverTimestamp(),
        attemptedAt: serverTimestamp()
      });
      
      console.log('Quiz result saved successfully');
    } catch (error) {
      console.error('Error saving quiz result:', error);
      throw new Error('Failed to save quiz result');
    }
  }

  /**
   * Get quiz results for a user
   * @param userId The ID of the user
   */
  async getUserQuizResults(userId: string): Promise<any[]> {
    try {
      const q = query(
        collection(db, this.quizResultsCollection),
        where("userId", "==", userId),
        where("isCompleted", "==", true)
      );
      
      const snapshot = await getDocs(q);
      const results: any[] = [];
      
      snapshot.forEach(doc => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return results;
    } catch (error) {
      console.error('Error getting user quiz results:', error);
      throw new Error('Failed to get user quiz results');
    }
  }

  /**
   * Get user's previous scores for a specific course
   * @param userId The ID of the user
   * @param courseId The ID of the course
   */
  async getUserCourseScores(userId: string, courseId: string): Promise<number[]> {
    try {
      const q = query(
        collection(db, this.quizResultsCollection),
        where("userId", "==", userId),
        where("courseId", "==", courseId),
        where("isCompleted", "==", true)
      );
      
      const snapshot = await getDocs(q);
      const scores: number[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.score !== undefined) {
          scores.push(data.score);
        }
      });
      
      console.log(`Previous scores for user ${userId} in course ${courseId}:`, scores);
      return scores;
    } catch (error) {
      console.error('Error getting user course scores:', error);
      return [];
    }
  }

  /**
   * Get detailed quiz analytics for lecturers and admins
   * @param courseId Optional course ID to filter by
   */
  async getQuizAnalytics(courseId?: string): Promise<QuizAnalytics[]> {
    try {
      // 1) Query the analytics collection first for cached analytics
      let quizAnalyticsRef = collection(db, this.quizAnalyticsCollection);
      let q = courseId 
        ? query(quizAnalyticsRef, where("courseId", "==", courseId))
        : quizAnalyticsRef;
      
      const analyticsSnapshot = await getDocs(q);
      const analyticsExists = !analyticsSnapshot.empty;
      
      // If we have cached analytics and they're recent (within 1 hour), use them
      if (analyticsExists) {
        const analytics: QuizAnalytics[] = [];
        analyticsSnapshot.forEach(doc => {
          const data = doc.data() as any;
          // Convert timestamps to dates
          const userResults = data.userResults?.map((user: any) => ({
            ...user,
            attemptedAt: user.attemptedAt?.toDate() || new Date()
          })) || [];
          
          analytics.push({
            ...data,
            userResults
          });
        });
        
        // Check if the analytics are fresh (within the last hour)
        const isFresh = analytics.every(a => {
          const lastUpdated = a.lastUpdated?.toDate() || new Date(0);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return lastUpdated > oneHourAgo;
        });
        
        if (isFresh) {
          console.log('Using cached quiz analytics');
          return analytics;
        }
      }
      
      // Otherwise, generate new analytics
      console.log('Generating fresh quiz analytics');
      
      // 2) Query quiz results
      let quizResultsRef = collection(db, this.quizResultsCollection);
      let resultsQuery = query(quizResultsRef, where("isCompleted", "==", true));
      
      if (courseId) {
        resultsQuery = query(resultsQuery, where("courseId", "==", courseId));
      }
      
      const resultsSnapshot = await getDocs(resultsQuery);
      
      // 3) Group results by quiz ID
      const quizGroups: Record<string, any[]> = {};
      
      for (const resultDoc of resultsSnapshot.docs) {
        const resultData = resultDoc.data();
        const quizId = resultData.id;
        
        if (!quizGroups[quizId]) {
          quizGroups[quizId] = [];
        }
        
        quizGroups[quizId].push(resultData);
      }
      
      // 4) For each quiz, calculate analytics
      const allAnalytics: QuizAnalytics[] = [];
      
      for (const [quizId, results] of Object.entries(quizGroups)) {
        // Skip if no results
        if (results.length === 0) continue;
        
        // Use first result to get course info
        const courseRef = doc(db, this.coursesCollection, results[0].courseId);
        const courseDoc = await getDoc(courseRef);
        const courseName = courseDoc.exists() ? (courseDoc.data() as Course).title : 'Unknown Course';
        
        // Calculate average score
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const averageScore = Math.round(totalScore / results.length);
        
        // Group attempts by date
        const attemptsByDate: Record<string, number> = {};
        for (const result of results) {
          if (!result.attemptedAt) continue;
          
          const date = result.attemptedAt.toDate().toISOString().split('T')[0];
          attemptsByDate[date] = (attemptsByDate[date] || 0) + 1;
        }
        
        // Calculate score distribution
        const scoreDistribution = {
          excellent: 0, // 90-100%
          good: 0,      // 70-89% 
          average: 0,   // 50-69%
          poor: 0       // 0-49%
        };
        
        for (const result of results) {
          const score = result.score;
          if (score >= 90) scoreDistribution.excellent++;
          else if (score >= 70) scoreDistribution.good++;
          else if (score >= 50) scoreDistribution.average++;
          else scoreDistribution.poor++;
        }
        
        // Get user details and individual answers
        const userResults: UserQuizResult[] = [];
        for (const result of results) {
          // Get user name
          const userName = await this.getUserName(result.userId);
          
          // Get answers for this quiz attempt
          const answersQuery = query(
            collection(db, this.quizAnswersCollection),
            where("quizResultId", "==", result.id)
          );
          const answersSnapshot = await getDocs(answersQuery);
          
          // Parse questions from JSON
          const questions = this.deserializeQuestions(result.questionsJson);
          
          // Process answers
          const answers: any[] = [];
          answersSnapshot.forEach(answerDoc => {
            const answerData = answerDoc.data();
            const questionId = answerData.questionId;
            
            // Find question data
            const questionData = questions.find(q => `q_${q.id}` === questionId);
            if (!questionData) return;
            
            // Find selected and correct options
            const selectedOptionId = answerData.selectedOptionId;
            const selectedOption = questionData.options[selectedOptionId];
            const correctOption = questionData.options.find(o => o.isCorrect);
            
            if (!selectedOption || !correctOption) return;
            
            answers.push({
              questionId: questionId,
              questionText: questionData.text,
              selectedOption: selectedOption.text,
              isCorrect: answerData.isCorrect,
              correctOption: correctOption.text
            });
          });
          
          // Add to user results
          userResults.push({
            userId: result.userId,
            userName: userName,
            score: result.score,
            timeTaken: result.attemptedAt && result.generatedAt ? 
              result.attemptedAt.toDate().getTime() - result.generatedAt.toDate().getTime() : 0,
            attemptedAt: result.attemptedAt ? result.attemptedAt.toDate() : null,
            answers: answers
          });
        }
        
        // Calculate question analytics
        const questionAnalytics: QuestionAnalytics[] = [];
        const firstQuizResult = results[0];
        if (firstQuizResult && firstQuizResult.questionsJson) {
          const questions = this.deserializeQuestions(firstQuizResult.questionsJson);
          
          for (const question of questions) {
            const questionId = `q_${question.id}`;
            
            // Count correct/incorrect answers for this question
            let correctCount = 0;
            let incorrectCount = 0;
            const optionCounts: Record<number, number> = {};
            
            // Initialize option counts
            question.options.forEach((_, index) => {
              optionCounts[index] = 0;
            });
            
            // Aggregate answers from all users
            for (const userResult of userResults) {
              const answer = userResult.answers.find(a => a.questionId === questionId);
              if (answer) {
                if (answer.isCorrect) correctCount++;
                else incorrectCount++;
                
                // Find the option index
                const optionIndex = question.options.findIndex(o => o.text === answer.selectedOption);
                if (optionIndex >= 0) {
                  optionCounts[optionIndex] = (optionCounts[optionIndex] || 0) + 1;
                }
              }
            }
            
            const totalAnswers = correctCount + incorrectCount;
            const correctPercentage = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
            
            // Find correct answer text
            const correctOption = question.options.find(o => o.isCorrect);
            
            questionAnalytics.push({
              questionId,
              questionText: question.text,
              correctAnswerText: correctOption?.text || 'Unknown',
              correctCount,
              incorrectCount,
              correctPercentage,
              optionCounts
            });
          }
        }
        
        // Create the analytics object
        const analytics: QuizAnalytics = {
          quizId,
          courseId: results[0].courseId,
          courseName,
          totalAttempts: results.length,
          averageScore,
          questionAnalytics,
          attemptsByDate,
          scoreDistribution,
          userResults,
          lastUpdated: Timestamp.now()
        };
        
        // Save to Firestore for future use
        const analyticsRef = doc(db, this.quizAnalyticsCollection, quizId);
        await setDoc(analyticsRef, analytics);
        
        allAnalytics.push(analytics);
      }
      
      return allAnalytics;
    } catch (error) {
      console.error('Error getting quiz analytics:', error);
      throw new Error('Failed to get quiz analytics');
    }
  }
  
  /**
   * Get analytics for a specific course
   * @param courseId The course ID
   */
  async getCourseQuizAnalytics(courseId: string): Promise<QuizAnalytics | null> {
    try {
      const allAnalytics = await this.getQuizAnalytics(courseId);
      return allAnalytics.length > 0 ? allAnalytics[0] : null;
    } catch (error) {
      console.error('Error getting course quiz analytics:', error);
      return null;
    }
  }
  
  /**
   * Get detailed user quiz history
   * @param userId The user ID
   * @param includeAnswers Whether to include detailed answer information
   */
  async getUserQuizHistory(userId: string, includeAnswers: boolean = false): Promise<any[]> {
    try {
      const q = query(
        collection(db, this.quizResultsCollection),
        where("userId", "==", userId),
        where("isCompleted", "==", true)
      );
      
      const snapshot = await getDocs(q);
      const results: any[] = [];
      
      for (const quizDoc of snapshot.docs) {
        const quizData = quizDoc.data();
        
        // Get course name
        const courseRef = doc(db, this.coursesCollection, quizData.courseId);
        const courseDoc = await getDoc(courseRef);
        const courseName = courseDoc.exists() ? (courseDoc.data() as Course).title : 'Unknown Course';
        
        // Calculate time taken
        const generatedAt = quizData.generatedAt?.toDate();
        const attemptedAt = quizData.attemptedAt?.toDate();
        const timeTaken = generatedAt && attemptedAt ? 
          attemptedAt.getTime() - generatedAt.getTime() : 0;
          
        // Build result object
        const result: any = {
          id: quizData.id,
          courseId: quizData.courseId,
          courseName: courseName,
          score: quizData.score,
          attemptedAt: attemptedAt,
          timeTaken: timeTaken
        };
        
        // Add answer details if requested
        if (includeAnswers) {
          // Get answer details
          const answersQuery = query(
            collection(db, this.quizAnswersCollection),
            where("quizResultId", "==", quizData.id)
          );
          const answersSnapshot = await getDocs(answersQuery);
          
          // Parse questions
          const questions = this.deserializeQuestions(quizData.questionsJson || '[]');
          const answers: any[] = [];
          
          answersSnapshot.forEach(answerDoc => {
            const answerData = answerDoc.data();
            const questionId = answerData.questionId;
            
            // Find question
            const questionData = questions.find(q => `q_${q.id}` === questionId);
            if (!questionData) return;
            
            // Find option details
            const selectedOptionId = answerData.selectedOptionId;
            const selectedOption = questionData.options[selectedOptionId];
            const correctOption = questionData.options.find(o => o.isCorrect);
            
            if (!selectedOption || !correctOption) return;
            
            answers.push({
              questionId: questionId,
              questionText: questionData.text,
              selectedOption: selectedOption.text,
              isCorrect: answerData.isCorrect,
              correctOption: correctOption.text,
              explanation: selectedOption.explanation
            });
          });
          
          result.answers = answers;
        }
        
        results.push(result);
      }
      
      // Sort by most recent first
      return results.sort((a, b) => {
        if (!a.attemptedAt || !b.attemptedAt) return 0;
        return b.attemptedAt.getTime() - a.attemptedAt.getTime();
      });
      
    } catch (error) {
      console.error('Error getting user quiz history:', error);
      throw new Error('Failed to get user quiz history');
    }
  }

  /**
   * Analyze course content to extract sections and subtitles
   * @param courseData The course data
   * @returns Analyzed content with sections and subtitles
   */
  private analyzeCourseContent(courseData: Course): Array<{
    title: string;
    content: string;
    subtitles: string[];
    keyWords: string[];
  }> {
    if (!courseData.content || courseData.content.length === 0) {
      console.warn(`⚠️ No content sections found in course: ${courseData.title}`);
      return [];
    }

    const analyzedSections = courseData.content.map(item => {
      const content = item.content || '';
      
      if (!content || content.trim().length === 0) {
        console.warn(`⚠️ Empty content in section: ${item.title}`);
        return null;
      }
      
      // Extract subtitles from content (looking for headers like ##, ###, or bold text)
      const subtitleMatches = content.match(/(?:^|\n)(?:#{2,3}\s+(.+)|(?:\*\*(.+?)\*\*)|(?:__(.+?)__))/gm) || [];
      const subtitles = subtitleMatches
        .map(match => match.replace(/^[\n#*_\s]+|[*_\s]+$/g, '').trim())
        .filter(subtitle => subtitle.length > 0);

      // Extract key words (words that appear frequently or are capitalized)
      const keyWordMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
      const keyWords = [...new Set(keyWordMatches)].slice(0, 10); // Top 10 unique key terms

      if (import.meta.env.MODE === 'development') {
        console.log(`📖 Section "${item.title}": ${content.length} chars, ${subtitles.length} subtitles, ${keyWords.length} key terms`);
      }

      return {
        title: item.title,
        content: content,
        subtitles: subtitles,
        keyWords: keyWords
      };
    }).filter(item => item !== null && item.content.length > 0);

    return analyzedSections as Array<{
      title: string;
      content: string;
      subtitles: string[];
      keyWords: string[];
    }>;
  }

  /**
   * Format content for AI prompt with emphasis on sections and subtitles
   * @param sectionsWithSubtitles Analyzed content sections
   * @returns Formatted content string for the prompt
   */
  private formatContentForPrompt(sectionsWithSubtitles: Array<{
    title: string;
    content: string;
    subtitles: string[];
    keyWords: string[];
  }>): string {
    const maxTotalLength = 3000; // Reduced for Netlify free plan 10s limit
    let formattedContent = '';
    let currentLength = 0;

    for (const section of sectionsWithSubtitles) {
      const sectionHeader = `\n## SECTION: ${section.title}\n`;
      const subtitlesInfo = section.subtitles.length > 0 
        ? `**Key Subtitles:** ${section.subtitles.join(', ')}\n`
        : '';
      const keyWordsInfo = section.keyWords.length > 0 
        ? `**Key Terms:** ${section.keyWords.join(', ')}\n`
        : '';
      
      // Truncate content if necessary but prioritize beginning and subtitles
      let sectionContent = section.content;
      const maxSectionLength = Math.floor(maxTotalLength / sectionsWithSubtitles.length);
      
      if (sectionContent.length > maxSectionLength) {
        const halfPoint = Math.floor(maxSectionLength / 2);
        sectionContent = sectionContent.substring(0, halfPoint) + 
                        "\n[... content continues ...]\n" + 
                        sectionContent.substring(sectionContent.length - halfPoint);
      }
      
      const fullSection = sectionHeader + subtitlesInfo + keyWordsInfo + 
                         `**Content:**\n${sectionContent}\n`;
      
      if (currentLength + fullSection.length > maxTotalLength) {
        break;
      }
      
      formattedContent += fullSection;
      currentLength += fullSection.length;
    }

    return formattedContent;
  }

  /**
   * Generate quiz questions in chunks for Netlify free plan 10-second limit
   * @param sectionsWithSubtitles Analyzed content sections
   * @param courseData Course data
   * @param numQuestions Total number of questions
   * @param temperature Temperature setting
   * @param customPrompt Optional custom prompt to apply
   * @returns Combined questions JSON
   */
  private async generateQuizInChunks(
    sectionsWithSubtitles: Array<{title: string; content: string; subtitles: string[]; keyWords: string[]}>,
    courseData: Course,
    numQuestions: number,
    temperature: number,
    customPrompt?: string,
    translateTo?: string
  ): Promise<string> {
    const questionsPerSection = Math.ceil(numQuestions / Math.min(sectionsWithSubtitles.length, 3)); // Max 3 sections for speed
    const allQuestions: any[] = [];
    const sectionsToProcess = sectionsWithSubtitles.slice(0, 3); // Limit to 3 sections for free plan

    console.log(`🚀 Processing ${sectionsToProcess.length} sections with ${questionsPerSection} questions each`);

    for (let i = 0; i < sectionsToProcess.length && allQuestions.length < numQuestions; i++) {
      const section = sectionsToProcess[i];
      const questionsNeeded = Math.min(questionsPerSection, numQuestions - allQuestions.length);
      
      if (questionsNeeded <= 0) break;

      // Create a mini prompt for this section (use custom prompt if provided)
      let sectionPrompt: string;
      if (customPrompt) {
        // Apply custom prompt requirements to this section
        const sectionContent = `## SECTION: ${section.title}\n**Key Terms:** ${section.keyWords.slice(0, 5).join(', ')}\n**Content:**\n${section.content.substring(0, 1000)}`;
        sectionPrompt = this.convertCustomPromptForFreePlan(
          customPrompt.replace('{numQuestions}', questionsNeeded.toString()),
          sectionContent,
          courseData,
          questionsNeeded
        );
      } else {
        // Use default optimized prompt
        sectionPrompt = `
Create ${questionsNeeded} questions for "${section.title}" from course "${courseData.title}".

Section: ${section.title}
Key Terms: ${section.keyWords.slice(0, 5).join(', ')}
Content: ${section.content.substring(0, 1000)}

JSON only:
[{"id":${allQuestions.length + 1},"text":"Question","section":"${section.title}","options":[{"id":1,"text":"A","isCorrect":false,"explanation":""},{"id":2,"text":"B","isCorrect":true,"explanation":"Correct..."},{"id":3,"text":"C","isCorrect":false,"explanation":""},{"id":4,"text":"D","isCorrect":false,"explanation":""}]}]`;
      }

      try {
        const sectionResponse = await openAIService.generateText([
          { 
            role: "system", 
            content: "You are an expert quiz generator. CRITICAL: Base all questions ONLY on the specific course section content provided. Do not use general knowledge. Extract key concepts from the provided section and create questions that test comprehension of the specific content. Reference source sections in explanations. Return valid JSON only." 
          },
          { role: "user", content: sectionPrompt }
        ], temperature, true, translateTo);

        const sectionQuestions = this.parseQuestionsFlexible(sectionResponse);
        
        // Update IDs to be sequential
        sectionQuestions.forEach((q, index) => {
          q.id = allQuestions.length + index + 1;
        });
        
        allQuestions.push(...sectionQuestions.slice(0, questionsNeeded));
        console.log(`✅ Generated ${sectionQuestions.length} questions from section: ${section.title}`);
        
      } catch (error) {
        console.error(`❌ Error processing section ${section.title}:`, error);
        // Continue with other sections
      }
    }

    const finalQuestions = allQuestions.slice(0, numQuestions);
    console.log(`🎯 Total questions generated: ${finalQuestions.length}/${numQuestions}`);
    
    return JSON.stringify(finalQuestions);
  }

  /**
   * Convert custom prompt format to work with Netlify free plan JSON optimization
   * @param customPrompt The original custom prompt
   * @param contentForPrompt Formatted course content
   * @param courseData Course data
   * @param numQuestions Number of questions
   * @returns Optimized prompt for free plan
   */
  private convertCustomPromptForFreePlan(
    customPrompt: string,
    contentForPrompt: string,
    courseData: Course,
    numQuestions: number
  ): string {
    // Replace placeholders in custom prompt
    let processedPrompt = customPrompt
      .replace(/\{contentForPrompt\}/g, contentForPrompt)
      .replace(/\{courseTitle\}/g, courseData.title)
      .replace(/\{courseDescription\}/g, courseData.description || '')
      .replace(/\{numQuestions\}/g, numQuestions.toString());

    // Convert to JSON-optimized format for free plan while preserving custom requirements
    const optimizedPrompt = `
Based on your detailed requirements, create ${numQuestions} questions from course "${courseData.title}".

${processedPrompt}

**CRITICAL for Netlify Free Plan**: Return ONLY a JSON array, no other text:

[
  {
    "id": 1,
    "text": "Question text referencing specific section",
    "section": "Course Section/Subtitle Name",
    "options": [
      {"id": 1, "text": "Option A", "isCorrect": false, "explanation": "Why this is wrong"},
      {"id": 2, "text": "Option B", "isCorrect": true, "explanation": "Detailed explanation referencing the course section and why this is correct"},
      {"id": 3, "text": "Option C", "isCorrect": false, "explanation": "Why this is wrong"},
      {"id": 4, "text": "Option D", "isCorrect": false, "explanation": "Why this is wrong"}
    ]
  }
]

Follow your format requirements but return as JSON only. Include section references and detailed explanations as specified.`;

    return optimizedPrompt;
  }

  /**
   * Parse questions from either JSON or text format (for backward compatibility)
   * @param response The AI response
   * @returns Parsed questions array
   */
  private parseQuestionsFlexible(response: string): any[] {
    try {
      // First try JSON parsing
      return this.deserializeQuestions(response);
    } catch (error) {
      console.log('JSON parsing failed, attempting text format parsing...');
      return this.parseTextFormatQuestions(response);
    }
  }

  /**
   * Parse questions from text format (your custom format)
   * @param response The AI response in text format
   * @returns Parsed questions array
   */
  private parseTextFormatQuestions(response: string): any[] {
    const questions: any[] = [];
    const questionBlocks = response.split(/Question \d+:/i).slice(1);

    questionBlocks.forEach((block, index) => {
      try {
        const lines = block.trim().split('\n').map(line => line.trim()).filter(line => line);
        
        // Extract question text (first line)
        const questionText = lines[0]?.replace(/^\d+[.:]?\s*/, '').trim();
        if (!questionText) return;

        // Extract section
        const sectionLine = lines.find(line => line.startsWith('Section:'));
        const section = sectionLine?.replace('Section:', '').trim() || 'General';

        // Extract options
        const options: any[] = [];
        const optionLines = lines.filter(line => /^[A-D]\)/.test(line));
        
        optionLines.forEach((optionLine, optionIndex) => {
          const optionText = optionLine.replace(/^[A-D]\)\s*/, '').trim();
          options.push({
            id: optionIndex + 1,
            text: optionText,
            isCorrect: false,
            explanation: ""
          });
        });

        // Extract correct answer
        const correctAnswerLine = lines.find(line => line.startsWith('Correct Answer:'));
        const correctLetter = correctAnswerLine?.replace('Correct Answer:', '').trim().toUpperCase();
        const correctIndex = correctLetter ? correctLetter.charCodeAt(0) - 65 : 0;
        
        if (options[correctIndex]) {
          options[correctIndex].isCorrect = true;
        }

        // Extract explanation
        const explanationLine = lines.find(line => line.startsWith('Explanation:'));
        const explanation = explanationLine?.replace('Explanation:', '').trim() || '';
        
        if (options[correctIndex]) {
          options[correctIndex].explanation = explanation;
        }

        questions.push({
          id: index + 1,
          text: questionText,
          section: section,
          options: options
        });

      } catch (error) {
        console.error(`Error parsing question block ${index + 1}:`, error);
      }
    });

    return questions;
  }
}

export const quizService = new QuizService();
