import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Star, 
  StarOff, 
  Copy, 
  Save, 
  X,
  Settings,
  Zap,
  FileText,
  Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { promptTemplateService } from '@/services/promptTemplateService';
import { SavedPromptTemplate, CustomPromptTemplate } from '@/types/promptTemplates';
import { toast } from 'sonner';

interface CoursePromptManagerProps {
  courseId?: string;
  courseName?: string;
}

export const CoursePromptManager: React.FC<CoursePromptManagerProps> = ({
  courseId,
  courseName
}) => {
  const { currentUser } = useAuth();
  
  const [userTemplates, setUserTemplates] = useState<CustomPromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CustomPromptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Template editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SavedPromptTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    prompt: '',
    category: 'general' as const,
    language: 'en' as const,
    difficulty: 'medium' as const
  });

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  // Helper functions to parse template data
  const getTemplateCategory = (template: CustomPromptTemplate): string => {
    return template.tags?.[0] || 'general';
  };

  const getTemplateDifficulty = (template: CustomPromptTemplate): string => {
    return template.tags?.[1] || 'medium';
  };

  const getTemplateLanguage = (template: CustomPromptTemplate): string => {
    return template.tags?.[2] || 'en';
  };

  const getTemplatePrompt = (template: CustomPromptTemplate): string => {
    return template.instructions || '';
  };

  useEffect(() => {
    loadTemplates();
  }, [currentUser]);

  const loadTemplates = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const templates = await promptTemplateService.getUserTemplates(currentUser.uid);
      setUserTemplates(templates as CustomPromptTemplate[]);
      
      // Auto-select the first template if none selected
      if (templates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(templates[0] as CustomPromptTemplate);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!currentUser || !newTemplate.name.trim() || !newTemplate.prompt.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      const templateData = {
        name: newTemplate.name,
        description: newTemplate.description,
        instructions: newTemplate.prompt,
        tags: [newTemplate.category, newTemplate.difficulty, newTemplate.language],
        isDefault: false
      };

      if (editingTemplate) {
        await promptTemplateService.updateTemplate(currentUser.uid, editingTemplate.id, templateData);
        toast.success('Template updated successfully');
      } else {
        await promptTemplateService.saveTemplate(currentUser.uid, templateData);
        toast.success('Template saved successfully');
      }

      // Reset form and reload
      setNewTemplate({
        name: '',
        description: '',
        prompt: '',
        category: 'general',
        language: 'en',
        difficulty: 'medium'
      });
      setEditingTemplate(null);
      setIsEditorOpen(false);
      await loadTemplates();
      
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTemplate = (template: CustomPromptTemplate) => {
    setEditingTemplate(template as any);
    setNewTemplate({
      name: template.name,
      description: template.description,
      prompt: getTemplatePrompt(template),
      category: getTemplateCategory(template) as any,
      language: getTemplateLanguage(template) as any,
      difficulty: getTemplateDifficulty(template) as any
    });
    setIsEditorOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!currentUser) return;
    
    try {
      await promptTemplateService.deleteTemplate(templateId, currentUser.uid);
      toast.success('Template deleted successfully');
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleDuplicateTemplate = (template: CustomPromptTemplate) => {
    setEditingTemplate(null);
    setNewTemplate({
      name: `${template.name} (Copy)`,
      description: template.description,
      prompt: getTemplatePrompt(template),
      category: getTemplateCategory(template) as any,
      language: getTemplateLanguage(template) as any,
      difficulty: getTemplateDifficulty(template) as any
    });
    setIsEditorOpen(true);
  };

  const resetEditor = () => {
    setNewTemplate({
      name: '',
      description: '',
      prompt: '',
      category: 'general',
      language: 'en',
      difficulty: 'medium'
    });
    setEditingTemplate(null);
    setIsEditorOpen(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading templates...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Quiz Generation Settings</h3>
          <p className="text-sm text-gray-600">
            {courseId ? `Configure quiz templates for "${courseName}"` : 'Manage quiz generation templates'}
          </p>
        </div>
        <Button onClick={() => setIsEditorOpen(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Active Template Display */}
      {selectedTemplate && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-lg">Active Template</CardTitle>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {getTemplateCategory(selectedTemplate)}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {showPreview ? 'Hide' : 'Preview'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditTemplate(selectedTemplate)}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
                <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
              </div>
              
              {showPreview && (
                <div className="bg-white border rounded-md p-3">
                  <Label className="text-sm font-medium text-gray-700">Template Preview:</Label>
                  <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                    {getTemplatePrompt(selectedTemplate)}
                  </div>
                </div>
              )}
              
              <div className="flex gap-4 text-sm text-gray-500">
                <span>Difficulty: {getTemplateDifficulty(selectedTemplate)}</span>
                <span>Language: {getTemplateLanguage(selectedTemplate)}</span>
                <span>Updated: {new Date(selectedTemplate.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Templates</CardTitle>
          <CardDescription>
            Select a template to use for quiz generation or manage your custom templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userTemplates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Templates Yet</h3>
              <p className="text-gray-500 mb-4">Create your first quiz generation template</p>
              <Button onClick={() => setIsEditorOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {userTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-purple-500 bg-purple-50' : ''
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{template.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {getTemplateCategory(template)}
                          </Badge>
                          {selectedTemplate?.id === template.id && (
                            <Badge className="bg-purple-600 text-white text-xs">Active</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>Difficulty: {getTemplateDifficulty(template)}</span>
                          <span>Language: {getTemplateLanguage(template)}</span>
                          <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTemplate(template);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateTemplate(template);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this template?')) {
                              handleDeleteTemplate(template.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? 'Modify your existing prompt template' 
                : 'Create a new prompt template for quiz generation'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g., Technical Quiz Template"
                />
              </div>
              <div>
                <Label htmlFor="template-category">Category</Label>
                <Select 
                  value={newTemplate.category} 
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="science">Science</SelectItem>
                    <SelectItem value="mathematics">Mathematics</SelectItem>
                    <SelectItem value="language">Language</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="creative">Creative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Brief description of when to use this template"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template-difficulty">Difficulty</Label>
                <Select 
                  value={newTemplate.difficulty} 
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, difficulty: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="template-language">Language</Label>
                <Select 
                  value={newTemplate.language} 
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, language: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zu">Zulu</SelectItem>
                    <SelectItem value="af">Afrikaans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="template-prompt">Prompt Template</Label>
              <Textarea
                id="template-prompt"
                value={newTemplate.prompt}
                onChange={(e) => setNewTemplate({ ...newTemplate, prompt: e.target.value })}
                placeholder="Enter your quiz generation prompt template..."
                rows={8}
                className="font-mono text-sm"
              />
              <div className="mt-2 text-xs text-gray-500">
                Use placeholders like {'{content}'}, {'{difficulty}'}, {'{num_questions}'} in your template
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={resetEditor}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={saving || !newTemplate.name.trim() || !newTemplate.prompt.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingTemplate ? 'Update' : 'Create'} Template
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};