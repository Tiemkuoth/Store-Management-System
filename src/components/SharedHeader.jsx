import React, { useRef, useState, useEffect } from 'react';
import { Database, Sun, Moon, Bell, Mail, MessageCircle, LogOut, Menu } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { apiFetch } from '../contexts/AuthContext';

export default function SharedHeader({
  toggleSidebar,
  sidebarOpen,
  title, // optional title to show in the center
  fetchData,
  darkMode,
  setDarkMode,
  clockTime,
  productAlertCount,
  showBell,
  setShowBell,
  bellRef,
  lowStockItems = [],
  unreadProductNotifications = [],
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
  currentUser,
  unreadMessageCount,
  setActiveNav,
  setShowProfileModal,
  handleLogout
}) {
  return (
    <header className="app-bar">
      <button
        type="button"
        className="app-bar-toggle"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
        aria-expanded={sidebarOpen}
      >
        <Menu size={20} color="currentColor" />
      </button>

      {title ? (
        <div style={{ flex: 1, paddingLeft: '16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      <div className="app-bar-actions">
        {fetchData && (
          <button
            className="btn btn-icon"
            onClick={() => fetchData()}
            title="Refresh all data"
          >
            <Database size={18} color="currentColor" />
          </button>
        )}

        {setDarkMode && (
          <button
            className="btn btn-icon"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={18} color="currentColor" /> : <Moon size={18} color="currentColor" />}
          </button>
        )}

        {/* Digital Clock */}
        {clockTime && (
          <div className="clock-display">
            <span className="clock-time">
              {clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
            <span className="clock-date">
              {clockTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {setShowBell && (
          <div className="relative" ref={bellRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className={`btn btn-icon${productAlertCount > 0 || unreadProductNotifications.length > 0 ? ' header-alert-active' : ''}`}
              onClick={() => setShowBell(!showBell)}
              title="Notifications & alerts"
              aria-label="Notifications & alerts"
              aria-expanded={showBell}
            >
              <Bell size={18} />
            </button>

            {/* Numeric badge — shown when count > 0 */}
            {productAlertCount > 0 && (
              <span className="badge header-alert-badge">
                {productAlertCount > 99 ? '99+' : productAlertCount}
              </span>
            )}

            {/* Pulsing dot — shown when there are unread notifications but count is 0
                (e.g. only message-type entries filtered out of productAlertCount) */}
            {productAlertCount === 0 && unreadProductNotifications.length > 0 && (
              <span className="bell-unread-dot" />
            )}
            {showBell && (
              <div
                className="low-stock-panel"
                role="dialog"
                aria-label="Product notifications"
                style={{
                  position: 'fixed',
                  top: 'calc(var(--header-height, 44px) + 6px)',
                  right: '8px',
                  width: '320px',
                  maxWidth: 'calc(100vw - 16px)',
                  maxHeight: '480px',
                  overflowY: 'auto',
                  zIndex: 1400,
                }}
              >
                <div className="low-stock-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Product Alerts</span>
                  {unreadProductNotifications.length > 0 && handleMarkAllNotificationsRead && (
                    <button className="view-all-link" onClick={handleMarkAllNotificationsRead} style={{ fontSize: '11px', border: 'none', background: 'none', cursor: 'pointer' }}>
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg-border)', borderTop: '1px solid var(--bg-border)', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                  PRODUCT ALERTS ({productAlertCount || 0})
                </div>
                <div className="low-stock-list" style={{ maxHeight: '210px', overflowY: 'auto' }}>
                  {lowStockItems.map(material => (
                    <div key={`low-stock-${material.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 14px', background: 'rgba(251, 146, 60, 0.08)', borderBottom: '1px solid var(--bg-border)' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#fb923c' }}>Low Stock: {material.name}</span>
                      <p style={{ margin: '0', fontSize: '11px', color: 'var(--text-muted)' }}>{material.current_stock} remaining (minimum {material.min_stock_level})</p>
                    </div>
                  ))}
                  {unreadProductNotifications.length === 0 && lowStockItems.length === 0 ? (
                    <div className="low-stock-empty" style={{ fontSize: '11px', padding: '12px', color: 'var(--text-muted)' }}>No product alerts.</div>
                  ) : unreadProductNotifications.map(n => {
                    const isError = n.type === 'error';
                    const isTask = n.type === 'task' || n.type === 'info';
                    const color = isError ? '#ef4444' : isTask ? '#6366f1' : '#fb923c';
                    const bg = isError ? 'rgba(239, 68, 68, 0.08)' : isTask ? 'rgba(99, 102, 241, 0.08)' : 'rgba(251, 146, 60, 0.08)';
                    return (
                      <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 14px', background: bg, borderBottom: '1px solid var(--bg-border)', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color }}>{n.title}</span>
                          {handleMarkNotificationRead && (
                            <button onClick={() => handleMarkNotificationRead(n.id)} style={{ fontSize: '9px', color, border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>
                              ✓ Mark Read
                            </button>
                          )}
                        </div>
                        <p style={{ margin: '0', fontSize: '11px', color: 'var(--text-muted)' }}>{n.message}</p>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: '0.7' }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          className="btn btn-icon app-bar-btn-optional"
          onClick={async () => {
            try {
              const res = await apiFetch('/notifications/test-email', {
                method: 'POST',
                body: JSON.stringify({ email: currentUser?.email })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed to send email');
              alert('Test email sent successfully! Check your inbox.');
            } catch (err) {
              alert(`Error: ${err.message}`);
            }
          }}
          title="Send test email notification"
          aria-label="Send test email notification"
        >
          <Mail size={18} color="currentColor" />
        </button>

        {setActiveNav && (
          <button
            className={`btn btn-icon ${unreadMessageCount > 0 ? 'header-alert-active' : ''}`}
            onClick={() => setActiveNav('MESSAGES')}
            title="Messages"
            aria-label="Messages"
            style={{ position: 'relative' }}
          >
            <MessageCircle size={18} />
            {unreadMessageCount > 0 && (
              <span className="badge header-alert-badge" style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', borderRadius: '50%', padding: '0', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unreadMessageCount}
              </span>
            )}
          </button>
        )}

        <button className="user-chip" onClick={setShowProfileModal} title="My Account">
          <UserAvatar user={currentUser} size={32} key={currentUser?.avatar_url || 'no-avatar'} />
          <div className="user-chip-text">
            <div>{currentUser?.full_name}</div>
            <div>{currentUser?.role}</div>
          </div>
        </button>

        <button className="btn btn-icon" onClick={handleLogout} title="Sign Out" style={{ width: 'auto', padding: '0 12px', gap: '6px', fontSize: '0.8125rem' }}>
          <LogOut size={16} /> <span className="sign-out-label">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
