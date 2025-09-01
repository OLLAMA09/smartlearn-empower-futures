import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Quiz, QuizQuestion, QuizSubmission, LecturerPromptConfig } from "@/types";
import { quizService } from "@/services/quizService";
import { TranslationService } from '@/services/translationService';
import { Loader2, Award, CheckCircle, X, Settings, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface AIQuizGeneratorProps {
  courseId: string;
  courseTitle: string;
  onQuizComplete: (score: number) => void;
  isLecturer?: boolean; // Flag to identify if user is a lecturer
}

// Non-editable part of the prompt that ensures consistent JSON format
const jsonFormatPrompt = `FORMAT YOUR RESPONSE AS JSON:
[
  {
    "id": number,
    "text": "question text",
    "options": [
      {
        "id": number,
        "text": "option text",
        "isCorrect": boolean,
        "explanation": "detailed explanation"
      },
      ...
    ]
  },
  ...
]`;

// Default editable prompt content for lecturers
const defaultEditablePrompt = `COURSE INFORMATION:
- Title: {courseTitle}
- Description: {courseDescription}

COURSE CONTENT:
{contentForPrompt}

INSTRUCTIONS:
1. Create {numQuestions} multiple-choice questions based on important concepts from the course content
2. Each question should test the understanding of different key concepts
3. Include 4 answer options for each question, with only one correct answer
4. Provide a detailed explanation for why the correct answer is right
`;

// Complete prompt with both editable and non-editable parts
const defaultCustomPrompt = `Generate a quiz for a course with the following details:

${defaultEditablePrompt}

${jsonFormatPrompt}

Make sure to create varied questions covering different sections of the content. The correct answer should have a thorough explanation.
`;

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
  
  // Lecturer prompt engineering options
  const [promptConfig, setPromptConfig] = useState<LecturerPromptConfig>({
    customPrompt: defaultCustomPrompt,
    temperature: 0.7,
    isEnabled: false
  });
  const [editablePrompt, setEditablePrompt] = useState<string>(defaultEditablePrompt);
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  // Translation functionality removed
  
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
      // Use lecturer's custom prompt if enabled
      const customPrompt = promptConfig.isEnabled ? promptConfig.customPrompt : undefined;
      const temperature = promptConfig.isEnabled ? promptConfig.temperature : 0.7;
      
      // Log what we're using
      if (promptConfig.isEnabled) {
        console.log("Using lecturer custom prompt with temperature:", temperature);
      }
      
      const result = await quizService.startQuiz(
        courseId, 
        currentUser.uid, 
        numQuestions,
        customPrompt,
        temperature
      );

      // Store the English version first
      setQuiz(result.quiz);
      setQuizResultId(result.quizResultId);
      setAnswers(new Array(result.quiz.questions.length).fill(-1));
      setCurrentQuestionIndex(0);
      
      toast({
        title: "Quiz Generated",
        description: promptConfig.isEnabled 
          ? "Your AI quiz has been created using custom lecturer parameters."
          : "Your AI quiz has been created based on the course content.",
      });
      
      // Translation functionality removed
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
      
      // Notify parent component
      onQuizComplete(result.score);
      
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
  };

  // Update the full prompt when the editable part changes
  const updateFullPrompt = (newEditablePrompt: string) => {
    setEditablePrompt(newEditablePrompt);
    const fullPrompt = `Generate a quiz for a course with the following details:

${newEditablePrompt}

${jsonFormatPrompt}

Make sure to create varied questions covering different sections of the content. The correct answer should have a thorough explanation.`;
    
    setPromptConfig(prev => ({...prev, customPrompt: fullPrompt}));
  };

  // Initialize the editable part of the prompt when component mounts
  useEffect(() => {
    setEditablePrompt(defaultEditablePrompt);
  }, []);

  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'en'|'zu'>('en');
  const [originalQuiz, setOriginalQuiz] = useState<Quiz | null>(null);
  const translationService = new TranslationService();

  const translateQuiz = async () => {
    if (!quiz) return;
    
    setIsTranslating(true);
    try {
      // Store original English version if not stored yet
      if (currentLanguage === 'en' && !originalQuiz) {
        setOriginalQuiz(quiz);
      }

      if (currentLanguage === 'en') {
        // Translate to Zulu
        const translatedQuestions = await Promise.all(
          quiz.questions.map(async (question) => {
            const translatedQuestion = await translationService.translateText(question.question, 'zu');
            const translatedOptions = await Promise.all(
              question.options.map(async (option) => 
                await translationService.translateText(option, 'zu')
              )
            );
            const translatedExplanation = question.explanation 
              ? await translationService.translateText(question.explanation, 'zu')
              : undefined;
            
            return {
              ...question,
              question: translatedQuestion,
              options: translatedOptions,
              explanation: translatedExplanation
            };
          })
        );

        const translatedTitle = await translationService.translateText(quiz.title, 'zu');
        setQuiz({
          ...quiz,
          title: translatedTitle,
          questions: translatedQuestions
        });
        setCurrentLanguage('zu');
        
        toast({
          title: "Quiz Translated",
          description: "The quiz has been translated to Zulu"
        });
      } else if (originalQuiz) {
        // Revert to English
        setQuiz(originalQuiz);
        setCurrentLanguage('en');
        
        toast({
          title: "Quiz Language Changed",
          description: "The quiz has been restored to English"
        });
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Translation Failed",
        description: "Failed to change the quiz language. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const currentQuestion = quiz?.questions?.[currentQuestionIndex];
  const isAnswered = answers[currentQuestionIndex] !== undefined && answers[currentQuestionIndex] >= 0;
  const allQuestionsAnswered = quiz?.questions && answers.every(a => a >= 0);
  
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="space-y-2">
        <div className="flex justify-between items-start gap-4">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {quiz ? quiz.title : `Content Quiz for ${courseTitle}`}
          </CardTitle>
          {quiz && (
            <Button
              variant="outline"
              size="sm"
              onClick={translateQuiz}
              disabled={isTranslating}
              className="flex items-center gap-2"
            >
              {isTranslating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              {isTranslating 
                ? "Translating..." 
                : currentLanguage === 'en' 
                  ? "Translate to Zulu" 
                  : "Switch to English"}
            </Button>
          )}
        </div>
        <CardDescription>
          {quiz 
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
            
            {/* Lecturer-only prompt engineering options */}
            {isLecturer && (
              <Collapsible 
                open={showPromptSettings} 
                onOpenChange={setShowPromptSettings}
                className="border rounded-md overflow-hidden bg-white shadow-sm"
              >
                <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 p-4 border-b">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-purple-600" />
                    <h4 className="font-medium text-purple-900">Prompt Engineering Settings</h4>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="border-purple-200 hover:bg-purple-50">
                      {showPromptSettings ? "Hide Settings" : "Configure Quiz"}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent>
                  <div className="p-5 space-y-6">
                    {/* Enable/Disable Switch */}
                    <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor="enable-custom-prompt" className="text-blue-900 font-medium">
                          Use Custom Quiz Settings
                        </Label>
                        <p className="text-sm text-blue-700">
                          Enable to customize how quiz questions are generated
                        </p>
                      </div>
                      <Switch 
                        id="enable-custom-prompt"
                        checked={promptConfig.isEnabled}
                        onCheckedChange={(checked) => setPromptConfig(prev => ({...prev, isEnabled: checked}))}
                        className="data-[state=checked]:bg-blue-600"
                      />
                    </div>
                    
                    {promptConfig.isEnabled && (
                      <div className="space-y-6 border-t pt-5">
                        {/* Temperature Setting */}
                        <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="temperature" className="text-lg font-medium">
                                AI Creativity Level
                              </Label>
                              <span className="px-3 py-1 bg-white rounded-full text-sm font-bold border shadow-sm">
                                {promptConfig.temperature?.toFixed(1) || "0.7"}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600">
                              Adjust how creative or focused the quiz questions should be
                            </p>
                          </div>
                          
                          <div className="pt-2">
                            <div className="flex justify-between mb-1 text-xs font-medium">
                              <span className="text-blue-700">More Focused</span>
                              <span className="text-purple-700">More Creative</span>
                            </div>
                            <Slider
                              id="temperature"
                              value={[promptConfig.temperature || 0.7]}
                              min={0}
                              max={1}
                              step={0.1}
                              onValueChange={(values) => setPromptConfig(prev => ({...prev, temperature: values[0]}))}
                              className="flex-1"
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                            <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                              <h5 className="font-medium text-blue-800">Lower Values (0.1-0.3)</h5>
                              <p className="text-blue-700 mt-1">Produces more consistent, predictable questions focusing on core concepts</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                              <h5 className="font-medium text-purple-800">Higher Values (0.7-1.0)</h5>
                              <p className="text-purple-700 mt-1">Creates more varied, creative questions exploring different angles</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Only show Instructions field for editing */}
                        <div className="space-y-6">
                          <div>
                            <Label htmlFor="custom-instructions" className="text-lg font-medium block mb-1">
                              Quiz Instructions
                            </Label>
                            <p className="text-sm text-slate-600 mb-4">
                              Only the instructions for question generation can be customized.<br />
                              <span className="text-xs text-amber-700 font-semibold">Recommended: Keep instructions under 500 characters for best performance.</span>
                            </p>
                          </div>
                          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-blue-50 p-4 border-b">
                              <h5 className="font-medium text-blue-800">Instructions</h5>
                              <p className="text-sm text-blue-600 mt-1">
                                Edit the instructions below. Course information and content are auto-filled and hidden.
                              </p>
                            </div>
                            <div className="p-5">
                              <Textarea
                                id="custom-instructions"
                                value={
                                  editablePrompt.split("INSTRUCTIONS:")[1] 
                                    ? "INSTRUCTIONS:" + editablePrompt.split("INSTRUCTIONS:")[1] 
                                    : ""
                                }
                                onChange={(e) => {
                                  const newText = editablePrompt.split("INSTRUCTIONS:")[0] + e.target.value;
                                  updateFullPrompt(newText);
                                }}
                                rows={6}
                                className="font-mono text-sm"
                              />
                              <div className="flex justify-between items-center mt-2">
                                <p className="text-xs text-slate-500">
                                  This is the only editable section. Course details and content are locked.
                                </p>
                                <span className={`text-xs ${((editablePrompt.split("INSTRUCTIONS:")[1] || '').length > 500) ? 'text-red-600' : 'text-slate-400'}`}>
                                  Characters: {(editablePrompt.split("INSTRUCTIONS:")[1] || '').length} / 500
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* JSON Format Section (Non-editable) */}
                          <div className="border border-gray-300 rounded-lg overflow-hidden mt-6">
                            <div className="bg-rose-50 border-b border-gray-300 p-3 flex items-center justify-between">
                              <div>
                                <h6 className="font-medium text-rose-900">Response Format (Non-editable)</h6>
                                <p className="text-xs text-rose-700">
                                  This section ensures consistent data format and cannot be modified
                                </p>
                              </div>
                              <div className="bg-rose-100 text-rose-800 text-xs px-2 py-1 rounded-full border border-rose-200">
                                Locked
                              </div>
                            </div>
                            <div className="bg-gray-100 p-3 opacity-60">
                              <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700">{jsonFormatPrompt}</pre>
                            </div>
                          </div>
                          {/* Reset Button */}
                          <div className="flex justify-end mt-4">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditablePrompt(defaultEditablePrompt);
                                updateFullPrompt(defaultEditablePrompt);
                              }}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                              Reset to Default Instructions
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            <Button 
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-6 text-lg shadow-md" 
              onClick={generateQuiz}
            >
              Generate Content Quiz
            </Button>
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
        
        {quiz && !quizCompleted && (
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Question {currentQuestionIndex + 1} of {quiz.questions.length}
                </span>
                <span className="text-sm font-medium">
                  {Math.round(((answers.filter(a => a >= 0).length) / quiz.questions.length) * 100)}% answered
                </span>
              </div>
              <Progress value={(answers.filter(a => a >= 0).length / quiz.questions.length) * 100} />
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
  );
};

export default AIQuizGenerator;
