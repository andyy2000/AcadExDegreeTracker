import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, db, logout } from "../firebase";
import { ref, get, set, push, remove, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import styles from "../styles/Counselor.module.css";

export default function CounselorPage() {
  const [user, setUser] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [schoolData, setSchoolData] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [degreeName, setDegreeName] = useState("");
  const [degreeDescription, setDegreeDescription] = useState("");
  const [totalCreditsRequired, setTotalCreditsRequired] = useState("");
  const [subjects, setSubjects] = useState([{ name: "", requiredCredits: "", description: "" }]);
  const [courseName, setCourseName] = useState("");
  const [courseSubject, setCourseSubject] = useState("");
  const [courseCredits, setCourseCredits] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [coursePrerequisites, setCoursePrerequisites] = useState([]);
  const [degrees, setDegrees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [showDegreeEditor, setShowDegreeEditor] = useState(true);
  const [showCourseEditor, setShowCourseEditor] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [editingDegree, setEditingDegree] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [activeTab, setActiveTab] = useState("degrees");
  const [stats, setStats] = useState({
    totalDegrees: 0,
    totalCourses: 0,
    totalSubjects: 0,
    totalCredits: 0,
    averageCreditsPerCourse: 0,
    studentsCount: 0,
    studentsPerDegree: {}
  });
  const [notifications, setNotifications] = useState([]);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const router = useRouter();

  //  Check authentication and validate counselor access
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        validateCounselor(currentUser.email);
        
        // Load dark mode preference from localStorage
        const darkModePreference = localStorage.getItem('darkMode') === 'true';
        setIsDarkMode(darkModePreference);
        if (darkModePreference) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        setUser(null);
        router.push("/auth"); // Redirect if not logged in
      }
    });

    return () => unsubscribe();
  }, [router]);

// Toggle dark mode
const toggleDarkMode = () => {
  setIsDarkMode(!isDarkMode);
  localStorage.setItem('darkMode', !isDarkMode);
  if (!isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Update the validateCounselor function to reflect your actual database structure
const validateCounselor = async (email) => {
  try {
    const schoolsRef = ref(db, "schools");
    const snapshot = await get(schoolsRef);

    if (snapshot.exists()) {
      let foundSchool = null;

      snapshot.forEach((childSnapshot) => {
        const school = childSnapshot.val();
        
        // Check for counselors (plural) array/object
        if (school.counselors) {
          Object.keys(school.counselors).forEach(key => {
            const counselor = school.counselors[key];
            
            console.log("Checking counselor:", counselor.email, "against:", email);
            
            if (counselor && counselor.email && counselor.email.toLowerCase() === email.toLowerCase()) {
              console.log("Found matching counselor!");
              foundSchool = { id: childSnapshot.key, ...school };
            }
          });
        }
      });

      if (foundSchool) {
        setSchoolId(foundSchool.id);
        setSchoolData(foundSchool);
        setIsAuthorized(true);
        loadDegreesAndCourses(foundSchool.id);
        loadStudentCount(foundSchool.id);
      } else {
        console.log("No matching school found for counselor email:", email);
        router.push("/access-denied");
      }
    }
  } catch (error) {
    console.error("Error validating counselor:", error);
    addNotification("Error", "Failed to validate counselor access.", "error");
  }
};

  const loadDegreesAndCourses = async (id) => {
    const degreesRef = ref(db, `schools/${id}/degrees`);
    const coursesRef = ref(db, `schools/${id}/courses`);
  
    const degreesSnap = await get(degreesRef);
    const coursesSnap = await get(coursesRef);

    if (degreesSnap.exists()) {
      const degreeData = degreesSnap.val();
      const formattedDegrees = Object.entries(degreeData).map(([key, value]) => ({
        id: key,
        description: value.description || "",
        totalCredits: value.totalCredits || "",
        subjects: value.subjects || []
      }));
      
      setDegrees(formattedDegrees);
      
      // Calculate stats
      const subjects = new Set();
      formattedDegrees.forEach(degree => {
        degree.subjects.forEach(subject => {
          subjects.add(subject.name);
        });
      });
      
      setStats(prev => ({
        ...prev,
        totalDegrees: formattedDegrees.length,
        totalSubjects: subjects.size
      }));
    } else {
      setDegrees([]);
    }
    
    if (coursesSnap.exists()) {
      const courseData = Object.entries(coursesSnap.val()).map(([key, value]) => ({
        id: key,
        ...value
      }));
      
      setAllCourses(courseData);
      
      const groupedCourses = courseData.reduce((acc, course) => {
        if (!acc[course.subject_type]) acc[course.subject_type] = [];
        acc[course.subject_type].push(course);
        return acc;
      }, {});
  
      Object.keys(groupedCourses).forEach((subject) => {
        groupedCourses[subject].sort((a, b) => a.course_name.localeCompare(b.course_name));
      });
  
      setCourses(groupedCourses);
      
      // Calculate stats
      const totalCredits = courseData.reduce((sum, course) => sum + (parseInt(course.credits) || 0), 0);
      setStats(prev => ({
        ...prev,
        totalCourses: courseData.length,
        totalCredits: totalCredits,
        averageCreditsPerCourse: courseData.length ? (totalCredits / courseData.length).toFixed(1) : 0
      }));

      // Add notification if a subject has no courses
      const subjectsWithNoCourses = Array.from(new Set(degrees.flatMap(d => d.subjects.map(s => s.name))))
        .filter(subject => !Object.keys(groupedCourses).includes(subject));
      
      if (subjectsWithNoCourses.length > 0) {
        subjectsWithNoCourses.forEach(subject => {
          addNotification(
            "Missing Courses", 
            `The subject "${subject}" has no courses assigned. Consider adding some.`,
            "warning"
          );
        });
      }
    } else {
      setCourses({});
      setAllCourses([]);
    }
  };

  const loadStudentCount = async (id) => {
    try {
      const studentsRef = ref(db, `schools/${id}/students`);
      const studentsSnap = await get(studentsRef);
      
      if (studentsSnap.exists()) {
        const students = Object.values(studentsSnap.val());
        const studentsCount = students.length;
        
        // Count students per degree
        const degreeCount = {};
        students.forEach(student => {
          const degreeName = student.degree;
          if (degreeName) {
            degreeCount[degreeName] = (degreeCount[degreeName] || 0) + 1;
          }
        });
        
        setStats(prev => ({
          ...prev,
          studentsCount,
          studentsPerDegree: degreeCount
        }));
      } else {
        setStats(prev => ({
          ...prev,
          studentsCount: 0,
          studentsPerDegree: {}
        }));
      }
    } catch (error) {
      console.error("Error loading student count:", error);
    }
  };
  
  useEffect(() => {
    if (schoolId) {
      loadDegreesAndCourses(schoolId);
    }
  }, [schoolId]);
  
  // Add an Associate Degree
  const addAssociateDegree = async () => {
    if (!degreeName || subjects.some(subject => !subject.name || !subject.requiredCredits)) {
      addNotification("Validation Error", "Please fill in all required fields for the degree.", "error");
      return;
    }

    try {
      const degreeData = {
        subjects,
        description: degreeDescription,
        totalCredits: totalCreditsRequired,
        createdAt: new Date().toISOString()
      };

      if (editingDegree) {
        // Update existing degree
        await set(ref(db, `schools/${schoolId}/degrees/${editingDegree}`), degreeData);
        addNotification("Success", `Degree "${degreeName}" has been updated.`, "success");
        
        // Clear form
        setEditingDegree(null);
      } else {
        // Create new degree
        await set(ref(db, `schools/${schoolId}/degrees/${degreeName}`), degreeData);
        addNotification("Success", `New degree "${degreeName}" has been added.`, "success");
      }

      setDegreeName("");
      setDegreeDescription("");
      setTotalCreditsRequired("");
      setSubjects([{ name: "", requiredCredits: "", description: "" }]);
      loadDegreesAndCourses(schoolId);
    } catch (error) {
      console.error("Error adding degree:", error);
      addNotification("Error", `Failed to save degree: ${error.message}`, "error");
    }
  };

  // Edit existing degree
  const handleEditDegree = (degree) => {
    setEditingDegree(degree.id);
    setDegreeName(degree.id);
    setDegreeDescription(degree.description || "");
    setTotalCreditsRequired(degree.totalCredits || "");
    setSubjects(degree.subjects.map(s => ({
      name: s.name || "", 
      requiredCredits: s.requiredCredits || "",
      description: s.description || ""
    })));
    
    // Ensure active tab is degrees
    setActiveTab("degrees");
    
    // Scroll to form
    document.getElementById("degreeForm")?.scrollIntoView({ behavior: "smooth" });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingDegree(null);
    setEditingCourse(null);
    setDegreeName("");
    setDegreeDescription("");
    setTotalCreditsRequired("");
    setSubjects([{ name: "", requiredCredits: "", description: "" }]);
    setCourseName("");
    setCourseSubject("");
    setCourseCredits("");
    setCourseDescription("");
    setCoursePrerequisites([]);
  };

  // Add More Subjects for the Degree
  const addMoreSubjects = () => {
    setSubjects([...subjects, { name: "", requiredCredits: "", description: "" }]);
  };

  // Handle Subject Input Change
  const handleSubjectChange = (index, field, value) => {
    const updatedSubjects = [...subjects];
    updatedSubjects[index][field] = value;
    setSubjects(updatedSubjects);
  };

  // Remove a Subject from the Degree
  const removeSubject = (index) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  // Remove an Associate Degree
  const removeDegree = async (degreeId) => {
    if (window.confirm(`Are you sure you want to delete the degree "${degreeId}"? This action cannot be undone.`)) {
      try {
        await remove(ref(db, `schools/${schoolId}/degrees/${degreeId}`));
        addNotification("Success", `Degree "${degreeId}" has been removed.`, "success");
        loadDegreesAndCourses(schoolId);
      } catch (error) {
        console.error("Error removing degree:", error);
        addNotification("Error", `Failed to remove degree: ${error.message}`, "error");
      }
    }
  };

  // Add a Course
  const addCourse = async () => {
    if (!courseName || !courseSubject || !courseCredits) {
      addNotification("Validation Error", "Please fill in all required fields for the course.", "error");
      return;
    }

    try {
      const courseData = {
        course_name: courseName,
        subject_type: courseSubject,
        credits: parseInt(courseCredits),
        description: courseDescription,
        prerequisites: coursePrerequisites,
        updatedAt: new Date().toISOString()
      };

      if (editingCourse) {
        // Update existing course
        await update(ref(db, `schools/${schoolId}/courses/${editingCourse}`), courseData);
        addNotification("Success", `Course "${courseName}" has been updated.`, "success");
        
        // Clear form
        setEditingCourse(null);
      } else {
        // Create new course
        const courseRef = push(ref(db, `schools/${schoolId}/courses`));
        await set(courseRef, courseData);
        addNotification("Success", `New course "${courseName}" has been added.`, "success");
      }

      setCourseName("");
      setCourseSubject("");
      setCourseCredits("");
      setCourseDescription("");
      setCoursePrerequisites([]);
      loadDegreesAndCourses(schoolId);
    } catch (error) {
      console.error("Error adding course:", error);
      addNotification("Error", `Failed to save course: ${error.message}`, "error");
    }
  };

  // Edit existing course
  const handleEditCourse = (course) => {
    setEditingCourse(course.id);
    setCourseName(course.course_name || "");
    setCourseSubject(course.subject_type || "");
    setCourseCredits(course.credits || "");
    setCourseDescription(course.description || "");
    setCoursePrerequisites(course.prerequisites || []);
    
    // Ensure active tab is courses
    setActiveTab("courses");
    
    // Scroll to form
    document.getElementById("courseForm")?.scrollIntoView({ behavior: "smooth" });
  };

  // Remove a Course
  const removeCourse = async (courseId) => {
    if (window.confirm("Are you sure you want to delete this course? This action cannot be undone.")) {
      try {
        await remove(ref(db, `schools/${schoolId}/courses/${courseId}`));
        addNotification("Success", "Course has been removed.", "success");
        loadDegreesAndCourses(schoolId);
      } catch (error) {
        console.error("Error removing course:", error);
        addNotification("Error", `Failed to remove course: ${error.message}`, "error");
      }
    }
  };

  // Add a prerequisite course
  const addPrerequisite = (courseId) => {
    if (courseId && !coursePrerequisites.includes(courseId)) {
      setCoursePrerequisites([...coursePrerequisites, courseId]);
    }
  };

  // Remove a prerequisite course
  const removePrerequisite = (courseId) => {
    setCoursePrerequisites(coursePrerequisites.filter(id => id !== courseId));
  };

  // Get course name by ID
  const getCourseNameById = (courseId) => {
    const course = allCourses.find(c => c.id === courseId);
    return course ? course.course_name : "Unknown Course";
  };

  // Filter courses by search term and subject
  const filteredCourses = () => {
    let result = { ...courses };
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      
      // Filter each subject group
      Object.keys(result).forEach(subject => {
        result[subject] = result[subject].filter(course => 
          course.course_name.toLowerCase().includes(searchLower) ||
          (course.description && course.description.toLowerCase().includes(searchLower))
        );
        
        // Remove empty subject groups
        if (result[subject].length === 0) {
          delete result[subject];
        }
      });
    }
    
    if (filterSubject) {
      // Only keep the selected subject
      const filteredResult = {};
      if (result[filterSubject]) {
        filteredResult[filterSubject] = result[filterSubject];
      }
      result = filteredResult;
    }
    
    return result;
  };

  // Filter degrees by search term
  const filteredDegrees = () => {
    if (!searchTerm) return degrees;
    
    const searchLower = searchTerm.toLowerCase();
    return degrees.filter(degree => 
      degree.id.toLowerCase().includes(searchLower) ||
      (degree.description && degree.description.toLowerCase().includes(searchLower)) ||
      degree.subjects.some(subject => 
        subject.name.toLowerCase().includes(searchLower) ||
        (subject.description && subject.description.toLowerCase().includes(searchLower))
      )
    );
  };

  // For the dashboard stats
  const refreshStats = async () => {
    await loadDegreesAndCourses(schoolId);
    await loadStudentCount(schoolId);
    setShowStats(true);
    setActiveTab("stats");
    addNotification("Stats", "Dashboard statistics have been refreshed.", "info");
  };

  // Add notification
  const addNotification = (title, message, type = "info") => {
    const newNotification = {
      id: Date.now(),
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto-open notification drawer if it's an error
    if (type === "error") {
      setIsNotificationDrawerOpen(true);
    }
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      removeNotification(newNotification.id);
    }, 5000);
  };

  // Remove notification
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Download curriculum as JSON
  const downloadCurriculum = () => {
    try {
      const curriculum = {
        school: schoolData.name,
        degrees: degrees,
        courses: allCourses,
        exportedAt: new Date().toISOString()
      };
      
      const dataStr = JSON.stringify(curriculum, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `${schoolData.name.replace(/\s+/g, '_')}_curriculum.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      addNotification("Export", "Curriculum exported successfully!", "success");
    } catch (error) {
      console.error("Error exporting curriculum:", error);
      addNotification("Export Error", `Failed to export curriculum: ${error.message}`, "error");
    }
  };

  // Navigate to student management
  const navigateToStudentManagement = () => {
    router.push("/counselor2");
  };

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : styles.light}`}>
      <div className={styles.mainWrapper}>
        <header className={`${styles.header} ${isDarkMode ? styles.dark : styles.light}`}>
          <div className={styles.headerContent}>
            <div className={styles.logoArea}>
              <h1 className={styles.dashboardTitle}>Counselor Dashboard</h1>
              {isAuthorized && (
                <p className={`${styles.welcomeText} ${isDarkMode ? styles.dark : styles.light}`}>
                  Welcome, {user?.displayName}! | School: {schoolData?.name}
                </p>
              )}
            </div>
            
            <div className={styles.actionButtons}>
              <button 
                onClick={toggleDarkMode}
                className={`${styles.iconButton} ${styles.darkModeButton} ${isDarkMode ? styles.dark : styles.light}`}
                title={isDarkMode ? "Switch to Light mode" : "Switch to Dark mode"}
              >
                {isDarkMode ? "☀️" : "🌙"}
              </button>
              
              <button 
                onClick={() => setIsNotificationDrawerOpen(!isNotificationDrawerOpen)}
                className={`${styles.iconButton} ${styles.notificationButton} ${isDarkMode ? styles.dark : styles.light}`}
                title="Notifications"
              >
                🔔
                {notifications.length > 0 && (
                  <span className={styles.notificationBadge}>
                    {notifications.length}
                  </span>
                )}
              </button>
              
              <button 
                onClick={navigateToStudentManagement}
                className={`${styles.actionButton} ${styles.primaryButton}`}
                title="Go to student management"
              >
                Manage Students
              </button>
              
              <button 
                onClick={() => logout(router)} 
                className={`${styles.actionButton} ${styles.dangerButton}`}
              >
                Logout
              </button>
            </div>
          </div>
          
          {isAuthorized && (
            <div className={styles.searchArea}>
              <div className={styles.searchInputGroup}>
                <input
                  type="text"
                  placeholder="Search degrees, courses, subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${styles.searchInput} ${isDarkMode ? styles.dark : styles.light}`}
                />
                <button 
                  onClick={() => setSearchTerm("")}
                  className={`${styles.clearButton} ${isDarkMode ? styles.dark : styles.light}`}
                >
                  ✕
                </button>
              </div>
              
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className={`${styles.selectFilter} ${isDarkMode ? styles.dark : styles.light}`}
              >
                <option value="">All Subjects</option>
                {Object.keys(courses).map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
              
              <div className={styles.tabGroup}>
                <button 
                  onClick={() => { setActiveTab("degrees"); setEditingDegree(null); }}
                  className={`${styles.tabButton} ${activeTab === "degrees" ? styles.active : ""} ${isDarkMode ? styles.dark : styles.light}`}
                >
                  Degrees
                </button>
                <button 
                  onClick={() => { setActiveTab("courses"); setEditingCourse(null); }}
                  className={`${styles.tabButton} ${activeTab === "courses" ? styles.active : ""} ${isDarkMode ? styles.dark : styles.light}`}
                >
                  Courses
                </button>
                <button 
                  onClick={refreshStats}
                  className={`${styles.tabButton} ${activeTab === "stats" ? styles.active : ""} ${isDarkMode ? styles.dark : styles.light}`}
                >
                  Stats
                </button>
              </div>
            </div>
          )}
        </header>

        {!isAuthorized ? (
          <div className={styles.loadingIndicator}>
            <div className={styles.loadingSpinner}></div>
            <p className={styles.loadingText}>Validating access...</p>
          </div>
        ) : (
          <div className={styles.fadeIn}>
            {isNotificationDrawerOpen && (
              <>
                <div className={styles.notificationDrawerBackdrop} onClick={() => setIsNotificationDrawerOpen(false)}></div>
                <div className={`${styles.notificationDrawer} ${isDarkMode ? styles.dark : styles.light} ${styles.slideInRight}`}>
                  <div className={`${styles.notificationHeader} ${isDarkMode ? styles.dark : styles.light}`}>
                    <h3 className={styles.notificationTitle}>Notifications</h3>
                    <div className={styles.notificationActions}>
                      <button 
                        onClick={clearAllNotifications}
                        className={`${styles.notificationAction} ${isDarkMode ? styles.dark : styles.light}`}
                      >
                        Clear All
                      </button>
                      <button 
                        onClick={() => setIsNotificationDrawerOpen(false)}
                        className={`${styles.notificationAction} ${isDarkMode ? styles.dark : styles.light}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.notificationList}>
                    {notifications.length === 0 ? (
                      <div className={styles.emptyNotificationsMessage}>
                        <span className={styles.emptyNotificationsIcon}>🔔</span>
                        <p className={`${styles.emptyNotificationsText} ${isDarkMode ? styles.dark : styles.light}`}>
                          No notifications
                        </p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`${styles.notificationItem} ${styles[notification.type]} ${isDarkMode ? styles.dark : styles.light}`}
                        >
                          <div className={styles.notificationItemHeader}>
                            <h4 className={`${styles.notificationItemTitle} ${styles[notification.type]} ${isDarkMode ? styles.dark : styles.light}`}>
                              {notification.title}
                            </h4>
                            <button 
                              onClick={() => removeNotification(notification.id)}
                              className={`${styles.notificationCloseButton} ${isDarkMode ? styles.dark : styles.light}`}
                            >
                              ✕
                            </button>
                          </div>
                          <p className={`${styles.notificationItemMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                            {notification.message}
                          </p>
                          <div className={`${styles.notificationItemTimestamp} ${isDarkMode ? styles.dark : styles.light}`}>
                            {notification.timestamp}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
            
            {activeTab === "degrees" && (
              <div className={styles.slideInUp}>
                {showStats && (
                  <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={styles.cardHeader}>
                      <h2 className={styles.cardTitle}>School Statistics</h2>
                      <button
                        onClick={() => setShowStats(false)}
                        className={`${styles.toggleViewButton} ${isDarkMode ? styles.dark : styles.light}`}
                      >
                        Hide
                      </button>
                    </div>
                    
                    <div className={styles.statsGrid}>
                      <div className={`${styles.statCard} ${styles.blue} ${isDarkMode ? styles.dark : styles.light}`}>
                        <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                          {stats.studentsCount}
                        </div>
                        <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Students</div>
                      </div>
                      
                      <div className={`${styles.statCard} ${styles.purple} ${isDarkMode ? styles.dark : styles.light}`}>
                        <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                          {stats.totalDegrees}
                        </div>
                        <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Degrees</div>
                      </div>
                      
                      <div className={`${styles.statCard} ${styles.green} ${isDarkMode ? styles.dark : styles.light}`}>
                        <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                          {stats.totalCourses}
                        </div>
                        <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Courses</div>
                      </div>
                      
                      <div className={`${styles.statCard} ${styles.yellow} ${isDarkMode ? styles.dark : styles.light}`}>
                        <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                          {stats.totalSubjects}
                        </div>
                        <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Subject Areas</div>
                      </div>
                      
                      <div className={`${styles.statCard} ${styles.indigo} ${isDarkMode ? styles.dark : styles.light}`}>
                        <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                          {stats.totalCredits}
                        </div>
                        <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Credits Available</div>
                      </div>
                      
                      <div className={`${styles.statCard} ${styles.red} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                          {stats.averageCreditsPerCourse}
                        </div>
                        <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Avg. Credits Per Course</div>
                      </div>
                    </div>
                    
                    {Object.keys(stats.studentsPerDegree).length > 0 && (
                      <div className={styles.formSection}>
                        <h3 className={styles.cardTitle}>Students Per Degree Program</h3>
                        <div className={styles.dataGrid}>
                          {Object.entries(stats.studentsPerDegree).map(([degree, count]) => (
                            <div 
                              key={degree}
                              className={`${styles.itemCard} ${isDarkMode ? styles.dark : styles.light}`}
                            >
                              <div className={styles.itemHeader}>
                                <span className={styles.itemTitle}>{degree}</span>
                                <span className={`${styles.itemDetail} ${styles.primary} ${isDarkMode ? styles.dark : styles.light}`}>
                                  {count} students
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Add/Edit Associate Degree */}
                <div 
                  id="degreeForm"
                  className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}
                >
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                      {editingDegree ? `Edit Degree: ${editingDegree}` : "Add Associate Degree"}
                    </h2>
                    <button 
                      onClick={() => setShowDegreeEditor(!showDegreeEditor)}
                      className={`${styles.toggleViewButton} ${isDarkMode ? styles.dark : styles.light}`}
                    >
                      {showDegreeEditor ? "▼ Hide" : "► Show"}
                    </button>
                  </div>
                  
                  {showDegreeEditor && (
                    <>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Degree Name <span className={styles.requiredIndicator}>*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Degree Name (e.g., Computer Science)"
                            value={degreeName}
                            onChange={(e) => setDegreeName(e.target.value)}
                            disabled={!!editingDegree}
                            className={`${styles.textInput} ${isDarkMode ? styles.dark : styles.light} ${editingDegree ? styles.disabled : ''}`}
                          />
                        </div>
                        
                        <div className={styles.formGroup}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Total Credits Required
                          </label>
                          <input
                            type="number"
                            placeholder="Total credits needed for degree"
                            value={totalCreditsRequired}
                            onChange={(e) => setTotalCreditsRequired(e.target.value)}
                            className={`${styles.textInput} ${isDarkMode ? styles.dark : styles.light}`}
                          />
                        </div>
                      </div>
                      
                      <div className={styles.formSection}>
                        <h3 className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                          Required Subjects <span className={styles.requiredIndicator}>*</span>
                        </h3>
                        
                        {subjects.map((subject, index) => (
                          <div 
                            key={index} 
                            className={`${styles.subjectSection} ${isDarkMode ? styles.dark : styles.light} ${styles.fadeIn}`}
                          >
                            <div className={styles.formGrid}>
                              <div className={styles.formGroup}>
                                <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                                  Subject Name <span className={styles.requiredIndicator}>*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="E.g., Mathematics"
                                  value={subject.name}
                                  onChange={(e) => handleSubjectChange(index, "name", e.target.value)}
                                  className={`${styles.textInput} ${isDarkMode ? styles.dark : styles.light}`}
                                />
                              </div>
                              
                              <div className={styles.formGroup}>
                                <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                                  Required Credits <span className={styles.requiredIndicator}>*</span>
                                </label>
                                <input
                                  type="number"
                                  placeholder="Credits needed"
                                  value={subject.requiredCredits}
                                  onChange={(e) => handleSubjectChange(index, "requiredCredits", e.target.value)}
                                  className={`${styles.textInput} ${isDarkMode ? styles.dark : styles.light}`}
                                />
                              </div>
                            </div>
                            
                            <div className={styles.formGroup}>
                              <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                                Description
                              </label>
                              <textarea
                                placeholder="Describe this subject area..."
                                value={subject.description}
                                onChange={(e) => handleSubjectChange(index, "description", e.target.value)}
                                rows="2"
                                className={`${styles.textarea} ${isDarkMode ? styles.dark : styles.light}`}
                              ></textarea>
                            </div>
                            
                            <div className={styles.buttonGroup}>
                              <button 
                                onClick={() => removeSubject(index)} 
                                className={`${styles.actionButton} ${styles.dangerButton}`}
                              >
                                Remove Subject
                              </button>
                            </div>
                          </div>
                        ))}
                      
                        <div className={styles.formGroup}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Degree Description
                          </label>
                          <textarea
                            placeholder="Describe this degree and career opportunities..."
                            value={degreeDescription}
                            onChange={(e) => setDegreeDescription(e.target.value)}
                            rows="3"
                            className={`${styles.textarea} ${isDarkMode ? styles.dark : styles.light}`}
                          ></textarea>
                        </div>
                      </div>

                      <div className={styles.buttonGroup}>
                        <button 
                          onClick={addMoreSubjects} 
                          className={`${styles.actionButton} ${styles.primaryButton}`}
                        >
                          Add More Subjects
                        </button>
                        
                        <button 
                          onClick={addAssociateDegree} 
                          className={`${styles.actionButton} ${styles.primaryButton}`}
                        >
                          {editingDegree ? "Update Degree" : "Save Associate Degree"}
                        </button>
                        
                        {editingDegree && (
                          <button 
                            onClick={cancelEditing} 
                            className={`${styles.actionButton} ${styles.dangerButton}`}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Existing Degrees */}
                <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Existing Degrees</h2>
                    <button
                      onClick={downloadCurriculum}
                      className={`${styles.exportButton} ${isDarkMode ? styles.dark : styles.light}`}
                    >
                      Export Curriculum
                    </button>
                  </div>
                  
                  {filteredDegrees().length === 0 ? (
                    <p className={`${styles.noDataMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                      {searchTerm ? "No degrees match your search" : "No degrees have been created yet"}
                    </p>
                  ) : (
                    <div className={styles.dataGrid}>
                      {filteredDegrees().map(degree => (
                        <div 
                          key={degree.id} 
                          className={`${styles.itemCard} ${isDarkMode ? styles.dark : styles.light}`}
                        >
                          <div className={styles.itemHeader}>
                            <h3 className={styles.itemTitle}>{degree.id}</h3>
                            <div className={styles.buttonGroup}>
                              <button 
                                onClick={() => handleEditDegree(degree)} 
                                className={`${styles.actionButton} ${styles.primaryButton}`}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => removeDegree(degree.id)} 
                                className={`${styles.actionButton} ${styles.dangerButton}`}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          
                          {degree.description && (
                            <p className={`${styles.itemDescription} ${isDarkMode ? styles.dark : styles.light}`}>
                              {degree.description}
                            </p>
                          )}
                          
                          {degree.totalCredits && (
                            <p className={`${styles.itemDetail} ${styles.primary} ${isDarkMode ? styles.dark : styles.light}`}>
                              Total Credits Required: {degree.totalCredits}
                            </p>
                          )}
                          
                          <div className={styles.formSection}>
                            <h4 className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                              Required Subjects:
                            </h4>
                            <div className={`${styles.recommendedCoursesContainer} ${isDarkMode ? styles.dark : styles.light}`}>
                              <table className={`${styles.subjectTable}`}>
                                <thead>
                                  <tr>
                                    <th className={`${styles.subjectTableHeader} ${isDarkMode ? styles.dark : styles.light}`}>Subject</th>
                                    <th className={`${styles.subjectTableHeader} ${isDarkMode ? styles.dark : styles.light} text-right`}>Credits</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {degree.subjects.map((subject, index) => (
                                    <tr 
                                      key={index} 
                                      className={`${styles.subjectTableRow} ${isDarkMode ? styles.dark : styles.light}`}
                                    >
                                      <td className={styles.subjectTableCell}>{subject.name}</td>
                                      <td className={`${styles.subjectTableCell} text-right`}>{subject.requiredCredits}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          
                          {stats.studentsPerDegree[degree.id] && (
                            <div className={`${styles.courseInfoRow} mt-2`}>
                              <span className={`${styles.itemDetail} ${styles.primary} ${isDarkMode ? styles.dark : styles.light}`}>
                                {stats.studentsPerDegree[degree.id]}
                              </span>
                              <span className={`${styles.itemDescription} ${isDarkMode ? styles.dark : styles.light}`}>
                                students enrolled
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === "courses" && (
              <div className={styles.slideInUp}>
                {/* Add/Edit Course */}
                <div 
                  id="courseForm"
                  className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}
                >
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                      {editingCourse ? "Edit Course" : "Add Course"}
                    </h2>
                    <button 
                      onClick={() => setShowCourseEditor(!showCourseEditor)}
                      className={`${styles.toggleViewButton} ${isDarkMode ? styles.dark : styles.light}`}
                    >
                      {showCourseEditor ? "▼ Hide" : "► Show"}
                    </button>
                  </div>
                  
                  {showCourseEditor && (
                    <>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Course Name <span className={styles.requiredIndicator}>*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Course Name"
                            value={courseName}
                            onChange={(e) => setCourseName(e.target.value)}
                            className={`${styles.textInput} ${isDarkMode ? styles.dark : styles.light}`}
                          />
                        </div>
                        
                        <div className={styles.formGroup}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Subject Type <span className={styles.requiredIndicator}>*</span>
                          </label>
                          <select
                            value={courseSubject}
                            onChange={(e) => setCourseSubject(e.target.value)}
                            className={`${styles.selectInput} ${isDarkMode ? styles.dark : styles.light}`}
                          >
                            <option value="">Select Subject Type</option>
                            {degrees.flatMap(degree => 
                              degree.subjects.map(subject => subject.name)
                            )
                            .filter((value, index, self) => self.indexOf(value) === index)
                            .sort()
                            .map(subject => (
                              <option key={subject} value={subject}>
                                {subject}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className={styles.formGroup}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Credits <span className={styles.requiredIndicator}>*</span>
                          </label>
                          <input
                            type="number"
                            placeholder="Credits"
                            value={courseCredits}
                            onChange={(e) => setCourseCredits(e.target.value)}
                            className={`${styles.textInput} ${isDarkMode ? styles.dark : styles.light}`}
                          />
                        </div>
                        
                        <div className={styles.formGroup}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Prerequisites
                          </label>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addPrerequisite(e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className={`${styles.selectInput} ${isDarkMode ? styles.dark : styles.light}`}
                          >
                            <option value="">Select Prerequisite Course</option>
                            {allCourses
                              .filter(c => c.id !== editingCourse)
                              .map(course => (
                                <option key={course.id} value={course.id}>
                                  {course.course_name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      
                      {coursePrerequisites.length > 0 && (
                        <div className={styles.formSection}>
                          <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                            Selected Prerequisites:
                          </label>
                          <div className={styles.tagGroup}>
                            {coursePrerequisites.map(prereqId => (
                              <div 
                                key={prereqId} 
                                className={`${styles.tag} ${isDarkMode ? styles.dark : styles.light}`}
                              >
                                <span>{getCourseNameById(prereqId)}</span>
                                <button 
                                  onClick={() => removePrerequisite(prereqId)}
                                  className={styles.removeButton}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className={styles.formGroup}>
                        <label className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                          Course Description
                        </label>
                        <textarea
                          placeholder="Describe what students will learn in this course..."
                          value={courseDescription}
                          onChange={(e) => setCourseDescription(e.target.value)}
                          rows="3"
                          className={`${styles.textarea} ${isDarkMode ? styles.dark : styles.light}`}
                        ></textarea>
                      </div>
                      
                      <div className={styles.buttonGroup}>
                        <button 
                          onClick={addCourse} 
                          className={`${styles.actionButton} ${styles.primaryButton}`}
                        >
                          {editingCourse ? "Update Course" : "Add Course"}
                        </button>
                        
                        {editingCourse && (
                          <button 
                            onClick={cancelEditing} 
                            className={`${styles.actionButton} ${styles.dangerButton}`}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Existing Courses */}
                <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Existing Courses</h2>
                  </div>
                  
                  {Object.keys(filteredCourses()).length === 0 ? (
                    <p className={`${styles.noDataMessage} ${isDarkMode ? styles.dark : styles.light}`}>
                      {searchTerm || filterSubject 
                        ? "No courses match your search criteria" 
                        : "No courses have been created yet"}
                    </p>
                  ) : (
                    <div className={styles.formSection}>
                      {Object.entries(filteredCourses()).map(([subject, courseList]) => (
                        <div key={subject} className={styles.formSection}>
                          <h3 className={styles.cardTitle}>
                            {subject}
                          </h3>
                          <div className={styles.dataGrid}>
                            {courseList.map(course => (
                              <div 
                                key={course.id} 
                                className={`${styles.itemCard} ${isDarkMode ? styles.dark : styles.light}`}
                              >
                                <div className={styles.itemHeader}>
                                  <div>
                                    <h4 className={styles.itemTitle}>{course.course_name}</h4>
                                    <p className={`${styles.itemDetail} ${styles.primary} ${isDarkMode ? styles.dark : styles.light}`}>
                                      {course.credits} {parseInt(course.credits) === 1 ? 'credit' : 'credits'}
                                    </p>
                                  </div>
                                  <div className={styles.buttonGroup}>
                                    <button 
                                      onClick={() => handleEditCourse(course)} 
                                      className={`${styles.actionButton} ${styles.primaryButton}`}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => removeCourse(course.id)} 
                                      className={`${styles.actionButton} ${styles.dangerButton}`}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                
                                {course.description && (
                                  <p className={`${styles.itemDescription} ${isDarkMode ? styles.dark : styles.light}`}>
                                    {course.description}
                                  </p>
                                )}
                                
                                {course.prerequisites && course.prerequisites.length > 0 && (
                                  <div className={styles.formSection}>
                                    <p className={`${styles.inputLabel} ${isDarkMode ? styles.dark : styles.light}`}>
                                      Prerequisites:
                                    </p>
                                    <div className={styles.tagGroup}>
                                      {course.prerequisites.map(prereqId => (
                                        <span 
                                          key={prereqId} 
                                          className={`${styles.tag} ${isDarkMode ? styles.dark : styles.light}`}
                                        >
                                          {getCourseNameById(prereqId)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === "stats" && (
              <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light} ${styles.slideInUp}`}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Dashboard Statistics</h2>
                </div>
                
                <div className={styles.statsGrid}>
                  <div className={`${styles.statCard} ${styles.blue} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                      {stats.studentsCount}
                    </div>
                    <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Students</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.purple} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                      {stats.totalDegrees}
                    </div>
                    <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Degrees</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.green} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                      {stats.totalCourses}
                    </div>
                    <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Courses</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.yellow} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                      {stats.totalSubjects}
                    </div>
                    <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Subject Areas</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.indigo} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                      {stats.totalCredits}
                    </div>
                    <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Total Credits Available</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.red} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={`${styles.statValue} ${isDarkMode ? styles.dark : styles.light}`}>
                      {stats.averageCreditsPerCourse}
                    </div>
                    <div className={`${styles.statLabel} ${isDarkMode ? styles.dark : styles.light}`}>Avg. Credits Per Course</div>
                  </div>
                </div>
                
                {Object.keys(stats.studentsPerDegree).length > 0 && (
                  <div className={styles.formSection}>
                    <h3 className={styles.cardTitle}>Students Per Degree Program</h3>
                    <div className={styles.dataGrid}>
                      {Object.entries(stats.studentsPerDegree).map(([degree, count]) => (
                        <div 
                          key={degree}
                          className={`${styles.itemCard} ${isDarkMode ? styles.dark : styles.light}`}
                        >
                          <div className={styles.itemHeader}>
                            <span>{degree}</span>
                            <span className={`${styles.itemDetail} ${styles.primary} ${isDarkMode ? styles.dark : styles.light}`}>
                              {count} students
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className={styles.buttonGroup}>
                  <button
                    onClick={downloadCurriculum}
                    className={`${styles.exportButton} ${isDarkMode ? styles.dark : styles.light}`}
                  >
                    Export Curriculum Data
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}