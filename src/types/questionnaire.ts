export interface QuestionnaireResponse {
  id: string;
  userId: string;
  courseId: string;
  quizResultId: string;
  submittedAt: Date;
  responses: {
    // A. Quick background (before use)
    aiToolsExperience: number; // 1-5 scale
    seekExtraExplanations: number; // 1-5 scale
    onlineLearningComfort: number; // 1-5 scale
    
    // B. During use (usability)
    easyToAccess: number; // 1-5 scale
    clearInstructions: number; // 1-5 scale
    responseSpeed: number; // 1-5 scale
    
    // C. Quality of responses
    responseAccuracy: number; // 1-5 scale
    responseRelevance: number; // 1-5 scale
    explanationClarity: number; // 1-5 scale
    helpfulExamples: number; // 1-5 scale
    consistentAnswers: number; // 1-5 scale
    incorrectAnswers: number; // 1-5 scale (reverse scored)
    
    // D. Learning outcomes
    improvedUnderstanding: number; // 1-5 scale
    practicalApplication: number; // 1-5 scale
    increasedConfidence: number; // 1-5 scale
    savedTime: number; // 1-5 scale
    wouldUseAgain: number; // 1-5 scale
    wouldRecommend: number; // 1-5 scale
    
    // E. Ethics & safety
    dataHandlingComfort: number; // 1-5 scale
    appropriateContent: number; // 1-5 scale
    
    // F. Compared to other supports
    betterThanTextbook: number; // 1-5 scale
    usefulFirstStep: number; // 1-5 scale
    
    // Open-ended responses
    mostHelpfulAspect: string;
    suggestedImprovement: string;
  };
  metadata: {
    quizScore: number;
    timeSpentOnQuiz: number; // in seconds
    questionsAnswered: number;
    userRole?: 'student' | 'lecturer' | 'other';
  };
}

export interface QuestionnaireQuestion {
  id: string;
  category: 'background' | 'usability' | 'quality' | 'learning' | 'ethics' | 'comparison' | 'openended';
  text: string;
  type: 'scale' | 'text';
  required: boolean;
  reverseScore?: boolean;
}

export const questionnaireQuestions: QuestionnaireQuestion[] = [
  // A. Quick background (before use)
  {
    id: 'aiToolsExperience',
    category: 'background',
    text: 'I have used AI tools (e.g., chatbots) for learning before.',
    type: 'scale',
    required: true
  },
  {
    id: 'seekExtraExplanations',
    category: 'background',
    text: 'I regularly seek extra explanations/examples when studying this subject.',
    type: 'scale',
    required: true
  },
  {
    id: 'onlineLearningComfort',
    category: 'background',
    text: 'I am comfortable using online learning tools (for example: Moodle, Teams, etc.).',
    type: 'scale',
    required: true
  },
  
  // B. During use (usability)
  {
    id: 'easyToAccess',
    category: 'usability',
    text: 'The web app was easy to access and use.',
    type: 'scale',
    required: true
  },
  {
    id: 'clearInstructions',
    category: 'usability',
    text: 'The prompts/instructions were clear.',
    type: 'scale',
    required: true
  },
  {
    id: 'responseSpeed',
    category: 'usability',
    text: 'Responses were delivered quickly enough.',
    type: 'scale',
    required: true
  },
  
  // C. Quality of responses
  {
    id: 'responseAccuracy',
    category: 'quality',
    text: 'The AI responses were accurate for the topics I encountered.',
    type: 'scale',
    required: true
  },
  {
    id: 'responseRelevance',
    category: 'quality',
    text: 'The AI responses were relevant to the questions.',
    type: 'scale',
    required: true
  },
  {
    id: 'explanationClarity',
    category: 'quality',
    text: 'Explanations were clear and easy to understand.',
    type: 'scale',
    required: true
  },
  {
    id: 'helpfulExamples',
    category: 'quality',
    text: 'The AI provided helpful examples/calculations where needed.',
    type: 'scale',
    required: true
  },
  {
    id: 'consistentAnswers',
    category: 'quality',
    text: 'The AI gave consistent answers to similar questions.',
    type: 'scale',
    required: true
  },
  {
    id: 'incorrectAnswers',
    category: 'quality',
    text: 'I noticed incorrect or misleading answers.',
    type: 'scale',
    required: true,
    reverseScore: true
  },
  
  // D. Learning outcomes
  {
    id: 'improvedUnderstanding',
    category: 'learning',
    text: 'The AI tutor improved my understanding of the subject concepts.',
    type: 'scale',
    required: true
  },
  {
    id: 'practicalApplication',
    category: 'learning',
    text: 'It helped me apply theory to practical scenarios.',
    type: 'scale',
    required: true
  },
  {
    id: 'increasedConfidence',
    category: 'learning',
    text: 'It increased my confidence in the subject.',
    type: 'scale',
    required: true
  },
  {
    id: 'savedTime',
    category: 'learning',
    text: 'It saved me study time.',
    type: 'scale',
    required: true
  },
  {
    id: 'wouldUseAgain',
    category: 'learning',
    text: 'I would use it again for revision.',
    type: 'scale',
    required: true
  },
  {
    id: 'wouldRecommend',
    category: 'learning',
    text: 'I would recommend it to classmates.',
    type: 'scale',
    required: true
  },
  
  // E. Ethics & safety
  {
    id: 'dataHandlingComfort',
    category: 'ethics',
    text: 'I felt comfortable with how my data was handled in the web app.',
    type: 'scale',
    required: true
  },
  {
    id: 'appropriateContent',
    category: 'ethics',
    text: 'The content I received was appropriate and free from bias.',
    type: 'scale',
    required: true
  },
  
  // F. Compared to other supports
  {
    id: 'betterThanTextbook',
    category: 'comparison',
    text: 'Compared to textbook/notes, the AI tutor was more helpful for quick answers.',
    type: 'scale',
    required: true
  },
  {
    id: 'usefulFirstStep',
    category: 'comparison',
    text: 'Compared to asking a lecturer/tutor, the AI tutor was a useful first step.',
    type: 'scale',
    required: true
  },
  
  // Open-ended questions
  {
    id: 'mostHelpfulAspect',
    category: 'openended',
    text: 'What was the most helpful aspect of the AI tutor for your learning?',
    type: 'text',
    required: false
  },
  {
    id: 'suggestedImprovement',
    category: 'openended',
    text: 'What one change would improve the AI tutor for you?',
    type: 'text',
    required: false
  }
];

export const scaleLabels = {
  1: 'Strongly Disagree',
  2: 'Disagree', 
  3: 'Neutral',
  4: 'Agree',
  5: 'Strongly Agree'
};