// Custom prompt template types
export interface CustomPromptTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
  tags?: string[];
  usageCount?: number;
}

export interface SavedPromptTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}