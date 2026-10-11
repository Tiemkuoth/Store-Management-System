const fs = require('fs');
const path = require('path');
const cssPath = path.resolve('src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Replace transition: all with more performant transitions
css = css.replace(/transition:\s*all\s+([^;]+);/g, 'transition: opacity $1, transform $1, background-color $1, border-color $1, color $1, box-shadow $1;');

// 2. Add global responsive and performance overrides
const responsiveOverrides = `

/* ==========================================================================
   GLOBAL RESPONSIVE & PERFORMANCE OVERRIDES
   ========================================================================== */

/* ── 1. Global Box Sizing & Fluidity ── */
*, *::before, *::after {
  box-sizing: border-box !important;
}

html, body {
  max-width: 100vw;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

img, picture, video, canvas, svg {
  max-width: 100%;
  height: auto;
  object-fit: contain;
}

/* ── 2. Fluid Typography & Spacing ── */
html {
  font-size: clamp(14px, 1vw + 10px, 16px);
}

body {
  font-size: clamp(0.875rem, 1vw + 0.5rem, 1rem);
  line-height: 1.5;
}

/* ── 3. App Shell Layout Fixes ── */
.app-shell {
  display: flex;
  min-height: 100vh;
  width: 100vw;
  max-width: 100vw;
  overflow: hidden;
}

.app-sidebar {
  flex-shrink: 0;
  width: clamp(240px, 20vw, 280px);
  max-width: 100vw;
}

.app-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.app-main {
  flex: 1;
  padding: clamp(1rem, 2vw, 2rem);
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
}

/* ── 4. Responsive Data Tables ── */
.table-container {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.data-table {
  width: 100%;
  min-width: 600px;
}

/* ── 5. Fluid Grid for Dashboards and Cards ── */
.dashboard-grid, .cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  width: 100%;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: clamp(10px, 2vw, 20px);
  width: 100%;
}

/* ── 6. Modals & Dialogs ── */
.modal-overlay {
  padding: clamp(10px, 2vw, 20px);
}

.modal-content, .user-edit-modal, .modern-profile-modal {
  width: 100%;
  max-width: min(100%, 800px);
  margin: 0 auto;
  max-height: calc(100vh - clamp(20px, 4vw, 40px));
  display: flex;
  flex-direction: column;
}

.modal-body {
  overflow-y: auto;
  flex: 1;
}

/* ── 7. Forms and Inputs ── */
.form-group {
  width: 100%;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  max-width: 100%;
}

.form-row, .user-edit-field-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: clamp(10px, 1.5vw, 20px);
}

/* ── 8. Media Queries for Responsiveness ── */
@media (max-width: 1024px) {
  .app-sidebar {
    position: fixed;
    transform: translateX(-100%);
    z-index: 1000;
  }
  
  .app-sidebar.mobile-open {
    transform: translateX(0);
  }
  
  .app-content {
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .app-main {
    padding: clamp(0.5rem, 2vw, 1rem);
  }
  
  .modern-profile-grid, .user-edit-body {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
  }
  
  .modern-profile-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--bg-border);
  }

  .user-edit-actions {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }
}

@media (max-width: 480px) {
  .app-bar-actions .user-chip-text {
    display: none;
  }
  
  .dashboard-stats {
    grid-template-columns: 1fr;
  }
  
  .modal-footer {
    flex-direction: column;
    align-items: stretch;
  }
  
  .modal-footer button {
    width: 100%;
    margin-left: 0;
    margin-bottom: 8px;
  }
}

/* ── 9. Performance & Animation Optimizations ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Make hover effects lighter */
.btn, .nav-button, .user-chip, .data-table tr {
  will-change: transform, opacity, background-color;
}
`;

fs.writeFileSync(cssPath, css + responsiveOverrides);
console.log('Successfully updated index.css with responsive and performance overrides.');
