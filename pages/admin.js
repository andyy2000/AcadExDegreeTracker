import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { auth, db, logout } from "../firebase";
import { ref, set, push, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import styles from "../styles/Admin.module.css";

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [counselors, setCounselors] = useState([{ name: "", email: "" }]);
  const [schoolId, setSchoolId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statsData, setStatsData] = useState({
    schools: 0,
    counselors: 0,
    students: 0,
    courses: 0
  });
  const router = useRouter();

// Check authentication status
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      setUser(currentUser);
      
      // Check if the user is an admin by checking the admin key in the database
      const adminRef = ref(db, "admin");
      const adminSnapshot = await get(adminRef);
      const isAdmin = adminSnapshot.exists() && adminSnapshot.val() === currentUser.email;
      
      setIsAuthorized(isAdmin);
      
      if (!isAdmin) {
        router.push("/access-denied");
      } else {
        // Load stats data
        await loadStats();
      }
    } else {
      setUser(null);
      setIsAuthorized(false);
      router.push("/auth");
    }
  });
  return () => unsubscribe();
}, [router]);

  // Load statistics
  const loadStats = async () => {
    try {
      const schoolsRef = ref(db, "schools");
      const snapshot = await get(schoolsRef);
      
      if (snapshot.exists()) {
        const schools = snapshot.val();
        const schoolCount = Object.keys(schools).length;
        
        let counselorCount = 0;
        let studentCount = 0;
        let courseCount = 0;
        
        Object.values(schools).forEach(school => {
          // Count counselors (single or multiple)
          if (school.counselor) counselorCount++;
          if (school.counselors) counselorCount += school.counselors.length;
          
          if (school.students) {
            studentCount += Object.keys(school.students).length;
            
            Object.values(school.students).forEach(student => {
              if (student.courses) {
                courseCount += Object.keys(student.courses).length;
              }
            });
          }
        });
        
        setStatsData({
          schools: schoolCount,
          counselors: counselorCount,
          students: studentCount,
          courses: courseCount
        });
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // Handle counselor input change
  const handleCounselorChange = (index, field, value) => {
    const updatedCounselors = [...counselors];
    updatedCounselors[index][field] = value;
    setCounselors(updatedCounselors);
  };

  // Add another counselor field
  const addCounselorField = () => {
    setCounselors([...counselors, { name: "", email: "" }]);
  };

  // Remove a counselor field
  const removeCounselorField = (index) => {
    if (counselors.length > 1) {
      const updatedCounselors = [...counselors];
      updatedCounselors.splice(index, 1);
      setCounselors(updatedCounselors);
    }
  };

  // Create a school (Only allowed for Andy Yang)
  const createSchool = async (e) => {
    e.preventDefault();
    if (!user || !isAuthorized) {
      setErrorMessage("Permission denied: Only administrators can create schools.");
      return;
    }

    if (!schoolName || !schoolAddress) {
      setErrorMessage("Please fill in all required school fields.");
      return;
    }

    // Validate counselors
    const validCounselors = counselors.filter(c => c.name && c.email);
    if (validCounselors.length === 0) {
      setErrorMessage("At least one counselor with name and email is required.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const newSchoolRef = push(ref(db, "schools"));
      const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      await set(newSchoolRef, {
        name: schoolName,
        address: schoolAddress,
        counselors: validCounselors, 
        join_code: joinCode,
        created_by: user.email,
        created_at: new Date().toISOString()
      });

      setSchoolId(newSchoolRef.key);
      setSuccessMessage(`School created successfully! Join code: ${joinCode}`);
      
      // Clear input fields
      setSchoolName("");
      setSchoolAddress("");
      setCounselors([{ name: "", email: "" }]);
      
      // Refresh stats
      await loadStats();
    } catch (error) {
      console.error("Error creating school:", error);
      setErrorMessage("An error occurred while creating the school. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user || !user.displayName) return "AD";
    const names = user.displayName.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return names[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className={styles.adminContainer}>
      {/* Sidebar */}
      <div className={styles.adminSidebar}>
        <div className={styles.brandContainer}>
          <div className={styles.brandLogo}>A</div>
          <div>
            <div className={styles.brandName}>AcadEx</div>
            <div className={styles.brandTagline}>DegreeTracker</div>
          </div>
        </div>
        
        <div className={styles.navMenu}>
          <div className={`${styles.navItem} ${styles.navItemActive}`}>
            <div className={styles.navIcon}>🏠</div>
            <div className={styles.navText}>Dashboard</div>
          </div>
          <div className={styles.navItem}>
            <div className={styles.navIcon}>🏫</div>
            <div className={styles.navText}>Schools</div>
          </div>
          <div className={styles.navItem}>
            <div className={styles.navIcon}>👨‍🏫</div>
            <div className={styles.navText}>Counselors</div>
          </div>
          <div className={styles.navItem}>
            <div className={styles.navIcon}>👨‍🎓</div>
            <div className={styles.navText}>Students</div>
          </div>
          <div className={styles.navItem}>
            <div className={styles.navIcon}>📊</div>
            <div className={styles.navText}>Reports</div>
          </div>
        </div>
        
        <div className={styles.adminControlLabel}>Administration</div>
        <div className={styles.navMenu}>
          <div className={styles.navItem}>
            <div className={styles.navIcon}>⚙️</div>
            <div className={styles.navText}>Settings</div>
          </div>
          <div className={styles.navItem} onClick={() => logout(router)}>
            <div className={styles.navIcon}>🚪</div>
            <div className={styles.navText}>Logout</div>
          </div>
        </div>
        
        <div className={styles.adminFooter}>
          AcadEx DegreeTracker v2.0.3
        </div>
      </div>
      
      {/* Main Content */}
      <div className={styles.adminMain}>
        {user ? (
          <>
            {/* Header */}
            <header className={styles.adminHeader}>
              <h1 className={styles.pageTitle}>Admin Dashboard</h1>
              
              <div className={styles.userSection}>
                <div className={styles.adminAvatar}>
                  {getUserInitials()}
                </div>
                <div className={styles.adminUserInfo}>
                  <div className={styles.adminUserName}>{user.displayName}</div>
                  <div className={styles.adminUserRole}>System Administrator</div>
                </div>
              </div>
            </header>
            
            <div className={styles.adminContent}>
              {/* Stats Section */}
              <div className={styles.statsContainer}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>🏫</div>
                  <div className={styles.statValue}>{statsData.schools}</div>
                  <div className={styles.statLabel}>Schools</div>
                </div>
                
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>👨‍🏫</div>
                  <div className={styles.statValue}>{statsData.counselors}</div>
                  <div className={styles.statLabel}>Counselors</div>
                </div>
                
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>👨‍🎓</div>
                  <div className={styles.statValue}>{statsData.students}</div>
                  <div className={styles.statLabel}>Students</div>
                </div>
                
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>📚</div>
                  <div className={styles.statValue}>{statsData.courses}</div>
                  <div className={styles.statLabel}>Courses Planned</div>
                </div>
              </div>
              
              {/* Create School Form */}
              {isAuthorized && (
                <div className={styles.schoolFormContainer}>
                  <h2 className={styles.formTitle}>
                    <span className={styles.formIcon}>➕</span>
                    Create New School
                  </h2>
                  
                  <form onSubmit={createSchool}>
                    <div className={styles.formGrid}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>School Name</label>
                        <input
                          type="text"
                          placeholder="Enter school name"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          className={styles.formInput}
                          required
                        />
                      </div>
                      
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>School Address</label>
                        <input
                          type="text"
                          placeholder="Enter school address"
                          value={schoolAddress}
                          onChange={(e) => setSchoolAddress(e.target.value)}
                          className={styles.formInput}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className={styles.counselorSection}>
                      <div className={styles.counselorHeader}>
                        <h3 className={styles.counselorTitle}>Counselors</h3>
                        <button 
                          type="button" 
                          onClick={addCounselorField} 
                          className={styles.addCounselorButton}
                        >
                          Add Counselor
                        </button>
                      </div>
                      
                      {counselors.map((counselor, index) => (
                        <div key={index} className={styles.counselorCard}>
                          <div className={styles.counselorCardHeader}>
                            <span className={styles.counselorNumber}>Counselor #{index + 1}</span>
                            {counselors.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => removeCounselorField(index)} 
                                className={styles.removeCounselorButton}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          
                          <div className={styles.formGrid}>
                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Name</label>
                              <input
                                type="text"
                                placeholder="Counselor name"
                                value={counselor.name}
                                onChange={(e) => handleCounselorChange(index, "name", e.target.value)}
                                className={styles.formInput}
                                required={index === 0}
                              />
                            </div>
                            
                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Email</label>
                              <input
                                type="email"
                                placeholder="Counselor email"
                                value={counselor.email}
                                onChange={(e) => handleCounselorChange(index, "email", e.target.value)}
                                className={styles.formInput}
                                required={index === 0}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      type="submit"
                      className={styles.formSubmitButton}
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating School..." : "Create School"}
                    </button>
                  </form>
                  
                  {successMessage && (
                    <div className={styles.successMessage}>
                      {successMessage}
                    </div>
                  )}
                  
                  {errorMessage && (
                    <div className={styles.errorMessage}>
                      {errorMessage}
                    </div>
                  )}
                </div>
              )}
              
              {!isAuthorized && (
                <div className={styles.errorMessage}>
                  You do not have permission to create schools. Only administrators can perform this action.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-3 text-lg">Verifying credentials...</p>
          </div>
        )}
      </div>
    </div>
  );
}