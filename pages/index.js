import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

export default function Home() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/auth');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>A</span>
          <span className={styles.logoText}>AcadEx</span>
          <span className={styles.logoTagline}>DegreeTracker</span>
        </div>
        
        <h1 className={styles.title}>
          Navigate Your Academic Journey With Precision
        </h1>
        
        <div>
          <p className={styles.description}>
            AcadEx DegreeTracker streamlines your path to graduation with advanced degree tracking, 
            personalized course planning, and expert academic guidance.
          </p>
          
          <div className={styles.featureGrid}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Real-time Progress Tracking</h3>
              <p>Visualize your degree completion with interactive dashboards</p>
            </div>
            
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>📝</div>
              <h3>Smart Course Planning</h3>
              <p>AI-powered recommendations based on your academic goals</p>
            </div>
            
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>👥</div>
              <h3>Counselor Connection</h3>
              <p>Direct access to academic advisors who know your history</p>
            </div>
            
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>🔒</div>
              <h3>Secure Platform</h3>
              <p>Enterprise-grade security for your academic information</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleLogin}
          className={styles.loginButton}
        >
          <svg className={styles.googleIcon} viewBox="0 0 24 24">
            <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
          </svg>
          Sign in with Google
        </button>
        
        <p className={styles.trustedBy}>
          Trusted by leading educational institutions across the country
        </p>
      </div>
      
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>
            <span>AcadEx</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
          <div className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} AcadEx Technology, Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}