/**
 * @fileoverview Main admin panel dashboard with lazy-loaded tab management.
 *
 * Responsibilities:
 * - Render tabbed interface for admin operations (upload songs, manage songs, sections, banners, users, media)
 * - Implement stateful tabs pattern: keep tabs in DOM after first visit to preserve form state and Firestore subscriptions
 * - Lazy-load tab components for performance (code splitting)
 * - Show "Coming Soon" placeholders for incomplete features (dashboard, analytics, settings)
 *
 * Related modules:
 * - UploadSongForm     (src/features/admin/components/UploadSongForm.tsx)       — Song upload interface
 * - SongManager        (src/features/admin/components/SongManager.tsx)           — Song catalog management
 * - SectionManager     (src/features/sections/components/SectionManager.tsx)     — Home page section management
 * - BannerManager      (src/features/banner/components/BannerManager.tsx)        — Hero banner management
 * - UserManagementPage (src/features/users/pages/UserManagementPage.tsx)         — User administration
 * - CloudinaryManager  (src/features/admin/components/CloudinaryManager.tsx)     — Cloudinary media asset management
 *
 * Architectural role:
 * - Admin panel shell — orchestrates all admin functionality
 * - Route: /admin (protected, separate shell — NOT inside MainLayout)
 * - Wrapped by ProtectedAdminRoute (requires admin role)
 *
 * Stateful tabs pattern:
 * - Stateful tabs: "upload", "songs", "sections", "banners", "users", "media"
 * - These tabs are only mounted after their first visit, then kept in DOM hidden by CSS
 * - Preserves Firestore subscriptions and form state when switching between tabs
 * - Non-stateful tabs (dashboard, analytics, settings) use ComingSoon placeholder and unmount when inactive
 *
 * @module features/admin/pages
 */

import { useState, useCallback, useEffect, memo, lazy, Suspense } from "react";
import DashboardIcon    from "@mui/icons-material/Dashboard";
import MusicNoteIcon    from "@mui/icons-material/MusicNote";
import PeopleIcon       from "@mui/icons-material/People";
import AnalyticsIcon    from "@mui/icons-material/Analytics";
import SettingsIcon     from "@mui/icons-material/Settings";
import ViewQuiltIcon    from "@mui/icons-material/ViewQuilt";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import ImageIcon        from "@mui/icons-material/Image";
import CloudIcon        from "@mui/icons-material/Cloud";

// Lazy-loaded admin components (code-split for performance)
const UploadSongForm     = lazy(() => import("../components/UploadSongForm"));
const SectionManager     = lazy(() =>
  import("@/features/sections/components/SectionManager").then((m) => ({
    default: m.SectionManager,
  })),
);
const SongManager        = lazy(() => import("../components/SongManager"));
const BannerManager      = lazy(() => import("@/features/banner/components/BannerManager"));
const UserManagementPage = lazy(() => import("@/features/users/pages/UserManagementPage"));
const CloudinaryManager  = lazy(() => import("../components/CloudinaryManager"));

/**
 * Admin panel tab identifiers.
 *
 * - dashboard:  Analytics overview (Coming Soon)
 * - upload:     Upload new song form
 * - songs:      Manage existing songs (edit/delete)
 * - sections:   Home page section management
 * - banners:    Hero banner management
 * - users:      User management (role/status updates)
 * - media:      Cloudinary media asset manager (review, copy, clear references)
 * - analytics:  Analytics dashboard (Coming Soon)
 * - settings:   Admin settings (Coming Soon)
 */
type TabId =
  | "dashboard"
  | "upload"
  | "songs"
  | "sections"
  | "banners"
  | "users"
  | "media"
  | "analytics"
  | "settings";

/**
 * Tab configuration interface.
 *
 * @property id - Unique tab identifier (matches TabId type)
 * @property label - Display label shown in navigation
 * @property icon - MUI icon component
 */
interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

/**
 * Props for the TabButton component.
 *
 * @property tab - Tab configuration object
 * @property isActive - Whether this tab is currently active
 * @property onClick - Click handler with tab ID
 */
interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onClick: (id: TabId) => void;
}

/**
 * Props for the ComingSoon placeholder component.
 *
 * @property icon - MUI icon component (large, 48px)
 * @property label - Display text (e.g., "Dashboard")
 */
interface ComingSoonProps {
  icon: React.ElementType;
  label: string;
}

/**
 * Tab configuration array.
 *
 * Order determines display order in navigation (left to right).
 * Dashboard first (placeholder), then upload, songs, sections, banners, users, media, analytics, settings.
 */
const TABS: Tab[] = [
  { id: "dashboard", label: "Dashboard",    icon: DashboardIcon    },
  { id: "upload",    label: "Upload Music", icon: MusicNoteIcon    },
  { id: "songs",     label: "Manage Songs", icon: LibraryMusicIcon },
  { id: "sections",  label: "Sections",     icon: ViewQuiltIcon    },
  { id: "banners",   label: "Banners",      icon: ImageIcon        },
  { id: "users",     label: "Users",        icon: PeopleIcon       },
  { id: "media",     label: "Media",        icon: CloudIcon        },
  { id: "analytics", label: "Analytics",    icon: AnalyticsIcon    },
  { id: "settings",  label: "Settings",     icon: SettingsIcon     },
];

/**
 * Stateful tabs that persist in DOM after first visit.
 *
 * These tabs have meaningful state (form fields, Firestore subscriptions, loaded
 * asset lists) that would be lost if the component unmounted on tab switch.
 * They are kept in the DOM hidden by Tailwind's `hidden` class and only
 * rendered for the first time when the user actually clicks the tab.
 *
 * Non-stateful tabs (dashboard, analytics, settings) show a ComingSoon
 * placeholder and can be unmounted freely.
 */
const STATEFUL_TABS: TabId[] = [
  "upload",
  "songs",
  "sections",
  "banners",
  "users",
  "media",
];

/**
 * Initial active tab when admin panel loads.
 *
 * Default: "upload" (most common admin action is adding new songs).
 */
const INITIAL_ACTIVE_TAB: TabId = "upload";

/**
 * TabButton - Individual tab navigation button.
 *
 * Memoized with React.memo to prevent unnecessary re-renders
 * when switching between tabs (most props unchanged).
 *
 * Visual design:
 * - Active: Bottom border brand red (#fa243c), icon red, text gray-900
 * - Inactive: Transparent border, icon/text gray-500, hover gray-700
 * - Whitespace-nowrap prevents wrapping on narrow screens
 *
 * @param props - TabButtonProps
 * @returns Tab button JSX
 */
const TabButton = memo(({ tab, isActive, onClick }: TabButtonProps) => {
  const Icon = tab.icon;
  return (
    <button
      onClick={() => onClick(tab.id)}
      className={`flex items-center gap-2 py-4 px-1 border-b-2 transition-colors whitespace-nowrap ${
        isActive
          ? "border-[#fa243c] text-gray-900"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
      aria-pressed={isActive}
      aria-label={`Switch to ${tab.label} tab`}
      role="tab"
    >
      <Icon fontSize="small" className={isActive ? "text-[#fa243c]" : ""} />
      <span className="text-sm font-medium">{tab.label}</span>
    </button>
  );
});
TabButton.displayName = "TabButton";

/**
 * TabLoader - Loading fallback for lazy-loaded components.
 *
 * Shows centered spinner while component is loading.
 * Used as fallback in Suspense component.
 *
 * @returns Loading spinner JSX
 */
const TabLoader = () => (
  <div
    className="flex items-center justify-center py-24"
    role="status"
    aria-label="Loading tab content"
  >
    <div
      className="w-7 h-7 border-2 border-[#ffd1d9] border-t-[#fa243c] rounded-full animate-spin"
      aria-hidden="true"
    />
  </div>
);

/**
 * ComingSoon - Placeholder for incomplete features.
 *
 * Memoized because content is static and never changes.
 * Shows large icon + descriptive text for unimplemented tabs.
 *
 * @param props - ComingSoonProps
 * @returns Placeholder JSX
 */
const ComingSoon = memo(({ icon: Icon, label }: ComingSoonProps) => (
  <div
    className="text-center py-16 bg-white rounded-2xl border border-gray-200"
    role="region"
    aria-label={`${label} section`}
  >
    <Icon className="text-gray-300 mx-auto" style={{ fontSize: 48 }} aria-hidden="true" />
    <p className="text-gray-500 mt-4">{label} coming soon</p>
    <p className="text-sm text-gray-400 mt-1">Check back later</p>
  </div>
));
ComingSoon.displayName = "ComingSoon";

/**
 * AdminPage - Main admin panel with tab navigation.
 *
 * Layout structure:
 * 1. Sticky header with admin panel title and description
 * 2. Tab navigation bar (scrollable on mobile, hides scrollbar)
 * 3. Main content area with Suspense boundary
 *
 * Stateful tabs implementation:
 * - activatedTabs Set tracks which stateful tabs have been visited
 * - First visit: tab added to Set, component mounts
 * - Subsequent visits: component already in DOM, just CSS toggles visibility
 *
 * Why stateful tabs?
 * - Preserves form state when switching between upload/edit tabs
 * - Maintains Firestore real-time subscriptions (no re-fetching)
 * - Better UX for admins working across multiple management areas
 *
 * Error handling:
 * - Try/catch around tab activation and rendering
 * - Prevents one tab error from breaking entire admin panel
 * - Shows error message in content area (not crash)
 *
 * Accessibility:
 * - role="main" on container
 * - role="tablist" on navigation
 * - role="tab" on TabButton
 * - role="tabpanel" on content containers
 * - aria-pressed indicates active tab
 * - aria-label on all interactive elements
 *
 * @returns Admin panel JSX with lazy-loaded tabs
 */
const AdminPage = () => {
  /**
   * Currently active tab ID.
   * Determines which tab panel is visible.
   */
  const [activeTab, setActiveTab] = useState<TabId>(INITIAL_ACTIVE_TAB);

  /**
   * Set of stateful tabs that have been activated at least once.
   *
   * Used to determine which tabs should be mounted in DOM.
   * Initially contains INITIAL_ACTIVE_TAB ("upload") for immediate rendering.
   *
   * Why Set instead of array?
   * - O(1) lookup for contains checks
   * - Automatic deduplication (no duplicate entries)
   * - Easy to add with .add()
   */
  const [activatedTabs, setActivatedTabs] = useState<Set<TabId>>(
    () => new Set([INITIAL_ACTIVE_TAB]),
  );

  /**
   * Effect: Add active tab to activatedTabs Set when it changes.
   *
   * Only runs for stateful tabs (STATEFUL_TABS includes the tab).
   * Non-stateful tabs (dashboard, analytics, settings) are never added to Set.
   *
   * Wrapped in try/catch to prevent setState errors from crashing admin panel.
   *
   * Side effect: Updates activatedTabs state (triggers re-render of tab panels).
   */
  useEffect(() => {
    try {
      setActivatedTabs((prev) => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    } catch (error) {
      console.error("Error updating activated tabs:", error);
    }
  }, [activeTab]);

  /**
   * Handles tab click - switches active tab.
   *
   * Wrapped in try/catch to prevent errors from crashing admin panel.
   *
   * @param id - Tab ID to switch to
   */
  const handleTabClick = useCallback((id: TabId) => {
    try {
      setActiveTab(id);
    } catch (error) {
      console.error("Error switching tab:", error);
    }
  }, []);

  /**
   * Renders content for the currently active tab.
   *
   * Logic:
   * 1. For stateful tabs: map over STATEFUL_TABS array
   *    - Render component only if tab is in activatedTabs Set
   *    - Toggle visibility via CSS (block if active, hidden if inactive)
   * 2. For non-stateful tabs: render ComingSoon placeholder
   *
   * Why separate handling?
   * - Stateful tabs need persistence across tab switches
   * - Non-stateful tabs don't need persistence (just placeholders)
   *
   * Error handling: Catches render errors, shows user-friendly message.
   *
   * @returns Tab content JSX or error message
   */
  const renderTabContent = () => {
    try {
      return (
        <>
          {/* Stateful tabs: rendered once when activated, hidden/shown via CSS */}
          {STATEFUL_TABS.map((id) => {
            if (!activatedTabs.has(id)) return null;
            return (
              <div
                key={id}
                className={activeTab === id ? "block" : "hidden"}
                role="tabpanel"
                aria-labelledby={`tab-${id}`}
              >
                {/* Lazy-loaded component for each stateful tab */}
                {id === "upload"   && <UploadSongForm />}
                {id === "songs"    && <SongManager />}
                {id === "sections" && <SectionManager />}
                {id === "banners"  && <BannerManager />}
                {id === "users"    && <UserManagementPage />}
                {id === "media"    && <CloudinaryManager />}
              </div>
            );
          })}

          {/* Non-stateful tabs: Coming Soon placeholders (unmount when inactive) */}
          {activeTab === "dashboard" && <ComingSoon icon={DashboardIcon} label="Dashboard" />}
          {activeTab === "analytics" && <ComingSoon icon={AnalyticsIcon} label="Analytics" />}
          {activeTab === "settings"  && <ComingSoon icon={SettingsIcon}  label="Settings"  />}
        </>
      );
    } catch (error) {
      console.error("Error rendering tab content:", error);
      return (
        <div role="alert" className="p-6 text-sm text-red-600 bg-red-50 rounded-2xl border border-red-200">
          Error loading tab content. Please refresh the page.
        </div>
      );
    }
  };

  return (
    <div
      className="min-h-screen bg-[#f5f5f7]"
      role="main"
      aria-label="Admin panel"
    >
      {/* Sticky header with brand */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-[#fa243c] flex items-center justify-center shadow-sm"
                aria-hidden="true"
              >
                <DashboardIcon className="text-white" fontSize="small" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Admin Panel
                </h1>
                <p className="text-sm text-gray-500">
                  Manage your music library
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab navigation bar - scrollable on mobile */}
      <nav
        className="border-b border-gray-200 bg-white"
        role="tablist"
        aria-label="Admin panel navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 md:space-x-8 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={handleTabClick}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Main content area with Suspense for lazy-loaded components */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Suspense fallback={<TabLoader />}>
          {renderTabContent()}
        </Suspense>
      </main>
    </div>
  );
};

export default AdminPage;