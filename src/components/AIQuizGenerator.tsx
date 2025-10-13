import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Quiz, QuizQuestion, QuizSubmission } from "@/types";
import { quizService } from "@/services/quizService";
import { Loader2, Award, CheckCircle, X, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { PromptTemplateSelector } from "./PromptTemplateSelector";
import { PostQuizQuestionnaire } from "./PostQuizQuestionnaire";
import { questionnaireService } from "@/services/questionnaireService";
import { translationService } from "@/services/translationService";
import { Languages } from "lucide-react";

interface AIQuizGeneratorProps {
  courseId: string;
  courseTitle: string;
  onQuizComplete: (score: number) => void;
  isLecturer?: boolean; // Flag to identify if user is a lecturer
}



const AIQuizGenerator = ({ courseId, courseTitle, onQuizComplete, isLecturer = false }: AIQuizGeneratorProps) => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [numQuestions, setNumQuestions] = useState(5);
  const [quizResultId, setQuizResultId] = useState<string | null>(null);
  const [scenarioText, setScenarioText] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    selectedAnswers: Record<string, boolean>;
    explanations: Record<string, string>;
    correctAnswers: Record<string, string>;
    userAnswers: Record<string, string>;
    // Translation functionality removed
    isNewHighScore?: boolean;
    previousHighScore?: number;
  } | null>(null);
  
  // Template system
  const [selectedCustomPrompt, setSelectedCustomPrompt] = useState<string>('');
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  
  // Questionnaire system
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  
  // Translation system
  const [enableTranslation, setEnableTranslation] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('zu'); // Default to Zulu
  const [translatedQuiz, setTranslatedQuiz] = useState<Quiz | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Translate quiz to target language
  const translateQuiz = async (originalQuiz: Quiz) => {
    if (!enableTranslation) return;
    
    setIsTranslating(true);
    
    try {
      console.log(`🌍 Translating quiz to ${targetLanguage}...`);
      
      // Translate quiz title
      const translatedTitle = await translationService.translateText(originalQuiz.title, targetLanguage);
      
      // Translate each question
      const translatedQuestions = await Promise.all(
        originalQuiz.questions.map(async (question) => {
          // Translate question text
          const translatedQuestionText = await translationService.translateText(question.question, targetLanguage);
          
          // Translate all options (options are strings in the type)
          const translatedOptions = await Promise.all(
            question.options.map(async (option) => 
              await translationService.translateText(option, targetLanguage)
            )
          );
          
          // Translate explanation if it exists
          const translatedExplanation = question.explanation 
            ? await translationService.translateText(question.explanation, targetLanguage)
            : question.explanation;
          
          return {
            ...question,
            question: translatedQuestionText,
            options: translatedOptions,
            explanation: translatedExplanation
          };
        })
      );
      
      const translatedQuizData: Quiz = {
        ...originalQuiz,
        title: translatedTitle,
        questions: translatedQuestions
      };
      
      setTranslatedQuiz(translatedQuizData);
      
      toast({
        title: "Translation Complete",
        description: `Quiz has been translated to ${targetLanguage === 'zu' ? 'Zulu (isiZulu)' : targetLanguage}.`,
      });
      
      console.log('✅ Quiz translation completed successfully');
    } catch (error) {
      console.error('❌ Translation failed:', error);
      toast({
        title: "Translation Failed",
        description: "Unable to translate quiz. Showing original English version.",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  // Effect to translate quiz when translation toggle changes
  useEffect(() => {
    if (enableTranslation && quiz && !isTranslating) {
      // Always re-translate when toggle is enabled, even if we have a previous translation
      translateQuiz(quiz);
    } else if (!enableTranslation) {
      // Clear translation when toggle is disabled
      setTranslatedQuiz(null);
    }
  }, [enableTranslation, quiz]);

  // Generate the AI quiz
  const generateQuiz = async () => {
    if (!courseId) {
      toast({
        title: "Error",
        description: "Course ID is required to generate a quiz",
        variant: "destructive"
      });
      return;
    }
    
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate a quiz",
        variant: "destructive"
      });
      return;
    }
    
    setGenerating(true);
    try {
      // Use selected custom prompt template if available
      const customPrompt = selectedCustomPrompt || undefined;
      
      // Log what we're using
      if (selectedCustomPrompt) {
        console.log("🚀 Using custom template prompt for quiz generation");
        console.log("📝 Template preview:", selectedCustomPrompt.substring(0, 100) + "...");
      } else {
        console.log("🔧 Using default prompt template");
      }
      
      const result = await quizService.startQuiz(
        courseId, 
        currentUser.uid, 
        numQuestions,
        customPrompt,
        0.7 // temperature
        // Always generate in English first, then translate client-side if needed
      );

      // Store the quiz
      setQuiz(result.quiz);
      setQuizResultId(result.quizResultId);
      setAnswers(new Array(result.quiz.questions.length).fill(-1));
      setCurrentQuestionIndex(0);
      setQuizStartTime(new Date()); // Track when quiz started
      
      // Clear any existing translation since we have a new quiz
      setTranslatedQuiz(null);
      
      toast({
        title: "Quiz Generated",
        description: selectedCustomPrompt 
          ? "Your AI quiz has been created using your custom template."
          : "Your AI quiz has been created based on the course content.",
      });
    } catch (error) {
      console.error("Error generating AI quiz:", error);
      toast({
        title: "Error",
        description: "Failed to generate AI quiz. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  // Handle answer selection
  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  // Move to next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Move to previous question
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    if (!quiz || !currentUser || !quizResultId) return;
    
    setLoading(true);
    try {
      const submission: QuizSubmission = {
        questions: quiz.questions.map((q, index) => ({
          questionId: q.id,
          selectedOptionId: answers[index]
        }))
      };
      
      const result = await quizService.submitQuiz(quizResultId, currentUser.uid, submission);
      
      setScore(result.score);
      setFeedback({
        selectedAnswers: result.selectedAnswers,
        explanations: result.explanations,
        correctAnswers: result.correctAnswers,
        userAnswers: result.userAnswers,
        isNewHighScore: result.isNewHighScore,
        previousHighScore: result.previousHighScore
      });
      setQuizCompleted(true);
      
      // Log high score achievement
      if (result.isNewHighScore) {
        console.log(`🎉 NEW HIGH SCORE! User ${currentUser.uid} achieved ${result.score}% (previous best: ${result.previousHighScore}%) in course ${courseId}`);
      }
      
      // Check if user should see questionnaire
      const hasSubmittedBefore = await questionnaireService.hasUserSubmittedResponse(
        currentUser.uid, 
        quizResultId
      );
      
      if (!hasSubmittedBefore) {
        // Show questionnaire for first-time quiz completion
        setShowQuestionnaire(true);
      } else {
        // Notify parent component immediately if questionnaire already completed
        onQuizComplete(result.score);
      }
      
      toast({
        title: result.isNewHighScore ? "🎉 New High Score!" : "Quiz Submitted",
        description: result.isNewHighScore 
          ? `Amazing! You scored ${result.score}% (previous best: ${result.previousHighScore}%)`
          : `Your score: ${result.score}%`,
        variant: result.score >= 70 ? "default" : "destructive"
      });
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset quiz
  const handleResetQuiz = () => {
    setQuiz(null);
    setQuizResultId(null);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setQuizCompleted(false);
    setScore(0);
    setFeedback(null);
    setShowQuestionnaire(false);
    setQuizStartTime(null);
  };

  // Handle questionnaire completion
  const handleQuestionnaireComplete = () => {
    setShowQuestionnaire(false);
    // Notify parent component after questionnaire is completed
    onQuizComplete(score);
  };

  // Handle questionnaire skip
  const handleQuestionnaireSkip = () => {
    setShowQuestionnaire(false);
    // Notify parent component if questionnaire is skipped
    onQuizComplete(score);
  };

  // Handle template selection
  const handleTemplateSelect = (instructions: string) => {
    console.log('🎯 Template selected for quiz generation');
    setSelectedCustomPrompt(instructions);
  };

  // Use translated quiz if translation is enabled and available, otherwise use original quiz
  const displayQuiz = enableTranslation && translatedQuiz ? translatedQuiz : quiz;
  const currentQuestion = displayQuiz?.questions?.[currentQuestionIndex];
  const isAnswered = answers[currentQuestionIndex] !== undefined && answers[currentQuestionIndex] >= 0;
  const allQuestionsAnswered = displayQuiz?.questions && answers.every(a => a >= 0);
  
  return (
    <>
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="space-y-2">
        <div className="flex justify-between items-start gap-4">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {displayQuiz ? displayQuiz.title : `Content Quiz for ${courseTitle}`}
            {enableTranslation && displayQuiz && (
              <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-medium">
                <Languages className="h-3 w-3" />
                Zulu
              </div>
            )}
          </CardTitle>

        </div>
        <CardDescription>
          {displayQuiz 
            ? "Answer all questions to test your understanding of the course material" 
            : "Generate a quiz based on what you've learned in this course"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!quiz && !generating && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Number of Questions</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[numQuestions]}
                  min={3}
                  max={10}
                  step={1}
                  onValueChange={(values) => setNumQuestions(values[0])}
                  className="flex-1"
                />
                <span className="w-12 text-center font-medium">{numQuestions}</span>
              </div>
            </div>
            
            {/* Prompt Template Selector */}
            <PromptTemplateSelector
              onTemplateSelect={handleTemplateSelect}
              className="border rounded-lg p-4 bg-gray-50"
            />
            
            {/* Custom Template Indicator */}
            {selectedCustomPrompt && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
                ✅ Custom template active - Quiz will be generated using your selected prompt template
              </div>
            )}
            
            {/* Translation Settings */}
            <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Languages className="h-4 w-4 text-blue-600" />
                  <Label htmlFor="enable-translation" className="text-sm font-medium text-blue-800">
                    Enable Zulu Translation
                  </Label>
                </div>
                <Switch 
                  id="enable-translation"
                  checked={enableTranslation} 
                  onCheckedChange={setEnableTranslation}
                />
              </div>
              {enableTranslation && (
                <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Languages className="h-3 w-3" />
                    <span className="font-medium">Translation Enabled</span>
                  </div>
                  <p>Quiz questions and options will be translated to Zulu (isiZulu) after generation using Azure Translator.</p>
                </div>
              )}
            </div>
            
            <Button 
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-6 text-lg shadow-md" 
              onClick={generateQuiz}
              disabled={generating || isTranslating}
            >
              {generating ? "Generating Quiz..." : isTranslating ? "Translating..." : "Generate Content Quiz"}
            </Button>
            
            {/* Development Debug Info */}
            {import.meta.env.MODE === 'development' && selectedCustomPrompt && (
              <div className="text-xs text-gray-600 bg-gray-50 border rounded p-2 font-mono">
                <div className="font-semibold mb-1">Debug: Template Preview</div>
                <div className="truncate">{selectedCustomPrompt.substring(0, 120)}...</div>
              </div>
            )}
          </div>
        )}
        
        {generating && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            <p className="text-center text-gray-600">
              Generating quiz based on course content...
              <br />
              <span className="text-sm">This may take a moment</span>
            </p>
          </div>
        )}
        
        {displayQuiz && !quizCompleted && (
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Question {currentQuestionIndex + 1} of {displayQuiz.questions.length}
                </span>
                <span className="text-sm font-medium">
                  {Math.round(((answers.filter(a => a >= 0).length) / displayQuiz.questions.length) * 100)}% answered
                </span>
              </div>
              <Progress value={(answers.filter(a => a >= 0).length / displayQuiz.questions.length) * 100} />
            </div>
            
            {/* Course Content Quiz Introduction */}
            {currentQuestionIndex === 0 && (
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200 mb-4">
                <h4 className="font-medium mb-2">Course Content Quiz</h4>
                <p className="text-sm text-slate-700">
                  This quiz has been generated based on the content of <strong>{courseTitle}</strong>. 
                  Questions test your understanding of key concepts covered in this course.
                </p>
              </div>
            )}
            
            {/* Current question */}
            {currentQuestion && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">{currentQuestion.question}</h3>
                
                <RadioGroup value={answers[currentQuestionIndex]?.toString()} onValueChange={(value) => handleAnswerSelect(parseInt(value))}>
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 border rounded hover:bg-gray-50">
                      <RadioGroupItem value={index.toString()} id={`q${currentQuestionIndex}-option${index}`} />
                      <Label htmlFor={`q${currentQuestionIndex}-option${index}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
            
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              
              {currentQuestionIndex < quiz.questions.length - 1 ? (
                <Button
                  onClick={handleNextQuestion}
                  disabled={!isAnswered}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitQuiz}
                  disabled={!allQuestionsAnswered || loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Quiz"
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
        
        {quizCompleted && (
          <div className="py-8 text-center space-y-6">
            <div className="text-6xl">
              {score >= 70 ? "🎉" : "📚"}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Quiz Complete!</h3>
              <p className="text-lg">
                Your Score: <span className="font-bold text-blue-600">{score}%</span>
              </p>
              
              <div className="w-full max-w-md mx-auto mt-2">
                <Progress 
                  value={score} 
                  className={`h-3 ${score >= 70 ? 'bg-green-100' : 'bg-orange-100'}`}
                  indicatorClassName={score >= 70 ? 'bg-green-600' : 'bg-orange-600'}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              {score >= 70 ? (
                <div className="flex items-center justify-center text-green-600">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span>Great job! You passed the quiz!</span>
                </div>
              ) : (
                <div className="flex items-center justify-center text-orange-600">
                  <X className="h-5 w-5 mr-2" />
                  <span>You need 70% to pass. Review the content and try again!</span>
                </div>
              )}
              
              {/* High Score Achievement Notification */}
              {feedback?.isNewHighScore && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎉 NEW HIGH SCORE! 🎉</div>
                  <p className="text-sm text-gray-700">
                    You've improved from <span className="font-semibold">{feedback.previousHighScore}%</span> to <span className="font-semibold text-green-600">{score}%</span>!
                  </p>
                  <p className="text-xs text-gray-500 mt-1">This achievement will be reflected on the leaderboard</p>
                </div>
              )}
              
              {/* Show previous best if not a new high score */}
              {!feedback?.isNewHighScore && feedback?.previousHighScore !== undefined && feedback.previousHighScore > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-blue-700">
                    Your best score for this course: <span className="font-semibold">{Math.max(score, feedback.previousHighScore)}%</span>
                  </p>
                </div>
              )}
              
              {/* Show answer feedback */}
              {feedback && quiz && (
                <div className="mt-8 text-left">
                  <h4 className="text-lg font-medium mb-4">Review Your Answers</h4>
                  <Separator className="my-4" />
                  
                  {quiz.questions.map((question, index) => {
                    const isCorrect = feedback.selectedAnswers[question.id];
                    const explanation = feedback.explanations[question.id];
                    const correctAnswer = feedback.correctAnswers[question.id];
                    const userAnswer = feedback.userAnswers[question.id];
                    
                    return (
                      <div key={question.id} className="mb-6">
                        <div className="flex items-start gap-2">
                          <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isCorrect ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div>
                            <h5 className="font-medium">Question {index + 1}: {question.question}</h5>
                            
                            <div className="mt-2 text-sm">
                              <p>Your answer: <span className={isCorrect ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{userAnswer}</span></p>
                              {!isCorrect && <p className="text-green-600">Correct answer: {correctAnswer}</p>}
                            </div>
                            
                            {explanation && (
                              <div className="mt-2 p-3 bg-slate-50 rounded-md text-sm">
                                <p className="font-medium">Explanation:</p>
                                <p className="text-slate-700">{explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {index < quiz.questions.length - 1 && <Separator className="my-4" />}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="pt-6">
                <p className="text-sm text-gray-500 mb-4">
                  This AI-generated quiz was based on the course content.
                  Each quiz is unique to help you test your understanding.
                </p>
                
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={handleResetQuiz}>
                    Generate New Quiz
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Post-Quiz Questionnaire */}
    {showQuestionnaire && quizResultId && quizStartTime && currentUser && (
      <PostQuizQuestionnaire
        userId={currentUser.uid}
        courseId={courseId}
        courseTitle={courseTitle}
        quizResultId={quizResultId}
        quizScore={score}
        timeSpentOnQuiz={Math.round((new Date().getTime() - quizStartTime.getTime()) / 1000)}
        questionsAnswered={quiz?.questions.length || 0}
        onComplete={handleQuestionnaireComplete}
        onSkip={handleQuestionnaireSkip}
      />
    )}
  </>
  );
};

export default AIQuizGenerator;
