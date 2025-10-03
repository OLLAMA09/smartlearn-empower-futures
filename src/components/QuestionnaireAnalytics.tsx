import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  Download,
  Eye,
  Filter,
  RefreshCw
} from 'lucide-react';
import { QuestionnaireResponse, scaleLabels } from '@/types/questionnaire';
import { questionnaireService } from '@/services/questionnaireService';
import { useToast } from '@/hooks/use-toast';

interface QuestionnaireAnalyticsProps {
  courseId?: string;
  isAdmin?: boolean;
}

export const QuestionnaireAnalytics: React.FC<QuestionnaireAnalyticsProps> = ({
  courseId,
  isAdmin = false
}) => {
  const { toast } = useToast();
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalResponses: number;
    questionStats: Record<string, { mean: number; median: number; count: number }>;
    overallSatisfaction: number;
    averageQuizScore: number;
    averageTimeSpent: number;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [courseId, isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      let responseData: QuestionnaireResponse[];
      if (courseId) {
        responseData = await questionnaireService.getCourseResponses(courseId);
      } else if (isAdmin) {
        responseData = await questionnaireService.getAllResponses();
      } else {
        responseData = [];
      }
      
      setResponses(responseData);
      
      if (responseData.length > 0) {
        const calculatedStats = questionnaireService.calculateAggregateStats(responseData);
        setStats(calculatedStats);
      } else {
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading questionnaire data:', error);
      toast({
        title: "Error",
        description: "Failed to load questionnaire analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 4) return 'bg-green-600';
    if (score >= 3) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const exportData = () => {
    if (responses.length === 0) return;
    
    const csvContent = [
      // Header
      [
        'Response ID', 'User ID', 'Course ID', 'Quiz Result ID', 'Submitted At',
        'Quiz Score', 'Time Spent (seconds)', 'Questions Answered',
        'AI Tools Experience', 'Seek Extra Explanations', 'Online Learning Comfort',
        'Easy to Access', 'Clear Instructions', 'Response Speed',
        'Response Accuracy', 'Response Relevance', 'Explanation Clarity',
        'Helpful Examples', 'Consistent Answers', 'Incorrect Answers (Rev)',
        'Improved Understanding', 'Practical Application', 'Increased Confidence',
        'Saved Time', 'Would Use Again', 'Would Recommend',
        'Data Handling Comfort', 'Appropriate Content',
        'Better Than Textbook', 'Useful First Step',
        'Most Helpful Aspect', 'Suggested Improvement'
      ].join(','),
      // Data rows
      ...responses.map(response => [
        response.id,
        response.userId,
        response.courseId,
        response.quizResultId,
        response.submittedAt.toISOString(),
        response.metadata.quizScore,
        response.metadata.timeSpentOnQuiz,
        response.metadata.questionsAnswered,
        response.responses.aiToolsExperience,
        response.responses.seekExtraExplanations,
        response.responses.onlineLearningComfort,
        response.responses.easyToAccess,
        response.responses.clearInstructions,
        response.responses.responseSpeed,
        response.responses.responseAccuracy,
        response.responses.responseRelevance,
        response.responses.explanationClarity,
        response.responses.helpfulExamples,
        response.responses.consistentAnswers,
        response.responses.incorrectAnswers,
        response.responses.improvedUnderstanding,
        response.responses.practicalApplication,
        response.responses.increasedConfidence,
        response.responses.savedTime,
        response.responses.wouldUseAgain,
        response.responses.wouldRecommend,
        response.responses.dataHandlingComfort,
        response.responses.appropriateContent,
        response.responses.betterThanTextbook,
        response.responses.usefulFirstStep,
        `"${response.responses.mostHelpfulAspect?.replace(/"/g, '""') || ''}"`,
        `"${response.responses.suggestedImprovement?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questionnaire-analytics-${courseId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading analytics...
        </CardContent>
      </Card>
    );
  }

  if (!stats || responses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Questionnaire Analytics
          </CardTitle>
          <CardDescription>
            Learning experience feedback and analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Eye className="w-4 h-4" />
            <AlertDescription>
              No questionnaire responses available yet. Users will see the feedback questionnaire after completing quizzes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Responses</p>
                <p className="text-2xl font-bold">{stats.totalResponses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overall Satisfaction</p>
                <p className="text-2xl font-bold">{stats.overallSatisfaction}/5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Quiz Score</p>
                <p className="text-2xl font-bold">{Math.round(stats.averageQuizScore)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Time Spent</p>
                <p className="text-2xl font-bold">{Math.round(stats.averageTimeSpent / 60)}m</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Detailed Analytics
              </CardTitle>
              <CardDescription>
                Comprehensive feedback analysis across all dimensions
              </CardDescription>
            </div>
            <Button onClick={exportData} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="categories" className="space-y-4">
            <TabsList>
              <TabsTrigger value="categories">By Category</TabsTrigger>
              <TabsTrigger value="questions">Individual Questions</TabsTrigger>
              <TabsTrigger value="feedback">Open Feedback</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-6">
              {/* Category Summaries */}
              <div className="grid gap-6">
                {[
                  { name: 'Background', questions: ['aiToolsExperience', 'seekExtraExplanations', 'onlineLearningComfort'] },
                  { name: 'Usability', questions: ['easyToAccess', 'clearInstructions', 'responseSpeed'] },
                  { name: 'Quality', questions: ['responseAccuracy', 'responseRelevance', 'explanationClarity', 'helpfulExamples', 'consistentAnswers'] },
                  { name: 'Learning Outcomes', questions: ['improvedUnderstanding', 'practicalApplication', 'increasedConfidence', 'savedTime', 'wouldUseAgain', 'wouldRecommend'] },
                  { name: 'Ethics & Safety', questions: ['dataHandlingComfort', 'appropriateContent'] },
                  { name: 'Comparison', questions: ['betterThanTextbook', 'usefulFirstStep'] }
                ].map(category => {
                  const categoryScores = category.questions
                    .map(q => stats.questionStats[q]?.mean)
                    .filter(score => typeof score === 'number');
                  const avgScore = categoryScores.length > 0 
                    ? categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length 
                    : 0;
                  
                  return (
                    <Card key={category.name}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{category.name}</CardTitle>
                          <Badge variant={avgScore >= 4 ? 'default' : avgScore >= 3 ? 'secondary' : 'destructive'}>
                            {avgScore.toFixed(1)}/5
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Progress 
                          value={(avgScore / 5) * 100} 
                          className="h-2"
                          indicatorClassName={getProgressColor(avgScore)}
                        />
                        <p className="text-sm text-gray-600 mt-2">
                          Based on {categoryScores.length} questions, {stats.totalResponses} responses
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-4">
              <div className="space-y-4">
                {Object.entries(stats.questionStats).map(([questionId, stat]) => (
                  <Card key={questionId}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{questionId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(stat.mean)}`}>
                            {stat.mean}/5
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {stat.count} responses
                          </Badge>
                        </div>
                      </div>
                      <Progress 
                        value={(stat.mean / 5) * 100} 
                        className="h-2"
                        indicatorClassName={getProgressColor(stat.mean)}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Mean: {stat.mean}</span>
                        <span>Median: {stat.median}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Most Helpful Aspects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {responses
                        .filter(r => r.responses.mostHelpfulAspect?.trim())
                        .map((response, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-md">
                            <p className="text-sm">"{response.responses.mostHelpfulAspect}"</p>
                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                              <span>Quiz Score: {response.metadata.quizScore}%</span>
                              <span>{response.submittedAt.toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Suggested Improvements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {responses
                        .filter(r => r.responses.suggestedImprovement?.trim())
                        .map((response, index) => (
                          <div key={index} className="p-3 bg-red-50 rounded-md border border-red-100">
                            <p className="text-sm">"{response.responses.suggestedImprovement}"</p>
                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                              <span>Quiz Score: {response.metadata.quizScore}%</span>
                              <span>{response.submittedAt.toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};