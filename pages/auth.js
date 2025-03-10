import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, db, signInWithGoogle } from "../firebase";
import { ref, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import styles from "../styles/Auth.module.css";

export default function AuthPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Authentication logic with proper counselors structure handling
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      setUser(currentUser);
      setLoading(true);

      // Add a flag to prevent multiple redirects
      let redirectComplete = false;

// Admin Redirect - Check against database value
const adminRef = ref(db, "admin");
const adminSnapshot = await get(adminRef);
if (adminSnapshot.exists() && adminSnapshot.val() === currentUser.email) {
  console.log("Admin detected, redirecting to admin page");
  redirectComplete = true;
  router.push("/admin");
  return;
}

      try {
        // Check if user is a counselor
        const schoolsRef = ref(db, "schools");
        const snapshot = await get(schoolsRef);
        
        console.log("Auth check - user email:", currentUser.email);
        
        if (snapshot.exists() && !redirectComplete) {
          const schools = snapshot.val();
          
          // Updated counselor detection with proper structure handling
          let isCounselor = false;
          
          for (const school of Object.values(schools)) {
            // Check if school has counselors array/object
            if (school.counselors) {
              // Loop through each counselor in the counselors collection
              for (const counselorKey of Object.keys(school.counselors)) {
                const counselor = school.counselors[counselorKey];
                
                console.log("Checking counselor:", counselor);
                
                if (counselor && 
                  counselor.email && 
                  (counselor.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim() ||
                   currentUser.email.toLowerCase().includes(counselor.email.toLowerCase().trim()) ||
                   counselor.email.toLowerCase().includes(currentUser.email.toLowerCase().trim()))) {
                isCounselor = true;
                console.log("Counselor match found with flexible comparison in school:", school.name || "unnamed school");
                break;
              }
              }
              
              if (isCounselor) break;
            }
          }
          
          if (isCounselor && !redirectComplete) {
            console.log("Counselor detected, redirecting to counselor page");
            redirectComplete = true;
            router.push("/counselor");
            return;
          }
        }
        
        // Only redirect to dashboard if definitely not a counselor and no redirect happened yet
        if (!redirectComplete) {
          console.log("Not admin or counselor, redirecting to dashboard");
          router.push("/dashboard");
        }
        
      } catch (error) {
        console.error("Error in authentication routing:", error);
        // Fallback to dashboard on error only if no redirect happened yet
        if (!redirectComplete) {
          router.push("/dashboard");
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = () => {
    setLoading(true);
    signInWithGoogle(router);
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authSidebar}>
        <div className={styles.sidebarContent}>
          <div className={styles.brandLogo}>
            <span className={styles.logoHighlight}>AcadEx</span> DegreeTracker
          </div>
          <h2 className={styles.sidebarTitle}>Precision Academic Planning</h2>
          <p className={styles.sidebarDescription}>
            Accelerate your path to graduation with data-driven insights and expert guidance.
          </p>
          
          <div className={styles.testimonialContainer}>
            <div className={styles.testimonial}>
              <div className={styles.testimonialText}>
                "AcadEx DegreeTracker revolutionized how our students plan their academic journey. Course completion rates improved by 24% in just one semester."
              </div>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}></div>
                <div>
                  <div className={styles.testimonialName}>Dr. Sarah Mitchell</div>
                  <div className={styles.testimonialRole}>Dean of Student Success, Pacific State University</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.statGrid}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>94%</div>
              <div className={styles.statLabel}>Graduation Rate</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>15K+</div>
              <div className={styles.statLabel}>Students</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>350+</div>
              <div className={styles.statLabel}>Institutions</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.authMainContent}>
        <div className={styles.authCard}>
          <h1 className={styles.authTitle}>Welcome Back</h1>
          <p className={styles.authDescription}>
            Sign in to access your personalized academic dashboard, course recommendations, and degree progress tracking.
          </p>
          
          <div className={styles.authContent}>
            {user ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p className={styles.authRedirect}>Setting up your workspace...</p>
              </div>
            ) : (
              <>
                <div className={styles.featureList}>
                  <div className={styles.featureItem}>
                    <div className={styles.featureIcon}>🎯</div>
                    <div className={styles.featureText}>Track degree progress in real-time</div>
                  </div>
                  <div className={styles.featureItem}>
                    <div className={styles.featureIcon}>📊</div>
                    <div className={styles.featureText}>Interactive dashboards and analytics</div>
                  </div>
                  <div className={styles.featureItem}>
                    <div className={styles.featureIcon}>📝</div>
                    <div className={styles.featureText}>Course planning with smart recommendations</div>
                  </div>
                </div>
                
                <p className={styles.authPrompt}>Sign in using your institutional Google account</p>
                <button 
                  onClick={handleLogin} 
                  className={styles.authButton}
                  disabled={loading}
                >
                  <svg className={styles.googleIcon} viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </button>
                
                <div className={styles.securityInfo}>
                  <div className={styles.securityIcon}>🔒</div>
                  <p className={styles.securityText}>
                    Enterprise-grade security with 256-bit encryption and FERPA compliance
                  </p>
                </div>
                
                <p className={styles.authFooter}>
                  By signing in, you agree to our <a href="#" className={styles.footerLink}>Terms of Service</a> and <a href="#" className={styles.footerLink}>Privacy Policy</a>
                </p>
              </>
            )}
          </div>
        </div>
        
        <div className={styles.authFooterLinks}>
          <a href="#" className={styles.footerLink}>Help Center</a>
          <a href="#" className={styles.footerLink}>Contact Support</a>
          <a href="#" className={styles.footerLink}>About</a>
        </div>
      </div>
    </div>
  );
}