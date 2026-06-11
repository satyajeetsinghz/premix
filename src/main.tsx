/**
 * ============================================================================
 * Premix - Application Entry Point
 * ============================================================================
 * File: main.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - React DOM bootstrap layer that initializes the entire application
 * - Mounts the App component to the root DOM element (id="root")
 * - Enables React StrictMode in development for detecting potential issues
 *
 * RESPONSIBILITY:
 * - Single responsibility: Initialize React and mount the App component
 * - Acts as the bridge between HTML entry point (index.html) and React app
 *
 * DEPENDENCY CHAIN:
 * main.tsx → App.tsx → providers (Auth, Player, Suspension) → Router → Pages/Components
 *
 * PERFORMANCE NOTES:
 * - React.StrictMode is development-only and does not affect production builds
 * - This is the optimal place to verify the root element exists (!) before mounting
 *
 * ERROR HANDLING:
 * - Non-null assertion (!) on root element is safe because index.html guarantees it exists
 * - If root element is missing, the application will fail fast during build/runtime
 *
 * ============================================================================
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize React application on the DOM root element
// StrictMode helps identify potential problems during development
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
