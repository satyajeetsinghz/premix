# BeatStream

A modern, progressive web application for music streaming and library management. Stream your favorite tracks, create personalized playlists, and enjoy seamless playback across all your devices.

**Live Demo**: [openbeatstream.vercel.app](https://openbeatstream.vercel.app)

---

## Features

### Music Playback
- Real-time streaming with intuitive playback controls
- Queue management and smart skip behavior
- Media Session API integration for device controls (lock screen, headphones, car displays)
- Volume control with mute toggle
- Automatic history tracking for personalized experience

### User Library
- **Liked Songs**: Save favorite tracks for quick access
- **Playlists**: Create, edit, and organize custom playlists
- **History**: Track your listening journey
- **Browse**: Curated sections and trending content on homepage
- **Profile**: Customize your user profile with profile picture and preferences

### Authentication & Account Management
- Email/password authentication with Firebase
- Persistent sessions across devices
- Account status management (active, suspended, banned)
- Flexible user roles (user, admin)
- Last login tracking for analytics

### Admin Dashboard
- Music catalog management (upload, organize tracks)
- User administration and moderation
- Banner and featured content management
- Analytics dashboard for engagement insights
- Song and section management

### Progressive Web App (PWA)
- Installable on iOS, Android, Windows, and macOS
- App shortcuts to Library and Liked Songs
- Native-like user experience with custom theme colors
- Responsive design optimized for all screen sizes
- Safe area support for notched devices

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19.2 + TypeScript 5.9 + Vite 7.3 |
| **Styling** | Tailwind CSS 3.4 + PostCSS + Autoprefixer |
| **UI Components** | Material-UI 7.3 + Framer Motion 12.34 |
| **Interaction** | React Router 7.13 + dnd-kit (drag-drop) |
| **State Management** | React Context API (Auth, Player, Suspension) |
| **Backend** | Firebase Auth + Firestore |
| **Media** | Cloudinary (image/audio optimization) |
| **Deployment** | Vercel (SPA routing) |

### Project Structure

```
src/
├── app/                    # App configuration & routing
│   ├── providers.tsx       # Provider setup
│   └── router.tsx          # Route definitions with guards
│
├── features/               # Feature modules (domain-driven architecture)
│   ├── auth/               # Authentication & user management
│   ├── player/             # Music player & playback
│   ├── songs/              # Song management & library
│   ├── playlists/          # Playlist management
│   ├── likes/              # Liked songs tracking
│   ├── history/            # Listening history
│   ├── profile/            # User profile management
│   ├── home/               # Homepage & featured content
│   ├── admin/              # Admin dashboard & controls
│   ├── users/              # User administration
│   ├── sections/           # Content sections
│   ├── banner/             # Banner management
│   └── hooks/              # Feature-specific hooks
│
├── components/             # Shared UI components
│   ├── layout/             # Layout components (MainLayout, Sidebar, Topbar)
│   ├── ui/                 # Reusable UI components
│   └── common/             # Common components
│
├── context/                # Global state providers
│   ├── SuspensionContext.tsx
│   └── useSuspension hook
│
├── services/               # API & external service integration
│   └── firebase/           # Firebase configuration & services
│
├── styles/                 # Global styles
├── utils/                  # Utility functions
└── types/                  # TypeScript type definitions
```

---

## Authentication Flow

1. **User Login**
   - User submits email/password on login page
   - Firebase authenticates credentials
   - User profile loaded from Firestore
   - Last login timestamp recorded for analytics

2. **Session Persistence**
   - Firebase token stored in browser
   - Session restored on page reload
   - Real-time auth state listener ensures consistency

3. **Access Control**
   - **Banned users** → Blocked from app with notice
   - **Suspended users** → Must acknowledge before accessing
   - **Active users** → Full access with optional suspension banner

4. **Admin Access**
   - Admin role verified for `/admin` routes
   - Non-admins redirected to home page
   - Role checked in ProtectedAdminRoute component

---

## Playback Architecture

### State Management
Player state is managed globally via `PlayerContext`, providing:
- **Current Track**: Track being played
- **Queue**: List of tracks to play
- **Playback State**: Playing/paused status
- **Position & Duration**: Time tracking
- **Volume & Mute**: Audio controls

### Playback Controls
```typescript
// Start playing a track
await playTrack(track, trackList?);

// Pause/resume
togglePlay();

// Navigate queue
playNext();
playPrevious();

// Time control
seek(time);

// Audio control
setVolume(0-1);
toggleMute();
```

### Media Session Integration
- Lock screen controls: play, pause, skip

### History Tracking
- Played tracks automatically saved to Firestore
- Deduplication prevents duplicate entries
- Asynchronous to avoid blocking playback

### Suspension Enforcement
- Suspended users cannot start/resume playback
- Playback auto-pauses if user becomes suspended
- Clear notification about suspension status

---

## Database Schema

### Firestore Collections

**`/users/{uid}`** - User Profiles
```typescript
{
  uid: string,                              // Firebase Auth UID
  name: string,                             // Display name
  email: string,                            // Email address
  photoURL: string,                         // Profile picture URL
  role: "user" | "admin",                   // Permission level
  status: "active" | "suspended" | "banned", // Account status
  createdAt: Timestamp,                     // Account creation
  lastLoginAt: Timestamp                    // Most recent login
}
```

**`/songs`** - Music Catalog
```typescript
{
  id: string,           // Firestore doc ID
  title: string,        // Track name
  artist: string,       // Artist name
  coverUrl: string,     // Album artwork (Cloudinary)
  duration: string,     // Track length
  audioUrl: string      // Audio file (Cloudinary hosted)
}
```

**`/playlists/{uid}`** - User Playlists
```typescript
{
  id: string,
  name: string,
  description: string,
  trackIds: string[],
  coverUrl?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**`/history/{uid}/tracks`** - Listening History
```typescript
{
  trackId: string,      // Song ID
  playedAt: Timestamp   // When played
}
```

**`/likes/{uid}/tracks`** - Liked Songs
```typescript
{
  trackId: string,      // Song ID
  likedAt: Timestamp    // When liked
}
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project (credentials in `.env`)
- Cloudinary account (for image/audio optimization)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/beatstream/beatstream-one-web.git
   cd beatstream-one-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   
   # Cloudinary Configuration
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   
   Application opens at `http://localhost:5173`

---

## Available Scripts

```bash
# Start development server with HMR
npm run dev

# Build for production (with type checking)
npm run build

# Preview production build locally
npm run preview

# Run ESLint for code quality
npm run lint

# Run React Doctor (performance analysis)
npm run doctor
```

---

## Configuration

### TypeScript
- Strict mode enabled for type safety
- Path aliases: `@/` → `src/`
- Source maps disabled in production

### Tailwind CSS
- Custom colors using design tokens
- Responsive breakpoints
- Plugins for grid and spacing

### Vite
- Port: 5173
- Auto-open in browser on start
- Hot Module Replacement (HMR) enabled
- Source maps disabled in production builds

### ESLint
- React hooks rules enforced
- React refresh plugin for HMR
- TypeScript support
- Accessibility checking

---

## Deployment

### Vercel Configuration

The app is deployed on Vercel with SPA routing configured (`vercel.json`):

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Auto-Deployment
- Push to `main` branch triggers production deployment
- Pull requests get preview deployments with unique URLs
- Environment variables configured in Vercel dashboard

### Performance Optimizations
- Automatic gzip compression
- CDN distribution
- Bundle size optimization via Vite
- Cloudinary image/media optimization

---

## Design System

### Color Palette
- **Primary Red**: `#fa243c` (Brand color)
- **Neutral**: Grays for text and backgrounds
- **Accent**: Used in buttons and interactive elements

### Typography
- **Headers**: Bold, clear hierarchy
- **Body**: Readable at all sizes
- **Monospace**: Code and technical content

### Responsive Design
- Mobile-first approach
- Breakpoints: 640px, 768px, 1024px, 1280px
- Safe area insets for notched devices

---

## Performance Features

### Bundle Size Optimization
- Code splitting for lazy loading
- CSS purification with Tailwind
- JavaScript minification
- Gzip compression via Vercel

### Rendering Performance
- Context API for minimal re-renders
- useCallback memoization for event handlers
- Ref caching for frequently updated values
- Conditional rendering avoids unnecessary DOM

### Media Optimization
- Cloudinary URL transformations (resize, format)
- Auto quality adjustment (`q_auto`)
- Auto format selection (`f_auto` → webp, avif)
- Multiple image sizes for device displays

### Runtime Performance
- Media Session position updates batched (500ms)
- History tracking deduplication
- Audio element reuse for all tracks
- Asynchronous history saves don't block playback

---

## Security Considerations

### Authentication
- Firebase handles password security
- Tokens automatically refreshed
- HTTPS required (enforced by Vercel)

### Data Privacy
- User data scoped to own Firestore documents
- Firestore security rules enforce authorization
- Admin operations restricted to admin role
- Sensitive keys in environment variables

### API Keys
- Firebase API key is public (frontend requirement)
- Security via Firestore rules, not key hiding
- Cloudinary keys are public (upload preset limited)

---

## Troubleshooting

### Common Issues

**"Cannot find module" errors**
- Ensure path aliases are correct: `@/` → `src/`
- Check import paths use forward slashes even on Windows

**Firebase authentication fails**
- Verify `.env` values match Firebase project
- Check Firebase security rules allow operations
- Ensure user exists in `/users` collection

**Audio won't play**
- Verify `audioUrl` is a valid URL
- Check browser autoplay policies (may require user gesture)
- Test in different browsers

**Playback stops when suspended**
- Check `user.status` in Firestore
- Verify suspension acknowledgment flow
- Clear browser cache and reload

---

## Development Workflow

### Adding a New Feature
1. Create feature folder under `src/features/{feature-name}`
2. Structure: `components/`, `services/`, `hooks/`, `types.ts`, `pages/`
3. Export public API from `index.ts`
4. Add route in `app/router.tsx` if needed
5. Test with `npm run dev`

### Creating a Component
1. Use TypeScript for type safety
2. Export as named export (not default)
3. Add JSDoc comments for props
4. Use Tailwind for styling
5. Extract custom hooks for logic

### Adding a Service
1. Create in feature `services/` folder
2. Use async/await for async operations
3. Handle errors with try/catch
4. Return typed data from Firestore/API
5. Export from feature `index.ts`

---

## API Reference

### useAuth Hook
```typescript
const { user, loading } = useAuth();
// user: IUser | null - Authenticated user
// loading: boolean - Auth state resolving
```

### usePlayer Hook
```typescript
const {
  currentTrack, isPlaying, queue, currentIndex,
  currentTime, duration, volume, isMuted,
  playTrack, togglePlay, seek, playNext, playPrevious,
  setVolume, toggleMute
} = usePlayer();
```

### useSuspension Hook
```typescript
const { isSuspended, hasAcknowledged, acknowledge } = useSuspension();
```

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- Use TypeScript for all new code
- Follow ESLint rules (run `npm run lint`)
- Write meaningful commit messages
- Add comments for complex logic
- Test changes before submitting

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Author

**BeatStream Team**

---

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing documentation
- Contact: satyajeetsingh.in@gmail.com

---

## Acknowledgments

- [React](https://react.dev) - UI library
- [Vite](https://vitejs.dev) - Build tool
- [Firebase](https://firebase.google.com) - Backend services
- [Tailwind CSS](https://tailwindcss.com) - Styling framework
- [Material-UI](https://mui.com) - Component library
- [Cloudinary](https://cloudinary.com) - Media optimization

---

**BeatStream 2026**
