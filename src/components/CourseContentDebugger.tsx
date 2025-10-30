import React, { useState } from 'react';
import { Course } from '@/types';
import { generateContentReport, validateForQuizGeneration } from '@/utils/courseDebugger';

interface CourseContentDebuggerProps {
  course: Course;
  onClose: () => void;
}

export const CourseContentDebugger: React.FC<CourseContentDebuggerProps> = ({ course, onClose }) => {
  const [report, setReport] = useState<string>('');
  const [validation, setValidation] = useState<any>(null);

  React.useEffect(() => {
    if (course) {
      const contentReport = generateContentReport(course);
      const validationResult = validateForQuizGeneration(course);
      setReport(contentReport);
      setValidation(validationResult);
    }
  }, [course]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Course Content Debugger</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {validation && (
          <div className="mb-4 p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">
              Quiz Generation Status: {validation.isValid ? '✅ Ready' : '❌ Not Ready'}
            </h3>
            
            <div className="grid grid-cols-3 gap-4 mb-2 text-sm">
              <div className={`p-2 rounded ${validation.minRequirements.hasContent ? 'bg-green-100' : 'bg-red-100'}`}>
                <div className="font-medium">Has Content</div>
                <div>{validation.minRequirements.hasContent ? '✅' : '❌'}</div>
              </div>
              <div className={`p-2 rounded ${validation.minRequirements.sufficientLength ? 'bg-green-100' : 'bg-red-100'}`}>
                <div className="font-medium">Sufficient Length</div>
                <div>{validation.minRequirements.sufficientLength ? '✅' : '❌'}</div>
              </div>
              <div className={`p-2 rounded ${validation.minRequirements.hasValidSections ? 'bg-green-100' : 'bg-red-100'}`}>
                <div className="font-medium">Valid Sections</div>
                <div>{validation.minRequirements.hasValidSections ? '✅' : '❌'}</div>
              </div>
            </div>

            {validation.issues.length > 0 && (
              <div className="mt-2">
                <div className="font-medium text-red-600 mb-1">Issues to Fix:</div>
                <ul className="list-disc list-inside text-sm text-red-600">
                  {validation.issues.map((issue: string, index: number) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <pre className="text-sm bg-gray-100 p-4 rounded whitespace-pre-wrap font-mono">
            {report}
          </pre>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(report);
              alert('Report copied to clipboard!');
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Copy Report
          </button>
          <button
            onClick={() => {
              console.log('=== COURSE CONTENT DEBUG REPORT ===');
              console.log(report);
              console.log('=== VALIDATION RESULT ===');
              console.log(validation);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Log to Console
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};