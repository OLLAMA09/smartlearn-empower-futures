import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Settings, 
  Star, 
  FileText, 
  Plus,
  Edit3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { promptTemplateService } from '@/services/promptTemplateService';
import { SavedPromptTemplate } from '@/types/promptTemplates';
import { PromptTemplateManager } from './PromptTemplateManager';

interface PromptTemplateSelectorProps {
  onTemplateSelect: (instructions: string) => void;
  className?: string;
}

export const PromptTemplateSelector: React.FC<PromptTemplateSelectorProps> = ({
  onTemplateSelect,
  className = ""
}) => {
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState<SavedPromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedPromptTemplate | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadTemplates();
    } else {
      // Load default template for non-authenticated users
      const defaultTemplate: SavedPromptTemplate = {
        id: 'default',
        name: 'Default Template',
        description: 'Standard quiz generation prompt',
        instructions: promptTemplateService.getDefaultTemplate(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: true
      };
      setTemplates([defaultTemplate]);
      setSelectedTemplate(defaultTemplate);
      onTemplateSelect(defaultTemplate.instructions);
    }
  }, [currentUser]);

  const loadTemplates = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const userTemplates = await promptTemplateService.getUserTemplates(currentUser.uid);
      
      // If user has no templates, create a default one
      if (userTemplates.length === 0) {
        const defaultTemplate: SavedPromptTemplate = {
          id: 'default',
          name: 'Default Template',
          description: 'Standard quiz generation prompt',
          instructions: promptTemplateService.getDefaultTemplate(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDefault: true
        };
        setTemplates([defaultTemplate]);
        setSelectedTemplate(defaultTemplate);
        onTemplateSelect(defaultTemplate.instructions);
      } else {
        setTemplates(userTemplates);
        
        // Find default template or use first one
        const defaultTemplate = userTemplates.find(t => t.isDefault) || userTemplates[0];
        setSelectedTemplate(defaultTemplate);
        onTemplateSelect(defaultTemplate.instructions);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      // Fallback to default template
      const fallbackTemplate: SavedPromptTemplate = {
        id: 'default',
        name: 'Default Template',
        description: 'Standard quiz generation prompt',
        instructions: promptTemplateService.getDefaultTemplate(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: true
      };
      setTemplates([fallbackTemplate]);
      setSelectedTemplate(fallbackTemplate);
      onTemplateSelect(fallbackTemplate.instructions);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      onTemplateSelect(template.instructions);
      
      // Increment usage count if it's a saved template
      if (currentUser && templateId !== 'default') {
        promptTemplateService.incrementUsage(currentUser.uid, templateId).catch(console.error);
      }
    }
  };

  const handleTemplateFromManager = (template: SavedPromptTemplate) => {
    console.log(`📝 Template selected from manager: ${template.name}`);
    setSelectedTemplate(template);
    onTemplateSelect(template.instructions);
    setIsManagerOpen(false);
    
    // Reload templates to get updated list
    if (currentUser) {
      loadTemplates();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Prompt Template</h3>
          <p className="text-sm text-gray-600">Choose how your quiz questions should be generated</p>
        </div>
        
        {currentUser && (
          <Dialog open={isManagerOpen} onOpenChange={(open) => {
            setIsManagerOpen(open);
            // Reload templates when manager closes to ensure we have the latest templates
            if (!open && currentUser) {
              loadTemplates();
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Manage Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Template Manager</DialogTitle>
                <DialogDescription>
                  Create, edit, and manage your custom prompt templates
                </DialogDescription>
              </DialogHeader>
              <PromptTemplateManager 
                onSelectTemplate={handleTemplateFromManager}
                selectedTemplateId={selectedTemplate?.id}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Selected Template</CardTitle>
            {loading && <div className="text-sm text-gray-500">Loading...</div>}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select
              value={selectedTemplate?.id || ''}
              onValueChange={handleTemplateChange}
              disabled={loading}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>{template.name}</span>
                      {template.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsManagerOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New
              </Button>
            )}
          </div>

          {selectedTemplate && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{selectedTemplate.name}</h4>
                {selectedTemplate.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Default
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-gray-600">
                {selectedTemplate.description}
              </p>
              
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-0 h-auto text-blue-600 hover:text-blue-800">
                    <Edit3 className="w-3 h-3 mr-1" />
                    View Template Instructions
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700 max-h-32 overflow-y-auto">
                      {selectedTemplate.instructions}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {!currentUser && (
            <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-md">
              💡 <strong>Tip:</strong> Sign in to create and save your own custom prompt templates for personalized quiz generation.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};