/**
 * @fileoverview Hero header component for user profile page with Apple Music-style design.
 *
 * Responsibilities:
 * - Display user avatar, display name, and username
 * - Show blurred background cover art from user's photoURL (if exists)
 * - Provide edit button and more options dropdown (share profile placeholder)
 * - Support both dark (with photo) and light (without photo) visual variants
 *
 * Related modules:
 * - ProfilePage (src/features/profile/ProfilePage.tsx) - Uses this component as header
 * - EditProfileModal (src/features/profile/components/EditProfileModal.tsx) - Opened via onEdit callback
 *
 * Architectural role:
 * - **Hero section** for ProfilePage
 * - Visual design matches Apple Music's profile header (blurred background, centered avatar, bottom-aligned text)
 * - Renders differently based on whether user has uploaded a profile photo
 *
 * Visual variants:
 *
 * With photoURL:
 * - Blurred, scaled background image (28px blur, 1.14 scale)
 * - Dark overlay gradient for text readability
 * - White text with text shadow
 * - Dark semi-transparent buttons with backdrop blur
 *
 * Without photoURL:
 * - Solid light gray background (#f5f5f7)
 * - Subtle gradient overlay (brand red tint)
 * - Dark text (#1c1c1e, #636366)
 * - Light buttons with dark text
 *
 * Avatar sizing:
 * - Width/height: 108px
 * - Position: centered, top-7 from top of container
 * - Fallback: colored circle with initials when no photoURL
 *
 * Username derivation:
 * - If profile.username exists: "@username"
 * - Else: "@" + first part of email before "@"
 * - If no email: empty string
 *
 * Edit button behavior:
 * - Opens EditProfileModal via onEdit callback
 * - Also accessible from "More Options" dropdown
 *
 * @module features/profile/components
 */

import { useState } from "react";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

const P = "#fa243c"; // Brand primary color
const COVER_H = 220; // Fixed header height (matches HeroInfoPanel COVER_H)

/**
 * Profile data structure from useProfile hook.
 *
 * @property name - User's display name
 * @property username - Optional username (for @mentions)
 * @property email - User's email address (used for fallback username)
 * @property photoURL - Optional profile photo URL from Cloudinary
 */
interface ProfileData {
  name?: string;
  username?: string;
  email?: string;
  photoURL?: string;
  [key: string]: any;
}

/**
 * Props for the ProfileHeader component.
 *
 * @property profile - User profile data (can be null while loading)
 * @property onEdit - Callback to open edit profile modal
 */
interface Props {
  profile: ProfileData | null;
  onEdit: () => void;
}

/**
 * ProfileHeader - Apple Music-style hero header for profile page.
 *
 * Layout structure:
 * ```
 * Container (height: 220px)
 * ├── Blurred background image (conditionally rendered)
 * ├── Gradient overlay
 * ├── Centered avatar (top-7, 108x108)
 * └── Bottom bar (bottom-0)
 *     ├── Left: Display name + username
 *     └── Right: Edit button + More options dropdown
 * ```
 *
 * @param props - Component props
 * @returns Profile header JSX
 */
const ProfileHeader = ({ profile, onEdit }: Props) => {
  const [moreOpen, setMoreOpen] = useState(false);

  // Derived display values
  const displayName = profile?.name || "User";
  const username = profile?.username
    ? `@${profile.username}`
    : profile?.email?.split("@")[0]
      ? `@${profile.email.split("@")[0]}`
      : "";

  // Avatar initials (first two letters of first two words, uppercase)
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: COVER_H, background: "#f5f5f7" }}
    >
      {/* Blurred background image (only when photo exists) */}
      {profile?.photoURL && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${profile.photoURL})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(28px) brightness(0.82) saturate(1.2)",
            transform: "scale(1.14)",
          }}
        />
      )}

      {/* Gradient overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: profile?.photoURL
            ? "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.14) 100%)"
            : "radial-gradient(ellipse at 50% 0%, rgba(250,36,60,0.06) 0%, rgba(250,36,60,0.02) 100%)",
        }}
      />

      {/* Centered avatar */}
      <div className="absolute left-1/2 -translate-x-1/2 top-7">
        <div
          className="w-[108px] h-[108px] rounded-full overflow-hidden flex items-center justify-center"
          style={{
            background: profile?.photoURL ? "transparent" : "#e5e5ea",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.18), 0 0 0 3px rgba(255,255,255,0.22)",
          }}
        >
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt={displayName}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <span
              className="text-[#636366] font-semibold"
              style={{ fontSize: 36, letterSpacing: "-0.5px" }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* Bottom bar with name, username, and action buttons */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-5 pb-4">
        {/* Left: User info */}
        <div>
          <p
            className="font-bold leading-tight"
            style={{
              fontSize: 18,
              color: profile?.photoURL ? "#ffffff" : "#1c1c1e",
              letterSpacing: "-0.3px",
              textShadow: profile?.photoURL
                ? "0 1px 4px rgba(0,0,0,0.35)"
                : "none",
            }}
          >
            {displayName}
          </p>
          {username && (
            <p
              style={{
                fontSize: 13,
                color: profile?.photoURL ? "rgba(255,255,255,0.78)" : "#636366",
                marginTop: 2,
                textShadow: profile?.photoURL
                  ? "0 1px 3px rgba(0,0,0,0.3)"
                  : "none",
              }}
            >
              {username}
            </p>
          )}
        </div>

        {/* Right: Edit button + More options dropdown */}
        <div className="flex items-center gap-2 pb-0.5">
          {/* Edit button (primary action) */}
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-full font-semibold transition-opacity hover:opacity-85 active:opacity-60 text-[14px] text-white"
            style={{ background: P, letterSpacing: "0.02em" }}
          >
            Edit
          </button>

          {/* More options dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-85 active:opacity-60"
              style={{
                background: profile?.photoURL
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.08)",
                color: profile?.photoURL ? "#ffffff" : "#636366",
                backdropFilter: "blur(4px)",
              }}
              aria-label="More options"
            >
              <MoreHorizIcon sx={{ fontSize: 18 }} />
            </button>

            {/* More options dropdown menu */}
            {moreOpen && (
              <div
                className="absolute right-0 bottom-full mb-2 w-44 bg-white rounded-xl border border-black/[0.08] shadow-xl py-1.5 z-50"
                onMouseLeave={() => setMoreOpen(false)}
              >
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    onEdit();
                  }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                >
                  Edit Profile
                </button>
                <div className="h-px bg-[#f2f2f7] my-1" />
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
                >
                  Share Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;