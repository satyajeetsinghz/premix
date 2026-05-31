/**
 * ============================================================================
 * BEATSTREAM - Firebase Configuration
 * ============================================================================
 * File: services/firebase/config.ts
 *
 * ARCHITECTURE OVERVIEW:
 * - Initializes Firebase application instance
 * - Exports pre-configured auth and database instances
 * - Centralized Firebase service configuration
 *
 * SECURITY:
 * - Configuration loaded from environment variables
 * - Sensitive keys (apiKey) stored in .env.local (git-ignored)
 * - Safe to use in frontend (Firebase provides public/private security)
 *
 * ENVIRONMENT VARIABLES (required in .env.local):
 * - VITE_FIREBASE_API_KEY: Public Firebase API key
 * - VITE_FIREBASE_AUTH_DOMAIN: Auth domain for login redirect
 * - VITE_FIREBASE_PROJECT_ID: Firebase project identifier
 * - VITE_FIREBASE_STORAGE_BUCKET: Cloud storage bucket
 * - VITE_FIREBASE_MESSAGING_SENDER_ID: Cloud messaging ID
 * - VITE_FIREBASE_APP_ID: Firebase application ID
 *
 * ============================================================================
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase Configuration Object
 *
 * Contains all Firebase project settings
 * Loaded from environment variables (Vite imports with VITE_ prefix)
 *
 * CONFIG FIELDS:
 * - apiKey: Public API key for browser-based requests
 * - authDomain: Domain used for email/password authentication
 * - projectId: Unique Firebase project identifier
 * - storageBucket: Cloud Storage bucket for file uploads
 * - messagingSenderId: Firebase Cloud Messaging identifier
 * - appId: Unique Firebase application identifier
 *
 * ENVIRONMENT LOADING:
 * - import.meta.env.VITE_* loads variables from .env files
 * - Vite processes these at build time
 * - Variables must be prefixed with VITE_ for browser exposure
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Firebase App Instance
 *
 * Initializes Firebase with the configuration
 * Used to create auth and database instances
 * Singleton: only initialized once at app startup
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication Instance
 *
 * RESPONSIBILITY:
 * - Manage user login/logout
 * - Handle email/password authentication
 * - Manage user sessions
 * - Provide auth state listener (onAuthStateChanged)
 *
 * EXPORTED FOR USE IN:
 * - AuthContext: Sets up auth state listener
 * - auth.service: Login/logout functions
 * - Various services: User ID access
 *
 * METHODS:
 * - Provides Firebase auth methods like signInWithEmailAndPassword
 * - Manages session tokens
 * - Handles credential refresh
 */
export const auth = getAuth(app);

/**
 * Firestore Database Instance
 *
 * RESPONSIBILITY:
 * - Store user profiles in /users collection
 * - Store tracks in /songs collection
 * - Store playlists in /playlists collection
 * - Store user history, likes, and other metadata
 *
 * EXPORTED FOR USE IN:
 * - Authentication services: Save/load user profiles
 * - Song services: Query and manage songs
 * - User services: Query and update user data
 * - Various features: Read/write to Firestore
 *
 * COLLECTIONS:
 * - /users/{uid}: User profiles
 * - /songs: Music track metadata
 * - /playlists/{uid}: User playlists
 * - /history/{uid}: Listening history
 * - /likes/{uid}: Liked tracks
 *
 * SECURITY:
 * - Access controlled via Firestore security rules
 * - Rules enforce user authorization
 * - Admin operations require admin role
 */
export const db = getFirestore(app);
