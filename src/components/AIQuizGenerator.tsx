import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Quiz, QuizQuestion, QuizSubmission } from "@/types";
import { quizService } from "@/services/quizService";
import { Loader2, Award, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";

interface AIQuizGeneratorProps {
  courseId: string;
  courseTitle: string;
  onQuizComplete: (score: number) => void;
}

const AIQuizGenerator = ({ courseId, courseTitle, onQuizComplete }: AIQuizGeneratorProps) => {
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
  } | null>(null);
  
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
      const result = await quizService.startQuiz(courseId, currentUser.uid, numQuestions);
      setQuiz(result.quiz);
      setQuizResultId(result.quizResultId);
      // No scenario text needed now as we're focusing on course content directly
      setAnswers(new Array(result.quiz.questions.length).fill(-1));
      setCurrentQuestionIndex(0);
      
      toast({
        title: "Quiz Generated",
        description: "Your AI quiz has been created based on the course content.",
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
        userAnswers: result.userAnswers
      });
      setQuizCompleted(true);
      
      // Notify parent component
      onQuizComplete(result.score);
      
      toast({
        title: "Quiz Submitted",
        description: `Your score: ${result.score}%`,
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

  const currentQuestion = quiz?.questions?.[currentQuestionIndex];
  const isAnswered = answers[currentQuestionIndex] !== undefined && answers[currentQuestionIndex] >= 0;
  const allQuestionsAnswered = quiz?.questions && answers.every(a => a >= 0);
  
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-yellow-500" />
          {quiz ? quiz.title : `Content Quiz for ${courseTitle}`}
        </CardTitle>
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
            
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700" 
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
