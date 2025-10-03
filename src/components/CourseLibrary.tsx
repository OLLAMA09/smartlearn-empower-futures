import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Video, FileText, BookOpen, CheckCircle, Award, Loader2, Star, MessageSquare, BarChart3 } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import { useAuth } from "@/contexts/AuthContext";
import { enrollmentService } from "@/services/enrollmentService";
import { toast } from "sonner";
import { StandaloneQuestionnaireModal } from "./StandaloneQuestionnaireModal";
import { QuestionnaireAnalytics } from "./QuestionnaireAnalytics";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import removeMarkdown from "remove-markdown";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
function cleanPlainText(text: string): string {
  // Remove markdown, then extra dashes, hashes, and blank lines
  let cleaned = removeMarkdown(text);
  cleaned = cleaned.replace(/^[\s\-#*_]+/gm, ""); // Remove leading -, #, *, _ and spaces
  cleaned = cleaned.replace(/\n{2,}/g, "\n"); // Collapse multiple newlines
  cleaned = cleaned.replace(/^\s+|\s+$/g, ""); // Trim
  return cleaned;
}
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
// import removeMarkdown from "remove-markdown"; // Add this import at the top (install with `npm install remove-markdown`);

interface Course {
  id: string;
  firebaseId?: string;
  title: string;
  description: string;
  category: string;
  level: string;
  duration: string;
  students: number;
  rating: number;
  instructor: string;
  thumbnail: string;
  content?: any[];
}

interface CourseLibraryProps {
  userRole: 'learner' | 'educator' | 'admin';
  onCourseSelect: (courseId: string) => void;
  courses: Course[];
}

const CourseLibrary = ({ userRole, onCourseSelect, courses }: CourseLibraryProps) => {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState(0);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [completedCourseIds, setCompletedCourseIds] = useState<string[]>([]);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
    const matchesLevel = selectedLevel === 'All' || course.level === selectedLevel;
    
    return matchesSearch && matchesCategory && matchesLevel;
  });
  
  // Preserve the original order of courses after filtering (important for admin's module ordering)
  // We do this by mapping the original order indices and sorting by them
  const preserveOrderedFilteredCourses = filteredCourses.map(course => {
    const originalIndex = courses.findIndex(c => c.id === course.id);
    return { ...course, originalIndex };
  }).sort((a, b) => a.originalIndex - b.originalIndex);

  // Get unique categories and levels from courses
  const categories = Array.from(new Set(courses.map(course => course.category)));
  const levels = Array.from(new Set(courses.map(course => course.level)));

  // Load user enrollments and course progress when component mounts or user changes
  useEffect(() => {
    const loadUserData = async () => {
      if (currentUser && userRole === 'learner') {
        try {
          // Load enrollments
          const enrollments = await enrollmentService.getUserEnrollments(currentUser.uid);
          const courseIds = enrollments.map(enrollment => enrollment.courseId);
          console.log("Enrolled courses:", courseIds);
          setEnrolledCourseIds(courseIds);
          
          // Load course completion status
          const progressQuery = query(
            collection(db, "userProgress"),
            where("userId", "==", currentUser.uid),
            where("completionPercentage", "==", 100)
          );
          
          const progressSnapshot = await getDocs(progressQuery);
          const completedIds: string[] = [];
          
          progressSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.courseId) {
              completedIds.push(data.courseId);
            }
          });
          
          setCompletedCourseIds(completedIds);
          console.log("Completed courses:", completedIds);
          
          // Debug info for course comparison
          courses.forEach(course => {
            console.log(`Course: ${course.title}, ID: ${course.id}, Firebase ID: ${course.firebaseId || 'none'}`);
            const isEnrolled = courseIds.includes(course.id) || (course.firebaseId && courseIds.includes(course.firebaseId));
            const isCompleted = completedIds.includes(course.id) || (course.firebaseId && completedIds.includes(course.firebaseId));
            console.log(`  Enrolled: ${isEnrolled}`);
            console.log(`  Completed: ${isCompleted}`);
          });
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      }
    };
    
    loadUserData();
  }, [currentUser, userRole, courses]);

  // Helper function to check if a course is completed
  const isCourseCompleted = (course: Course): boolean => {
    const courseId = course.id;
    const firebaseId = course.firebaseId;
    
    return completedCourseIds.includes(courseId) || 
           (firebaseId ? completedCourseIds.includes(firebaseId) : false);
  };
  
  // Helper function to check if a course is enrolled
  const isCourseEnrolled = (course: Course): boolean => {
    const courseId = course.id;
    const firebaseId = course.firebaseId;
    
    return enrolledCourseIds.includes(courseId) || 
           (firebaseId ? enrolledCourseIds.includes(firebaseId) : false);
  };

  // Handle enrollment in a course
  const handleEnrollInCourse = async (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    if (!currentUser) {
      toast.error('Please sign in to enroll in courses');
      return;
    }
    
    // Get the correct course object for this ID
    const course = courses.find(c => c.id === courseId || c.firebaseId === courseId);
    if (!course) {
      toast.error('Course not found');
      return;
    }
    
    // Use the Firebase ID if available, otherwise use the regular ID
    const effectiveCourseId = course.firebaseId || course.id;
    
    console.log(`Handling enrollment for course: ${course.title}, ID: ${effectiveCourseId}`);
    
    // If already completed, navigate to course content
    if (isCourseCompleted(course)) {
      console.log("Course is already completed. Navigating to content...");
      toast.success('You have already completed this course!');
      onCourseSelect(course.id);
      return;
    }
    
    // If already enrolled, navigate to course content
    if (isCourseEnrolled(course)) {
      console.log("User is already enrolled in course. Navigating to content...");
      onCourseSelect(course.id);
      return;
    }
    
    try {
      setEnrollingCourseId(effectiveCourseId);
      
      // Enroll the user in the course
      await enrollmentService.enrollUserInCourse(currentUser.uid, effectiveCourseId);
      
      // Update local state
      setEnrolledCourseIds([...enrolledCourseIds, effectiveCourseId]);
      
      // Show success message
      toast.success('Successfully enrolled in course!');
      
      // Redirect to course content
      onCourseSelect(course.id);
    } catch (error) {
      console.error('Error enrolling in course:', error);
      toast.error('Failed to enroll in course. Please try again.');
    } finally {
      setEnrollingCourseId(null);
    }
  };

  // Enhanced placeholder images from Unsplash
  const getCourseThumbnail = (course: Course) => {
    if (course.thumbnail && course.thumbnail !== '') {
      return course.thumbnail;
    }
    
    // Category-based placeholder images
    const placeholderImages = {
      'Programming': 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=250&fit=crop',
      'Data Science': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop',
      'Web Development': 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=250&fit=crop',
      'Design': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=250&fit=crop',
      'Business': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop',
      'default': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=250&fit=crop'
    };
    
    return placeholderImages[course.category as keyof typeof placeholderImages] || placeholderImages.default;
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Course Library</h1>
        <div className="flex items-center gap-4">
          {userRole === 'admin' || userRole === 'educator' ? (
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setShowAnalytics(true)}
            >
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </Button>
          ) : (
            <StandaloneQuestionnaireModal 
              buttonText="Share Feedback"
              buttonVariant="outline"
              buttonSize="default"
              trigger={
                <Button variant="outline" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Share Feedback
                </Button>
              }
            />
          )}
          <div className="text-sm text-gray-600">
            Showing {preserveOrderedFilteredCourses.length} of {courses.length} courses
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Filters */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter courses based on your interests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  type="search"
                  id="search"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger id="level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Levels</SelectItem>
                    {levels.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Course List */}
        <div className="md:col-span-3">
          {/* Course Detail Preview Modal/Section */}
          {selectedCourse && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto p-0 relative flex flex-col md:flex-row">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-purple-600 text-xl"
                  onClick={() => {
                    setSelectedCourse(null);
                    setSelectedLessonIdx(0);
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
                {/* Sidebar: List of lessons */}
                <div className="w-full md:w-1/3 border-r p-6 bg-gray-50 min-w-[260px]">
                  <h2 className="text-2xl font-bold mb-2 break-words">{selectedCourse.title}</h2>
                  <div className="mb-4 text-gray-600 break-words">{selectedCourse.description}</div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Badge>{selectedCourse.category}</Badge>
                    <Badge variant="secondary">{selectedCourse.level}</Badge>
                    <Badge variant="outline">{selectedCourse.duration}</Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Lessons</h4>
                    <ul className="space-y-1">
                      {selectedCourse.content?.filter((c: any) => c.type === "text" && c.content).map((item: any, idx: number) => (
                        <li key={item.id || idx}>
                          <button
                            className={`w-full text-left px-2 py-1 rounded ${selectedLessonIdx === idx ? "bg-purple-100 font-bold" : "hover:bg-gray-100"}`}
                            onClick={() => setSelectedLessonIdx(idx)}
                          >
                            <span className="break-words">{item.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {/* Main: Markdown Preview */}
                <div className="flex-1 overflow-auto p-0 flex flex-col items-center bg-white">
                  {selectedCourse.content &&
                    selectedCourse.content
                      .filter((c: any) => c.type === "text" && c.content)
                      .map((item: any, idx: number) =>
                        idx === selectedLessonIdx ? (
                          <div key={item.id || idx} className="w-full flex justify-center">
                            <div
                              className="prose prose-lg max-w-3xl w-full border rounded-lg p-8 bg-white shadow"
                              style={{
                                wordBreak: "break-word",
                                whiteSpace: "normal", // <-- fix: do NOT use pre-line, let markdown handle paragraphs
                                fontSize: "1.1rem",
                                lineHeight: "1.8",
                                background: "#fff"
                              }}
                            >
                              <div style={{whiteSpace: 'pre-line'}}>
                                {cleanPlainText(typeof item.content === 'string' ? item.content : String(item.content))}
                              </div>
                            </div>
                          </div>
                        ) : null
                      )}
                </div>
              </div>
            </div>
          )}
          <ScrollArea className="h-[650px] w-full rounded-md border">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {preserveOrderedFilteredCourses.map((course) => (
                <Card 
                  key={course.id} 
                  className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-purple-300" 
                  onClick={() => {
                    // Don't trigger this if clicking on the action button
                    // The button will handle its own click event
                    setSelectedCourse(course);
                    console.log("Card clicked, selecting course:", course.id);
                    onCourseSelect(course.id);
                  }}
                  title={course.firebaseId ? `Course ID: ${course.id}, Firebase ID: ${course.firebaseId}` : `Course ID: ${course.id}`}
                >
                  <div className="relative overflow-hidden">
                    <img 
                      src={getCourseThumbnail(course)} 
                      alt={course.title}
                      className="w-full h-48 object-cover rounded-t-lg transition-transform duration-300 hover:scale-105"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-white/90 text-gray-800">{course.level}</Badge>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg hover:text-purple-600 transition-colors">
                      {(() => {
                        // Detect module numbering in various formats
                        const moduleMatch = course.title.match(/module\s*(\d+)/i);
                        const shortMatch = course.title.match(/\bm(\d+)\b/i);
                        const numericPrefixMatch = course.title.match(/^(\d+)[\s.\-_)]+/);
                        
                        if (moduleMatch) {
                          return (
                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded mr-2 font-bold">
                              Module {moduleMatch[1]}
                            </span>
                          );
                        } else if (shortMatch) {
                          return (
                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded mr-2 font-bold">
                              Module {shortMatch[1]}
                            </span>
                          );
                        } else if (numericPrefixMatch) {
                          return (
                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded mr-2 font-bold">
                              #{numericPrefixMatch[1]}
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {course.title}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src="" alt={course.instructor} />
                        <AvatarFallback className="text-xs bg-purple-100 text-purple-600">
                          {course.instructor.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-600">{course.instructor}</span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <StarRating
                            totalStars={5}
                            initialRating={course.rating || 0}
                            readonly={true}
                            size="sm"
                          />
                          <span className="text-gray-700 ml-1">{course.rating ? course.rating.toFixed(1) : 'New'}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-blue-500">
                          <span>👥</span>
                          <span className="text-gray-700">{course.students}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-green-500">
                          <span>⏱️</span>
                          <span className="text-gray-700">{course.duration}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="hover:bg-purple-50 hover:border-purple-300">
                        {course.category}
                      </Badge>
                      {course.content && course.content.length > 0 && (
                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                          <BookOpen className="h-4 w-4" />
                          <span>{course.content.length} lessons</span>
                        </div>
                      )}
                    </div>

                    {/* Content Preview: removed, do not show any course content in the card */}
                    
                    {/* Firebase ID indicator for admin/educator */}
                    {userRole !== 'learner' && course.firebaseId && (
                      <div className="mt-1 text-xs text-gray-400">
                        ID: {course.firebaseId.substring(0, 6)}...
                      </div>
                    )}

                    {/* Enhanced Action Button */}
                    <div className="pt-2">
                      <Button 
                        className={`w-full transform transition-all duration-200 shadow-md hover:shadow-lg ${
                          userRole === 'learner' && isCourseCompleted(course)
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : userRole === 'learner' && isCourseEnrolled(course)
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-purple-600 hover:bg-purple-700'
                        } hover:scale-105`}
                        onClick={(e) => {
                          // Always stop propagation to prevent double navigation
                          e.stopPropagation();
                          
                          if (userRole === 'learner') {
                            // For learners, handle the course action based on status
                            if (isCourseCompleted(course) || isCourseEnrolled(course)) {
                              // Already enrolled or completed - navigate directly
                              console.log("Navigating directly to course:", course.id);
                              onCourseSelect(course.id);
                            } else {
                              // Not enrolled - handle enrollment
                              console.log("Handling enrollment for course:", course.id);
                              handleEnrollInCourse(e, course.firebaseId || course.id);
                            }
                          } else {
                            // For educators/admins, just view the course
                            setSelectedCourse(course);
                            onCourseSelect(course.id);
                            console.log(`Selected course: ID=${course.id}, FirebaseID=${course.firebaseId || 'none'}`);
                          }
                        }}
                        disabled={enrollingCourseId === (course.firebaseId || course.id)}
                      >
                        {enrollingCourseId === (course.firebaseId || course.id) ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enrolling...
                          </>
                        ) : userRole === 'learner' ? (
                          isCourseCompleted(course) ? (
                            <>
                              Completed
                              <Award className="ml-2 h-4 w-4" />
                            </>
                          ) : isCourseEnrolled(course) ? (
                            <>
                              Continue Learning
                              <CheckCircle className="ml-2 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Enroll Now
                              <BookOpen className="ml-2 h-4 w-4" />
                            </>
                          )
                        ) : (
                          <>
                            View Course
                            <BookOpen className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredCourses.length === 0 && (
                <div className="col-span-2 text-center py-10">
                  <div className="text-gray-400 mb-2">
                    <BookOpen className="h-12 w-12 mx-auto mb-4" />
                  </div>
                  <p className="text-lg font-medium text-gray-600">No courses found</p>
                  <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Analytics Modal for Admins */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Learning Experience Analytics
            </DialogTitle>
            <DialogDescription>
              Comprehensive analysis of user feedback and questionnaire responses
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <QuestionnaireAnalytics 
              isAdmin={userRole === 'admin' || userRole === 'educator'}
              courseId={undefined} // Shows all responses across courses for admins/educators
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseLibrary;
