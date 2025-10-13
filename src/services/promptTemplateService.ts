import { db } from '@/lib/firebase';
import { 
  collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, 
  getDocs, query, where, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { CustomPromptTemplate, SavedPromptTemplate } from '@/types/promptTemplates';
import { v4 as uuidv4 } from 'uuid';

export class PromptTemplateService {
  private templatesCollection = 'promptTemplates';
  private userTemplatesCollection = 'userPromptTemplates';

  /**
   * Get default prompt template
   */
  getDefaultTemplate(): string {
    return `INSTRUCTIONS:
1. Content Analysis: First, identify and extract key concepts from each content section and subtitle within the course material
2. Section-Based Questions: Create {numQuestions} multiple-choice questions, ensuring questions are distributed across different course sections and subtitles
3. Question Attribution: Each question should:
   - Reference the specific course section/subtitle it's testing
   - Focus on important concepts from that particular section
   - Test comprehension rather than memorization
4. Answer Structure: Include 4 answer options for each question with only one correct answer
5. Detailed Explanations: Provide comprehensive explanations that:
   - Explain why the correct answer is right
   - Reference the specific course section/subtitle where the concept was covered
   - Briefly explain why incorrect options are wrong

Question Format:
\`\`\`
Question X: [Question text]
Section: [Course Section/Subtitle Name]

A) [Option A]
B) [Option B] 
C) [Option C]
D) [Option D]

Correct Answer: [Letter]
Explanation: [Detailed explanation referencing the course section and explaining the correct answer]
\`\`\`

Requirements:
- Ensure questions cover different sections/subtitles proportionally
- Vary question difficulty levels
- Focus on practical application of concepts when possible
- Include the course section reference for each question`;
  }

  /**
   * Save a custom prompt template for a user
   * @param userId User ID
   * @param template Template data
   * @returns Saved template ID
   */
  async saveTemplate(userId: string, template: {
    name: string;
    description: string;
    instructions: string;
    tags?: string[];
    isDefault?: boolean;
  }): Promise<string> {
    try {
      // Check if template with same name already exists
      const existingTemplates = await this.getUserTemplates(userId);
      const duplicateName = existingTemplates.find(t => t.name.toLowerCase() === template.name.toLowerCase());
      
      if (duplicateName) {
        console.warn(`⚠️ Template with name "${template.name}" already exists`);
        throw new Error(`A template with the name "${template.name}" already exists. Please choose a different name.`);
      }

      const templateId = uuidv4();
      const now = new Date();
      
      console.log(`💾 Creating new template "${template.name}" with ID: ${templateId}`);
      
      const templateData: CustomPromptTemplate = {
        id: templateId,
        name: template.name,
        description: template.description,
        instructions: template.instructions,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        isDefault: template.isDefault || false,
        tags: template.tags || [],
        usageCount: 0
      };

      // Save to user's personal templates
      await setDoc(doc(db, this.userTemplatesCollection, `${userId}_${templateId}`), {
        ...templateData,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      });

      // If it's marked as default, update user's default template
      if (template.isDefault) {
        await this.setUserDefaultTemplate(userId, templateId);
      }

      console.log(`✅ Template "${template.name}" saved successfully with ID: ${templateId}`);
      return templateId;
    } catch (error) {
      console.error('Error saving template:', error);
      throw new Error('Failed to save template');
    }
  }

  /**
   * Get all templates for a user
   * @param userId User ID
   * @returns Array of user templates
   */
  async getUserTemplates(userId: string): Promise<SavedPromptTemplate[]> {
    try {
      const q = query(
        collection(db, this.userTemplatesCollection),
        where('createdBy', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      const templates: SavedPromptTemplate[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        templates.push({
          id: data.id,
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          isDefault: data.isDefault || false
        });
      });

      // Sort by updatedAt in descending order on the client side
      templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      console.log(`📋 Loaded ${templates.length} templates for user ${userId}:`, templates.map(t => t.name));
      return templates;
    } catch (error) {
      console.error('Error getting user templates:', error);
      throw new Error('Failed to get user templates');
    }
  }

  /**
   * Get a specific template by ID
   * @param userId User ID
   * @param templateId Template ID
   * @returns Template data
   */
  async getTemplate(userId: string, templateId: string): Promise<SavedPromptTemplate | null> {
    try {
      const docRef = doc(db, this.userTemplatesCollection, `${userId}_${templateId}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          isDefault: data.isDefault || false
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting template:', error);
      throw new Error('Failed to get template');
    }
  }

  /**
   * Update an existing template
   * @param userId User ID
   * @param templateId Template ID
   * @param updates Template updates
   */
  async updateTemplate(userId: string, templateId: string, updates: {
    name?: string;
    description?: string;
    instructions?: string;
    tags?: string[];
    isDefault?: boolean;
  }): Promise<void> {
    try {
      const docRef = doc(db, this.userTemplatesCollection, `${userId}_${templateId}`);
      
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      });

      // If setting as default, unset other defaults and set this one
      if (updates.isDefault) {
        await this.setUserDefaultTemplate(userId, templateId);
      }

      console.log(`Template updated successfully`);
    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error('Failed to update template');
    }
  }

  /**
   * Delete a template
   * @param userId User ID
   * @param templateId Template ID
   */
  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    try {
      const docRef = doc(db, this.userTemplatesCollection, `${userId}_${templateId}`);
      await deleteDoc(docRef);
      
      console.log(`Template deleted successfully`);
    } catch (error) {
      console.error('Error deleting template:', error);
      throw new Error('Failed to delete template');
    }
  }

  /**
   * Set a template as the user's default
   * @param userId User ID
   * @param templateId Template ID
   */
  async setUserDefaultTemplate(userId: string, templateId: string): Promise<void> {
    try {
      // First, unset all existing defaults for this user
      const q = query(
        collection(db, this.userTemplatesCollection),
        where('createdBy', '==', userId),
        where('isDefault', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const batch = [];

      // Unset existing defaults
      for (const doc of snapshot.docs) {
        batch.push(updateDoc(doc.ref, { isDefault: false }));
      }

      await Promise.all(batch);

      // Set the new default
      const newDefaultRef = doc(db, this.userTemplatesCollection, `${userId}_${templateId}`);
      await updateDoc(newDefaultRef, { isDefault: true });
      
      console.log(`Template set as default`);
    } catch (error) {
      console.error('Error setting default template:', error);
      throw new Error('Failed to set default template');
    }
  }

  /**
   * Get user's default template
   * @param userId User ID
   * @returns Default template or null
   */
  async getUserDefaultTemplate(userId: string): Promise<SavedPromptTemplate | null> {
    try {
      const q = query(
        collection(db, this.userTemplatesCollection),
        where('createdBy', '==', userId),
        where('isDefault', '==', true)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          isDefault: true
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting default template:', error);
      return null;
    }
  }

  /**
   * Increment usage count for a template
   * @param userId User ID
   * @param templateId Template ID
   */
  async incrementUsage(userId: string, templateId: string): Promise<void> {
    try {
      const docRef = doc(db, this.userTemplatesCollection, `${userId}_${templateId}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentCount = docSnap.data().usageCount || 0;
        await updateDoc(docRef, {
          usageCount: currentCount + 1,
          updatedAt: Timestamp.fromDate(new Date())
        });
      }
    } catch (error) {
      console.error('Error incrementing usage:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get popular templates (public templates with high usage)
   * @returns Array of popular templates
   */
  async getPopularTemplates(): Promise<SavedPromptTemplate[]> {
    try {
      // For now, return some predefined popular templates
      // In future, you could make some templates public and track usage
      return [
        {
          id: 'popular_1',
          name: 'Comprehensive Section-Based Quiz',
          description: 'Detailed quiz generation with section references and explanations',
          instructions: this.getDefaultTemplate(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDefault: false
        },
        {
          id: 'popular_2',
          name: 'Quick Assessment',
          description: 'Fast quiz generation for quick assessments',
          instructions: `Create {numQuestions} multiple-choice questions from the course content. Focus on key concepts and include brief explanations. Ensure questions test understanding rather than memorization.`,
          createdAt: new Date(),
          updatedAt: new Date(),
          isDefault: false
        }
      ];
    } catch (error) {
      console.error('Error getting popular templates:', error);
      return [];
    }
  }
}

export const promptTemplateService = new PromptTemplateService();