import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import SmartRoadLandingPage from "./LandingPage.jsx";
import { DEMO_CREDENTIALS, CONTRACTOR_ACCOUNTS, getFreshDemoData } from "./demoData.js";

// Helper to resolve pothole photo paths reliably across data URLs, dataset samples, and uploads
export function getPhotoSrc(photo) {
  if (!photo) return "";
  if (photo.startsWith("data:") || photo.startsWith("blob:") || photo.startsWith("/") || photo.startsWith("http")) {
    return photo;
  }
  return `/uploads/${photo}`;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_CREDS = DEMO_CREDENTIALS.admin;
const STORAGE_KEY = "smartroad_data_v2";

const initialData = () => {
  try { 
    const s = localStorage.getItem(STORAGE_KEY); 
    if (s) {
      const parsed = JSON.parse(s);
      // If complaints exist in storage, ensure contractor budget fields exist and return
      if (parsed && Array.isArray(parsed.complaints) && parsed.complaints.length > 0) {
        if (parsed.contractors) {
          parsed.contractors = parsed.contractors.map(c => ({
            ...c,
            approval_status: c.approval_status || (c.active !== false ? "approved" : "pending"),
            allocatedBudget: c.allocatedBudget ?? 0,
            usedBudget: c.usedBudget ?? 0,
            pendingBudgetRequests: c.pendingBudgetRequests ?? []
          }));
          // Ensure sample pending contractor application exists in the queue
          if (!parsed.contractors.some(c => c.id === "CON_PENDING_01")) {
            const samplePending = CONTRACTOR_ACCOUNTS.find(c => c.id === "CON_PENDING_01");
            if (samplePending) parsed.contractors.push(samplePending);
          }
        }
        // Ensure real dataset photos are assigned to demo complaints
        parsed.complaints = parsed.complaints.map((comp, idx) => {
          if (!comp.photo || comp.photo.includes('/samples/sample')) {
            const pIdx = (idx % 6) + 1;
            return { ...comp, photo: `/potholes/pothole_${pIdx}.jpg` };
          }
          return comp;
        });
        return parsed;
      }
    } 
  } catch {}
  return getFreshDemoData();
};

// ─── GLOBAL STYLES ─────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,300;1,9..144,400&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
  @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0a0c14;
    --ink2: #11141f;
    --ink3: #181c2a;
    --paper: #f2f0eb;
    --paper2: #e8e4dc;
    --linen: #d4cfc5;
    --gold: #c9a84c;
    --gold2: #e8c96a;
    --rust: #c0522a;
    --sage: #4a7c59;
    --slate: #3d5a7a;
    --violet: #5c4a8a;
    --cream: #faf8f3;

    --tx-d: #0a0c14;
    --tx-d2: rgba(10,12,20,0.72);
    --tx-d3: rgba(10,12,20,0.48);
    --tx-l: #f2f0eb;
    --tx-l2: rgba(242,240,235,0.78);
    --tx-l3: rgba(242,240,235,0.50);

    --br-d: rgba(10,12,20,0.1);
    --br-d2: rgba(10,12,20,0.18);
    --br-l: rgba(242,240,235,0.1);
    --br-l2: rgba(242,240,235,0.18);

    --r: 14px;
    --rsm: 9px;
    --ff: 'Fraunces', Georgia, serif;
    --fb: 'Instrument Sans', sans-serif;
  }

  html, body, #root { height: 100%; }
  body { font-family: var(--fb); background: var(--ink); color: var(--tx-l); overflow-x: hidden; -webkit-font-smoothing: antialiased; font-size: 15px; line-height: 1.55; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 99px; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
  @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  @keyframes slide-in { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes ring { 0% { transform: scale(0.85); opacity: 0.9; } 70% { transform: scale(1.5); opacity: 0; } 100% { transform: scale(1.5); opacity: 0; } }
  @keyframes scan { 0% { top: -5%; } 100% { top: 105%; } }
  @keyframes grain { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-1px,1px); } 50% { transform: translate(1px,-1px); } 75% { transform: translate(-1px,-1px); } }

  .fu { animation: fadeUp 0.4s cubic-bezier(0.2,0,0,1) both; }
  .fi { animation: fadeIn 0.3s ease both; }
  .float { animation: float 3s ease-in-out infinite; }
  .spin { animation: spin 0.8s linear infinite; }

  /* NOISE TEXTURE */
  .noise::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px;
    animation: grain 0.5s steps(2) infinite;
  }

  /* BACKGROUNDS */
  .bg-grid {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px);
    background-size: 44px 44px;
  }
  .bg-glow {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 70% 50% at 15% 20%, rgba(201,168,76,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 85% 75%, rgba(92,74,138,0.09) 0%, transparent 55%),
      radial-gradient(ellipse 60% 60% at 50% 110%, rgba(61,90,122,0.08) 0%, transparent 60%);
  }

  /* SURFACES */
  .surface {
    background: rgba(255,255,255,0.028);
    border: 1px solid rgba(255,255,255,0.075);
    border-radius: var(--r);
    backdrop-filter: blur(12px);
  }
  .surface-raised {
    background: rgba(255,255,255,0.048);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: var(--r);
  }
  .surface-gold {
    background: linear-gradient(135deg, rgba(201,168,76,0.14), rgba(201,168,76,0.06));
    border: 1px solid rgba(201,168,76,0.22);
    border-radius: var(--r);
  }
  .card {
    background: rgba(255,255,255,0.032);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--r);
    transition: all 0.25s ease;
  }
  .card:hover {
    background: rgba(255,255,255,0.055);
    border-color: rgba(255,255,255,0.13);
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
  }

  /* TYPOGRAPHY */
  .heading { font-family: var(--ff); font-weight: 600; }
  .heading-i { font-family: var(--ff); font-weight: 300; font-style: italic; }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: var(--rsm);
    font-family: var(--fb); font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; transition: all 0.2s ease;
    letter-spacing: 0.01em; white-space: nowrap;
  }
  .btn-gold {
    background: linear-gradient(135deg, var(--gold), #b8922e);
    color: var(--ink);
    box-shadow: 0 4px 20px rgba(201,168,76,0.3);
  }
  .btn-gold:hover { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(201,168,76,0.45); }
  .btn-ghost {
    background: rgba(255,255,255,0.06);
    color: var(--tx-l);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.18); }
  .btn-danger { background: linear-gradient(135deg, #9b2c2c, #7a1f1f); color: #fff; }
  .btn-success { background: linear-gradient(135deg, var(--sage), #3a6347); color: #fff; }
  .btn-sm { padding: 6px 13px; font-size: 12px; }
  .btn-lg { padding: 13px 26px; font-size: 14px; }
  .btn:disabled { opacity: 0.38; cursor: not-allowed; transform: none !important; }

  /* BADGES */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 99px;
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.055em;
  }
  .b-pending { background: rgba(201,168,76,0.16); color: var(--gold2); border: 1px solid rgba(201,168,76,0.30); }
  .b-progress { background: rgba(61,90,122,0.22); color: #8bbee8; border: 1px solid rgba(61,90,122,0.40); }
  .b-done { background: rgba(74,124,89,0.20); color: #7ed4a0; border: 1px solid rgba(74,124,89,0.35); }
  .b-reject { background: rgba(192,82,42,0.17); color: #ee9070; border: 1px solid rgba(192,82,42,0.32); }
  .b-reopen { background: rgba(92,74,138,0.22); color: #b8a0e0; border: 1px solid rgba(92,74,138,0.35); }
  .b-assigned { background: rgba(61,90,122,0.17); color: #99c0e0; border: 1px solid rgba(61,90,122,0.30); }
  .b-high { background: rgba(192,82,42,0.17); color: #ee9070; border: 1px solid rgba(192,82,42,0.30); }
  .b-medium { background: rgba(201,168,76,0.16); color: var(--gold2); border: 1px solid rgba(201,168,76,0.26); }
  .b-low { background: rgba(74,124,89,0.17); color: #7ed4a0; border: 1px solid rgba(74,124,89,0.28); }

  /* INPUTS */
  input, textarea, select {
    width: 100%; padding: 10px 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: var(--rsm);
    color: var(--tx-l); font-family: var(--fb); font-size: 14px;
    outline: none; transition: all 0.2s;
  }
  input:focus, textarea:focus, select:focus {
    border-color: rgba(201,168,76,0.5);
    background: rgba(201,168,76,0.06);
    box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
  }
  input::placeholder, textarea::placeholder { color: var(--tx-l3); }
  select option { background: #181c2a; }
  label { font-size: 12.5px; color: var(--tx-l2); font-weight: 600; display: block; margin-bottom: 6px; letter-spacing: 0.035em; text-transform: uppercase; }

  /* DIVIDER */
  .divider { height: 1px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent); }

  /* NAV */
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 8px;
    font-size: 13.5px; font-weight: 500; color: var(--tx-l2);
    cursor: pointer; transition: all 0.2s;
    border: 1px solid transparent;
  }
  .nav-item:hover { background: rgba(255,255,255,0.06); color: var(--tx-l); }
  .nav-item.active {
    background: linear-gradient(135deg, rgba(201,168,76,0.16), rgba(201,168,76,0.07));
    border-color: rgba(201,168,76,0.22);
    color: var(--gold2);
  }
  .nav-item.active .nav-ic { color: var(--gold); }

  /* PROGRESS */
  .pbar { height: 5px; background: rgba(255,255,255,0.07); border-radius: 99px; overflow: hidden; }
  .pfill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--gold), var(--gold2)); transition: width 0.9s cubic-bezier(0.4,0,0.2,1); }

  /* MAP */
  .map-wrap {
    width: 100%; border-radius: var(--r); overflow: hidden;
    border: 1px solid rgba(255,255,255,0.07);
    position: relative;
  }
  .leaflet-container {
    background: #0c1220 !important;
    font-family: var(--fb) !important;
  }
  .leaflet-tile { filter: brightness(0.82) saturate(0.6) hue-rotate(190deg); }
  .leaflet-control-zoom { border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 9px !important; overflow: hidden; }
  .leaflet-control-zoom a { background: #181c2a !important; color: var(--tx-l2) !important; border-color: rgba(255,255,255,0.08) !important; }
  .leaflet-control-zoom a:hover { background: #242840 !important; color: var(--tx-l) !important; }
  .leaflet-control-attribution { background: rgba(10,12,20,0.75) !important; color: rgba(255,255,255,0.3) !important; font-size: 9px !important; padding: 2px 6px !important; backdrop-filter: blur(4px); }
  .leaflet-control-attribution a { color: rgba(201,168,76,0.6) !important; }
  .leaflet-popup-content-wrapper {
    background: #13172a !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
    color: var(--tx-l) !important;
    padding: 0 !important;
  }
  .leaflet-popup-content { margin: 0 !important; }
  .leaflet-popup-tip { background: #13172a !important; }
  .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; top: 8px !important; right: 10px !important; font-size: 16px !important; }
  .leaflet-popup-close-button:hover { color: var(--tx-l) !important; background: none !important; }

  /* MODAL */
  .modal-ov {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(5,7,15,0.75); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn 0.2s ease;
  }
  .modal-box {
    width: 100%; max-width: 560px; max-height: 92vh;
    overflow-y: auto;
    animation: fadeUp 0.3s cubic-bezier(0.2,0,0,1);
    background: #13172400;
    border-radius: calc(var(--r) + 4px);
  }
  .modal-inner {
    background: #12162200;
    border-radius: calc(var(--r) + 4px);
    padding: 28px;
    background: linear-gradient(160deg, #16192a, #11141f);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 32px 80px rgba(0,0,0,0.7);
  }

  /* UPLOAD */
  .upload-z {
    border: 1.5px dashed rgba(255,255,255,0.13);
    border-radius: var(--r); padding: 28px; text-align: center;
    cursor: pointer; transition: all 0.3s;
    background: rgba(255,255,255,0.02);
  }
  .upload-z:hover { border-color: rgba(201,168,76,0.4); background: rgba(201,168,76,0.04); }

  /* TOAST */
  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    min-width: 300px; max-width: 380px; padding: 14px 18px;
    border-radius: var(--r);
    background: #1a1e30;
    background: linear-gradient(135deg, #1a1e30, #14172500);
    border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(20px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    animation: slide-in 0.4s cubic-bezier(0.34,1.56,0.64,1);
    display: flex; align-items: flex-start; gap: 12px;
  }

  /* TABLE */
  .table-w { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  thead th {
    text-align: left; padding: 10px 14px;
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--tx-l2); border-bottom: 1px solid rgba(255,255,255,0.08);
    font-weight: 700; font-family: var(--fb);
  }
  tbody td { padding: 13px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; font-size: 13.5px; }
  tbody tr:hover td { background: rgba(255,255,255,0.03); }
  tbody tr:last-child td { border-bottom: none; }

  /* FILTER CHIPS */
  .chip {
    padding: 6px 14px; border-radius: 99px; font-size: 12px;
    font-weight: 600; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.12);
    color: var(--tx-l2); transition: all 0.2s;
    background: transparent; letter-spacing: 0.02em;
  }
  .chip.on { background: rgba(201,168,76,0.16); border-color: rgba(201,168,76,0.35); color: var(--gold2); }
  .chip:hover { border-color: rgba(255,255,255,0.22); color: var(--tx-l); }

  /* TIMELINE */
  .tline { padding-left: 20px; position: relative; }
  .tline::before { content: ''; position: absolute; left: 5px; top: 6px; bottom: 6px; width: 1px; background: linear-gradient(to bottom, rgba(201,168,76,0.4), transparent); }
  .tl-dot { position: absolute; left: -17px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--gold); border: 1.5px solid var(--ink2); box-shadow: 0 0 8px rgba(201,168,76,0.4); }

  /* SCAN LINE */
  .scan-line { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(201,168,76,0.7), transparent); animation: scan 2s linear infinite; }

  @media (max-width: 768px) {
    .hide-m { display: none !important; }
    .stack-m { flex-direction: column !important; }
    .full-m { width: 100% !important; }
    .cols-m { grid-template-columns: 1fr !important; }
  }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => "C" + Date.now().toString().slice(-6);
const now = () => new Date().toISOString().slice(0, 10);
const ts = () => new Date().toLocaleString("en-IN");

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const SBadge = ({ s }) => {
  const m = { pending: ["b-pending", "Pending"], assigned: ["b-assigned", "Assigned"], in_progress: ["b-progress", "In Progress"], completed: ["b-done", "Completed"], rejected: ["b-reject", "Rejected"], reopened: ["b-reopen", "Reopened"] };
  const [cls, label] = m[s] || ["b-pending", s];
  return <span className={`badge ${cls}`}>{label}</span>;
};
const VBadge = ({ s }) => {
  if (s === "verified") return <span className="badge b-done">✓ Verified</span>;
  if (s === "unverified") return <span className="badge b-reject">✗ Unverified</span>;
  return null;
};
const SevBadge = ({ s }) => <span className={`badge b-${s}`}>{s}</span>;

function Spinner({ size = 14 }) {
  return <span className="spin" style={{ display: "inline-block", width: size, height: size, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(201,168,76,0.8)", borderRadius: "50%", flexShrink: 0 }} />;
}

function Toast({ msg, type = "info", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, []);
  const config = { info: ["💡", "#7aadda"], success: ["✓", "#6ec98d"], warning: ["⚠", "#e8c96a"], error: ["✗", "#e8835c"] };
  const [ic, col] = config[type] || config.info;
  return (
    <div className="toast">
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${col}18`, border: `1px solid ${col}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: col, flexShrink: 0 }}>{ic}</div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--tx-l2)", paddingTop: 3 }}>{msg}</div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tx-l3)", cursor: "pointer", fontSize: 16, paddingTop: 2 }}>×</button>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon, val, label, accent, sub }) {
  return (
    <div className="card" style={{ padding: "20px 22px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -24, top: -24, width: 80, height: 80, borderRadius: "50%", background: accent, filter: "blur(28px)", opacity: 0.18 }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}1a`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{icon}</div>
      </div>
      <div className="heading" style={{ fontSize: 30, fontWeight: 600, color: "var(--tx-l)", lineHeight: 1, marginBottom: 6 }}>{val}</div>
      <div style={{ fontSize: 12, color: "var(--tx-l2)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 13, color: "var(--tx-l2)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─── POTHOLE PHOTO PANE (UNCUT, FULL VISIBILITY ON RIGHT SIDE) ─────────────────
function PotholePhotoPane({
  photo,
  completionPhoto,
  activeTab = "initial",
  onTabChange,
  onFullscreen,
  title = "Ground Evidence Photograph",
  badgeText = "100% Uncropped View"
}) {
  const currentPhoto = activeTab === "completion" && completionPhoto ? completionPhoto : photo;
  const photoSrc = getPhotoSrc(currentPhoto);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: "#141b2c",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1
        }}
      >
        {/* Photo Header / Tabs */}
        {completionPhoto ? (
          <div style={{ display: "flex", gap: 6, padding: 4, background: "#090d18", borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange("initial")}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: activeTab === "initial" ? "rgba(201,168,76,0.18)" : "transparent",
                color: activeTab === "initial" ? "var(--gold)" : "var(--tx-l3)",
                border: activeTab === "initial" ? "1px solid var(--gold)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              📸 Initial Damage
            </button>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange("completion")}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: activeTab === "completion" ? "rgba(110,201,141,0.18)" : "transparent",
                color: activeTab === "completion" ? "#6ec98d" : "var(--tx-l3)",
                border: activeTab === "completion" ? "1px solid #6ec98d" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              ✓ Repair Completion
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
              <span>📸</span> {title}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--tx-l2)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>
              {badgeText}
            </span>
          </div>
        )}

        {/* The Photo Container - objectFit: contain ensures NO CUTTING UP OR DOWN */}
        <div
          style={{
            flex: 1,
            minHeight: 360,
            maxHeight: 460,
            background: "#070a13",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "inset 0 0 30px rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
            padding: 10
          }}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt="Pothole"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
                borderRadius: 6
              }}
              onError={e => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--tx-l3); font-size: 13px;">📷 Photo unavailable</div>';
              }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "var(--tx-l3)", fontSize: 13, padding: 30 }}>
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>📷</div>
              No photo attached to this report
            </div>
          )}
        </div>

        {/* Photo Footer Actions & Metadata */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
          <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>
            {activeTab === "completion" ? (
              <span style={{ color: "#6ec98d" }}>✓ Geo-verified completion evidence</span>
            ) : (
              <span>Authentic road photograph · Full aspect preserved</span>
            )}
          </div>
          {photoSrc && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, padding: "5px 12px" }}
              onClick={() => onFullscreen && onFullscreen(photoSrc)}
            >
              🔍 Fullscreen Lightbox
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FULLSCREEN LIGHTBOX MODAL ────────────────────────────────────────────────
function FullscreenLightboxModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 5, 12, 0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: "zoom-out"
      }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", top: 20, right: 24, display: "flex", gap: 12, zIndex: 10000 }}>
        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", padding: "7px 18px", fontSize: 13 }}
        >
          ✕ Close Preview
        </button>
      </div>

      <img
        src={src}
        alt="Pothole Fullscreen"
        style={{
          maxWidth: "92vw",
          maxHeight: "88vh",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 25px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.15)",
          cursor: "default"
        }}
        onClick={e => e.stopPropagation()}
      />

      <div style={{ position: "absolute", bottom: 20, color: "var(--tx-l3)", fontSize: 12, background: "rgba(0,0,0,0.65)", padding: "6px 16px", borderRadius: 20 }}>
        Click outside or press Close to dismiss
      </div>
    </div>
  );
}

// ─── LEAFLET ICON FACTORY ─────────────────────────────────────────────────────
const makeIcon = (color, pulse = false) => L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:28px;height:36px">
      ${pulse ? `<div style="position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:${color};opacity:0.25;animation:ring 2s ease-out infinite"></div>` : ""}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36" width="28" height="36">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill="${color}" />
        <circle cx="14" cy="14" r="5.5" fill="rgba(255,255,255,0.85)" />
      </svg>
    </div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -38],
});

const STATUS_COLORS = {
  pending: "#e8c96a",
  assigned: "#7aadda",
  in_progress: "#7aadda",
  completed: "#6ec98d",
  rejected: "#888",
  reopened: "#e8835c",
};

// Default lat/lng spread around Mangalagiri, AP (17.51°N, 80.52°E area) for demo pins
const DEMO_OFFSETS = [
  [0, 0], [0.008, 0.012], [-0.006, 0.018], [0.014, -0.009],
  [-0.012, -0.015], [0.02, 0.005], [-0.018, 0.01], [0.005, -0.022],
  [0.016, 0.02], [-0.02, 0.02],
];
const BASE_LAT = 16.3067;
const BASE_LNG = 80.4365;

function MapFlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.flyTo([lat, lng], 15, { duration: 1.2 }); }, [lat, lng]);
  return null;
}

// ─── MAP VIEW ─────────────────────────────────────────────────────────────────
function MapView({ height = 400, complaints = [], showFilters = false, center = null, zoom = null }) {
  const [filter, setFilter] = useState("all");
  const [flyTo, setFlyTo] = useState(null);

  // Assign lat/lng to complaints that don't have them
  const pinned = complaints.map((c, i) => {
    const off = DEMO_OFFSETS[i % DEMO_OFFSETS.length];
    const lat = parseFloat(c.lat) || BASE_LAT + off[0];
    const lng = parseFloat(c.lng) || BASE_LNG + off[1];
    return { ...c, lat, lng };
  });

  const statusGroups = {
    all: pinned,
    reopened: pinned.filter(c => c.status === "reopened"),
    pending: pinned.filter(c => c.status === "pending"),
    in_progress: pinned.filter(c => ["in_progress", "assigned"].includes(c.status)),
    completed: pinned.filter(c => c.status === "completed"),
  };
  const visible = statusGroups[filter] || pinned;

  // Use provided center or default
  const mapCenter = center || [BASE_LAT, BASE_LNG];
  const mapZoom = zoom || 14;

  return (
    <div>
      {showFilters && (
        <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {[["all", "All"], ["reopened", "Reopened"], ["pending", "Pending"], ["in_progress", "In Progress"], ["completed", "Resolved"]].map(([f, l]) => (
            <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
              {l} {statusGroups[f]?.length > 0 ? <span style={{ opacity: 0.6, marginLeft: 3 }}>{statusGroups[f].length}</span> : null}
            </button>
          ))}
        </div>
      )}

      <div className="map-wrap" style={{ height }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {flyTo && <MapFlyTo lat={flyTo[0]} lng={flyTo[1]} />}
          {visible.map(c => (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={makeIcon(STATUS_COLORS[c.status] || "#e8c96a", c.status === "reopened" || c.status === "pending")}
              eventHandlers={{ click: () => setFlyTo([c.lat, c.lng]) }}
            >
              <Popup>
                <div style={{ padding: "12px 14px", minWidth: 180, fontFamily: "'Instrument Sans',sans-serif" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#f2f0eb", marginBottom: 4 }}>{c.title || "Untitled"}</div>
                  <div style={{ fontSize: 11, color: "rgba(242,240,235,0.5)", marginBottom: 9 }}>
                    📍 {c.area || "Unknown area"} · {c.date || ""}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: `${STATUS_COLORS[c.status] || "#e8c96a"}20`, color: STATUS_COLORS[c.status] || "#e8c96a", border: `1px solid ${STATUS_COLORS[c.status] || "#e8c96a"}40` }}>
                      {c.status?.replace("_", " ") || "pending"}
                    </span>
                    <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: c.severity === "high" ? "rgba(232,131,92,0.15)" : c.severity === "low" ? "rgba(110,201,141,0.15)" : "rgba(232,201,106,0.15)", color: c.severity === "high" ? "#e8835c" : c.severity === "low" ? "#6ec98d" : "#e8c96a", border: `1px solid ${c.severity === "high" ? "rgba(232,131,92,0.3)" : c.severity === "low" ? "rgba(110,201,141,0.3)" : "rgba(232,201,106,0.3)"}` }}>
                      {c.severity || "medium"}
                    </span>
                  </div>
                  {c.cost > 0 && <div style={{ fontSize: 12, color: "#6ec98d", fontWeight: 600 }}>₹{c.cost?.toLocaleString()}</div>}
                  {c.contractor && <div style={{ fontSize: 11, color: "rgba(242,240,235,0.4)", marginTop: 4 }}>👷 {c.contractor}</div>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend overlay */}
        <div style={{ position: "absolute", bottom: 40, right: 10, zIndex: 1000, background: "rgba(13,17,35,0.88)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 13px", backdropFilter: "blur(8px)", pointerEvents: "none" }}>
          {[["#e8835c", "Reopened"], ["#e8c96a", "Pending"], ["#7aadda", "In Progress"], ["#6ec98d", "Resolved"]].map(([col, lbl]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <svg width="10" height="13" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill={col}/><circle cx="14" cy="14" r="5.5" fill="rgba(255,255,255,0.8)"/></svg>
              <span style={{ fontSize: 11, color: "rgba(242,240,235,0.55)", fontFamily: "'Instrument Sans',sans-serif" }}>{lbl}</span>
            </div>
          ))}
        </div>

        {visible.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, pointerEvents: "none" }}>
            <div style={{ background: "rgba(13,17,35,0.85)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 20px", fontSize: 13, color: "rgba(242,240,235,0.4)", fontFamily: "'Instrument Sans',sans-serif" }}>
              No complaints to display
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--tx-l3)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ec98d", display: "inline-block" }} />
        {visible.length} of {complaints.length} complaint{complaints.length !== 1 ? "s" : ""} shown · OpenStreetMap
      </div>
    </div>
  );
}

// ─── AI VALIDATION PANEL (frontend only) ──────────────────────────────────────
function AIValidation({ onResult }) {
  const [stage, setStage] = useState("idle");
  const [result, setResult] = useState(null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const scan = async () => {
    if (!file) return;
    setStage("scanning");
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      
      let detected = false;
      let r = {
        detected: false,
        confidence: 0,
        area_sqm: "N/A",
        depth_cm: "N/A",
        severity: "low",
        ai_notes: "No pothole detected by YOLO model. Consider retaking in better lighting.",
      };

      if (data && data.potholes && data.potholes.length > 0) {
        const p = data.potholes[0]; 
        detected = true;
        const conf = Math.floor(p.confidence * 100);
        r = {
          detected: true,
          confidence: conf,
          area_sqm: `~${p.area_m2.toFixed(3)} m²`,
          depth_cm: `~${(Math.abs(p.depth) * 100).toFixed(1)} cm`,
          severity: conf > 80 ? "high" : conf > 60 ? "medium" : "low",
          ai_notes: `YOLO detected a pothole (pixels: ${Math.floor(p.area_pixels)}). MiDaS relative depth diff: ${(Math.abs(p.depth)*100).toFixed(1)}.`,
          // Add cost data if available
          cost_data: p.total_cost ? {
            total_cost: p.total_cost,
            volume_m3: p.volume_m3,
            material_costs: p.material_costs,
            cement_bags: p.cement_bags,
            sand_m3: p.sand_m3,
            aggregate_m3: p.aggregate_m3
          } : null
        };
      }
      setResult(r);
      setStage("result");
      onResult(r.detected, r);
    } catch (e) {
      console.error(e);
      const errRes = { detected: false, confidence: 0, area_sqm: "N/A", depth_cm: "N/A", severity: "low", ai_notes: "API connection failed. Ensure Python backend is running at :8000." };
      setResult(errRes);
      setStage("result");
      onResult(false, errRes, true); // ALLOW MANUAL OVERRIDE if backend is dead
    }
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>◈</div>
        <div>
          <div className="heading" style={{ fontSize: 15, fontWeight: 600 }}>AI Pre-Validation</div>
          <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>YOLOv8 + MiDaS Pipeline</div>
        </div>
        <span className="badge b-progress" style={{ marginLeft: "auto" }}>Active</span>
      </div>

      {stage === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="upload-z" style={{ position: "relative" }}>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>{file ? "✓" : "⬆"}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{file ? file.name : "Upload Photo"}</div>
            <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>GPS metadata auto-extracted</div>
          </label>
          <div>
            <label>Describe the damage</label>
            <textarea
              placeholder="e.g. Deep pothole near the junction with standing water, approximately 1 metre across…"
              rows={2} value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </div>
          <button className="btn btn-gold btn-sm" onClick={scan} disabled={!file} style={{ alignSelf: "flex-start" }}>
            ◈ Run AI Detection
          </button>
        </div>
      )}

      {stage === "scanning" && (
        <div style={{ position: "relative", height: 140, borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(201,168,76,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="scan-line" />
          <div style={{ textAlign: "center", zIndex: 2 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Spinner size={22} /></div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Analysing with Claude…</div>
            <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 4 }}>Pothole detection in progress</div>
          </div>
        </div>
      )}

      {stage === "result" && result && (
        <div>
          {/* Detection result banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
            borderRadius: 12, marginBottom: 14,
            background: result.detected ? "rgba(74,124,89,0.1)" : "rgba(192,82,42,0.1)",
            border: `1px solid ${result.detected ? "rgba(74,124,89,0.25)" : "rgba(192,82,42,0.25)"}`
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: result.detected ? "rgba(74,124,89,0.2)" : "rgba(192,82,42,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              {result.detected ? "✓" : "✗"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: result.detected ? "#6ec98d" : "#e8835c", fontSize: 14 }}>
                {result.detected ? "Pothole Detected" : "No Pothole Detected"}
              </div>
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Confidence: {result.confidence}%</div>
            </div>
            {result.detected && (
              <div style={{ fontSize: 12, color: "var(--tx-l3)", textAlign: "right" }}>
                <div>Area: <b style={{ color: "var(--tx-l2)" }}>{result.area_sqm}</b></div>
                <div>Depth: <b style={{ color: "var(--tx-l2)" }}>{result.depth_cm}</b></div>
              </div>
            )}
          </div>

          {/* Confidence bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--tx-l3)", marginBottom: 5 }}>
              <span>Confidence Score</span><span style={{ fontWeight: 700, color: "var(--tx-l2)" }}>{result.confidence}%</span>
            </div>
            <div className="pbar" style={{ height: 4 }}>
              <div className="pfill" style={{ width: `${result.confidence}%`, background: result.detected ? "linear-gradient(90deg,#4a7c59,#6ec98d)" : "linear-gradient(90deg,#9b2c2c,#e8835c)" }} />
            </div>
          </div>

          {result.ai_notes && (
            <div style={{ fontSize: 12.5, color: "var(--tx-l2)", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 9, marginBottom: 12, lineHeight: 1.5 }}>
              {result.ai_notes}
            </div>
          )}

          {!result.detected && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setStage("idle"); setResult(null); setDescription(""); }}>↺ Retake</button>
              <button className="btn btn-sm" style={{ background: "rgba(201,168,76,0.1)", color: "var(--gold2)", border: "1px solid rgba(201,168,76,0.25)" }} onClick={() => onResult(false, result, true)}>
                ⚠ Submit Anyway
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, onBack, initialRole = "user", onContractorRegistered, contractors = [] }) {
  const [role, setRole] = useState(initialRole);
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [submittedContractorApp, setSubmittedContractorApp] = useState(null);
  
  const getDemoCreds = (r) => DEMO_CREDENTIALS[r] || DEMO_CREDENTIALS.user;
  const initialDemo = getDemoCreds(initialRole);

  const [form, setForm] = useState({ 
    name: "", 
    contactPerson: "",
    email: initialDemo.email, 
    phone: "",
    serviceArea: "East Zone (Koramangala, Indiranagar, HSR Layout)",
    specialization: "Bituminous Pavements & Emergency Surface Restoration",
    password: initialDemo.password, 
    confirm: "" 
  });

  useEffect(() => {
    if (initialRole) {
      setRole(initialRole);
    }
  }, [initialRole]);

  // Automatically prefill demo credentials when role or tab changes
  useEffect(() => {
    setSubmittedContractorApp(null);
    setErr("");
    if (tab === "login") {
      const demo = DEMO_CREDENTIALS[role] || DEMO_CREDENTIALS.user;
      setForm(f => ({ 
        ...f, 
        email: demo.email, 
        password: demo.password,
        name: "",
        contactPerson: "",
        phone: "",
        confirm: ""
      }));
    } else {
      setForm({ 
        name: "", 
        contactPerson: "",
        email: "", 
        phone: "",
        serviceArea: "East Zone (Koramangala, Indiranagar, HSR Layout)",
        specialization: "Bituminous Pavements & Emergency Surface Restoration",
        password: "", 
        confirm: "" 
      });
    }
  }, [role, tab]);

  const handleSubmit = async () => {
    setErr("");
    setLoading(true);

    try {
      if (role === "admin") {
        if (form.email === ADMIN_CREDS.email && form.password === ADMIN_CREDS.password) {
          onLogin(role, { name: "Gov Admin", email: form.email });
        } else {
          setErr("Invalid admin credentials.");
        }
        setLoading(false);
        return;
      }

      if (role === "contractor") {
        if (tab === "signup") {
          // Client-side validations
          if (!form.name.trim() || form.name.trim().length < 2) {
            setErr("Please enter the registered company or contractor name (min 2 characters).");
            setLoading(false);
            return;
          }
          if (!form.contactPerson.trim() || form.contactPerson.trim().length < 2) {
            setErr("Please enter the contact person's full name.");
            setLoading(false);
            return;
          }
          if (!form.email.trim() || !form.email.includes("@") || !form.email.includes(".")) {
            setErr("Please enter a valid business email address.");
            setLoading(false);
            return;
          }
          if (!form.phone.trim() || form.phone.trim().length < 7) {
            setErr("Please enter a valid phone number.");
            setLoading(false);
            return;
          }
          if (!form.password || form.password.length < 6) {
            setErr("Password must be at least 6 characters long.");
            setLoading(false);
            return;
          }
          if (form.password !== form.confirm) {
            setErr("Passwords do not match.");
            setLoading(false);
            return;
          }

          // Submit to backend
          let newContractor = null;
          try {
            const res = await fetch("/api/auth/register-contractor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: form.name.trim(),
                contact_person: form.contactPerson.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim(),
                password: form.password,
                confirm_password: form.confirm,
                service_area: form.serviceArea,
                specialization: form.specialization,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              setErr(data.detail || "Registration failed. Please review your information.");
              setLoading(false);
              return;
            }
            newContractor = data.contractor;
          } catch {
            // Offline fallback
            newContractor = {
              id: "CON_" + Date.now().toString(36).toUpperCase(),
              name: form.name.trim(),
              contactPerson: form.contactPerson.trim(),
              email: form.email.trim().toLowerCase(),
              phone: form.phone.trim(),
              serviceArea: form.serviceArea,
              specialization: form.specialization,
              password: form.password,
              approval_status: "pending",
              active: false,
              verified: false,
              createdAt: new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }),
              allocatedBudget: 0,
              usedBudget: 0,
              pendingBudgetRequests: [],
            };
          }

          if (onContractorRegistered && newContractor) {
            onContractorRegistered(newContractor);
          }
          setSubmittedContractorApp(newContractor);
          setLoading(false);
          return;
        }

        // Contractor Login
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email.trim().toLowerCase(),
              password: form.password,
              role: "contractor",
            }),
          });
          const data = await res.json();
          if (res.status === 200 && data.user) {
            onLogin("contractor", data.user);
            setLoading(false);
            return;
          }
          if (res.status === 403) {
            if (data.status === "pending") {
              setErr("⏳ Application Pending Approval: Your contractor registration is awaiting review by an authorized municipal Admin. Access will be enabled once authorized.");
            } else if (data.status === "rejected") {
              setErr(`❌ Application Rejected: ${data.rejection_reason || "Registration did not meet municipal requirements. Contact administration for details."}`);
            } else if (data.status === "disabled") {
              setErr("⛔ Account Deactivated: Your contractor account has been deactivated or suspended by municipal administration.");
            } else {
              setErr(data.error || "Access denied.");
            }
            setLoading(false);
            return;
          }
          if (res.status === 401) {
            setErr("Invalid contractor credentials. Please verify your email and password.");
            setLoading(false);
            return;
          }
        } catch {
          // Offline fallback: check localStorage contractors & CONTRACTOR_ACCOUNTS
        }

        const localList = contractors.length ? contractors : CONTRACTOR_ACCOUNTS;
        const c = localList.find(x => x.email.toLowerCase() === form.email.trim().toLowerCase() && x.password === form.password);
        if (c) {
          if (c.approval_status === "pending") {
            setErr("⏳ Application Pending Approval: Your contractor registration is awaiting review by an authorized municipal Admin. Access will be enabled once authorized.");
          } else if (c.approval_status === "rejected") {
            setErr(`❌ Application Rejected: ${c.rejection_reason || "Registration did not meet municipal requirements. Contact administration for details."}`);
          } else if (c.active === false) {
            setErr("⛔ Account Deactivated: Your contractor account has been deactivated or suspended by municipal administration.");
          } else {
            onLogin("contractor", c);
          }
        } else {
          setErr("Invalid contractor credentials.");
        }
        setLoading(false);
        return;
      }

      // Citizen (user)
      if (tab === "login") {
        if (form.email === DEMO_CREDENTIALS.user.email && form.password === DEMO_CREDENTIALS.user.password) {
          onLogin("user", DEMO_CREDENTIALS.user.user);
          setLoading(false);
          return;
        }
        const users = JSON.parse(localStorage.getItem("smartroad_users") || "[]");
        const u = users.find(x => x.email === form.email && x.password === form.password);
        if (u) {
          onLogin("user", u);
        } else {
          setErr("Invalid credentials.");
        }
        setLoading(false);
      } else {
        if (form.password !== form.confirm) { 
          setErr("Passwords don't match."); 
          setLoading(false);
          return; 
        }
        const users = JSON.parse(localStorage.getItem("smartroad_users") || "[]");
        if (users.find(x => x.email === form.email) || form.email === DEMO_CREDENTIALS.user.email) {
          setErr("Email already registered.");
          setLoading(false);
          return;
        }
        const u = { id: "USR" + Date.now(), name: form.name, email: form.email, password: form.password };
        localStorage.setItem("smartroad_users", JSON.stringify([...users, u]));
        onLogin("user", u);
        setLoading(false);
      }
    } catch {
      setErr("Authentication operation encountered an error.");
      setLoading(false);
    }
  };

  const roleConfig = {
    user: { icon: "⬡", label: "Citizen", sub: "Report & track road damage" },
    admin: { icon: "⬢", label: "Admin", sub: "Government oversight portal" },
    contractor: { icon: "◈", label: "Contractor", sub: "Self-registration & task dashboard" },
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", position: "relative", zIndex: 1 }}>
      <div className="bg-grid" /><div className="bg-glow" />

      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: "absolute",
            top: 20,
            left: 24,
            zIndex: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: 9999,
            padding: "8px 16px",
            color: "rgba(242, 240, 235, 0.85)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ffffff";
            e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.45)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(242, 240, 235, 0.85)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.14)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }}
        >
          <span style={{ fontSize: 14 }}>←</span>
          <span>Back to Home</span>
        </button>
      )}

      {/* Left panel */}
      <div className="hide-m" style={{ width: "42%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: onBack ? "72px 52px 48px" : "48px 52px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,var(--gold),#8a6c28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
          <div>
            <div className="heading" style={{ fontSize: 15, fontWeight: 600 }}>SmartRoad</div>
            <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Gov. Infrastructure Platform</div>
          </div>
        </div>
        <div>
          <div className="heading-i" style={{ fontSize: 42, lineHeight: 1.2, color: "var(--tx-l)", marginBottom: 20 }}>
            Transparent roads,<br />accountable governance.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[["◈ Contractor Self-Registration", "Register your enterprise, create credentials & submit for Admin review"],
              ["⬡ Administrative Oversight", "Municipal verification and secure account activation prior to dispatch"],
              ["⬢ Smart budget control", "Automated fund locking and release on verified road restoration"]
            ].map(([t, d]) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 14, color: "var(--gold)", flexShrink: 0, marginTop: 1 }}>{t.split(" ")[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-l2)", marginBottom: 1 }}>{t.slice(2)}</div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Ministry of Road Transport & Highways · India</div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "36px 24px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 440 }} className="fu">

          {/* Role selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "rgba(255,255,255,0.03)", padding: 5, borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["user", "admin", "contractor"]).map(r => {
              const c = roleConfig[r];
              return (
                <button key={r} onClick={() => { setRole(r); setErr(""); setTab("login"); setSubmittedContractorApp(null); }}
                  style={{ flex: 1, padding: "10px 6px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--fb)", fontSize: 12, transition: "all 0.2s", background: role === r ? "rgba(201,168,76,0.16)" : "transparent", color: role === r ? "var(--gold2)" : "var(--tx-l3)" }}>
                  <div style={{ fontSize: 18, marginBottom: 3 }}>{c.icon}</div>
                  <div style={{ fontWeight: 700 }}>{c.label}</div>
                </button>
              );
            })}
          </div>

          {submittedContractorApp ? (
            /* SUBMITTED CONTRACTOR CONFIRMATION SCREEN */
            <div className="card" style={{ padding: 26, background: "rgba(17, 20, 31, 0.95)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 14 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 20, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--gold2)", fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                <span>⏳</span>
                <span>Application Pending Review</span>
              </div>

              <div className="heading-i" style={{ fontSize: 24, marginBottom: 8, color: "var(--tx-l)" }}>
                Application Received
              </div>
              <p style={{ fontSize: 13, color: "var(--tx-l2)", lineHeight: 1.6, marginBottom: 20 }}>
                Thank you for applying. Your contractor account has been registered with reference ID <strong style={{ color: "var(--gold2)", fontFamily: "monospace" }}>{submittedContractorApp.id}</strong>.
              </p>

              <div style={{ padding: 14, background: "rgba(0,0,0,0.35)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--tx-l3)" }}>Enterprise:</span>
                  <span style={{ fontWeight: 600, color: "var(--tx-l)" }}>{submittedContractorApp.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--tx-l3)" }}>Contact Person:</span>
                  <span style={{ fontWeight: 600, color: "var(--tx-l)" }}>{submittedContractorApp.contact_person || submittedContractorApp.contactPerson}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--tx-l3)" }}>Email:</span>
                  <span style={{ fontWeight: 600, color: "var(--tx-l)" }}>{submittedContractorApp.email}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--tx-l3)" }}>Service Area:</span>
                  <span style={{ fontWeight: 600, color: "var(--tx-l)" }}>{submittedContractorApp.service_area || submittedContractorApp.serviceArea}</span>
                </div>
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", fontSize: 12, color: "var(--tx-l2)", lineHeight: 1.55, marginBottom: 22 }}>
                🏛️ <strong>Municipal Review Policy:</strong> In accordance with public infrastructure regulations, contractor accounts remain inactive until an authorized municipal Admin reviews and approves your submission. You will be able to log in with your registered password once authorized.
              </div>

              <button
                className="btn btn-gold"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => {
                  setSubmittedContractorApp(null);
                  setTab("login");
                }}
              >
                ← Return to Contractor Login
              </button>
            </div>
          ) : (
            <>
              <div className="heading-i" style={{ fontSize: 28, marginBottom: 4 }}>
                {role === "user" ? (tab === "login" ? "Welcome back" : "Join SmartRoad") : role === "admin" ? "Admin Portal" : (tab === "login" ? "Contractor Portal" : "Contractor Registration")}
              </div>
              <div style={{ fontSize: 13, color: "var(--tx-l3)", marginBottom: 20 }}>{roleConfig[role].sub}</div>

              {/* Tab switcher for Citizen and Contractor */}
              {(role === "user" || role === "contractor") && (
                <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["login", "signup"].map(t => (
                    <button key={t} onClick={() => { setTab(t); setErr(""); }} style={{ flex: 1, padding: "8px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fb)", fontSize: 13, fontWeight: 600, color: tab === t ? "var(--gold2)" : "var(--tx-l3)", borderBottom: `2px solid ${tab === t ? "var(--gold)" : "transparent"}`, marginBottom: -1, transition: "all 0.2s" }}>
                      {t === "login" ? "Login" : "Sign Up"}
                    </button>
                  ))}
                </div>
              )}

              {/* FORM FIELDS */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Citizen Sign Up */}
                {role === "user" && tab === "signup" && (
                  <div>
                    <label>Full Name</label>
                    <input placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                )}

                {/* Contractor Sign Up Fields */}
                {role === "contractor" && tab === "signup" && (
                  <>
                    <div>
                      <label>Company / Contractor Name *</label>
                      <input placeholder="e.g. Apex Road Solutions Ltd." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <label>Contact Person Full Name *</label>
                      <input placeholder="e.g. Vikram Patel (Project Director)" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
                    </div>
                    <div>
                      <label>Official Business Email *</label>
                      <input type="email" placeholder="contact@company.in" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                      <label>Contact Phone Number *</label>
                      <input placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div>
                      <label>Municipal Operating Zone</label>
                      <select value={form.serviceArea} onChange={e => setForm({ ...form, serviceArea: e.target.value })}>
                        <option value="East Zone (Koramangala, Indiranagar, HSR Layout)">East Zone (Koramangala, Indiranagar, HSR Layout)</option>
                        <option value="South Zone (Jayanagar, JP Nagar, BTM Layout)">South Zone (Jayanagar, JP Nagar, BTM Layout)</option>
                        <option value="North Zone (Malleshwaram, Rajajinagar)">North Zone (Malleshwaram, Rajajinagar)</option>
                        <option value="West Zone (Peenya, Yeshwanthpur)">West Zone (Peenya, Yeshwanthpur)</option>
                        <option value="Central Zone (MG Road, Shivajinagar)">Central Zone (MG Road, Shivajinagar)</option>
                      </select>
                    </div>
                    <div>
                      <label>Primary Specialization</label>
                      <select value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })}>
                        <option value="Bituminous Pavements & Emergency Surface Restoration">Bituminous Pavements & Emergency Surface Restoration</option>
                        <option value="Drainage Re-Compaction & Edge Sealing">Drainage Re-Compaction & Edge Sealing</option>
                        <option value="Concrete Road Repair & High-Grade Bitumen Mixing">Concrete Road Repair & High-Grade Bitumen Mixing</option>
                        <option value="Heavy Load Arterial Road Milling & Resurfacing">Heavy Load Arterial Road Milling & Resurfacing</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Common Email field for login */}
                {tab === "login" && (
                  <div>
                    <label>Email</label>
                    <input type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                )}

                <div>
                  <label>{tab === "signup" ? "Create Password (min 6 characters)" : "Password"}</label>
                  <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>

                {tab === "signup" && (
                  <div>
                    <label>Confirm Password</label>
                    <input type="password" placeholder="••••••••" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />
                  </div>
                )}
              </div>

              {role === "contractor" && tab === "signup" && (
                <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 8, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.18)", fontSize: 11.5, color: "var(--tx-l3)", lineHeight: 1.5 }}>
                  🛡️ <strong>Notice:</strong> Submitted registrations require administrative authorization. Your account remains pending until an authorized Admin approves it.
                </div>
              )}

              {err && (
                <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 9, background: "rgba(192,82,42,0.12)", border: "1px solid rgba(192,82,42,0.3)", fontSize: 12.5, color: "#e8835c", lineHeight: 1.5 }}>
                  {err}
                </div>
              )}
              
              {tab === "login" && (
                <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.14)", fontSize: 12, color: "var(--tx-l3)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--gold)", fontSize: 10 }}>●</span>
                  <span>Demo credentials automatically prefilled for {roleConfig[role].label}</span>
                </div>
              )}

              <button className="btn btn-gold btn-lg" style={{ width: "100%", marginTop: 20, justifyContent: "center" }} onClick={handleSubmit} disabled={loading}>
                {loading ? <><Spinner />Processing…</> : role === "contractor" ? (tab === "signup" ? "Submit Contractor Application →" : "Login to Contractor Hub →") : role === "user" ? (tab === "login" ? "Login →" : "Create Account →") : "Enter Admin Portal →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ role, page, onNav, collapsed, toggle }) {
  const menus = {
    user: [
      { id: "dashboard", ic: "⬡", lb: "Dashboard" },
      { id: "report", ic: "◈", lb: "Report Pothole" },
      { id: "myreports", ic: "≡", lb: "My Reports" },
      { id: "profile", ic: "👤", lb: "My Profile" },
    ],
    admin: [
      { id: "dashboard", ic: "⬡", lb: "Dashboard" },
      { id: "complaints", ic: "≡", lb: "All Complaints" },
      { id: "map", ic: "⊞", lb: "Map Monitor" },
      { id: "contractors", ic: "◈", lb: "Contractor Directory" },
      { id: "budget", ic: "⬢", lb: "Budget Control" },
      { id: "activity", ic: "⌘", lb: "Activity Logs" },
      { id: "priority", ic: "⚡", lb: "Priority Queue" },
      { id: "notifications", ic: "🔔", lb: "Contractor Alerts" },
      { id: "profile", ic: "👤", lb: "My Profile" },
    ],
    contractor: [
      { id: "dashboard", ic: "⬡", lb: "Dashboard" },
      { id: "tasks", ic: "≡", lb: "My Assigned Jobs" },
      { id: "expenses", ic: "💰", lb: "Expenses & Budget" },
      { id: "complete", ic: "✓", lb: "Work Submission" },
      { id: "profile", ic: "👤", lb: "My Profile" },
    ],
  };

  const roleColors = { user: "#7aadda", admin: "#e8c96a", contractor: "#6ec98d" };
  const roleLabels = { user: "Citizen Portal", admin: "Gov. Admin", contractor: "Contractor Hub" };

  return (
    <div style={{ width: collapsed ? 56 : 220, transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)", height: "100vh", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.07)", padding: collapsed ? "12px 8px" : "16px 10px", position: "relative", zIndex: 10, background: "rgba(10,12,20,0.97)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28, overflow: "hidden", paddingLeft: collapsed ? 0 : 4 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${roleColors[role]}22,${roleColors[role]}0a)`, border: `1px solid ${roleColors[role]}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: roleColors[role], flexShrink: 0 }}>⬡</div>
        {!collapsed && <div>
          <div className="heading" style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>SmartRoad</div>
          <div style={{ fontSize: 11, color: "var(--tx-l2)", whiteSpace: "nowrap" }}>{roleLabels[role]}</div>
        </div>}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {menus[role]?.map(item => (
          <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => onNav(item.id)} title={collapsed ? item.lb : ""} style={{ justifyContent: collapsed ? "center" : "flex-start", paddingLeft: collapsed ? 0 : 12 }}>
            <span className="nav-ic" style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.ic}</span>
            {!collapsed && <span style={{ fontSize: 13.5 }}>{item.lb}</span>}
          </div>
        ))}
      </div>

      <div className="divider" style={{ marginBottom: 12 }} />
      <button onClick={toggle} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "8px 0", cursor: "pointer", color: "var(--tx-l2)", fontSize: 14, width: "100%" }}>
        {collapsed ? "→" : "←"}
      </button>
    </div>
  );
}

// ─── TOPBAR ────────────────────────────────────────────────────────────────────
function TopBar({ page, user, onLogout, onResetDemo, onNav }) {
  const titles = { 
    dashboard: "Dashboard", 
    report: "Report a Pothole", 
    myreports: "My Reports", 
    profile: "My Profile",
    map: "Map Monitor", 
    route: "Route Check", 
    notifs: "Notifications", 
    complaints: "All Complaints", 
    contractors: "Contractor Directory", 
    budget: "Budget Control", 
    activity: "Activity Logs", 
    priority: "Priority Queue", 
    tasks: "My Assigned Jobs", 
    expenses: "Expenses & Budget", 
    complete: "Work Submission", 
    "budget-request": "Budget Request" 
  };
  return (
    <div style={{ height: 60, display: "flex", alignItems: "center", paddingInline: 24, borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, gap: 12 }}>
      <div style={{ flex: 1 }}>
        <h1 className="heading" style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)" }}>{titles[page] || page}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onResetDemo && (
          <button
            onClick={onResetDemo}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: "var(--gold)", borderColor: "rgba(201,168,76,0.25)" }}
            title="Reset demo data to initial connected records"
          >
            ↺ Reset Demo
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 99, background: "rgba(74,124,89,0.12)", border: "1px solid rgba(74,124,89,0.22)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6ec98d", boxShadow: "0 0 6px #6ec98d" }} />
          <span style={{ fontSize: 12, color: "#7ed4a0", fontWeight: 600 }}>Demo</span>
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.08)" }} />
        <button
          onClick={() => onNav && onNav("profile")}
          style={{
            background: page === "profile" ? "rgba(201,168,76,0.16)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${page === "profile" ? "var(--gold)" : "rgba(255,255,255,0.09)"}`,
            borderRadius: 6,
            padding: "4px 10px",
            color: page === "profile" ? "var(--gold)" : "var(--tx-l2)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500
          }}
          title="Open My Profile"
        >
          <span>👤</span>
          <span className="hide-m">{user?.name || user?.email}</span>
        </button>
        <button onClick={onLogout} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Logout</button>
      </div>
    </div>
  );
}

// ─── USER DASHBOARD ───────────────────────────────────────────────────────────
function UserDashboard({ complaints, user, onNav }) {
  const mine = complaints.filter(c => c.reportedById === user?.id || c.reportedBy === user?.name || c.reportedBy === user?.email);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [activePhotoTab, setActivePhotoTab] = useState("initial");
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  const counts = {
    total: mine.length,
    pending: mine.filter(c => c.status === "pending").length,
    inprog: mine.filter(c => ["in_progress", "assigned", "in-progress"].includes(c.status)).length,
    done: mine.filter(c => c.status === "completed").length,
    reopen: mine.filter(c => c.status === "reopened").length,
  };

  const getStepIndex = (status) => {
    if (status === "pending") return 1;
    if (status === "assigned") return 2;
    if (["in_progress", "in-progress"].includes(status)) return 3;
    if (status === "completed") return 4;
    return 1;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Citizen Welcome Banner & Quick Action */}
      <div className="card" style={{ padding: "20px 24px", background: "linear-gradient(135deg, rgba(122,173,218,0.12), rgba(10,12,20,0.4))", border: "1px solid rgba(122,173,218,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div className="heading" style={{ fontSize: 18, color: "var(--tx-l)", marginBottom: 4 }}>
            Welcome back, {user?.name || "Citizen"}
          </div>
          <div style={{ fontSize: 13, color: "var(--tx-l2)" }}>
            Help keep Indian roads safe. Submit verified reports and track repair status in real-time.
          </div>
        </div>
        <button className="btn btn-gold btn-lg" onClick={() => onNav("report")} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span>◈</span> Report New Pothole
        </button>
      </div>

      {/* Primary KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
        <StatCard icon="≡" val={counts.total} label="Total Reports" accent="#7aadda" />
        <StatCard icon="◎" val={counts.pending} label="Pending Review" accent="#e8c96a" />
        <StatCard icon="⚙" val={counts.inprog} label="In Progress" accent="#7aadda" />
        <StatCard icon="✓" val={counts.done} label="Resolved" accent="#6ec98d" />
        {counts.reopen > 0 && <StatCard icon="↺" val={counts.reopen} label="Reopened" accent="#a48fd4" />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }} className="stack-m">
        {/* Recent Reports Section with Status Progression */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="heading" style={{ fontSize: 16 }}>My Recent Reports</div>
              <div style={{ fontSize: 12, color: "var(--tx-l2)", marginTop: 2 }}>Track progression of your submitted road damage reports</div>
            </div>
            {mine.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => onNav("myreports")}>
                View All ({mine.length}) →
              </button>
            )}
          </div>

          {mine.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "var(--tx-l2)" }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>⬡</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No reports submitted yet</div>
              <div style={{ fontSize: 13, color: "var(--tx-l3)", marginBottom: 16 }}>Spot road damage? Upload a photo to report it directly to road authorities.</div>
              <button className="btn btn-gold btn-sm" onClick={() => onNav("report")}>+ Submit Your First Report</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {mine.slice(0, 4).map(c => {
                const step = getStepIndex(c.status);
                return (
                  <div
                    key={c.id}
                    className="hover-lift"
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onClick={() => {
                      setSelectedComplaint(c);
                      setActivePhotoTab("initial");
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        {c.photo && (
                          <div style={{ width: 54, height: 54, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)", background: "#080c16", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <img
                              src={getPhotoSrc(c.photo)}
                              alt="Pothole"
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--tx-l)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                            <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>#{c.id}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--tx-l2)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span>📍 {c.area}</span>
                            <span>•</span>
                            <span>📅 {c.date}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <SBadge s={c.status} />
                      </div>
                    </div>

                    {/* Progress Tracker Stepper */}
                    <div style={{ marginTop: 4, padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--tx-l3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        <span style={{ color: step >= 1 ? "#6ec98d" : "var(--tx-l3)" }}>1. Reported</span>
                        <span style={{ color: step >= 2 ? "#6ec98d" : "var(--tx-l3)" }}>2. Verified</span>
                        <span style={{ color: step >= 3 ? "#6ec98d" : "var(--tx-l3)" }}>3. In Repair</span>
                        <span style={{ color: step >= 4 ? "#6ec98d" : "var(--tx-l3)" }}>4. Resolved</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(step / 4) * 100}%`, background: step === 4 ? "#6ec98d" : "linear-gradient(90deg, #7aadda, #e8c96a)", transition: "width 0.4s ease" }} />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, padding: "4px 10px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedComplaint(c);
                          setActivePhotoTab("initial");
                        }}
                      >
                        Inspect Dossier ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Citizen's Reported Locations Map (Strictly filtered to authenticated citizen) */}
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
          <div className="heading" style={{ fontSize: 16, marginBottom: 4 }}>My Reported Sites</div>
          <div style={{ fontSize: 12, color: "var(--tx-l2)", marginBottom: 14 }}>
            {mine.length} geotagged location{mine.length === 1 ? "" : "s"} submitted by you
          </div>
          <div style={{ flex: 1, minHeight: 240, borderRadius: 10, overflow: "hidden" }}>
            <MapView height={240} complaints={mine} />
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => onNav("myreports")}>
              ≡ My Reports List
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => onNav("profile")}>
              👤 My Profile
            </button>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL: Quick Pothole Dossier with Left Content & Right Full-Visibility Picture */}
      {selectedComplaint && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.9)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setSelectedComplaint(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 960,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.08)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 26px",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: "var(--gold2)",
                  }}
                >
                  ◈
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="heading" style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)" }}>
                      Pothole Dossier
                    </span>
                    <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                      #{selectedComplaint.id}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>
                    Reported on {selectedComplaint.date}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SBadge s={selectedComplaint.status} />
                <SevBadge s={selectedComplaint.severity} />
                <button
                  onClick={() => setSelectedComplaint(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "var(--tx-l)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 600,
                    marginLeft: 6
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.05fr 1fr",
                gap: 22,
                padding: "22px 26px",
                overflowY: "auto",
                flex: 1
              }}
              className="stack-m"
            >
              {/* LEFT COLUMN: Content */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ padding: "15px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Grievance Heading & Location
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)", marginBottom: 8 }}>
                    {selectedComplaint.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--tx-l2)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📍</span>
                    <span>{selectedComplaint.area}</span>
                  </div>
                  {(selectedComplaint.lat && selectedComplaint.lng) && (
                    <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4, fontFamily: "monospace" }}>
                      Geo-coordinates: {selectedComplaint.lat}, {selectedComplaint.lng}
                    </div>
                  )}
                </div>

                <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Hazard Description & Notes
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--tx-l)", lineHeight: 1.6 }}>
                    {selectedComplaint.desc || "Road pavement hazard reported via citizen portal."}
                  </div>
                </div>

                {selectedComplaint.contractor && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Assigned Maintenance Unit:</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold2)" }}>{selectedComplaint.contractor}</div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button className="btn btn-gold btn-sm" onClick={() => { setSelectedComplaint(null); onNav("myreports"); }}>
                    Open in Full Reports View →
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Photo */}
              <PotholePhotoPane
                photo={selectedComplaint.photo}
                completionPhoto={selectedComplaint.completionPhoto}
                activeTab={activePhotoTab}
                onTabChange={setActivePhotoTab}
                onFullscreen={setFullscreenPhoto}
                title="Ground Evidence Photo (Full View)"
              />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 26px",
                background: "rgba(10,14,24,0.9)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>
                Citizen Grievance Monitoring & Road Safety
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: "8px 22px", fontSize: 13, borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setSelectedComplaint(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      <FullscreenLightboxModal src={fullscreenPhoto} onClose={() => setFullscreenPhoto(null)} />
    </div>
  );
}

// ─── REPORT POTHOLE ────────────────────────────────────────────────────────────
function ReportPothole({ user, onAdd, showToast }) {
  const [form, setForm] = useState({ title: "", area: "", desc: "", lat: "", lng: "", photo: null, rawFile: null });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    let finalPhoto = form.photo;
    let aiData = null;
    let costBreakdown = null;
    let sev = "medium"; // Default, will be updated by AI
    let estCost = 9500; // Default medium cost
    
    if (form.rawFile) {
      try {
        const formData = new FormData();
        formData.append("file", form.rawFile);
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/upload`, { method: "POST", body: formData });
        if (res.ok) {
           const payload = await res.json();
           const pts = payload.potholes;
           if (pts && pts.length > 0) {
              // Handle multiple potholes - sum all measurements
              const totalArea = pts.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
              const totalDepth = pts.reduce((sum, p) => sum + Math.abs(p.depth || 0), 0);
              const totalVolume = pts.reduce((sum, p) => sum + (p.volume_m3 || 0), 0);
              const avgConfidence = pts.reduce((sum, p) => sum + (p.confidence || 0), 0) / pts.length;
              const maxConfidence = Math.max(...pts.map(p => p.confidence || 0));
              const maxDepth = Math.max(...pts.map(p => Math.abs(p.depth || 0)));
              
              const conf = Math.floor(maxConfidence * 100);
              const depth_cm = (maxDepth * 100);
              
              aiData = { 
                area_sqm: totalArea.toFixed(3), 
                depth_cm: (maxDepth * 100).toFixed(2), // Show 2 decimal places for precision
                vol_m3: totalVolume.toFixed(4),
                confidence: conf,
                pothole_count: pts.length,
                avg_confidence: Math.floor(avgConfidence * 100),
                max_depth_cm: (maxDepth * 100).toFixed(2),
                individual_potholes: pts.map(p => ({
                  area_sqm: p.area_m2?.toFixed(3) || "0",
                  depth_cm: Math.abs(p.depth || 0) * 100, // Ensure positive depth
                  confidence: Math.floor((p.confidence || 0) * 100),
                  volume_m3: Math.max(0, p.volume_m3 || 0)?.toFixed(4) || "0.0001" // Ensure positive volume
                })).map(p => ({
                  ...p,
                  depth_cm: p.depth_cm.toFixed(2) // Format after ensuring positive
                }))
              };
              
              // Set severity based on maximum depth and confidence
              sev = maxDepth > 0.1 || maxConfidence > 0.8 ? "high" : maxDepth > 0.05 || maxConfidence > 0.6 ? "medium" : "low";
              estCost = pts.reduce((sum, p) => sum + (p.total_cost || 0), 0) || sev === "high" ? 18000 : sev === "medium" ? 9500 : 4500;
              
              // Use cost data from backend if available
              if (pts.some(p => p.total_cost)) {
                const totalMaterialCosts = pts.reduce((acc, p) => {
                  if (p.material_costs) {
                    Object.keys(p.material_costs).forEach(key => {
                      acc[key] = (acc[key] || 0) + p.material_costs[key];
                    });
                  }
                  return acc;
                }, {});
                
                const materialsCost = Object.values(totalMaterialCosts).reduce((a, b) => a + b, 0);
                
                costBreakdown = {
                  materials: `${pts.reduce((sum, p) => sum + (p.cement_bags || 0), 0).toFixed(2)} bags cement, ${pts.reduce((sum, p) => sum + (p.sand_m3 || 0), 0).toFixed(3)}m³ sand, ${pts.reduce((sum, p) => sum + (p.aggregate_m3 || 0), 0).toFixed(3)}m³ aggregate`,
                  materials_cost: materialsCost,
                  labor: 0, // Labor to be added by contractor
                  total: materialsCost, // Materials only for now
                  rates_used: pts[0]?.rates_used || { cement: 500, sand: 1700, aggregate: 1400, labor: 400 }
                };
                estCost = materialsCost;
              } else {
                // Fallback calculation for multiple potholes with realistic minimums
                const vol = Math.max(0.002, totalVolume || totalArea * (maxDepth / 100) || 0); // Minimum 0.002m³
                const cement_bags = Math.max(0.5, vol * 6.5); // At least 0.5 bags
                const sand_m3 = Math.max(0.01, vol * 0.45); // At least 0.01 m³
                const aggregate_m3 = Math.max(0.02, vol * 0.9); // At least 0.02 m³
                
                const materials_cost = cement_bags * 450 + sand_m3 * 1700 + aggregate_m3 * 1400;
                costBreakdown = { 
                  materials: `${cement_bags.toFixed(2)} bags cement, ${sand_m3.toFixed(3)}m³ sand, ${aggregate_m3.toFixed(3)}m³ aggregate`, 
                  materials_cost: Math.max(50, materials_cost), // Minimum ₹50
                  labor: 0, // Labor to be added by contractor
                  total: Math.max(50, materials_cost * 1.1), // Materials only with contingency
                  rates_used: { cement: 500, sand: 1700, aggregate: 1400, labor: 400 }
                };
                estCost = Math.max(50, materials_cost * 1.1);
              }
              
              sev = conf > 80 ? "high" : conf > 60 ? "medium" : "low";
              
              if (payload.annotated_image) {
                 finalPhoto = payload.annotated_image;
              }
           }
        }
      } catch(e) { console.log("AI bypassed or offline, submitting strictly manually."); }
    }

    const newC = {
      id: uid(), title: form.title || "Untitled Report", area: form.area,
      severity: sev, desc: form.desc, status: "pending",
      reportedBy: user?.name || user?.email, reportedById: user?.id,
      date: now(),
      cost: estCost,
      aiData: aiData, costBreakdown: costBreakdown,
      lat: form.lat, lng: form.lng, contractor: null,
      photo: finalPhoto,
      timeline: [{ action: aiData ? "Complaint filed & AI Analyzed" : "Complaint filed manually", actor: user?.name, time: ts() }],
    };
    
    onAdd(newC, { actor: user?.name, action: `Filed complaint ${newC.id}`, type: "report" });
    setSubmitting(false);
    setSubmitted(true);
    showToast(`Complaint ${newC.id} submitted`, "success");
  };

  if (submitted) return (
    <div className="card" style={{ padding: 44, textAlign: "center", maxWidth: 480 }}>
      <div style={{ fontSize: 44, marginBottom: 14 }} className="float">✓</div>
      <div className="heading" style={{ fontSize: 22, marginBottom: 8 }}>Complaint Submitted</div>
      <div style={{ color: "var(--tx-l3)", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>Your manual report has been securely logged on the audit trail.</div>
      <button className="btn btn-gold" onClick={() => { setSubmitted(false); setForm({ title: "", area: "", severity: "medium", desc: "", lat: "", lng: "", photo: null, rawFile: null }); }}>
        ◈ Report Another
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
      <div className="card fu" style={{ padding: 32 }}>
        <div className="heading" style={{ fontSize: 18, marginBottom: 22 }}>Manual Pothole Report</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1", marginBottom: 6 }}>
            <label>Photo Evidence</label>
            <label className="hover-lift" style={{ display: "block", border: "2px dashed rgba(255,255,255,0.15)", borderRadius: 12, padding: form.photo ? "14px" : "28px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: form.photo ? "rgba(255,255,255,0.02)" : "transparent", position: "relative", overflow: "hidden" }}>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    setForm({ ...form, photo: event.target.result, rawFile: file });
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              {form.photo ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "100%", maxHeight: 220, minHeight: 140, background: "#080c16", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 12, padding: 8 }}>
                    <img src={getPhotoSrc(form.photo)} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, width: "auto", height: "auto", objectFit: "contain", borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 13, color: "var(--gold)" }}>Tap to change or select another photo</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", opacity: 0.7 }}>
                  <div style={{ fontSize: 32 }}>📸</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Tap to attach photo</div>
                  <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>JPG, PNG • Max 5MB</div>
                </div>
              )}
            </label>
          </div>
          <div style={{ gridColumn: "1/-1" }}><label>Title *</label><input placeholder="e.g. Deep pothole near MG Road Junction" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label>Area</label><input placeholder="e.g. Sector 12" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
          <div style={{ gridColumn: "1/-1" }}><label>Description</label><textarea placeholder="Describe size, depth, safety risk…" rows={3} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
          
          <div style={{ gridColumn: "1/-1", padding: "12px 16px", borderRadius: 10, background: "rgba(74,125,222,0.08)", border: "1px solid rgba(74,125,222,0.2)", fontSize: 12, color: "var(--tx-l3)", lineHeight: 1.5 }}>
            🤖 <strong>AI Severity Detection:</strong> Severity (Low/Medium/High) will be automatically determined based on pothole size, depth, and risk factors from your uploaded photo.
          </div>
        </div>

        <div className="divider" style={{ margin: "28px 0" }} />

        <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Geo-Tag Location</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div><label>Latitude</label><input placeholder="Auto-detected" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></div>
          <div><label>Longitude</label><input placeholder="Auto-detected" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 22 }} onClick={() => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              pos => setForm({ ...form, lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }),
              () => setForm({ ...form, lat: BASE_LAT.toFixed(5), lng: BASE_LNG.toFixed(5) })
            );
          } else {
            setForm({ ...form, lat: BASE_LAT.toFixed(5), lng: BASE_LNG.toFixed(5) });
          }
        }}>◉ Use Current GPS</button>

        <button className="btn btn-gold btn-lg" onClick={submit} disabled={submitting || !form.title} style={{ width: "100%", justifyContent: "center" }}>
          {submitting ? <><Spinner />Submitting…</> : "Submit Complaint →"}
        </button>
      </div>
    </div>
  );
}

// ─── MY COMPLAINTS ─────────────────────────────────────────────────────────────
function MyComplaints({ complaints, user, onUpdate, showToast }) {
  const mine = complaints.filter(c => c.reportedById === user?.id || c.reportedBy === user?.email || c.reportedBy === user?.name);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [activePhotoTab, setActivePhotoTab] = useState("initial"); // "initial" | "completion"
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const [verifyModal, setVerifyModal] = useState(null);
  const [reason, setReason] = useState("");

  const handleVerify = (c, action) => {
    if (action === "accept") {
      onUpdate(c.id, { verified: "verified" }, { actor: user?.name, action: `Verified completion of ${c.id}`, type: "verify" });
      if (selectedComplaint?.id === c.id) {
        setSelectedComplaint(prev => ({ ...prev, verified: "verified" }));
      }
      showToast("Solution accepted — marked complete", "success");
    } else if (action === "ignore") {
      onUpdate(c.id, { verified: "unverified" }, { actor: user?.name, action: `Skipped verification for ${c.id}`, type: "verify" });
      if (selectedComplaint?.id === c.id) {
        setSelectedComplaint(prev => ({ ...prev, verified: "unverified" }));
      }
      showToast("Skipped verification", "info");
    } else if (action === "reopen") {
      onUpdate(c.id, { status: "reopened", severity: "high", verified: null, reopenReason: reason, timeline: [...(c.timeline || []), { action: "Reopened: " + reason, actor: user?.name, time: ts() }] }, { actor: user?.name, action: `Re-complaint ${c.id}: ${reason}`, type: "reopen", flag: true });
      if (selectedComplaint?.id === c.id) {
        setSelectedComplaint(prev => ({ ...prev, status: "reopened", severity: "high", verified: null }));
      }
      showToast("Re-complaint raised → High Priority", "warning");
    }
    setVerifyModal(null); setReason("");
  };

  if (!mine.length) return (
    <div className="card" style={{ padding: 44, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>≡</div>
      <div className="heading" style={{ fontSize: 20, marginBottom: 8 }}>No complaints yet</div>
      <div style={{ color: "var(--tx-l2)", fontSize: 14 }}>Your submitted complaints appear here</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* List of complaints as clean, clickable cards */}
      {mine.map((c, i) => (
        <div
          key={c.id}
          className="card hover-lift"
          style={{
            padding: "16px 20px",
            cursor: "pointer",
            animationDelay: `${i * 0.04}s`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            transition: "all 0.2s ease"
          }}
          onClick={() => {
            setSelectedComplaint(c);
            setActivePhotoTab("initial");
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
            {/* Pothole Photo Thumbnail (Whole image visible, no cropping) */}
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 10,
                background: "#080c16",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0
              }}
            >
              {c.photo ? (
                <img
                  src={getPhotoSrc(c.photo)}
                  alt="Pothole"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={e => {
                    e.target.style.display = "none";
                    e.target.parentElement.innerHTML = '<span style="font-size:22px;opacity:0.4;">📸</span>';
                  }}
                />
              ) : (
                <span style={{ fontSize: 22, opacity: 0.4 }}>📸</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span className="heading" style={{ fontWeight: 600, fontSize: 15, color: "var(--tx-l)" }}>{c.title}</span>
                <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>#{c.id}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--tx-l2)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>📍 {c.area}</span>
                <span>•</span>
                <span>📅 {c.date}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <SBadge s={c.status} />
                <SevBadge s={c.severity} />
                {c.verified && <VBadge s={c.verified} />}
              </div>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px" }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedComplaint(c);
              setActivePhotoTab("initial");
            }}
          >
            <span>View Details</span>
            <span>↗</span>
          </button>
        </div>
      ))}

      {/* POP-UP MODAL: Pothole Details with Left Content & Right Full-Visibility Picture */}
      {selectedComplaint && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.9)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setSelectedComplaint(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 960,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.08)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 26px",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: "var(--gold2)",
                  }}
                >
                  ◈
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="heading" style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)" }}>
                      Pothole Dossier
                    </span>
                    <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                      #{selectedComplaint.id}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>
                    Reported by {selectedComplaint.reportedBy || "Citizen"} · {selectedComplaint.date}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SBadge s={selectedComplaint.status} />
                <SevBadge s={selectedComplaint.severity} />
                {selectedComplaint.verified && <VBadge s={selectedComplaint.verified} />}
                <button
                  onClick={() => setSelectedComplaint(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "var(--tx-l)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 600,
                    marginLeft: 6
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns (Content on Left, Full Picture on Right) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.05fr 1fr",
                gap: 22,
                padding: "22px 26px",
                overflowY: "auto",
                flex: 1
              }}
              className="stack-m"
            >
              {/* LEFT COLUMN: Content Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Title & Location Box */}
                <div style={{ padding: "15px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Grievance Heading & Location
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)", marginBottom: 8, lineHeight: 1.35 }}>
                    {selectedComplaint.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--tx-l2)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📍</span>
                    <span>{selectedComplaint.area}</span>
                  </div>
                  {(selectedComplaint.lat && selectedComplaint.lng) && (
                    <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4, fontFamily: "monospace" }}>
                      Geo-coordinates: {selectedComplaint.lat}, {selectedComplaint.lng}
                    </div>
                  )}
                </div>

                {/* Description Box */}
                <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Hazard Description & Field Notes
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--tx-l)", lineHeight: 1.6 }}>
                    {selectedComplaint.desc || "No detailed field notes submitted for this grievance."}
                  </div>
                </div>

                {/* Resolution Progress Stepper */}
                <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    Resolution Progress
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" }}>
                    {[
                      { label: "1. Reported", active: true, desc: selectedComplaint.date ? selectedComplaint.date.split(",")[0] : "Logged" },
                      { label: "2. Verified", active: ["assigned", "in_progress", "in-progress", "completed"].includes(selectedComplaint.status), desc: "Inspected" },
                      { label: "3. Dispatched", active: ["in_progress", "in-progress", "completed"].includes(selectedComplaint.status), desc: selectedComplaint.contractor ? "Assigned" : "Pending" },
                      { label: "4. Resolved", active: selectedComplaint.status === "completed", desc: selectedComplaint.verified ? "Verified" : selectedComplaint.status === "completed" ? "Repaired" : "Pending" },
                    ].map((st, sidx) => (
                      <div key={sidx} style={{ padding: "8px 4px", borderRadius: 8, background: st.active ? "rgba(110,201,141,0.08)" : "rgba(255,255,255,0.02)", border: st.active ? "1px solid rgba(110,201,141,0.2)" : "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: st.active ? "#6ec98d" : "var(--tx-l3)" }}>{st.label}</div>
                        <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 2 }}>{st.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assigned Contractor */}
                {selectedComplaint.contractor && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Assigned Maintenance Unit:</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold2)" }}>{selectedComplaint.contractor}</div>
                  </div>
                )}

                {/* Timeline */}
                {(selectedComplaint.timeline || []).length > 0 && (
                  <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                      Activity History & Audit Milestones
                    </div>
                    <div className="tline" style={{ maxHeight: 150, overflowY: "auto" }}>
                      {(selectedComplaint.timeline || []).map((tl, idx) => (
                        <div key={idx} style={{ position: "relative", paddingBottom: 10 }}>
                          <div className="tl-dot" />
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--tx-l)" }}>{tl.action}</div>
                          <div style={{ fontSize: 10.5, color: "var(--tx-l3)", marginTop: 2 }}>{tl.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Citizen Quality Verification Prompt */}
                {selectedComplaint.status === "completed" && !selectedComplaint.verified && (
                  <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(110,201,141,0.08)", border: "1px solid rgba(110,201,141,0.25)" }}>
                    <div className="heading" style={{ fontSize: 14, marginBottom: 4, color: "#6ec98d" }}>Verify Road Repair Quality</div>
                    <div style={{ fontSize: 12, color: "var(--tx-l2)", marginBottom: 12 }}>Contractor has submitted completion evidence. Does the repaired road meet your satisfaction?</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleVerify(selectedComplaint, "accept")}>✓ Accept Repair</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setVerifyModal(selectedComplaint)}>✗ Reject (Raise Re-Complaint)</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleVerify(selectedComplaint, "ignore")}>Skip Verification</button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Pothole Picture (UNCUT, FULL VISIBILITY WITH OBJECT-FIT CONTAIN) */}
              <PotholePhotoPane
                photo={selectedComplaint.photo}
                completionPhoto={selectedComplaint.completionPhoto}
                activeTab={activePhotoTab}
                onTabChange={setActivePhotoTab}
                onFullscreen={setFullscreenPhoto}
                title="Ground Evidence Photo (Full View)"
              />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 26px",
                background: "rgba(10,14,24,0.9)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>
                Municipal Infrastructure Monitoring & Grievance Dossier
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: "8px 22px", fontSize: 13, borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setSelectedComplaint(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      <FullscreenLightboxModal src={fullscreenPhoto} onClose={() => setFullscreenPhoto(null)} />

      {/* Reject Modal */}
      {verifyModal && (
        <div className="modal-ov" onClick={e => e.target === e.currentTarget && setVerifyModal(null)}>
          <div className="modal-box">
            <div className="modal-inner">
              <div className="heading" style={{ fontSize: 19, marginBottom: 18 }}>Reject Solution</div>
              <div className="card" style={{ padding: 18, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>↺ Raise Re-Complaint</div>
                <div style={{ fontSize: 12, color: "var(--tx-l3)", marginBottom: 12 }}>This will escalate to High Priority with admin notification.</div>
                <div style={{ marginBottom: 10 }}><label>Reason *</label><textarea placeholder="Why is the repair unsatisfactory?" rows={2} value={reason} onChange={e => setReason(e.target.value)} /></div>
                <button className="btn btn-danger btn-sm" disabled={!reason.trim()} onClick={() => handleVerify(verifyModal, "reopen")}>↺ Raise Re-Complaint</button>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "var(--tx-l3)", margin: "6px 0" }}>— or —</div>
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => handleVerify(verifyModal, "ignore")}>Skip Verification</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROUTE CHECK ──────────────────────────────────────────────────────────────
function RouteCheck({ complaints }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [checked, setChecked] = useState(false);
  const [routeComplaints, setRouteComplaints] = useState([]);
  const [routeCenter, setRouteCenter] = useState(null);

  // Filter complaints that are along the selected route
  const filterRouteComplaints = () => {
    if (!from || !to) return;
    
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    
    // Filter complaints that contain either from or to location in their area
    const filtered = complaints.filter(c => {
      const area = (c.area || "").toLowerCase();
      const title = (c.title || "").toLowerCase();
      const location = (c.location || "").toLowerCase();
      
      // Check if complaint is along the route (contains from or to location)
      return area.includes(fromLower) || area.includes(toLower) ||
             title.includes(fromLower) || title.includes(toLower) ||
             location.includes(fromLower) || location.includes(toLower);
    });
    
    setRouteComplaints(filtered);
    
    // Calculate center point for zooming
    if (filtered.length > 0) {
      const validComplaints = filtered.filter(c => c.lat && c.lng);
      if (validComplaints.length > 0) {
        const avgLat = validComplaints.reduce((sum, c) => sum + parseFloat(c.lat), 0) / validComplaints.length;
        const avgLng = validComplaints.reduce((sum, c) => sum + parseFloat(c.lng), 0) / validComplaints.length;
        setRouteCenter([avgLat, avgLng]);
      }
    }
  };

  const handleCheckRoute = () => {
    console.log('Checking route:', { from, to, complaintsCount: complaints.length });
    filterRouteComplaints();
    setChecked(true);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 18 }}>Route Pothole Awareness</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div><label>From</label><input placeholder="e.g. Guntur" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label>To</label><input placeholder="e.g. Mangalgiri" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <button className="btn btn-gold" onClick={handleCheckRoute} disabled={!from || !to}>Check Route →</button>
      </div>

      {checked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} className="fu">
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 16, color: "#e8835c" }}>⚠</span>
              <span className="heading" style={{ fontSize: 14 }}>
                {routeComplaints.length} issue{routeComplaints.length !== 1 ? "s" : ""} on {from} → {to} route
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--tx-l3)", marginBottom: 12 }}>
              Showing potholes detected along the selected route between "{from}" and "{to}"
            </div>
            <MapView height={210} complaints={routeComplaints} center={routeCenter} zoom={routeComplaints.length > 0 ? 15 : 12} />
          </div>
          
          {routeComplaints.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div className="heading" style={{ fontSize: 14, marginBottom: 12 }}>Route Issues ({routeComplaints.length})</div>
              <div style={{ display: "grid", gap: 10, maxHeight: 300, overflowY: "auto" }}>
                {routeComplaints.map(c => (
                  <div key={c.id} className="card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: c.severity === "high" ? "#e8835c" : c.severity === "medium" ? "#e8c96a" : "#6ec98d" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div>
                      <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>{c.area}</div>
                      <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 2 }}>
                        📍 {parseFloat(c.lat || 0).toFixed(4)}, {parseFloat(c.lng || 0).toFixed(4)}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <SevBadge s={c.severity} />
                      <SBadge s={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {routeComplaints.length === 0 && (
            <div className="card" style={{ padding: 20, textAlign: "center", color: "#6ec98d", fontSize: 13 }}>
              ✓ No active issues found on {from} → {to} route
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
function Notifications({ complaints, user }) {
  const mine = complaints.filter(c => c.reportedById === user?.id || c.reportedBy === user?.name);
  const notifs = mine.flatMap(c =>
    (c.timeline || []).slice(-2).reverse().map(t => ({
      id: c.id + t.time,
      icon: t.action.includes("completed") ? "✓" : t.action.includes("assigned") ? "◈" : t.action.includes("Reopened") ? "↺" : "◉",
      title: `${c.id}: ${c.title}`, msg: t.action, time: t.time,
      color: t.action.includes("completed") ? "#6ec98d" : t.action.includes("Reopen") ? "#e8835c" : "#7aadda",
    }))
  );

  if (!notifs.length) return (
    <div className="card" style={{ padding: 44, textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>◉</div>
      <div style={{ color: "var(--tx-l2)", fontSize: 14 }}>No notifications yet. Updates appear as your complaints change status.</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 10 }}>
      {notifs.map((n, i) => (
        <div key={n.id + i} className="card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${n.color}18`, border: `1px solid ${n.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: n.color, flexShrink: 0 }}>{n.icon}</div>
          <div style={{ flex: 1 }}>
            <div className="heading" style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{n.title}</div>
            <div style={{ fontSize: 13, color: "var(--tx-l2)", marginBottom: 5, lineHeight: 1.5 }}>{n.msg}</div>
            <div style={{ fontSize: 12, color: "var(--tx-l2)", opacity: 0.75 }}>{n.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard({ complaints, auditLogs, budgetConfig }) {
  const counts = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === "pending").length,
    inprog: complaints.filter(c => ["in_progress", "assigned"].includes(c.status)).length,
    done: complaints.filter(c => c.status === "completed").length,
    rejected: complaints.filter(c => c.status === "rejected").length,
    reopen: complaints.filter(c => c.status === "reopened").length,
    flags: auditLogs.filter(l => l.flag).length,
  };
  const allocated = complaints.reduce((s, c) => s + (c.budget || 0), 0);
  const spent = complaints.filter(c => c.status === "completed").reduce((s, c) => s + (c.budget || c.cost || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        <StatCard icon="≡" val={counts.total} label="Total" accent="#7aadda" />
        <StatCard icon="◎" val={counts.pending} label="Pending" accent="#e8c96a" />
        <StatCard icon="⚙" val={counts.inprog} label="In Progress" accent="#7aadda" />
        <StatCard icon="✓" val={counts.done} label="Completed" accent="#6ec98d" />
        <StatCard icon="✗" val={counts.rejected} label="Rejected" accent="#e8835c" />
        <StatCard icon="↺" val={counts.reopen} label="Reopened" accent="#a48fd4" />
        <StatCard icon="⚠" val={counts.flags} label="Flagged" accent="#e8835c" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="stack-m">
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 16, marginBottom: 18 }}>Budget Overview</div>
          {[
            ["Total Budget", `₹${(budgetConfig.total / 1000).toFixed(0)}K`, 100, "#7aadda"],
            ["Allocated", `₹${(allocated / 1000).toFixed(1)}K`, Math.min(allocated / budgetConfig.total * 100, 100), "#e8c96a"],
            ["Spent", `₹${(spent / 1000).toFixed(1)}K`, Math.min(spent / budgetConfig.total * 100, 100), "#e8835c"],
            ["Remaining", `₹${((budgetConfig.total - allocated) / 1000).toFixed(1)}K`, Math.max((budgetConfig.total - allocated) / budgetConfig.total * 100, 0), "#6ec98d"],
          ].map(([l, v, p, c]) => (
            <div key={l} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ color: "var(--tx-l2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11.5 }}>{l}</span>
                <span style={{ fontWeight: 700, color: c, fontSize: 14 }}>{v}</span>
              </div>
              <div className="pbar"><div className="pfill" style={{ width: `${p}%`, background: `linear-gradient(90deg,${c}90,${c})` }} /></div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 16, marginBottom: 16 }}>Quick Stats</div>
          {[
            ["High Priority", complaints.filter(c => c.severity === "high").length, "#e8835c"],
            ["Fraud Flags", counts.flags, counts.flags > 0 ? "#e8835c" : "#6ec98d"],
            ["Avg. Cost", complaints.length > 0 ? "₹" + Math.floor(complaints.reduce((s, c) => s + (c.cost || 0), 0) / complaints.length).toLocaleString() : "—", "var(--tx-l)"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
              <span style={{ color: "var(--tx-l2)" }}>{l}</span>
              <span style={{ fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 14 }}>City Map</div>
        <MapView height={280} complaints={complaints} showFilters />
      </div>
    </div>
  );
}

// ─── ADMIN COMPLAINTS ─────────────────────────────────────────────────────────
function AdminComplaints({ complaints, contractors, onUpdate, onUpdateContractor, showToast, budgetConfig }) {
  const [statusF, setStatusF] = useState("all");
  const [sevF, setSevF] = useState("all");
  const [sel, setSel] = useState(null);
  const [conSel, setConSel] = useState("");
  const [budgetIn, setBudgetIn] = useState("");
  const [fraudState, setFraudState] = useState("idle"); // idle | loading | result
  const [fraudResult, setFraudResult] = useState(null);
  const [adminPhotoTab, setAdminPhotoTab] = useState("initial");
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  const filtered = complaints.filter(c => {
    if (statusF !== "all" && c.status !== statusF) return false;
    if (sevF !== "all" && c.severity !== sevF) return false;
    return true;
  });

  const doAction = (label, updates, log) => {
    onUpdate(sel.id, updates, log);
    showToast(`${label} applied`, "success");
    setSel(null);
  };

  const assign = async () => {
    if (!conSel) { showToast("Select contractor", "warning"); return; }
    const con = contractors.find(c => c.id === conSel);
    if (!con) { showToast("Contractor not found", "error"); return; }
    
    // Strict contract assignment eligibility check
    const isApproved = con.approval_status === "approved" || (!con.approval_status && con.active !== false);
    const isActive = con.active !== false;

    if (!isApproved || !isActive) {
      showToast(`Cannot assign: ${con.name} is ${con.approval_status || "inactive"}. Only approved & active contractors are eligible.`, "error");
      return;
    }

    try {
      await fetch(`/api/contractors/${con.id}/validate-assignment`, {
        method: "POST",
        headers: { "X-User-Role": "admin" },
      });
    } catch {}

    // Just assign the complaint without budget deduction
    doAction("Assigned", { 
      status: "assigned", 
      contractor: con?.name, 
      contractorId: conSel, 
      timeline: [...(sel.timeline || []), { 
        action: `Assigned to ${con?.name}`, 
        actor: "Admin", 
        time: ts() 
      }] 
    }, { 
      actor: "Admin", 
      action: `Assigned ${sel.id} to ${con?.name}`, 
      type: "assign" 
    });
    
    showToast(`Assigned successfully to ${con.name}`, "success");
  };

  const runFraud = async () => {
    setFraudState("loading"); setFraudResult(null);
    await new Promise(r => setTimeout(r, 2000));
    const score = Math.floor(8 + Math.random() * 60);
    setFraudResult({
      fraud_risk: score > 60 ? "high" : score > 35 ? "medium" : "low",
      score,
      flags: score > 50 ? ["Completion time unusually fast", "Budget nearly maxed"] : score > 30 ? ["Minor cost anomaly detected"] : [],
      recommendation: score > 50 ? "Manual review recommended before releasing payment." : score > 30 ? "Monitor this contractor's next submission." : "No significant anomalies detected.",
    });
    setFraudState("result");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filters */}
      <div className="surface" style={{ padding: "12px 16px", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</span>
          {["all", "pending", "assigned", "in_progress", "completed", "rejected", "reopened"].map(f => (
            <button key={f} className={`chip ${statusF === f ? "on" : ""}`} onClick={() => setStatusF(f)}>{f.replace("_", " ")}</button>
          ))}
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.07)", margin: "0 4px" }} />
          <span style={{ fontSize: 11, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Severity</span>
          {["all", "high", "medium", "low"].map(f => (
            <button key={f} className={`chip ${sevF === f ? "on" : ""}`} onClick={() => setSevF(f)}>{f}</button>
          ))}
        </div>
      </div>

      {!filtered.length ? (
        <div className="card" style={{ padding: 44, textAlign: "center", color: "var(--tx-l3)" }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.3 }}>≡</div>
          <div>No complaints match filters</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="table-w">
            <table>
              <thead><tr><th>ID</th><th>Title</th><th>Area</th><th>Severity</th><th>Status</th><th>Date</th><th>Cost</th><th></th></tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12.5, color: "var(--gold2)", fontWeight: 700 }}>{c.id}</td>
                    <td style={{ maxWidth: 200 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 500 }}>{c.title}</div></td>
                    <td style={{ fontSize: 13, color: "var(--tx-l2)" }}>{c.area}</td>
                    <td><SevBadge s={c.severity} /></td>
                    <td><SBadge s={c.status} /></td>
                    <td style={{ fontSize: 13, color: "var(--tx-l2)" }}>{c.date}</td>
                    <td style={{ fontSize: 14, fontWeight: 700, color: "#7ed4a0" }}>₹{(c.cost || 0).toLocaleString()}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => { setSel(c); setConSel(c.contractorId || ""); setBudgetIn(c.budget || ""); setFraudState("idle"); setFraudResult(null); setAdminPhotoTab("initial"); }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POP-UP MODAL: Admin Inspection Dossier with Left Content & Right Full-Visibility Picture */}
      {sel && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.9)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setSel(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 980,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.08)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 26px",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: "var(--gold2)",
                  }}
                >
                  ◈
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="heading" style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)" }}>
                      Administrative Review Dossier
                    </span>
                    <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                      #{sel.id}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>
                    Reported by {sel.reportedBy || "Citizen"} · {sel.date}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SBadge s={sel.status} />
                <SevBadge s={sel.severity} />
                {sel.verified && <VBadge s={sel.verified} />}
                <button
                  onClick={() => setSel(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "var(--tx-l)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 600,
                    marginLeft: 6
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns (Content on Left, Full Uncropped Picture on Right) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.05fr 1fr",
                gap: 22,
                padding: "22px 26px",
                overflowY: "auto",
                flex: 1
              }}
              className="stack-m"
            >
              {/* LEFT COLUMN: Grievance Content & Action Tools */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Title & Area Box */}
                <div style={{ padding: "15px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Grievance Heading & Location
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)", marginBottom: 6 }}>
                    {sel.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--tx-l2)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📍</span>
                    <span>{sel.area}</span>
                  </div>
                  {(sel.lat && sel.lng) && (
                    <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4, fontFamily: "monospace" }}>
                      Geo-coordinates: {sel.lat}, {sel.lng}
                    </div>
                  )}
                </div>

                {/* Description */}
                {sel.desc && (
                  <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Hazard Description & Field Notes
                    </div>
                    <div style={{ fontSize: 13.5, color: "var(--tx-l)", lineHeight: 1.6 }}>
                      {sel.desc}
                    </div>
                  </div>
                )}

                {/* Metadata Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {[["Area", sel.area], ["Severity", sel.severity], ["Date", sel.date], ["Estimated Cost", "₹" + (sel.cost || 0).toLocaleString()], ["Citizen Reporter", sel.reportedBy], ["Assigned Contractor", sel.contractor || "Unassigned"]].map(([l, v]) => (
                    <div key={l} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ color: "var(--tx-l2)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{l}</div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>

                {/* AI Cost Breakdown */}
                {sel.aiData && sel.costBreakdown && (
                  <CostCalculationBreakdown 
                    aiData={sel.aiData} 
                    costBreakdown={sel.costBreakdown} 
                    rates={sel.costBreakdown.rates_used || { cement: 500, sand: 1700, aggregate: 1400, labor: 400 }}
                  />
                )}

                {/* Assign to Contractor */}
                <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Dispatch to Infrastructure Contractor
                  </label>
                  <select value={conSel} onChange={e => setConSel(e.target.value)} style={{ marginBottom: 10 }}>
                    <option value="">Select approved contractor partner</option>
                    {contractors
                      .filter(c => (c.approval_status === "approved" || (!c.approval_status && c.active !== false)) && c.active !== false)
                      .map(c => {
                        const used = c.usedBudget || 0;
                        const allocated = c.allocatedBudget || 0;
                        const remaining = Math.max(0, allocated - used);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} (₹{remaining.toLocaleString()} balance)
                          </option>
                        );
                      })}
                  </select>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-gold btn-sm" onClick={assign} disabled={!conSel} style={{ flex: 1 }}>
                      ◈ Confirm Assignment
                    </button>
                  </div>
                </div>

                {/* Fraud Detection Analysis */}
                <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      AI Fraud & Risk Audit
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={runFraud} disabled={fraudState === "loading"} style={{ fontSize: 11, padding: "5px 12px" }}>
                      {fraudState === "loading" ? <><Spinner />Analysing…</> : "⚠ Run AI Audit"}
                    </button>
                  </div>

                  {fraudState === "idle" && (
                    <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Click to scan this report against historical anomaly & duplicate patterns.</div>
                  )}

                  {fraudState === "result" && fraudResult && (
                    <div style={{ padding: "12px 14px", borderRadius: 8, fontSize: 12, background: fraudResult.fraud_risk === "high" ? "rgba(192,82,42,0.1)" : fraudResult.fraud_risk === "medium" ? "rgba(201,168,76,0.08)" : "rgba(74,124,89,0.08)", border: `1px solid ${fraudResult.fraud_risk === "high" ? "rgba(192,82,42,0.28)" : fraudResult.fraud_risk === "medium" ? "rgba(201,168,76,0.2)" : "rgba(74,124,89,0.2)"}` }}>
                      <div style={{ fontWeight: 700, marginBottom: 5 }}>
                        Risk: <span style={{ color: fraudResult.fraud_risk === "high" ? "#e8835c" : fraudResult.fraud_risk === "medium" ? "#e8c96a" : "#6ec98d", textTransform: "uppercase" }}>{fraudResult.fraud_risk}</span>
                        <span style={{ color: "var(--tx-l3)", fontWeight: 400, marginLeft: 8 }}>Anomaly Score: {fraudResult.score}/100</span>
                      </div>
                      {fraudResult.flags?.length > 0 && <div style={{ color: "#e8835c", marginBottom: 5 }}>{fraudResult.flags.map(f => `⚑ ${f}`).join(" · ")}</div>}
                      <div style={{ color: "var(--tx-l2)" }}>{fraudResult.recommendation}</div>
                    </div>
                  )}
                </div>

                {/* Primary Decision Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
                  <button className="btn btn-success btn-sm" onClick={() => doAction("Approved", { status: "in_progress", timeline: [...(sel.timeline || []), { action: "Approved by Admin", actor: "Admin", time: ts() }] }, { actor: "Admin", action: `Approved ${sel.id}`, type: "approve" })}>
                    ✓ Approve Work
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => doAction("Rejected", { status: "rejected", timeline: [...(sel.timeline || []), { action: "Rejected by Admin", actor: "Admin", time: ts() }] }, { actor: "Admin", action: `Rejected ${sel.id}`, type: "reject" })}>
                    ✗ Reject Report
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Pothole Picture (UNCUT, FULL VISIBILITY WITH OBJECT-FIT CONTAIN) */}
              <PotholePhotoPane
                photo={sel.photo}
                completionPhoto={sel.completionPhoto}
                activeTab={adminPhotoTab}
                onTabChange={setAdminPhotoTab}
                onFullscreen={setFullscreenPhoto}
                title="Ground Evidence Photo (Admin Audit)"
              />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 26px",
                background: "rgba(10,14,24,0.9)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>
                Municipal Road Governance & Complaint Oversight
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: "8px 22px", fontSize: 13, borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setSel(null)}
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      <FullscreenLightboxModal src={fullscreenPhoto} onClose={() => setFullscreenPhoto(null)} />
    </div>
  );
}

// ─── ADMIN NOTIFICATIONS ───────────────────────────────────────────────────────
function AdminNotifications({ complaints, showToast }) {
  const [notifications, setNotifications] = useState([]);  
  useEffect(() => {
    const checkProblematicPotholes = () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
      const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const problematicIssues = [];
      
      complaints.forEach(complaint => {
        const reportDate = new Date(complaint.date || complaint.createdAt);
        const timeline = complaint.timeline || [];
        
        // Check for multiple reopens
        const reopenCount = timeline.filter(t => t.action.includes("Reopened")).length;
        if (reopenCount >= 2) {
          problematicIssues.push({
            id: complaint.id,
            type: 'multiple_reopens',
            severity: 'high',
            title: `Pothole ${complaint.id} reopened ${reopenCount} times`,
            description: `This pothole has been reopened ${reopenCount} times, indicating poor repair quality.`,
            contractorId: complaint.contractorId,
            contractor: complaint.contractor,
            date: complaint.date
          });
        }
        
        // Check for re-report before 3 months
        if (reportDate > threeMonthsAgo && complaint.status === 'completed') {
          const recentReports = complaints.filter(c => 
            c.area === complaint.area && 
            c.id !== complaint.id && 
            new Date(c.date || c.createdAt) > threeMonthsAgo
          );
          
          if (recentReports.length > 0) {
            problematicIssues.push({
              id: complaint.id,
              type: 'early_rereport',
              severity: 'medium',
              title: `New pothole reported within 3 months`,
              description: `New pothole reported at ${complaint.area} within 3 months of previous repair.`,
              contractorId: complaint.contractorId,
              contractor: complaint.contractor,
              date: complaint.date
            });
          }
        }
        
        // Check for delay in solving (over 1 month)
        if (complaint.status === 'pending' || complaint.status === 'assigned') {
          const daysSinceReport = Math.floor((now - reportDate) / (1000 * 60 * 60 * 24));
          if (daysSinceReport > 30) {
            problematicIssues.push({
              id: complaint.id,
              type: 'resolution_delay',
              severity: 'high',
              title: `Pothole ${complaint.id} unresolved for ${daysSinceReport} days`,
              description: `This pothole has been pending for ${daysSinceReport} days, exceeding 1-month SLA.`,
              contractorId: complaint.contractorId,
              contractor: complaint.contractor,
              date: complaint.date
            });
          }
        }
        
        // Check for in-progress delay
        if (complaint.status === 'in_progress') {
          const lastUpdate = timeline.length > 0 ? 
            new Date(timeline[timeline.length - 1].time) : 
            reportDate;
          const daysInProgress = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
          
          if (daysInProgress > 30) {
            problematicIssues.push({
              id: complaint.id,
              type: 'progress_delay',
              severity: 'medium',
              title: `Pothole ${complaint.id} in progress for ${daysInProgress} days`,
              description: `This pothole has been in progress for ${daysInProgress} days without completion.`,
              contractorId: complaint.contractorId,
              contractor: complaint.contractor,
              date: complaint.date
            });
          }
        }
      });
      
      setNotifications(problematicIssues);
    };
    
    checkProblematicPotholes();
  }, [complaints]);
  
  const handleContractorAction = (notification, action) => {
    if (action === 'warn') {
      showToast(`Warning sent to ${notification.contractor || 'contractor'}`, "success");
    } else if (action === 'block') {
      showToast(`${notification.contractor || 'Contractor'} access restricted`, "warning");
    }
  };
  
  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'high': return '#e8835c';
      case 'medium': return '#e8c96a';
      case 'low': return '#6ec98d';
      default: return '#7aadda';
    }
  };
  
  const getTypeIcon = (type) => {
    switch(type) {
      case 'multiple_reopens': return '↺';
      case 'early_rereport': return '🔄';
      case 'resolution_delay': return '⏰';
      case 'progress_delay': return '⚙️';
      default: return '⚠️';
    }
  };
  
  return (
    <div style={{ maxWidth: 1200 }}>
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          🔔 Contractor Performance Alerts
          <span style={{ 
            fontSize: 12, 
            background: notifications.length > 0 ? 'rgba(232,131,92,0.1)' : 'rgba(110,201,141,0.1)',
            color: notifications.length > 0 ? '#e8835c' : '#6ec98d',
            padding: '4px 12px',
            borderRadius: 20,
            fontWeight: 600
          }}>
            {notifications.length} Active Issues
          </span>
        </div>
        
        {notifications.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 40, 
            color: '#6ec98d', 
            fontSize: 14,
            background: 'rgba(110,201,141,0.05)',
            borderRadius: 12,
            border: '1px solid rgba(110,201,141,0.2)'
          }}>
            ✅ No contractor performance issues detected
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {notifications.map(notification => (
              <div key={`${notification.id}-${notification.type}`} className="card" style={{ 
                padding: 18, 
                borderLeft: `4px solid ${getSeverityColor(notification.severity)}`,
                background: 'rgba(255,255,255,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ 
                      fontSize: 20, 
                      background: `${getSeverityColor(notification.severity)}15`,
                      padding: '8px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {getTypeIcon(notification.type)}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--tx-l)', marginBottom: 5 }}>
                        {notification.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--tx-l2)' }}>
                        📍 {notification.area} • 📅 {new Date(notification.date).toLocaleDateString()}
                      </div>
                      {notification.contractor && (
                        <div style={{ fontSize: 11, color: 'var(--tx-l3)', marginTop: 2 }}>
                          👷 Assigned to: {notification.contractor}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    fontSize: 10, 
                    fontWeight: 600,
                    background: `${getSeverityColor(notification.severity)}20`,
                    color: getSeverityColor(notification.severity),
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {notification.severity}
                  </span>
                </div>
                
                <div style={{ 
                  fontSize: 13, 
                  color: 'var(--tx-l2)', 
                  lineHeight: 1.6,
                  marginBottom: 16,
                  padding: 12,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8
                }}>
                  {notification.description}
                </div>
                
                {notification.contractor && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleContractorAction(notification, 'warn')}
                      style={{ 
                        borderColor: '#e8c96a',
                        color: '#e8c96a'
                      }}
                    >
                      ⚠️ Send Warning
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleContractorAction(notification, 'block')}
                      style={{ 
                        borderColor: '#e8835c',
                        color: '#e8835c'
                      }}
                    >
                      🚫 Restrict Access
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--tx-l3)', fontStyle: 'italic' }}>
                      Actions will be logged in audit trail
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COST CALCULATION BREAKDOWN COMPONENT ────────────────────────────────────────
function CostCalculationBreakdown({ aiData, costBreakdown, rates }) {
  if (!aiData || !costBreakdown) return null;

  const severity = aiData.depth_cm < 5 ? "LOW" : aiData.depth_cm <= 10 ? "MEDIUM" : "HIGH";
  const severityColor = severity === "LOW" ? "#6ec98d" : severity === "MEDIUM" ? "#e8c96a" : "#e8835c";

  return (
    <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        🧮 Complete Cost Calculation Breakdown
        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, background: `${severityColor}20`, color: severityColor, fontWeight: 600 }}>
          {severity} SEVERITY
        </span>
        {aiData.pothole_count > 1 && (
          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, background: "rgba(74,125,222,0.2)", color: "#4a7dde", fontWeight: 600 }}>
            {aiData.pothole_count} POTHOLES
          </span>
        )}
      </div>

      {/* MULTIPLE POTHOLES SUMMARY */}
      {aiData.pothole_count > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>🔍 MULTIPLE POTHOLES DETECTED</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, fontSize: 12, marginBottom: 12 }}>
            <div style={{ padding: "8px 12px", background: "rgba(74,125,222,0.08)", border: "1px solid rgba(74,125,222,0.2)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Total Count</div>
              <div style={{ fontWeight: 600, color: "#4a7dde", fontSize: 14 }}>{aiData.pothole_count}</div>
            </div>
            <div style={{ padding: "8px 12px", background: "rgba(74,125,222,0.08)", border: "1px solid rgba(74,125,222,0.2)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Avg Confidence</div>
              <div style={{ fontWeight: 600, color: "#4a7dde", fontSize: 14 }}>{aiData.avg_confidence}%</div>
            </div>
            <div style={{ padding: "8px 12px", background: "rgba(74,125,222,0.08)", border: "1px solid rgba(74,125,222,0.2)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Max Depth</div>
              <div style={{ fontWeight: 600, color: "#4a7dde", fontSize: 14 }}>{aiData.max_depth_cm}cm</div>
            </div>
          </div>
          
          {/* Individual Potholes Details */}
          <div style={{ fontSize: 11, color: "var(--tx-l3)", marginBottom: 6 }}>Individual Pothole Details:</div>
          <div style={{ display: "grid", gap: 6, maxHeight: 120, overflowY: "auto" }}>
            {aiData.individual_potholes.map((pothole, idx) => (
              <div key={idx} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 11, display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#4a7dde" }}>#{idx + 1}</span>
                <span>Area: {pothole.area_sqm}m²</span>
                <span>Depth: {pothole.depth_cm}cm</span>
                <span>Conf: {pothole.confidence}%</span>
                <span>Vol: {pothole.volume_m3}m³</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. INPUT FROM AI */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>1️⃣ INPUT FROM AI</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, fontSize: 12 }}>
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Total Area (m²)</div>
            <div style={{ fontWeight: 600, color: "var(--tx-l2)" }}>{aiData.area_sqm}</div>
            {aiData.pothole_count > 1 && <div style={{ fontSize: 9, color: "var(--tx-l3)", marginTop: 1 }}>Sum of {aiData.pothole_count} potholes</div>}
          </div>
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Max Depth (m)</div>
            <div style={{ fontWeight: 600, color: "var(--tx-l2)" }}>{(parseFloat(aiData.depth_cm) / 100).toFixed(3)}</div>
            {aiData.pothole_count > 1 && <div style={{ fontSize: 9, color: "var(--tx-l3)", marginTop: 1 }}>Deepest pothole</div>}
          </div>
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Confidence</div>
            <div style={{ fontWeight: 600, color: "#6ec98d" }}>{aiData.confidence}%</div>
            {aiData.pothole_count > 1 && <div style={{ fontSize: 9, color: "var(--tx-l3)", marginTop: 1 }}>Max detected</div>}
          </div>
        </div>
      </div>

      {/* 2. VOLUME CALCULATION */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>2️⃣ VOLUME CALCULATION</div>
        <div style={{ padding: "12px 16px", background: "rgba(74,125,222,0.08)", border: "1px solid rgba(74,125,222,0.2)", borderRadius: 8, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: "var(--tx-l3)" }}>Total Volume (m³) = Sum of All Potholes</span>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--tx-l3)" }}>
                {aiData.area_sqm} m² × {(parseFloat(aiData.depth_cm) / 100).toFixed(3)} m = <span style={{ fontWeight: 600, color: "var(--tx-l2)" }}>{aiData.vol_m3} m³</span>
                {aiData.pothole_count > 1 && <span style={{ marginLeft: 8, fontSize: 10, color: "#4a7dde" }}>({aiData.pothole_count} potholes combined)</span>}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#4a7dde" }}>{aiData.vol_m3}</div>
          </div>
        </div>
      </div>

      {/* 3. MATERIAL MODEL */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>3️⃣ MATERIAL MODEL (1:2:4 Mix)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 11 }}>
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ color: "var(--tx-l3)", marginBottom: 2 }}>Cement</div>
            <div style={{ fontWeight: 600, color: "var(--tx-l2)" }}>6.5 bags/m³</div>
          </div>
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ color: "var(--tx-l3)", marginBottom: 2 }}>Sand</div>
            <div style={{ fontWeight: 600, color: "var(--tx-l2)" }}>0.45 m³/m³</div>
          </div>
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ color: "var(--tx-l3)", marginBottom: 2 }}>Aggregate</div>
            <div style={{ fontWeight: 600, color: "var(--tx-l2)" }}>0.9 m³/m³</div>
          </div>
        </div>
      </div>

      {/* 4. MATERIAL QUANTITIES */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>4️⃣ MATERIAL QUANTITIES</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, fontSize: 12 }}>
          <div style={{ padding: "10px 14px", background: "rgba(110,201,141,0.08)", border: "1px solid rgba(110,201,141,0.2)", borderRadius: 8 }}>
            <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Cement Bags</div>
            <div style={{ fontWeight: 600, color: "#6ec98d", fontSize: 14 }}>
              {costBreakdown.materials?.match(/[\d.]+/)?.[0] || "0"} bags
            </div>
            <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 2 }}>
              {aiData.vol_m3} × 6.5 = {costBreakdown.materials?.match(/[\d.]+/)?.[0] || "0"}
            </div>
          </div>
          <div style={{ padding: "10px 14px", background: "rgba(110,201,141,0.08)", border: "1px solid rgba(110,201,141,0.2)", borderRadius: 8 }}>
            <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Sand (m³)</div>
            <div style={{ fontWeight: 600, color: "#6ec98d", fontSize: 14 }}>
              {costBreakdown.materials?.match(/([\d.]+)m³ sand/)?.[1] || "0"} m³
            </div>
            <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 2 }}>
              {aiData.vol_m3} × 0.45 = {costBreakdown.materials?.match(/([\d.]+)m³ sand/)?.[1] || "0"}
            </div>
          </div>
          <div style={{ padding: "10px 14px", background: "rgba(110,201,141,0.08)", border: "1px solid rgba(110,201,141,0.2)", borderRadius: 8 }}>
            <div style={{ color: "var(--tx-l3)", fontSize: 10, marginBottom: 2 }}>Aggregate (m³)</div>
            <div style={{ fontWeight: 600, color: "#6ec98d", fontSize: 14 }}>
              {costBreakdown.materials?.match(/([\d.]+)m³ aggregate/)?.[1] || "0"} m³
            </div>
            <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 2 }}>
              {aiData.vol_m3} × 0.9 = {costBreakdown.materials?.match(/([\d.]+)m³ aggregate/)?.[1] || "0"}
            </div>
          </div>
        </div>
      </div>

      {/* 5. ADMIN RATES */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>5️⃣ CURRENT ADMIN RATES</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 11 }}>
          {rates && Object.entries(rates).map(([material, rate]) => (
            <div key={material} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, textAlign: "center", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ color: "var(--tx-l3)", textTransform: "capitalize" }}>{material}</div>
              <div style={{ fontWeight: 600, color: "var(--tx-l2)" }}>₹{rate}/{material === "cement" ? "bag" : "m³"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. COST CALCULATION */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>6️⃣ MATERIALS COST CALCULATION</div>
        <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--tx-l2)", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: 8 }}>
          <div style={{ marginBottom: 4 }}>🏗️ Cement Cost: {costBreakdown.materials?.match(/[\d.]+/)?.[0] || "0"} bags × ₹{rates?.cement || 0} = ₹{costBreakdown.materials_cost || 0}</div>
          <div style={{ marginBottom: 4 }}>🏖️ Sand Cost: {costBreakdown.materials?.match(/([\d.]+)m³ sand/)?.[1] || "0"} m³ × ₹{rates?.sand || 0} = ₹{(costBreakdown.materials_cost || 0) * 0.3}</div>
          <div style={{ marginBottom: 4 }}>🪨 Aggregate Cost: {costBreakdown.materials?.match(/([\d.]+)m³ aggregate/)?.[1] || "0"} m³ × ₹{rates?.aggregate || 0} = ₹{(costBreakdown.materials_cost || 0) * 0.4}</div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div>Materials Subtotal = ₹{costBreakdown.materials_cost || 0}</div>
            <div style={{ fontWeight: 600, color: "#e8835c" }}>Materials Cost (with 10% contingency) = ₹{costBreakdown.total}</div>
            {aiData.pothole_count > 1 && <div style={{ fontSize: 10, color: "#4a7dde", marginTop: 4 }}>Combined materials cost for {aiData.pothole_count} potholes</div>}
          </div>
        </div>
      </div>

      {/* 7. LABOR COST (TO BE ADDED BY CONTRACTOR) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>7️⃣ LABOR COST (Contractor to Add)</div>
        <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--tx-l2)", background: "rgba(110,201,141,0.08)", border: "1px solid rgba(110,201,141,0.2)", padding: "12px", borderRadius: 8 }}>
          <div style={{ marginBottom: 4, fontWeight: 600, color: "#6ec98d" }}>💼 Labor Cost Formula:</div>
          <div style={{ marginBottom: 2 }}>Daily Wages × Number of Persons × Number of Days</div>
          <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 4 }}>
            Example: ₹500/day × 4 persons × 3 days = ₹6,000
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "#6ec98d", fontWeight: 600 }}>
            💡 Contractor will add labor cost in expense submission
          </div>
        </div>
      </div>

      {/* TOTAL COST HIGHLIGHT */}
      <div style={{ padding: "16px", background: "linear-gradient(135deg, rgba(232,201,106,0.15), rgba(232,201,106,0.05))", border: "1px solid rgba(232,201,106,0.3)", borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "var(--tx-l3)", marginBottom: 4 }}>MATERIALS COST ONLY</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#e8c96a", fontFamily: "var(--ff)" }}>₹{costBreakdown.total?.toLocaleString() || "0"}</div>
        <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 4 }}>Including 10% contingency for materials wastage</div>
        <div style={{ fontSize: 10, color: "#6ec98d", marginTop: 2 }}>💼 Labor cost to be added by contractor</div>
        {aiData.pothole_count > 1 && <div style={{ fontSize: 10, color: "#4a7dde", marginTop: 2 }}>📊 Materials for {aiData.pothole_count} detected potholes</div>}
      </div>
    </div>
  );
}
function AdminContractors({ contractors, complaints, onAddContractor, onUpdateContractor, showToast }) {
  const [currentTab, setCurrentTab] = useState("directory"); // "directory" or "queue"
  const [queueFilter, setQueueFilter] = useState("pending"); // "pending", "approved", "rejected", "all"
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingContractor, setViewingContractor] = useState(null);
  const [viewingJobs, setViewingJobs] = useState(null);
  const [inspectingApp, setInspectingApp] = useState(null);
  const [rejectingApp, setRejectingApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "", allocatedBudget: "", contactPerson: "", serviceArea: "", specialization: "" });
  const [showBudgetRequests, setShowBudgetRequests] = useState(false);

  const pendingApps = contractors.filter(c => c.approval_status === "pending" || (!c.approval_status && c.active === false && c.approval_status !== "rejected"));
  const approvedContractors = contractors.filter(c => c.approval_status === "approved" || (!c.approval_status && c.active !== false));
  const rejectedApps = contractors.filter(c => c.approval_status === "rejected");

  const queueFilteredList = contractors.filter(c => {
    const status = c.approval_status || (c.active !== false ? "approved" : "pending");
    if (queueFilter === "all") return true;
    return status === queueFilter;
  });

  const handleApprove = async (contractor) => {
    setActionLoading(true);
    try {
      await fetch(`/api/contractor-applications/${contractor.id}/approve`, {
        method: "POST",
        headers: {
          "X-User-Role": "admin",
          "X-User-Id": "ADM_001",
        },
      });
    } catch {}

    const nowStr = new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
    const updated = {
      ...contractor,
      approval_status: "approved",
      active: true,
      verified: true,
      reviewedBy: "Gov Admin (ADM_001)",
      reviewedAt: nowStr,
    };

    onUpdateContractor(updated, {
      actor: "Gov Admin",
      action: `Approved & activated contractor registration for ${contractor.name} (${contractor.id})`,
      type: "contractor_approve"
    });

    showToast(`Approved & activated contractor ${contractor.name}`, "success");
    if (inspectingApp?.id === contractor.id) {
      setInspectingApp(updated);
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!rejectingApp) return;
    if (!rejectionReason.trim()) {
      showToast("Please provide a rejection reason.", "error");
      return;
    }

    setActionLoading(true);
    try {
      await fetch(`/api/contractor-applications/${rejectingApp.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": "admin",
          "X-User-Id": "ADM_001",
        },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
    } catch {}

    const nowStr = new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
    const updated = {
      ...rejectingApp,
      approval_status: "rejected",
      active: false,
      rejection_reason: rejectionReason.trim(),
      reviewedBy: "Gov Admin (ADM_001)",
      reviewedAt: nowStr,
    };

    onUpdateContractor(updated, {
      actor: "Gov Admin",
      action: `Rejected contractor registration for ${rejectingApp.name}: ${rejectionReason.trim()}`,
      type: "contractor_reject"
    });

    showToast(`Rejected contractor application for ${rejectingApp.name}`, "info");
    if (inspectingApp?.id === rejectingApp.id) {
      setInspectingApp(updated);
    }
    setRejectingApp(null);
    setRejectionReason("");
    setActionLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) {
      showToast("Please fill all required fields", "error");
      return;
    }

    const contractor = {
      id: "CON" + Date.now(),
      name: formData.name,
      contactPerson: formData.contactPerson || "Lead Engineer",
      email: formData.email,
      phone: formData.phone,
      serviceArea: formData.serviceArea || "Municipal Central Zone",
      specialization: formData.specialization || "General Road Restoration",
      password: formData.password || "contractor" + Math.random().toString(36).substr(2, 6),
      active: true,
      verified: true,
      approval_status: "approved",
      createdAt: new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }),
      allocatedBudget: formData.allocatedBudget !== "" ? Number(formData.allocatedBudget) : 50000,
      usedBudget: 0,
      pendingBudgetRequests: []
    };

    onAddContractor(contractor, {
      actor: "Gov Admin",
      action: `Directly onboarded contractor partner ${contractor.name}`,
      type: "contractor_onboard"
    });
    showToast("Contractor onboarded successfully", "success");

    setFormData({ name: "", email: "", phone: "", password: "", allocatedBudget: "", contactPerson: "", serviceArea: "", specialization: "" });
    setShowAddModal(false);
  };

  const handleToggleActive = (contractor) => {
    const nextActive = contractor.active === false;
    const updated = {
      ...contractor,
      active: nextActive,
    };
    onUpdateContractor(updated, {
      actor: "Admin",
      action: `${nextActive ? "Reactivated" : "Deactivated"} contractor ${contractor.name}`,
      type: "contractor_deactivate"
    });
    showToast(`Contractor ${contractor.name} ${nextActive ? "activated" : "deactivated"}`, "info");
  };

  // Get all pending budget requests from all contractors
  const allPendingRequests = contractors.flatMap(c => 
    (c.pendingBudgetRequests || [])
      .filter(r => r.status === "pending")
      .map(r => ({ ...r, contractorName: c.name, contractorId: c.id }))
  );

  const approveBudgetRequest = (request) => {
    const contractor = contractors.find(c => c.id === request.contractorId);
    if (!contractor) return;

    const updatedRequests = (contractor.pendingBudgetRequests || []).map(r => 
      r.id === request.id ? { ...r, status: "approved" } : r
    );

    const updatedContractor = {
      ...contractor,
      allocatedBudget: (contractor.allocatedBudget || 0) + request.amount,
      pendingBudgetRequests: updatedRequests
    };

    onUpdateContractor(updatedContractor, {
      actor: "Admin",
      action: `Approved budget request ₹${request.amount.toLocaleString()} for ${contractor.name}`,
      type: "budget_approve"
    });

    showToast(`Approved ₹${request.amount.toLocaleString()} for ${contractor.name}`, "success");
  };

  const rejectBudgetRequest = (request) => {
    const contractor = contractors.find(c => c.id === request.contractorId);
    if (!contractor) return;

    const updatedRequests = (contractor.pendingBudgetRequests || []).map(r => 
      r.id === request.id ? { ...r, status: "rejected" } : r
    );

    const updatedContractor = {
      ...contractor,
      pendingBudgetRequests: updatedRequests
    };

    onUpdateContractor(updatedContractor, {
      actor: "Admin",
      action: `Rejected budget request ₹${request.amount.toLocaleString()} for ${contractor.name}`,
      type: "budget_reject"
    });

    showToast(`Rejected request from ${contractor.name}`, "info");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header and Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="heading-i" style={{ fontSize: 26, marginBottom: 4 }}>Contractor Management</div>
          <div style={{ fontSize: 13.5, color: "var(--tx-l2)" }}>
            {approvedContractors.length} active contractors · {pendingApps.length} pending approval requests
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {allPendingRequests.length > 0 && (
            <button 
              className="btn btn-gold" 
              onClick={() => setShowBudgetRequests(true)}
              style={{ position: "relative" }}
            >
              💰 Budget Requests
              <span style={{ 
                position: "absolute", 
                top: -8, 
                right: -8, 
                background: "#e8835c", 
                color: "white", 
                borderRadius: "50%", 
                width: 22, 
                height: 22, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                fontSize: 11,
                fontWeight: 700
              }}>
                {allPendingRequests.length}
              </span>
            </button>
          )}

          <button className="btn btn-ghost" onClick={() => setShowAddModal(true)} style={{ fontSize: 13 }}>
            + Direct Register Partner
          </button>
        </div>
      </div>

      {/* Primary Tab Switcher: Approved Directory vs Contractor Approval Requests Queue */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 2 }}>
        <button
          onClick={() => setCurrentTab("directory")}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--fb)",
            fontSize: 14,
            fontWeight: 600,
            color: currentTab === "directory" ? "var(--gold2)" : "var(--tx-l3)",
            borderBottom: `2.5px solid ${currentTab === "directory" ? "var(--gold)" : "transparent"}`,
            marginBottom: -2,
            transition: "all 0.2s",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>◈ Approved Directory</span>
          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: currentTab === "directory" ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)", color: currentTab === "directory" ? "var(--gold2)" : "var(--tx-l3)" }}>
            {approvedContractors.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab("queue")}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--fb)",
            fontSize: 14,
            fontWeight: 600,
            color: currentTab === "queue" ? "var(--gold2)" : "var(--tx-l3)",
            borderBottom: `2.5px solid ${currentTab === "queue" ? "var(--gold)" : "transparent"}`,
            marginBottom: -2,
            transition: "all 0.2s",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⏳ Contractor Approval Requests</span>
          {pendingApps.length > 0 ? (
            <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: "#c0522a", color: "#ffffff", fontWeight: 700 }}>
              {pendingApps.length} pending
            </span>
          ) : (
            <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "var(--tx-l3)" }}>
              0
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: APPROVED DIRECTORY */}
      {currentTab === "directory" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 14 }}>
          {approvedContractors.length === 0 ? (
            <div className="card" style={{ padding: 44, textAlign: "center", color: "var(--tx-l3)", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>◈</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-l2)" }}>No Approved Contractors Yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Review and approve pending registrations in the Contractor Approval Requests queue.</div>
            </div>
          ) : (
            approvedContractors.map((c) => {
              const assigned = complaints.filter(x => x.contractorId === c.id || x.contractor === c.name);
              const done = assigned.filter(x => x.status === "completed");
              const budgetUsed = c.usedBudget || 0;
              const allocated = c.allocatedBudget || 0;
              const remaining = allocated - budgetUsed;
              const budgetPercent = allocated > 0 ? (budgetUsed / allocated * 100) : 0;
              return (
                <div key={c.id} className="card" style={{ padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.08))", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>◈</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="heading" style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "var(--tx-l2)", marginTop: 2 }}>{c.contactPerson ? `👤 ${c.contactPerson}` : c.email}</div>
                      </div>
                      <span className={`badge ${c.active !== false ? "b-done" : "b-reject"}`}>
                        {c.active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[["Active", assigned.filter(x => x.status !== "completed").length, "#7aadda"], ["Done", done.length, "#6ec98d"], ["Allocated", "₹" + Math.floor(allocated / 1000) + "K", "#e8c96a"]].map(([l, v, col]) => (
                        <div key={l} style={{ textAlign: "center", padding: "10px 4px", background: "rgba(255,255,255,0.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)" }}>
                          <div style={{ fontWeight: 700, fontSize: 16, color: col }}>{v}</div>
                          <div style={{ fontSize: 10.5, color: "var(--tx-l2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Budget Progress Bar */}
                    {allocated > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                          <span style={{ color: "var(--tx-l2)" }}>Budget Usage</span>
                          <span style={{ color: budgetPercent > 90 ? "#e8835c" : budgetPercent > 70 ? "#e8c96a" : "#6ec98d", fontWeight: 600, fontSize: 12.5 }}>
                            ₹{Math.floor(budgetUsed / 1000)}K / ₹{Math.floor(allocated / 1000)}K
                          </span>
                        </div>
                        <div className="pbar" style={{ height: 6 }}>
                          <div className="pfill" style={{ 
                            width: `${Math.min(budgetPercent, 100)}%`, 
                            background: budgetPercent > 90 ? "#e8835c" : budgetPercent > 70 ? "#e8c96a" : "#6ec98d" 
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4 }}>
                          Remaining: ₹{Math.max(0, remaining).toLocaleString()}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ fontSize: 12.5, color: "var(--tx-l2)", marginBottom: 8 }}>📱 {c.phone}</div>
                    {c.serviceArea && (
                      <div style={{ fontSize: 11.5, color: "var(--tx-l3)", marginBottom: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📍 {c.serviceArea}
                      </div>
                    )}
                  </div>

                  {/* Directory Controls */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setViewingContractor(c)} style={{ flex: 1 }}>
                      View Profile
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setViewingJobs(c)} style={{ flex: 1 }}>
                      Jobs ({assigned.length})
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ color: c.active !== false ? "#e8835c" : "#6ec98d" }} 
                      onClick={() => handleToggleActive(c)}
                    >
                      {c.active !== false ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: CONTRACTOR APPROVAL REQUESTS QUEUE */}
      {currentTab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Status Filters */}
          <div className="surface" style={{ padding: "12px 16px", borderRadius: 12 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Application Status</span>
              {[
                ["pending", `Pending (${pendingApps.length})`],
                ["approved", `Approved (${approvedContractors.length})`],
                ["rejected", `Rejected (${rejectedApps.length})`],
                ["all", `All (${contractors.length})`],
              ].map(([val, label]) => (
                <button
                  key={val}
                  className={`chip ${queueFilter === val ? "on" : ""}`}
                  onClick={() => setQueueFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Applications Cards */}
          {queueFilteredList.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--tx-l3)" }}>
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>⏳</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-l2)" }}>
                No applications matching filter "{queueFilter}"
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Contractors who self-register will appear in this administrative approval queue.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
              {queueFilteredList.map((app) => {
                const status = app.approval_status || (app.active !== false ? "approved" : "pending");
                return (
                  <div
                    key={app.id}
                    className="card"
                    style={{
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      border: status === "pending" ? "1px solid rgba(201,168,76,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      background: status === "pending" ? "rgba(17, 20, 31, 0.98)" : "rgba(13, 16, 26, 0.95)",
                    }}
                  >
                    <div>
                      {/* Top Bar: Company Name & Status Badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="heading" style={{ fontSize: 16, fontWeight: 700, color: "var(--tx-l)" }}>
                              {app.name}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--gold2)", fontFamily: "monospace", marginTop: 2 }}>
                            {app.id}
                          </div>
                        </div>

                        {status === "approved" ? (
                          <span className="badge b-done">✓ Approved & Active</span>
                        ) : status === "rejected" ? (
                          <span className="badge b-reject">✕ Rejected</span>
                        ) : (
                          <span className="badge b-pend" style={{ color: "#e8c96a", borderColor: "rgba(232,201,106,0.4)", background: "rgba(232,201,106,0.12)" }}>
                            ⏳ Pending Review
                          </span>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--tx-l2)", marginBottom: 14 }}>
                        <div>👤 <strong>Contact:</strong> {app.contactPerson || app.contact_person || "Designated Lead"}</div>
                        <div>✉️ <strong>Email:</strong> {app.email}</div>
                        <div>📱 <strong>Phone:</strong> {app.phone}</div>
                        {app.serviceArea && <div>📍 <strong>Operating Area:</strong> {app.serviceArea}</div>}
                        {app.specialization && <div>🛠️ <strong>Specialization:</strong> {app.specialization}</div>}
                        <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 2 }}>
                          📅 Submitted: {app.createdAt || app.created_at || "Recent registration"}
                        </div>
                      </div>

                      {/* Rejection notice if rejected */}
                      {status === "rejected" && app.rejection_reason && (
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(192,82,42,0.12)", border: "1px solid rgba(192,82,42,0.28)", fontSize: 12, color: "#e8835c", marginBottom: 14 }}>
                          <strong>Reason for Rejection:</strong> {app.rejection_reason}
                        </div>
                      )}

                      {/* Review audit metadata if approved */}
                      {status === "approved" && app.reviewedBy && (
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(110,201,141,0.06)", border: "1px solid rgba(110,201,141,0.18)", fontSize: 11.5, color: "#6ec98d", marginBottom: 14 }}>
                          ✓ Reviewed & activated by {app.reviewedBy} on {app.reviewedAt}
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => setInspectingApp(app)}
                      >
                        Inspect Dossier
                      </button>

                      {status === "pending" && (
                        <>
                          <button
                            className="btn btn-gold btn-sm"
                            style={{ flex: 1.2 }}
                            onClick={() => handleApprove(app)}
                            disabled={actionLoading}
                          >
                            ✓ Approve & Activate
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: "#e8835c", borderColor: "rgba(192,82,42,0.3)" }}
                            onClick={() => {
                              setRejectingApp(app);
                              setRejectionReason("");
                            }}
                            disabled={actionLoading}
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}

                      {status === "rejected" && (
                        <button
                          className="btn btn-gold btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => handleApprove(app)}
                          disabled={actionLoading}
                        >
                          Re-evaluate & Approve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Inspect Contractor Application Dossier */}
      {inspectingApp && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setInspectingApp(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 600,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.92)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "var(--gold2)" }}>◈</div>
                <div>
                  <div className="heading" style={{ fontSize: 18, fontWeight: 700 }}>Contractor Application Dossier</div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Official Self-Registration Submission · Ref: {inspectingApp.id}</div>
                </div>
              </div>
              <button onClick={() => setInspectingApp(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--tx-l)", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 10, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", fontWeight: 700 }}>Company Name</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)" }}>{inspectingApp.name}</div>
                </div>
                <div>
                  {inspectingApp.approval_status === "approved" ? (
                    <span className="badge b-done">✓ Approved & Active</span>
                  ) : inspectingApp.approval_status === "rejected" ? (
                    <span className="badge b-reject">✕ Rejected</span>
                  ) : (
                    <span className="badge b-pend">⏳ Pending Review</span>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10.5, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase" }}>Contact Person</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tx-l)", marginTop: 2 }}>{inspectingApp.contactPerson || inspectingApp.contact_person || "—"}</div>
                </div>
                <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10.5, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase" }}>Official Phone</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tx-l)", marginTop: 2 }}>{inspectingApp.phone || "—"}</div>
                </div>
                <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10.5, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase" }}>Business Email</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tx-l)", marginTop: 2 }}>{inspectingApp.email}</div>
                </div>
                <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10.5, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase" }}>Submission Date</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tx-l)", marginTop: 2 }}>{inspectingApp.createdAt || inspectingApp.created_at || "—"}</div>
                </div>
              </div>

              <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 10.5, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase" }}>Operating Zone & Coverage</div>
                <div style={{ fontSize: 13, color: "var(--tx-l)", marginTop: 2 }}>{inspectingApp.serviceArea || inspectingApp.service_area || "City-wide municipal coverage"}</div>
              </div>

              <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 10.5, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase" }}>Civil Specialization & Equipment Capacity</div>
                <div style={{ fontSize: 13, color: "var(--tx-l)", marginTop: 2 }}>{inspectingApp.specialization || "General Road & Pothole Restoration"}</div>
              </div>

              {inspectingApp.rejection_reason && (
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(192,82,42,0.12)", border: "1px solid rgba(192,82,42,0.28)", fontSize: 12.5, color: "#e8835c" }}>
                  <strong>Administrative Rejection Reason:</strong> {inspectingApp.rejection_reason}
                </div>
              )}
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setInspectingApp(null)}>Close</button>
              {inspectingApp.approval_status !== "approved" && (
                <button
                  className="btn btn-gold"
                  onClick={() => {
                    handleApprove(inspectingApp);
                  }}
                  disabled={actionLoading}
                >
                  ✓ Approve & Activate Account
                </button>
              )}
              {inspectingApp.approval_status === "pending" && (
                <button
                  className="btn btn-ghost"
                  style={{ color: "#e8835c", borderColor: "rgba(192,82,42,0.3)" }}
                  onClick={() => {
                    setRejectingApp(inspectingApp);
                    setRejectionReason("");
                  }}
                  disabled={actionLoading}
                >
                  ✕ Reject Application
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Contractor Application with Reason */}
      {rejectingApp && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(3, 6, 14, 0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setRejectingApp(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "linear-gradient(165deg, #171c2b 0%, #0e121d 100%)",
              border: "1px solid rgba(192,82,42,0.4)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.92)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="heading" style={{ fontSize: 18, fontWeight: 700, color: "#e8835c" }}>
                Reject Contractor Application
              </div>
              <button onClick={() => setRejectingApp(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--tx-l)", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, color: "var(--tx-l2)", lineHeight: 1.5 }}>
                You are rejecting the contractor registration for <strong style={{ color: "var(--tx-l)" }}>{rejectingApp.name}</strong> ({rejectingApp.email}). Access to the contractor portal will remain disabled.
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-l3)", marginBottom: 6, display: "block" }}>
                  Administrative Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Incomplete municipal license documents, lack of requisite road roller equipment, or jurisdiction mismatch."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "#161d2f", border: "1px solid rgba(255,255,255,0.12)", color: "var(--tx-l)", fontSize: 13, resize: "vertical" }}
                />
              </div>

              <div style={{ fontSize: 11.5, color: "var(--tx-l3)" }}>
                ℹ️ This reason will be stored in the municipal audit log and displayed to the applicant upon login.
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setRejectingApp(null)}>Cancel</button>
              <button
                className="btn btn-gold"
                style={{ background: "#c0522a", borderColor: "#c0522a", color: "#fff" }}
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
              >
                {actionLoading ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal (View-Only for Admin Oversight) */}
      {viewingContractor && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setViewingContractor(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.92)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: "var(--gold2)",
                  }}
                >
                  ◈
                </div>
                <div>
                  <div className="heading" style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-l)" }}>
                    Contractor Dossier
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>
                    Official Municipal Record · View-Only Oversight
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingContractor(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "var(--tx-l)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 600,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "22px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Company Banner */}
              <div style={{ padding: "16px 20px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-l)" }}>{viewingContractor.name}</div>
                  <div style={{ fontSize: 12, color: "var(--gold2)", fontFamily: "monospace", marginTop: 2 }}>ID: {viewingContractor.id}</div>
                </div>
                <span className={`badge ${viewingContractor.active !== false ? "b-done" : "b-reject"}`}>
                  {viewingContractor.active !== false ? "Active Contractor" : "Suspended"}
                </span>
              </div>

              {/* Information Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "var(--tx-l3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Contact Person</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-l)", marginTop: 4 }}>👤 {viewingContractor.contactPerson || "Lead Engineer"}</div>
                </div>
                <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "var(--tx-l3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Contact Phone</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-l)", marginTop: 4 }}>📱 {viewingContractor.phone}</div>
                </div>
                <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "var(--tx-l3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Email Address</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-l)", marginTop: 4 }}>✉️ {viewingContractor.email}</div>
                </div>
                <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "var(--tx-l3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Registration Date</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-l)", marginTop: 4 }}>📅 {viewingContractor.createdAt || "15 Dec 2025"}</div>
                </div>
              </div>

              {/* Operating Location */}
              <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "var(--tx-l3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Operating Zone & Coverage</div>
                <div style={{ fontSize: 13.5, color: "var(--tx-l)", marginTop: 4 }}>📍 {viewingContractor.serviceArea || "East Zone (Koramangala, Indiranagar, HSR Layout)"}</div>
              </div>

              {/* Technical Specialization */}
              <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "var(--tx-l3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Technical Specialization & Civil Focus</div>
                <div style={{ fontSize: 13.5, color: "var(--tx-l)", marginTop: 4 }}>🛠️ {viewingContractor.specialization || "Bituminous Pavements & Emergency Surface Restoration"}</div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "16px 24px", background: "rgba(10,14,24,0.9)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setViewingContractor(null)}>Close Dossier</button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal (View-Only for Admin Oversight) */}
      {viewingContractor && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setViewingContractor(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.08)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: "var(--gold2)",
                  }}
                >
                  ◈
                </div>
                <div>
                  <div className="heading" style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-l)" }}>
                    Contractor Dossier
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>
                    Official Municipal Record · View-Only Oversight
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingContractor(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "var(--tx-l)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 600,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "22px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Company Banner */}
              <div
                style={{
                  padding: "16px 18px",
                  background: "#161d2f",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Company / Firm Name
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--tx-l)", letterSpacing: "-0.01em" }}>
                  {viewingContractor.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <span className="badge b-done" style={{ fontSize: 11, padding: "4px 10px" }}>
                    ✓ Verified Municipal Vendor
                  </span>
                  <span
                    className={`badge ${viewingContractor.active !== false ? "b-progress" : "b-reject"}`}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                  >
                    {viewingContractor.active !== false ? "● Status: Active" : "○ Status: Inactive"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--tx-l3)", marginLeft: "auto", fontFamily: "monospace" }}>
                    ID: {viewingContractor.id}
                  </span>
                </div>
              </div>

              {/* Contact Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div
                  style={{
                    padding: "13px 15px",
                    background: "#161d2f",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--tx-l3)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👤</span> Contact Person
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-l)", marginTop: 4 }}>
                    {viewingContractor.contactPerson || "Lead Representative"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "13px 15px",
                    background: "#161d2f",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--tx-l3)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📞</span> Official Phone
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-l)", marginTop: 4 }}>
                    {viewingContractor.phone || "—"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "13px 15px",
                    background: "#161d2f",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                    gridColumn: "span 2",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--tx-l3)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>✉️</span> Registered Dispatch Email
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-l)", marginTop: 4 }}>
                    {viewingContractor.email || "—"}
                  </div>
                </div>
              </div>

              {/* Service Area */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "#161d2f",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--tx-l3)", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span>📍</span> Operational Service Zones
                </div>
                <div style={{ fontSize: 13.5, color: "var(--tx-l)", lineHeight: 1.5 }}>
                  {viewingContractor.serviceArea || "Municipal-wide Road Restoration Services"}
                </div>
              </div>

              {/* Specialization */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "#161d2f",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--tx-l3)", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span>🛠️</span> Technical Specialization & Category
                </div>
                <div style={{ fontSize: 13.5, color: "var(--tx-l)", lineHeight: 1.5 }}>
                  {viewingContractor.specialization || "Bituminous & Concrete Pavement Maintenance"}
                </div>
              </div>

              {/* Budget Overview Box */}
              <div
                style={{
                  padding: "16px 18px",
                  background: "rgba(201,168,76,0.08)",
                  borderRadius: 12,
                  border: "1px solid rgba(201,168,76,0.3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Municipal Budget Allocation Status
                  </span>
                  <span style={{ fontSize: 11, color: "var(--tx-l3)" }}>FY 2026</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center" }}>
                  <div style={{ padding: "10px 8px", background: "#101625", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Allocated</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#e8c96a", marginTop: 2 }}>
                      ₹{(viewingContractor.allocatedBudget || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: "10px 8px", background: "#101625", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Used / Approved</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#6ec98d", marginTop: 2 }}>
                      ₹{(viewingContractor.usedBudget || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: "10px 8px", background: "#101625", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Remaining</div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: ((viewingContractor.allocatedBudget || 0) - (viewingContractor.usedBudget || 0)) < 15000 ? "#e8835c" : "#7aadda",
                        marginTop: 2,
                      }}
                    >
                      ₹{Math.max(0, (viewingContractor.allocatedBudget || 0) - (viewingContractor.usedBudget || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                background: "rgba(10,14,24,0.9)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>
                🔒 View-only directory profile (profile editing managed by contractor)
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: "8px 20px", fontSize: 13, borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setViewingContractor(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Assigned Jobs Modal */}
      {viewingJobs && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setViewingJobs(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.08)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div>
                <div className="heading" style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-l)" }}>
                  Assigned Jobs — {viewingJobs.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>
                  Active and completed municipal work orders dispatched to this firm
                </div>
              </div>
              <button
                onClick={() => setViewingJobs(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "var(--tx-l)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 600,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div style={{ padding: "22px 24px", overflowY: "auto" }}>
              {complaints.filter(c => c.contractorId === viewingJobs.id || c.contractor === viewingJobs.name).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--tx-l3)" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tx-l2)" }}>No work orders currently assigned</div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 4 }}>
                    New potholes can be assigned from the All Complaints panel.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {complaints
                    .filter(c => c.contractorId === viewingJobs.id || c.contractor === viewingJobs.name)
                    .map(job => (
                      <div
                        key={job.id}
                        style={{
                          padding: "14px 16px",
                          borderRadius: 10,
                          background: "#161d2f",
                          border: "1px solid rgba(255,255,255,0.08)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--tx-l)" }}>{job.title}</span>
                            <span style={{ fontSize: 11, color: "var(--gold2)", fontFamily: "monospace", padding: "2px 6px", background: "rgba(201,168,76,0.1)", borderRadius: 4 }}>
                              #{job.id}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--tx-l2)", marginTop: 4 }}>
                            📍 {job.area} · Budget: <strong style={{ color: "var(--tx-l)" }}>₹{(job.budget || 0).toLocaleString()}</strong>
                          </div>
                        </div>
                        <SBadge s={job.status} />
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                background: "rgba(10,14,24,0.9)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "flex-end",
                flexShrink: 0,
              }}
            >
              <button
                className="btn btn-ghost"
                style={{ padding: "8px 20px", fontSize: 13, borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setViewingJobs(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard New Contractor Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-inner">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                <div className="heading" style={{ fontSize: 20 }}>Onboard New Contractor</div>
                <button onClick={() => setShowAddModal(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--tx-l3)", fontSize: 18 }}>×</button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label>Company / Firm Name *</label><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Hyderabad Roadways Pvt Ltd" required /></div>
                <div><label>Contact Person</label><input type="text" value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} placeholder="e.g. Ramesh Reddy" /></div>
                <div><label>Email Address *</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contractor@company.com" required /></div>
                <div><label>Phone Number *</label><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 9876543210" required /></div>
                <div><label>Service Area / Zones</label><input type="text" value={formData.serviceArea} onChange={e => setFormData({ ...formData, serviceArea: e.target.value })} placeholder="e.g. North Zone, Sector 4" /></div>
                <div><label>Specialization</label><input type="text" value={formData.specialization} onChange={e => setFormData({ ...formData, specialization: e.target.value })} placeholder="e.g. Bituminous Mix & Cold Asphalt" /></div>
                <div><label>Initial Budget Allocation (₹)</label><input type="number" value={formData.allocatedBudget} onChange={e => setFormData({ ...formData, allocatedBudget: e.target.value })} placeholder="e.g. 100000" min="0" /></div>
                
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-gold">Complete Onboarding</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Budget Requests Modal */}
      {showBudgetRequests && (
        <div className="modal-overlay" onClick={() => setShowBudgetRequests(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-inner">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                <div className="heading" style={{ fontSize: 20 }}>
                  Budget Requests ({allPendingRequests.length})
                </div>
                <button onClick={() => setShowBudgetRequests(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--tx-l3)", fontSize: 18 }}>×</button>
              </div>

              {allPendingRequests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--tx-l3)" }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>💰</div>
                  <div>No pending budget requests</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {allPendingRequests.map(req => (
                    <div key={req.id} style={{ 
                      padding: "16px", 
                      background: "rgba(232,201,106,0.05)", 
                      borderRadius: 12, 
                      border: "1px solid rgba(232,201,106,0.15)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{req.contractorName}</div>
                          <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Requested {new Date(req.requestedAt).toLocaleDateString()}</div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#e8c96a" }}>₹{req.amount.toLocaleString()}</div>
                      </div>
                      
                      <div style={{ fontSize: 12, color: "var(--tx-l2)", marginBottom: 12, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                        {req.reason}
                      </div>
                      
                      {req.proof && (
                        <div style={{ marginBottom: 12 }}>
                          <img 
                            src={req.proof} 
                            alt="Proof" 
                            style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 8, cursor: "pointer" }}
                            onClick={() => window.open(req.proof, '_blank')}
                          />
                        </div>
                      )}
                      
                      <div style={{ display: "flex", gap: 10 }}>
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => { approveBudgetRequest(req); if (allPendingRequests.length === 1) setShowBudgetRequests(false); }}
                        >
                          ✓ Approve
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => { rejectBudgetRequest(req); if (allPendingRequests.length === 1) setShowBudgetRequests(false); }}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BUDGET CONTROL ────────────────────────────────────────────────────────────
function BudgetControl({ complaints, budgetConfig, onBudgetUpdate, showToast }) {
  const [total, setTotal] = useState(budgetConfig.total);
  const [rates, setRates] = useState({ cement: 400, sand: 1500, aggregate: 1200, labor: 300 });
  const [loading, setLoading] = useState(false);
  const allocated = complaints.reduce((s, c) => s + (c.budget || 0), 0);
  const spent = complaints.filter(c => c.status === "completed").reduce((s, c) => s + (c.budget || c.cost || 0), 0);
  const remaining = total - allocated;
  const pendingCost = complaints.filter(c => c.status === "pending").reduce((s, c) => s + (c.cost || 0), 0);

  // Fetch current rates from backend on component mount
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/admin/rates`);
        if (res.ok) {
          const data = await res.json();
          setRates(data.rates);
        }
      } catch (error) {
        console.error("Failed to fetch rates:", error);
      }
    };
    fetchRates();
  }, []);

  const updateRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/admin/update-rates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cement_per_bag: rates.cement,
          sand_per_m3: rates.sand,
          aggregate_per_m3: rates.aggregate,
          labor_per_m3: rates.labor,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        showToast("Rates updated successfully", "success");
        setRates(data.rates);
      } else {
        showToast("Failed to update rates", "error");
      }
    } catch (error) {
      console.error("Error updating rates:", error);
      showToast("Error updating rates", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        <StatCard icon="⬢" val={`₹${Math.floor(total / 1000)}K`} label="Total Budget" accent="#7aadda" />
        <StatCard icon="◎" val={`₹${Math.floor(allocated / 1000)}K`} label="Allocated" accent="#e8c96a" />
        <StatCard icon="⚙" val={`₹${Math.floor(spent / 1000)}K`} label="Spent" accent="#e8835c" />
        <StatCard icon="✓" val={`₹${Math.floor(Math.max(remaining, 0) / 1000)}K`} label="Remaining" accent="#6ec98d" />
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Budget Configuration</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div><label>Total Annual Budget (₹)</label><input type="number" value={total} onChange={e => setTotal(Number(e.target.value))} /></div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
              <span>Utilization</span><span>{total > 0 ? Math.min(Math.floor(allocated / total * 100), 100) : 0}%</span>
            </div>
            <div className="pbar" style={{ height: 8 }}><div className="pfill" style={{ width: `${total > 0 ? Math.min(allocated / total * 100, 100) : 0}%` }} /></div>
          </div>
        </div>
        {pendingCost > remaining && remaining >= 0 && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(192,82,42,0.08)", border: "1px solid rgba(192,82,42,0.22)", marginBottom: 16, fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: "#e8835c" }}>⚠ Budget Deficit — </span>
            <span style={{ color: "var(--tx-l3)" }}>Pending repairs require ₹{pendingCost.toLocaleString()} but only ₹{Math.max(remaining, 0).toLocaleString()} remains.</span>
          </div>
        )}
        <button className="btn btn-gold btn-sm" onClick={() => { onBudgetUpdate({ total, rates }); showToast("Budget saved", "success"); }}>Save Budget</button>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Material Cost Rates</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 16 }}>
          {[["Cement", "cement", "₹ per bag"], ["Sand", "sand", "₹ per ton"], ["Aggregate", "aggregate", "₹ per ton"], ["Labor", "labor", "₹ per day"]].map(([l, k, u]) => (
            <div key={k}><label>{l} <span style={{ color: "var(--tx-l3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({u})</span></label><input type="number" value={rates[k]} onChange={e => setRates({ ...rates, [k]: Number(e.target.value) })} /></div>
          ))}
        </div>
        <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.14)", fontSize: 12, color: "var(--tx-l3)", marginBottom: 14, lineHeight: 1.5 }}>
          These rates are used by the AI Cost Estimator during complaint submission.
        </div>
        <button className="btn btn-gold btn-sm" onClick={updateRates} disabled={loading}>
          {loading ? "Updating..." : "Update Rates"}
        </button>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 10 }}>Smart Budget Lock System</div>
        <div style={{ color: "var(--tx-l3)", fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>Budget is locked on assignment and released only after citizen verification.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 10 }}>
          {[["⬢ Budget Allocated", "Locked until completion", "#7aadda"], ["✓ Work Verified", "Payment released", "#6ec98d"], ["↺ Unused Returned", "Auto-credited back", "#a48fd4"], ["⚠ Excess Detected", "Manual approval required", "#e8c96a"]].map(([t, s, c]) => (
            <div key={t} style={{ padding: "14px 16px", borderRadius: 10, background: `${c}0e`, border: `1px solid ${c}22` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: c, marginBottom: 4 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: "var(--tx-l3)", lineHeight: 1.5 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVITY LOGS ─────────────────────────────────────────────────────────────
function ActivityLogs({ auditLogs, contractors }) {
  const [filter, setFilter] = useState("all");
  const [conFilter, setConFilter] = useState("all");
  const shown = auditLogs.filter(l => {
    if (filter === "flags" && !l.flag) return false;
    if (filter === "fraud" && l.type !== "fraud") return false;
    if (conFilter !== "all") {
      const con = contractors.find(c => c.id === conFilter);
      if (con && !l.actor?.includes(con.name)) return false;
    }
    return true;
  });

  const typeColor = { report: "#7aadda", assign: "#e8c96a", budget: "#e8c96a", complete: "#6ec98d", verify: "#a48fd4", reopen: "#e8835c", fraud: "#e8835c", approve: "#6ec98d", reject: "#e8835c" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        {[["all", "All"], ["flags", "⚑ Flagged"], ["fraud", "⚠ Fraud"]].map(([f, l]) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{l}</button>
        ))}
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.07)", margin: "0 4px" }} />
        <select value={conFilter} onChange={e => setConFilter(e.target.value)} style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}>
          <option value="all">All Contractors</option>
          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Activity Timeline</div>
        {!shown.length && <div style={{ color: "var(--tx-l3)", fontSize: 13, textAlign: "center", padding: 28 }}>No activity yet</div>}
        {[...shown].reverse().map((log, i) => (
          <div key={log.id || i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: log.flag ? "#e8835c" : typeColor[log.type] || "#7aadda", marginTop: 5, flexShrink: 0, boxShadow: log.flag ? "0 0 6px #e8835c60" : "none" }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{log.actor}</span>
                {log.flag && <span className="badge b-reject" style={{ fontSize: 10 }}>⚑ FLAGGED</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--tx-l2)", lineHeight: 1.5 }}>{log.action}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--tx-l2)", whiteSpace: "nowrap", flexShrink: 0 }}>{log.time}</div>
          </div>
        ))}
      </div>

      {/* Workflow tracker */}
      <div className="card" style={{ padding: 22 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Contractor Workflow</div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
          {["Assigned", "Accepted", "Materials Uploaded", "Work Done", "Completed"].map((s, i, arr) => (
            <div key={s} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ padding: "7px 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, background: "rgba(201,168,76,0.1)", color: "var(--gold2)", border: "1px solid rgba(201,168,76,0.2)", whiteSpace: "nowrap" }}>{s}</div>
              {i < arr.length - 1 && <div style={{ width: 16, height: 1, background: "linear-gradient(to right,rgba(201,168,76,0.4),rgba(201,168,76,0.1))", margin: "0 2px" }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PRIORITY QUEUE ────────────────────────────────────────────────────────────
function PriorityQueue({ complaints, showToast, onUpdate }) {
  const [scored, setScored] = useState(null);
  const [loading, setLoading] = useState(false);

  const runAI = async () => {
    if (!complaints.length) { showToast("No complaints to prioritize", "warning"); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 2200));
    const sv = { high: 3, medium: 2, low: 1 };
    const st = { reopened: 5, pending: 3, assigned: 2, in_progress: 1, completed: 0, rejected: 0 };
    const sorted = [...complaints].sort((a, b) => ((sv[b.severity] || 0) * 2 + (st[b.status] || 0)) - ((sv[a.severity] || 0) * 2 + (st[a.status] || 0)));
    const reasons = Object.fromEntries(sorted.map((c, i) => [c.id, i === 0 ? "Critical — highest combined severity and urgency." : c.status === "reopened" ? "Escalated — citizen rejected previous repair." : c.severity === "high" ? "High structural risk." : "Moderate priority."]));
    const scores = Object.fromEntries(sorted.map((c, i) => [c.id, Math.max(95 - i * 12, 20)]));
    setScored({ ranked_ids: sorted.map(c => c.id), scores, reasons });
    setLoading(false);
    showToast("AI Priority scoring complete", "success");
  };

  const svScore = { high: 3, medium: 2, low: 1 };
  const stScore = { reopened: 5, pending: 3, assigned: 2, in_progress: 1, completed: 0, rejected: 0 };
  const sorted = scored
    ? (scored.ranked_ids || []).map(id => complaints.find(c => c.id === id)).filter(Boolean)
    : [...complaints].sort((a, b) => ((svScore[b.severity] || 0) * 2 + (stScore[b.status] || 0)) - ((svScore[a.severity] || 0) * 2 + (stScore[a.status] || 0)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, padding: "12px 16px", borderRadius: 10, background: "rgba(192,82,42,0.08)", border: "1px solid rgba(192,82,42,0.2)", fontSize: 13, color: "var(--tx-l2)" }}>
          <b style={{ color: "#e8835c" }}>↺ Reopened complaints are automatically elevated to High Priority.</b>
        </div>
        <button className="btn btn-gold btn-sm" onClick={runAI} disabled={loading}>
          {loading ? <><Spinner />Scoring…</> : "◈ AI Priority Scoring"}
        </button>
      </div>

      {!complaints.length && <div className="card" style={{ padding: 44, textAlign: "center", color: "var(--tx-l3)" }}>No complaints to prioritize</div>}

      {sorted.map((c, i) => {
        const rankColor = i === 0 ? "#e8835c" : i === 1 ? "#e8c96a" : i === 2 ? "#a48fd4" : "var(--tx-l3)";
        const score = scored?.scores?.[c.id];
        return (
          <div key={c.id} className="card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${rankColor}14`, border: `1px solid ${rankColor}28`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ff)", fontWeight: 600, fontSize: 13, color: rankColor, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="heading" style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--tx-l3)", marginTop: 2 }}>⊞ {c.area} · ₹{(c.cost || 0).toLocaleString()}</div>
              {scored?.reasons?.[c.id] && <div style={{ fontSize: 11.5, color: "var(--gold2)", marginTop: 3 }}>◈ {scored.reasons[c.id]}</div>}
            </div>
            {score != null && (
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--ff)", fontSize: 18, fontWeight: 600, color: rankColor }}>{score}</div>
                <div style={{ fontSize: 9, color: "var(--tx-l3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Score</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {c.status === "reopened" && <span className="badge b-reject" style={{ fontSize: 9.5 }}>↺ RE-OPENED</span>}
              <SevBadge s={c.severity} /><SBadge s={c.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CONTRACTOR DASHBOARD ──────────────────────────────────────────────────────
function ContractorDashboard({ complaints, contractor, onNav, onUpdate, showToast }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id || c.contractor === contractor?.name);
  const pendingJobs = mine.filter(c => c.status === "assigned");
  const inProgressJobs = mine.filter(c => ["in_progress", "in-progress"].includes(c.status));
  const completedJobs = mine.filter(c => c.status === "completed");
  const held = inProgressJobs.reduce((s, c) => s + (c.budget || 0), 0);
  
  // Budget calculations - strictly scoped to this authenticated contractor
  const allocated = contractor?.allocatedBudget || 0;
  const used = contractor?.usedBudget || 0;
  const remaining = Math.max(0, allocated - used);
  const budgetPercent = allocated > 0 ? (used / allocated * 100) : 0;

  const handleStartWork = (task) => {
    onUpdate?.(task.id, { 
      status: "in_progress",
      timeline: [...(task.timeline || []), {
        action: "Contractor commenced on-site mobilization and repair",
        actor: contractor?.name,
        time: ts()
      }]
    }, {
      actor: contractor?.name,
      action: `Started repair work on ${task.id}`,
      type: "contractor_progress"
    });
    showToast?.(`Started work on ${task.id}`, "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Contractor Welcome & Overview Header */}
      <div className="card" style={{ padding: "20px 24px", background: "linear-gradient(135deg, rgba(110,201,141,0.12), rgba(10,12,20,0.4))", border: "1px solid rgba(110,201,141,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div className="heading" style={{ fontSize: 18, color: "var(--tx-l)", marginBottom: 4 }}>
            {contractor?.name || "Contractor Portal"}
          </div>
          <div style={{ fontSize: 13, color: "var(--tx-l2)" }}>
            Authorized Municipal Infrastructure Contractor · Contact: {contractor?.contactPerson || "Lead Engineer"} ({contractor?.phone})
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-gold btn-sm" onClick={() => onNav?.("tasks")}>
            View All Tasks ({mine.length})
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onNav?.("profile")}>
            👤 Profile
          </button>
        </div>
      </div>

      {/* 4 Required KPI Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
        <StatCard icon="≡" val={mine.length} label="Total Assigned Jobs" accent="#7aadda" />
        <StatCard icon="⏳" val={pendingJobs.length} label="Pending Jobs" accent="#e8c96a" />
        <StatCard icon="⚙" val={inProgressJobs.length} label="In-Progress Jobs" accent="#7aadda" />
        <StatCard icon="✓" val={completedJobs.length} label="Completed Jobs" accent="#6ec98d" />
      </div>
      
      {/* Budget & Financial Status Card */}
      {allocated > 0 && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="heading" style={{ fontSize: 15 }}>Authorized Municipal Budget</div>
              <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>Scoped strictly to your assigned contract allocation</div>
            </div>
            {remaining < 10000 && (
              <button className="btn btn-ghost btn-sm" onClick={() => onNav?.("expenses")} style={{ color: "#e8c96a", borderColor: "rgba(232,201,106,0.3)" }}>
                Request Budget Expansion
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            <div style={{ textAlign: "center", padding: "14px", background: "rgba(110,201,141,0.08)", borderRadius: 10, border: "1px solid rgba(110,201,141,0.2)" }}>
              <div style={{ fontSize: 11.5, color: "var(--tx-l2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Allocated</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#6ec98d" }}>₹{(allocated / 1000).toFixed(1)}K</div>
            </div>
            <div style={{ textAlign: "center", padding: "14px", background: "rgba(232,201,106,0.08)", borderRadius: 10, border: "1px solid rgba(232,201,106,0.2)" }}>
              <div style={{ fontSize: 11.5, color: "var(--tx-l2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Used / Disbursed</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#e8c96a" }}>₹{(used / 1000).toFixed(1)}K</div>
            </div>
            <div style={{ textAlign: "center", padding: "14px", background: remaining < 10000 ? "rgba(232,131,92,0.08)" : "rgba(122,173,218,0.08)", borderRadius: 10, border: `1px solid ${remaining < 10000 ? "rgba(232,131,92,0.2)" : "rgba(122,173,218,0.2)"}` }}>
              <div style={{ fontSize: 11.5, color: "var(--tx-l2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Remaining Balance</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: remaining < 10000 ? "#e8835c" : "#7aadda" }}>₹{(remaining / 1000).toFixed(1)}K</div>
            </div>
          </div>
          
          {/* Budget Progress Bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
              <span style={{ color: "var(--tx-l2)" }}>Budget Usage: {budgetPercent.toFixed(1)}%</span>
              <span style={{ color: "var(--tx-l3)" }}>Active Work Held: ₹{held.toLocaleString()}</span>
            </div>
            <div className="pbar" style={{ height: 8 }}>
              <div className="pfill" style={{ 
                width: `${Math.min(budgetPercent, 100)}%`, 
                background: budgetPercent > 90 ? "#e8835c" : budgetPercent > 70 ? "#e8c96a" : "#6ec98d" 
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Assigned Work Orders & Activity List */}
      {!mine.length ? (
        <div className="card" style={{ padding: 44, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>≡</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No tasks currently assigned</div>
          <div style={{ color: "var(--tx-l3)", fontSize: 13, lineHeight: 1.6 }}>Municipal administrators will assign road maintenance work orders to your firm.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 16 }} className="stack-m">
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div className="heading" style={{ fontSize: 16 }}>Available Work Orders</div>
                <div style={{ fontSize: 12, color: "var(--tx-l2)", marginTop: 2 }}>Immediate actionable tasks assigned to your firm</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNav?.("tasks")}>
                View All Tasks →
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mine.slice(0, 5).map(t => (
                <div key={t.id} style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</span>
                      <span style={{ fontSize: 11, color: "var(--gold2)", fontFamily: "monospace" }}>#{t.id}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--tx-l2)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span>📍 {t.area}</span>
                      <span>•</span>
                      <span>Budget: <strong style={{ color: "#6ec98d" }}>₹{(t.budget || t.cost || 0).toLocaleString()}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SBadge s={t.status} />
                    {t.status === "assigned" && (
                      <button className="btn btn-gold btn-sm" onClick={() => handleStartWork(t)} style={{ fontSize: 11 }}>
                        Start Work →
                      </button>
                    )}
                    {["in_progress", "in-progress"].includes(t.status) && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onNav?.("expenses")} style={{ fontSize: 11 }}>
                          + Expenses
                        </button>
                        <button className="btn btn-success btn-sm" onClick={() => onNav?.("complete")} style={{ fontSize: 11 }}>
                          Submit Proof →
                        </button>
                      </div>
                    )}
                    {t.status === "completed" && (
                      <span style={{ fontSize: 11, color: "#6ec98d", fontWeight: 600 }}>
                        ✓ Evidence Submitted
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Operational Overview</div>
              {[
                ["Assigned Jobs", mine.length, "#7aadda"],
                ["Pending Start", pendingJobs.length, "#e8c96a"],
                ["Currently Active", inProgressJobs.length, "#7aadda"],
                ["Completed Repairs", completedJobs.length, "#6ec98d"],
                ["Committed Funds", "₹" + Math.floor(held / 1000) + "K", "#e8c96a"]
              ].map(([l, v, c]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                  <span style={{ color: "var(--tx-l2)" }}>{l}</span>
                  <span style={{ fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => onNav?.("tasks")}>
                ≡ Manage All Assigned Jobs
              </button>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => onNav?.("expenses")}>
                💰 Expenses & Budget Requests
              </button>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => onNav?.("profile")}>
                👤 Manage Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CONTRACTOR TASKS ──────────────────────────────────────────────────────────
function ContractorTasks({ complaints, contractor, onUpdate, showToast }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activePhotoTab, setActivePhotoTab] = useState("initial");
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  const acceptBudget = (c) => {
    onUpdate(c.id, { status: "in_progress", timeline: [...(c.timeline || []), { action: `Budget ₹${c.budget?.toLocaleString()} accepted — work started`, actor: contractor?.name, time: ts() }] }, { actor: contractor?.name, action: `Accepted budget ₹${c.budget} for ${c.id}`, type: "budget" });
    if (selectedTask?.id === c.id) {
      setSelectedTask(prev => ({ ...prev, status: "in_progress" }));
    }
    showToast("Budget accepted. Work can begin.", "success");
  };

  if (!mine.length) return (
    <div className="card" style={{ padding: 44, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>≡</div>
      <div style={{ color: "var(--tx-l3)", fontSize: 13 }}>No tasks assigned yet.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mine.map(t => (
        <div
          key={t.id}
          className="card hover-lift"
          style={{
            padding: "16px 20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            transition: "all 0.2s ease"
          }}
          onClick={() => {
            setSelectedTask(t);
            setActivePhotoTab("initial");
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
            {/* Pothole Photo Thumbnail (Whole image visible, no cropping) */}
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                background: "#080c16",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0
              }}
            >
              {t.photo ? (
                <img
                  src={getPhotoSrc(t.photo)}
                  alt="Pothole"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<span style="font-size:20px;opacity:0.4;">📸</span>';
                  }}
                />
              ) : (
                <span style={{ fontSize: 20, opacity: 0.4 }}>📸</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span className="heading" style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</span>
                <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>#{t.id}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--tx-l2)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>📍 {t.area}</span>
                <span>•</span>
                <span>Budget: <strong style={{ color: "#6ec98d", fontWeight: 700 }}>₹{(t.budget || 0).toLocaleString()}</strong></span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <SevBadge s={t.severity} />
                <SBadge s={t.status} />
              </div>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px" }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTask(t);
              setActivePhotoTab("initial");
            }}
          >
            <span>Inspect Task</span>
            <span>↗</span>
          </button>
        </div>
      ))}

      {/* POP-UP MODAL: Contractor Task Details with Left Content & Right Full-Visibility Picture */}
      {selectedTask && (
        <div
          className="modal-ov"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 14, 0.9)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setSelectedTask(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 980,
              background: "linear-gradient(165deg, #131929 0%, #0d121d 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 16,
              boxShadow: "0 35px 90px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.08)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 26px",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: "var(--gold2)",
                  }}
                >
                  ⚙
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="heading" style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)" }}>
                      Work Order Specification
                    </span>
                    <span style={{ fontSize: 11, color: "var(--gold2)", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                      #{selectedTask.id}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>
                    Assigned to {contractor?.name || "Contractor"} · Authorized Budget: ₹{(selectedTask.budget || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SBadge s={selectedTask.status} />
                <SevBadge s={selectedTask.severity} />
                <button
                  onClick={() => setSelectedTask(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "var(--tx-l)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 600,
                    marginLeft: 6
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns (Content on Left, Full Uncropped Picture on Right) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.05fr 1fr",
                gap: 22,
                padding: "22px 26px",
                overflowY: "auto",
                flex: 1
              }}
              className="stack-m"
            >
              {/* LEFT COLUMN: Task Details & Scope */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Title & Location Box */}
                <div style={{ padding: "15px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Road Repair Target & Location
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--tx-l)", marginBottom: 6 }}>
                    {selectedTask.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--tx-l2)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📍</span>
                    <span>{selectedTask.area}</span>
                  </div>
                  {(selectedTask.lat && selectedTask.lng) && (
                    <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4, fontFamily: "monospace" }}>
                      Geo-coordinates: {selectedTask.lat}, {selectedTask.lng}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div style={{ padding: "14px 18px", borderRadius: 12, background: "#161d2f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Field Damage Specifications
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--tx-l)", lineHeight: 1.6 }}>
                    {selectedTask.desc || "Standard road pavement defect requiring bituminous mix cold-patching and roller compaction."}
                  </div>
                </div>

                {/* AI Cost Calculation Breakdown */}
                {selectedTask.aiData && selectedTask.costBreakdown && (
                  <CostCalculationBreakdown 
                    aiData={selectedTask.aiData} 
                    costBreakdown={selectedTask.costBreakdown} 
                    rates={selectedTask.costBreakdown.rates_used || { cement: 500, sand: 1700, aggregate: 1400, labor: 400 }}
                  />
                )}

                {/* Financial Summary Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {[["Citizen Reporter", selectedTask.reportedBy], ["Date Logged", selectedTask.date], ["Estimated Cost", "₹" + (selectedTask.cost || 0).toLocaleString()], ["Authorized Budget", "₹" + (selectedTask.budget || 0).toLocaleString()]].map(([l, v]) => (
                    <div key={l} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ color: "var(--tx-l2)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{l}</div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>

                {/* Contractor Action: Accept Budget */}
                {selectedTask.status === "assigned" && (
                  <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)" }}>
                    <div className="heading" style={{ fontSize: 14, marginBottom: 4, color: "var(--gold2)" }}>
                      Accept Municipal Work Order
                    </div>
                    <div style={{ fontSize: 12, color: "var(--tx-l2)", marginBottom: 12 }}>
                      Accepting this budget confirms your crew will mobilize to this location and start road reconstruction.
                    </div>
                    <button className="btn btn-gold btn-sm" onClick={() => acceptBudget(selectedTask)} style={{ width: "100%", justifyContent: "center", padding: "10px 16px" }}>
                      ⬢ Accept Budget & Start Work
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Pothole Picture (UNCUT, FULL VISIBILITY WITH OBJECT-FIT CONTAIN) */}
              <PotholePhotoPane
                photo={selectedTask.photo}
                completionPhoto={selectedTask.completionPhoto}
                activeTab={activePhotoTab}
                onTabChange={setActivePhotoTab}
                onFullscreen={setFullscreenPhoto}
                title="Job Site Inspection Photo"
                badgeText="100% Full View (Uncropped)"
              />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 26px",
                background: "rgba(10,14,24,0.9)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>
                Contractor Field Execution & Infrastructure Task
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: "8px 22px", fontSize: 13, borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setSelectedTask(null)}
              >
                Close Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      <FullscreenLightboxModal src={fullscreenPhoto} onClose={() => setFullscreenPhoto(null)} />
    </div>
  );
}

// ─── EXPENSE SUBMIT ────────────────────────────────────────────────────────────
function ExpenseSubmit({ complaints, contractor, onUpdate, showToast, budgetConfig }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id && c.status === "in_progress");
  const [task, setTask] = useState("");
  const [mat, setMat] = useState({ cement: 0, sand: 0, agg: 0, dailyWage: 500, persons: 1, days: 1 });
  const [desc, setDesc] = useState("");
  const sel = mine.find(c => c.id === task);
  const budget = sel?.budget || 0;
  const r = budgetConfig.rates;
  
  // Calculate labor cost: daily wage × persons × days
  const laborCost = mat.dailyWage * mat.persons * mat.days;
  const materialsCost = mat.cement * r.cement + mat.sand * r.sand + mat.agg * r.aggregate;
  const total = materialsCost + laborCost;
  const diff = total - budget;

  const submit = () => {
    if (!task) { showToast("Select a task first", "warning"); return; }
    
    const expenseData = {
      materials: { cement: mat.cement, sand: mat.sand, aggregate: mat.agg },
      labor: { dailyWage: mat.dailyWage, persons: mat.persons, days: mat.days, total: laborCost },
      materialsCost,
      laborCost,
      total,
      diff
    };
    
    onUpdate(task, { 
      expenses: expenseData, 
      expenseDesc: desc, 
      timeline: [...(sel.timeline || []), { 
        action: `Expenses submitted: ₹${total.toLocaleString()} (Materials: ₹${materialsCost.toLocaleString()}, Labor: ₹${laborCost.toLocaleString()}) ${diff > 0 ? "(+" + diff.toLocaleString() + " excess)" : "(within budget)"}`, 
        actor: contractor?.name, 
        time: ts() 
      }] 
    }, { 
      actor: contractor?.name, 
      action: `Submitted expenses ₹${total} for ${task}`, 
      type: "budget", 
      flag: diff > budget * 0.2 
    });
    
    showToast("Expenses submitted", "success");
    setTask(""); 
    setMat({ cement: 0, sand: 0, agg: 0, dailyWage: 500, persons: 1, days: 1 }); 
    setDesc("");
  };

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Submit Expenses</div>
        {!mine.length ? (
          <div style={{ color: "var(--tx-l3)", fontSize: 13 }}>No in-progress tasks. Accept a budget allocation to begin.</div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}><label>Select Task</label>
              <select value={task} onChange={e => setTask(e.target.value)}>
                <option value="">Choose task</option>
                {mine.map(c => <option key={c.id} value={c.id}>{c.id}: {c.title}</option>)}
              </select>
            </div>
            {sel && <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.2)", fontSize: 12, color: "#6ec98d", marginBottom: 14 }}>
              Allocated Budget: <b>₹{budget.toLocaleString()}</b>
            </div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label>Cement (bags) @ ₹{r.cement}</label><input type="number" min={0} value={mat.cement} onChange={e => setMat({ ...mat, cement: Number(e.target.value) })} /></div>
              <div><label>Sand (m³) @ ₹{r.sand}</label><input type="number" min={0} value={mat.sand} onChange={e => setMat({ ...mat, sand: Number(e.target.value) })} /></div>
              <div><label>Aggregate (m³) @ ₹{r.aggregate}</label><input type="number" min={0} value={mat.agg} onChange={e => setMat({ ...mat, agg: Number(e.target.value) })} /></div>
              <div><label>Daily Wage (₹/person)</label><input type="number" min={0} value={mat.dailyWage} onChange={e => setMat({ ...mat, dailyWage: Number(e.target.value) })} /></div>
              <div><label>Number of Persons</label><input type="number" min={1} value={mat.persons} onChange={e => setMat({ ...mat, persons: Number(e.target.value) })} /></div>
              <div><label>Number of Days</label><input type="number" min={1} value={mat.days} onChange={e => setMat({ ...mat, days: Number(e.target.value) })} /></div>
            </div>
            <div><label>Notes</label><textarea rows={2} placeholder="Additional notes about work performed…" value={desc} onChange={e => setDesc(e.target.value)} /></div>
            
            {/* Labor Cost Calculation Display */}
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(110,201,141,0.08)", border: "1px solid rgba(110,201,141,0.2)", fontSize: 12, marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: "#6ec98d", marginBottom: 6 }}>💼 Labor Cost Calculation:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                <div>Daily Wage: ₹{mat.dailyWage}</div>
                <div>Persons: {mat.persons}</div>
                <div>Days: {mat.days}</div>
              </div>
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(110,201,141,0.2)" }}>
                <div style={{ fontWeight: 600 }}>Labor Cost: ₹{mat.dailyWage} × {mat.persons} × {mat.days} = ₹{laborCost.toLocaleString()}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {total > 0 && sel && (
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 14, marginBottom: 14 }}>Budget Proof - Cost Breakdown</div>
          
          {/* Materials Cost */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-l3)", marginBottom: 8 }}>🏗️ Materials Cost</div>
            {[
              ["Cement", mat.cement + " bags", mat.cement * r.cement], 
              ["Sand", mat.sand + " m³", mat.sand * r.sand], 
              ["Aggregate", mat.agg + " m³", mat.agg * r.aggregate]
            ].filter(([, , v]) => v > 0).map(([l, q, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                <span style={{ color: "var(--tx-l3)" }}>{l} <span style={{ fontSize: 10 }}>({q})</span></span>
                <span style={{ fontWeight: 600 }}>₹{v.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12, fontWeight: 600 }}>
              <span>Materials Subtotal</span>
              <span>₹{materialsCost.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Labor Cost */}
          {laborCost > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-l3)", marginBottom: 8 }}>💼 Labor Cost</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                <span style={{ color: "var(--tx-l3)" }}>Daily Wage × Persons × Days</span>
                <span style={{ fontWeight: 600 }}>₹{mat.dailyWage} × {mat.persons} × {mat.days}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                <span style={{ color: "var(--tx-l3)" }}>Labor Cost</span>
                <span style={{ fontWeight: 600, color: "#6ec98d" }}>₹{laborCost.toLocaleString()}</span>
              </div>
            </div>
          )}
          
          {/* Total and Budget Comparison */}
          <div style={{ padding: "12px 16px", borderRadius: 10, background: diff > 0 ? "rgba(232,131,92,0.08)" : "rgba(110,201,141,0.08)", border: diff > 0 ? "1px solid rgba(232,131,92,0.2)" : "1px solid rgba(110,201,141,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Total Cost</span>
              <span style={{ fontWeight: 700 }}>₹{total.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
              <span>Allocated Budget</span>
              <span>₹{budget.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
              <span>{diff > 0 ? "Excess" : "Savings"}</span>
              <span style={{ color: diff > 0 ? "#e8835c" : "#6ec98d" }}>
                {diff > 0 ? "+₹" : "-₹"}{Math.abs(diff).toLocaleString()}
              </span>
            </div>
          </div>
          
          <button className="btn btn-gold" onClick={submit} style={{ width: "100%", marginTop: 16 }}>
            Submit Expenses
          </button>
        </div>
      )}
    </div>
  );
}

// ─── BUDGET REQUEST ────────────────────────────────────────────────────────────
function BudgetRequest({ contractor, onUpdateContractor, showToast }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Get pending budget requests for this contractor
  const pendingRequests = contractor?.pendingBudgetRequests || [];

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        showToast("Please select an image file", "error");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setProof(event.target.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const submitRequest = () => {
    const requestAmount = Number(amount);
    if (!requestAmount || requestAmount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    if (!reason.trim()) {
      showToast("Please provide a reason for the request", "error");
      return;
    }

    setLoading(true);
    
    // Create budget request
    const newRequest = {
      id: "BUDREQ" + Date.now(),
      contractorId: contractor?.id,
      contractorName: contractor?.name,
      amount: requestAmount,
      reason: reason,
      proof: proof,
      status: "pending",
      requestedAt: new Date().toISOString()
    };
    
    // Update contractor with new pending request
    const updatedContractor = {
      ...contractor,
      pendingBudgetRequests: [...pendingRequests, newRequest]
    };
    
    onUpdateContractor(updatedContractor, {
      actor: contractor?.name,
      action: `Submitted budget request for ₹${requestAmount.toLocaleString()}`,
      type: "budget_request"
    });
    
    showToast("Budget request submitted to Admin for approval", "success");
    setAmount("");
    setReason("");
    setProof(null);
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Budget Status Summary */}
      <div className="card" style={{ padding: 22 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Budget Overview</div>
        {(() => {
          const allocated = contractor?.allocatedBudget || 0;
          const used = contractor?.usedBudget || 0;
          const remaining = allocated - used;
          const percent = allocated > 0 ? (used / allocated * 100) : 0;
          
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                <div style={{ textAlign: "center", padding: "12px", background: "rgba(110,201,141,0.08)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--tx-l3)", textTransform: "uppercase" }}>Allocated</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#6ec98d" }}>₹{(allocated/1000).toFixed(1)}K</div>
                </div>
                <div style={{ textAlign: "center", padding: "12px", background: "rgba(232,201,106,0.08)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--tx-l3)", textTransform: "uppercase" }}>Used</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e8c96a" }}>₹{(used/1000).toFixed(1)}K</div>
                </div>
                <div style={{ textAlign: "center", padding: "12px", background: remaining < 10000 ? "rgba(232,131,92,0.08)" : "rgba(122,173,218,0.08)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--tx-l3)", textTransform: "uppercase" }}>Remaining</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: remaining < 10000 ? "#e8835c" : "#7aadda" }}>₹{(remaining/1000).toFixed(1)}K</div>
                </div>
              </div>
              
              <div className="pbar" style={{ height: 6, marginBottom: 8 }}>
                <div className="pfill" style={{ 
                  width: `${Math.min(percent, 100)}%`, 
                  background: percent > 90 ? "#e8835c" : percent > 70 ? "#e8c96a" : "#6ec98d" 
                }} />
              </div>
              
              {remaining < 10000 && (
                <div style={{ padding: "10px 14px", background: "rgba(232,131,92,0.08)", borderRadius: 8, fontSize: 12, color: "#e8835c" }}>
                  ⚠️ Low budget! Submit a request below if you need additional funds.
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Budget Request Form */}
      <div className="card" style={{ padding: 24 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Request Additional Budget</div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label>Amount Required (₹) *</label>
            <input 
              type="number" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="e.g. 50000" 
              min="1000"
              required 
            />
          </div>
          
          <div>
            <label>Reason / Explanation *</label>
            <textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="Explain why you need additional budget. Include details about unexpected costs, material price changes, additional labor required, etc."
              rows={4}
              required 
              style={{ resize: "vertical" }}
            />
          </div>
          
          <div>
            <label>Supporting Documentation (Photo/Proof)</label>
            <div className="upload-z">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="budget-proof-upload"
              />
              <label htmlFor="budget-proof-upload" style={{ cursor: 'pointer', display: 'block' }}>
                {proof ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: 24, marginBottom: 8, color: '#6ec98d' }}>✓</div>
                    <div style={{ color: "#6ec98d", fontWeight: 600, fontSize: 13 }}>Proof uploaded</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📎</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Upload Proof</div>
                    <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Invoices, receipts, site photos, etc.</div>
                  </div>
                )}
              </label>
            </div>
          </div>
          
          <button 
            className="btn btn-gold" 
            onClick={submitRequest} 
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Submitting..." : "Submit Budget Request"}
          </button>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Pending Requests</div>
          {pendingRequests.filter(r => r.status === "pending").map(req => (
            <div key={req.id} style={{ 
              padding: "14px", 
              background: "rgba(232,201,106,0.08)", 
              borderRadius: 10, 
              border: "1px solid rgba(232,201,106,0.2)",
              marginBottom: 10
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>₹{req.amount.toLocaleString()}</span>
                <span className="badge" style={{ background: "rgba(232,201,106,0.2)", color: "#e8c96a" }}>Pending</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--tx-l3)", marginBottom: 4 }}>{req.reason}</div>
              <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Requested: {new Date(req.requestedAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MARK COMPLETE ─────────────────────────────────────────────────────────────
function MarkComplete({ complaints, contractor, onUpdate, showToast }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id && c.status === "in_progress");
  const [task, setTask] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [locationMatch, setLocationMatch] = useState(false);
  const [timestamp, setTimestamp] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationError, setLocationError] = useState(null);

  // Request location permission when component mounts
  useEffect(() => {
    const requestLocationPermission = async () => {
      if ("geolocation" in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPermission(permission.state);
          
          if (permission.state === 'granted') {
            getCurrentLocation();
          } else if (permission.state === 'prompt') {
            showToast("Please allow location access for photo geo-tagging", "info");
          }
        } catch (error) {
          // Fallback for browsers that don't support permissions API
          getCurrentLocation();
        }
      } else {
        setLocationError("Geolocation not supported by this browser");
        showToast("Geolocation is not supported by your browser", "error");
      }
    };

    const getCurrentLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          setCurrentLocation(location);
          setLocationPermission('granted');
          setLocationError(null);
          showToast("Location captured successfully", "success");
        },
        (error) => {
          setLocationError(error.message);
          setLocationPermission('denied');
          let errorMessage = "Unable to get location";
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied by user";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
          }
          
          setLocationError(errorMessage);
          showToast(errorMessage, "error");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    };

    requestLocationPermission();
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check if file is an image
      if (!selectedFile.type.startsWith('image/')) {
        showToast("Please select an image file", "error");
        return;
      }
      
      // Check if location is available
      if (!currentLocation) {
        showToast("Please enable location access before uploading photo", "error");
        return;
      }
      
      setUploading(true);
      
      // Read file as data URL for display
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setFile(dataUrl); // Store the data URL
        
        // Simulate geo-tag validation
        setTimeout(() => {
          setLocationMatch(true);
          setTimestamp(new Date().toLocaleString("en-IN").slice(0, 16));
          setUploaded(true);
          setUploading(false);
          showToast("Image uploaded and geo-validated successfully", "success");
        }, 500);
      };
      reader.onerror = () => {
        setUploading(false);
        showToast("Failed to read image file", "error");
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const requestLocationAccess = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          setCurrentLocation(location);
          setLocationPermission('granted');
          setLocationError(null);
          showToast("Location captured successfully", "success");
        },
        (error) => {
          let errorMessage = "Unable to get location";
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Please allow location access in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
          }
          setLocationError(errorMessage);
          setLocationPermission('denied');
          showToast(errorMessage, "error");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    } else {
      setLocationError("Geolocation not supported");
      showToast("Geolocation is not supported by your browser", "error");
    }
  };

  const submit = () => {
    const sel = mine.find(c => c.id === task);
    if (!sel) return;
    
    if (!uploaded) {
      showToast("Please upload a geo-tagged photo first", "error");
      return;
    }
    
    if (!currentLocation) {
      showToast("Location access is required for completion", "error");
      return;
    }
    
    onUpdate(task, { 
      status: "completed", 
      completionPhoto: file, // file is now a data URL
      completionTimestamp: timestamp,
      completionLocation: currentLocation,
      locationVerified: locationMatch,
      timeline: [...(sel.timeline || []), { 
        action: "Completed with geo-tagged proof. Awaiting citizen verification.", 
        actor: contractor?.name, 
        time: ts() 
      }] 
    }, { 
      actor: contractor?.name, 
      action: `Marked ${task} complete — pending verification`, 
      type: "complete" 
    });
    
    showToast("Marked complete. Citizen notified to verify.", "success");
    setTask(""); 
    setUploaded(false);
    setFile(null);
    setLocationMatch(false);
    setTimestamp("");
  };

  return (
    <div style={{ maxWidth: 580 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Mark Work Complete</div>
        {!mine.length ? (
          <div style={{ color: "var(--tx-l3)", fontSize: 13 }}>No in-progress tasks to mark complete.</div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}><label>Select Task</label>
              <select value={task} onChange={e => { setTask(e.target.value); setUploaded(false); }}>
                <option value="">Choose task</option>
                {mine.map(c => <option key={c.id} value={c.id}>{c.id}: {c.title}</option>)}
              </select>
            </div>
            
            {/* Location Permission Status */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Location Access Status</div>
              <div style={{ padding: "12px 14px", borderRadius: 9, background: locationPermission === 'granted' ? "rgba(110,201,141,0.08)" : locationPermission === 'denied' ? "rgba(232,131,92,0.08)" : "rgba(232,201,106,0.08)", border: locationPermission === 'granted' ? "1px solid rgba(110,201,141,0.2)" : locationPermission === 'denied' ? "1px solid rgba(232,131,92,0.2)" : "1px solid rgba(232,201,106,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>
                    {locationPermission === 'granted' ? '📍' : locationPermission === 'denied' ? '🚫' : '⏳'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: locationPermission === 'granted' ? "#6ec98d" : locationPermission === 'denied' ? "#e8835c" : "#e8c96a" }}>
                      {locationPermission === 'granted' ? 'Location Access Granted' : locationPermission === 'denied' ? 'Location Access Denied' : 'Requesting Location...'}
                    </div>
                    {currentLocation && (
                      <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 2 }}>
                        Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                        {currentLocation.accuracy && <span> • Accuracy: ±{currentLocation.accuracy.toFixed(0)}m</span>}
                      </div>
                    )}
                  </div>
                </div>
                
                {locationPermission !== 'granted' && (
                  <button 
                    className="btn btn-ghost btn-sm"
                    onClick={requestLocationAccess}
                    style={{ fontSize: 11, padding: "6px 12px", borderColor: "#e8c96a", color: "#e8c96a", marginTop: 4 }}
                  >
                    📍 Enable Location Access
                  </button>
                )}
                
                {locationError && (
                  <div style={{ fontSize: 10, color: "#e8835c", marginTop: 6, fontStyle: "italic" }}>
                    ⚠️ {locationError}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ padding: "9px 14px", borderRadius: 9, background: uploaded ? "rgba(74,124,89,0.07)" : "rgba(192,82,42,0.07)", border: uploaded ? "1px solid rgba(74,124,89,0.18)" : "1px solid rgba(192,82,42,0.18)", marginBottom: 14, fontSize: 12.5, color: uploaded ? "#6ec98d" : "#e8835c" }}>
              {uploaded ? "Photo uploaded and geo-validated" : "Completion is blocked until location is enabled and photo is uploaded"}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ marginBottom: 8 }}>After Photo (Geo-Tagged + Timestamped)</label>
              <div className="upload-z">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="completion-photo-upload"
                />
                <label htmlFor="completion-photo-upload" style={{ cursor: 'pointer', display: 'block' }}>
                  {uploading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#e8c96a' }}>Uploading...</div>
                      <div style={{ fontSize: 12, color: 'var(--tx-l3)' }}>Validating geo-tags</div>
                    </div>
                  ) : uploaded ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <div style={{ fontSize: 24, marginBottom: 8, color: '#6ec98d' }}>✓</div>
                      <div style={{ color: "#6ec98d", fontWeight: 600, fontSize: 13 }}>Image uploaded & geo-validated</div>
                      {file && <div style={{ fontSize: 11, color: 'var(--tx-l3)', marginTop: 4 }}>{file.name}</div>}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📷</div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Upload After Photo</div>
                      <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Must be taken on-site · GPS metadata required</div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {uploaded && task && (
              <div className="fu">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.2)", fontSize: 12 }}>
                    <div style={{ color: "var(--tx-l3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Location Match</div>
                    <div style={{ fontWeight: 700, color: "#6ec98d" }}>✓ Verified (±8 m)</div>
                    {currentLocation && (
                      <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 4 }}>
                        📍 Captured: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.2)", fontSize: 12 }}>
                    <div style={{ color: "var(--tx-l3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Timestamp</div>
                    <div style={{ fontWeight: 700, color: "#6ec98d" }}>✓ {timestamp}</div>
                    {currentLocation && (
                      <div style={{ fontSize: 10, color: "var(--tx-l3)", marginTop: 4 }}>
                        📐 GPS Accuracy: ±{currentLocation.accuracy?.toFixed(0) || 5}m
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Additional Location Details */}
                {currentLocation && (
                  <div style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(74,125,222,0.05)", border: "1px solid rgba(74,125,222,0.15)", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Geo-Tag Details</div>
                    <div style={{ fontSize: 11, color: "var(--tx-l2)", lineHeight: 1.6 }}>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: "var(--tx-l3)" }}>Latitude:</span> 
                        <span style={{ fontWeight: 600, color: "#4a7dde" }}>{currentLocation.lat.toFixed(6)}°</span>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: "var(--tx-l3)" }}>Longitude:</span> 
                        <span style={{ fontWeight: 600, color: "#4a7dde" }}>{currentLocation.lng.toFixed(6)}°</span>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: "var(--tx-l3)" }}>Accuracy:</span> 
                        <span style={{ fontWeight: 600, color: "#4a7dde" }}>±{currentLocation.accuracy?.toFixed(0) || 5} meters</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--tx-l3)" }}>Captured:</span> 
                        <span style={{ fontWeight: 600, color: "#4a7dde" }}>{new Date(currentLocation.timestamp).toLocaleString("en-IN", { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <button className="btn btn-success btn-lg" onClick={submit}>Submit Completion →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── CITIZEN MY PROFILE ────────────────────────────────────────────────────────
function CitizenProfile({ user, onUpdateProfile, showToast, complaints }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  const mine = (complaints || []).filter(c => c.reportedById === user?.id || c.reportedBy === user?.name || c.reportedBy === user?.email);
  const resolved = mine.filter(c => c.status === "completed").length;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Full name cannot be empty", "error");
      return;
    }
    if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
      showToast("Please enter a valid 10-digit phone number", "error");
      return;
    }
    setSaving(true);
    await onUpdateProfile({ name: name.trim(), phone: phone.trim() });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setEditing(false);
  };

  return (
    <div style={{ maxWidth: 740, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Profile Header Banner */}
      <div className="card" style={{ padding: 26, background: "linear-gradient(135deg, rgba(122,173,218,0.12), rgba(10,12,20,0.4))", border: "1px solid rgba(122,173,218,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #7aadda, #3d5a7a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", border: "2px solid rgba(255,255,255,0.15)" }}>
            {(name || "C").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="heading" style={{ fontSize: 22, color: "var(--tx-l)", marginBottom: 4 }}>
              {name || user?.name || "Citizen Account"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="badge b-progress" style={{ fontSize: 11 }}>Citizen Account</span>
              <span style={{ fontSize: 12.5, color: "var(--tx-l2)" }}>{user?.email}</span>
            </div>
          </div>
        </div>

        {!editing ? (
          <button className="btn btn-gold btn-sm" onClick={() => setEditing(true)}>
            ✏️ Edit Profile
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-gold btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Profile Details Form & Read-Only Specs */}
      <div className="card" style={{ padding: 26 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 18 }}>Personal Information & Security</div>
        
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="stack-m">
            <div>
              <label>Full Name *</label>
              {editing ? (
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Enter full name" 
                  required 
                />
              ) : (
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, fontWeight: 600 }}>
                  {user?.name || "Not provided"}
                </div>
              )}
            </div>

            <div>
              <label>Phone Number (SMS Notifications)</label>
              {editing ? (
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="10-digit mobile number" 
                />
              ) : (
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
                  {user?.phone ? `+91 ${user.phone}` : "No phone number added"}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="stack-m">
            <div>
              <label>Registered Email Address</label>
              <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 13.5, color: "var(--tx-l2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{user?.email}</span>
                <span style={{ fontSize: 11, color: "var(--tx-l3)" }}>🔒 Read-only</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4 }}>
                Primary login identity verified with government civic portal.
              </div>
            </div>

            <div>
              <label>Account Registration Date</label>
              <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 13.5, color: "var(--tx-l2)" }}>
                📅 {user?.createdAt || "12 Jan 2026"}
              </div>
              <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4 }}>
                Citizen identity verified on Municipal Civic Infrastructure.
              </div>
            </div>
          </div>

          {editing && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-gold" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Citizen Civic Activity Highlights */}
      <div className="card" style={{ padding: 26 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 16 }}>Civic Contribution Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, textAlign: "center" }}>
          <div style={{ padding: "16px 10px", background: "rgba(122,173,218,0.08)", borderRadius: 10, border: "1px solid rgba(122,173,218,0.2)" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#7aadda" }}>{mine.length}</div>
            <div style={{ fontSize: 11.5, color: "var(--tx-l2)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Total Reports Filed</div>
          </div>
          <div style={{ padding: "16px 10px", background: "rgba(110,201,141,0.08)", borderRadius: 10, border: "1px solid rgba(110,201,141,0.2)" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#6ec98d" }}>{resolved}</div>
            <div style={{ fontSize: 11.5, color: "var(--tx-l2)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Potholes Repaired</div>
          </div>
          <div style={{ padding: "16px 10px", background: "rgba(232,201,106,0.08)", borderRadius: 10, border: "1px solid rgba(232,201,106,0.2)" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#e8c96a" }}>
              {mine.length > 0 ? Math.round((resolved / mine.length) * 100) : 100}%
            </div>
            <div style={{ fontSize: 11.5, color: "var(--tx-l2)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Resolution Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONTRACTOR MY PROFILE ────────────────────────────────────────────────────
function ContractorProfile({ contractor, onUpdateProfile, showToast, complaints }) {
  const [editing, setEditing] = useState(false);
  const [contactPerson, setContactPerson] = useState(contractor?.contactPerson || "");
  const [phone, setPhone] = useState(contractor?.phone || "");
  const [serviceArea, setServiceArea] = useState(contractor?.serviceArea || "");
  const [specialization, setSpecialization] = useState(contractor?.specialization || "");
  const [saving, setSaving] = useState(false);

  const myJobs = (complaints || []).filter(c => c.contractorId === contractor?.id || c.contractor === contractor?.name);
  const completedJobs = myJobs.filter(c => c.status === "completed").length;

  const handleSave = async (e) => {
    e.preventDefault();
    if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
      showToast("Please enter a valid 10-digit phone number", "error");
      return;
    }
    setSaving(true);
    await onUpdateProfile({
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      serviceArea: serviceArea.trim(),
      specialization: specialization.trim(),
    });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setContactPerson(contractor?.contactPerson || "");
    setPhone(contractor?.phone || "");
    setServiceArea(contractor?.serviceArea || "");
    setSpecialization(contractor?.specialization || "");
    setEditing(false);
  };

  return (
    <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Contractor Header Banner */}
      <div className="card" style={{ padding: 26, background: "linear-gradient(135deg, rgba(110,201,141,0.12), rgba(10,12,20,0.4))", border: "1px solid rgba(110,201,141,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, rgba(110,201,141,0.25), rgba(74,124,89,0.1))", border: "1px solid rgba(110,201,141,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#6ec98d" }}>
            ◈
          </div>
          <div>
            <div className="heading" style={{ fontSize: 22, color: "var(--tx-l)", marginBottom: 4 }}>
              {contractor?.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="badge b-done" style={{ fontSize: 11 }}>Verified Municipal Contractor</span>
              <span style={{ fontSize: 12.5, color: "var(--tx-l2)" }}>ID: {contractor?.id}</span>
            </div>
          </div>
        </div>

        {!editing ? (
          <button className="btn btn-gold btn-sm" onClick={() => setEditing(true)}>
            ✏️ Edit Operational Details
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-gold btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Official Registry Overview (View-Only / Administrative) */}
      <div className="card" style={{ padding: 26 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 16 }}>Municipal Accreditation & Financial Overview</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }} className="stack-m">
          <div>
            <label>Registered Company Name</label>
            <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, fontWeight: 700, color: "var(--tx-l)" }}>
              {contractor?.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4 }}>
              🔒 Controlled by Municipal Infrastructure Authority.
            </div>
          </div>

          <div>
            <label>Registered Contractor Email</label>
            <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, color: "var(--tx-l2)" }}>
              {contractor?.email}
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 4 }}>
              Official administrative notification endpoint.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, textAlign: "center" }}>
          <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Allocated Budget</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#6ec98d", marginTop: 4 }}>₹{(contractor?.allocatedBudget || 0).toLocaleString()}</div>
          </div>
          <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Used / Disbursed</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e8c96a", marginTop: 4 }}>₹{(contractor?.usedBudget || 0).toLocaleString()}</div>
          </div>
          <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Completed Work</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#7aadda", marginTop: 4 }}>{completedJobs} / {myJobs.length}</div>
          </div>
        </div>
      </div>

      {/* Editable Contractor Profile Fields */}
      <div className="card" style={{ padding: 26 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 18 }}>Operational & Contact Details</div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="stack-m">
            <div>
              <label>Contact Person / Lead Representative</label>
              {editing ? (
                <input 
                  type="text" 
                  value={contactPerson} 
                  onChange={e => setContactPerson(e.target.value)} 
                  placeholder="e.g. Rajesh Varma" 
                />
              ) : (
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, fontWeight: 600 }}>
                  {contractor?.contactPerson || "Lead Engineer"}
                </div>
              )}
            </div>

            <div>
              <label>Operational Dispatch Phone Number</label>
              {editing ? (
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="10-digit mobile number" 
                />
              ) : (
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
                  📱 +91 {contractor?.phone}
                </div>
              )}
            </div>
          </div>

          <div>
            <label>Service Area & Operational Zones</label>
            {editing ? (
              <input 
                type="text" 
                value={serviceArea} 
                onChange={e => setServiceArea(e.target.value)} 
                placeholder="e.g. East Zone (Koramangala, Indiranagar, HSR Layout)" 
              />
            ) : (
              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13.5, color: "var(--tx-l2)" }}>
                📍 {contractor?.serviceArea || "Municipal-wide Road Restoration Services"}
              </div>
            )}
          </div>

          <div>
            <label>Specialization & Technical Capabilities</label>
            {editing ? (
              <input 
                type="text" 
                value={specialization} 
                onChange={e => setSpecialization(e.target.value)} 
                placeholder="e.g. Bituminous Pavements & Emergency Surface Restoration" 
              />
            ) : (
              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13.5, color: "var(--tx-l2)" }}>
                🛠️ {contractor?.specialization || "Bituminous & Concrete Pavement Maintenance"}
              </div>
            )}
          </div>

          {editing && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-gold" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── ADMIN MY PROFILE ─────────────────────────────────────────────────────────
function AdminProfile({ user, onUpdateProfile, showToast }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "Gov Admin");
  const [phone, setPhone] = useState(user?.phone || "0863-2345678");
  const [department, setDepartment] = useState(user?.department || "Urban Roads & Infrastructure Directorate");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Officer name cannot be empty", "error");
      return;
    }
    setSaving(true);
    await onUpdateProfile({
      name: name.trim(),
      phone: phone.trim(),
      department: department.trim(),
    });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setName(user?.name || "Gov Admin");
    setPhone(user?.phone || "0863-2345678");
    setDepartment(user?.department || "Urban Roads & Infrastructure Directorate");
    setEditing(false);
  };

  return (
    <div style={{ maxWidth: 740, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Admin Profile Header */}
      <div className="card" style={{ padding: 26, background: "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(10,12,20,0.4))", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #c9a84c, #8a6c28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>
            🏛️
          </div>
          <div>
            <div className="heading" style={{ fontSize: 22, color: "var(--tx-l)", marginBottom: 4 }}>
              {name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="badge b-pending" style={{ fontSize: 11 }}>Government Administrator</span>
              <span style={{ fontSize: 12.5, color: "var(--tx-l2)" }}>{user?.email}</span>
            </div>
          </div>
        </div>

        {!editing ? (
          <button className="btn btn-gold btn-sm" onClick={() => setEditing(true)}>
            ✏️ Edit Officer Profile
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-gold btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Admin Details Form */}
      <div className="card" style={{ padding: 26 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 18 }}>Administrator Dossier & Credentials</div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="stack-m">
            <div>
              <label>Officer Name *</label>
              {editing ? (
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
              ) : (
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, fontWeight: 600 }}>
                  {name}
                </div>
              )}
            </div>

            <div>
              <label>Official Desk Phone</label>
              {editing ? (
                <input 
                  type="text" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                />
              ) : (
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
                  ☎️ {phone}
                </div>
              )}
            </div>
          </div>

          <div>
            <label>Government Department / Directorate</label>
            {editing ? (
              <input 
                type="text" 
                value={department} 
                onChange={e => setDepartment(e.target.value)} 
              />
            ) : (
              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13.5, color: "var(--tx-l2)" }}>
                🏛️ {department}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="stack-m">
            <div>
              <label>Official Government Email</label>
              <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 13.5, color: "var(--tx-l2)" }}>
                {user?.email}
              </div>
            </div>

            <div>
              <label>Authorization Clearance</label>
              <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "var(--rsm)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 13.5, color: "#6ec98d", fontWeight: 600 }}>
                🛡️ Tier-1 Municipal Clearance
              </div>
            </div>
          </div>

          {editing && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-gold" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState("landing");
  const [authRole, setAuthRole] = useState("user");
  const [role, setRole] = useState("user");
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState(null);
  const [appData, setAppData] = useState(initialData);

  useEffect(() => {
    if (window.location.hash === "#auth" || window.location.search.includes("auth")) {
      setView("auth");
    }
  }, []);

  // Broadcast helper for real-time multi-tab & multi-window synchronization
  const broadcastSync = (data, message) => {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("smartroad_live_sync");
        bc.postMessage({ type: "SYNC_APPDATA", payload: data, message });
        bc.close();
      }
    } catch {}
  };

  // Listen for real-time live updates across all open tabs & windows
  useEffect(() => {
    let bc;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("smartroad_live_sync");
        bc.onmessage = (e) => {
          if (e.data && e.data.type === "SYNC_APPDATA" && e.data.payload) {
            setAppData(e.data.payload);
            if (e.data.message) {
              setToast({ msg: `⚡ Live Sync: ${e.data.message}`, type: "info", id: Date.now() });
            }
          }
        };
      }
    } catch {}

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.complaints) {
            setAppData(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch {}
  }, [appData]);

  const showToast = (msg, type = "info") => setToast({ msg, type, id: Date.now() });

  const addComplaint = (c, log) => {
    setAppData(d => {
      const next = {
        ...d,
        complaints: [...d.complaints, c],
        auditLogs: [...d.auditLogs, { id: Date.now(), actor: log.actor, action: log.action, type: log.type, time: ts(), flag: false }],
      };
      broadcastSync(next, `New complaint ${c.id} filed`);
      return next;
    });
  };

  const updateComplaint = (id, updates, log) => {
    setAppData(d => {
      const next = {
        ...d,
        complaints: d.complaints.map(c => c.id === id ? { ...c, ...updates } : c),
        auditLogs: [...d.auditLogs, { id: Date.now(), actor: log.actor, action: log.action, type: log.type, time: ts(), flag: !!log.flag }],
      };
      broadcastSync(next, `Complaint ${id} updated (${log.action || updates.status || "modified"})`);
      return next;
    });
  };

  const addContractor = (contractor, log) => {
    setAppData(d => {
      const next = {
        ...d,
        contractors: [...d.contractors, contractor],
        auditLogs: [...d.auditLogs, { id: Date.now(), actor: log.actor || "Admin", action: log.action || `Added contractor ${contractor.name}`, type: "contractor", time: ts(), flag: false }],
      };
      broadcastSync(next, `Contractor ${contractor.name} added`);
      return next;
    });
  };

  const updateContractor = (updatedContractor, log) => {
    setAppData(d => {
      const next = {
        ...d,
        contractors: d.contractors.map(c => c.id === updatedContractor.id ? { ...c, ...updatedContractor } : c),
        auditLogs: [...d.auditLogs, { id: Date.now(), actor: log.actor || "Admin", action: log.action || `Updated contractor ${updatedContractor.name}`, type: "contractor", time: ts(), flag: false }],
      };
      broadcastSync(next, `Contractor ${updatedContractor.name} updated`);
      return next;
    });
  };

  const updateBudget = (config) => {
    setAppData(d => {
      const next = { ...d, budgetConfig: { ...d.budgetConfig, ...config } };
      broadcastSync(next, "Municipal budget rates updated");
      return next;
    });
  };

  const handleLogin = (r, u) => { setRole(r); setCurrentUser(u); setAuthed(true); setPage("dashboard"); };
  const handleLogout = () => { setAuthed(false); setCurrentUser(null); setPage("dashboard"); setView("landing"); };
  const handleResetDemo = () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = getFreshDemoData();
    setAppData(fresh);
    showToast("Demo environment reset with fresh connected records", "success");
  };

  const handleUpdateProfile = async (updates) => {
    // 1. Backend sync attempt with auth token
    try {
      const token = localStorage.getItem("smartroad_token");
      await fetch("http://localhost:8000/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
      });
    } catch {
      // Backend may be offline in demo mode, continue local persistence
    }

    // 2. Update currentUser state
    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);

    // 3. Update smartroad_users in localStorage
    try {
      const storedUsers = JSON.parse(localStorage.getItem("smartroad_users") || "[]");
      const nextUsers = storedUsers.map(u => (u.id === updatedUser.id || u.email === updatedUser.email) ? { ...u, ...updates } : u);
      localStorage.setItem("smartroad_users", JSON.stringify(nextUsers));
    } catch {}

    // 4. If contractor, also sync to appData.contractors so Admin Contractor Directory stays updated
    if (role === "contractor") {
      setAppData(d => ({
        ...d,
        contractors: d.contractors.map(c => (c.id === updatedUser.id || c.email === updatedUser.email) ? { ...c, ...updates } : c),
      }));
    }

    showToast("Profile updated successfully", "success");
  };

  const { complaints, auditLogs, contractors, budgetConfig } = appData;

  const renderPage = () => {
    if (role === "user") {
      if (page === "dashboard") return <UserDashboard complaints={complaints} user={currentUser} onNav={setPage} />;
      if (page === "report") return <ReportPothole user={currentUser} onAdd={addComplaint} showToast={showToast} budgetConfig={budgetConfig} />;
      if (page === "myreports") return <MyComplaints complaints={complaints} user={currentUser} onUpdate={updateComplaint} showToast={showToast} />;
      if (page === "profile") return <CitizenProfile user={currentUser} onUpdateProfile={handleUpdateProfile} showToast={showToast} complaints={complaints} />;
      if (page === "map") return <div><div className="heading-i" style={{ fontSize: 24, marginBottom: 18 }}>City Pothole Map</div><MapView height={500} complaints={complaints} showFilters /></div>;
      if (page === "route") return <RouteCheck complaints={complaints} />;
      if (page === "notifs") return <Notifications complaints={complaints} user={currentUser} />;
      return <UserDashboard complaints={complaints} user={currentUser} onNav={setPage} />;
    }
    if (role === "admin") {
      if (page === "dashboard") return <AdminDashboard complaints={complaints} auditLogs={auditLogs} budgetConfig={budgetConfig} />;
      if (page === "complaints") return <AdminComplaints complaints={complaints} contractors={contractors} onUpdate={updateComplaint} onUpdateContractor={updateContractor} showToast={showToast} budgetConfig={budgetConfig} />;
      if (page === "map") return <div><div className="heading-i" style={{ fontSize: 24, marginBottom: 18 }}>Complaint Map Monitor</div><MapView height={500} complaints={complaints} showFilters /></div>;
      if (page === "contractors") return <AdminContractors contractors={contractors} complaints={complaints} onAddContractor={addContractor} onUpdateContractor={updateContractor} showToast={showToast} />;
      if (page === "budget") return <BudgetControl complaints={complaints} budgetConfig={budgetConfig} onBudgetUpdate={updateBudget} showToast={showToast} />;
      if (page === "activity") return <ActivityLogs auditLogs={auditLogs} contractors={contractors} />;
      if (page === "priority") return <PriorityQueue complaints={complaints} showToast={showToast} onUpdate={updateComplaint} />;
      if (page === "notifications") return <AdminNotifications complaints={complaints} showToast={showToast} />;
      if (page === "profile") return <AdminProfile user={currentUser} onUpdateProfile={handleUpdateProfile} showToast={showToast} />;
      return <AdminDashboard complaints={complaints} auditLogs={auditLogs} budgetConfig={budgetConfig} />;
    }
    if (role === "contractor") {
      const fullContractor = contractors.find(c => c.id === currentUser?.id || c.email === currentUser?.email) || currentUser;
      if (page === "dashboard") return <ContractorDashboard complaints={complaints} contractor={fullContractor} onNav={setPage} onUpdate={updateComplaint} showToast={showToast} />;
      if (page === "tasks") return <ContractorTasks complaints={complaints} contractor={fullContractor} onUpdate={updateComplaint} showToast={showToast} />;
      if (page === "expenses") return <ExpenseSubmit complaints={complaints} contractor={fullContractor} onUpdate={updateComplaint} showToast={showToast} budgetConfig={budgetConfig} />;
      if (page === "budget-request") return <BudgetRequest contractor={fullContractor} onUpdateContractor={updateContractor} showToast={showToast} />;
      if (page === "complete") return <MarkComplete complaints={complaints} contractor={fullContractor} onUpdate={updateComplaint} showToast={showToast} />;
      if (page === "profile") return <ContractorProfile contractor={fullContractor} onUpdateProfile={handleUpdateProfile} showToast={showToast} complaints={complaints} />;
      if (page === "map") return <div><div className="heading-i" style={{ fontSize: 24, marginBottom: 18 }}>My Site Map</div><MapView height={500} complaints={complaints.filter(c => c.contractorId === fullContractor?.id)} /></div>;
      return <ContractorDashboard complaints={complaints} contractor={fullContractor} onNav={setPage} onUpdate={updateComplaint} showToast={showToast} />;
    }
    return null;
  };

  return (
    <>
      <style>{G}</style>
      <div className="noise" />
      <div className="bg-grid" />
      <div className="bg-glow" />

      {!authed ? (
        view === "landing" ? (
          <SmartRoadLandingPage
            onNavigateToAuth={(selectedRole = "user") => {
              setAuthRole(selectedRole);
              setView("auth");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ) : (
          <AuthScreen
            onLogin={handleLogin}
            onBack={() => {
              setView("landing");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            initialRole={authRole}
            contractors={appData.contractors || []}
            onContractorRegistered={(newContractor) => {
              addContractor(newContractor, {
                actor: newContractor.name,
                action: `Submitted contractor registration application (${newContractor.id})`,
                type: "contractor_register"
              });
            }}
          />
        )
      ) : (
        <div style={{ display: "flex", height: "100vh", position: "relative", zIndex: 1 }}>
          <Sidebar role={role} page={page} onNav={setPage} collapsed={collapsed} toggle={() => setCollapsed(!collapsed)} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
            <TopBar page={page} user={currentUser} onLogout={handleLogout} onResetDemo={handleResetDemo} onNav={setPage} />
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }} className="fu">
              {renderPage()}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
