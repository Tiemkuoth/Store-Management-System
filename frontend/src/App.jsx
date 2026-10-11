import React, { useState, useEffect, useRef, Suspense, lazy, useContext, useCallback } from 'react';
import { LayoutDashboard, ShoppingCart, HelpCircle, Package, ArrowLeftRight, Truck, FileBarChart, LogOut, Database, Bell, Tag, MoveRight, Menu, ClipboardList, Moon, Sun, Mail, MessageCircle, Users, Settings, Building2, Shield, Crown } from 'lucide-react';
import { DataContext } from './contexts/DataContext';
import { AuthContext, apiFetch } from './contexts/AuthContext';
import { useRealtimeUpdates } from './hooks/useRealtimeUpdates';
import { hasModuleAccess } from './utils/authorizationUtils';
const Dashboard = lazy(() => import('./components/Dashboard'));

const WarehouseManager = lazy(() => import('./components/WarehouseManager'));
const ProcurementManager = lazy(() => import('./components/ProcurementManager'));
const HelpSupport = lazy(() => import('./components/HelpSupport'));
const MaterialManager = lazy(() => import('./components/MaterialManager'));
const InventoryTransactions = lazy(() => import('./components/InventoryTransactions'));
const EmployeeDeptManager = lazy(() => import('./components/EmployeeDeptManager'));
const SupplierManager = lazy(() => import('./components/SupplierManager'));
const ReportsCenter = lazy(() => import('./components/ReportsCenter'));
const UserAndAuditManager = lazy(() => import('./components/UserAndAuditManager'));
const UserAudit = lazy(() => import('./components/UserAudit'));
const CategoryManager = lazy(() => import('./components/CategoryManager'));
const StockTransfers = lazy(() => import('./components/StockTransfers'));
const SystemSettings = lazy(() => import('./components/SystemSettings'));
const MaterialRequests = lazy(() => import('./components/MaterialRequests'));
const TaskManager = lazy(() => import('./components/TaskManager'));
const Receipts = lazy(() => import('./components/Receipts'));
const Messaging = lazy(() => import('./components/Messaging'));
const MessagesPage = lazy(() => import('./pages/Messages'));
const ManagementControlDashboard = lazy(() => import('./components/ManagementControlDashboard'));
const EmployeePortal = lazy(() => import('./components/EmployeePortal'));

const GmailIntegration = lazy(() => import('./components/GmailIntegration'));
import UserProfileModal from './components/UserProfileModal';
import LoginModal from './components/LoginModal';
import AccessDenied from './components/AccessDenied';
import UserAvatar from './components/UserAvatar';
import SharedHeader from './components/SharedHeader';

const VALID_NAV_IDS = new Set([
  'DASHBOARD', 'DIRECTOR_PANEL', 'MESSAGES', 'MATERIALS', 'TRANSACTIONS',
  'REQUESTS', 'TASKS', 'RECEIPTS', 'TRANSFERS', 'CATEGORIES', 'PROCUREMENT',
  'HELP', 'REPORTS', 'USER_AUDIT', 'SETTINGS', 'EMPLOYEES', 'SUPPLIERS',
  'WAREHOUSES', 'USERS_AUDIT', 'GMAIL'
]);

// Authentication uses an httpOnly cookie with a compact JWT and a memory/localStorage
// fallback for development cross-origin requests. All requests include credentials.

export default function App() {
  const { currentUser, isLoggedIn, isInitialized, handleLogin, handleLogout, setCurrentUser, fetchCurrentUser } = useContext(AuthContext) || {};
  const {
    stats = {},
    materials = [],
    categories = [],
    suppliers = [],
    employees = [],
    transactions = [],
    transfers = [],
    disposals = [],
    auditLogs = [],
    usersList = [],
    systemSettings = {},
    dbStatus = 'Connecting...',
    usingFallback = false,
    apiError = false,
    retryCountdown = 10,
    fetchData,
    handleAddMaterial, handleEditMaterial, handleDeleteMaterial,
    handleStockIn, handleStockOut, handleReturn, handleAdjust,
    handleTransfer, handleAddEmployee, handleAddSupplier, handleAddUser
  } = useContext(DataContext) || {};

  const [activeNav, setActiveNav] = useState(() => localStorage.getItem('sms_active_nav') || 'DASHBOARD');
  const restoredUserRef = useRef(null);
  const lastSavedPageRef = useRef(null);

  const preferredPageRoles = {
    DIRECTOR_PANEL: ['Director', 'Administrator'],
    DASHBOARD: ['Manager', 'Storekeeper', 'Employee'],
    EMPLOYEES: ['Director', 'Administrator', 'Manager', 'Storekeeper'],
    SUPPLIERS: ['Director', 'Administrator', 'Manager'],
    WAREHOUSES: ['Director', 'Administrator'],
    USER_AUDIT: ['Director', 'Administrator'],
  };

  // High-level users start with Management Control as default
  const highLevelRoles = ['Director', 'Administrator'];

  // ✅ ONLY update active nav when user logs in/out or explicitly navigates
  useEffect(() => {
    if (!isInitialized) return; // Wait for auth to initialize

    if (!isLoggedIn) {
      // User logged out - don't change nav, just show login page
      return;
    }

    // User is logged in - check if nav selection is valid
    if (!currentUser) return;

    const savedPage = localStorage.getItem(`sms_active_nav_${currentUser.id}`);
    const defaultPage = highLevelRoles.includes(currentUser.role) ? 'DIRECTOR_PANEL' : 'DASHBOARD';
    const preferredPage = currentUser.preferred_page || defaultPage;
    const candidate = savedPage || preferredPage;
    const validCandidate = VALID_NAV_IDS.has(candidate) ? candidate : defaultPage;
    const allowed = !preferredPageRoles[validCandidate] || preferredPageRoles[validCandidate].includes(currentUser.role);

    if (restoredUserRef.current !== currentUser.id) {
      restoredUserRef.current = currentUser.id;
      setActiveNav(allowed ? validCandidate : defaultPage);
    }
  }, [isLoggedIn, isInitialized, currentUser]); // ✅ Proper dependencies

  // ✅ Persist nav selection
  useEffect(() => {
    localStorage.setItem('sms_active_nav', activeNav);
    if (currentUser?.id) localStorage.setItem(`sms_active_nav_${currentUser.id}`, activeNav);
  }, [activeNav, currentUser?.id]);

  // Handle Google OAuth Callback globally
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
      setActiveNav('GMAIL');
    }
  }, []);

  // ✅ Update preferred page on server (debounce to prevent spam)
  useEffect(() => {
    if (!isInitialized || !isLoggedIn || !currentUser?.id || !VALID_NAV_IDS.has(activeNav)) return;
    const pageKey = `${currentUser.id}:${activeNav}`;
    if (lastSavedPageRef.current === pageKey) return;
    lastSavedPageRef.current = pageKey;

    const timer = setTimeout(() => {
      apiFetch('/auth/preferred-page', {
        method: 'PUT',
        body: JSON.stringify({ preferred_page: activeNav })
      }).catch(() => { });
    }, 500); // Wait 500ms before saving preference

    return () => clearTimeout(timer);
  }, [activeNav, currentUser?.id, isLoggedIn]);

  const [showBell, setShowBell] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const messageNotificationDismissedRef = useRef(false);

  // ── Fetch persisted notifications from the server ────────────
  const fetchNotifications = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await apiFetch('/notifications');
      if (!res.ok) return;
      const dbNotifs = await res.json();
      setNotifications(prev => {
        const localOnly = prev.filter(n => typeof n.id === 'string' && n.id.startsWith('unread-msg-'));
        const merged = [...localOnly, ...dbNotifs];
        // Only update state if something actually changed (avoids 5s re-render churn)
        const prevNonLocal = prev.filter(n => !(typeof n.id === 'string' && n.id.startsWith('unread-msg-')));
        const changed =
          prevNonLocal.length !== dbNotifs.length ||
          dbNotifs.some((n, i) => n.id !== prevNonLocal[i]?.id || n.is_read !== prevNonLocal[i]?.is_read);
        return changed ? merged : prev;
      });
    } catch (_e) {
      // Silent fail — bell keeps whatever state it already has
    }
  }, [isLoggedIn]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sms_theme') === 'dark');
  const bellRef = useRef(null);

  // Fetch notifications on login and refresh every 5 seconds
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, fetchNotifications]);

  // ── Global zoom ──────────────────────────────────────────────
  const ZOOM_STEP = 0.1;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 1.5;
  const [zoom, setZoom] = useState(() => {
    const saved = parseFloat(localStorage.getItem('sms_zoom'));
    return (!isNaN(saved) && saved >= ZOOM_MIN && saved <= ZOOM_MAX) ? saved : 1;
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--zoom', zoom);
    localStorage.setItem('sms_zoom', zoom);
  }, [zoom]);

  const zoomIn = () => setZoom(z => Math.min(+(z + ZOOM_STEP).toFixed(1), ZOOM_MAX));
  const zoomOut = () => setZoom(z => Math.max(+(z - ZOOM_STEP).toFixed(1), ZOOM_MIN));
  const zoomReset = () => setZoom(1);
  // ─────────────────────────────────────────────────────────────

  // Remaining purely local UI state
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [clockTime, setClockTime] = useState(() => new Date());
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('sms_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handleOutsideBellClick = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) setShowBell(false);
    };
    document.addEventListener('mousedown', handleOutsideBellClick);
    return () => document.removeEventListener('mousedown', handleOutsideBellClick);
  }, []);

  useEffect(() => {
    const handleMessagesOpened = () => {
      messageNotificationDismissedRef.current = true;
      setUnreadMessagesCount(0);
      setNotifications(prev => prev.filter(n => n.type !== 'message'));
    };
    window.addEventListener('messages:opened', handleMessagesOpened);
    return () => window.removeEventListener('messages:opened', handleMessagesOpened);
  }, []);

  // Immediately refresh notifications when SSE signals a new one (e.g. task assigned)
  useEffect(() => {
    const handleNewNotification = () => { fetchNotifications(); };
    window.addEventListener('notification:new', handleNewNotification);
    return () => window.removeEventListener('notification:new', handleNewNotification);
  }, [fetchNotifications]);

  // Handle navigation from Director Panel
  useEffect(() => {
    const handleDirectorNavigate = (event) => {
      const navId = event.detail?.nav;
      if (navId) {
        console.log('DirectorPanel navigation event received:', navId);
        setActiveNav(navId);
      }
    };
    window.addEventListener('directorNavigate', handleDirectorNavigate);
    return () => window.removeEventListener('directorNavigate', handleDirectorNavigate);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleNavSelection = (id) => {
    // Check if user has access to this module
    if (!hasModuleAccess(currentUser, id)) {
      console.warn(`❌ Access denied: User ${currentUser?.role} cannot access module ${id}`);
      // Show error notification
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        title: 'Access Denied',
        message: `You don't have permission to access this module. Required role: Director or Administrator`,
        is_read: false,
      }]);
      return; // Don't navigate
    }

    setActiveNav(id);
    // Close sidebar on mobile only
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const toggleSidebar = () => setSidebarOpen(value => !value);

  const previousUnreadCountRef = useRef(0);

  // Request browser notification permissions on login
  useEffect(() => {
    if (isLoggedIn && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isLoggedIn]);

  // Connect to real-time updates via SSE
  useRealtimeUpdates();

  // Real-time unread message count (every 2 seconds)
  useEffect(() => {
    if (!isLoggedIn) return;
    const refreshUnreadMessages = async () => {
      try {
        const res = await apiFetch('/messages/unread/count');
        if (!res.ok) return;
        const data = await res.json();

        // --- NEW MESSAGE NOTIFICATION LOGIC ---
        // If unread count increased, a new message arrived
        if (data.unread > previousUnreadCountRef.current) {
          const newMessages = data.unread - previousUnreadCountRef.current;

          // Only show native push notification if the app is in the background
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            const title = 'New Message Received';
            const body = newMessages === 1 ? 'You have 1 new message.' : `You have ${newMessages} new messages.`;
            new Notification(title, { body, icon: '/logo.jpg' });
          }

          // Reset the dismissal flag so the in-app bell badge shows up again
          messageNotificationDismissedRef.current = false;
        }
        previousUnreadCountRef.current = data.unread;

        // Fix: Actually update the nav badge state!
        setUnreadMessagesCount(data.unread);

        if (data.unread === 0) messageNotificationDismissedRef.current = false;

        // Update notifications based on actual unread count
        setNotifications(prev => {
          // Remove any placeholder message notifications
          const nonMessageNotifs = prev.filter(n => n.type !== 'message' || typeof n.id !== 'string' || !n.id.startsWith('unread-msg-'));

          // Add message notification if there are unread messages
          if (data.unread > 0 && !messageNotificationDismissedRef.current) {
            return [
              {
                id: 'unread-msg-badge',
                type: 'message',
                is_read: false,
                title: `${data.unread} unread message${data.unread > 1 ? 's' : ''}`,
                created_at: new Date().toISOString()
              },
              ...nonMessageNotifs
            ];
          }
          return nonMessageNotifs;
        });
      } catch (_e) {
        // Silently fail
      }
    };

    refreshUnreadMessages();
    const interval = setInterval(refreshUnreadMessages, 2000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Session expiry check - Since JWT tokens are now stored in httpOnly cookies,
  // we check session validity by verifying user context. Server will invalidate 
  // the cookie after 24 hours, and any API call will trigger re-authentication.
  useEffect(() => {
    if (!isLoggedIn) return;

    // Check session validity periodically; AuthContext handles an invalid session.
    const checkSessionValidity = async () => {
      try {
        await fetchCurrentUser();
      } catch (err) {
        console.error('Session check failed:', err);
      }
    };

    const interval = setInterval(checkSessionValidity, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [isLoggedIn, fetchCurrentUser]);

  const handleMarkNotificationRead = async (id) => {
    try {
      // Synthetic local entries (e.g. 'unread-msg-badge') aren't in the DB — only update state
      if (typeof id === 'string' && !Number.isFinite(Number(id))) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        return;
      }
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) { console.error(e); }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      // Re-fetch to get the authoritative DB state
      await fetchNotifications();
    } catch (e) { console.error(e); }
  };

  // ✅ SHOW LOADING STATE DURING INITIALIZATION
  if (!isInitialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ marginBottom: '20px' }}></div>
          <p style={{ color: 'var(--text-muted)' }}>Loading application...</p>
        </div>
      </div>
    );
  }

  // ✅ SHOW LOGIN PAGE WHEN NOT LOGGED IN
  if (!isLoggedIn) {
    return <LoginModal onLogin={handleLogin} />;
  }

  // ✅ SHOW APP WHEN LOGGED IN
  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading user profile...</p>
      </div>
    );
  }

  // ✅ SHOW EMPLOYEE PORTAL FOR EMPLOYEE ROLE
  if (currentUser?.role === 'Employee') {
    return (
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-page)' }}><div className="loading-spinner" /></div>}>
        <EmployeePortal currentUser={currentUser} onLogout={handleLogout} />
      </Suspense>
    );
  }

  // ── Role-based navigation ──────────────────────────────────
  const getAccessibleNavItems = (role) => {
    const all = [
      { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, roles: ['Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'DIRECTOR_PANEL', label: 'Management Control', icon: Crown, roles: ['Director', 'Administrator'], showInSidebar: true },

      { id: 'MESSAGES', label: 'Messages', icon: MessageCircle, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'MATERIALS', label: 'Material Registry', icon: Package, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'TRANSACTIONS', label: 'Stock Movements', icon: ArrowLeftRight, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'REQUESTS', label: 'Material Requests', icon: ClipboardList, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'TASKS', label: 'Task Assignments', icon: ClipboardList, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'RECEIPTS', label: 'Receipts', icon: FileBarChart, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'TRANSFERS', label: 'Stock Transfers', icon: MoveRight, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper'], showInSidebar: true },
      { id: 'SUPPLIERS', label: 'Suppliers', icon: Truck, roles: ['Director', 'Administrator', 'Manager'], showInSidebar: false },
      // HIDDEN FROM HIGH-LEVEL USERS (moved to Management Control)
      { id: 'CATEGORIES', label: 'Categories', icon: Tag, roles: ['Manager'], showInSidebar: true },
      { id: 'PROCUREMENT', label: 'Purchase Orders', icon: ShoppingCart, roles: ['Director', 'Administrator', 'Manager'], showInSidebar: true },
      { id: 'GMAIL', label: 'Emails', icon: Mail, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'HELP', label: 'Help & Support', icon: HelpCircle, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee'], showInSidebar: true },
      { id: 'REPORTS', label: 'Reporting Center', icon: FileBarChart, roles: ['Director', 'Administrator', 'Manager', 'Storekeeper'], showInSidebar: true },
      // HIGH-LEVEL USERS ONLY (accessible only from Management Control)
      { id: 'USER_AUDIT', label: 'User Audit', icon: Shield, roles: ['Director', 'Administrator'], showInSidebar: false },
      { id: 'SETTINGS', label: 'System Settings', icon: Settings, roles: ['Director', 'Administrator'], showInSidebar: false },

      // RESTRICTED: These are ONLY accessible from Director Panel - NOT shown in main sidebar
      { id: 'EMPLOYEES', label: 'Employees / Depts', icon: Users, roles: ['Director', 'Administrator'], showInSidebar: false },
      { id: 'WAREHOUSES', label: 'Warehouses', icon: Building2, roles: ['Director', 'Administrator'], showInSidebar: false },
      { id: 'USERS_AUDIT', label: 'User Roles & Audits', icon: Shield, roles: ['Director', 'Administrator'], showInSidebar: false },
    ];
    return all.filter(item => item.roles.includes(role));
  };

  const navItems = getAccessibleNavItems(currentUser?.role || 'Storekeeper');
  // Filter out items that shouldn't be shown in the main sidebar
  const sidebarNavItems = navItems.filter(item => item.showInSidebar !== false);
  const isReadOnly = currentUser?.role === 'Employee';
  const lowStockItems = materials.filter((material) => Number(material.current_stock) <= Number(material.min_stock_level));
  const productAlertCount = lowStockItems.length + notifications.filter(n => !n.is_read && n.type !== 'message').length;
  const unreadProductNotifications = notifications.filter(n => !n.is_read && n.type !== 'message');

  // Count unread messages for message badge only
  const unreadMessageCount = unreadMessagesCount;

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <img
            src={systemSettings.organization_logo || '/logo.jpg'}
            alt="Logo"
            className="sidebar-logo"
          />
          <div className="sidebar-brand-info">
            <h1>{systemSettings.organization_name || 'Store Management System'}</h1>
          </div>
        </div>

        <div className="sidebar-profile-card sidebar-profile-top">
          <div className="sidebar-profile-avatar">
            <UserAvatar user={currentUser} size={62} key={currentUser?.avatar_url || 'no-avatar'} />
          </div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{currentUser?.full_name || currentUser?.username}</div>
            <div className="sidebar-profile-role">{currentUser?.role || 'User'}</div>
            <span className="sidebar-profile-status">Online</span>
          </div>
        </div>

        <div className="sidebar-section-title">Navigation</div>
        <nav className="sidebar-nav">
          {sidebarNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavSelection(item.id)}
                className={`nav-button${isActive ? ' active' : ''}`}
              >
                <Icon size={18} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {isReadOnly && (
          <div className="sidebar-warning">
            Read-Only Mode ({currentUser?.role})
          </div>
        )}

        <div className="sidebar-status">
          <div className={`status-pill ${apiError ? 'status-error' : usingFallback ? 'status-warning' : 'status-ok'}`}>
            <Database size={14} />
            <span>{dbStatus}</span>
          </div>
          {apiError && (
            <button className="btn btn-sm status-retry" onClick={() => fetchData()} title="Retry connecting">
              Retry
            </button>
          )}
        </div>
      </aside>

      <div className={`mobile-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className="app-content">
        <SharedHeader
          toggleSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
          fetchData={fetchData}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          clockTime={clockTime}
          productAlertCount={productAlertCount}
          showBell={showBell}
          setShowBell={setShowBell}
          bellRef={bellRef}
          lowStockItems={lowStockItems}
          unreadProductNotifications={unreadProductNotifications}
          handleMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          handleMarkNotificationRead={handleMarkNotificationRead}
          currentUser={currentUser}
          unreadMessageCount={unreadMessageCount}
          setActiveNav={setActiveNav}
          setShowProfileModal={() => setShowProfileModal(true)}
          handleLogout={handleLogout}
        />

        <main className="app-main">
          {/* ── Server offline banner ── */}
          {apiError && (
            <div style={{
              marginBottom: '20px', padding: '14px 20px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap'
            }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', color: '#ef4444', fontSize: '14px' }}>
                  Backend server is not reachable
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Start the server: open a terminal in the project folder and run{' '}
                  <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>npm run server</code>
                  {' '}— auto-reconnecting in {retryCountdown}s
                </div>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => { setRetryCountdown(10); fetchData(); }}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', flexShrink: 0 }}
              >
                ↻ Retry Now
              </button>
            </div>
          )}
          {/* Page header removed for cleaner UI */}

          {/* ── Page Router ── */}
          {activeNav === 'DIRECTOR_PANEL' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Management Control...</div>}>
              <ManagementControlDashboard />
            </Suspense>
          )}

          {activeNav === 'WAREHOUSES' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
              {['Director', 'Administrator'].includes(currentUser?.role) ? (
                <WarehouseManager />
              ) : (
                <AccessDenied feature="Warehouse Management" requiredRole="Access via Director Panel" currentRole={currentUser?.role} />
              )}
            </Suspense>
          )}

          {activeNav === 'PROCUREMENT' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
              <ProcurementManager />
            </Suspense>
          )}

          {activeNav === 'HELP' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
              <HelpSupport />
            </Suspense>
          )}

          {activeNav === 'MESSAGES' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Messages...</div>}>
              <MessagesPage />
            </Suspense>
          )}

          {activeNav === 'DASHBOARD' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
              <Dashboard
                stats={stats}
                materials={materials}
                transactions={transactions}
                currentUser={currentUser}
                onQuickStockIn={() => setActiveNav('TRANSACTIONS')}
                onQuickStockOut={() => setActiveNav('TRANSACTIONS')}
                onOpenRequests={() => setActiveNav('REQUESTS')}
                onOpenTransfers={() => setActiveNav('TRANSFERS')}
                onOpenProfile={() => setShowProfileModal(true)}
              />
            </Suspense>
          )}

          {activeNav === 'MATERIALS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Materials...</div>}>
              <MaterialManager
                materials={materials}
                categories={categories}
                suppliers={suppliers}
                currentUser={currentUser}
                onAddMaterial={handleAddMaterial}
                onEditMaterial={handleEditMaterial}
                onDeleteMaterial={handleDeleteMaterial}
              />
            </Suspense>
          )}

          {activeNav === 'TRANSACTIONS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Transactions...</div>}>
              <InventoryTransactions
                materials={materials}
                suppliers={suppliers}
                employees={employees}
                transactions={transactions}
                disposals={disposals}
                currentUser={currentUser}
                onStockIn={handleStockIn}
                onStockOut={handleStockOut}
                onReturn={handleReturn}
                onAdjust={handleAdjust}
                onRefresh={fetchData}
              />
            </Suspense>
          )}

          {activeNav === 'REQUESTS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Requests...</div>}>
              <MaterialRequests />
            </Suspense>
          )}

          {activeNav === 'TASKS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Tasks...</div>}>
              <TaskManager />
            </Suspense>
          )}

          {activeNav === 'RECEIPTS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Receipts...</div>}>
              <Receipts />
            </Suspense>
          )}

          {activeNav === 'TRANSFERS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Transfers...</div>}>
              <StockTransfers
                transfers={transfers}
                materials={materials}
                currentUser={currentUser}
                onTransfer={handleTransfer}
                onRefresh={fetchData}
              />
            </Suspense>
          )}

          {activeNav === 'EMPLOYEES' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Employees...</div>}>
              {['Director', 'Administrator', 'Manager', 'Storekeeper'].includes(currentUser?.role) ? (
                <EmployeeDeptManager
                  employees={employees}
                  transactions={transactions}
                  currentUser={currentUser}
                  onAddEmployee={handleAddEmployee}
                  onRefresh={fetchData}
                />
              ) : (
                <AccessDenied feature="Employees / Departments" requiredRole="Director-level access" currentRole={currentUser?.role} />
              )}
            </Suspense>
          )}

          {activeNav === 'SUPPLIERS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Suppliers...</div>}>
              {['Director', 'Administrator', 'Manager'].includes(currentUser?.role) ? (
                <SupplierManager
                  suppliers={suppliers}
                  materials={materials}
                  currentUser={currentUser}
                  onAddSupplier={handleAddSupplier}
                  onRefresh={fetchData}
                />
              ) : (
                <AccessDenied feature="Supplier Management" requiredRole="Director-level access" currentRole={currentUser?.role} />
              )}
            </Suspense>
          )}

          {activeNav === 'CATEGORIES' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Categories...</div>}>
              {['Director', 'Administrator', 'Manager'].includes(currentUser?.role) ? (
                <CategoryManager categories={categories} currentUser={currentUser} onRefresh={fetchData} />
              ) : (
                <AccessDenied feature="Category Management" requiredRole="Director-level access" currentRole={currentUser?.role} />
              )}
            </Suspense>
          )}

          {activeNav === 'REPORTS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Reports...</div>}>
              <ReportsCenter
                materials={materials}
                categories={categories}
                transactions={transactions}
                suppliers={suppliers}
                employees={employees}
                currentUser={currentUser}
              />
            </Suspense>
          )}
          {activeNav === 'USERS_AUDIT' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading User Management...</div>}>
              {['Director', 'Administrator'].includes(currentUser?.role) ? (
                <UserAndAuditManager
                  users={usersList}
                  auditLogs={auditLogs}
                  currentUser={currentUser}
                  onAddUser={handleAddUser}
                  onRefresh={fetchData}
                />
              ) : (
                <AccessDenied feature="User Roles & Audits" requiredRole="Access via Director Panel" currentRole={currentUser?.role} />
              )}
            </Suspense>
          )}
          {activeNav === 'USER_AUDIT' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading User Audit…</div>}>
              <UserAudit currentUser={currentUser} />
            </Suspense>
          )}
          {activeNav === 'SETTINGS' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Settings...</div>}>
              {['Director', 'Administrator'].includes(currentUser?.role) ? (
                <SystemSettings currentUser={currentUser} />
              ) : (
                <AccessDenied feature="System Settings" requiredRole="Access via Director Panel" currentRole={currentUser?.role} />
              )}
            </Suspense>
          )}

          {activeNav === 'GMAIL' && (
            <Suspense fallback={<div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading Emails...</div>}>
              <GmailIntegration currentUser={currentUser} />
            </Suspense>
          )}
        </main>
        {/* Profile / Change Password Modal */}
        {showProfileModal && (
          <UserProfileModal
            currentUser={currentUser}
            onClose={() => setShowProfileModal(false)}
            onProfileUpdated={(updated) => {
              setCurrentUser(updated);
              localStorage.setItem('current_user', JSON.stringify(updated));
            }}
          />
        )}

      </div>
    </div>
  );
}




