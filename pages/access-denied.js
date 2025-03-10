import { useRouter } from "next/router";
import styles from "../styles/Denied.module.css";

export default function AccessDenied() {
  const router = useRouter();

  return (
    <div className={styles.deniedContainer}>
      <div className={styles.deniedCard}>
        <div className={styles.lockIcon}>🔒</div>
        <div className={styles.errorCode}>Error 403</div>
        <h1 className={styles.deniedTitle}>Access Denied</h1>
        <p className={styles.deniedMessage}>
          You don't have permission to access this page. Please sign in with an authorized account or contact your administrator for assistance.
        </p>
        
        <div className={styles.actionContainer}>
          <button 
            onClick={() => router.push("/auth")} 
            className={styles.actionButton}
          >
            Return to Login
          </button>
          <button 
            onClick={() => router.push("/")} 
            className={styles.secondaryButton}
          >
            Back to Home
          </button>
        </div>
      </div>
      
      <div className={styles.brandFooter}>
        <span className={styles.logoText}>AcadEx</span> DegreeTracker
      </div>
    </div>
  );
}