import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

// Icon components (inline SVG – no extra dependency needed)
const BellIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const CheckAllIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronDownIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

// Map notification type → colour token
const TYPE_COLORS = {
  SUBMISSION:    { bg: '#eff6ff', border: '#bfdbfe', icon: '📋', dot: '#3b82f6' },
  STATUS_UPDATE: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🔄', dot: '#22c55e' },
  ASSIGNMENT:    { bg: '#fdf4ff', border: '#e9d5ff', icon: '👤', dot: '#a855f7' },
  PAYMENT:       { bg: '#fff7ed', border: '#fed7aa', icon: '💳', dot: '#f97316' },
  COMPLETION:    { bg: '#f0fdf4', border: '#bbf7d0', icon: '✅', dot: '#16a34a' },
  REJECTION:     { bg: '#fef2f2', border: '#fecaca', icon: '❌', dot: '#ef4444' },
};

const DEFAULT_COLOR = { bg: '#f9fafb', border: '#e5e7eb', icon: '🔔', dot: '#6b7280' };

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsDropdown() {
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);
  const [expandedNotifs, setExpandedNotifs] = useState(new Set());
  const panelRef                          = useRef(null);
  const btnRef                            = useRef(null);

  const token = localStorage.getItem('token');

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ── poll every 30 s ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // ── close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (
        open &&
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── mark single read ──────────────────────────────────────────────────────
  const markRead = async (id) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  // ── mark all read ─────────────────────────────────────────────────────────
  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    } finally {
      setMarkingAll(false);
    }
  };

  // ── toggle expand ─────────────────────────────────────────────────────────
  const toggleExpand = (id) => {
    setExpandedNotifs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── track application ─────────────────────────────────────────────────────
  const trackApplication = (applicationId) => {
    if (applicationId) {
      // Use React Router navigate instead of window.location.href for better UX
      window.location.href = `/track?application_id=${applicationId}`;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const hasUnread   = unreadCount > 0;

  return (
    <div style={{ position: 'relative' }} id="notifications-wrapper">
      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        ref={btnRef}
        id="notifications-bell-btn"
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        title="Notifications"
        style={{
          position:       'relative',
          background:     open ? '#eff6ff' : 'transparent',
          border:         open ? '1px solid #bfdbfe' : '1px solid transparent',
          borderRadius:   '10px',
          padding:        '8px',
          cursor:         'pointer',
          color:          open ? '#2563eb' : '#6b7280',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          transition:     'all 0.2s ease',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = '#f3f4f6';
            e.currentTarget.style.color = '#374151';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#6b7280';
          }
        }}
      >
        <BellIcon />
        {/* Badge */}
        {hasUnread && (
          <span
            id="notifications-badge"
            style={{
              position:      'absolute',
              top:           '4px',
              right:         '4px',
              minWidth:      '18px',
              height:        '18px',
              padding:       '0 4px',
              borderRadius:  '9px',
              background:    '#ef4444',
              color:         'white',
              fontSize:      '11px',
              fontWeight:    '700',
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              lineHeight:    1,
              border:        '2px solid white',
              animation:     'notif-pulse 2s ease-in-out infinite',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          id="notifications-panel"
          style={{
            position:     'absolute',
            top:          'calc(100% + 10px)',
            right:        '0',
            width:        '380px',
            maxHeight:    '520px',
            background:   'white',
            borderRadius: '16px',
            boxShadow:    '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.08)',
            border:       '1px solid #e5e7eb',
            display:      'flex',
            flexDirection:'column',
            zIndex:       9999,
            overflow:     'hidden',
            animation:    'notif-slide-in 0.2s ease',
          }}
        >
          {/* Header */}
          <div style={{
            padding:        '16px 20px',
            borderBottom:   '1px solid #f3f4f6',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            background:     'linear-gradient(135deg, #f8faff 0%, #ffffff 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>
                Notifications
              </span>
              {hasUnread && (
                <span style={{
                  background: '#ef4444', color: 'white',
                  borderRadius: '12px', padding: '2px 8px',
                  fontSize: '12px', fontWeight: '700',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {hasUnread && (
                <button
                  id="notifications-mark-all-btn"
                  onClick={markAllRead}
                  disabled={markingAll}
                  title="Mark all as read"
                  style={{
                    display:     'flex', alignItems: 'center', gap: '4px',
                    padding:     '6px 12px',
                    background:  '#eff6ff', color: '#2563eb',
                    border:      '1px solid #bfdbfe',
                    borderRadius:'8px', cursor: 'pointer',
                    fontSize:    '12px', fontWeight: '600',
                    opacity:     markingAll ? 0.6 : 1,
                    transition:  'all 0.15s',
                  }}
                >
                  <CheckAllIcon /> {markingAll ? 'Marking…' : 'Mark all read'}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: '#9ca3af',
                  padding: '4px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                Loading notifications…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔕</div>
                <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>All caught up!</div>
                <div style={{ fontSize: '13px' }}>No notifications yet.</div>
              </div>
            ) : (
              notifications.map((notif) => {
                const colors = TYPE_COLORS[notif.type] || DEFAULT_COLOR;
                const isExpanded = expandedNotifs.has(notif.id);
                const applicationId = notif.related_application_id || notif.application_id;
                return (
                  <div
                    key={notif.id}
                    id={`notification-${notif.id}`}
                    onClick={() => applicationId && trackApplication(applicationId)}
                    style={{
                      padding:    '14px 20px',
                      borderBottom: '1px solid #f9fafb',
                      background: notif.is_read ? 'white' : colors.bg,
                      transition: 'background 0.15s',
                      position:   'relative',
                      cursor: applicationId ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      {/* Unread dot */}
                      {!notif.is_read && (
                        <span style={{
                          position: 'absolute', top: '18px', left: '8px',
                          width: '6px', height: '6px',
                          borderRadius: '50%', background: colors.dot,
                        }} />
                      )}

                      {/* Icon bubble */}
                      <div
                        onClick={(e) => { e.stopPropagation(); if (applicationId) trackApplication(applicationId); }}
                        style={{
                          width: '38px', height: '38px', flexShrink: 0,
                          borderRadius: '10px',
                          background: notif.is_read ? '#f3f4f6' : colors.bg,
                          border: `1px solid ${notif.is_read ? '#e5e7eb' : colors.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px',
                          cursor: applicationId ? 'pointer' : 'default',
                        }}
                        title={applicationId ? "View application details" : ""}
                      >
                        {colors.icon}
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: notif.is_read ? '500' : '700',
                          fontSize: '13px', color: '#111827',
                          marginBottom: '3px',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {notif.title}
                        </div>
                        <div style={{
                          fontSize: '12px', color: '#6b7280',
                          lineHeight: '1.5',
                          display: isExpanded ? 'block' : '-webkit-box',
                          WebkitLineClamp: isExpanded ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: isExpanded ? 'visible' : 'hidden',
                        }}>
                          {notif.message}
                        </div>
                        <div style={{
                          fontSize: '11px', color: '#9ca3af',
                          marginTop: '5px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <span>{timeAgo(notif.created_at)}</span>
                          {!notif.is_read && (
                            <span style={{
                              padding: '1px 6px', borderRadius: '4px',
                              background: colors.dot, color: 'white',
                              fontSize: '10px', fontWeight: '600',
                            }}>NEW</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        {/* Expand/collapse button */}
                        <button
                          onClick={() => toggleExpand(notif.id)}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                          style={{
                            background: 'transparent', border: 'none',
                            cursor: 'pointer', color: '#9ca3af',
                            padding: '2px', borderRadius: '4px',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          {isExpanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                        </button>

                        {/* Track Application button */}
                        {applicationId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); trackApplication(applicationId); }}
                            style={{
                              background: '#2563eb', color: 'white',
                              border: 'none', borderRadius: '6px',
                              padding: '4px 10px', fontSize: '11px',
                              fontWeight: '600', cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                            title="View application details"
                          >
                            Track
                          </button>
                        )}

                        {/* Mark-read button */}
                        {!notif.is_read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markRead(notif.id); }}
                            title="Mark as read"
                            style={{
                              background: 'white', border: '1px solid #e5e7eb',
                              borderRadius: '6px', padding: '4px 8px',
                              cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                              color: '#6b7280', whiteSpace: 'nowrap',
                            }}
                          >
                            ✓ Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '10px 20px',
              borderTop: '1px solid #f3f4f6',
              textAlign: 'center',
              background: '#fafafa',
            }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
                {' · '}SMS alerts coming soon
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Keyframe animations injected once ───────────────────────────── */}
      <style>{`
        @keyframes notif-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.15); }
        }
        @keyframes notif-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
