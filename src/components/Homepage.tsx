
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Award, TrendingUp, Star, PlayCircle, Mic, MicOff } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { voiceRecognition } from "@/utils/voiceRecognition";
import { toast } from "sonner";
import { StandaloneQuestionnaireModal } from "./StandaloneQuestionnaireModal";

interface HomepageProps {
  onGetStarted: () => void;
}

const Homepage = ({ onGetStarted }: HomepageProps) => {
  const [isListening, setIsListening] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState("");
  const [courses, setCourses] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState({ students: 0, courses: 0, rating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  const handleVoiceCommand = () => {
    if (!voiceRecognition.isSupported()) {
      toast.error("Voice recognition is not supported in your browser");
      return;
    }

    if (isListening) {
      voiceRecognition.stop();
      return;
    }

    const success = voiceRecognition.start({
      language: 'en-US',
      onResult: (transcript) => {
        const command = transcript.toLowerCase();
        setVoiceCommand(transcript);
        
        if (command.includes('get started') || command.includes('sign up') || command.includes('login')) {
          toast.success("Voice command recognized: Getting started!");
          setTimeout(() => onGetStarted(), 1000);
        } else if (command.includes('learn more') || command.includes('about')) {
          toast.success("Voice command recognized: Learn more!");
          document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
        } else {
          toast.info(`Voice command: "${transcript}"`);
        }
      },
      onError: (error) => {
        toast.error(`Voice recognition error: ${error}`);
        setIsListening(false);
      },
      onStart: () => {
        setIsListening(true);
        toast.success("Voice recognition started - try saying 'get started' or 'learn more'");
      },
      onEnd: () => {
        setIsListening(false);
      }
    });

    if (!success) {
      toast.error("Failed to start voice recognition");
    }
  };

  useEffect(() => {
    // Cleanup for voice recognition
    return () => {
      voiceRecognition.stop();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch courses
        const coursesSnap = await getDocs(collection(db, "courses"));
        const coursesData = coursesSnap.docs.map(doc => doc.data());
        setCourses(coursesData);

        // Fetch testimonials
        const testimonialsSnap = await getDocs(collection(db, "testimonials"));
        const testimonialsData = testimonialsSnap.docs.map(doc => doc.data());
        setTestimonials(testimonialsData);

        // Fetch stats (students, courses, rating)
        // Option 1: stats collection
        try {
          const statsSnap = await getDocs(collection(db, "stats"));
          if (!statsSnap.empty) {
            const rawStats = statsSnap.docs[0].data();
            setStats({
              students: typeof rawStats.students === "number" ? rawStats.students : coursesData.reduce((a, c) => a + (c.students || 0), 0),
              courses: typeof rawStats.courses === "number" ? rawStats.courses : coursesData.length,
              rating: typeof rawStats.rating === "number" ? rawStats.rating : 4.9
            });
          } else {
            setStats({ students: coursesData.reduce((a, c) => a + (c.students || 0), 0), courses: coursesData.length, rating: 4.9 });
          }
        } catch {
          setStats({ students: coursesData.reduce((a, c) => a + (c.students || 0), 0), courses: coursesData.length, rating: 4.9 });
        }
        setError("");
      } catch (err) {
        setError("Failed to load data. Please try again later.");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const features = [
    {
      icon: <BookOpen className="h-8 w-8 text-blue-600" />,
      title: "Comprehensive Courses",
      description: "Learn from industry experts with hands-on projects and real-world applications."
    },
    {
      icon: <Users className="h-8 w-8 text-green-600" />,
      title: "Expert Instructors",
      description: "Learn from experienced professionals who are passionate about teaching."
    },
    {
      icon: <Award className="h-8 w-8 text-yellow-600" />,
      title: "Certifications",
      description: "Earn recognized certificates to boost your career and showcase your skills."
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-purple-600" />,
      title: "Track Progress",
      description: "Monitor your learning journey with detailed analytics and progress tracking."
    }
  ];

  // testimonials now come from Firestore

  return (
    <div className="min-h-screen">
      {loading && (
        <div className="py-20 text-center text-xl text-gray-600">Loading data...</div>
      )}
      {error && (
        <div className="py-20 text-center text-red-600">{error}</div>
      )}
      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center bg-gradient-to-br from-blue-600 via-purple-600 to-green-600">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-4xl mx-auto text-white">
          <h1 className="text-5xl font-bold mb-6">
            Empowering Digital Futures with AI-Powered Learning
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of learners worldwide in mastering the skills of tomorrow. 
            Learn at your pace with personalized AI guidance and expert instruction.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button 
              onClick={onGetStarted}
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg"
            >
              Get Started Free
            </Button>
            
            <Button
              onClick={handleVoiceCommand}
              variant="outline"
              size="lg"
              className="bg-transparent border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3 text-lg"
            >
              {isListening ? (
                <>
                  <MicOff className="h-5 w-5 mr-2" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  Try Voice Command
                </>
              )}
            </Button>

            <Button
              onClick={() => setShowQuestionnaire(true)}
              variant="outline"
              size="lg"
              className="bg-transparent border-white text-white hover:bg-white hover:text-green-600 px-8 py-3 text-lg"
            >
              Share Feedback
            </Button>
          </div>

          {voiceCommand && (
            <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-4">
              <p className="text-sm opacity-90">Last voice command: "{voiceCommand}"</p>
            </div>
          )}

          <div className="flex justify-center space-x-8 text-sm opacity-80">
            <div className="flex items-center">
              <Star className="h-4 w-4 mr-1" />
              {stats.rating}/5 Rating
            </div>
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {stats.students.toLocaleString()} Students
            </div>
            <div className="flex items-center">
              <Award className="h-4 w-4 mr-1" />
              {stats.courses} Courses
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose SgilaSkeem?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We combine cutting-edge AI technology with expert instruction to create 
              the most effective learning experience possible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Course Preview Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Popular Courses</h2>
            <p className="text-gray-600">Start your learning journey with our most popular courses</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {courses.map((course, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="aspect-video bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg mb-4 flex items-center justify-center">
                    <PlayCircle className="h-12 w-12 text-white" />
                  </div>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary">{course.category}</Badge>
                    <Badge variant="outline">{course.level}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{course.students?.toLocaleString() || "-"} students</span>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      {course.rating || "-"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">What Our Students Say</h2>
            <p className="text-gray-600">Join thousands of satisfied learners</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <div className="flex items-center space-x-1 mb-2">
                    {[...Array(testimonial.rating || 5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <CardDescription className="text-base italic">
                    "{testimonial.content}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Learning Journey?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join SgilaSkeem today and unlock your potential with AI-powered education
          </p>
          <Button 
            onClick={onGetStarted}
            size="lg"
            variant="secondary"
            className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg"
          >
            Start Learning Now
          </Button>
        </div>
      </section>

      {/* Feedback Questionnaire Modal */}
      <StandaloneQuestionnaireModal 
        isOpen={showQuestionnaire}
        onClose={() => setShowQuestionnaire(false)}
      />
    </div>
  );
};

export default Homepage;
