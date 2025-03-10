import { useState, useEffect } from "react";  // Add this line
import { useRouter } from "next/router";
import { auth, db, logout } from "../firebase";
import { ref, get, set, push, remove, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import styles from "../styles/Dashboard.module.css";

export default function StudentPage() {
  // User state and authentication
  const [user, setUser] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState(null);
  const [error, setError] = useState("");
  const router = useRouter();
  
  // School and student data
  const [schoolId, setSchoolId] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [assignedDegree, setAssignedDegree] = useState(null);
  const [degrees, setDegrees] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [coursesBySubject, setCoursesBySubject] = useState({});
  
  // UI state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompletedCourses, setShowCompletedCourses] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("all");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [degreeProgress, setDegreeProgress] = useState({
    totalCredits: 0,
    completedCredits: 0,
    requiredCredits: 0,
    subjectProgress: {}
  });
  const [addCourseModalOpen, setAddCourseModalOpen] = useState(false);
  const [currentCourseToAdd, setCurrentCourseToAdd] = useState(null);
  const [selectedAddGradeLevel, setSelectedAddGradeLevel] = useState("9");
  const [selectedAddStatus, setSelectedAddStatus] = useState("Planned");
  
  // Auto-hide notifications after 5 seconds
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  // Authentication check
  useEffect(() => {
    // Load dark mode preference
    const darkModePreference = localStorage.getItem('studentDarkMode') === 'true';
    setIsDarkMode(darkModePreference);
    if (darkModePreference) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        try {
          // Check if the user is an admin by checking the admin key in the database
          const adminRef = ref(db, "admin");
          const adminSnapshot = await get(adminRef);
          const isAdmin = adminSnapshot.exists() && adminSnapshot.val() === currentUser.email;
          
          if (isAdmin) {
            router.push("/admin"); // Redirect admin to admin page
            return;
          }
          
          // If not admin, check if user is already enrolled in a school
          const schoolsRef = ref(db, "schools");
          const snapshot = await get(schoolsRef);
          
          if (snapshot.exists()) {
            let foundSchool = null;
            let studentFound = false;
            
            // Look for the student in all schools
            for (const [key, school] of Object.entries(snapshot.val())) {
              if (school.students && school.students[currentUser.uid]) {
                studentFound = true;
                foundSchool = { id: key, ...school };
                
                setSchoolId(key);
                setSchoolName(school.name);
                setStudentData(school.students[currentUser.uid]);
                setIsEnrolled(true);
                
                // Load student's data
                await loadStudentData(key, currentUser.uid, school);
                break;
              }
            }
            
            if (!studentFound) {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } catch (error) {
          console.error("Error during authentication check:", error);
          setIsLoading(false);
          setNotification({
            message: "Failed to load user data. Please refresh the page.",
            type: "error"
          });
          setShowNotification(true);
        }
      } else {
        router.push("/auth");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Load all student data from firebase
  const loadStudentData = async (schoolId, studentId, schoolData) => {
    setIsLoading(true);
    try {
      // Load degrees
      const degreesRef = ref(db, `schools/${schoolId}/degrees`);
      const degreesSnapshot = await get(degreesRef);
      
      let degreeData = null;
      
      if (degreesSnapshot.exists()) {
        const degreesData = degreesSnapshot.val();
        setDegrees(Object.entries(degreesData).map(([key, value]) => ({
          id: key,
          ...value
        })));
        
        // Check if student has an assigned degree
        const studentRef = ref(db, `schools/${schoolId}/students/${studentId}`);
        const studentSnapshot = await get(studentRef);
        
        if (studentSnapshot.exists()) {
          const student = studentSnapshot.val();
          setStudentData(student);
          
          if (student.degree && degreesData[student.degree]) {
            degreeData = [student.degree, degreesData[student.degree]];
            setAssignedDegree(degreeData);
          }
        }
      }
      
      // Load courses
      const coursesRef = ref(db, `schools/${schoolId}/courses`);
      const coursesSnapshot = await get(coursesRef);
      
      let coursesData = [];
      if (coursesSnapshot.exists()) {
        coursesData = Object.entries(coursesSnapshot.val()).map(([key, value]) => ({
          id: key,
          ...value
        }));
        
        setAvailableCourses(coursesData);
        
        // Group courses by subject
        const bySubject = coursesData.reduce((acc, course) => {
          const subject = course.subject_type || "Other";
          if (!acc[subject]) acc[subject] = [];
          acc[subject].push(course);
          return acc;
        }, {});
        
        // Sort courses within each subject
        Object.keys(bySubject).forEach(subject => {
          bySubject[subject].sort((a, b) => a.course_name.localeCompare(b.course_name));
        });
        
        setCoursesBySubject(bySubject);
      }
      
      // Load student's courses
      const myCoursesRef = ref(db, `schools/${schoolId}/students/${studentId}/courses`);
      const myCoursesSnapshot = await get(myCoursesRef);
      
      let myCoursesData = [];
      if (myCoursesSnapshot.exists()) {
        myCoursesData = Object.entries(myCoursesSnapshot.val()).map(([key, value]) => ({
          id: key,
          ...value
        }));
        
        setMyCourses(myCoursesData);
      } else {
        setMyCourses([]);
      }
      
      // Calculate degree progress if student has an assigned degree
      if (degreeData) {
        calculateDegreeProgress(myCoursesData, degreeData[0], degreesSnapshot.val(), coursesData);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading student data:", error);
      setNotification({
        message: "Failed to load data. Please try again.",
        type: "error"
      });
      setShowNotification(true);
      setIsLoading(false);
    }
  };

  // Calculate degree progress
  const calculateDegreeProgress = (courses, degreeId, allDegrees, availableCoursesList) => {
    // Defensive checks to prevent errors
    if (!degreeId || !allDegrees || !allDegrees[degreeId] || !courses) {
      console.log("Insufficient data for degree progress calculation:", { 
        degreeId, 
        hasAllDegrees: !!allDegrees, 
        hasCourses: !!courses 
      });
      setDegreeProgress({
        totalCredits: 0,
        completedCredits: 0,
        requiredCredits: 0,
        subjectProgress: {}
      });
      return;
    }
      
    const degree = allDegrees[degreeId];
    const degreeSubjects = degree.subjects || [];
      
    // Initialize progress tracking
    const subjectProgress = {};
    let totalCompletedCredits = 0;
    let totalRequiredCredits = 0;
      
    // Get required credits for each subject
    degreeSubjects.forEach(subject => {
      subjectProgress[subject.name] = {
        required: parseInt(subject.requiredCredits) || 0,
        completed: 0,
        courses: []
      };
      totalRequiredCredits += parseInt(subject.requiredCredits) || 0;
    });
      
    // Add elective category for overflow credits
    subjectProgress["Electives"] = {
      required: 0,
      completed: 0,
      courses: []
    };
      
    // Count completed courses
    const completedCourses = courses.filter(course => course.status === "Completed");
      
    completedCourses.forEach(course => {
      const courseDetails = availableCoursesList.find(c => c.id === course.course_id);
        
      if (courseDetails) {
        const subject = courseDetails.subject_type;
        const credits = parseInt(courseDetails.credits) || 0;
          
        if (subjectProgress[subject]) {
          // Add credits to required subject
          const validCredits = Math.min(credits, subjectProgress[subject].required - subjectProgress[subject].completed);
          subjectProgress[subject].completed += validCredits;
          totalCompletedCredits += validCredits;
            
          // Handle overflow credits
          const overflow = credits - validCredits;
          if (overflow > 0) {
            subjectProgress["Electives"].completed += overflow;
            totalCompletedCredits += overflow;
          }
            
          subjectProgress[subject].courses.push(course);
        } else {
          // Subject not in degree requirements, add to electives
          subjectProgress["Electives"].completed += credits;
          totalCompletedCredits += credits;
          subjectProgress["Electives"].courses.push(course);
        }
      } else if (course.credits) {
        // If course is not in database but has credits field
        const credits = parseInt(course.credits) || 0;
        subjectProgress["Electives"].completed += credits;
        totalCompletedCredits += credits;
        subjectProgress["Electives"].courses.push(course);
      }
    });
      
    // Get the totalCredits value from the degree, or use the sum of required credits as a fallback
    const totalDegreeCredits = degree.totalCredits ? parseInt(degree.totalCredits) : totalRequiredCredits;
      
    console.log("Degree progress calculated:", {
      totalCredits: totalDegreeCredits,
      completedCredits: totalCompletedCredits,
      requiredCredits: totalRequiredCredits,
      subjectsCount: Object.keys(subjectProgress).length
    });
      
    setDegreeProgress({
      totalCredits: totalDegreeCredits,
      completedCredits: totalCompletedCredits,
      requiredCredits: totalRequiredCredits,
      subjectProgress
    });
  };

  // Handle joining a school
  const handleJoinSchool = async () => {
    if (!firstName || !lastName || !gradeLevel || !schoolCode) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      const schoolsRef = ref(db, "schools");
      const snapshot = await get(schoolsRef);
      let matchedSchool = null;

      if (snapshot.exists()) {
        const schools = snapshot.val();
        for (const [key, school] of Object.entries(schools)) {
          if (school.join_code === schoolCode) {
            matchedSchool = { id: key, ...school };
            break;
          }
        }

        if (matchedSchool) {
          const studentRef = ref(db, `schools/${matchedSchool.id}/students/${user.uid}`);
          const studentData = {
            first_name: firstName,
            last_name: lastName,
            email: user.email,
            grade_level: gradeLevel,
            joined_at: new Date().toISOString()
          };
          
          await set(studentRef, studentData);
          setStudentData(studentData);
          setSchoolId(matchedSchool.id);
          setSchoolName(matchedSchool.name);
          setIsEnrolled(true);
          
          // Load all school data
          await loadStudentData(matchedSchool.id, user.uid, matchedSchool);
          
          setNotification({
            message: `Successfully joined ${matchedSchool.name}!`,
            type: "success"
          });
          setShowNotification(true);
        } else {
          setError("Invalid school code. Please try again.");
          setIsLoading(false);
        }
      } else {
        setError("No schools found.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error joining school:", error);
      setError("An error occurred while joining the school.");
      setIsLoading(false);
    }
  };
  
  // Add a course to student's plan - Only allow Planned status
  const addCourse = async (course, gradeLevel = "9") => {
    try {
      // Check if course is already in student's plan
      const existingCourse = myCourses.find(c => c.course_id === course.id);
      if (existingCourse) {
        setNotification({
          message: `${course.course_name} is already in your course plan.`,
          type: "error"
        });
        setShowNotification(true);
        setAddCourseModalOpen(false);
        return;
      }
      
      const courseRef = push(ref(db, `schools/${schoolId}/students/${user.uid}/courses`));
      const courseData = {
        course_id: course.id,
        name: course.course_name,
        subject: course.subject_type,
        credits: course.credits,
        grade: gradeLevel, 
        status: "Planned", // Force status to be "Planned"
        added_at: new Date().toISOString()
      };
      
      await set(courseRef, courseData);
      
      // Update local state
      const newCourseEntry = { id: courseRef.key, ...courseData };
      setMyCourses(prevCourses => [...prevCourses, newCourseEntry]);
      
      setNotification({
        message: `Added ${course.course_name} to your planned courses!`,
        type: "success"
      });
      setShowNotification(true);
      
      // Close the modal if open
      setAddCourseModalOpen(false);
      
      // Recalculate degree progress if needed
      if (assignedDegree) {
        const updatedCourses = [...myCourses, newCourseEntry];
        calculateDegreeProgress(updatedCourses, assignedDegree[0], degrees.reduce((acc, degree) => {
          acc[degree.id] = degree;
          return acc;
        }, {}), availableCourses);
      }
    } catch (error) {
      console.error("Error adding course:", error);
      setNotification({
        message: "Failed to add course. Please try again.",
        type: "error"
      });
      setShowNotification(true);
    }
  };
  
  // Update course status - only allow changes to Planned courses
  const updateCourseStatus = async (courseId, newStatus) => {
    // Find the course
    const courseToUpdate = myCourses.find(course => course.id === courseId);
    
    // Only allow updating status if the course is currently "Planned"
    // This prevents students from modifying courses that were set by the counselor
    if (!courseToUpdate || courseToUpdate.status !== "Planned") {
      setNotification({
        message: "You can only modify your planned courses.",
        type: "error"
      });
      setShowNotification(true);
      return;
    }
    
    // Only allow changing to "Planned" or "In Progress"
    if (newStatus !== "Planned" && newStatus !== "In Progress") {
      setNotification({
        message: "You can only set courses to Planned or In Progress. Your counselor must mark courses as Completed.",
        type: "error"
      });
      setShowNotification(true);
      return;
    }
    
    try {
      await update(ref(db, `schools/${schoolId}/students/${user.uid}/courses/${courseId}`), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      
      // Update local state
      const updatedCourses = myCourses.map(course => 
        course.id === courseId ? { ...course, status: newStatus } : course
      );
      
      setMyCourses(updatedCourses);
      
      setNotification({
        message: `Course status updated to ${newStatus}!`,
        type: "success"
      });
      setShowNotification(true);
      
      // Recalculate degree progress
      if (assignedDegree) {
        calculateDegreeProgress(updatedCourses, assignedDegree[0], degrees.reduce((acc, degree) => {
          acc[degree.id] = degree;
          return acc;
        }, {}), availableCourses);
      }
    } catch (error) {
      console.error("Error updating course status:", error);
      setNotification({
        message: "Failed to update course status. Please try again.",
        type: "error"
      });
      setShowNotification(true);
    }
  };
  
  // Remove course from student's plan - only allow removing Planned courses
  const removeCourse = async (courseId) => {
    // Find the course
    const courseToRemove = myCourses.find(course => course.id === courseId);
    
    // Only allow removing if the course is currently "Planned"
    if (!courseToRemove || courseToRemove.status !== "Planned") {
      setNotification({
        message: "You can only remove your planned courses.",
        type: "error"
      });
      setShowNotification(true);
      return;
    }
    
    if (!confirm("Are you sure you want to remove this course from your plan?")) {
      return;
    }
    
    try {
      await remove(ref(db, `schools/${schoolId}/students/${user.uid}/courses/${courseId}`));
      
      // Update local state
      const updatedCourses = myCourses.filter(course => course.id !== courseId);
      setMyCourses(updatedCourses);
      
      setNotification({
        message: "Course removed from your plan!",
        type: "success"
      });
      setShowNotification(true);
      
      // Recalculate degree progress
      if (assignedDegree) {
        calculateDegreeProgress(updatedCourses, assignedDegree[0], degrees.reduce((acc, degree) => {
          acc[degree.id] = degree;
          return acc;
        }, {}), availableCourses);
      }
    } catch (error) {
      console.error("Error removing course:", error);
      setNotification({
        message: "Failed to remove course. Please try again.",
        type: "error"
      });
      setShowNotification(true);
    }
  };
  
  // Open modal to add a course
  const openAddCourseModal = (course) => {
    setCurrentCourseToAdd(course);
    setAddCourseModalOpen(true);
    // Always set status to Planned since that's all students can add
    setSelectedAddStatus("Planned");
  };
  
  // Get course details by ID
  const getCourseDetails = (courseId) => {
    return availableCourses.find(course => course.id === courseId) || null;
  };
  
  // Filter courses by search term and subject
  const getFilteredCourses = () => {
    let filtered = [...availableCourses];
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(course => 
        course.course_name.toLowerCase().includes(search) ||
        (course.description && course.description.toLowerCase().includes(search)) ||
        (course.subject_type && course.subject_type.toLowerCase().includes(search))
      );
    }
    
    if (selectedSubject) {
      filtered = filtered.filter(course => course.subject_type === selectedSubject);
    }
    
    return filtered;
  };
  
  // Get student courses filtered by grade level and status
  const getFilteredStudentCourses = () => {
    let filtered = [...myCourses];
    
    if (selectedGradeLevel !== "all") {
      filtered = filtered.filter(course => course.grade === selectedGradeLevel);
    }
    
    if (!showCompletedCourses) {
      filtered = filtered.filter(course => course.status !== "Completed");
    }
    
    return filtered;
  };
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('studentDarkMode', newMode);
    
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  // Calculate progress percentage for progress bars
  const calculateProgressPercentage = (completed, required) => {
    if (required <= 0) return 0;
    const percentage = (completed / required) * 100;
    return Math.min(percentage, 100); // Cap at 100%
  };
  
  // Calculate total credits for a grade level
  const calculateGradeLevelCredits = (grade) => {
    const gradeLevelCourses = myCourses.filter(course => course.grade === grade);
    return gradeLevelCourses.reduce((total, course) => total + parseInt(course.credits || 0), 0);
  };
  
  // Check prerequisites for a course
  const checkPrerequisites = (course) => {
    if (!course.prerequisites || course.prerequisites.length === 0) {
      return { met: true, missingCourses: [] };
    }
    
    const completedCourseIds = myCourses
      .filter(c => c.status === "Completed")
      .map(c => c.course_id);
    
    const missingPrereqs = course.prerequisites.filter(
      prereqId => !completedCourseIds.includes(prereqId)
    );
    
    return {
      met: missingPrereqs.length === 0,
      missingCourses: missingPrereqs.map(id => getCourseDetails(id)).filter(Boolean)
    };
  };
  
  // Get recommended courses based on missing requirements
  const getRecommendedCourses = () => {
    if (!assignedDegree) return [];
    
    const recommendations = [];
    
    // Find subjects where requirements aren't met
    Object.entries(degreeProgress.subjectProgress)
      .filter(([subject, progress]) => 
        subject !== "Electives" && progress.completed < progress.required
      )
      .forEach(([subject, progress]) => {
        // Get available courses for this subject that aren't already in student's plan
        const subjectCourses = coursesBySubject[subject] || [];
        const myCourseIds = myCourses.map(c => c.course_id);
        
        const availableSubjectCourses = subjectCourses
          .filter(course => !myCourseIds.includes(course.id))
          .slice(0, 2); // Limit to 2 recommendations per subject
        
        recommendations.push(...availableSubjectCourses.map(course => ({
          ...course,
          reason: `Helps fulfill ${subject} requirement (${progress.completed}/${progress.required} credits completed)`
        })));
      });
    
    // Sort by credits needed and limit total recommendations
    return recommendations
      .sort((a, b) => parseInt(b.credits) - parseInt(a.credits))
      .slice(0, 6);
  };

  // Helper function to check if a course can be modified by the student
  const canModifyCourse = (course) => {
    return course.status === "Planned";
  };

  // Reload degree progress manually
  const refreshDegreeProgress = () => {
    if (assignedDegree) {
      calculateDegreeProgress(
        myCourses, 
        assignedDegree[0], 
        degrees.reduce((acc, degree) => {
          acc[degree.id] = degree;
          return acc;
        }, {}), 
        availableCourses
      );
    }
  };

  return (
    <div className={`${styles.eduDashboardContainer} ${isDarkMode ? styles.dark : styles.light}`}>
      {/* Notification */}
      {showNotification && (
        <div className={`${styles.eduNotification} ${styles[notification.type]} ${isDarkMode ? styles.dark : styles.light}`}>
          <div className={styles.eduNotificationContent}>
            <p className={`${styles.eduNotificationMessage} ${styles[notification.type]}`}>{notification.message}</p>
            <button
              onClick={() => setShowNotification(false)}
              className={`${styles.eduNotificationClose} ${isDarkMode ? styles.dark : styles.light}`}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}
        
      {/* Loading overlay */}
      {isLoading && (
        <div className={styles.eduLoadingOverlay}>
          <div className={`${styles.eduLoadingCard} ${isDarkMode ? styles.dark : styles.light}`}>
            <div className={`${styles.eduLoadingSpinner} ${isDarkMode ? styles.dark : styles.light}`}></div>
            <p className={styles.eduLoadingMessage}>Loading your educational journey...</p>
            <p className={styles.eduLoadingSubMessage}>Please wait while we prepare your dashboard.</p>
          </div>
        </div>
      )}
        
      {/* Add Course Modal */}
      {addCourseModalOpen && currentCourseToAdd && (
        <div className={styles.eduModalOverlay}>
          <div className={`${styles.eduModalCard} ${isDarkMode ? styles.dark : styles.light}`}>
            <div className={`${styles.eduModalHeader} ${isDarkMode ? styles.dark : styles.light}`}>
              <h3 className={styles.eduModalTitle}>
                <span className={`${styles.eduModalIcon} ${isDarkMode ? styles.dark : styles.light}`}>📝</span>
                Add Course to Your Plan
              </h3>
              <button
                onClick={() => setAddCourseModalOpen(false)}
                className={`${styles.eduModalClose} ${isDarkMode ? styles.dark : styles.light}`}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            
            <div>
              <p className="font-medium text-lg mb-4">{currentCourseToAdd.course_name} ({currentCourseToAdd.credits} credits)</p>
              
              <div className="space-y-4">
                <div>
                  <label className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                    Grade Level
                  </label>
                  <select
                    value={selectedAddGradeLevel}
                    onChange={(e) => setSelectedAddGradeLevel(e.target.value)}
                    className={`${styles.eduFormSelect} ${isDarkMode ? styles.dark : styles.light} w-full`}
                  >
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>
                
                <div>
                  <p className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light}`}>Status</p>
                  <p className={`${styles.eduFormInput} ${isDarkMode ? styles.dark : styles.light} flex items-center bg-opacity-50`}>
                    <span className="mr-2 text-blue-500">🔹</span>
                    Planned (All new courses are added as planned)
                  </p>
                </div>
                
                {currentCourseToAdd.prerequisites && currentCourseToAdd.prerequisites.length > 0 && (
                  <div className={`mt-4 p-4 rounded-lg ${isDarkMode ? 'bg-amber-900 bg-opacity-30 border border-amber-800 text-amber-200' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                    <p className="font-medium flex items-center">
                      <span className="mr-2">⚠️</span>
                      This course has prerequisites:
                    </p>
                    <ul className="list-disc list-inside text-sm mt-2 space-y-1 ml-4">
                      {currentCourseToAdd.prerequisites.map(prereqId => {
                        const prereq = getCourseDetails(prereqId);
                        return prereq ? (
                          <li key={prereqId}>{prereq.course_name}</li>
                        ) : null;
                      })}
                    </ul>
                    <p className="text-sm mt-3 italic">
                      Note: Your counselor will verify prerequisites before approving this course.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className={styles.eduModalActions}>
              <button
                onClick={() => setAddCourseModalOpen(false)}
                className={`${styles.eduModalCancel} ${isDarkMode ? styles.dark : styles.light}`}
              >
                Cancel
              </button>
              <button
                onClick={() => addCourse(currentCourseToAdd, selectedAddGradeLevel)}
                className={`${styles.eduModalConfirm} ${styles.primary}`}
              >
                Add to Plan
              </button>
            </div>
          </div>
        </div>
      )}
        
      {/* Course Details Modal */}
      {selectedCourse && (
        <div className={styles.eduModalOverlay}>
          <div className={`${styles.eduModalCard} ${isDarkMode ? styles.dark : styles.light}`}>
            <div className={`${styles.eduModalHeader} ${isDarkMode ? styles.dark : styles.light}`}>
              <h3 className={styles.eduModalTitle}>
                <span className={`${styles.eduModalIcon} ${isDarkMode ? styles.dark : styles.light}`}>📚</span>
                {selectedCourse.course_name}
              </h3>
              <button
                onClick={() => setSelectedCourse(null)}
                className={`${styles.eduModalClose} ${isDarkMode ? styles.dark : styles.light}`}
                aria-label="Close details"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800 bg-opacity-50' : 'bg-blue-50'}`}>
                <p className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light} mb-1`}>Subject</p>
                <p className="font-medium">{selectedCourse.subject_type}</p>
              </div>
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800 bg-opacity-50' : 'bg-blue-50'}`}>
                <p className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light} mb-1`}>Credits</p>
                <p className="font-medium">{selectedCourse.credits}</p>
              </div>
            </div>
            
            {selectedCourse.description && (
              <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800 bg-opacity-30' : 'bg-indigo-50'}`}>
                <p className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light} mb-1`}>Description</p>
                <p className="text-sm leading-relaxed">{selectedCourse.description}</p>
              </div>
            )}
            
            {selectedCourse.prerequisites && selectedCourse.prerequisites.length > 0 && (
              <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-amber-900 bg-opacity-20 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light} mb-2 flex items-center`}>
                  <span className="mr-2">⚠️</span>
                  Prerequisites
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                  {selectedCourse.prerequisites.map(prereqId => {
                    const prereq = getCourseDetails(prereqId);
                    return prereq ? (
                      <li key={prereqId}>{prereq.course_name}</li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}
            
            <div className={styles.eduModalActions}>
              <button
                onClick={() => setSelectedCourse(null)}
                className={`${styles.eduModalCancel} ${isDarkMode ? styles.dark : styles.light}`}
              >
                Close
              </button>
              <button
                onClick={() => {
                  openAddCourseModal(selectedCourse);
                  setSelectedCourse(null);
                }}
                className={`${styles.eduModalConfirm} ${styles.primary}`}
                disabled={myCourses.some(c => c.course_id === selectedCourse.id)}
              >
                {myCourses.some(c => c.course_id === selectedCourse.id) ? "Already in Your Plan" : "Add to Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
        
      {user ? (
        <>
          {!isEnrolled ? (
            // School enrollment form
            <div className={styles.eduEnrollmentContainer}>
              <div className={`${styles.eduEnrollmentCard} ${isDarkMode ? styles.dark : styles.light}`}>
                <h1 className={styles.eduWelcomeTitle}>
                  <span>Welcome to EduPlan</span>
                </h1>
                <p className={styles.eduWelcomeMessage}>
                  Please enter your details to join your school's academic planning platform.
                </p>

                <div className="space-y-4 mt-8">
                  <div className={styles.eduFormGroup}>
                    <label className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light}`}>First Name</label>
                    <input
                      type="text"
                      placeholder="Your first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`${styles.eduFormInput} ${isDarkMode ? styles.dark : styles.light}`}
                    />
                  </div>
                  
                  <div className={styles.eduFormGroup}>
                    <label className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light}`}>Last Name</label>
                    <input
                      type="text"
                      placeholder="Your last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`${styles.eduFormInput} ${isDarkMode ? styles.dark : styles.light}`}
                    />
                  </div>
                  
                  <div className={styles.eduFormGroup}>
                    <label className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light}`}>Grade Level</label>
                    <select
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                      className={`${styles.eduFormSelect} ${isDarkMode ? styles.dark : styles.light}`}
                    >
                      <option value="">Select Your Grade</option>
                      <option value="9">9th Grade</option>
                      <option value="10">10th Grade</option>
                      <option value="11">11th Grade</option>
                      <option value="12">12th Grade</option>
                    </select>
                  </div>
                  
                  <div className={styles.eduFormGroup}>
                    <label className={`${styles.eduFormLabel} ${isDarkMode ? styles.dark : styles.light}`}>School Code</label>
                    <input
                      type="text"
                      placeholder="Enter the code provided by your school"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      className={`${styles.eduFormInput} ${isDarkMode ? styles.dark : styles.light}`}
                    />
                  </div>
                </div>

                {error && (
                  <div className={`${styles.eduErrorMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                    {error}
                  </div>
                )}

                <div className={styles.eduFormActions}>
                  <button
                    onClick={handleJoinSchool}
                    className={`${styles.eduJoinButton} ${isDarkMode ? styles.dark : styles.light}`}
                  >
                    <span>🚀</span>
                    Join School
                  </button>
                  
                  <button 
                    onClick={toggleDarkMode}
                    className={`${styles.eduDarkModeToggle} ${isDarkMode ? styles.dark : styles.light}`}
                    aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {isDarkMode ? "☀️" : "🌙"}
                  </button>
                  
                  <button 
                    onClick={() => logout(router)} 
                    className={`${styles.eduLogoutButton} ${isDarkMode ? styles.dark : styles.light}`}
                  >
                    <span>🚪</span>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Student Dashboard
            <div className={styles.eduDashboardWrapper}>
              {/* Header */}
              <header className={`${styles.eduHeaderSection} ${isDarkMode ? styles.dark : styles.light}`}>
  <div className={styles.eduHeaderContent}>
    <div className={styles.eduSchoolInfo}>
      <h1>
        <span>{schoolName}</span>
        <span className={`ml-4 text-sm font-normal ${isDarkMode ? 'text-blue-300' : 'text-blue-600'} bg-blue-100 bg-opacity-30 px-3 py-1 rounded-full`}>
          Student Portal
        </span>
                    </h1>
                    <p className="flex items-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 ${isDarkMode ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-600'}`}>
                        👋
                      </span>
                      Welcome, {studentData?.first_name} {studentData?.last_name}
                    </p>
                  </div>
                  
                  <div className={styles.eduUserActions}>
                    <button 
                      onClick={toggleDarkMode}
                      className={`${styles.eduDarkModeToggle} ${isDarkMode ? styles.dark : styles.light}`}
                      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    >
                      {isDarkMode ? "☀️" : "🌙"}
                    </button>
                    
                    <button 
                      onClick={() => logout(router)} 
                      className={`${styles.eduLogoutButton} ${isDarkMode ? styles.dark : styles.light}`}
                    >
                      <span>🚪</span>
                      Logout
                    </button>
                  </div>
                </div>
                
                {/* Navigation Tabs */}
                <div className={styles.eduTabNavigation}>
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className={`${styles.eduTabButton} ${activeTab === "dashboard" ? styles.active : ""} ${isDarkMode ? styles.dark : styles.light}`}
                  >
                    <span className={styles.eduTabIcon}>📊</span>
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab("myCourses")}
                    className={`${styles.eduTabButton} ${activeTab === "myCourses" ? styles.active : ""} ${isDarkMode ? styles.dark : styles.light}`}
                  >
                    <span className={styles.eduTabIcon}>📚</span>
                    My Courses
                  </button>
                  <button
                    onClick={() => setActiveTab("browseCourses")}
                    className={`${styles.eduTabButton} ${activeTab === "browseCourses" ? styles.active : ""} ${isDarkMode ? styles.dark : styles.light}`}
                  >
                    <span className={styles.eduTabIcon}>🔍</span>
                    Browse Courses
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("degreeProgress");
                      // Ensure degree progress is up to date when switching to this tab
                      refreshDegreeProgress();
                    }}
                    className={`${styles.eduTabButton} ${activeTab === "degreeProgress" ? styles.active : ""} ${isDarkMode ? styles.dark : styles.light}`}
                  >
                    <span className={styles.eduTabIcon}>🎓</span>
                    Degree Progress
                  </button>
                </div>
              </header>
              
              {/* Main Content Area */}
              <main>
                {/* Dashboard Tab */}
                {activeTab === "dashboard" && (
                  <div className={styles.eduDashboardGrid}>
                    {/* Student Info Card */}
                    <div className={`${styles.eduCard} ${styles.eduStudentInfoCard} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={styles.eduCardHeaderRow}>
                        <h2 className={styles.eduCardTitle}>
                          <span className={`${styles.eduCardIcon} ${styles.info} ${isDarkMode ? styles.dark : styles.light}`}>👤</span>
                          Student Profile
                        </h2>
                      </div>
                      <div className={styles.eduStudentInfoList}>
                        <div className={styles.eduStudentInfoItem}>
                          <span className={styles.eduStudentInfoLabel}>Name:</span>
                          <span className={styles.eduStudentInfoValue}>{studentData?.first_name} {studentData?.last_name}</span>
                        </div>
                        <div className={styles.eduStudentInfoItem}>
                          <span className={styles.eduStudentInfoLabel}>Email:</span>
                          <span className={styles.eduStudentInfoValue}>{studentData?.email}</span>
                        </div>
                        <div className={styles.eduStudentInfoItem}>
                          <span className={styles.eduStudentInfoLabel}>Grade Level:</span>
                          <span className={styles.eduStudentInfoValue}>{studentData?.grade_level}</span>
                        </div>
                        <div className={styles.eduStudentInfoItem}>
                          <span className={styles.eduStudentInfoLabel}>School:</span>
                          <span className={styles.eduStudentInfoValue}>{schoolName}</span>
                        </div>
                        {assignedDegree ? (
                          <div className={styles.eduStudentInfoItem}>
                            <span className={styles.eduStudentInfoLabel}>Assigned Degree:</span>
                            <span className={`${styles.eduStudentInfoValue} ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{assignedDegree[1].name || assignedDegree[0]}</span>
                          </div>
                        ) : (
                          <div className={`${styles.eduNoAssignedDegree} ${isDarkMode ? styles.dark : styles.light}`}>
                            <span>📝</span> No degree assigned yet
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress Summary */}
                    <div className={`${styles.eduCard} ${styles.eduProgressCard} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={styles.eduCardHeaderRow}>
                        <h2 className={styles.eduCardTitle}>
                          <span className={`${styles.eduCardIcon} ${styles.success} ${isDarkMode ? styles.dark : styles.light}`}>📈</span>
                          Course Progress
                        </h2>
                      </div>
                      <div className={styles.eduProgressSection}>
                        <div className={styles.eduProgressRow}>
                          <span className={styles.eduProgressLabel}>Total Courses</span>
                          <span className={styles.eduProgressValue}>{myCourses.length}</span>
                        </div>
                        <div className={`${styles.eduProgressBarContainer} ${isDarkMode ? styles.dark : styles.light}`}>
                          <div className={styles.eduMultiProgressBar}>
                            <div 
                              className={`${styles.eduProgressSegment} ${styles.completed}`}
                              style={{ width: `${(myCourses.filter(c => c.status === "Completed").length / Math.max(1, myCourses.length)) * 100}%` }}
                            ></div>
                            <div 
                              className={`${styles.eduProgressSegment} ${styles.inProgress}`}
                              style={{ width: `${(myCourses.filter(c => c.status === "In Progress").length / Math.max(1, myCourses.length)) * 100}%` }}
                            ></div>
                            <div 
                              className={`${styles.eduProgressSegment} ${styles.planned}`}
                              style={{ width: `${(myCourses.filter(c => c.status === "Planned").length / Math.max(1, myCourses.length)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className={styles.eduProgressLegend}>
                          <div className={styles.eduProgressLegendItem}>
                            <div className={`${styles.eduProgressLegendColor} ${styles.completed}`}></div>
                            <span>{myCourses.filter(c => c.status === "Completed").length} Completed</span>
                          </div>
                          <div className={styles.eduProgressLegendItem}>
                            <div className={`${styles.eduProgressLegendColor} ${styles.inProgress}`}></div>
                            <span>{myCourses.filter(c => c.status === "In Progress").length} In Progress</span>
                          </div>
                          <div className={styles.eduProgressLegendItem}>
                            <div className={`${styles.eduProgressLegendColor} ${styles.planned}`}></div>
                            <span>{myCourses.filter(c => c.status === "Planned").length} Planned</span>
                          </div>
                        </div>
                      </div>
                      
                      {assignedDegree && (
                        <div className={styles.eduProgressSection}>
                          <div className={styles.eduProgressRow}>
                            <span className={styles.eduProgressLabel}>Credit Progress</span>
                            <span className={`${styles.eduProgressValue} ${isDarkMode ? styles.dark : styles.light}`}>
                              {degreeProgress.completedCredits} / {degreeProgress.totalCredits}
                            </span>
                          </div>
                          <div className={`${styles.eduProgressBarContainer} ${isDarkMode ? styles.dark : styles.light}`}>
                            <div 
                              className={`${styles.eduProgressSegment} ${styles.inProgress}`}
                              style={{ width: `${calculateProgressPercentage(degreeProgress.completedCredits, degreeProgress.totalCredits)}%` }}
                            ></div>
                          </div>
                          <p className={`${styles.eduProgressPercentage} ${isDarkMode ? styles.dark : styles.light}`}>
                            {Math.round(calculateProgressPercentage(degreeProgress.completedCredits, degreeProgress.totalCredits))}% complete
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className={`${styles.eduCard} ${styles.eduActionsCard} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={styles.eduCardHeaderRow}>
                        <h2 className={styles.eduCardTitle}>
                          <span className={`${styles.eduCardIcon} ${styles.warning} ${isDarkMode ? styles.dark : styles.light}`}>⚡</span>
                          Quick Actions
                        </h2>
                      </div>
                      <div className={styles.eduActionList}>
                        <button
                          onClick={() => setActiveTab("browseCourses")}
                          className={`${styles.eduActionButton} ${styles.primary} ${isDarkMode ? styles.dark : styles.light}`}
                        >
                          <span>🔍</span>
                          Browse Available Courses
                        </button>
                        <button
                          onClick={() => setActiveTab("myCourses")}
                          className={`${styles.eduActionButton} ${styles.success} ${isDarkMode ? styles.dark : styles.light}`}
                        >
                          <span>📚</span>
                          View My Course Plan
                        </button>
                        {assignedDegree ? (
                          <button
                            onClick={() => {
                              setActiveTab("degreeProgress");
                              refreshDegreeProgress();
                            }}
                            className={`${styles.eduActionButton} ${styles.secondary} ${isDarkMode ? styles.dark : styles.light}`}
                          >
                            <span>🎓</span>
                            Check Degree Progress
                          </button>
                        ) : (
                          <div className={`${styles.eduNoAssignedDegree} ${isDarkMode ? styles.dark : styles.light}`}>
                            <span>📝</span>
                            No degree assigned yet. Your counselor will assign one.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Grade Level Overview */}
                    <div className={`${styles.eduCard} ${styles.eduOverviewCard} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={styles.eduCardHeaderRow}>
                        <h2 className={styles.eduCardTitle}>
                          <span className={`${styles.eduCardIcon} ${styles.info} ${isDarkMode ? styles.dark : styles.light}`}>📚</span>
                          Grade Level Course Overview
                        </h2>
                      </div>
                      <div className={styles.eduLevelGrid}>
                        <div className={`${styles.eduLevelCard} ${isDarkMode ? styles.dark : styles.light}`}>
                          <div className={`${styles.eduLevelHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                            <h3 className={styles.eduLevelTitle}>
                              Grade 9
                            </h3>
                            <p className={`${styles.eduLevelStats} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {myCourses.filter(c => c.grade === '9').length} courses | {calculateGradeLevelCredits('9')} credits
                            </p>
                          </div>
                          <div className={`${styles.eduCourseList} ${isDarkMode ? styles.dark : styles.light}`}>
                            {myCourses.filter(c => c.grade === '9').map(course => (
                              <div key={course.id} className={`${styles.eduCourseItem} ${isDarkMode ? styles.dark : styles.light}`}>
                                <span className={styles.eduCourseName}>{course.name}</span>
                                <span className={`${styles.eduCourseStatus} ${styles[course.status.toLowerCase()]} ${isDarkMode ? styles.dark : styles.light}`}>
                                  {course.status}
                                </span>
                              </div>
                            ))}
                            {myCourses.filter(c => c.grade === '9').length === 0 && (
                              <p className={`${styles.eduEmptyMessage} ${isDarkMode ? styles.dark : styles.light}`}>No courses planned for Grade 9</p>
                            )}
                          </div>
                        </div>
                        
                        <div className={`${styles.eduLevelCard} ${isDarkMode ? styles.dark : styles.light}`}>
                          <div className={`${styles.eduLevelHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                            <h3 className={styles.eduLevelTitle}>
                              Grade 10
                            </h3>
                            <p className={`${styles.eduLevelStats} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {myCourses.filter(c => c.grade === '10').length} courses | {calculateGradeLevelCredits('10')} credits
                            </p>
                          </div>
                          <div className={`${styles.eduCourseList} ${isDarkMode ? styles.dark : styles.light}`}>
                            {myCourses.filter(c => c.grade === '10').map(course => (
                              <div key={course.id} className={`${styles.eduCourseItem} ${isDarkMode ? styles.dark : styles.light}`}>
                                <span className={styles.eduCourseName}>{course.name}</span>
                                <span className={`${styles.eduCourseStatus} ${styles[course.status.toLowerCase()]} ${isDarkMode ? styles.dark : styles.light}`}>
                                  {course.status}
                                </span>
                              </div>
                            ))}
                            {myCourses.filter(c => c.grade === '10').length === 0 && (
                              <p className={`${styles.eduEmptyMessage} ${isDarkMode ? styles.dark : styles.light}`}>No courses planned for Grade 10</p>
                            )}
                          </div>
                        </div>
                        
                        <div className={`${styles.eduLevelCard} ${isDarkMode ? styles.dark : styles.light}`}>
                          <div className={`${styles.eduLevelHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                            <h3 className={styles.eduLevelTitle}>
                              Grade 11
                            </h3>
                            <p className={`${styles.eduLevelStats} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {myCourses.filter(c => c.grade === '11').length} courses | {calculateGradeLevelCredits('11')} credits
                            </p>
                          </div>
                          <div className={`${styles.eduCourseList} ${isDarkMode ? styles.dark : styles.light}`}>
                            {myCourses.filter(c => c.grade === '11').map(course => (
                              <div key={course.id} className={`${styles.eduCourseItem} ${isDarkMode ? styles.dark : styles.light}`}>
                                <span className={styles.eduCourseName}>{course.name}</span>
                                <span className={`${styles.eduCourseStatus} ${styles[course.status.toLowerCase()]} ${isDarkMode ? styles.dark : styles.light}`}>
                                  {course.status}
                                </span>
                              </div>
                            ))}
                            {myCourses.filter(c => c.grade === '11').length === 0 && (
                              <p className={`${styles.eduEmptyMessage} ${isDarkMode ? styles.dark : styles.light}`}>No courses planned for Grade 11</p>
                            )}
                          </div>
                        </div>
                        
                        <div className={`${styles.eduLevelCard} ${isDarkMode ? styles.dark : styles.light}`}>
                          <div className={`${styles.eduLevelHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                            <h3 className={styles.eduLevelTitle}>
                              Grade 12
                            </h3>
                            <p className={`${styles.eduLevelStats} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {myCourses.filter(c => c.grade === '12').length} courses | {calculateGradeLevelCredits('12')} credits
                            </p>
                          </div>
                          <div className={`${styles.eduCourseList} ${isDarkMode ? styles.dark : styles.light}`}>
                            {myCourses.filter(c => c.grade === '12').map(course => (
                              <div key={course.id} className={`${styles.eduCourseItem} ${isDarkMode ? styles.dark : styles.light}`}>
                                <span className={styles.eduCourseName}>{course.name}</span>
                                <span className={`${styles.eduCourseStatus} ${styles[course.status.toLowerCase()]} ${isDarkMode ? styles.dark : styles.light}`}>
                                  {course.status}
                                </span>
                              </div>
                            ))}
                            {myCourses.filter(c => c.grade === '12').length === 0 && (
                              <p className={`${styles.eduEmptyMessage} ${isDarkMode ? styles.dark : styles.light}`}>No courses planned for Grade 12</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* My Courses Tab */}
                {activeTab === "myCourses" && (
                  <div className={styles.eduDashboardGrid}>
                    <div className={`${styles.eduCard} ${styles.eduOverviewCard} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={styles.eduCardHeaderRow}>
                        <h2 className={styles.eduCardTitle}>
                          <span className={`${styles.eduCardIcon} ${styles.success} ${isDarkMode ? styles.dark : styles.light}`}>📚</span>
                          My Course Plan
                        </h2>
                        <div className="flex gap-3">
                          <select
                            value={selectedGradeLevel}
                            onChange={(e) => setSelectedGradeLevel(e.target.value)}
                            className={`${styles.eduFormSelect} ${isDarkMode ? styles.dark : styles.light} text-sm`}
                          >
                            <option value="all">All Grade Levels</option>
                            <option value="9">Grade 9</option>
                            <option value="10">Grade 10</option>
                            <option value="11">Grade 11</option>
                            <option value="12">Grade 12</option>
                          </select>
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="showCompleted"
                              checked={showCompletedCourses}
                              onChange={() => setShowCompletedCourses(!showCompletedCourses)}
                              className={`mr-2 rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                            />
                            <label htmlFor="showCompleted" className="text-sm font-medium">Show completed</label>
                          </div>
                        </div>
                      </div>
                      
                      {getFilteredStudentCourses().length === 0 ? (
                        <div className={`${styles.eduEmptyCoursesMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                          <p className="text-lg text-center font-medium mb-6">No courses in your plan yet.</p>
                          <button
                            onClick={() => setActiveTab("browseCourses")}
                            className={`${styles.eduBrowseButton} ${isDarkMode ? styles.dark : styles.light}`}
                          >
                            Browse Available Courses
                          </button>
                        </div>
                      ) : (
                        <div className={styles.eduCourseListContainer}>
                          {getFilteredStudentCourses().map(course => {
                            const courseDetails = getCourseDetails(course.course_id);
                            const isEditable = canModifyCourse(course);
                            
                            return (
                              <div 
                                key={course.id} 
                                className={`${styles.eduStudentCourseCard} ${isDarkMode ? styles.dark : styles.light}`}
                              >
                                <div className={styles.eduStudentCourseContent}>
                                  {/* Course Header with Grade */}
                                  <div className={styles.eduStudentCourseHeader}>
                                    <span className={`${styles.eduStudentGradeBadge} ${isDarkMode ? styles.dark : styles.light}`}>
                                      {course.grade}
                                    </span>
                                    <h3 className={`${styles.eduStudentCourseName} ${isDarkMode ? styles.dark : styles.light}`}>{course.name}</h3>
                                  </div>
                                  
                                  {/* Course Status */}
                                  <div className={styles.eduStudentCourseStatusContainer}>
                                  <span className={`${styles.eduStudentStatusBadge} ${
  course.status === "Completed" ? styles.completed :
  course.status === "In Progress" ? styles.inProgress :
  course.status === "Failed" ? styles.failed : 
  styles.planned
}`}>
  <span className={styles.eduBadgeIcon}>
    {course.status === "Completed" ? "✓" : 
     course.status === "In Progress" ? "→" : 
     course.status === "Failed" ? "✗" : "◯"}
  </span>
  {course.status}
</span>
                                  </div>
                                  
                                  {/* Course Info Badges */}
                                  <div className={styles.eduStudentCourseInfoBadges}>
                                    <span className={styles.eduStudentInfoBadge + ' ' + styles.eduStudentCreditsBadge}>
                                      <span className={styles.eduBadgeIcon}>🎮</span>
                                      {course.credits} credits
                                    </span>
                                    
                                    {course.subject && (
                                      <span className={styles.eduStudentInfoBadge + ' ' + styles.eduStudentSubjectBadge}>
                                        <span className={styles.eduBadgeIcon}>📚</span>
                                        {course.subject}
                                      </span>
                                    )}
                                    
                                    {!isEditable && (
                                      <span className={styles.eduStudentInfoBadge + ' ' + styles.eduStudentCounselorBadge}>
                                        <span className={styles.eduBadgeIcon}>👨‍🏫</span>
                                        Counselor Managed
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Course Description */}
                                  {courseDetails?.description && (
                                    <div className={`${styles.eduStudentCourseDescription} ${isDarkMode ? styles.dark : styles.light}`}>
                                      <p>
                                        {courseDetails.description.length > 150 
                                          ? `${courseDetails.description.substring(0, 150)}...` 
                                          : courseDetails.description}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
  {/* Course Actions */}
<div className={`${styles.eduStudentCourseActions} ${isDarkMode ? styles.dark : styles.light}`}>
  {isEditable ? (
    <>
      {/* Replace the dropdown with a static status badge */}
      <div className={`${styles.eduStudentCourseSelectStatus} ${isDarkMode ? styles.dark : styles.light} flex items-center justify-center`}>
        <span className="mr-2">🔵</span>
        Planned
      </div>
      <button
        onClick={() => removeCourse(course.id)}
        className={styles.eduStudentRemoveButton}
      >
        Remove
      </button>
    </>
  ) : (
    <div className={`${styles.eduStudentManagedByNote} ${isDarkMode ? styles.dark : styles.light}`}>
      Status set by counselor
    </div>
  )}
</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Browse Courses Tab */}
                {activeTab === "browseCourses" && (
                  <div className={styles.eduDashboardGrid}>
                    <div className={`${styles.eduCard} ${styles.eduOverviewCard} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={styles.eduCardHeaderRow}>
                        <h2 className={styles.eduCardTitle}>
                          <span className={`${styles.eduCardIcon} ${styles.info} ${isDarkMode ? styles.dark : styles.light}`}>🔍</span>
                          Browse Available Courses
                        </h2>
                        <div className={styles.eduCourseFilters}>
  <div className={styles.eduSearchContainer}>
    <input
      type="text"
      placeholder="Search courses..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className={`${styles.eduSearchInput} ${isDarkMode ? styles.dark : styles.light}`}
    />
    <span className={styles.eduSearchIcon}>🔍</span>
  </div>
  
  <select
    value={selectedSubject}
    onChange={(e) => setSelectedSubject(e.target.value)}
    className={`${styles.eduSubjectSelect} ${isDarkMode ? styles.dark : styles.light}`}
  >
    <option value="">All Subjects</option>
    {Object.keys(coursesBySubject).map(subject => (
      <option key={subject} value={subject}>{subject}</option>
    ))}
  </select>
</div>
                      </div>
                      
                      {getFilteredCourses().length === 0 ? (
                        <div className={`${styles.eduEmptyCoursesMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                          <p>No courses match your search.</p>
                        </div>
                      ) : (
                        <div className={styles.eduCoursesGrid}>
                          {getFilteredCourses().map(course => {
                            const alreadyAdded = myCourses.some(c => c.course_id === course.id);
                            const prerequisites = course.prerequisites && course.prerequisites.length > 0;
                            
                            return (
                              <div 
                                key={course.id} 
                                className={`${styles.eduCourseCard} ${isDarkMode ? styles.dark : styles.light}`}
                              >
                                <div className={styles.eduCourseCardContent}>
                                  <h3 className={`${styles.eduCourseTitleRow} ${isDarkMode ? styles.dark : styles.light}`}>
                                    <span className={`${styles.eduSubjectBadge} ${isDarkMode ? styles.dark : styles.light}`}>
                                      {course.subject_type ? course.subject_type.charAt(0) : '📚'}
                                    </span>
                                    {course.course_name}
                                  </h3>
                                  <div className={styles.eduCourseTags}>
                                    <span className={`${styles.eduCourseTag} ${isDarkMode ? styles.dark : styles.light}`}>{course.subject_type}</span>
                                    <span className={`${styles.eduCourseTag} ${isDarkMode ? styles.dark : styles.light}`}>{course.credits} credits</span>
                                    {prerequisites && (
                                      <span className={`${styles.eduCourseTag} ${styles.eduPrerequisiteTag} ${isDarkMode ? styles.dark : styles.light}`}>
                                        Prerequisites
                                      </span>
                                    )}
                                  </div>
                                  
                                  {course.description && (
                                    <p className={`${styles.eduCourseDescription} ${isDarkMode ? styles.dark : styles.light}`}>
                                      {course.description.length > 120 ? 
                                        `${course.description.substring(0, 120)}...` : 
                                        course.description}
                                    </p>
                                  )}
                                  
                                  {prerequisites && (
                                    <div className={`${styles.eduPrerequisitesBox} ${isDarkMode ? styles.dark : styles.light}`}>
                                      <p className={`${styles.eduPrerequisitesTitle} ${isDarkMode ? styles.dark : styles.light}`}>Prerequisites:</p>
                                      <ul className={styles.eduPrerequisitesList}>
                                        {course.prerequisites.slice(0, 2).map(prereqId => {
                                          const prereq = getCourseDetails(prereqId);
                                          return prereq ? (
                                            <li key={prereqId} className={styles.eduPrerequisiteItem}>
                                              <span className={styles.eduBulletPoint}>•</span> {prereq.course_name}
                                            </li>
                                          ) : null;
                                        })}
                                        {course.prerequisites.length > 2 && (
                                          <li className={styles.eduMorePrerequisites}>
                                            • ...and {course.prerequisites.length - 2} more
                                          </li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                                
                                <div className={`${styles.eduCourseCardActions} ${isDarkMode ? styles.dark : styles.light}`}>
                                  <button
                                    onClick={() => {
                                      setSelectedCourse(course);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={styles.eduViewDetailsButton}
                                  >
                                    View Details
                                  </button>
                                  
                                  {alreadyAdded ? (
                                    <button
                                      disabled
                                      className={styles.eduAlreadyAddedButton}
                                    >
                                      Added
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        openAddCourseModal(course);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      className={styles.eduAddCourseButton}
                                    >
                                      Add to Plan
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Course recommendations */}
                    {assignedDegree && getRecommendedCourses().length > 0 && (
                      <div className={`${styles.eduCourseRecommendationsPanel} ${isDarkMode ? styles.dark : styles.light}`}>
                        <div className={`${styles.eduRecommendationsHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                          <h2 className={`${styles.eduRecommendationsTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                            <span className={styles.eduRecommendationsIcon}>💡</span>
                            Recommended Courses for Your Degree
                          </h2>
                        </div>
                        
                        <div className={styles.eduCourseRecommendationsGrid}>
                          {getRecommendedCourses().map(course => (
                            <div 
                              key={course.id} 
                              className={`${styles.eduRecommendationCard} ${isDarkMode ? styles.dark : styles.light}`}
                            >
                              <div className={styles.eduRecommendedCourseContent}>
                                <h3 className={`${styles.eduRecommendedCourseTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                                  <span className={`${styles.eduRecommendedBadge} ${isDarkMode ? styles.dark : styles.light}`}>✨</span>
                                  {course.course_name}
                                </h3>
                                
                                <div className={styles.eduRecommendedCourseTags}>
                                  <span className={`${styles.eduRecommendedCourseTag} ${isDarkMode ? styles.dark : styles.light}`}>{course.subject_type}</span>
                                  <span className={`${styles.eduRecommendedCourseTag} ${isDarkMode ? styles.dark : styles.light}`}>{course.credits} credits</span>
                                </div>
                                
                                <div className={`${styles.eduRecommendationReason} ${isDarkMode ? styles.dark : styles.light}`}>
                                  {course.reason}
                                </div>
                              </div>
                              
                              <div className={`${styles.eduRecommendedCourseAction} ${isDarkMode ? styles.dark : styles.light}`}>
                                <button
                                  onClick={() => {
                                    openAddCourseModal(course);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={styles.eduRecommendedAddButton}
                                >
                                  Add to Plan
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Degree Progress Tab */}
                {activeTab === "degreeProgress" && (
                  <div className={styles.eduDegreeProgressContainer}>
                    {!assignedDegree ? (
                      <div className={`${styles.eduNoDegreeCard} ${isDarkMode ? styles.dark : styles.light}`}>
                        <div className={`${styles.eduDegreeCardHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                          <h2 className={`${styles.eduDegreeCardTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                            <span className={`${styles.eduDegreeIconWrapper} ${isDarkMode ? styles.dark : styles.light}`}>🎓</span>
                            No Degree Assigned Yet
                          </h2>
                        </div>
                        <div className={styles.eduNoDegreeContent}>
                          <p className={`${styles.eduNoDegreeMessage} ${isDarkMode ? styles.dark : styles.light}`}>Your counselor has not assigned a degree to you yet.</p>
                          <p className={`${styles.eduNoDegreeSubMessage} ${isDarkMode ? styles.dark : styles.light}`}>Please contact your counselor for assistance.</p>
                          
                          <div className={`${styles.eduDegreeInfoBox} ${isDarkMode ? styles.dark : styles.light}`}>
                            <p className={`${styles.eduDegreeInfoTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                              <span className={styles.eduInfoIcon}>ℹ️</span>
                              What's a degree?
                            </p>
                            <p className={`${styles.eduDegreeInfoText} ${isDarkMode ? styles.dark : styles.light}`}>
                              A degree or diploma is a set of course requirements you need to complete to graduate.
                              Your counselor will help you choose the right degree path based on your academic goals.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`${styles.eduDegreeOverviewCard} ${isDarkMode ? styles.dark : styles.light}`}>
                          <div className={`${styles.eduDegreeCardHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                            <h2 className={`${styles.eduDegreeCardTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                              <span className={`${styles.eduDegreeIconWrapper} ${isDarkMode ? styles.dark : styles.light}`}>🎓</span>
                              Degree Progress: {assignedDegree[1].name || assignedDegree[0]}
                            </h2>
                            <button
                              onClick={() => {
                                refreshDegreeProgress();
                                // Show a brief loading indicator or feedback
                                setNotification({
                                  message: "Refreshing degree progress...",
                                  type: "success"
                                });
                                setShowNotification(true);
                                setTimeout(() => setShowNotification(false), 2000);
                              }}
                              className={`${styles.eduRefreshButton} ${isDarkMode ? styles.dark : styles.light}`}
                              title="Refresh progress"
                            >
                              🔄
                            </button>
                          </div>
                          
                          <div className={`${styles.eduOverallProgressSection} ${isDarkMode ? styles.dark : styles.light}`}>
                            <div className={styles.eduProgressLabelRow}>
                              <span className={`${styles.eduProgressTitle} ${isDarkMode ? styles.dark : styles.light}`}>Overall Completion</span>
                              <span className={`${styles.eduProgressStatsValue} ${isDarkMode ? styles.dark : styles.light}`}>
                                {degreeProgress.completedCredits} / {degreeProgress.totalCredits} credits
                              </span>
                            </div>
                            <div className={`${styles.eduProgressBarWrapper} ${isDarkMode ? styles.dark : styles.light}`}>
                              <div 
                                className={`${styles.eduProgressBar} ${isDarkMode ? styles.dark : styles.light}`}
                                style={{ width: `${calculateProgressPercentage(degreeProgress.completedCredits, degreeProgress.totalCredits)}%` }}
                              ></div>
                            </div>
                            <p className={`${styles.eduProgressPercentage} ${isDarkMode ? styles.dark : styles.light}`}>
                              {Math.round(calculateProgressPercentage(degreeProgress.completedCredits, degreeProgress.totalCredits))}% complete
                            </p>
                          </div>
                          
                          {/* Degree Description */}
                          {assignedDegree[1].description && (
                            <div className={`${styles.eduDegreeDescriptionBox} ${isDarkMode ? styles.dark : styles.light}`}>
                              <h3 className={`${styles.eduDegreeDescriptionTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                                <span className={styles.eduInfoIcon}>ℹ️</span>
                                About this degree:
                              </h3>
                              <p className={`${styles.eduDegreeDescriptionText} ${isDarkMode ? styles.dark : styles.light}`}>{assignedDegree[1].description}</p>
                            </div>
                          )}
                          
                          <div className={styles.eduDegreeSubjectsGrid}>
                            {Object.entries(degreeProgress.subjectProgress).map(([subject, progress], index) => {
                              if (subject === "Electives" && progress.courses.length === 0) return null;
                              
                              // Find subject description if available
                              const subjectData = assignedDegree[1].subjects?.find(s => s.name === subject);
                              const isComplete = subject !== "Electives" && progress.completed >= progress.required;
                              
                              return (
                                <div key={index} className={`${styles.eduSubjectCard} ${isComplete ? styles.eduCompletedSubject : ''} ${isDarkMode ? styles.dark : styles.light}`}>
                                  <div className={`${styles.eduSubjectHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                                    <div className={styles.eduSubjectTitleRow}>
                                      <span className={`${styles.eduDegreeBadge} ${isDarkMode ? styles.dark : styles.light}`}>
                                        {subject.charAt(0)}
                                      </span>
                                      <span className={`${styles.eduSubjectName} ${isDarkMode ? styles.dark : styles.light}`}>{subject}</span>
                                    </div>
                                    <span className={`${styles.eduSubjectCredits} ${isComplete ? styles.eduCompletedCredits : ''} ${isDarkMode ? styles.dark : styles.light}`}>
                                      {progress.completed} / {subject === "Electives" ? "N/A" : progress.required} credits
                                    </span>
                                  </div>
                                  
                                  {subject !== "Electives" && (
  <div className={`${styles.eduSubjectProgressWrapper} ${isDarkMode ? styles.dark : styles.light}`}>
<div 
                                        className={`${styles.eduSubjectProgressBar} ${isComplete ? styles.eduCompleteProgressBar : ''} ${isDarkMode ? styles.dark : styles.light}`}
                                        style={{ width: `${calculateProgressPercentage(progress.completed, progress.required)}%` }}
                                      ></div>
                                    </div>
                                  )}
                                  
                                  {/* Subject description */}
                                  {subjectData?.description && (
                                    <p className={`${styles.eduSubjectDescription} ${isDarkMode ? styles.dark : styles.light}`}>
                                      {subjectData.description}
                                    </p>
                                  )}
                                  
                                  {progress.courses.length > 0 && (
                                    <div className={`${styles.eduCompletedCoursesBox} ${isDarkMode ? styles.dark : styles.light}`}>
                                      <p className={`${styles.eduCompletedCoursesTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                                        Completed courses in this subject:
                                      </p>
                                      <div className={styles.eduCompletedCoursesList}>
                                        {progress.courses.map(course => {
                                          const courseDetails = getCourseDetails(course.course_id);
                                          return (
                                            <div key={course.id} className={`${styles.eduCompletedCourseItem} ${isDarkMode ? styles.dark : styles.light}`}>
                                              <span className={`${styles.eduCompletedCourseName} ${isDarkMode ? styles.dark : styles.light}`}>{course.name}</span>
                                              <span className={`${styles.eduCompletedCourseCredits} ${isDarkMode ? styles.dark : styles.light}`}>{courseDetails?.credits || course.credits} credits</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div className={`${styles.eduRemainingRequirementsCard} ${isDarkMode ? styles.dark : styles.light}`}>
                          <div className={`${styles.eduDegreeCardHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                            <h2 className={`${styles.eduDegreeCardTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                              <span className={`${styles.eduDegreeIconWrapper} ${isDarkMode ? styles.dark : styles.light}`}>📋</span>
                              Remaining Requirements
                            </h2>
                          </div>
                          
                          <div className={styles.eduRequirementsGrid}>
                            {Object.entries(degreeProgress.subjectProgress)
                              .filter(([subject, progress]) => subject !== "Electives" && progress.completed < progress.required)
                              .map(([subject, progress], index) => (
                                <div key={index} className={`${styles.eduRequirementCard} ${isDarkMode ? styles.dark : styles.light}`}>
                                  <div className={`${styles.eduRequirementHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                                    <span className={`${styles.eduRequirementSubject} ${isDarkMode ? styles.dark : styles.light}`}>{subject}</span>
                                    <span className={`${styles.eduMissingCreditsTag} ${isDarkMode ? styles.dark : styles.light}`}>
                                      Need {progress.required - progress.completed} more credits
                                    </span>
                                  </div>
                                  
                                  <div className={styles.eduSuggestedCoursesSection}>
                                    <p className={`${styles.eduSuggestedCoursesTitle} ${isDarkMode ? styles.dark : styles.light}`}>
                                      Suggested courses:
                                    </p>
                                    <div className={`${styles.eduSuggestedCoursesList} ${isDarkMode ? styles.dark : styles.light}`}>
                                      {coursesBySubject[subject]?.slice(0, 3).map(course => {
                                        const alreadyAdded = myCourses.some(c => c.course_id === course.id);
                                        return (
                                          <div key={course.id} className={`${styles.eduSuggestedCourseItem} ${isDarkMode ? styles.dark : styles.light}`}>
                                            <span className={`${styles.eduSuggestedCourseName} ${isDarkMode ? styles.dark : styles.light}`}>{course.course_name}</span>
                                            <div className={styles.eduSuggestedCourseActions}>
                                              <span className={`${styles.eduCourseCreditsTag} ${isDarkMode ? styles.dark : styles.light}`}>
                                                {course.credits} credits
                                              </span>
                                              {!alreadyAdded && (
                                                <button
                                                  onClick={() => {
                                                    openAddCourseModal(course);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                  }}
                                                  className={`${styles.eduAddCourseButton} ${isDarkMode ? styles.dark : styles.light}`}
                                                >
                                                  Add
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {(!coursesBySubject[subject] || coursesBySubject[subject].length === 0) && (
                                        <p className={`${styles.eduNoCourseMessage} ${isDarkMode ? styles.dark : styles.light}`}>No courses available for this subject</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                            {Object.entries(degreeProgress.subjectProgress)
                              .filter(([subject, progress]) => subject !== "Electives" && progress.completed < progress.required).length === 0 && (
                                <div className={`${styles.eduCompletionCard} ${isDarkMode ? styles.dark : styles.light}`}>
                                  <p className={`${styles.eduCompletionMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                                    <span className={styles.eduCelebrationIcon}>🎉</span>
                                    You've completed all the required subjects for your degree!
                                  </p>
                                  {degreeProgress.completedCredits < degreeProgress.totalCredits && (
                                    <p className={`${styles.eduRemainingCreditsMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                                      You still need {degreeProgress.totalCredits - degreeProgress.completedCredits} more total credits to graduate.
                                    </p>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </main>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className={`${styles.eduLoadingCard} ${isDarkMode ? styles.dark : styles.light} max-w-md`}>
            <h2 className="text-xl font-bold mb-4">Welcome to EduPlan</h2>
            <p className="mb-4">Checking authentication...</p>
            <div className={`${styles.eduLoadingSpinner} ${isDarkMode ? styles.dark : styles.light} mx-auto mt-4`}></div>
          </div>
        </div>
      )}
    </div>
  );
}