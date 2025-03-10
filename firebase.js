import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, remove, get } from "firebase/database";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut  
} from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDq9vbx0cBQOuuf4fXeFG4iNnZgby27W3g",
  authDomain: "associates-degree.firebaseapp.com",
  databaseURL: "https://associates-degree-default-rtdb.firebaseio.com",
  projectId: "associates-degree",
  storageBucket: "associates-degree.appspot.com",
  messagingSenderId: "849399339812",
  appId: "1:849399339812:web:b93ed9eec14f4ce5f871b1",
  measurementId: "G-G1T7B259KP"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);  
export const auth = getAuth(app);    
export const googleProvider = new GoogleAuthProvider();

// Google Sign-In Function (Redirects based on user)
export const signInWithGoogle = async (router) => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Save user info to Firebase if not already saved
    const userRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      await set(userRef, {
        name: user.displayName,
        email: user.email,
        createdAt: new Date().toISOString()
      });
    }

    // Check if the user is an admin by checking the admin key in the database
    const adminRef = ref(db, "admin");
    const adminSnapshot = await get(adminRef);
    const isAdmin = adminSnapshot.exists() && adminSnapshot.val() === user.email;

    // Check if the user is a counselor by searching through all schools
    const schoolsRef = ref(db, "schools");
    const schoolsSnapshot = await get(schoolsRef);
    let isCounselor = false;

    if (schoolsSnapshot.exists()) {
      const schools = schoolsSnapshot.val();

      // Loop through each school
      Object.values(schools).forEach(school => {
        // Check if the school has counselors
        if (school.counselors) {
          // Loop through each counselor in the object
          Object.values(school.counselors).forEach(counselor => {
            if (counselor && counselor.email && counselor.email.toLowerCase() === user.email.toLowerCase()) {
              isCounselor = true;
            }
          });
        }
      });
    }

    // Redirect based on user role
    if (isAdmin) {
      router.push("/admin");
    } else if (isCounselor) {
      router.push("/counselor");
    } else {
      router.push("/dashboard");
    }

    return user;
  } catch (error) {
    console.error("Google Sign-In Error:", error.message);
    return null;
  }
};

// Logout Function
export const logout = async (router) => {
  try {
    await signOut(auth);
    console.log("User signed out");
    router.push("/auth"); // Redirect to login after logout
  } catch (error) {
    console.error("Logout Error:", error.message);
  }
};

// Export Firebase utilities
export { ref, set, push, get, remove };