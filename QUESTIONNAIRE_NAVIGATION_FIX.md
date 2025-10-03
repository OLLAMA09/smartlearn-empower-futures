# Questionnaire Navigation Fix

## Issue Identified
Users were unable to move forward from sections 4-7 in the post-quiz questionnaire due to validation logic problems.

## Root Causes Fixed

### 1. **Invalid Number Handling**
- **Problem**: `parseInt('')` was returning `NaN` when RadioGroup had no selection
- **Fix**: Added validation in `handleScaleResponse` to only set numeric values between 1-5

### 2. **Incorrect Validation Logic**
- **Problem**: Validation was checking for empty strings on numeric responses
- **Fix**: Created `isQuestionAnswered()` helper function with proper type-specific validation

### 3. **RadioGroup Value Issues**
- **Problem**: RadioGroup value was set to empty string for undefined responses
- **Fix**: Only set RadioGroup value when response is actually a number

## Changes Made

### `/src/components/PostQuizQuestionnaire.tsx`

```typescript
// 1. Fixed scale response handler
const handleScaleResponse = (questionId: string, value: string) => {
  const numericValue = parseInt(value);
  if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 5) {
    setResponses(prev => ({
      ...prev,
      [questionId]: numericValue
    }));
  }
};

// 2. Added helper function for validation
const isQuestionAnswered = (question: any) => {
  const response = responses[question.id];
  if (question.type === 'scale') {
    return typeof response === 'number' && response >= 1 && response <= 5;
  } else {
    return response !== undefined && response !== '' && 
           (typeof response === 'string' ? response.trim() !== '' : true);
  }
};

// 3. Simplified validation logic
const isCurrentPageComplete = () => {
  const requiredQuestions = currentCategory.questions.filter(q => q.required);
  return requiredQuestions.every(q => isQuestionAnswered(q));
};

// 4. Fixed RadioGroup value handling
<RadioGroup
  value={typeof responses[question.id] === 'number' ? responses[question.id].toString() : ''}
  onValueChange={(value) => handleScaleResponse(question.id, value)}
  className="grid grid-cols-5 gap-4"
>
```

## Visual Improvements

### 1. **Question Status Indicators**
- Required questions that are unanswered now show in red text
- Clear visual feedback for completion status

### 2. **Enhanced Error Messages**
- Alert shows specific question numbers that need answers
- Debug logging helps identify validation issues

### 3. **Better User Guidance**
- Clear indication of which questions are blocking progress
- Visual feedback on question completion status

## Testing Recommendations

1. **Navigate through all sections** - Ensure progression works correctly
2. **Test required vs optional questions** - Verify validation logic
3. **Test both scale and text questions** - Ensure proper handling of different types
4. **Test skip functionality** - Ensure users can skip without issues

## Expected Behavior

- ✅ Users can now progress through all questionnaire sections
- ✅ Clear visual feedback shows completion status
- ✅ Helpful error messages guide users to missing answers
- ✅ Robust validation prevents invalid submissions
- ✅ Debug logging helps troubleshoot any remaining issues

The questionnaire should now work smoothly from section 1 through 7, with proper validation and clear user guidance.