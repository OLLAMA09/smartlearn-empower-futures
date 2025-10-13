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
  Clock,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { promptTemplateService } from '@/services/promptTemplateService';
import { SavedPromptTemplate } from '@/types/promptTemplates';
import { useToast } from '@/hooks/use-toast';

interface PromptTemplateManagerProps {
  onSelectTemplate?: (template: SavedPromptTemplate) => void;
  selectedTemplateId?: string;
}

export const PromptTemplateManager: React.FC<PromptTemplateManagerProps> = ({
  onSelectTemplate,
  selectedTemplateId
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  const [userTemplates, setUserTemplates] = useState<SavedPromptTemplate[]>([]);
  const [popularTemplates, setPopularTemplates] = useState<SavedPromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'my-templates' | 'popular'>('my-templates');
  
  // Template editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SavedPromptTemplate | null>(null);
  const [editorForm, setEditorForm] = useState({
    name: '',
    description: '',
    instructions: '',
    tags: [] as string[],
    isDefault: false
  });

  useEffect(() => {
    if (currentUser) {
      loadTemplates();
    }
  }, [currentUser]);

  const loadTemplates = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      console.log('🔄 Loading templates for user:', currentUser.uid);
      
      const [userTmpl, popularTmpl] = await Promise.all([
        promptTemplateService.getUserTemplates(currentUser.uid),
        promptTemplateService.getPopularTemplates()
      ]);
      
      console.log('✅ User templates loaded:', userTmpl.length);
      console.log('✅ Popular templates loaded:', popularTmpl.length);
      
      setUserTemplates(userTmpl);
      setPopularTemplates(popularTmpl);
    } catch (error) {
      console.error('❌ Error loading templates:', error);
      toast({
        title: "Error",
        description: "Failed to load templates. Try creating a template first.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createSampleTemplate = async () => {
    if (!currentUser || saving) return;
    
    // Check if a sample template already exists
    const existingSample = userTemplates.find(t => t.name === "Basic Quiz Template");
    if (existingSample) {
      toast({
        title: "Sample Already Exists",
        description: "A Basic Quiz Template already exists in your templates."
      });
      return;
    }
    
    const sampleTemplate = {
      name: "Basic Quiz Template",
      description: "A simple template for generating basic multiple-choice quizzes",
      instructions: `Create {numQuestions} multiple-choice questions based on the course content.

Each question should:
- Focus on key concepts from the material
- Have 4 answer options with only one correct answer
- Include a brief explanation for the correct answer
- Be appropriate for the course level

Format each question clearly with numbered options (A, B, C, D).`,
      tags: ['basic', 'multiple-choice'],
      isDefault: false
    };

    try {
      setSaving(true);
      await promptTemplateService.saveTemplate(currentUser.uid, sampleTemplate);
      toast({
        title: "Sample Template Created",
        description: "A sample template has been created for you to edit."
      });
      loadTemplates();
    } catch (error) {
      console.error('❌ Error creating sample template:', error);
      toast({
        title: "Error",
        description: "Failed to create sample template",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (template?: SavedPromptTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setEditorForm({
        name: template.name,
        description: template.description,
        instructions: template.instructions,
        tags: [],
        isDefault: template.isDefault
      });
    } else {
      setEditingTemplate(null);
      setEditorForm({
        name: '',
        description: '',
        instructions: promptTemplateService.getDefaultTemplate(),
        tags: [],
        isDefault: false
      });
    }
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingTemplate(null);
    setEditorForm({
      name: '',
      description: '',
      instructions: '',
      tags: [],
      isDefault: false
    });
  };

  const saveTemplate = async () => {
    if (!currentUser || !editorForm.name.trim() || !editorForm.instructions.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and instructions are required",
        variant: "destructive"
      });
      return;
    }

    if (saving) return; // Prevent duplicate saves

    try {
      setSaving(true);
      let savedTemplateId: string;
      
      if (editingTemplate) {
        // Update existing template
        await promptTemplateService.updateTemplate(currentUser.uid, editingTemplate.id, editorForm);
        savedTemplateId = editingTemplate.id;
        toast({
          title: "Success",
          description: "Template updated successfully"
        });
      } else {
        // Create new template
        savedTemplateId = await promptTemplateService.saveTemplate(currentUser.uid, editorForm);
        toast({
          title: "Success",
          description: "Template saved successfully"
        });
      }
      
      closeEditor();
      await loadTemplates();
      
      // Auto-select the saved/updated template by refetching it
      if (onSelectTemplate) {
        try {
          const updatedTemplates = await promptTemplateService.getUserTemplates(currentUser.uid);
          const savedTemplate = updatedTemplates.find(t => t.id === savedTemplateId);
          if (savedTemplate) {
            console.log(`🎯 Auto-selecting saved template: ${savedTemplate.name}`);
            onSelectTemplate(savedTemplate);
          }
        } catch (error) {
          console.error('Error auto-selecting template:', error);
        }
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!currentUser) return;
    
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await promptTemplateService.deleteTemplate(currentUser.uid, templateId);
      toast({
        title: "Success",
        description: "Template deleted successfully"
      });
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive"
      });
    }
  };

  const setAsDefault = async (templateId: string) => {
    if (!currentUser) return;

    try {
      await promptTemplateService.setUserDefaultTemplate(currentUser.uid, templateId);
      toast({
        title: "Success",
        description: "Template set as default"
      });
      loadTemplates();
    } catch (error) {
      console.error('Error setting default:', error);
      toast({
        title: "Error",
        description: "Failed to set default template",
        variant: "destructive"
      });
    }
  };

  const copyTemplate = (template: SavedPromptTemplate) => {
    openEditor({
      ...template,
      id: '',
      name: `${template.name} (Copy)`,
      isDefault: false
    });
  };

  const handleSelectTemplate = (template: SavedPromptTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      if (currentUser) {
        // Increment usage count asynchronously
        promptTemplateService.incrementUsage(currentUser.uid, template.id).catch(console.error);
      }
    }
  };

  const TemplateCard: React.FC<{ 
    template: SavedPromptTemplate; 
    isUserTemplate?: boolean;
    isSelected?: boolean;
  }> = ({ template, isUserTemplate = false, isSelected = false }) => (
    <Card className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
      isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{template.name}</CardTitle>
              {template.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  <Star className="w-3 h-3 mr-1" />
                  Default
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              {template.description}
            </CardDescription>
          </div>
          
          {isUserTemplate && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditor(template);
                }}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setAsDefault(template.id);
                }}
              >
                {template.isDefault ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  copyTemplate(template);
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTemplate(template.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent onClick={() => handleSelectTemplate(template)}>
        <div className="space-y-2">
          <div className="text-sm text-gray-600 line-clamp-3">
            {template.instructions.substring(0, 150)}...
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              {template.updatedAt.toLocaleDateString()}
            </div>
            {onSelectTemplate && (
              <Button size="sm" variant="outline">
                Use Template
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!currentUser) {
    return (
      <Alert>
        <AlertDescription>
          Please sign in to manage prompt templates.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Templates</h2>
          <p className="text-gray-600">Manage and customize your quiz generation prompts</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={loadTemplates}
            variant="outline"
            disabled={loading}
          >
            <Clock className="w-4 h-4 mr-2" />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          
          <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openEditor()}>
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </DialogTitle>
              <DialogDescription>
                Create a custom prompt template for quiz generation
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={editorForm.name}
                    onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                    placeholder="Enter template name"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={editorForm.isDefault}
                    onChange={(e) => setEditorForm({ ...editorForm, isDefault: e.target.checked })}
                  />
                  <Label htmlFor="isDefault">Set as default template</Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editorForm.description}
                  onChange={(e) => setEditorForm({ ...editorForm, description: e.target.value })}
                  placeholder="Describe what this template is used for"
                  className="h-20"
                />
              </div>
              
              <div>
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={editorForm.instructions}
                  onChange={(e) => setEditorForm({ ...editorForm, instructions: e.target.value })}
                  placeholder="Enter your custom prompt instructions"
                  className="h-64 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {'{numQuestions}'} as a placeholder for the number of questions
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeEditor}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={saveTemplate} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Save Template'}
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
        <TabsList>
          <TabsTrigger value="my-templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            My Templates ({userTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="popular" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Popular Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-templates" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : userTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No templates yet</p>
              <p className="text-sm mb-4">Create your first custom prompt template</p>
              <div className="space-y-2">
                <Button onClick={() => openEditor()} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Template
                </Button>
                <Button onClick={createSampleTemplate} variant="ghost" size="sm" disabled={saving}>
                  <FileText className="w-4 h-4 mr-2" />
                  {saving ? 'Creating...' : 'Create Sample Template'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isUserTemplate={true}
                  isSelected={selectedTemplateId === template.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popularTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};