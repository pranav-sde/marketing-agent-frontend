import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const API_KEY = import.meta.env.VITE_VARKETING_API_KEY || 'Press@001';

function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [magazines, setMagazines] = useState([]);
  const [selectedMagazineId, setSelectedMagazineId] = useState('');
  const [calendar, setCalendar] = useState([]);
  const [settings, setSettings] = useState({ whatsappAccessToken: '', whatsappPhoneNumberId: '' });
  const [loading, setLoading] = useState(false);
  const [cardLoadingId, setCardLoadingId] = useState(null); // Track specific card loading (e.g. during regeneration)
  const [toast, setToast] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingMediaUrl, setEditingMediaUrl] = useState('');
  const [analyticsData, setAnalyticsData] = useState({});
  const [adHocCampaigns, setAdHocCampaigns] = useState([]);
  const [adHocAnalyticsData, setAdHocAnalyticsData] = useState({});
  const [showAdHocForm, setShowAdHocForm] = useState(false);
  const getDefaultScheduledTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d - tzOffset)).toISOString().slice(0, 16);
  };
  const [newAdHocForm, setNewAdHocForm] = useState({ messageText: '', mediaUrl: '', platform: 'WHATSAPP', scheduledTime: getDefaultScheduledTime() });
  const [uploadingAdHocMedia, setUploadingAdHocMedia] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const headers = {
    'X-API-KEY': API_KEY,
    'Content-Type': 'application/json'
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch tenants on mount
  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchMagazines(selectedTenantId);
      fetchSettings(selectedTenantId);
      fetchAdHocCampaigns(selectedTenantId);
    }
  }, [selectedTenantId]);

  // Fetch calendar when magazine changes
  useEffect(() => {
    if (selectedTenantId && selectedMagazineId) {
      fetchCalendar(selectedTenantId, selectedMagazineId);
    } else {
      setCalendar([]);
    }
  }, [selectedMagazineId, selectedTenantId]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/tenants`, { headers });
      const data = await res.json();
      setTenants(data);
      if (data.length > 0) {
        setSelectedTenantId(data[0].id);
      } else {
        // Create default tenant if none exists to simplify experience
        createDefaultTenant();
      }
    } catch (err) {
      showToast('Failed to fetch tenants. Check if backend is running.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultTenant = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/tenants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Default Tenant',
          slug: 'default-tenant',
          timezone: 'UTC',
          defaultLocale: 'en'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTenants([data]);
        setSelectedTenantId(data.id);
        showToast('Default tenant created successfully.');
      }
    } catch (err) {
      showToast('Failed to create default tenant.', 'error');
    }
  };

  const fetchMagazines = async (tenantId) => {
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${tenantId}/magazines`, { headers });
      const data = await res.json();
      setMagazines(data);
      if (data.length > 0) {
        setSelectedMagazineId(data[0].id);
      } else {
        setSelectedMagazineId('');
      }
    } catch (err) {
      showToast('Failed to fetch magazines.', 'error');
    }
  };

  const fetchCalendar = async (tenantId, magazineId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${tenantId}/magazines/${magazineId}/calendar`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCalendar(data);
        fetchAnalyticsForCalendar(tenantId, data);
      }
    } catch (err) {
      showToast('Failed to load content calendar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsForCalendar = async (tenantId, calendarData) => {
    const analytics = {};
    for (const item of calendarData) {
      if (item.status === 'SENT') {
        try {
          const res = await fetch(`${API_BASE}/v1/tenants/${tenantId}/calendar/${item.id}/analytics`, { headers });
          if (res.ok) {
            analytics[item.id] = await res.json();
          }
        } catch (err) {
          console.error('Failed to fetch analytics for', item.id);
        }
      }
    }
    setAnalyticsData(analytics);
  };

  const fetchAdHocCampaigns = async (tenantId) => {
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${tenantId}/adhoc-campaigns`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdHocCampaigns(data);
        fetchAnalyticsForAdHoc(tenantId, data);
      }
    } catch (err) {
      showToast('Failed to load today campaigns.', 'error');
    }
  };

  const fetchAnalyticsForAdHoc = async (tenantId, campaignsData) => {
    const analytics = {};
    for (const item of campaignsData) {
      if (item.status === 'SENT') {
        try {
          const res = await fetch(`${API_BASE}/v1/tenants/${tenantId}/adhoc-campaigns/${item.id}/analytics`, { headers });
          if (res.ok) {
            analytics[item.id] = await res.json();
          }
        } catch (err) {
          console.error('Failed to fetch analytics for', item.id);
        }
      }
    }
    setAdHocAnalyticsData(analytics);
  };

  const fetchSettings = async (tenantId) => {
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${tenantId}/settings`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          whatsappAccessToken: data.whatsappAccessToken || '',
          whatsappPhoneNumberId: data.whatsappPhoneNumberId || ''
        });
      }
    } catch (err) {
      showToast('Failed to fetch API settings.', 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          whatsappAccessToken: data.whatsappAccessToken || '',
          whatsappPhoneNumberId: data.whatsappPhoneNumberId || ''
        });
        showToast('WhatsApp configuration saved successfully.');
      } else {
        showToast('Failed to save configuration.', 'error');
      }
    } catch (err) {
      showToast('Network error while saving settings.', 'error');
    }
  };

  const handleApprove = async (entryId) => {
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/calendar/${entryId}/approve`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        const updated = await res.json();
        setCalendar(calendar.map(item => item.id === entryId ? { ...item, status: updated.status } : item));
        showToast(`Day ${updated.dayNumber} approved successfully.`);
      }
    } catch (err) {
      showToast('Failed to approve post.', 'error');
    }
  };

  const handleSendNow = async (entryId) => {
    const recipient = window.prompt(
      'Enter recipient phone number with country code (e.g. +91XXXXXXXXXX or +1XXXXXXXXXX):',
      '+919876543210'
    );
    if (recipient === null) return; // user cancelled

    setCardLoadingId(entryId);
    try {
      const url = `${API_BASE}/v1/tenants/${selectedTenantId}/calendar/${entryId}/send?recipientPhone=${encodeURIComponent(recipient)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        const updated = await res.json();
        setCalendar(calendar.map(item => item.id === entryId ? { ...item, status: updated.status } : item));
        showToast(`Day ${updated.dayNumber} sent on WhatsApp successfully!`);
      } else {
        const errText = await res.text();
        showToast(`Failed to send: ${errText}`, 'error');
      }
    } catch (err) {
      showToast('Failed to trigger immediate broadcast.', 'error');
    } finally {
      setCardLoadingId(null);
    }
  };

  const handleOnHold = async (entryId) => {
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/calendar/${entryId}/on-hold`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        const updated = await res.json();
        setCalendar(calendar.map(item => item.id === entryId ? { ...item, status: updated.status } : item));
        showToast(`Day ${updated.dayNumber} put on hold.`);
      }
    } catch (err) {
      showToast('Failed to put post on hold.', 'error');
    }
  };

  const handleReject = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/calendar/${entryId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setCalendar(calendar.filter(item => item.id !== entryId));
        showToast(`Post deleted successfully.`);
      }
    } catch (err) {
      showToast('Failed to delete post.', 'error');
    }
  };

  const handleRegenerate = async (entryId) => {
    setCardLoadingId(entryId);
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/calendar/${entryId}/regenerate`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        const updated = await res.json();
        setCalendar(calendar.map(item => item.id === entryId ? { ...item, status: updated.status, messageText: updated.messageText, mediaUrl: updated.mediaUrl } : item));
        showToast(`Day ${updated.dayNumber} regenerated.`);
      }
    } catch (err) {
      showToast('Failed to regenerate post.', 'error');
    } finally {
      setCardLoadingId(null);
    }
  };

  const handleCustomImageUpload = async (entryId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setCardLoadingId(entryId);
    showToast('Uploading custom image...');
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/calendar/${entryId}/media`, {
        method: 'POST',
        headers: {
          'X-API-KEY': API_KEY
        },
        body: formData
      });
      if (res.ok) {
        const updated = await res.json();
        setCalendar(calendar.map(item => item.id === entryId ? { ...item, mediaUrl: updated.mediaUrl } : item));
        showToast('Image updated successfully!');
      } else {
        showToast('Failed to upload image.', 'error');
      }
    } catch (err) {
      showToast('Error uploading image.', 'error');
    } finally {
      setCardLoadingId(null);
      e.target.value = null;
    }
  };

  const startEdit = (item) => {
    if (item.status === 'SENT') return; // Cannot edit sent posts
    setEditingEntryId(item.id);
    setEditingText(item.messageText || '');
    setEditingMediaUrl(item.mediaUrl || '');
  };

  const saveEdit = async (entryId) => {
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/calendar/${entryId}/message`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ messageText: editingText, mediaUrl: editingMediaUrl })
      });
      if (res.ok) {
        const updated = await res.json();
        setCalendar(calendar.map(item => item.id === entryId ? { ...item, messageText: updated.messageText, mediaUrl: updated.mediaUrl } : item));
        setEditingEntryId(null);
        showToast('Post content updated successfully.');
      }
    } catch (err) {
      showToast('Failed to save message updates.', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    showToast('Uploading magazine...');
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/magazines`, {
        method: 'POST',
        headers: {
          'X-API-KEY': API_KEY
        },
        body: formData
      });
      if (res.ok) {
        const newMagazine = await res.json();
        showToast('Magazine uploaded successfully! Processing stories...');
        await fetchMagazines(selectedTenantId);
        setSelectedMagazineId(newMagazine.id);
      } else {
        showToast('Failed to upload magazine.', 'error');
      }
    } catch (err) {
      showToast('Error uploading file.', 'error');
    } finally {
      setLoading(false);
      e.target.value = null; // reset input
    }
  };

  const handleGenerateCalendar = async () => {
    setLoading(true);
    showToast('Generating calendar, this may take a moment...');
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/magazines/${selectedMagazineId}/generate-calendar`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        showToast('Content calendar generated successfully!');
        fetchCalendar(selectedTenantId, selectedMagazineId);
      } else {
        showToast('Failed to generate calendar. Wait for stories to process and try again.', 'error');
      }
    } catch (err) {
      showToast('Error generating calendar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMagazine = async () => {
    if (!selectedMagazineId) return;
    if (!window.confirm('Are you sure you want to delete this magazine issue and all its posts?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/magazines/${selectedMagazineId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        showToast('Magazine and associated calendar posts deleted successfully.');
        await fetchMagazines(selectedTenantId);
      } else {
        showToast('Failed to delete magazine.', 'error');
      }
    } catch (err) {
      showToast('Error deleting magazine.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdHocCampaign = async (e) => {
    e.preventDefault();
    if (!newAdHocForm.messageText) {
      showToast('Message text is required.', 'error');
      return;
    }
    setLoading(true);
    try {
      let timeStr = newAdHocForm.scheduledTime;
      if (!timeStr) {
        showToast('Scheduled time is required.', 'error');
        setLoading(false);
        return;
      }
      timeStr = new Date(timeStr).toISOString();
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/adhoc-campaigns`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messageText: newAdHocForm.messageText,
          mediaUrl: newAdHocForm.mediaUrl,
          platform: newAdHocForm.platform,
          scheduledTime: timeStr
        })
      });
      if (res.ok) {
        showToast('Campaign scheduled successfully!');
        setNewAdHocForm({ messageText: '', mediaUrl: '', platform: 'WHATSAPP', scheduledTime: getDefaultScheduledTime() });
        fetchAdHocCampaigns(selectedTenantId);
      } else {
        showToast('Failed to schedule campaign.', 'error');
      }
    } catch (err) {
      showToast('Network error while scheduling campaign.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdHocAction = async (campaignId, action, newTime = null) => {
    try {
      const options = { method: 'POST', headers };
      if (action === 'reschedule' && newTime) {
         options.body = JSON.stringify({ scheduledTime: new Date(newTime).toISOString() });
      }
      const res = await fetch(`${API_BASE}/v1/tenants/${selectedTenantId}/adhoc-campaigns/${campaignId}/${action}`, options);
      if (res.ok) {
        showToast(`Campaign ${action} successful.`);
        fetchAdHocCampaigns(selectedTenantId);
      } else {
        showToast(`Failed to ${action} campaign.`, 'error');
      }
    } catch (e) {
      showToast(`Error performing ${action}`, 'error');
    }
  };

  const formatCountdown = (scheduledTimeStr) => {
    const diff = new Date(scheduledTimeStr) - now;
    if (diff <= 0) return 'Starting...';
    
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    return `Starts in: ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ fontSize: '1.75rem' }}>📖</div>
          <h1>SailorToday AI</h1>
        </div>
        <nav className="nav-links">
          <div
            className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <span>🗓️</span> Content Calendar
          </div>
          <div
            className={`nav-item ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            <span>⏰</span> Today
          </div>
          <div
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span>⚙️</span> API Settings
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <div>
            <h2>{activeTab === 'calendar' ? 'Campaign Content Calendar' : activeTab === 'today' ? 'Today\'s Ad-Hoc Campaigns' : 'WhatsApp Integration Credentials'}</h2>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>
              {activeTab === 'calendar' ? 'Manage your 30-day broadcast calendar for active subscribers' : activeTab === 'today' ? 'Schedule custom posts for today' : 'Configure your WhatsApp API tokens'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Active Client:</span>
            <select
              className="tenant-selector"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Tab Panels */}
        {activeTab === 'calendar' ? (
          <div>
            {/* Magazine Switcher and Upload */}
            <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.95rem', color: '#94a3b8' }}>Select Magazine Issue:</span>
              <select
                className="tenant-selector"
                value={selectedMagazineId}
                onChange={(e) => setSelectedMagazineId(e.target.value)}
              >
                <option value="">-- Select Magazine --</option>
                {magazines.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>

              <label className="btn-action" style={{ cursor: 'pointer', background: '#3b82f6', color: 'white' }}>
                Upload Magazine
                <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>

              {selectedMagazineId && (
                <button 
                  className="btn-action" 
                  style={{ background: '#ef4444', color: 'white', borderColor: '#ef4444' }} 
                  onClick={handleDeleteMagazine}
                  disabled={loading}
                >
                  Delete Magazine
                </button>
              )}

              {selectedMagazineId && calendar.length === 0 && !loading && (
                <button className="btn-action" style={{ background: '#10b981', color: 'white' }} onClick={handleGenerateCalendar}>
                  Generate Calendar
                </button>
              )}
            </div>

            {loading ? (
              <div className="spinner" />
            ) : calendar.length > 0 ? (
              <div className="calendar-grid">
                {calendar.map(item => (
                  <div key={item.id} className={`card ${item.status.toLowerCase()}`}>
                    <div>
                      {/* Card Header */}
                      <div className="card-header">
                        <div className="day-badge">
                          Day {item.dayNumber}
                          <span>({item.scheduledDate})</span>
                        </div>
                        <span className={`status-badge ${item.status.toLowerCase()}`}>
                          {item.status}
                        </span>
                      </div>

                      {/* Content Angle */}
                      <div className="angle-tag">
                        ✨ {item.contentAngle || 'Story Post'}
                      </div>

                      {/* Image Preview */}
                      {item.mediaUrl && (
                        <div className="card-media-preview">
                          {getYouTubeId(item.mediaUrl) ? (
                            <iframe
                              width="100%"
                              height="100%"
                              src={`https://www.youtube.com/embed/${getYouTubeId(item.mediaUrl)}`}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              style={{ borderRadius: '12px' }}
                            ></iframe>
                          ) : (
                            <img src={item.mediaUrl} alt="Post Media" />
                          )}
                        </div>
                      )}

                      {/* Message Body */}
                      <div className="card-body">
                        {editingEntryId === item.id ? (
                          <div>
                            <textarea
                              className="message-edit-area"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button className="btn-action save-btn" onClick={() => saveEdit(item.id)}>
                                Save Text
                              </button>
                              <label className="btn-action" style={{ cursor: 'pointer', background: '#3b82f6', color: 'white', margin: 0 }}>
                                Replace Image
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleCustomImageUpload(item.id, e)} />
                              </label>
                              <button className="btn-action" onClick={() => setEditingEntryId(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="message-text"
                            onClick={() => startEdit(item)}
                            title={item.status !== 'SENT' ? "Click to edit post content" : ""}
                          >
                            {item.messageText || (
                              <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                                Generating post message...
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    {item.status !== 'SENT' && (
                      <div className="card-actions">
                        <button
                          className="btn-action approve-btn"
                          onClick={() => handleApprove(item.id)}
                          disabled={cardLoadingId === item.id}
                        >
                          ✔️ Approve
                        </button>
                        <button
                          className="btn-action"
                          style={{ background: '#10b981', color: 'white', borderColor: '#10b981' }}
                          onClick={() => handleSendNow(item.id)}
                          disabled={cardLoadingId === item.id}
                        >
                          🚀 Send Now
                        </button>
                        <button
                          className="btn-action"
                          style={{ background: '#f59e0b', color: 'white', borderColor: '#f59e0b' }}
                          onClick={() => handleOnHold(item.id)}
                          disabled={cardLoadingId === item.id}
                        >
                          ⏸️ On Hold
                        </button>
                        <button
                          className="btn-action reject-btn"
                          onClick={() => handleReject(item.id)}
                          disabled={cardLoadingId === item.id}
                        >
                          ❌ Reject
                        </button>
                        <button
                          className="btn-action regenerate-btn"
                          onClick={() => handleRegenerate(item.id)}
                          disabled={cardLoadingId === item.id}
                        >
                          {cardLoadingId === item.id ? '⏳ Gen...' : '🔄 Regenerate'}
                        </button>
                      </div>
                    )}
                    {item.status === 'SENT' && analyticsData[item.id] && (
                      <div className="card-analytics" style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3b82f6' }}>{analyticsData[item.id].sentCount}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Sent</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>{analyticsData[item.id].deliveredCount}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Delivered</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#8b5cf6' }}>{analyticsData[item.id].readCount}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Read</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>{analyticsData[item.id].failedCount}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Failed</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-calendar">
                <h3>No Campaign Content Found</h3>
                <p>Upload a magazine PDF and generate the content calendar on the backend to display it here.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'today' ? (
          /* Today Ad-Hoc Tab */
          <div className="today-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ margin: 0, fontWeight: '600', fontSize: '1.25rem' }}>Upcoming & Sent Campaigns</h3>
              <button 
                className="btn-primary" 
                onClick={() => setShowAdHocForm(!showAdHocForm)}
              >
                {showAdHocForm ? 'Close Form' : '+ Create Campaign'}
              </button>
            </div>

            {showAdHocForm && (
              <div className="modal-overlay" onClick={() => setShowAdHocForm(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Schedule a Custom Message</h3>
                    <button className="modal-close" onClick={() => setShowAdHocForm(false)}>✕</button>
                  </div>
                  <form onSubmit={(e) => {
                    handleCreateAdHocCampaign(e);
                    setShowAdHocForm(false);
                  }}>
                    <div className="form-group">
                      <label>MESSAGE TEXT</label>
                      <textarea
                        className="form-control"
                        rows="4"
                        placeholder="Type the exact message to send to all active contacts..."
                        value={newAdHocForm.messageText}
                        onChange={(e) => setNewAdHocForm({ ...newAdHocForm, messageText: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>MEDIA URL (Optional)</label>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="e.g., https://example.com/promo.jpg"
                        value={newAdHocForm.mediaUrl}
                        onChange={(e) => setNewAdHocForm({ ...newAdHocForm, mediaUrl: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label>PLATFORM</label>
                        <select
                          className="form-control"
                          value={newAdHocForm.platform}
                          onChange={(e) => setNewAdHocForm({ ...newAdHocForm, platform: e.target.value })}
                        >
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="LINKEDIN">LinkedIn</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label>SCHEDULED TIME</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={newAdHocForm.scheduledTime}
                          onChange={(e) => setNewAdHocForm({ ...newAdHocForm, scheduledTime: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                      {loading ? 'Scheduling...' : 'Confirm Schedule'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="calendar-grid">
              {adHocCampaigns.map(item => (
                <div key={item.id} className={`card ${item.status.toLowerCase()}`}>
                  <div>
                    <div className="card-header" style={{ alignItems: 'flex-start' }}>
                      <div className="day-badge" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{new Date(item.scheduledTime).toLocaleString()}</span>
                        {item.status === 'SCHEDULED' && (
                          <span style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px' }}>
                            {formatCountdown(item.scheduledTime)}
                          </span>
                        )}
                      </div>
                      <span className={`status-badge ${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="angle-tag">
                      ✨ {item.platform} Campaign
                    </div>

                    {item.mediaUrl && (
                      <div className="card-media-preview">
                        {getYouTubeId(item.mediaUrl) ? (
                          <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${getYouTubeId(item.mediaUrl)}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ borderRadius: '12px' }}
                          ></iframe>
                        ) : (
                          <img src={item.mediaUrl} alt="AdHoc Media" />
                        )}
                      </div>
                    )}

                    <div className="card-body">
                      <div className="message-text">
                        {item.messageText}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Controls */}
                  {item.status !== 'SENT' && item.status !== 'CANCELED' && (
                    <div className="card-actions" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
                      {item.status === 'SCHEDULED' && (
                        <button className="btn-action" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }} onClick={() => handleAdHocAction(item.id, 'pause')}>
                          ⏸️ Pause
                        </button>
                      )}
                      {item.status === 'PAUSED' && (
                        <button className="btn-action" style={{ background: '#10b981', color: '#fff', borderColor: '#10b981' }} onClick={() => handleAdHocAction(item.id, 'resume')}>
                          ▶️ Resume
                        </button>
                      )}
                      <button className="btn-action" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }} onClick={() => { if(window.confirm('Cancel campaign?')) handleAdHocAction(item.id, 'cancel'); }}>
                        ❌ Cancel
                      </button>
                      <button className="btn-action" onClick={() => {
                        const newDate = window.prompt("Enter new time (YYYY-MM-DDTHH:mm):");
                        if (newDate) handleAdHocAction(item.id, 'reschedule', newDate);
                      }}>
                        ⏱️ Reschedule
                      </button>
                    </div>
                  )}

                  {item.status === 'SENT' && adHocAnalyticsData[item.id] && (
                    <div className="card-analytics" style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3b82f6' }}>{adHocAnalyticsData[item.id].sentCount}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Sent</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>{adHocAnalyticsData[item.id].deliveredCount}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Delivered</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#8b5cf6' }}>{adHocAnalyticsData[item.id].readCount}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Read</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>{adHocAnalyticsData[item.id].failedCount}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Failed</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {adHocCampaigns.length === 0 && (
                <div style={{ color: '#64748b' }}>No custom campaigns scheduled for this tenant.</div>
              )}
            </div>
          </div>
        ) : (
          /* Settings Tab */
          <div className="settings-container">
            <h3 style={{ margin: '0 0 1.5rem 0', fontWeight: '600', fontSize: '1.25rem' }}>
              WhatsApp Business Account Settings
            </h3>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>WHATSAPP API ACCESS TOKEN</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter Bearer Token (masked when saved)"
                  value={settings.whatsappAccessToken}
                  onChange={(e) => setSettings({ ...settings, whatsappAccessToken: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>WHATSAPP PHONE NUMBER ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Phone Number ID (e.g. 104838520857321)"
                  value={settings.whatsappPhoneNumberId}
                  onChange={(e) => setSettings({ ...settings, whatsappPhoneNumberId: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Save Configuration Settings
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Toast Alert */}
      {toast && (
        <div className="toast">
          <div>{toast.type === 'success' ? '✅' : '⚠️'}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}

export default App;
