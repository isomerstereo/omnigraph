import { useState, useEffect, useRef } from 'react'
import PocketBase from 'pocketbase';

// Initialize the single-file real-time database connection
const pb = new PocketBase('http://127.0.0.1:8090'); 

// (Optional) Keep your appId if you still use it to scope UI elements locally
const appId = typeof __app_id !== 'undefined' ? __app_id : 'history-timeline-app';
export default function App() {
  // 1. CONSTANTS & CONFIG
  const ZONES = {
    Years: { label: 'Modern (2000-Present)', scale: 150 },
    Decades: { label: 'Industrial (1700-2000)', scale: 60 },
    Centuries: { label: 'Ancient (5000 BC - 1700 AD)', scale: 15 },
    Millennia: { label: 'Pre-History (30,000 BC - 5000 BC)', scale: 2 },
    MYA: { label: 'Evolutionary (0-4000 MYA)', scale: 10 },
    GYA: { label: 'Cosmic (0-13.8 GYA)', scale: 500 }
  };

  // 2. NAVIGATION & AUTH STATE
  const [view, setView] = useState('home'); 
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentZone, setCurrentZone] = useState('Years'); 
  const [bookmarks, setBookmarks] = useState([]);

  // 3. GRAPH & DATA STATE
  const [showModal, setShowModal] = useState(false); 
  const [nodes, setNodes] = useState([]); 
  const [doubts, setDoubts] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null); 
  const [focusedNode, setFocusedNode] = useState(null);
  const [zoom, setZoom] = useState(1); 
  const [searchFilter, setSearchFilter] = useState(''); 
  const [showSuggestions, setShowSuggestions] = useState(false); 
  const [isEditing, setIsEditing] = useState(false); 

  // 4. FORM STATE
  const [formData, setFormData] = useState({
    nodeType: 'event',
    time: '',
    endTime: '',
    era: 'AD', 
    tags: '',
    title: '',
    content: '',
    icon: '⭐',
    citation: '',
    videoLink: '',
    image: '' 
  });

  const [doubtForm, setDoubtForm] = useState({
    title: '',
    content: '',
    suggestedTime: '',
    suggestedEra: 'AD'
  });
  
  const scrollRef = useRef(null); 

 // 5. POCKETBASE AUTHENTICATION LOGIC (RULE 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // If there's an environment auth token passed in, validate or sign in with it
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await pb.collection('users').authWithPassword('admin_email', 'admin_password'); // Or use token auth if applicable
        } else if (!pb.authStore.isValid) {
          // PocketBase handles guests transparently, but if you need an explicit guest/auth session:
          // For now, if there's no valid local storage session, we treat them as Guest (null auth model)
          setUser(null);
        }
      } catch (err) {
        console.error("Authentication Error:", err);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();

    // Listen for real-time auth state updates (Sign in / Sign out)
    const removeAuthListener = pb.authStore.onChange((token, model) => {
      setUser(model);
      // If the logged-in user model is an Admin/has specific flags, set admin status
      if (model && (model.isAdmin || model.role === 'admin')) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });

    return () => removeAuthListener();
  }, []);

  // 6. POCKETBASE REAL-TIME SUBSCRIPTION SYNC (RULE 1 & 2)
  useEffect(() => {
    // 1. Fetch initial records list for 'nodes' and 'doubts'
    const fetchInitialData = async () => {
      try {
        const initialNodes = await pb.collection('nodes').getFullList({ sort: '-created' });
        setNodes(initialNodes);

        const initialDoubts = await pb.collection('doubts').getFullList({ sort: '-created' });
        setDoubts(initialDoubts);
      } catch (err) {
        console.error("Initial data load error:", err);
      }
    };

    fetchInitialData();

    // 2. Subscribe to real-time changes for 'nodes'
    pb.collection('nodes').subscribe('*', (e) => {
      if (e.action === 'create') {
        setNodes((prev) => [e.record, ...prev]);
      } else if (e.action === 'update') {
        setNodes((prev) => prev.map((item) => (item.id === e.record.id ? e.record : item)));
      } else if (e.action === 'delete') {
        setNodes((prev) => prev.filter((item) => item.id !== e.record.id));
      }
    }).catch(err => console.error("Nodes subscription failed:", err));

    // 3. Subscribe to real-time changes for 'doubts'
    pb.collection('doubts').subscribe('*', (e) => {
      if (e.action === 'create') {
        setDoubts((prev) => [e.record, ...prev]);
      } else if (e.action === 'update') {
        setDoubts((prev) => prev.map((item) => (item.id === e.record.id ? e.record : item)));
      } else if (e.action === 'delete') {
        setDoubts((prev) => prev.filter((item) => item.id !== e.record.id));
      }
    }).catch(err => console.error("Doubts subscription failed:", err));

    // Clean up all subscriptions when component unmounts
    return () => {
      pb.collection('nodes').unsubscribe('*');
      pb.collection('doubts').unsubscribe('*');
    };
  }, []); // Runs once on mount to establish permanent subscriptions
  // 7. AUTO-CENTER LOGIC
  useEffect(() => {
    if (view === 'graph' && scrollRef.current) {
      scrollRef.current.scrollLeft = 500; 
    }
  }, [view, currentZone]);

  // 8. RELATIVE POSITIONING LOGIC
  const getRelativeX = (node) => {
    if (!node || node.time === undefined) return -9999;
    const val = Math.abs(parseFloat(node.time)) || 0;
    const era = node.era;
    const z = zoom || 1;
    const zoneScale = ZONES[currentZone].scale;
    const absoluteYear = era === 'BC' ? -val : val;

    if (currentZone === 'Years' && era === 'AD' && val >= 2000) {
      return (val - 2000) * zoneScale * z + 500;
    }
    if (currentZone === 'Decades' && era === 'AD' && val >= 1700 && val <= 2000) {
      return (val - 1700) * zoneScale * z + 500;
    }
    if (currentZone === 'Centuries') {
      if ((era === 'BC' && val <= 5000) || (era === 'AD' && val < 1700)) {
        return (absoluteYear + 5000) * zoneScale * z + 500;
      }
    }
    if (currentZone === 'Millennia' && era === 'BC' && val > 5000 && val <= 30000) {
      return (30000 - val) * zoneScale * z + 500;
    }
    if (currentZone === 'MYA' && era === 'MYA') {
      return (4000 - val) * zoneScale * z + 500;
    }
    if (currentZone === 'GYA' && era === 'GYA') {
      return (13.8 - val) * zoneScale * z + 500;
    }
    return -9999; 
  };

// 7. HANDLERS & FILTERS
  const availableTags = Array.from(new Set(
    nodes.flatMap(node => (node.tags || '').split(' ').filter(t => t.startsWith('#')))
  )).sort();

  const handleCreateNode = async () => {
    if (!user) return; // Auth Guard

    const numericYear = parseFloat(formData.time) || 0; 
    const actualYear = formData.era === 'BC' ? -Math.abs(numericYear) : Math.abs(numericYear);
    
    // Logic for Era End Year
    let actualEndYear = null;
    if (formData.nodeType === 'era' && formData.endTime) {
      const numericEnd = parseFloat(formData.endTime) || 0;
      actualEndYear = formData.era === 'BC' ? -Math.abs(numericEnd) : Math.abs(numericEnd);
    }

    const formattedTags = formData.tags.split(' ')
      .filter(t => t.trim() !== '')
      .map(t => t.startsWith('#') ? t : `#${t}`)
      .join(' ');

    // Prepare data formatted correctly for the PocketBase fields
    const nodeData = { 
      title: formData.title.trim(),
      nodeType: formData.nodeType,
      time: formData.time,
      endTime: formData.nodeType === 'era' ? formData.endTime : '',
      era: formData.era,
      actualYear,
      actualEndYear, 
      tags: formattedTags,
      icon: formData.icon,
      content: formData.content,
      citation: formData.citation,
      videoLink: formData.videoLink,
      image: formData.image,
      userId: user.id // Refactored: PocketBase uses .id instead of .uid
    };

    try {
      if (isEditing && formData.id) {
        // Refactored: PocketBase single-record collection update syntax
        await pb.collection('nodes').update(formData.id, nodeData);
      } else {
        // Refactored: PocketBase record creation syntax
        await pb.collection('nodes').create(nodeData);
      }

      // Reset Form UI
      setShowModal(false);
      setIsEditing(false); 
      setFormData({
        nodeType: 'event', time: '', endTime: '', era: 'AD', tags: '', 
        title: '', content: '', icon: '⭐', citation: '', videoLink: '', image: '' 
      });
    } catch (err) {
      console.error("PocketBase Save Error:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!user || !isAdmin) return; // Only authorized users can delete

    if (window.confirm("Permanent Delete from Cloud?")) {
      try {
        // Refactored: PocketBase collection delete by primary key ID
        await pb.collection('nodes').delete(id);
        setSelectedNode(null); 
      } catch (err) {
        console.error("PocketBase Delete Error:", err);
      }
    }
  };

  // --- NEW: DOUBTS HANDLERS ---
  const handleCreateDoubt = async () => {
    if (!user || !doubtForm.title.trim()) return;

    const newDoubt = {
      title: doubtForm.title.trim(),
      content: doubtForm.content,
      suggestedTime: doubtForm.suggestedTime,
      suggestedEra: doubtForm.suggestedEra,
      authorId: user.id, // Refactored: PocketBase uses .id instead of .uid
      authorName: user.name || user.username || `Explorer_${user.id.substring(0, 5)}`,
      votes: { yes: [], no: [] }, 
      status: 'pending'
    };

    try {
      // Refactored: Target the pocketbase doubts collection directly
      await pb.collection('doubts').create(newDoubt);
      setDoubtForm({ title: '', content: '', suggestedTime: '', suggestedEra: 'AD' });
    } catch (err) {
      console.error("Doubt Creation Error:", err);
    }
  };

  const handleVote = async (doubtId, voteType) => {
    if (!user) return;
    const doubt = doubts.find(d => d.id === doubtId);
    if (!doubt) return;

    // Refactored: Adjust arrays targeting user.id to scrub previous matching votes
    let newYes = [...(doubt.votes?.yes || [])].filter(id => id !== user.id);
    let newNo = [...(doubt.votes?.no || [])].filter(id => id !== user.id);

    if (voteType === 'yes') newYes.push(user.id);
    if (voteType === 'no') newNo.push(user.id);

    try {
      // Refactored: Pass a restructured JSON object field update to PocketBase
      await pb.collection('doubts').update(doubtId, { 
        votes: {
          yes: newYes,
          no: newNo
        }
      });
    } catch (err) {
      console.error("Vote Error:", err);
    }
  };

  const getVerticalOffset = (node, currentNodes) => {
    const sameTimeNodes = currentNodes.filter(n => 
      n.time === node.time && n.era === node.era && !n.endTime
    ).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    const index = sameTimeNodes.findIndex(n => n.id === node.id);
    return index <= 0 ? 0 : (index % 2 === 0 ? (index * 90) : (index * -90));
  };

  const filteredNodes = nodes.filter(node => 
    (node.tags || "").toLowerCase().includes(searchFilter.toLowerCase()) ||
    (node.title || "").toLowerCase().includes(searchFilter.toLowerCase())
  );

  const renderLinkedContent = (content) => {
    if (typeof content !== 'string') return "";
    const parts = content.split(/(\[\[.*?\]\])/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const title = part.slice(2, -2).trim();
        const targetNode = nodes.find(n => n.title.toLowerCase() === title.toLowerCase());
        
        return targetNode ? (
          <span 
            key={index} 
            onClick={() => {
              const nodeTime = parseFloat(targetNode.time) || 0;
              if (getRelativeX(targetNode) === -9999) {
                if (targetNode.era === 'MYA') setCurrentZone('MYA');
                else if (targetNode.era === 'GYA') setCurrentZone('GYA');
                else if (targetNode.era === 'BC' && nodeTime > 5000) setCurrentZone('Millennia');
                else if (targetNode.era === 'BC' || (targetNode.era === 'AD' && nodeTime < 1700)) setCurrentZone('Centuries');
                else if (targetNode.era === 'AD' && nodeTime < 2000) setCurrentZone('Decades');
                else setCurrentZone('Years');
              }
              setSelectedNode(targetNode);
              setFocusedNode(targetNode);
            }}
            style={{ color: '#ffd700', cursor: 'pointer', borderBottom: '1px solid #ffd700', fontWeight: 'bold' }}
          >
            {title}
          </span>
        ) : (
          <span key={index} style={{ color: '#555', fontStyle: 'italic' }}>{title}</span>
        );
      }
      return part;
    });
  };
  // 9. CAUSAL LINE CALCULATIONS
  const causalLines = [];
  filteredNodes.forEach(sourceNode => {
    const x1 = getRelativeX(sourceNode);
    if (x1 === -9999) return; 

    const matches = (sourceNode.content || "").match(/\[\[(.*?)\]\]/g);
    if (matches) {
      matches.forEach(match => {
        const targetTitle = match.slice(2, -2).trim().toLowerCase();
        const targetNode = nodes.find(n => n.title.trim().toLowerCase() === targetTitle);
        
        if (targetNode) {
          const x2 = getRelativeX(targetNode);
          if (x2 === -9999) return; 

          causalLines.push({
            id: `line-${sourceNode.id}-${targetNode.id}`,
            x1,
            y1: 1000 + getVerticalOffset(sourceNode, filteredNodes),
            x2,
            y2: 1000 + getVerticalOffset(targetNode, filteredNodes),
            isActive: (focusedNode?.id === sourceNode.id || focusedNode?.id === targetNode.id) ||
                      (selectedNode?.id === sourceNode.id || selectedNode?.id === targetNode.id)
          });
        }
      });
    }
  });

// --- RENDERING LOGIC ---

  // 1. RENDER GUARD (Loading Screen)
  // This must come FIRST. If we are loading, we stop here and return the loader.
  if (authLoading) {
    return (
      <div style={{ 
        height: '100vh', width: '100vw', backgroundColor: '#050505', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', color: '#ffd700', fontFamily: 'serif', letterSpacing: '4px'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '20px', fontWeight: 'bold' }}>CHRONOS</div>
        <div style={{ fontSize: '10px', opacity: 0.6 }}>SYNCHRONIZING WITH ETERNITY...</div>
        <div style={{ width: '200px', height: '1px', background: '#222', marginTop: '30px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: '50px', height: '100%', background: '#ffd700', animation: 'loading-slide 2s infinite linear' }} />
        </div>
        <style>{`
          @keyframes loading-slide {
            0% { left: -50px; }
            100% { left: 200px; }
          }
        `}</style>
      </div>
    );
  }

  // 2. HOMEPAGE VIEW (Early Return)
  if (view === 'home') {
    return (
      <div style={homeStyles.container}>
        <div style={homeStyles.glow}></div>
        
        <main style={homeStyles.main}>
          <section style={{ marginBottom: '80px' }}>
            <h1 style={homeStyles.title}>
              OMNIGRAPH<br/>
              <span style={{ color: '#ffd700', letterSpacing: '20px', fontWeight: '300', fontSize: '0.8em', display: 'block', marginTop: '10px' }}>CHRONOS</span>
            </h1>
            <p style={homeStyles.subtitle}>
              A non-linear relational map of human and cosmic history. <br/>
              Connect the dots across the dimension of time.
            </p>
            
            <div style={{ ...homeStyles.buttonGroup, flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
              <button onClick={() => setView('graph')} style={homeStyles.primaryBtn}>ENTER THE MAP</button>
              <button onClick={() => setView('doubts')} style={homeStyles.secondaryBtn}>DOUBTS ARCHIVE</button>
              <a href="https://patreon.com" target="_blank" rel="noreferrer" style={{ ...homeStyles.secondaryBtn, textDecoration: 'none' }}>SUPPORT PROJECT</a>
            </div>
          </section>

          <div style={homeStyles.grid}>
            <div style={homeStyles.card}>
              <h3 style={{ fontSize: '11px', color: '#ffd700' }}>RELATIONAL GRAPH</h3>
              <p style={{ fontSize: '11px', color: '#666' }}>Link events using [[node]] syntax to visualize causal chains.</p>
            </div>
            <div style={homeStyles.card}>
              <h3 style={{ fontSize: '11px', color: '#ffd700' }}>DEEP TIME</h3>
              <p style={{ fontSize: '11px', color: '#666' }}>Zoned mapping from modern history to the Big Bang.</p>
            </div>
            <div onClick={() => setView('doubts')} style={{ ...homeStyles.card, cursor: 'pointer' }}>
              <h3 style={{ fontSize: '11px', color: '#ffd700' }}>CONTRIBUTE</h3>
              <p style={{ fontSize: '11px', color: '#666' }}>Propose missing nodes and vote on accuracy.</p>
            </div>
          </div>
        </main>

        <footer style={homeStyles.footer}>
          <button style={homeStyles.loginBtn} onClick={() => setView('user')}>
             {user ? `PROFILE: ${(user.id || user.uid || '').substring(0, 8)}` : 'GUEST ACCESS'}
          </button>
          <span style={{ opacity: 0.4, fontSize: '9px' }}>v1.0.8 — MAPPING THE INFINITE</span>
        </footer>
      </div>
    );
  }

  // 3. MAIN APP RETURN (Graph, Doubts, and User views)
  return (
    <div style={{ 
      backgroundColor: '#050505', 
      color: 'white', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      fontFamily: 'sans-serif', 
      overflow: 'hidden', 
      position: 'relative' 
    }}>
      
      {/* 11. TOP NAVIGATION BAR: ALWAYS VISIBLE */}
      <div style={{ 
        position: 'fixed', 
        top: '25px', 
        left: '25px', 
        zIndex: 4500, 
        display: 'flex', 
        gap: '15px', 
        alignItems: 'center' 
      }}>
        <button 
          onClick={() => setView('home')} 
          style={{
            background: '#111', border: '1px solid #333', color: '#ffd700', 
            padding: '8px 18px', borderRadius: '20px', fontSize: '10px', 
            fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer'
          }}
        >HOME</button>

        <button 
          onClick={() => setView('doubts')} 
          style={{
            background: view === 'doubts' ? '#ffd700' : '#111', 
            border: '1px solid #333', 
            color: view === 'doubts' ? 'black' : '#ffd700', 
            padding: '8px 18px', borderRadius: '20px', fontSize: '10px', 
            fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer'
          }}
        >DOUBTS</button>

        {/* ZONE SWITCHER */}
        <div style={{ display: 'flex', background: '#111', borderRadius: '25px', padding: '4px', border: '1px solid #333' }}>
          {Object.keys(ZONES).map(zoneKey => (
            <button
              key={zoneKey}
              onClick={() => {
                setCurrentZone(zoneKey);
                setFocusedNode(null);
                setSelectedNode(null);
                if (view !== 'graph') setView('graph');
              }}
              style={{
                background: currentZone === zoneKey ? '#ffd700' : 'transparent',
                color: currentZone === zoneKey ? 'black' : '#666',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '9px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: '0.2s'
              }}
            >
              {zoneKey.toUpperCase()}
            </button>
          ))}
        </div>

        {/* SEARCH & TAG SUGGESTIONS */}
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search title or #tag..." 
            value={searchFilter}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={searchStyle}
          />
          {showSuggestions && searchFilter.length > 0 && availableTags.some(t => t.toLowerCase().includes(searchFilter.toLowerCase())) && (
            <div style={dropdownStyle}>
              <div style={{ padding: '8px 12px', fontSize: '10px', color: '#444', borderBottom: '1px solid #222' }}>MATCHING TAGS</div>
              {availableTags
                .filter(tag => tag.toLowerCase().includes(searchFilter.toLowerCase()))
                .map(tag => (
                  <div 
                    key={tag} 
                    onClick={() => { 
                      setSearchFilter(tag); 
                      setShowSuggestions(false); 
                    }} 
                    style={{ padding: '10px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #111' }}
                  >
                    {tag}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* 13. THE DOUBTS ARCHIVE VIEW */}
      {view === 'doubts' && (
        <div style={{ 
          flex: 1, 
          backgroundColor: '#050505', 
          minHeight: '100vh', 
          padding: '120px 20px 60px', 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ maxWidth: '750px', width: '100%' }}>
            <h1 style={{ fontFamily: 'serif', fontSize: '48px', color: '#ffd700', marginBottom: '10px', textAlign: 'center', letterSpacing: '2px' }}>
              THE ARCHIVE OF DOUBTS
            </h1>
            <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', marginBottom: '50px', letterSpacing: '1px', lineHeight: '1.6' }}>
              Propose missing events, challenge established timelines, or suggest causal links.<br/>
              The collective consensus of explorers shapes the master graph.
            </p>

            {/* Submission Form */}
            <div style={{ background: '#111', padding: '35px', borderRadius: '12px', border: '1px solid #222', marginBottom: '60px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              <h3 style={{ marginTop: 0, fontSize: '12px', color: '#ffd700', letterSpacing: '3px', marginBottom: '25px' }}>NEW PROPOSAL</h3>
              
              <input 
                type="text" 
                placeholder="Title of the event or era..." 
                value={doubtForm.title}
                onChange={(e) => setDoubtForm({...doubtForm, title: e.target.value})}
                style={inputStyle} 
              />
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <input 
                  type="number" 
                  placeholder="Year (e.g., 1453)" 
                  value={doubtForm.suggestedTime}
                  onChange={(e) => setDoubtForm({...doubtForm, suggestedTime: e.target.value})}
                  style={{ ...inputStyle, flex: 2 }} 
                />
                <select 
                  value={doubtForm.suggestedEra}
                  onChange={(e) => setDoubtForm({...doubtForm, suggestedEra: e.target.value})}
                  style={{ ...eraSelectStyle, flex: 1, height: '48px', marginBottom: '15px' }}
                >
                  <option value="AD">AD</option>
                  <option value="BC">BC</option>
                  <option value="MYA">MYA</option>
                  <option value="GYA">GYA</option>
                </select>
              </div>

              <textarea 
                placeholder="Explain the significance, provide sources, or describe the required causal link..." 
                value={doubtForm.content}
                onChange={(e) => setDoubtForm({...doubtForm, content: e.target.value})}
                style={{ ...inputStyle, height: '120px', resize: 'none', lineHeight: '1.6' }} 
              />

              <button 
                onClick={handleCreateDoubt}
                style={{ ...saveBtnStyle, opacity: doubtForm.title.trim() ? 1 : 0.5, cursor: doubtForm.title.trim() ? 'pointer' : 'not-allowed' }}
                disabled={!doubtForm.title.trim()}
              >
                SUBMIT TO THE ARCHIVE
              </button>
            </div>

            {/* Proposals List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {doubts.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)).map(doubt => {
                const yesVotes = doubt.votes?.yes?.length || 0;
                const noVotes = doubt.votes?.no?.length || 0;
                const hasVotedYes = doubt.votes?.yes?.includes(user?.uid);
                const hasVotedNo = doubt.votes?.no?.includes(user?.uid);

                return (
                  <div key={doubt.id} style={{ background: '#0a0a0a', border: '1px solid #222', padding: '30px', borderRadius: '8px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '20px', fontFamily: 'serif' }}>{doubt.title}</span>
                      <span style={{ color: '#444', fontSize: '10px', background: '#111', padding: '4px 8px', borderRadius: '4px' }}>
                        BY: {doubt.authorName}
                      </span>
                    </div>
                    
                    <div style={{ color: '#aaa', fontSize: '11px', marginBottom: '15px', fontWeight: 'bold', letterSpacing: '1px' }}>
                      SUGGESTED: {doubt.suggestedTime} {doubt.suggestedEra}
                    </div>

                    <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.7', margin: '0 0 25px 0', whiteSpace: 'pre-wrap' }}>
                      {doubt.content}
                    </p>

                    <div style={{ display: 'flex', gap: '15px', borderTop: '1px solid #1a1a1a', paddingTop: '20px' }}>
                      <button 
                        onClick={() => handleVote(doubt.id, 'yes')}
                        style={{ 
                          background: hasVotedYes ? 'rgba(0, 255, 0, 0.1)' : '#111', 
                          border: `1px solid ${hasVotedYes ? '#00ff00' : '#333'}`, 
                          color: hasVotedYes ? '#00ff00' : '#666', 
                          padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                          flex: 1, transition: '0.2s'
                        }}
                      >
                        VERIFY ({yesVotes})
                      </button>
                      <button 
                        onClick={() => handleVote(doubt.id, 'no')}
                        style={{ 
                          background: hasVotedNo ? 'rgba(255, 0, 0, 0.1)' : '#111', 
                          border: `1px solid ${hasVotedNo ? '#ff4444' : '#333'}`, 
                          color: hasVotedNo ? '#ff4444' : '#666', 
                          padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                          flex: 1, transition: '0.2s'
                        }}
                      >
                        DISPUTE ({noVotes})
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {doubts.length === 0 && (
                <div style={{ textAlign: 'center', color: '#444', padding: '60px', border: '2px dashed #1a1a1a', borderRadius: '12px' }}>
                  The archive is currently silent. No Doubts have been raised yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
{/* 4. USER PROFILE VIEW */}
      {view === 'user' && (
        <div style={{ 
          flex: 1, 
          backgroundColor: '#050505', 
          padding: '120px 20px 60px', 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 4000 
        }}>
          <div style={{ maxWidth: '700px', width: '100%' }}>
            {/* Profile Header */}
            <div style={{ background: '#111', padding: '40px', borderRadius: '12px', border: '1px solid #222', textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ fontSize: '40px', marginBottom: '20px' }}>👤</div>
              <h2 style={{ color: '#ffd700', fontFamily: 'serif', marginBottom: '5px' }}>CHRONICLE EXPLORER</h2>
              <code style={{ color: '#666', fontSize: '11px' }}>ID: {user?.uid}</code>
              
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>{nodes.filter(n => n.userId === user?.uid).length}</div>
                  <div style={{ color: '#444', fontSize: '9px', letterSpacing: '1px' }}>NODES CREATED</div>
                </div>
                <div style={{ width: '1px', background: '#222' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>{doubts.filter(d => d.authorId === user?.uid).length}</div>
                  <div style={{ color: '#444', fontSize: '9px', letterSpacing: '1px' }}>DOUBTS RAISED</div>
                </div>
              </div>
              
              <button 
                onClick={() => signOut(auth).then(() => setView('home'))}
                style={{ background: 'none', border: '1px solid #ff4444', color: '#ff4444', padding: '8px 20px', borderRadius: '20px', fontSize: '10px', marginTop: '30px', cursor: 'pointer' }}
              >
                DISCONNECT FROM ETERNITY
              </button>
            </div>

            {/* My Contributions Tabs */}
            <h3 style={{ fontSize: '12px', color: '#444', letterSpacing: '2px', marginBottom: '20px' }}>MY RECENT CONTRIBUTIONS</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {nodes.filter(n => n.userId === user?.uid).slice(0, 5).map(node => (
                <div key={node.id} style={{ background: '#0a0a0a', border: '1px solid #222', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#ffd700', fontSize: '14px', fontWeight: 'bold' }}>{node.title}</span>
                    <div style={{ color: '#444', fontSize: '10px' }}>{node.time} {node.era}</div>
                  </div>
                  <button onClick={() => { setSelectedNode(node); setView('graph'); }} style={{ background: 'none', border: 'none', color: '#ffd700', fontSize: '10px', cursor: 'pointer' }}>VIEW ON MAP →</button>
                </div>
              ))}
              
              {nodes.filter(n => n.userId === user?.uid).length === 0 && (
                <div style={{ color: '#333', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No nodes created yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .node-glow-circle { 
          width: 44px; height: 44px; border-radius: 50%; background: #0a0a0a; border: 1px solid #ffd700; 
          display: flex; align-items: center; justify-content: center; font-size: 18px; 
          transition: all 0.3s;
        }
        .node-glow-circle:hover { background: #ffd700; color: black; transform: scale(1.1); }
      `}</style>

      {/* 5. THE TIMELINE VIEWPORT (Graph Display Container) */}
      <div 
        ref={scrollRef} 
        onClick={() => { 
          setFocusedNode(null); 
          setSelectedNode(null); 
        }} 
        style={{ 
          flex: 1, 
          overflowX: 'auto', 
          overflowY: 'auto', 
          height: '100vh', 
          position: 'relative',
          transition: 'all 0.5s ease',
          filter: selectedNode ? 'brightness(0.2) blur(8px)' : 'none', 
          scrollBehavior: 'smooth',
          backgroundColor: '#050505',
          display: view === 'graph' ? 'block' : 'none'
        }}
      >
        <div style={{ 
          position: 'relative', 
          width: '10000px', 
          height: '5000px', 
          background: 'radial-gradient(circle at 500px 1000px, #0a0a0a 0%, #050505 100%)' 
        }}> 
          
          {/* Current Zone Indicator */}
          <div style={{ 
            position: 'absolute', top: '120px', left: '500px', 
            color: '#ffd700', fontSize: '10px', letterSpacing: '4px', 
            fontWeight: 'bold', opacity: 0.6, pointerEvents: 'none' 
          }}>
            {ZONES[currentZone].label.toUpperCase()}
          </div>

    {/* 1. Present Day Marker (Context-Aware) */}
    {(currentZone === 'Years' || currentZone === 'Decades') && (
      <div style={{ 
        position: 'absolute', 
        left: `${getRelativeX({ time: new Date().getFullYear(), era: 'AD' })}px`, 
        top: 0, 
        bottom: 0, 
        width: '2px', 
        background: 'linear-gradient(to bottom, transparent, #4facfe, transparent)', 
        opacity: 0.8,
        zIndex: 20 
      }}>
        <div style={{ position: 'absolute', top: '150px', left: '15px', color: '#4facfe', fontSize: '9px', letterSpacing: '2px', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
          PRESENT DAY
        </div>
      </div>
    )}
    
    {/* 2. Main Horizontal Spine */}
    <div style={{ position: 'absolute', top: '1000px', left: 0, right: 0, height: '1px', background: 'rgba(255,215,0,0.15)', zIndex: 10 }}></div>

    {/* 3. Causal Web Overlay (SVG Quadratic Curves) */}
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }}>
      {causalLines.map(line => {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const dr = Math.sqrt(dx * dx + dy * dy);
        
        // Arc height based on distance
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2 - (dr * 0.15);

        return (
          <path
            key={line.id}
            d={`M ${line.x1} ${line.y1} Q ${midX} ${midY} ${line.x2} ${line.y2}`}
            fill="transparent"
            stroke={line.isActive ? "#ffd700" : "#222"}
            strokeWidth={line.isActive ? 2 : 0.8}
            strokeDasharray={line.isActive ? "none" : "4,6"}
            opacity={focusedNode || selectedNode ? (line.isActive ? 1 : 0.05) : 0.2}
            style={{ transition: 'all 0.4s ease', strokeLinecap: 'round' }}
          />
        );
      })}
    </svg>

    {/* 4. Node Rendering Logic */}
    {filteredNodes.map(node => {
      const xPos = getRelativeX(node);
      if (xPos === -9999) return null;

      // Era Logic: Point vs Span
      const isEra = node.endTime && node.endTime !== '' && parseFloat(node.endTime) !== parseFloat(node.time);
      let eraWidth = 0;
      if (isEra) {
        const xEnd = getRelativeX({ ...node, time: node.endTime });
        eraWidth = Math.abs(xEnd - xPos);
      }

      const vOffset = getVerticalOffset(node, filteredNodes);
      const activeFocus = focusedNode || selectedNode;
      
      // Causality Highlighting: Is this node linked to the focused one?
      const isRelated = activeFocus ? 
        (node.content || "").toLowerCase().includes(`[[${activeFocus.title.toLowerCase()}]]`) || 
        (activeFocus.content || "").toLowerCase().includes(`[[${node.title.toLowerCase()}]]`) ||
        node.id === activeFocus.id
        : true;

      const isSelected = selectedNode?.id === node.id;
      const isFocused = focusedNode?.id === node.id;

      return (
        <div 
          key={node.id} 
          onClick={(e) => {
            e.stopPropagation(); 
            if (isFocused) {
              setSelectedNode(node); 
            } else {
              setFocusedNode(node); 
              setSelectedNode(null); 
            }
          }}
          style={{ 
            position: 'absolute', 
            left: `${xPos}px`, 
            top: isEra ? '970px' : `calc(1000px + ${vOffset}px)`, 
            transform: isEra 
              ? `translateY(-50%)` 
              : `translate(-50%, -50%) scale(${(isSelected || isFocused) ? 1.2 : zoom})`, 
            cursor: 'pointer', 
            zIndex: isSelected ? 4100 : (isFocused ? 101 : (isEra ? 50 : 100)),
            opacity: activeFocus && !isRelated ? 0.1 : 1,
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
          
          {isEra ? (
            /* ERA SPAN BAR */
            <div style={{
              width: `${Math.max(eraWidth, 20)}px`,
              height: '6px',
              background: (isSelected || isFocused) ? '#ffd700' : 'rgba(255, 215, 0, 0.2)',
              border: (isSelected || isFocused) ? '1px solid #fff' : '1px solid rgba(255, 215, 0, 0.4)',
              boxShadow: (isSelected || isFocused) ? '0 0 20px #ffd700' : 'none',
              borderRadius: '3px',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ 
                position: 'absolute', top: '-22px', left: '0', 
                color: '#ffd700', fontSize: '9px', fontWeight: 'bold', 
                letterSpacing: '1px', whiteSpace: 'nowrap', textShadow: '0 0 5px black' 
              }}>
                {node.title.toUpperCase()}
              </div>
            </div>
          ) : (
            /* STANDARD EVENT NODE */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="node-glow-circle" style={{
                  borderColor: (isSelected || isFocused) ? '#fff' : '#ffd700',
                  boxShadow: (isSelected || isFocused) ? '0 0 40px #ffd700' : 'none',
                  background: (isSelected || isFocused) ? '#ffd700' : '#0a0a0a',
                  color: (isSelected || isFocused) ? '#000' : 'inherit',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid',
                  fontSize: '18px',
                  transition: 'all 0.3s ease'
              }}>
                {node.icon}
              </div>

              <div style={{ 
                color: '#ffd700', marginTop: '12px', fontSize: '10px', 
                fontWeight: 'bold', textAlign: 'center', textShadow: '0 0 10px black',
                whiteSpace: 'nowrap'
              }}>
                {node.title}
                <div style={{ opacity: 0.7, fontSize: '8px', marginTop: '2px' }}>
                  {Math.abs(parseFloat(node.time)).toLocaleString()} {node.era}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    })}
          </div>
        </div>

      {/* 4. INFO PANEL (Slides in from the right) */}
      {selectedNode && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          style={{ 
            width: '45%', 
            backgroundColor: '#080808', 
            height: '100vh', 
            borderLeft: '1px solid #222', 
            display: 'flex', 
            flexDirection: 'column', 
            zIndex: 4500, 
            position: 'absolute', 
            right: 0, 
            top: 0, 
            boxShadow: '-10px 0 30px rgba(0,0,0,0.8)',
            animation: 'slideIn 0.4s ease-out'
          }}
        >
          {/* Panel Header */}
          <div style={{ height: '70px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'flex-start' }}>
            <button 
              onClick={() => {
                setSelectedNode(null);
                setFocusedNode(null); 
              }} 
              style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '8px 15px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px' }}
            >
              ✕ CLOSE
            </button>
          </div>

          {/* Main Content Area */}
          <div style={{ padding: '60px 40px', flex: 1, overflowY: 'auto' }}>
            
            {/* Image Display Block */}
            {selectedNode.image && (
              <div style={{ 
                width: '100%', 
                marginBottom: '30px', 
                borderRadius: '8px', 
                overflow: 'hidden', 
                border: '1px solid #333',
                backgroundColor: '#000'
              }}>
                <img 
                  src={selectedNode.image} 
                  alt={selectedNode.title} 
                  style={{ width: '100%', height: 'auto', display: 'block' }} 
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}

            <h2 style={{ fontSize: '38px', marginBottom: '15px', fontFamily: 'serif', color: 'white', lineHeight: '1.2' }}>
              {selectedNode.title}
            </h2>
            
            <div style={{ 
              color: '#ffd700', 
              fontSize: '12px', 
              marginBottom: '30px', 
              display: 'flex', 
              gap: '15px',
              fontFamily: 'sans-serif',
              letterSpacing: '1px'
            }}>
              <span style={{ fontWeight: 'bold' }}>
                {selectedNode.time ? Math.abs(parseFloat(selectedNode.time)).toLocaleString() : '0'} {selectedNode.era}
              </span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span style={{ opacity: 0.6 }}>{selectedNode.tags}</span>
            </div>

            <div style={{ color: '#bbb', fontSize: '16px', lineHeight: '1.9', textAlign: 'justify', marginBottom: '40px' }}>
              {renderLinkedContent(selectedNode.content)}
            </div>
                  
            {/* External Links */}
            {selectedNode.videoLink && (
              <a 
                href={selectedNode.videoLink} 
                target="_blank" 
                rel="noreferrer" 
                style={{
                  display: 'inline-block',
                  padding: '12px 25px',
                  backgroundColor: '#ffd700',
                  color: 'black',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  marginBottom: '20px'
                }}
              >
                ▶ WATCH MEDIA
              </a>
            )}
            
            {/* Citation Box */}
            {selectedNode.citation && (
              <div style={{ padding: '20px', background: '#111', borderRadius: '4px', borderLeft: '3px solid #ffd700' }}>
                <h4 style={{ fontSize: '10px', color: '#ffd700', margin: '0 0 8px 0', letterSpacing: '2px' }}>SOURCE & VERIFICATION</h4>
                <p style={{ margin: 0, fontStyle: 'italic', color: '#888', fontSize: '12px', lineHeight: '1.5' }}>{selectedNode.citation}</p>
              </div>
            )}
          </div>

          {/* Administrative Action Bar (Visible only if isAdmin or Owner) */}
          {(isAdmin || user?.uid === selectedNode.userId) && (
            <div style={{ padding: '30px 40px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: '15px', background: '#0a0a0a' }}>
              <button 
                onClick={() => {
                  setFormData(selectedNode); 
                  setIsEditing(true);         
                  setShowModal(true);
                  setFocusedNode(null); 
                }} 
                style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #333', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
              >
                EDIT RECORD
              </button>
              <button 
                onClick={() => handleDelete(selectedNode.id)} 
                style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
              >
                DELETE
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. ADMIN FLOATING ACTION BUTTON */}
      {isAdmin && (
        <button   
          onClick={() => {
            setIsEditing(false); 
            setFormData({
              nodeType: 'event', time: '', era: 'AD', tags: '', title: '', content: '', icon: '⭐', citation: '', videoLink: '', image: ''
            }); 
            setFocusedNode(null); 
            setSelectedNode(null);
            setShowModal(true);
          }} 
          style={{ 
            position: 'fixed', bottom: 40, right: 40, width: 60, height: 60, 
            borderRadius: '50%', fontSize: '30px', backgroundColor: '#ffd700', 
            cursor: 'pointer', zIndex: 3000, border: 'none', fontWeight: 'bold',
            color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
        > 
          + 
        </button> 
      )}

      {/* 6. CREATION / EDIT MODAL */}
      {showModal && ( 
        <div 
          onClick={() => setShowModal(false)} 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 7000 }}
        > 
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ backgroundColor: '#111', padding: '40px', borderRadius: '16px', width: '480px', border: '1px solid #333', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          > 
            <h2 style={{ marginTop: 0, fontFamily: 'serif', color: 'white', fontSize: '28px', marginBottom: '10px' }}>
              {isEditing ? 'UPDATE CHRONICLE' : 'NEW CHRONICLE ENTRY'}
            </h2> 

            {/* NODE TYPE TOGGLE */}
            <div style={{ display: 'flex', background: '#000', borderRadius: '8px', padding: '4px', marginBottom: '25px', border: '1px solid #222' }}>
              <button 
                onClick={() => setFormData({...formData, nodeType: 'event'})}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer',
                  background: formData.nodeType === 'event' ? '#ffd700' : 'transparent',
                  color: formData.nodeType === 'event' ? 'black' : '#666',
                  transition: '0.3s'
                }}
              >SINGLE EVENT</button>
              <button 
                onClick={() => setFormData({...formData, nodeType: 'era'})}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer',
                  background: formData.nodeType === 'era' ? '#ffd700' : 'transparent',
                  color: formData.nodeType === 'era' ? 'black' : '#666',
                  transition: '0.3s'
                }}
              >HISTORICAL ERA</button>
            </div>
              
            <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
              <input 
                type="number" 
                step="any" 
                placeholder={formData.nodeType === 'era' ? "Start Year" : "Year"}  
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}  
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }} 
              /> 

              {formData.nodeType === 'era' && (
                <input 
                  type="number" 
                  step="any" 
                  placeholder="End Year"  
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}  
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }} 
                />
              )}
              
              <select 
                value={formData.era} 
                onChange={(e) => setFormData({...formData, era: e.target.value})} 
                style={{ ...eraSelectStyle, padding: '0 10px', height: '45px', minWidth: '80px' }}
              >
                <optgroup label="Human History" style={{ background: '#111', color: '#fff' }}>
                  <option value="AD">AD</option>
                  <option value="BC">BC</option>
                </optgroup>
                <optgroup label="Deep Time" style={{ background: '#111', color: '#fff' }}>
                  <option value="MYA">MYA</option>
                  <option value="GYA">GYA</option>
                </optgroup>
              </select>
            </div>

            <input 
              type="text" 
              placeholder="Entry Title" 
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})} 
              style={inputStyle} 
            /> 

            <textarea 
              placeholder="Describe the causal event or period..." 
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})} 
              style={{ ...inputStyle, height: '120px', resize: 'none', lineHeight: '1.5' }} 
            />

            <input 
              type="text" 
              placeholder="Tags (e.g. #Rome #Physics)"   
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})} 
              style={inputStyle} 
            /> 

            <input 
              type="text" 
              placeholder="Source/Citation URL" 
              value={formData.citation}
              onChange={(e) => setFormData({...formData, citation: e.target.value})} 
              style={inputStyle} 
            />

            <input 
              type="text" 
              placeholder="External Media (YouTube/Video)" 
              value={formData.videoLink}
              onChange={(e) => setFormData({...formData, videoLink: e.target.value})} 
              style={inputStyle} 
            />

            <input 
              type="text" 
              placeholder="Feature Image URL (.jpg/png)" 
              value={formData.image}
              onChange={(e) => setFormData({...formData, image: e.target.value})} 
              style={inputStyle} 
            />

            <div style={{ marginBottom: '10px', fontSize: '11px', color: '#666', letterSpacing: '1px' }}>SELECT CATEGORY ICON</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}> 
              {['⭐', '🏺', '⚔️', '🔬', '🎨'].map(icon => (
                <button 
                  key={icon} 
                  type="button"
                  onClick={() => setFormData({...formData, icon})} 
                  style={{ 
                    flex: 1, padding: '12px', 
                    background: formData.icon === icon ? '#ffd700' : '#222', 
                    color: formData.icon === icon ? 'black' : 'white',
                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '18px', transition: 'all 0.2s'
                  }}
                >
                  {icon}
                </button>
              ))}
            </div> 

            <button 
              onClick={() => {
                handleCreateNode();
                const val = parseFloat(formData.time) || 0;
                // Auto-jump to appropriate zone on save
                if (formData.era === 'MYA') setCurrentZone('MYA');
                else if (formData.era === 'GYA') setCurrentZone('GYA');
                else if (formData.era === 'BC' && val > 5000) setCurrentZone('Millennia');
                else if (formData.era === 'BC' || (formData.era === 'AD' && val < 1700)) setCurrentZone('Centuries');
                else if (formData.era === 'AD' && val < 2000) setCurrentZone('Decades');
                else setCurrentZone('Years');
              }} 
              style={saveBtnStyle}
            > 
              {isEditing ? 'SAVE CHANGES' : 'COMMIT TO ETERNITY'} 
            </button> 
            
            <button 
              onClick={() => setShowModal(false)} 
              style={{ width: '100%', background: 'none', border: 'none', color: '#444', marginTop: '20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px' }}
            >
              CANCEL AND EXIT
            </button>
          </div> 
        </div> 
      )}

{/* 7. DYNAMIC CSS STYLES */}
      <style>{`
        /* Nodes & Interactions */
        .node-glow-circle { 
          width: 44px; height: 44px; border-radius: 50%; 
          background: #0a0a0a; border: 1px solid #ffd700; 
          display: flex; align-items: center; justify-content: center; 
          font-size: 18px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          user-select: none;
          pointer-events: auto;
        }
        
        .node-glow-circle:hover { 
          background: #ffd700 !important; 
          color: black !important; 
          box-shadow: 0 0 25px rgba(255, 215, 0, 0.6); 
          transform: scale(1.1);
        }

        /* Suggestions Dropdown */
        .suggestion-item { padding: 12px 15px; cursor: pointer; font-size: 11px; color: #888; transition: all 0.2s; }
        .suggestion-item:hover { background: #ffd700; color: #000; font-weight: bold; }

        /* Panel & Buttons */
        .close-panel-btn:hover { color: white; text-shadow: 0 0 10px #ffd700; }
        
        .action-btn { 
          background: transparent; border: 1px solid #ffd700; color: #ffd700; 
          padding: 12px 25px; cursor: pointer; letter-spacing: 2px; 
          font-size: 10px; border-radius: 4px; font-weight: bold; 
          transition: all 0.2s ease; 
        }
        .action-btn:hover { background: #ffd700; color: black; }

        /* Animations */
        @keyframes slideIn { 
          from { transform: translateX(100%); opacity: 0; } 
          to { transform: translateX(0); opacity: 1; } 
        }

        /* Improved Scrollbar (Gold Accent) */
        ::-webkit-scrollbar { height: 6px; width: 6px; background: #000; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; border: 1px solid #111; }
        ::-webkit-scrollbar-thumb:hover { background: #ffd700; }

        /* Arched Path Transition */
        path {
          transition: d 0.4s ease, stroke-dashoffset 0.5s ease, opacity 0.4s ease, stroke 0.4s ease;
        }
      `}</style>
    </div>
  );
}

// --- STYLING CONSTANTS ---
const homeStyles = {
  container: { backgroundColor: '#050505', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', overflow: 'hidden', position: 'relative' },
  glow: { position: 'absolute', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(255,215,0,0.05) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' },
  main: { zIndex: 10, textAlign: 'center', maxWidth: '1000px', padding: '0 20px' },
  title: { fontSize: '64px', letterSpacing: '15px', fontWeight: '300', margin: '0 0 20px 0', lineHeight: '1.1' },
  subtitle: { fontSize: '14px', color: '#888', letterSpacing: '3px', maxWidth: '600px', margin: '0 auto 40px auto', fontFamily: 'sans-serif', lineHeight: '1.6' },
  buttonGroup: { display: 'flex', gap: '20px', justifyContent: 'center' },
  primaryBtn: { padding: '15px 40px', backgroundColor: '#ffd700', color: 'black', border: 'none', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer', transition: '0.3s' },
  secondaryBtn: { padding: '15px 40px', background: 'transparent', color: '#ffd700', border: '1px solid #ffd700', textDecoration: 'none', fontWeight: 'bold', letterSpacing: '2px', transition: '0.3s' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', marginTop: '50px' },
  card: { padding: '20px', border: '1px solid #1a1a1a', textAlign: 'left', background: 'rgba(255,255,255,0.02)' },
  footer: { position: 'absolute', bottom: '40px', width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 60px', fontSize: '10px', color: '#444' },
  loginBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer' }
};

const searchStyle = { background: '#111', border: '1px solid #333', color: 'white', padding: '10px 20px', borderRadius: '25px', fontSize: '11px', width: '220px', outline: 'none' };
const dropdownStyle = { position: 'absolute', top: '110%', left: 0, width: '220px', background: '#0a0a0a', border: '1px solid #333', maxHeight: '200px', overflowY: 'auto', zIndex: 5000 };
const inputStyle = { width: '100%', marginBottom: '15px', padding: '12px', background: '#000', border: '1px solid #333', color: 'white', borderRadius: '4px', outline: 'none', fontSize: '14px' };
const eraSelectStyle = { background: '#ffd700', color: 'black', border: 'none', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', height: '45px' };
const saveBtnStyle = { width: '100%', padding: '15px', backgroundColor: '#ffd700', color: 'black', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', letterSpacing: '1px' };
const videoBtnStyle = { display: 'block', textAlign: 'center', background: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '12px 20px', borderRadius: '5px', fontSize: '11px', textDecoration: 'none', letterSpacing: '1px', fontWeight: 'bold' };
const citationBoxStyle = { borderLeft: '2px solid #ffd700', paddingLeft: '20px', marginTop: '40px' };
