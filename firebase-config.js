/*
 * Firebase web app settings for Google sign-in and cloud progress.
 *
 * Replace the placeholder values with the config from:
 *   Firebase console → Project settings → General → Your apps → Web app → SDK setup and configuration → Config
 *
 * These values identify the Firebase project; they are not secrets. Access to
 * each person's progress is protected by the rules in firestore.rules.
 * See README.md for the full setup steps.
 */
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID"
};
