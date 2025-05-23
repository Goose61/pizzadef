# Firebase Leaderboard Setup Guide

## Why Firebase?
Firebase Firestore provides a robust, scalable database solution that's perfect for leaderboards. Unlike Vercel KV, Firebase has a generous free tier and excellent documentation.

## Setup Steps

### 1. Install Firebase
```bash
npm install firebase firebase-admin
```

### 2. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project
3. Enable Firestore Database
4. Get your config keys

### 3. Environment Variables
Create `.env.local`:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

### 4. Firebase Config
Create `lib/firebase.js`:
```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  // Add other config as needed
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

### 5. Leaderboard Implementation
The Firebase approach from the tutorial provides:
- Real-time updates
- Automatic scaling
- Built-in security rules
- Offline support

## Benefits over File-Based
- Real-time synchronization
- Better concurrent user handling
- Automatic backups
- Global CDN distribution

## Migration Path
1. Keep file-based as fallback
2. Implement Firebase gradually
3. Test with small user base
4. Full migration when confident 