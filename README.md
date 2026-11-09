# alevelandstuff.github.io
ai generated website for my a levels and also uploaded for other ppl too ig

## Accounts (Google sign-in)

Signing in with Google is required. Each person's progress is saved to their account with
Firebase Authentication and Cloud Firestore, so it follows them to any device. Progress that
was saved in a browser before accounts existed moves into the account the first time that
person signs in on that browser.

Files:

- `auth.js` – sign up / log in screen, Google sign-in, and saving progress to the account
- `firebase-config.js` – the Firebase project settings (fill these in)
- `firestore.rules` – security rules so each person can only read and write their own progress

### One-time setup

1. Go to <https://console.firebase.google.com>, click **Add project** and create a project (Google Analytics is not needed).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, choose a support email, then **Save**.
3. **Authentication → Settings → Authorised domains → Add domain** and add `alevelandstuff.github.io`.
4. **Build → Firestore Database → Create database** (production mode, any nearby location such as `europe-west2`).
5. In Firestore open the **Rules** tab, paste in the contents of `firestore.rules` and click **Publish**.
6. **Project settings (cog) → General → Your apps → Web (`</>`)**, register an app, then copy the
   `apiKey`, `authDomain`, `projectId` and `appId` values into `firebase-config.js`.
7. Commit and push. These config values are public identifiers, not secrets; the Firestore rules protect the data.

Until `firebase-config.js` is filled in, the home page shows "Accounts aren't set up yet" and the labs can't be opened.

To test locally, serve the folder from its root (for example `python3 -m http.server 8000`) and add
`localhost` to the authorised domains if it isn't already listed.
