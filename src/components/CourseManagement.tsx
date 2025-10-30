import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Eye, BookOpen, Users, Star, Clock, Video, FileText, File, X, Save, Loader2, GripVertical, ArrowDown, ArrowUp, Bug, Upload, Image } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Course, CourseContent, Quiz, QuizQuestion } from "@/types";
import { courseService } from "@/services/courseService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css"; // or any highlight.js theme you prefer
import MdEditor from "react-markdown-editor-lite";
import "react-markdown-editor-lite/lib/index.css";
import { CourseContentDebugger } from "./CourseContentDebugger";

interface CourseManagementProps {
  userRole: 'educator' | 'admin';
  courses: Course[];
  onCoursesUpdate: (courses: Course[]) => void;
}

const CourseManagement = ({ userRole, onCoursesUpdate }: CourseManagementProps) => {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [selectedCourseForContent, setSelectedCourseForContent] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingContent, setEditingContent] = useState<CourseContent | null>(null);
  const [debuggingCourse, setDebuggingCourse] = useState<Course | null>(null);
  const [thumbnailUploadMode, setThumbnailUploadMode] = useState<'url' | 'upload'>('url');
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [editThumbnailUploadMode, setEditThumbnailUploadMode] = useState<'url' | 'upload'>('url');
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string>('');
  
  const [newContent, setNewContent] = useState<Partial<CourseContent>>({
    title: '',
    type: 'video',
    url: '',
    content: '',
    duration: ''
  });

  const [newCourse, setNewCourse] = useState<Partial<Course>>({
    title: '',
    description: '',
    category: '',
    level: 'Beginner',
    duration: '',
    students: 0,
    rating: 0,
    instructor: '',
    thumbnail: '',
    status: 'draft',
    content: []
  });

  const [newQuiz, setNewQuiz] = useState<Partial<Quiz>>({
    title: '',
    courseId: '',
    questions: []
  });

  // Handle reordering of course content
  const handleContentReorder = async (result: DropResult) => {
    if (!result.destination || !selectedCourseForContent || !currentUser) return;
    
    const { source, destination } = result;
    if (source.index === destination.index) return;
    
    // Create a new array with reordered items
    const updatedContent = [...selectedCourseForContent.content];
    const [removed] = updatedContent.splice(source.index, 1);
    updatedContent.splice(destination.index, 0, removed);
    
    // Update state immediately for UI responsiveness
    const updatedCourse = {
      ...selectedCourseForContent,
      content: updatedContent
    };
    
    // Update in local state
    setSelectedCourseForContent(updatedCourse);
    
    // Update the courses list
    const newCourses = courses.map(course => 
      (course.id === selectedCourseForContent.id || 
        (selectedCourseForContent.firebaseId && course.firebaseId === selectedCourseForContent.firebaseId)) 
        ? updatedCourse 
        : course
    );
    setCourses(newCourses);
    onCoursesUpdate(newCourses);
    
    try {
      // Update in Firebase
      const courseId = selectedCourseForContent.firebaseId || selectedCourseForContent.id.toString();
      
      // Use updateDoc to update the content array directly in Firestore
      await courseService.updateCourseContentOrder(
        courseId,
        updatedContent,
        currentUser.uid
      );
      
      toast.success('Content order updated successfully');
    } catch (error) {
      console.error('Error updating content order:', error);
      toast.error('Failed to update content order');
      
      // Revert to original order on error
      setSelectedCourseForContent(selectedCourseForContent);
    }
  };
  
  // Function to manually move content item up or down (alternative to drag-drop)
  const moveContentItem = async (index: number, direction: 'up' | 'down') => {
    if (!selectedCourseForContent || !selectedCourseForContent.content) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Check if the move is valid
    if (newIndex < 0 || newIndex >= selectedCourseForContent.content.length) {
      return;
    }
    
    // Create result object similar to react-beautiful-dnd
    const result = {
      source: { index },
      destination: { index: newIndex }
    };
    
    // Use the same function for consistency
    handleContentReorder(result as DropResult);
  };

  // Load courses from Firebase on component mount
  useEffect(() => {
    const loadCourses = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      try {
        console.log("Loading courses for user:", currentUser.uid);
        const firebaseCourses = await courseService.getCourses(userRole, currentUser.uid);
        console.log("Loaded courses from Firebase:", firebaseCourses);
        
        // All courses are now directly from Firebase
        setCourses(firebaseCourses);
        onCoursesUpdate(firebaseCourses);
        
        // Extract quizzes from courses
        const extractedQuizzes: Quiz[] = [];
        firebaseCourses.forEach(course => {
          if (course.quiz && course.quiz.id && course.quiz.title) {
            // Add courseTitle to quiz for better display
            const quizWithCourse = {
              ...course.quiz,
              courseId: course.firebaseId || course.id
            };
            extractedQuizzes.push(quizWithCourse);
          }
        });
        
        console.log("Extracted quizzes:", extractedQuizzes.length);
        setQuizzes(extractedQuizzes);
      } catch (error) {
        console.error('Error loading courses:', error);
        toast.error('Failed to load courses from database');
        // Set to empty array instead of using initial courses
        setCourses([]);
        onCoursesUpdate([]);
        setQuizzes([]);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [currentUser, userRole, onCoursesUpdate]);

  // Set edit thumbnail preview when editing course changes
  React.useEffect(() => {
    if (editingCourse?.thumbnail && editingCourse.thumbnail.startsWith('data:image/')) {
      setEditThumbnailPreview(editingCourse.thumbnail);
      setEditThumbnailUploadMode('upload');
    } else {
      setEditThumbnailPreview('');
      setEditThumbnailUploadMode('url');
    }
  }, [editingCourse]);

  // Convert image file to base64 string
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  // Handle thumbnail image file selection
  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file size must be less than 5MB');
      return;
    }

    try {
      const base64String = await convertImageToBase64(file);
      setNewCourse({ ...newCourse, thumbnail: base64String });
      setThumbnailPreview(base64String);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Error converting image:', error);
      toast.error('Failed to upload image');
    }
  };

  // Handle edit thumbnail image file selection
  const handleEditThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file size must be less than 5MB');
      return;
    }

    try {
      const base64String = await convertImageToBase64(file);
      setEditingCourse({ ...editingCourse!, thumbnail: base64String });
      setEditThumbnailPreview(base64String);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Error converting image:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleCreateCourse = async () => {
    if (!currentUser) {
      toast.error('You must be logged in to create courses');
      return;
    }

    if (newCourse.title && newCourse.description && newCourse.category) {
      setSaving(true);
      try {
        console.log("Creating new course in Firebase...", newCourse);
        
        const course: Omit<Course, 'id'> = {
          title: newCourse.title,
          description: newCourse.description,
          category: newCourse.category,
          level: newCourse.level as 'Beginner' | 'Intermediate' | 'Advanced',
          duration: newCourse.duration || '0 hours',
          students: 0,
          rating: 0,
          instructor: newCourse.instructor || currentUser.email || 'Instructor',
          thumbnail: newCourse.thumbnail || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=250&fit=crop',
          status: newCourse.status as 'draft' | 'published' | 'archived',
          content: [],
          quiz: {
            id: Date.now().toString(),
            title: `${newCourse.title} Quiz`,
            questions: []
          }
        };
        
        // Save to Firebase - now returns both firebaseId and numericId
        const result = await courseService.createCourse(course, currentUser.uid);
        console.log("Course created with Firebase ID:", result.firebaseId);
        
        // Create course object with the IDs from Firebase
        const createdCourse: Course = {
          ...course,
          id: result.id, 
          firebaseId: result.firebaseId
        };
        
        console.log("Created course object:", createdCourse);
        
        const updatedCourses = [...courses, createdCourse];
        setCourses(updatedCourses);
        onCoursesUpdate(updatedCourses);
        
        setNewCourse({
          title: '',
          description: '',
          category: '',
          level: 'Beginner',
          duration: '',
          students: 0,
          rating: 0,
          instructor: '',
          thumbnail: '',
          status: 'draft',
          content: []
        });
        setIsCreateCourseOpen(false);
        toast.success('Course created and saved successfully!');
      } catch (error) {
        console.error('Error creating course:', error);
        toast.error('Failed to save course to database');
      } finally {
        setSaving(false);
      }
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const handleUpdateCourse = async () => {
    if (!currentUser || !editingCourse) return;

    setSaving(true);
    try {
      // Update in Firebase if it's a Firebase course
      const courseId = editingCourse.firebaseId || editingCourse.id.toString();
      console.log("Updating course with ID:", courseId);
      await courseService.updateCourse(courseId, editingCourse, currentUser.uid);
      
      const updatedCourses = courses.map(course =>
        course.id === editingCourse.id ? editingCourse : course
      );
      setCourses(updatedCourses);
      onCoursesUpdate(updatedCourses);
      setEditingCourse(null);
      toast.success('Course updated successfully!');
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!currentUser) return;

    setSaving(true);
    try {
      // Get the course to check if it has a Firebase ID
      const courseToDelete = courses.find(c => c.id === courseId);
      if (courseToDelete) {
        // Delete from Firebase if it has a Firebase ID
        const firebaseId = courseToDelete.firebaseId || courseId.toString();
        console.log("Deleting course with ID:", firebaseId);
        await courseService.deleteCourse(firebaseId, currentUser.uid);
      }
      
      const updatedCourses = courses.filter(course => course.id !== courseId);
      setCourses(updatedCourses);
      onCoursesUpdate(updatedCourses);
      setQuizzes(quizzes.filter(quiz => quiz.courseId !== courseId));
      toast.success('Course deleted successfully!');
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateContent = async () => {
    if (!currentUser || !selectedCourseForContent || !editingContent) {
      toast.error('Cannot update content at this time');
      return;
    }

    setSaving(true);
    try {
      console.log("Updating content in course:", selectedCourseForContent);
      console.log("Original editingContent:", editingContent);
      console.log("Form newContent values:", newContent);

      // Process video URLs for editing
      // Use the values from newContent (form) but keep the ID from editingContent
      let processedContent: CourseContent = { 
        ...editingContent,
        title: newContent.title || editingContent.title,
        type: (newContent.type as 'video' | 'text' | 'pdf') || editingContent.type,
        url: newContent.url || editingContent.url || '',
        content: newContent.content || editingContent.content || '',
        duration: newContent.duration || editingContent.duration || ''
      };
      
      if (processedContent.type === 'video' && processedContent.url) {
        try {
          // Convert YouTube URLs to embed format
          if (processedContent.url.includes('youtube.com/watch')) {
            const videoId = new URL(processedContent.url).searchParams.get('v');
            if (videoId) {
              processedContent.videoUrl = `https://www.youtube.com/embed/${videoId}`;
            }
          } else if (processedContent.url.includes('youtu.be/')) {
            const videoId = processedContent.url.split('youtu.be/')[1]?.split('?')[0];
            if (videoId) {
              processedContent.videoUrl = `https://www.youtube.com/embed/${videoId}`;
            }
          } else {
            // If it's already an embed URL or other video URL, keep it as is
            processedContent.videoUrl = processedContent.url;
          }
        } catch (e) {
          console.error("Error processing video URL:", e);
          processedContent.videoUrl = processedContent.url;
        }
      }
      
      // Use Firebase ID if available, otherwise use numeric ID
      const courseId = selectedCourseForContent.firebaseId || selectedCourseForContent.id.toString();
      console.log("Updating content in course with ID:", courseId);
      
      // Update course content in Firebase
      await courseService.updateCourseContent(
        courseId,
        processedContent,
        currentUser.uid
      );
      
      // Update the selected course with the updated content
      const updatedCourse = {
        ...selectedCourseForContent,
        content: selectedCourseForContent.content.map(item => 
          item.id === processedContent.id ? processedContent : item
        )
      };
      
      // Update the courses list
      const updatedCourses = courses.map(course => 
        (course.id === selectedCourseForContent.id || 
         (selectedCourseForContent.firebaseId && 
          course.firebaseId === selectedCourseForContent.firebaseId)) 
          ? updatedCourse 
          : course
      );

      setCourses(updatedCourses);
      onCoursesUpdate(updatedCourses);
      setSelectedCourseForContent(updatedCourse);
      
      // Reset editing state
      setEditingContent(null);
      setNewContent({
        title: '',
        type: 'video',
        url: '',
        content: '',
        duration: ''
      });
      
      toast.success('Content updated successfully!');
    } catch (error) {
      console.error('Error updating content:', error);
      toast.error('Failed to update course content');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!currentUser || !selectedCourseForContent) {
      toast.error('Cannot delete content at this time');
      return;
    }

    setSaving(true);
    try {
      // Use Firebase ID if available, otherwise use numeric ID
      const courseId = selectedCourseForContent.firebaseId || selectedCourseForContent.id.toString();
      console.log("Deleting content from course with ID:", courseId);
      
      // Delete from Firebase
      await courseService.deleteCourseContent(
        courseId,
        contentId,
        currentUser.uid
      );
      
      // Update local state
      const updatedCourse = {
        ...selectedCourseForContent,
        content: selectedCourseForContent.content.filter(item => item.id !== contentId)
      };
      
      // Update the courses list
      const updatedCourses = courses.map(course => 
        (course.id === selectedCourseForContent.id || 
         (selectedCourseForContent.firebaseId && 
          course.firebaseId === selectedCourseForContent.firebaseId)) 
          ? updatedCourse 
          : course
      );

      setCourses(updatedCourses);
      onCoursesUpdate(updatedCourses);
      setSelectedCourseForContent(updatedCourse);
      toast.success('Content deleted successfully!');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete course content');
    } finally {
      setSaving(false);
    }
  };

  const handleAddContent = async () => {
    if (!currentUser || !selectedCourseForContent || !newContent.title || !newContent.type) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      console.log("Adding content to course:", selectedCourseForContent);
      
      // Process video URLs to make them embeddable
      let processedContent: Omit<CourseContent, 'id'> = {
        title: newContent.title,
        type: newContent.type as 'video' | 'text' | 'pdf',
        url: newContent.url || '',
        content: newContent.content || '',
        duration: newContent.duration || ''
      };
      
      if (processedContent.type === 'video' && processedContent.url) {
        try {
          // Convert YouTube URLs to embed format
          if (processedContent.url.includes('youtube.com/watch')) {
            const videoId = new URL(processedContent.url).searchParams.get('v');
            if (videoId) {
              processedContent.videoUrl = `https://www.youtube.com/embed/${videoId}`;
            }
          } else if (processedContent.url.includes('youtu.be/')) {
            const videoId = processedContent.url.split('youtu.be/')[1]?.split('?')[0];
            if (videoId) {
              processedContent.videoUrl = `https://www.youtube.com/embed/${videoId}`;
            }
          } else {
            // If it's already an embed URL or other video URL, keep it as is
            processedContent.videoUrl = processedContent.url;
          }
        } catch (e) {
          console.error("Error processing video URL:", e);
          processedContent.videoUrl = processedContent.url;
        }
      }
      
      // Use Firebase ID if available, otherwise use numeric ID
      const courseId = selectedCourseForContent.firebaseId || selectedCourseForContent.id.toString();
      console.log("Adding content to course with ID:", courseId);
      
      // The addCourseContent now returns the created content with an ID
      const contentWithId = await courseService.addCourseContent(
        courseId,
        processedContent,
        currentUser.uid
      );
      
      console.log("Content added with ID:", contentWithId);
      
      // Update the selected course with the new content
      const updatedCourse = {
        ...selectedCourseForContent,
        content: [...(selectedCourseForContent.content || []), contentWithId]
      };
      
      // Update the courses list - match by ID or Firebase ID
      const updatedCourses = courses.map(course => 
        (course.id === selectedCourseForContent.id || 
         (selectedCourseForContent.firebaseId && 
          course.firebaseId === selectedCourseForContent.firebaseId)) 
          ? updatedCourse 
          : course
      );

      setCourses(updatedCourses);
      onCoursesUpdate(updatedCourses);
      setSelectedCourseForContent(updatedCourse);
      
      setNewContent({
        title: '',
        type: 'video',
        url: '',
        content: '',
        duration: ''
      });
      
      toast.success('Content added successfully!');
    } catch (error) {
      console.error('Error adding content:', error);
      toast.error('Failed to add course content');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!currentUser) {
      toast.error('You must be logged in to manage quizzes');
      return;
    }
    
    if (!newQuiz.title) {
      toast.error('Please enter a quiz title');
      return;
    }
    
    if (!newQuiz.courseId) {
      toast.error('Please select a course for this quiz');
      return;
    }
    
    if (!newQuiz.questions || newQuiz.questions.length === 0) {
      toast.error('Please add at least one question to the quiz');
      return;
    }
    
    for (const question of newQuiz.questions) {
      if (!question.question) {
        toast.error('All questions must have content');
        return;
      }
      
      if (question.options.some(option => !option)) {
        toast.error('All options must be filled out');
        return;
      }
    }

    setSaving(true);
    try {
      // Create or update a quiz - always use a string ID
      // Use a UUID-like format instead of timestamp for better uniqueness
      const uniqueId = editingQuiz ? editingQuiz.id : 
        'quiz_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
        
      const quiz: Quiz = {
        id: uniqueId,
        title: newQuiz.title,
        courseId: newQuiz.courseId,
        questions: newQuiz.questions.map((q, index) => ({
          id: 'q_' + (index + 1).toString(),
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer
        }))
      };

      // Find the course by checking both firebaseId and id fields
      const quizCourseId = newQuiz.courseId?.toString() || "";
      console.log("Looking for course with ID:", quizCourseId);
      
      // Try to find by Firebase ID first, then by regular ID
      let courseToUpdate = courses.find(c => 
        c.firebaseId === quizCourseId || c.id === quizCourseId
      );
      
      console.log("Course for quiz operation:", courseToUpdate);
      
      if (courseToUpdate) {
        // Always prefer Firebase ID for Firestore operations
        const courseId = courseToUpdate.firebaseId || courseToUpdate.id;
        await courseService.updateCourseQuiz(
          courseId,
          quiz,
          currentUser.uid
        );

        // Update local state
        const updatedCourses = courses.map(course => 
          (course.id === courseToUpdate?.id || 
           (courseToUpdate?.firebaseId && course.firebaseId === courseToUpdate.firebaseId)) 
            ? { ...course, quiz } 
            : course
        );
        setCourses(updatedCourses);
        onCoursesUpdate(updatedCourses);
        
        // Update the quizzes array
        if (editingQuiz) {
          setQuizzes(quizzes.map(q => q.id === quiz.id ? quiz : q));
        } else {
          setQuizzes([...quizzes, quiz]);
        }
      } else {
        console.error("Course not found for quiz:", newQuiz.courseId);
        toast.error("Course not found. Quiz not saved.");
        setSaving(false);
        return;
      }
      
      // Reset state
      setNewQuiz({
        title: '',
        courseId: '',
        questions: []
      });
      setIsCreateQuizOpen(false);
      setEditingQuiz(null);
      toast.success(editingQuiz ? 'Quiz updated successfully!' : 'Quiz created successfully!');
    } catch (error) {
      console.error('Error creating quiz:', error);
      toast.error('Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!currentUser) {
      toast.error('You must be logged in to delete quizzes');
      return;
    }
    
    setSaving(true);
    try {
      // Find the course that contains this quiz
      const courseWithQuiz = courses.find(course => course.quiz && course.quiz.id === quizId);
      
      if (!courseWithQuiz) {
        toast.error("Course not found for this quiz");
        return;
      }
      
      // Always use Firebase ID for Firestore operations
      const courseId = courseWithQuiz.firebaseId || courseWithQuiz.id.toString();
      console.log(`Deleting quiz ${quizId} from course ${courseId}`);
      
      // Delete the quiz from Firebase
      await courseService.deleteCourseQuiz(
        courseId,
        quizId,
        currentUser.uid
      );
      
      // Update local state
      setQuizzes(quizzes.filter(quiz => quiz.id !== quizId));
      
      // Update the courses list
      const updatedCourses = courses.map(course => {
        if ((course.quiz && course.quiz.id === quizId)) {
          // Create an empty quiz structure with a string ID format
          const emptyQuiz = {
            id: 'quiz_empty_' + Date.now().toString(),
            title: `${course.title} Quiz`,
            questions: []
          };
          return { ...course, quiz: emptyQuiz };
        }
        return course;
      });
      
      setCourses(updatedCourses);
      onCoursesUpdate(updatedCourses);
      
      toast.success('Quiz deleted successfully!');
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error('Failed to delete quiz');
    } finally {
      setSaving(false);
    }
  };

  const addQuizQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: 'q_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 5), // Generate a unique string ID
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0
    };
    setNewQuiz({
      ...newQuiz,
      questions: [...(newQuiz.questions || []), newQuestion]
    });
  };

  const updateQuizQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const updatedQuestions = [...(newQuiz.questions || [])];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setNewQuiz({ ...newQuiz, questions: updatedQuestions });
  };

  const removeQuizQuestion = (index: number) => {
    const updatedQuestions = (newQuiz.questions || []).filter((_, i) => i !== index);
    setNewQuiz({ ...newQuiz, questions: updatedQuestions });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setNewContent((prev) => ({
        ...prev,
        content: (prev.content || "") + `\n\n![Image](${base64})\n\n`
      }));
    };
    reader.readAsDataURL(file);
  };

  // Add this helper before the return in your component
  const insertAtCursor = (
    textarea: HTMLTextAreaElement | null,
    before: string,
    after: string = "",
    placeholder: string = ""
  ) => {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.substring(start, end) || placeholder;
    const newValue =
      value.substring(0, start) +
      before +
      selected +
      after +
      value.substring(end);
    textarea.value = newValue;
    textarea.focus();
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
    // Update state
    setNewContent((prev) => ({
      ...prev,
      content: textarea.value,
    }));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Course Management</h1>
          <p className="text-gray-600">Create, edit, and manage your courses</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isCreateCourseOpen} onOpenChange={setIsCreateCourseOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-purple-600 hover:bg-purple-700" 
                data-voice="create-course"
                disabled={saving}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Course</DialogTitle>
                <DialogDescription>
                  Fill in the details to create a new course.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Course Title</Label>
                  <Input
                    id="title"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    placeholder="Enter course title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                    placeholder="Enter course description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={newCourse.category}
                      onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                      placeholder="e.g., Programming, Design"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="level">Level</Label>
                    <Select value={newCourse.level} onValueChange={(value) => setNewCourse({ ...newCourse, level: value as 'Beginner' | 'Intermediate' | 'Advanced' })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner</SelectItem>
                        <SelectItem value="Intermediate">Intermediate</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input
                      id="duration"
                      value={newCourse.duration}
                      onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                      placeholder="e.g., 2 hours, 5 days"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="instructor">Instructor</Label>
                    <Input
                      id="instructor"
                      value={newCourse.instructor}
                      onChange={(e) => setNewCourse({ ...newCourse, instructor: e.target.value })}
                      placeholder="Instructor name"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Thumbnail</Label>
                  <Tabs value={thumbnailUploadMode} onValueChange={(value) => setThumbnailUploadMode(value as 'url' | 'upload')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="url">URL</TabsTrigger>
                      <TabsTrigger value="upload">Upload Image</TabsTrigger>
                    </TabsList>
                    <TabsContent value="url" className="space-y-2">
                      <Input
                        value={newCourse.thumbnail}
                        onChange={(e) => setNewCourse({ ...newCourse, thumbnail: e.target.value })}
                        placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                      />
                    </TabsContent>
                    <TabsContent value="upload" className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailUpload}
                          className="hidden"
                          id="thumbnail-upload"
                        />
                        <Label
                          htmlFor="thumbnail-upload"
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          Choose Image
                        </Label>
                        <span className="text-sm text-gray-500">
                          Max 5MB, JPG/PNG/WebP
                        </span>
                      </div>
                      {thumbnailPreview && (
                        <div className="mt-2">
                          <Label className="text-sm font-medium">Preview:</Label>
                          <div className="mt-1 relative w-32 h-20 border border-gray-300 rounded-md overflow-hidden">
                            <img
                              src={thumbnailPreview}
                              alt="Thumbnail preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={newCourse.status} onValueChange={(value) => setNewCourse({ ...newCourse, status: value as 'draft' | 'published' | 'archived' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCreateCourse} 
                  className="bg-purple-600 hover:bg-purple-700"
                  data-voice="save-course"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Create Course
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateQuizOpen} onOpenChange={setIsCreateQuizOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                data-voice="create-quiz"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Quiz
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}</DialogTitle>
                <DialogDescription>
                  {editingQuiz 
                    ? 'Edit the quiz for your course.' 
                    : 'Create a quiz for one of your courses.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="quiz-title">Quiz Title</Label>
                  <Input
                    id="quiz-title"
                    value={newQuiz.title}
                    onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                    placeholder="Enter quiz title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-select">Select Course</Label>
                  <Select 
                    value={newQuiz.courseId?.toString() || ""} 
                    onValueChange={(value) => {
                      console.log("Quiz: Course selected with value:", value);
                      console.log("Available courses:", courses);
                      
                      // Find the course by Firestore ID first, then by internal ID
                      let selectedCourse = courses.find(c => c.firebaseId === value || c.id === value);
                      
                      if (selectedCourse) {
                        console.log("Quiz: Found course:", selectedCourse);
                        // Always use the Firestore ID when available
                        const courseIdToUse = selectedCourse.firebaseId || selectedCourse.id;
                        console.log("Using Firestore ID for course:", courseIdToUse);
                        setNewQuiz({ ...newQuiz, courseId: courseIdToUse });
                      } else {
                        console.warn("Quiz: Could not find course for value:", value);
                        // Use the selected value as-is
                        setNewQuiz({ ...newQuiz, courseId: value });
                        toast.error("Course not found in local state, using selected ID");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.length > 0 ? (
                        courses.map(course => (
                          <SelectItem 
                            key={course.id} 
                            value={course.firebaseId || course.id}
                            title={`Firestore ID: ${course.firebaseId || course.id}`}
                          >
                            {course.title}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-4 text-center text-sm text-gray-500">
                          No courses available. Please create a course first.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Questions</Label>
                    <Button 
                      onClick={addQuizQuestion} 
                      size="sm" 
                      variant="outline"
                      data-voice="add-question"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  </div>

                  {(newQuiz.questions || []).map((question, qIndex) => (
                    <Card key={qIndex}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Question {qIndex + 1}</CardTitle>
                          <Button
                            onClick={() => removeQuizQuestion(qIndex)}
                            size="sm"
                            variant="ghost"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label>Question</Label>
                          <Input
                            value={question.question}
                            onChange={(e) => updateQuizQuestion(qIndex, 'question', e.target.value)}
                            placeholder="Enter your question"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Options</Label>
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center space-x-2">
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...question.options];
                                  newOptions[oIndex] = e.target.value;
                                  updateQuizQuestion(qIndex, 'options', newOptions);
                                }}
                                placeholder={`Option ${oIndex + 1}`}
                              />
                              <input
                                type="radio"
                                name={`correct-${qIndex}`}
                                checked={question.correctAnswer === oIndex}
                                onChange={() => updateQuizQuestion(qIndex, 'correctAnswer', oIndex)}
                                className="text-purple-600"
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCreateQuiz} 
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={saving}
                  data-voice="save-quiz"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingQuiz ? 'Updating Quiz...' : 'Creating Quiz...'}
                    </>
                  ) : (
                    <>
                      {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="courses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="content">Course Content</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img 
                    src={course.thumbnail} 
                    alt={course.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge 
                      variant={course.status === 'published' ? 'default' : course.status === 'draft' ? 'secondary' : 'destructive'}
                      className={course.status === 'published' ? 'bg-green-500' : course.status === 'draft' ? 'bg-yellow-500' : 'bg-red-500'}
                    >
                      {course.status}
                    </Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{course.students}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4" />
                        <span>{course.rating}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{course.duration}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{course.category}</Badge>
                    <Badge variant="secondary">{course.level}</Badge>
                  </div>
                  
                  {course.firebaseId && (
                    <div className="text-xs text-gray-500 mt-1 truncate" title={`Firebase ID: ${course.firebaseId}`}>
                      ID: {course.firebaseId.substring(0, 10)}...
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setEditingCourse(course)}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      onClick={() => setDebuggingCourse(course)}
                      size="sm"
                      variant="secondary"
                      title="Debug Course Content for AI Quiz Generation"
                    >
                      <Bug className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Course</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{course.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCourse(course.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Quizzes</h2>
            <Button 
              onClick={() => {
                setEditingQuiz(null);
                setNewQuiz({
                  title: '',
                  courseId: '',
                  questions: []
                });
                setIsCreateQuizOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-voice="create-quiz"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Quiz
            </Button>
          </div>
          {quizzes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => {
                const associatedCourse = courses.find(c => 
                  c.id === quiz.courseId || c.firebaseId === quiz.courseId
                );
                return (
                  <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{quiz.title}</CardTitle>
                          <CardDescription>
                            Course: {associatedCourse?.title || 'Unknown Course'}
                          </CardDescription>
                        </div>
                        <Badge variant={quiz.questions.length > 0 ? "outline" : "destructive"}>
                          {quiz.questions.length > 0 ? `${quiz.questions.length} questions` : 'No questions'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {quiz.questions.length > 0 ? (
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium">Question preview:</p>
                            <p className="truncate">{quiz.questions[0].question}</p>
                            {quiz.questions.length > 1 && (
                              <p className="text-xs text-gray-500">+ {quiz.questions.length - 1} more questions</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No questions added yet.</p>
                        )}
                        <div className="flex justify-between items-center pt-2">
                          <div className="text-xs text-gray-500">
                            ID: {typeof quiz.id === 'string' ? quiz.id.substring(0, 8) + '...' : 'quiz_' + quiz.id}
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setEditingQuiz(quiz);
                                setNewQuiz({
                                  title: quiz.title,
                                  courseId: quiz.courseId,
                                  questions: [...quiz.questions]
                                });
                                setIsCreateQuizOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this quiz? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteQuiz(quiz.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed">
              <div className="flex flex-col items-center space-y-2">
                <BookOpen className="h-12 w-12 text-gray-400" />
                <h3 className="font-medium text-lg">No Quizzes Found</h3>
                <p className="text-sm text-gray-500">
                  You haven't created any quizzes yet. Click the "Create Quiz" button to get started.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Course Content</CardTitle>
              <CardDescription>Add videos, texts, or PDFs to your courses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Select Course</Label>
                <Select 
                  value={selectedCourseForContent?.firebaseId || selectedCourseForContent?.id.toString() || ""} 
                  onValueChange={(value) => {
                    console.log("Course selected:", value);
                    // Try to find the course first by Firebase ID (string value)
                    let course = courses.find(c => c.firebaseId === value);
                    
                    // If not found, try to parse as numeric ID
                    if (!course) {
                      // Use the value directly as a string ID
                      course = courses.find(c => c.id === value);
                    }
                    
                    console.log("Found course:", course);
                    setSelectedCourseForContent(course || null);
                    // Reset the new content form
                    setNewContent({
                      title: '',
                      type: 'video',
                      url: '',
                      content: '',
                      duration: ''
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.length === 0 ? (
                      <SelectItem value="none" disabled>No courses available</SelectItem>
                    ) : (
                      courses.map((course) => (
                        <SelectItem 
                          key={course.id} 
                          value={course.firebaseId || course.id.toString()}
                          title={`Course ID: ${course.id}${course.firebaseId ? ', Firebase ID: ' + course.firebaseId : ''}`}
                        >
                          {course.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedCourseForContent && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid gap-2">
                    <Label>Content Title</Label>
                    <Input
                      value={newContent.title}
                      onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                      placeholder="Enter content title"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Content Type</Label>
                    <Select 
                      value={newContent.type} 
                      onValueChange={(value) => setNewContent({ ...newContent, type: value as 'video' | 'text' | 'pdf' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newContent.type === 'video' && (
                    <div className="grid gap-2">
                      <Label>YouTube URL</Label>
                      <Input
                        value={newContent.url}
                        onChange={(e) => setNewContent({ ...newContent, url: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
                  )}

                  {newContent.type === 'text' && (
                    <div className="grid gap-2">
                      <Label>Text Content (Word-like Editor, Markdown Supported)</Label>
                      <MdEditor
                        value={newContent.content || ""}
                        style={{ height: 400 }}
                        renderHTML={text => (
                          <div className="prose prose-lg max-w-none">
                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                              {text}
                            </ReactMarkdown>
                          </div>
                        )}
                        onChange={({ text }) => setNewContent({ ...newContent, content: text })}
                        config={{
                          view: {
                            menu: true,
                            md: true,
                            html: true,
                          },
                          canView: {
                            menu: true,
                            md: true,
                            html: true,
                            fullScreen: true,
                            hideMenu: true,
                          },
                        }}
                        // Optional: handle image upload to base64
                        onImageUpload={async (file) => {
                          return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                              resolve(reader.result as string);
                            };
                            reader.onerror = () => {
                              toast.error("Image upload failed");
                              reject();
                            };
                            reader.readAsDataURL(file);
                          });
                        }}
                      />
                    </div>
                  )}

                  {newContent.type === 'pdf' && (
                    <div className="grid gap-2">
                      <Label>PDF URL</Label>
                      <Input
                        value={newContent.url}
                        onChange={(e) => setNewContent({ ...newContent, url: e.target.value })}
                        placeholder="Enter PDF URL"
                      />
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Duration (optional)</Label>
                    <Input
                      value={newContent.duration}
                      onChange={(e) => setNewContent({ ...newContent, duration: e.target.value })}
                      placeholder="e.g., 10 minutes"
                    />
                  </div>

                  <Button 
                    onClick={editingContent ? handleUpdateContent : handleAddContent} 
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingContent ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        {editingContent ? 'Update Content' : 'Add Content'}
                      </>
                    )}
                  </Button>
                  {editingContent && (
                    <Button 
                      onClick={() => {
                        // Reset editing state
                        setEditingContent(null);
                        setNewContent({
                          title: '',
                          type: 'video',
                          url: '',
                          content: '',
                          duration: ''
                        });
                      }}
                      variant="outline"
                      className="mt-2"
                    >
                      Cancel Editing
                    </Button>
                  )}
                </div>
              )}

              {selectedCourseForContent && selectedCourseForContent.content && selectedCourseForContent.content.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    Current Content
                    <Badge variant="outline" className="ml-2">Drag to reorder</Badge>
                  </h4>
                  
                  <DragDropContext onDragEnd={handleContentReorder}>
                    <Droppable droppableId="course-content">
                      {(provided) => (
                        <div 
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-2"
                        >
                          {selectedCourseForContent.content.map((item, index) => (
                            <Draggable 
                              key={item.id.toString()} 
                              draggableId={item.id.toString()} 
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center justify-between p-3 border rounded ${
                                    snapshot.isDragging ? "bg-purple-50 shadow-md" : ""
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="cursor-move p-1 hover:bg-gray-100 rounded"
                                      title="Drag to reorder"
                                    >
                                      <GripVertical className="h-4 w-4 text-gray-400" />
                                    </div>
                                    
                                    <Badge className="w-6 h-6 flex items-center justify-center rounded-full">
                                      {index + 1}
                                    </Badge>
                                    
                                    {item.type === 'video' && <Video className="h-4 w-4 text-red-500" />}
                                    {item.type === 'text' && <FileText className="h-4 w-4 text-blue-500" />}
                                    {item.type === 'pdf' && <File className="h-4 w-4 text-green-500" />}
                                    <div>
                                      <p className="font-medium">{item.title}</p>
                                      <p className="text-sm text-gray-500">{item.duration}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex space-x-1">
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => moveContentItem(index, 'up')}
                                      disabled={index === 0}
                                      className="p-1 h-8 w-8"
                                      title="Move up"
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => moveContentItem(index, 'down')}
                                      disabled={index === selectedCourseForContent.content.length - 1}
                                      className="p-1 h-8 w-8"
                                      title="Move down"
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        // Set the content for editing
                                        setEditingContent(item);
                                        // Populate the form with content data
                                        setNewContent({
                                          title: item.title,
                                          type: item.type,
                                          url: item.url || '',
                                          content: item.content || '',
                                          duration: item.duration || ''
                                        });
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => handleDeleteContent(item.id)}
                                      disabled={saving}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedCourseForContent && selectedCourseForContent.content && selectedCourseForContent.content.length > 0 && (
            <div className="mt-8">
              <h3 className="text-2xl font-bold mb-4">Course Content Preview</h3>
              {selectedCourseForContent.content.map((item, idx) =>
                item.type === "text" && item.content ? (
                  <div key={item.id} className="mb-8">
                    <h4 className="text-xl font-semibold mb-2">{item.title}</h4>
                    <div className="prose prose-lg max-w-none border rounded p-4 bg-white shadow">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                        {item.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Course Dialog */}
      {editingCourse && (
        <Dialog open={!!editingCourse} onOpenChange={() => setEditingCourse(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>
                Update the course details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Course Title</Label>
                <Input
                  id="edit-title"
                  value={editingCourse.title}
                  onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingCourse.description}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    value={editingCourse.category}
                    onChange={(e) => setEditingCourse({ ...editingCourse, category: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-level">Level</Label>
                  <Select 
                    value={editingCourse.level} 
                    onValueChange={(value) => setEditingCourse({ ...editingCourse, level: value as 'Beginner' | 'Intermediate' | 'Advanced' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-duration">Duration</Label>
                  <Input
                    id="edit-duration"
                    value={editingCourse?.duration}
                    onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-instructor">Instructor</Label>
                  <Input
                    id="edit-instructor"
                    value={editingCourse?.instructor}
                    onChange={(e) => setEditingCourse({ ...editingCourse, instructor: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Thumbnail</Label>
                <Tabs value={editThumbnailUploadMode} onValueChange={(value) => setEditThumbnailUploadMode(value as 'url' | 'upload')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url">URL</TabsTrigger>
                    <TabsTrigger value="upload">Upload Image</TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="space-y-2">
                    <Input
                      value={editingCourse.thumbnail}
                      onChange={(e) => setEditingCourse({ ...editingCourse, thumbnail: e.target.value })}
                      placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleEditThumbnailUpload}
                        className="hidden"
                        id="edit-thumbnail-upload"
                      />
                      <Label
                        htmlFor="edit-thumbnail-upload"
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Choose Image
                      </Label>
                      <span className="text-sm text-gray-500">
                        Max 5MB, JPG/PNG/WebP
                      </span>
                    </div>
                    {editThumbnailPreview && (
                      <div className="mt-2">
                        <Label className="text-sm font-medium">Preview:</Label>
                        <div className="mt-1 relative w-32 h-20 border border-gray-300 rounded-md overflow-hidden">
                          <img
                            src={editThumbnailPreview}
                            alt="Thumbnail preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select 
                  value={editingCourse.status} 
                  onValueChange={(value) => setEditingCourse({ ...editingCourse, status: value as 'draft' | 'published' | 'archived' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateCourse} className="bg-purple-600 hover:bg-purple-700">
                Update Course
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Course Content Debugger */}
      {debuggingCourse && (
        <CourseContentDebugger
          course={debuggingCourse}
          onClose={() => setDebuggingCourse(null)}
        />
      )}
    </div>
  );
};

export default CourseManagement;
