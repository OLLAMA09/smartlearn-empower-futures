import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, FileText } from 'lucide-react';
import { PostQuizQuestionnaire } from './PostQuizQuestionnaire';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

interface StandaloneQuestionnaireModalProps {
  buttonText?: string;
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

export const StandaloneQuestionnaireModal: React.FC<StandaloneQuestionnaireModalProps> = ({
  buttonText = "Share Your Feedback",
  buttonVariant = "outline",
  buttonSize = "default",
  trigger,
  isOpen: externalIsOpen,
  onClose: externalOnClose
}) => {
  const { currentUser } = useAuth();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnClose ? (open: boolean) => {
    if (!open) externalOnClose();
  } : setInternalIsOpen;

  // Generate a unique quiz result ID for standalone feedback
  const generateStandaloneQuizId = () => `standalone-${uuidv4()}`;

  const handleStartQuestionnaire = () => {
    if (!currentUser) {
      return; // Will show login prompt
    }
    setShowQuestionnaire(true);
  };

  const handleQuestionnaireComplete = () => {
    setShowQuestionnaire(false);
    setIsOpen(false);
  };

  const handleQuestionnaireSkip = () => {
    setShowQuestionnaire(false);
    setIsOpen(false);
  };

  const TriggerButton = trigger || (
    <Button variant={buttonVariant} size={buttonSize} className="flex items-center gap-2">
      <MessageSquare className="w-4 h-4" />
      {buttonText}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!externalIsOpen && (
        <DialogTrigger asChild>
          {TriggerButton}
        </DialogTrigger>
      )}
      
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Learning Experience Feedback
          </DialogTitle>
          <DialogDescription>
            Help us improve the AI learning platform by sharing your experience and feedback
          </DialogDescription>
        </DialogHeader>

        {!currentUser ? (
          <div className="py-8">
            <Alert>
              <AlertDescription className="text-center">
                <div className="space-y-4">
                  <p>Please sign in to share your feedback about the learning platform.</p>
                  <p className="text-sm text-gray-600">
                    Your feedback helps us improve the AI tutoring experience for all users.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        ) : !showQuestionnaire ? (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <MessageSquare className="w-8 h-8 text-blue-600" />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">Share Your Learning Experience</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Your feedback is valuable for our research on AI-powered learning tools. 
                  This questionnaire takes about 5-7 minutes and helps us understand how well 
                  our platform supports your learning goals.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-xl mx-auto">
                <h4 className="font-medium text-blue-900 mb-2">What we're studying:</h4>
                <ul className="text-sm text-blue-800 text-left space-y-1">
                  <li>• Effectiveness of AI tutoring compared to traditional methods</li>
                  <li>• User satisfaction and learning outcomes</li>
                  <li>• Platform usability and experience quality</li>
                  <li>• Areas for improvement and enhancement</li>
                </ul>
              </div>

              <div className="text-sm text-gray-500 max-w-xl mx-auto">
                <p><strong>Privacy:</strong> Your responses are anonymous and used only for research purposes.</p>
                <p><strong>Participation:</strong> Completely voluntary - you can skip at any time.</p>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Maybe Later
              </Button>
              <Button onClick={handleStartQuestionnaire} className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Start Feedback Survey
              </Button>
            </div>
          </div>
        ) : (
          <PostQuizQuestionnaire
            userId={currentUser.uid}
            courseId="general" // Use general category for standalone feedback
            courseTitle="SmartLearn Platform"
            quizResultId={generateStandaloneQuizId()}
            quizScore={0} // No quiz score for standalone feedback
            timeSpentOnQuiz={0} // No quiz time for standalone feedback
            questionsAnswered={0} // No quiz questions for standalone feedback
            onComplete={handleQuestionnaireComplete}
            onSkip={handleQuestionnaireSkip}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};