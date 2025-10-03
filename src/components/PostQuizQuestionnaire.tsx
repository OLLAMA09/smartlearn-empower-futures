import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Users, 
  Settings, 
  TrendingUp, 
  Shield, 
  BookOpen,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { questionnaireQuestions, scaleLabels, QuestionnaireResponse } from '@/types/questionnaire';
import { questionnaireService } from '@/services/questionnaireService';
import { useToast } from '@/hooks/use-toast';

interface PostQuizQuestionnaireProps {
  userId: string;
  courseId: string;
  courseTitle: string;
  quizResultId: string;
  quizScore: number;
  timeSpentOnQuiz: number;
  questionsAnswered: number;
  onComplete: () => void;
  onSkip?: () => void;
}

const categoryIcons = {
  background: Users,
  usability: Settings,
  quality: TrendingUp,
  learning: BookOpen,
  ethics: Shield,
  comparison: FileText,
  openended: MessageSquare
};

const categoryTitles = {
  background: 'Quick Background',
  usability: 'Usability Experience',
  quality: 'Response Quality',
  learning: 'Learning Outcomes',
  ethics: 'Ethics & Safety',
  comparison: 'Comparison to Other Tools',
  openended: 'Additional Feedback'
};

const categoryDescriptions = {
  background: 'Tell us about your experience with learning tools',
  usability: 'How was your experience using this application?',
  quality: 'Rate the quality of AI responses you received',
  learning: 'How did this tool impact your learning?',
  ethics: 'Your comfort with data handling and content appropriateness',
  comparison: 'How does this compare to your usual study methods?',
  openended: 'Share your thoughts to help us improve'
};

export const PostQuizQuestionnaire: React.FC<PostQuizQuestionnaireProps> = ({
  userId,
  courseId,
  courseTitle,
  quizResultId,
  quizScore,
  timeSpentOnQuiz,
  questionsAnswered,
  onComplete,
  onSkip
}) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(0);
  const [responses, setResponses] = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Group questions by category
  const categories = ['background', 'usability', 'quality', 'learning', 'ethics', 'comparison', 'openended'];
  const questionsByCategory = categories.map(category => ({
    category,
    questions: questionnaireQuestions.filter(q => q.category === category)
  }));

  const totalPages = questionsByCategory.length;
  const currentCategory = questionsByCategory[currentPage];

  const handleScaleResponse = (questionId: string, value: string) => {
    const numericValue = parseInt(value);
    if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 5) {
      setResponses(prev => ({
        ...prev,
        [questionId]: numericValue
      }));
    }
  };

  const handleTextResponse = (questionId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const isQuestionAnswered = (question: any) => {
    const response = responses[question.id];
    if (question.type === 'scale') {
      return typeof response === 'number' && response >= 1 && response <= 5;
    } else {
      return response !== undefined && response !== '' && (typeof response === 'string' ? response.trim() !== '' : true);
    }
  };

  const isCurrentPageComplete = () => {
    const requiredQuestions = currentCategory.questions.filter(q => q.required);
    return requiredQuestions.every(q => isQuestionAnswered(q));
  };

  const canProceed = () => {
    const complete = isCurrentPageComplete();
    
    // Debug logging to help identify issues
    if (!complete) {
      const requiredQuestions = currentCategory.questions.filter(q => q.required);
      const missingResponses = requiredQuestions.filter(q => !isQuestionAnswered(q));
      
      console.log('Missing responses for:', missingResponses.map(q => q.id));
      console.log('Current responses:', responses);
      console.log('Current category:', currentCategory.category);
    }
    
    return complete;
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      toast({
        title: "Please Complete Required Fields",
        description: "All required questions must be answered before submitting.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const questionnaireResponse: Omit<QuestionnaireResponse, 'id' | 'submittedAt'> = {
        userId,
        courseId,
        quizResultId,
        responses: {
          // Map responses to the expected structure
          aiToolsExperience: responses.aiToolsExperience as number,
          seekExtraExplanations: responses.seekExtraExplanations as number,
          onlineLearningComfort: responses.onlineLearningComfort as number,
          easyToAccess: responses.easyToAccess as number,
          clearInstructions: responses.clearInstructions as number,
          responseSpeed: responses.responseSpeed as number,
          responseAccuracy: responses.responseAccuracy as number,
          responseRelevance: responses.responseRelevance as number,
          explanationClarity: responses.explanationClarity as number,
          helpfulExamples: responses.helpfulExamples as number,
          consistentAnswers: responses.consistentAnswers as number,
          incorrectAnswers: responses.incorrectAnswers as number,
          improvedUnderstanding: responses.improvedUnderstanding as number,
          practicalApplication: responses.practicalApplication as number,
          increasedConfidence: responses.increasedConfidence as number,
          savedTime: responses.savedTime as number,
          wouldUseAgain: responses.wouldUseAgain as number,
          wouldRecommend: responses.wouldRecommend as number,
          dataHandlingComfort: responses.dataHandlingComfort as number,
          appropriateContent: responses.appropriateContent as number,
          betterThanTextbook: responses.betterThanTextbook as number,
          usefulFirstStep: responses.usefulFirstStep as number,
          mostHelpfulAspect: (responses.mostHelpfulAspect as string) || '',
          suggestedImprovement: (responses.suggestedImprovement as string) || ''
        },
        metadata: {
          quizScore,
          timeSpentOnQuiz,
          questionsAnswered
        }
      };

      await questionnaireService.submitResponse(questionnaireResponse);
      
      toast({
        title: "Thank You!",
        description: "Your feedback has been submitted successfully and will help improve the learning experience.",
      });

      onComplete();
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  const progress = ((currentPage + 1) / totalPages) * 100;
  const CategoryIcon = categoryIcons[currentCategory.category as keyof typeof categoryIcons];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <FileText className="w-6 h-6" />
            Learning Experience Feedback
          </CardTitle>
          <CardDescription>
            Help us improve the AI learning experience by sharing your feedback about <strong>{courseTitle}</strong>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Research Information */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">Research Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-blue-800">
          <div>
            <h4 className="font-semibold">What this research is about</h4>
            <p>This study compares the accuracy, relevance, and cost-effectiveness of Generative AI models in academic learning. Your feedback helps guide adoption decisions for AI tutoring systems.</p>
          </div>
          
          <div>
            <h4 className="font-semibold">Ethics, Anonymity & Privacy</h4>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Voluntary participation:</strong> You may skip at any time with no penalties or academic disadvantage.</li>
              <li><strong>Anonymous responses:</strong> We do not collect names or identifying details; responses are anonymous.</li>
              <li><strong>Data protection:</strong> Only non-identifying, minimum-necessary data are collected and stored securely.</li>
              <li><strong>Usage:</strong> Results are reported in aggregate without identities to improve the learning platform.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Section {currentPage + 1} of {totalPages}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CategoryIcon className="w-5 h-5" />
            {categoryTitles[currentCategory.category as keyof typeof categoryTitles]}
          </CardTitle>
          <CardDescription>
            {categoryDescriptions[currentCategory.category as keyof typeof categoryDescriptions]}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {currentCategory.questions.map((question, index) => (
            <div key={question.id} className="space-y-3">
              {index > 0 && <Separator />}
              
              <div className="space-y-3">
                <Label className={`text-base font-medium leading-relaxed ${
                  question.required && !isQuestionAnswered(question) ? 'text-red-700' : 'text-gray-900'
                }`}>
                  {question.text}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                  {question.reverseScore && (
                    <span className="text-xs text-gray-500 ml-2">(reverse scored)</span>
                  )}
                </Label>

                {question.type === 'scale' ? (
                  <>
                    <RadioGroup
                      value={typeof responses[question.id] === 'number' ? responses[question.id].toString() : ''}
                      onValueChange={(value) => handleScaleResponse(question.id, value)}
                      className="grid grid-cols-5 gap-4"
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <div key={value} className="flex flex-col items-center space-y-2">
                          <RadioGroupItem value={value.toString()} id={`${question.id}-${value}`} />
                          <Label 
                            htmlFor={`${question.id}-${value}`} 
                            className="text-xs text-center cursor-pointer"
                          >
                            {value}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>{scaleLabels[1]}</span>
                      <span>{scaleLabels[3]}</span>
                      <span>{scaleLabels[5]}</span>
                    </div>
                  </>
                ) : (
                  <Textarea
                    value={(responses[question.id] as string) || ''}
                    onChange={(e) => handleTextResponse(question.id, e.target.value)}
                    placeholder="Please share your thoughts..."
                    rows={4}
                    className="resize-none"
                  />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSkip}
            className="flex items-center gap-2"
          >
            Skip Feedback
          </Button>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentPage === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </Button>

          {currentPage < totalPages - 1 ? (
            <Button 
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Completion Requirements */}
      {!canProceed() && (
        <Alert>
          <AlertDescription>
            Please answer all required questions (marked with *) to continue.
            {(() => {
              const requiredQuestions = currentCategory.questions.filter(q => q.required);
              const missingResponses = requiredQuestions.filter(q => !isQuestionAnswered(q));
              
              return missingResponses.length > 0 ? (
                <div className="mt-2">
                  <span className="font-medium">Missing answers for:</span>
                  <ul className="list-disc list-inside mt-1">
                    {missingResponses.map((q, index) => (
                      <li key={q.id} className="text-sm">
                        Question {currentCategory.questions.indexOf(q) + 1}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};