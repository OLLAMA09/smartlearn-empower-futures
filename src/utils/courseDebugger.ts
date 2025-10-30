/**
 * Course Content Debugging Utilities
 * Helps diagnose issues with course content structure and AI quiz generation
 */

import { Course, CourseContent } from '@/types';

export interface ContentAnalysis {
  totalSections: number;
  validSections: number;
  emptySections: number;
  totalCharacters: number;
  averageContentLength: number;
  sectionsWithIssues: Array<{
    id: string;
    title: string;
    issue: string;
    contentLength: number;
  }>;
  recommendations: string[];
}

/**
 * Analyzes course content structure and identifies potential issues
 */
export function analyzeCourseContent(course: Course): ContentAnalysis {
  const analysis: ContentAnalysis = {
    totalSections: 0,
    validSections: 0,
    emptySections: 0,
    totalCharacters: 0,
    averageContentLength: 0,
    sectionsWithIssues: [],
    recommendations: []
  };

  if (!course) {
    analysis.recommendations.push('Course object is null or undefined');
    return analysis;
  }

  if (!course.content || !Array.isArray(course.content)) {
    analysis.recommendations.push('Course has no content array or content is not an array');
    return analysis;
  }

  analysis.totalSections = course.content.length;

  if (analysis.totalSections === 0) {
    analysis.recommendations.push('Course has no content sections - add sections via Course Management');
    return analysis;
  }

  // Analyze each section
  course.content.forEach((section: CourseContent, index: number) => {
    const contentLength = section.content?.trim().length || 0;
    analysis.totalCharacters += contentLength;

    if (!section.content || contentLength === 0) {
      analysis.emptySections++;
      analysis.sectionsWithIssues.push({
        id: section.id,
        title: section.title || `Section ${index + 1}`,
        issue: 'Empty content',
        contentLength
      });
    } else if (contentLength < 50) {
      analysis.sectionsWithIssues.push({
        id: section.id,
        title: section.title,
        issue: 'Very short content (less than 50 characters)',
        contentLength
      });
    } else {
      analysis.validSections++;
    }

    // Check for common content issues
    if (section.content) {
      if (section.content.trim() === section.title) {
        analysis.sectionsWithIssues.push({
          id: section.id,
          title: section.title,
          issue: 'Content is identical to title',
          contentLength
        });
      }
      
      // Check for placeholder text
      const placeholderPatterns = [
        'lorem ipsum',
        'placeholder',
        'add content here',
        'content goes here',
        'todo',
        'tbd'
      ];
      
      const lowercaseContent = section.content.toLowerCase();
      if (placeholderPatterns.some(pattern => lowercaseContent.includes(pattern))) {
        analysis.sectionsWithIssues.push({
          id: section.id,
          title: section.title,
          issue: 'Contains placeholder text',
          contentLength
        });
      }
    }
  });

  analysis.averageContentLength = analysis.totalSections > 0 
    ? Math.round(analysis.totalCharacters / analysis.totalSections)
    : 0;

  // Generate recommendations
  if (analysis.validSections === 0) {
    analysis.recommendations.push('No sections have valid content - add meaningful text to course sections');
  } else if (analysis.validSections < analysis.totalSections / 2) {
    analysis.recommendations.push('Less than half of sections have valid content - review and add content to empty sections');
  }

  if (analysis.totalCharacters < 500) {
    analysis.recommendations.push('Total course content is very short - aim for at least 500 characters of meaningful content');
  }

  if (analysis.averageContentLength < 100) {
    analysis.recommendations.push('Average section content is too short - aim for at least 100 characters per section');
  }

  if (analysis.sectionsWithIssues.length === 0 && analysis.validSections > 0) {
    analysis.recommendations.push('Course content looks good for AI quiz generation!');
  }

  return analysis;
}

/**
 * Generates a detailed report of course content for debugging
 */
export function generateContentReport(course: Course): string {
  const analysis = analyzeCourseContent(course);
  
  let report = `
=== COURSE CONTENT ANALYSIS REPORT ===
Course: "${course.title}"

SUMMARY:
- Total Sections: ${analysis.totalSections}
- Valid Sections: ${analysis.validSections}
- Empty Sections: ${analysis.emptySections}
- Total Characters: ${analysis.totalCharacters}
- Average Length: ${analysis.averageContentLength} chars/section

`;

  if (analysis.sectionsWithIssues.length > 0) {
    report += `ISSUES FOUND:\n`;
    analysis.sectionsWithIssues.forEach((issue, index) => {
      report += `${index + 1}. "${issue.title}" (${issue.contentLength} chars): ${issue.issue}\n`;
    });
    report += `\n`;
  }

  if (analysis.recommendations.length > 0) {
    report += `RECOMMENDATIONS:\n`;
    analysis.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`;
    });
    report += `\n`;
  }

  if (course.content && course.content.length > 0) {
    report += `SECTION DETAILS:\n`;
    course.content.forEach((section, index) => {
      const contentLength = section.content?.length || 0;
      const preview = section.content?.substring(0, 100) || '[No content]';
      report += `${index + 1}. "${section.title}" (${section.type}, ${contentLength} chars)\n`;
      report += `   Preview: ${preview}${contentLength > 100 ? '...' : ''}\n\n`;
    });
  }

  return report;
}

/**
 * Validates if course content is suitable for AI quiz generation
 */
export function validateForQuizGeneration(course: Course): {
  isValid: boolean;
  issues: string[];
  minRequirements: {
    hasContent: boolean;
    sufficientLength: boolean;
    hasValidSections: boolean;
  };
} {
  const analysis = analyzeCourseContent(course);
  
  const minRequirements = {
    hasContent: analysis.totalSections > 0,
    sufficientLength: analysis.totalCharacters >= 200,
    hasValidSections: analysis.validSections > 0
  };

  const issues: string[] = [];
  
  if (!minRequirements.hasContent) {
    issues.push('Course has no content sections');
  }
  
  if (!minRequirements.sufficientLength) {
    issues.push(`Course content too short (${analysis.totalCharacters} chars, need at least 200)`);
  }
  
  if (!minRequirements.hasValidSections) {
    issues.push('No sections contain valid content');
  }

  if (analysis.validSections < 2 && analysis.totalSections > 1) {
    issues.push('Most sections are empty or invalid - need at least 2 sections with content');
  }

  const isValid = issues.length === 0;

  return {
    isValid,
    issues,
    minRequirements
  };
}