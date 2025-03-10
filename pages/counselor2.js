import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, db, logout } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import styles from "../styles/Counselor2.module.css";

export default function Counselor2Page() {
  const [user, setUser] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [schoolData, setSchoolData] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentCourses, setStudentCourses] = useState({});
  const [studentDegree, setStudentDegree] = useState("");
  const [degrees, setDegrees] = useState([]);
  const [degreeDetails, setDegreeDetails] = useState({});
  const [courses, setCourses] = useState([]);
  const [coursesBySubject, setCoursesBySubject] = useState({});
  const [creditSummary, setCreditSummary] = useState({});
  const [newStudentCourse, setNewStudentCourse] = useState({ 
    name: "", 
    subject: "",
    course_id: "",
    grade: "9", 
    status: "In Progress" 
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [recommendedCourses, setRecommendedCourses] = useState([]);

  const router = useRouter();

  useEffect(() => {
    // Check for dark mode preference
    const darkModePreference = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(darkModePreference);
    
    if (darkModePreference) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        validateCounselor(currentUser.email);
      } else {
        setUser(null);
        router.push("/auth");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Show notification
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const validateCounselor = async (email) => {
    try {
      const schoolsRef = ref(db, "schools");
      const snapshot = await get(schoolsRef);
  
      if (snapshot.exists()) {
        let foundSchool = null;
  
        snapshot.forEach((childSnapshot) => {
          const school = childSnapshot.val();
          
          // Check for counselors object with numeric keys
          if (school.counselors) {
            // Loop through each counselor in the array/object
            Object.keys(school.counselors).forEach(key => {
              const counselor = school.counselors[key];
              
              console.log("Checking counselor:", counselor);
              
              if (counselor && 
                  counselor.email && 
                  counselor.email.toLowerCase() === email.toLowerCase()) {
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
          loadStudents(foundSchool.id);
          loadDegrees(foundSchool.id);
          loadCourses(foundSchool.id);
        } else {
          console.log("No matching school found for counselor email:", email);
          router.push("/access-denied");
        }
      }
    } catch (error) {
      console.error("Error validating counselor:", error);
      showNotification("Failed to validate counselor access.", "error");
    }
  };

  const loadDegrees = async (id) => {
    const degreesRef = ref(db, `schools/${id}/degrees`);
    const degreesSnap = await get(degreesRef);

    if (degreesSnap.exists()) {
      const degreeData = degreesSnap.val();
      setDegrees(Object.keys(degreeData));
      setDegreeDetails(degreeData);
    }
  };

  const loadCourses = async (id) => {
    const coursesRef = ref(db, `schools/${id}/courses`);
    const coursesSnap = await get(coursesRef);

    if (coursesSnap.exists()) {
      const courseList = Object.entries(coursesSnap.val()).map(([key, value]) => ({
        id: key,
        ...value
      }));
      
      setCourses(courseList);
      
      // Organize courses by subject
      const bySubject = courseList.reduce((acc, course) => {
        const subject = course.subject_type || "Uncategorized";
        if (!acc[subject]) acc[subject] = [];
        acc[subject].push(course);
        return acc;
      }, {});
      
      setCoursesBySubject(bySubject);
    }
  };

  const loadStudents = async (id) => {
    const studentsRef = ref(db, `schools/${id}/students`);
    const studentsSnap = await get(studentsRef);

    if (studentsSnap.exists()) {
      setStudents(
        Object.entries(studentsSnap.val()).map(([key, value]) => ({
          id: key,
          ...value
        }))
      );
    }
  };

  const toggleStudentSelection = async (student) => {
    if (selectedStudent?.id === student.id) {
      setSelectedStudent(null);
      setStudentDegree("");
      setCreditSummary({});
      setRecommendedCourses([]);
    } else {
      setSelectedStudent(student);
      await loadStudentCourses(student);
      
      // Load student's degree if assigned
      if (student.degree) {
        setStudentDegree(student.degree);
      } else {
        // Check if degree is stored as a separate property
        const studentDegreeRef = ref(db, `schools/${schoolId}/students/${student.id}/degree`);
        const degreeSnap = await get(studentDegreeRef);
        
        if (degreeSnap.exists()) {
          setStudentDegree(degreeSnap.val());
        } else {
          setStudentDegree("");
        }
      }
    }
  };

  const loadStudentCourses = async (student) => {
    const studentCoursesRef = ref(db, `schools/${schoolId}/students/${student.id}/courses`);
    const coursesSnap = await get(studentCoursesRef);

    if (coursesSnap.exists()) {
      const organizedCourses = { "9": [], "10": [], "11": [], "12": [] };

      Object.entries(coursesSnap.val()).forEach(([key, value]) => {
        // Make sure we have a valid grade to organize by
        const grade = value.grade || "9";
        if (organizedCourses[grade]) {
          organizedCourses[grade].push({ id: key, ...value });
        }
      });

      setStudentCourses(organizedCourses);
      updateCreditSummary(organizedCourses, student);
    } else {
      setStudentCourses({ "9": [], "10": [], "11": [], "12": [] });
      setCreditSummary({});
    }
  };

  // Calculate credit summary for the student
  const updateCreditSummary = (studentCourses, student) => {
    // Get the student's assigned degree
    const degreeId = student.degree || studentDegree;
    
    if (!degreeId || !degreeDetails[degreeId]) {
      setCreditSummary({});
      return;
    }

    const degree = degreeDetails[degreeId];
    
    // Initialize credit summary with required subjects from degree
    const summary = {};
    let totalCompletedCredits = 0;
    let totalRequiredCredits = 0;
    let electiveCredits = 0;
    
    // Setup subjects from degree requirements
    if (degree.subjects) {
      degree.subjects.forEach(subject => {
        summary[subject.name] = {
          required: parseInt(subject.requiredCredits) || 0,
          completed: 0,
          courses: []
        };
        totalRequiredCredits += parseInt(subject.requiredCredits) || 0;
      });
    }
    
    // Add "Electives" category
    summary["Electives"] = {
      required: 0,
      completed: 0,
      courses: []
    };
    
    // Count completed courses and credits
    const allCourses = [
      ...studentCourses["9"], 
      ...studentCourses["10"], 
      ...studentCourses["11"], 
      ...studentCourses["12"]
    ];
    
    allCourses.forEach(course => {
      // Only count completed courses
      if (course.status === "Completed") {
        // Find the course in our course database to get subject and credits
        const courseDetails = courses.find(c => c.id === course.course_id);
        
        if (courseDetails) {
          const subject = courseDetails.subject_type;
          const credits = parseInt(courseDetails.credits) || 0;
          
          if (summary[subject]) {
            // If this subject exists in the degree requirements
            if (summary[subject].completed < summary[subject].required) {
              // If we still need credits in this subject
              const creditsToAdd = Math.min(
                credits, 
                summary[subject].required - summary[subject].completed
              );
              
              summary[subject].completed += creditsToAdd;
              summary[subject].courses.push({
                ...course,
                credits: creditsToAdd,
                overflow: credits - creditsToAdd
              });
              
              // If there are overflow credits, add them to electives
              if (credits - creditsToAdd > 0) {
                electiveCredits += (credits - creditsToAdd);
                summary["Electives"].completed += (credits - creditsToAdd);
                summary["Electives"].courses.push({
                  ...course,
                  credits: credits - creditsToAdd
                });
              }
            } else {
              // All requirements for this subject are met, add to electives
              electiveCredits += credits;
              summary["Electives"].completed += credits;
              summary["Electives"].courses.push({
                ...course,
                credits: credits
              });
            }
          } else {
            // If subject doesn't exist in degree requirements, add to electives
            electiveCredits += credits;
            summary["Electives"].completed += credits;
            summary["Electives"].courses.push({
              ...course,
              credits: credits
            });
          }
          
          totalCompletedCredits += credits;
        } else if (course.credits) {
          // If course is not in database but has credits field
          const credits = parseInt(course.credits) || 0;
          electiveCredits += credits;
          summary["Electives"].completed += credits;
          summary["Electives"].courses.push(course);
          totalCompletedCredits += credits;
        }
      }
    });
    
    // Add total summary
    summary["Total"] = {
      required: totalRequiredCredits,
      completed: totalCompletedCredits,
      electives: electiveCredits
    };
    
    setCreditSummary(summary);

    // Generate recommended courses based on missing requirements
    generateRecommendations(summary, degreeId);
  };

  // Generate course recommendations based on credit summary
  const generateRecommendations = (summary, degreeId) => {
    if (!summary.Total || !degreeDetails[degreeId]) return;
    
    const recommendations = [];
    const degree = degreeDetails[degreeId];
    
    // Look for subjects that need more credits
    Object.entries(summary).forEach(([subject, data]) => {
      if (subject !== "Total" && subject !== "Electives" && data.required > data.completed) {
        // Find courses in this subject that the student hasn't taken yet
        const subjectCourses = coursesBySubject[subject] || [];
        const completedCourseIds = data.courses.map(c => c.course_id);
        
        const availableCourses = subjectCourses.filter(
          course => !completedCourseIds.includes(course.id)
        );
        
        // Sort by credits (higher credits first)
        availableCourses.sort((a, b) => parseInt(b.credits) - parseInt(a.credits));
        
        // Add top 2 courses to recommendations
        availableCourses.slice(0, 2).forEach(course => {
          recommendations.push({
            id: course.id,
            name: course.course_name,
            subject: subject,
            credits: course.credits,
            priority: "high",
            reason: `Need ${data.required - data.completed} more credits in ${subject}`
          });
        });
      }
    });
    
    setRecommendedCourses(recommendations);
  };

  const updateStudentDegree = async () => {
    if (!selectedStudent || !studentDegree) return;

    try {
      await set(ref(db, `schools/${schoolId}/students/${selectedStudent.id}/degree`), studentDegree);
      
      // Update the selected student in memory
      setSelectedStudent({
        ...selectedStudent,
        degree: studentDegree
      });
      
      // Update credit summary based on new degree
      updateCreditSummary(studentCourses, {
        ...selectedStudent,
        degree: studentDegree
      });
      
      showNotification("Degree assigned successfully!");
    } catch (error) {
      console.error("Error updating degree:", error);
      showNotification("Failed to assign degree. Please try again.", "error");
    }
  };

  const addStudentCourse = async () => {
    if (!selectedStudent || !newStudentCourse.course_id) return;
    
    try {
      // Get course details from course ID
      const selectedCourse = courses.find(course => course.id === newStudentCourse.course_id);
      
      if (!selectedCourse) {
        showNotification("Please select a valid course", "error");
        return;
      }
      
      const courseToAdd = {
        name: selectedCourse.course_name,
        subject: selectedCourse.subject_type,
        course_id: selectedCourse.id,
        credits: selectedCourse.credits,
        grade: newStudentCourse.grade,
        status: newStudentCourse.status
      };
      
      const studentCourseRef = push(ref(db, `schools/${schoolId}/students/${selectedStudent.id}/courses`));
      await set(studentCourseRef, courseToAdd);
      
      setNewStudentCourse({ 
        name: "", 
        subject: "",
        course_id: "",
        grade: "9", 
        status: "In Progress" 
      });
      
      await loadStudentCourses(selectedStudent);
      showNotification("Course added successfully!");
    } catch (error) {
      console.error("Error adding course:", error);
      showNotification("Failed to add course. Please try again.", "error");
    }
  };

  const updateCourseStatus = async (courseId, newStatus) => {
    if (!selectedStudent) return;
    
    try {
      const courseRef = ref(db, `schools/${schoolId}/students/${selectedStudent.id}/courses/${courseId}/status`);
      await set(courseRef, newStatus);
      await loadStudentCourses(selectedStudent);
      showNotification("Course status updated!");
    } catch (error) {
      console.error("Error updating course status:", error);
      showNotification("Failed to update course status.", "error");
    }
  };

  const removeCourse = async (courseId) => {
    if (!selectedStudent) return;
    
    if (confirm("Are you sure you want to remove this course?")) {
      try {
        const courseRef = ref(db, `schools/${schoolId}/students/${selectedStudent.id}/courses/${courseId}`);
        await remove(courseRef);
        await loadStudentCourses(selectedStudent);
        showNotification("Course removed successfully!");
      } catch (error) {
        console.error("Error removing course:", error);
        showNotification("Failed to remove course.", "error");
      }
    }
  };

  // Add a recommended course directly
  const addRecommendedCourse = async (courseId) => {
    if (!selectedStudent || !courseId) return;
    
    try {
      const selectedCourse = courses.find(course => course.id === courseId);
      
      if (!selectedCourse) {
        showNotification("Course not found", "error");
        return;
      }
      
      const courseToAdd = {
        name: selectedCourse.course_name,
        subject: selectedCourse.subject_type,
        course_id: selectedCourse.id,
        credits: selectedCourse.credits,
        grade: selectedStudent.grade_level || "9", 
        status: "Planned"
      };
      
      const studentCourseRef = push(ref(db, `schools/${schoolId}/students/${selectedStudent.id}/courses`));
      await set(studentCourseRef, courseToAdd);
      
      await loadStudentCourses(selectedStudent);
      showNotification("Recommended course added to plan!");
    } catch (error) {
      console.error("Error adding recommended course:", error);
      showNotification("Failed to add course. Please try again.", "error");
    }
  };

  // Print student transcript
  const printTranscript = () => {
    window.print();
  };

  // Calculate completion percentage for progress bars
  const calculateCompletionPercentage = () => {
    if (!creditSummary.Total) return 0;
    const { required, completed } = creditSummary.Total;
    if (required === 0) return 0;
    return Math.min(100, Math.round((completed / required) * 100));
  };

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : styles.light}`}>
      <div className={styles.mainWrapper}>
        {/* Header */}
        <header className={`${styles.header} ${isDarkMode ? styles.dark : styles.light}`}>
          <div className={styles.headerContent}>
            <h1 className={styles.dashboardTitle}>Academic Counselor Portal</h1>
            <div className={styles.actionButtons}>
              <button 
                onClick={toggleDarkMode}
                className={`${styles.iconButton} ${styles.darkModeButton} ${isDarkMode ? styles.dark : styles.light}`}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? "☀️" : "🌙"}
              </button>
              
              <button 
                onClick={() => router.push("/counselor")} 
                className={`${styles.actionButton} ${styles.primaryButton}`}
              >
                Curriculum Management
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
            <div className={`${styles.welcomeText} ${isDarkMode ? styles.dark : styles.light}`}>
              Welcome, {user?.displayName} | School: {schoolData?.name}
            </div>
          )}
        </header>

        {notification && (
          <div className={`${styles.notification} ${styles[notification.type]} ${isDarkMode ? styles.dark : ""}`}>
            {notification.message}
          </div>
        )}

        {!isAuthorized ? (
          <div className={styles.loadingIndicator}>
            <div className={styles.loadingSpinner}></div>
            <div className={`${styles.loadingText} ${isDarkMode ? styles.dark : styles.light}`}>
              Validating counselor access...
            </div>
          </div>
        ) : (
          <>
            {/* Main content */}
            <div className={styles.gridContainer}>
              {/* Left sidebar - Student list */}
              <div className={`${styles.studentSidebar} ${isDarkMode ? styles.dark : styles.light}`}>
                <h2 className={styles.sidebarTitle}>Students</h2>
                {students.length === 0 ? (
                  <p>No students enrolled yet</p>
                ) : (
                  <ul className={`${styles.studentsList} ${isDarkMode ? styles.dark : ""}`}>
                    {students.map((student) => (
                      <li key={student.id} className={styles.studentItem}>
                        <button
                          onClick={() => toggleStudentSelection(student)}
                          className={`${styles.studentButton} ${selectedStudent?.id === student.id ? styles.active : ""} ${isDarkMode ? styles.dark : ""}`}
                        >
                          <span className={styles.studentName}>{student.first_name} {student.last_name}</span>
                          <span className={`${styles.studentGrade} ${isDarkMode ? styles.dark : ""}`}>Grade: {student.grade_level}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Main content area */}
              <div className={styles.contentArea}>
                {selectedStudent ? (
                  <>
                    {/* Student info header */}
                    <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                      <div className={styles.studentHeader}>
                        <div className={styles.studentInfo}>
                          <h2 className={styles.studentName}>{selectedStudent.first_name} {selectedStudent.last_name}</h2>
                          <p className={`${styles.profileDetails} ${isDarkMode ? styles.dark : ""}`}>
                            Grade: {selectedStudent.grade_level} | ID: {selectedStudent.id.substring(0, 8)}
                          </p>
                        </div>
                        <button 
                          onClick={printTranscript}
                          className={`${styles.printButton} ${isDarkMode ? styles.dark : ""}`}
                          title="Print student transcript"
                        >
                          🖨️ Print Transcript
                        </button>
                      </div>
                      
                      {/* Progress visualization */}
                      {creditSummary.Total && (
                        <div className={styles.progressContainer}>
                          <div className={styles.progressLabel}>
                            <span className={styles.progressText}>Degree Completion</span>
                            <span className={`${styles.progressPercent} ${isDarkMode ? styles.dark : ""}`}>
                              {calculateCompletionPercentage()}%
                            </span>
                          </div>
                          <div className={`${styles.progressBar} ${isDarkMode ? styles.dark : ""}`}>
                            <div 
                              className={styles.progressFill} 
                              style={{ width: `${calculateCompletionPercentage()}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Degree assignment */}
                      <div className={`${styles.degreeSection} ${isDarkMode ? styles.dark : ""}`}>
                        <h3 className={styles.sectionHeading}>Assign Degree Program</h3>
                        <div className={styles.selectGroup}>
                          <select
                            value={studentDegree}
                            onChange={(e) => setStudentDegree(e.target.value)}
                            className={`${styles.selectBox} ${isDarkMode ? styles.dark : ""}`}
                          >
                            <option value="">Select Degree</option>
                            {degrees.map((degree) => (
                              <option key={degree} value={degree}>{degree}</option>
                            ))}
                          </select>
                          <button 
                            onClick={updateStudentDegree}
                            disabled={!studentDegree} 
                            className={`${styles.actionButton} ${styles.primaryButton}`}
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations section (new feature) */}
                    {recommendedCourses.length > 0 && (
                      <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                        <h3 className={`${styles.cardTitle} ${isDarkMode ? styles.dark : ""}`}>
                          Recommended Courses
                        </h3>
                        <p className={`${styles.itemDescription} ${isDarkMode ? styles.dark : ""}`}>
                          Based on degree requirements, consider adding these courses:
                        </p>
                        <div className={styles.recommendationsList}>
                          {recommendedCourses.map((course) => (
                            <div 
                              key={course.id}
                              className={`${styles.recommendationCard} ${isDarkMode ? styles.dark : ""}`}
                              onClick={() => addRecommendedCourse(course.id)}
                              title="Click to add this course"
                            >
                              <div className={styles.recommendationTitle}>{course.name}</div>
                              <div className={`${styles.recommendationDetails} ${isDarkMode ? styles.dark : ""}`}>
                                <span className={styles.recommendationSubject}>{course.subject}</span>
                                <span className={styles.recommendationCredits}>{course.credits} credits</span>
                              </div>
                              <div className={`${styles.itemDescription} ${isDarkMode ? styles.dark : ""}`}>
                                {course.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Credit Summary */}
                    {studentDegree && (
                      <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                        <h3 className={`${styles.cardTitle} ${isDarkMode ? styles.dark : ""}`}>
                          Credit Summary for {studentDegree}
                        </h3>
                        
                        <div className={styles.tableContainer}>
                          <table className={styles.summaryTable}>
                            <thead>
                              <tr>
                                <th className={isDarkMode ? styles.dark : ""}>Subject</th>
                                <th className={isDarkMode ? styles.dark : ""}>Required</th>
                                <th className={isDarkMode ? styles.dark : ""}>Completed</th>
                                <th className={isDarkMode ? styles.dark : ""}>Remaining</th>
                                <th className={isDarkMode ? styles.dark : ""}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(creditSummary).map(([subject, credits], index) => {
                                if (subject === "Total") return null;
                                
                                // Calculate completion status
                                let status = "incomplete";
                                if (credits.required === 0) {
                                  status = "complete"; // Electives have no requirements
                                } else if (credits.completed >= credits.required) {
                                  status = "complete";
                                }
                                
                                return (
                                  <tr 
                                    key={index} 
                                    className={status === "complete" ? styles.completed : ""}
                                  >
                                    <td className={isDarkMode ? styles.dark : ""}>{subject}</td>
                                    <td className={isDarkMode ? styles.dark : ""}>{credits.required}</td>
                                    <td className={isDarkMode ? styles.dark : ""}>{credits.completed}</td>
                                    <td className={isDarkMode ? styles.dark : ""}>
                                      {credits.required > 0 ? Math.max(0, credits.required - credits.completed) : "N/A"}
                                    </td>
                                    <td className={isDarkMode ? styles.dark : ""}>
                                      <span className={`${styles.requirementBadge} ${styles[status]} ${isDarkMode ? styles.dark : ""}`}>
                                        {status === "complete" ? "Complete" : "In Progress"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                              
                              {/* Total row */}
                              {creditSummary.Total && (
                                <tr className={styles.total}>
                                  <td className={isDarkMode ? styles.dark : ""}>Total Credits</td>
                                  <td className={isDarkMode ? styles.dark : ""}>{creditSummary.Total.required}</td>
                                  <td className={isDarkMode ? styles.dark : ""}>{creditSummary.Total.completed}</td>
                                  <td className={isDarkMode ? styles.dark : ""}>
                                    {Math.max(0, creditSummary.Total.required - creditSummary.Total.completed)}
                                  </td>
                                  <td className={isDarkMode ? styles.dark : ""}>
                                    <span className={`${styles.requirementBadge} ${
                                      creditSummary.Total.completed >= creditSummary.Total.required ? 
                                      styles.completed : styles.inProgress} ${isDarkMode ? styles.dark : ""}`}>
                                      {creditSummary.Total.completed >= creditSummary.Total.required ? 
                                        "Complete" : 
                                        `${Math.round((creditSummary.Total.completed / creditSummary.Total.required) * 100)}%`}
                                    </span>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        
                        {creditSummary.Total && (
                          <div className={`${styles.creditSummaryFooter} ${isDarkMode ? styles.dark : ""}`}>
                            <div>Elective Credits: {creditSummary.Total.electives || 0}</div>
                            <div>Total Credits Completed: {creditSummary.Total.completed || 0}</div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Add Course */}
                    <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                      <h3 className={`${styles.cardTitle} ${isDarkMode ? styles.dark : ""}`}>Add Course</h3>
                      
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label className={`${styles.formLabel} ${isDarkMode ? styles.dark : ""}`}>Subject</label>
                          <select
                            value={newStudentCourse.subject}
                            onChange={(e) => {
                              setNewStudentCourse({
                                ...newStudentCourse,
                                subject: e.target.value,
                                course_id: ""
                              });
                            }}
                            className={`${styles.selectInput} ${isDarkMode ? styles.dark : ""}`}
                          >
                            <option value="">Select Subject</option>
                            {Object.keys(coursesBySubject).map((subject) => (
                              <option key={subject} value={subject}>{subject}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className={styles.formGroup}>
  <label className={`${styles.formLabel} ${isDarkMode ? styles.dark : ""}`}>Course</label>
  <select
    value={newStudentCourse.course_id}
    onChange={(e) => {
      setNewStudentCourse({
        ...newStudentCourse,
        course_id: e.target.value
      });
    }}
    className={`${styles.selectInput} ${isDarkMode ? styles.dark : ""}`}
    disabled={!newStudentCourse.subject}
  >
    <option value="">Select Course</option>
    {newStudentCourse.subject && 
      coursesBySubject[newStudentCourse.subject]?.map((course) => {
        // Check if the course is already assigned to the student in any grade
        const isAlreadyAssigned = Object.values(studentCourses).flat().some(
          studentCourse => studentCourse.course_id === course.id
        );
        
        // Only render option if course is not already assigned
        if (!isAlreadyAssigned) {
          return (
            <option key={course.id} value={course.id}>
              {course.course_name} ({course.credits} credits)
            </option>
          );
        }
        
        // Option to show the course as disabled if already assigned
        return (
          <option key={course.id} value={course.id} disabled>
            {course.course_name} ({course.credits} credits) - Already Assigned
          </option>
        );
      })
    }
  </select>
</div>
                        
                        <div className={styles.formGroup}>
                          <label className={`${styles.formLabel} ${isDarkMode ? styles.dark : ""}`}>Grade Level</label>
                          <select
                            value={newStudentCourse.grade}
                            onChange={(e) => {
                              setNewStudentCourse({
                                ...newStudentCourse,
                                grade: e.target.value
                              });
                            }}
                            className={`${styles.selectInput} ${isDarkMode ? styles.dark : ""}`}
                          >
                            <option value="9">Grade 9</option>
                            <option value="10">Grade 10</option>
                            <option value="11">Grade 11</option>
                            <option value="12">Grade 12</option>
                          </select>
                        </div>
                        
                        <div className={styles.formGroup}>
                          <label className={`${styles.formLabel} ${isDarkMode ? styles.dark : ""}`}>Status</label>
                          <select
                            value={newStudentCourse.status}
                            onChange={(e) => {
                              setNewStudentCourse({
                                ...newStudentCourse,
                                status: e.target.value
                              });
                            }}
                            className={`${styles.selectInput} ${isDarkMode ? styles.dark : ""}`}
                          >
                            <option value="Planned">Planned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Failed">Failed</option>
                          </select>
                        </div>
                      </div>
                      
                      <button
                        onClick={addStudentCourse}
                        disabled={!newStudentCourse.course_id}
                        className={!newStudentCourse.course_id ? 
                          `${styles.fullWidthButton}` : 
                          `${styles.fullWidthButton} ${styles.success}`}
                      >
                        Add Course
                      </button>
                    </div>
                    
                    {/* Student Courses by Grade */}
                    <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                      <h3 className={`${styles.cardTitle} ${isDarkMode ? styles.dark : ""}`}>
                        Course Plan
                      </h3>
                      
                      <div className={styles.gradeGrid}>
                        {["9", "10", "11", "12"].map((grade) => (
                          <div key={grade} className={`${styles.gradeCard} ${isDarkMode ? styles.dark : ""}`}>
                            <div className={`${styles.gradeHeader} ${isDarkMode ? styles.dark : ""}`}>
                              Grade {grade}
                            </div>
                            <div className={styles.gradeContent}>
                              {studentCourses[grade]?.length === 0 ? (
                                <p className={styles.noCourses}>No courses planned</p>
                              ) : (
                                <ul className={styles.coursesList}>
                                  {studentCourses[grade]?.map((course) => {
                                    // Find original course to get credit info
                                    const courseInfo = courses.find(c => c.id === course.course_id);
                                    const credits = courseInfo?.credits || course.credits || "?";
                                    
                                    let statusClass = '';
                                    switch(course.status) {
                                      case 'Completed': statusClass = 'completed'; break;
                                      case 'In Progress': statusClass = 'inProgress'; break;
                                      case 'Failed': statusClass = 'failed'; break;
                                      default: statusClass = 'planned'; break;
                                    }
                                    
                                    return (
                                      <li key={course.id} className={`${styles.courseItem} ${isDarkMode ? styles.dark : ""}`}>
                                        <div className={styles.courseHeader}>
                                          <div>
                                            <span className={styles.courseName}>{course.name}</span>
                                            <span className={`${styles.courseCredits} ${isDarkMode ? styles.dark : ""}`}>
                                              ({credits} cr)
                                            </span>
                                            <div className={`${styles.courseSubject} ${isDarkMode ? styles.dark : ""}`}>
                                              {course.subject}
                                            </div>
                                          </div>
                                          <div>
                                            <span className={`${styles.statusBadge} ${styles[statusClass]} ${isDarkMode ? styles.dark : ""}`}>
                                              {course.status}
                                            </span>
                                          </div>
                                        </div>
                                        <div className={styles.courseActions}>
                                          <select
                                            value={course.status}
                                            onChange={(e) => updateCourseStatus(course.id, e.target.value)}
                                            className={`${styles.statusSelect} ${isDarkMode ? styles.dark : ""}`}
                                          >
                                            <option value="Planned">Planned</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Failed">Failed</option>
                                          </select>
                                          <button
                                            onClick={() => removeCourse(course.id)}
                                            className={`${styles.miniButton} ${styles.danger} ${isDarkMode ? styles.dark : ""}`}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`${styles.card} ${isDarkMode ? styles.dark : styles.light}`}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyStateIcon}>👨‍🎓</div>
                      <h3 className={`${styles.cardTitle} ${isDarkMode ? styles.dark : ""}`}>
                        Student Management Center
                      </h3>
                      <p className={`${styles.emptyStateText} ${isDarkMode ? styles.dark : ""}`}>
                        Select a student from the list to manage their degree progress, 
                        review credit status, and plan courses.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Navigation footer */}
            <div className={`${styles.footerNav} ${isDarkMode ? styles.dark : ""}`}>
              <button 
                onClick={() => router.push("/counselor")} 
                className={`${styles.actionButton} ${styles.primaryButton}`}
              >
                Return to Curriculum Management
              </button>
              
              <button 
                onClick={() => logout(router)} 
                className={`${styles.actionButton} ${styles.dangerButton}`}
              >
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}