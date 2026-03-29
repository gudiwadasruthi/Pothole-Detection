import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_CREDS = { email: "admin@smartroad.gov.in", password: "admin123" };
const CONTRACTOR_ACCOUNTS = [
  { id: "CON1", email: "rajesh@constructions.com", password: "rajesh123", name: "Rajesh Constructions", phone: "9876543210" },
  { id: "CON2", email: "sharma@infra.com", password: "sharma123", name: "Sharma Infra", phone: "9845678901" },
  { id: "CON3", email: "mnr@roads.com", password: "mnr123", name: "MNR Roads", phone: "9823456789" },
];
const STORAGE_KEY = "smartroad_data_v2";
const initialData = () => {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch { }
  return {
    complaints: [],
    auditLogs: [],
    contractors: CONTRACTOR_ACCOUNTS.map(c => ({ ...c, active: true })),
    budgetConfig: { total: 500000, rates: { cement: 450, sand: 180, aggregate: 320, labor: 850 } }
  };
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
    --tx-d2: rgba(10,12,20,0.62);
    --tx-d3: rgba(10,12,20,0.38);
    --tx-l: #f2f0eb;
    --tx-l2: rgba(242,240,235,0.62);
    --tx-l3: rgba(242,240,235,0.35);

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
  body { font-family: var(--fb); background: var(--ink); color: var(--tx-l); overflow-x: hidden; -webkit-font-smoothing: antialiased; }
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
    padding: 2px 9px; border-radius: 99px;
    font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .b-pending { background: rgba(201,168,76,0.14); color: var(--gold2); border: 1px solid rgba(201,168,76,0.25); }
  .b-progress { background: rgba(61,90,122,0.2); color: #7aadda; border: 1px solid rgba(61,90,122,0.35); }
  .b-done { background: rgba(74,124,89,0.18); color: #6ec98d; border: 1px solid rgba(74,124,89,0.3); }
  .b-reject { background: rgba(192,82,42,0.15); color: #e8835c; border: 1px solid rgba(192,82,42,0.28); }
  .b-reopen { background: rgba(92,74,138,0.2); color: #a48fd4; border: 1px solid rgba(92,74,138,0.3); }
  .b-assigned { background: rgba(61,90,122,0.15); color: #8ab4d4; border: 1px solid rgba(61,90,122,0.25); }
  .b-high { background: rgba(192,82,42,0.15); color: #e8835c; border: 1px solid rgba(192,82,42,0.25); }
  .b-medium { background: rgba(201,168,76,0.14); color: var(--gold2); border: 1px solid rgba(201,168,76,0.22); }
  .b-low { background: rgba(74,124,89,0.15); color: #6ec98d; border: 1px solid rgba(74,124,89,0.25); }

  /* INPUTS */
  input, textarea, select {
    width: 100%; padding: 10px 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: var(--rsm);
    color: var(--tx-l); font-family: var(--fb); font-size: 13.5px;
    outline: none; transition: all 0.2s;
  }
  input:focus, textarea:focus, select:focus {
    border-color: rgba(201,168,76,0.5);
    background: rgba(201,168,76,0.06);
    box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
  }
  input::placeholder, textarea::placeholder { color: var(--tx-l3); }
  select option { background: #181c2a; }
  label { font-size: 12px; color: var(--tx-l2); font-weight: 600; display: block; margin-bottom: 6px; letter-spacing: 0.04em; text-transform: uppercase; }

  /* DIVIDER */
  .divider { height: 1px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent); }

  /* NAV */
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 8px;
    font-size: 13px; font-weight: 500; color: var(--tx-l3);
    cursor: pointer; transition: all 0.2s;
    border: 1px solid transparent;
  }
  .nav-item:hover { background: rgba(255,255,255,0.05); color: var(--tx-l2); }
  .nav-item.active {
    background: linear-gradient(135deg, rgba(201,168,76,0.14), rgba(201,168,76,0.06));
    border-color: rgba(201,168,76,0.2);
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
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    text-align: left; padding: 10px 14px;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--tx-l3); border-bottom: 1px solid rgba(255,255,255,0.06);
    font-weight: 700; font-family: var(--fb);
  }
  tbody td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
  tbody tr:hover td { background: rgba(255,255,255,0.025); }
  tbody tr:last-child td { border-bottom: none; }

  /* FILTER CHIPS */
  .chip {
    padding: 5px 13px; border-radius: 99px; font-size: 11.5px;
    font-weight: 600; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--tx-l3); transition: all 0.2s;
    background: transparent; letter-spacing: 0.02em;
  }
  .chip.on { background: rgba(201,168,76,0.14); border-color: rgba(201,168,76,0.3); color: var(--gold2); }
  .chip:hover { border-color: rgba(255,255,255,0.2); color: var(--tx-l2); }

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
      <div className="heading" style={{ fontSize: 28, fontWeight: 600, color: "var(--tx-l)", lineHeight: 1, marginBottom: 4 }}>{val}</div>
      <div style={{ fontSize: 11, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 4 }}>{sub}</div>}
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
function MapView({ height = 400, complaints = [], showFilters = false }) {
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

  const center = [BASE_LAT, BASE_LNG];

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
          center={center}
          zoom={14}
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
              <svg width="10" height="13" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill={col} /><circle cx="14" cy="14" r="5.5" fill="rgba(255,255,255,0.8)" /></svg>
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

  const scan = async () => {
    if (!description.trim()) return;
    setStage("scanning");
    // Simulate AI analysis (backend handles real call)
    await new Promise(r => setTimeout(r, 2400));
    const detected = description.length > 20;
    const confidence = Math.floor(72 + Math.random() * 24);
    const r = {
      detected,
      confidence,
      area_sqm: detected ? `~${(0.8 + Math.random() * 1.5).toFixed(1)} m²` : "N/A",
      depth_cm: detected ? `~${Math.floor(8 + Math.random() * 18)} cm` : "N/A",
      severity: confidence > 88 ? "high" : confidence > 74 ? "medium" : "low",
      ai_notes: detected
        ? `Surface fracturing consistent with prolonged water ingress. Estimated structural damage: ${confidence > 85 ? "significant" : "moderate"}.`
        : "Described area does not meet pothole classification threshold. Consider retaking in better lighting.",
    };
    setResult(r);
    setStage("result");
    onResult(r.detected, r);
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>◈</div>
        <div>
          <div className="heading" style={{ fontSize: 15, fontWeight: 600 }}>AI Pre-Validation</div>
          <div style={{ fontSize: 11, color: "var(--tx-l3)" }}>Claude Sonnet analysis</div>
        </div>
        <span className="badge b-progress" style={{ marginLeft: "auto" }}>Active</span>
      </div>

      {stage === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="upload-z">
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>⬆</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Upload Photo</div>
            <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>GPS metadata auto-extracted</div>
          </div>
          <div>
            <label>Describe the damage</label>
            <textarea
              placeholder="e.g. Deep pothole near the junction with standing water, approximately 1 metre across…"
              rows={2} value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </div>
          <button className="btn btn-gold btn-sm" onClick={scan} disabled={!description.trim()} style={{ alignSelf: "flex-start" }}>
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
function AuthScreen({ onLogin }) {
  const [role, setRole] = useState("user");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = () => {
    setErr(""); setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (role === "admin") {
        if (form.email === ADMIN_CREDS.email && form.password === ADMIN_CREDS.password) onLogin(role, { name: "Gov Admin", email: form.email });
        else setErr("Invalid admin credentials.");
        return;
      }
      if (role === "contractor") {
        const c = CONTRACTOR_ACCOUNTS.find(x => x.email === form.email && x.password === form.password);
        if (c) onLogin(role, c);
        else setErr("Invalid contractor credentials.");
        return;
      }
      const users = JSON.parse(localStorage.getItem("smartroad_users") || "[]");
      if (tab === "login") {
        const u = users.find(x => x.email === form.email && x.password === form.password);
        if (u) onLogin("user", u);
        else setErr("Invalid credentials.");
      } else {
        if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
        if (users.find(x => x.email === form.email)) { setErr("Email already registered."); return; }
        const u = { id: "USR" + Date.now(), name: form.name, email: form.email, password: form.password };
        localStorage.setItem("smartroad_users", JSON.stringify([...users, u]));
        onLogin("user", u);
      }
    }, 900);
  };

  const hints = {
    admin: "admin@smartroad.gov.in · admin123",
    contractor: "rajesh@constructions.com · rajesh123"
  };

  const roleConfig = {
    user: { icon: "⬡", label: "Citizen", sub: "Report & track road damage" },
    admin: { icon: "⬢", label: "Admin", sub: "Government oversight portal" },
    contractor: { icon: "◈", label: "Contractor", sub: "Task & expense dashboard" },
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", position: "relative", zIndex: 1 }}>
      <div className="bg-grid" /><div className="bg-glow" />

      {/* Left panel */}
      <div className="hide-m" style={{ width: "42%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 52px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
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
            {[["◈ AI-powered detection", "Claude analyses every pothole report for validity"],
            ["⬡ Real-time accountability", "Every action logged on immutable audit trail"],
            ["⬢ Smart budget control", "Automated fund locking and release on verification"]
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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420 }} className="fu">

          {/* Role selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 28, background: "rgba(255,255,255,0.03)", padding: 5, borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["user", "admin", "contractor"]).map(r => {
              const c = roleConfig[r];
              return (
                <button key={r} onClick={() => { setRole(r); setErr(""); setTab("login"); }}
                  style={{ flex: 1, padding: "10px 6px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--fb)", fontSize: 12, transition: "all 0.2s", background: role === r ? "rgba(201,168,76,0.16)" : "transparent", color: role === r ? "var(--gold2)" : "var(--tx-l3)" }}>
                  <div style={{ fontSize: 18, marginBottom: 3 }}>{c.icon}</div>
                  <div style={{ fontWeight: 700 }}>{c.label}</div>
                </button>
              );
            })}
          </div>

          <div className="heading-i" style={{ fontSize: 30, marginBottom: 6 }}>
            {role === "user" ? (tab === "login" ? "Welcome back" : "Join SmartRoad") : role === "admin" ? "Admin portal" : "Contractor hub"}
          </div>
          <div style={{ fontSize: 13, color: "var(--tx-l3)", marginBottom: 26 }}>{roleConfig[role].sub}</div>

          {/* Tab switcher for user */}
          {role === "user" && (
            <div style={{ display: "flex", gap: 0, marginBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["login", "signup"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fb)", fontSize: 13, fontWeight: 600, color: tab === t ? "var(--gold2)" : "var(--tx-l3)", borderBottom: `2px solid ${tab === t ? "var(--gold)" : "transparent"}`, marginBottom: -1, transition: "all 0.2s" }}>
                  {t === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {role === "user" && tab === "signup" && <div><label>Full Name</label><input placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>}
            <div><label>Email</label><input type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            {role === "user" && tab === "signup" && <div><label>Confirm Password</label><input type="password" placeholder="••••••••" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} /></div>}
          </div>

          {err && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 9, background: "rgba(192,82,42,0.1)", border: "1px solid rgba(192,82,42,0.25)", fontSize: 13, color: "#e8835c" }}>{err}</div>}
          {(role === "admin" || role === "contractor") && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 9, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", fontSize: 12, color: "var(--tx-l3)" }}>
              Demo — {hints[role]}
            </div>
          )}

          <button className="btn btn-gold btn-lg" style={{ width: "100%", marginTop: 22, justifyContent: "center" }} onClick={handleSubmit} disabled={loading}>
            {loading ? <><Spinner />Authenticating…</> : role === "user" ? (tab === "login" ? "Sign In →" : "Create Account →") : "Enter Portal →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ role, page, onNav, collapsed, toggle }) {
  const menus = {
    user: [{ id: "dashboard", ic: "⬡", lb: "Dashboard" }, { id: "report", ic: "◈", lb: "Report Pothole" }, { id: "myreports", ic: "≡", lb: "My Complaints" }, { id: "map", ic: "⊞", lb: "Map View" }, { id: "route", ic: "→", lb: "Route Check" }, { id: "notifs", ic: "◉", lb: "Notifications" }],
    admin: [{ id: "dashboard", ic: "⬡", lb: "Dashboard" }, { id: "complaints", ic: "≡", lb: "All Complaints" }, { id: "map", ic: "⊞", lb: "Map Monitor" }, { id: "contractors", ic: "◈", lb: "Contractors" }, { id: "budget", ic: "⬢", lb: "Budget" }, { id: "activity", ic: "⌘", lb: "Activity Logs" }, { id: "priority", ic: "⚡", lb: "Priority Queue" }],
    contractor: [{ id: "dashboard", ic: "⬡", lb: "Dashboard" }, { id: "tasks", ic: "≡", lb: "My Tasks" }, { id: "expenses", ic: "⬢", lb: "Expenses" }, { id: "complete", ic: "✓", lb: "Mark Complete" }, { id: "map", ic: "⊞", lb: "Site Map" }],
  };

  const roleColors = { user: "#7aadda", admin: "#e8c96a", contractor: "#6ec98d" };
  const roleLabels = { user: "Citizen Portal", admin: "Gov. Admin", contractor: "Contractor Hub" };

  return (
    <div style={{ width: collapsed ? 56 : 210, transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)", height: "100vh", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.06)", padding: collapsed ? "12px 8px" : "16px 10px", position: "relative", zIndex: 10, background: "rgba(10,12,20,0.95)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28, overflow: "hidden", paddingLeft: collapsed ? 0 : 4 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${roleColors[role]}22,${roleColors[role]}0a)`, border: `1px solid ${roleColors[role]}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: roleColors[role], flexShrink: 0 }}>⬡</div>
        {!collapsed && <div>
          <div className="heading" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>SmartRoad</div>
          <div style={{ fontSize: 10, color: "var(--tx-l3)", whiteSpace: "nowrap" }}>{roleLabels[role]}</div>
        </div>}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {menus[role].map(item => (
          <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => onNav(item.id)} title={collapsed ? item.lb : ""} style={{ justifyContent: collapsed ? "center" : "flex-start", paddingLeft: collapsed ? 0 : 12 }}>
            <span className="nav-ic" style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{item.ic}</span>
            {!collapsed && <span style={{ fontSize: 13 }}>{item.lb}</span>}
          </div>
        ))}
      </div>

      <div className="divider" style={{ marginBottom: 12 }} />
      <button onClick={toggle} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "7px 0", cursor: "pointer", color: "var(--tx-l3)", fontSize: 13, width: "100%" }}>
        {collapsed ? "→" : "←"}
      </button>
    </div>
  );
}

// ─── TOPBAR ────────────────────────────────────────────────────────────────────
function TopBar({ page, user, onLogout }) {
  const titles = { dashboard: "Dashboard", report: "Report a Pothole", myreports: "My Complaints", map: "Map View", route: "Route Check", notifs: "Notifications", complaints: "All Complaints", contractors: "Contractors", budget: "Budget Control", activity: "Activity Logs", priority: "Priority Queue", tasks: "My Tasks", expenses: "Submit Expenses", complete: "Mark Complete" };
  return (
    <div style={{ height: 56, display: "flex", alignItems: "center", paddingInline: 22, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, gap: 12 }}>
      <div style={{ flex: 1 }}>
        <h1 className="heading" style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-l)" }}>{titles[page] || page}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: "rgba(74,124,89,0.12)", border: "1px solid rgba(74,124,89,0.2)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ec98d", boxShadow: "0 0 6px #6ec98d" }} />
          <span style={{ fontSize: 11, color: "#6ec98d", fontWeight: 600 }}>Live</span>
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.07)" }} />
        <span style={{ fontSize: 12.5, color: "var(--tx-l3)" }} className="hide-m">{user?.name || user?.email}</span>
        <button onClick={onLogout} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Logout</button>
      </div>
    </div>
  );
}

// ─── USER DASHBOARD ───────────────────────────────────────────────────────────
function UserDashboard({ complaints, user, onNav }) {
  const mine = complaints.filter(c => c.reportedById === user?.id || c.reportedBy === user?.name || c.reportedBy === user?.email);
  const counts = {
    total: mine.length,
    pending: mine.filter(c => c.status === "pending").length,
    inprog: mine.filter(c => ["in_progress", "assigned"].includes(c.status)).length,
    done: mine.filter(c => c.status === "completed").length,
    reopen: mine.filter(c => c.status === "reopened").length,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        <StatCard icon="≡" val={counts.total} label="Total Reports" accent="#7aadda" />
        <StatCard icon="◎" val={counts.pending} label="Pending" accent="#e8c96a" />
        <StatCard icon="⚙" val={counts.inprog} label="In Progress" accent="#7aadda" />
        <StatCard icon="✓" val={counts.done} label="Completed" accent="#6ec98d" />
        <StatCard icon="↺" val={counts.reopen} label="Reopened" accent="#a48fd4" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="stack-m">
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Recent Reports</div>
          {mine.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "var(--tx-l3)" }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>○</div>
              <div style={{ fontSize: 13, marginBottom: 12 }}>No reports submitted yet</div>
              <button className="btn btn-gold btn-sm" onClick={() => onNav("report")}>Report your first pothole</button>
            </div>
          ) : mine.slice(0, 5).map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "var(--tx-l3)" }}>◉</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 1 }}>{c.date}</div>
              </div>
              <SBadge s={c.status} />
            </div>
          ))}
          {mine.length > 0 && <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={() => onNav("myreports")}>View All →</button>}
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 15, marginBottom: 14 }}>City Map</div>
          <MapView height={215} complaints={complaints} />
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 14 }}>Quick Actions</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-gold" onClick={() => onNav("report")}>◈ Report New Pothole</button>
          <button className="btn btn-ghost" onClick={() => onNav("route")}>→ Check My Route</button>
          <button className="btn btn-ghost" onClick={() => onNav("map")}>⊞ Full Map</button>
        </div>
      </div>
    </div>
  );
}

// ─── REPORT POTHOLE ────────────────────────────────────────────────────────────
function ReportPothole({ user, onAdd, showToast, budgetConfig }) {
  const [step, setStep] = useState(1);
  const [aiResult, setAiResult] = useState(null);
  const [forceSubmit, setForceSubmit] = useState(false);
  const [form, setForm] = useState({ title: "", area: "", severity: "medium", desc: "", lat: "", lng: "" });
  const [costEst, setCostEst] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAI = (detected, res, force = false) => {
    setAiResult(res);
    if (force) setForceSubmit(true);
    if (detected && res?.severity) setForm(f => ({ ...f, severity: res.severity }));
  };

  const doEstimate = async () => {
    setEstimating(true);
    await new Promise(r => setTimeout(r, 1600));
    const base = form.severity === "high" ? 18000 : form.severity === "medium" ? 9500 : 4500;
    const jitter = 0.85 + Math.random() * 0.3;
    const est = Math.floor(base * jitter);
    setCostEst({
      estimated_cost: est,
      breakdown: { cement: Math.floor(est * 0.28), sand: Math.floor(est * 0.14), aggregate: Math.floor(est * 0.26), labor: Math.floor(est * 0.32) },
      days_estimate: form.severity === "high" ? 3 : form.severity === "medium" ? 2 : 1,
      notes: "Based on current material rates and AI-estimated damage area.",
    });
    setEstimating(false);
  };

  const submit = () => {
    setSubmitting(true);
    const newC = {
      id: uid(), title: form.title || "Untitled Report", area: form.area,
      severity: form.severity, desc: form.desc, status: "pending",
      reportedBy: user?.name || user?.email, reportedById: user?.id,
      date: now(),
      cost: costEst?.estimated_cost || (form.severity === "high" ? 18000 : form.severity === "medium" ? 9500 : 4500),
      aiData: aiResult, costBreakdown: costEst,
      lat: form.lat, lng: form.lng, contractor: null,
      timeline: [{ action: "Complaint filed", actor: user?.name, time: ts() }],
    };
    setTimeout(() => {
      onAdd(newC, { actor: user?.name, action: `Filed complaint ${newC.id}`, type: "report" });
      setSubmitting(false);
      setSubmitted(true);
      showToast(`Complaint ${newC.id} submitted`, "success");
    }, 900);
  };

  if (submitted) return (
    <div className="card" style={{ padding: 44, textAlign: "center", maxWidth: 480 }}>
      <div style={{ fontSize: 44, marginBottom: 14 }} className="float">✓</div>
      <div className="heading" style={{ fontSize: 22, marginBottom: 8 }}>Complaint Submitted</div>
      <div style={{ color: "var(--tx-l3)", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>Your report has been logged on the immutable audit trail. You'll be notified as the status changes.</div>
      <button className="btn btn-gold" onClick={() => { setSubmitted(false); setStep(1); setAiResult(null); setForceSubmit(false); setForm({ title: "", area: "", severity: "medium", desc: "", lat: "", lng: "" }); setCostEst(null); }}>
        ◈ Report Another
      </button>
    </div>
  );

  const stepLabels = ["AI Scan", "Details", "Location"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 6 }}>
        {stepLabels.map((lb, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${step > i ? "var(--gold)" : step === i + 1 ? "var(--gold2)" : "rgba(255,255,255,0.12)"}`, background: step > i ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: step > i ? "var(--ink)" : step === i + 1 ? "var(--gold2)" : "var(--tx-l3)", transition: "all 0.3s" }}>
                {step > i ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: step === i + 1 ? "var(--tx-l)" : "var(--tx-l3)" }}>{lb}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? "var(--gold)" : "rgba(255,255,255,0.07)", margin: "0 10px", transition: "all 0.5s" }} />}
          </div>
        ))}
      </div>

      {/* Step 1: AI Scan */}
      {step === 1 && (
        <div className="card" style={{ padding: 24 }}>
          <AIValidation onResult={handleAI} />
          {(aiResult?.detected || forceSubmit) && (
            <button className="btn btn-gold" onClick={() => setStep(2)}>
              {forceSubmit ? "⚠ Continue (Manual Override) →" : "Continue to Details →"}
            </button>
          )}
        </div>
      )}

      {/* Step 2: Details */}
      {step >= 2 && (
        <div className="card" style={{ padding: 24 }} className="fu card">
          <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Complaint Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1/-1" }}><label>Title *</label><input placeholder="e.g. Deep pothole near MG Road Junction" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Area</label><input placeholder="e.g. Sector 12" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
            <div><label>Severity</label>
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                <option value="low">Low — Minor inconvenience</option>
                <option value="medium">Medium — Significant damage</option>
                <option value="high">High — Dangerous / Urgent</option>
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}><label>Description</label><textarea placeholder="Describe size, depth, safety risk…" rows={3} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
          </div>

          {/* Cost estimation */}
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={doEstimate} disabled={estimating || !form.desc}>
              {estimating ? <><Spinner />Estimating…</> : "⬢ AI Cost Estimate"}
            </button>
            {costEst && <span style={{ fontSize: 13, color: "#6ec98d", fontWeight: 700 }}>₹{costEst.estimated_cost?.toLocaleString()} · {costEst.days_estimate} day{costEst.days_estimate > 1 ? "s" : ""}</span>}
          </div>

          {costEst && (
            <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 11, background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.2)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#6ec98d" }}>Cost Breakdown</div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "var(--tx-l2)" }}>
                {Object.entries(costEst.breakdown || {}).map(([k, v]) => (
                  <div key={k}><span style={{ color: "var(--tx-l3)" }}>{k}: </span><b>₹{Math.floor(v).toLocaleString()}</b></div>
                ))}
              </div>
              {costEst.notes && <div style={{ marginTop: 7, fontSize: 11.5, color: "var(--tx-l3)", lineHeight: 1.5 }}>{costEst.notes}</div>}
            </div>
          )}

          <button className="btn btn-gold" style={{ marginTop: 18 }} onClick={() => setStep(3)}>Next: Location →</button>
        </div>
      )}

      {/* Step 3: Location */}
      {step >= 3 && (
        <div className="card fu" style={{ padding: 24 }}>
          <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Geo-Tag Location</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><label>Latitude</label><input placeholder="Auto-detected" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></div>
            <div><label>Longitude</label><input placeholder="Auto-detected" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                pos => setForm({ ...form, lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }),
                () => setForm({ ...form, lat: BASE_LAT.toFixed(5), lng: BASE_LNG.toFixed(5) })
              );
            } else {
              setForm({ ...form, lat: BASE_LAT.toFixed(5), lng: BASE_LNG.toFixed(5) });
            }
          }}>◉ Use Current GPS</button>
          <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.18)", fontSize: 12, color: "#6ec98d", marginBottom: 16 }}>
            ⬡ This report will be immutable once submitted
          </div>
          <button className="btn btn-gold btn-lg" onClick={submit} disabled={submitting || !form.title}>
            {submitting ? <><Spinner />Submitting…</> : "Submit Complaint →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MY COMPLAINTS ─────────────────────────────────────────────────────────────
function MyComplaints({ complaints, user, onUpdate, showToast }) {
  const mine = complaints.filter(c => c.reportedById === user?.id || c.reportedBy === user?.email || c.reportedBy === user?.name);
  const [expanded, setExpanded] = useState(null);
  const [verifyModal, setVerifyModal] = useState(null);
  const [reason, setReason] = useState("");

  const handleVerify = (c, action) => {
    if (action === "accept") {
      onUpdate(c.id, { verified: "verified" }, { actor: user?.name, action: `Verified completion of ${c.id}`, type: "verify" });
      showToast("Solution accepted — marked complete", "success");
    } else if (action === "ignore") {
      onUpdate(c.id, { verified: "unverified" }, { actor: user?.name, action: `Skipped verification for ${c.id}`, type: "verify" });
      showToast("Skipped verification", "info");
    } else if (action === "reopen") {
      onUpdate(c.id, { status: "reopened", severity: "high", verified: null, reopenReason: reason, timeline: [...(c.timeline || []), { action: "Reopened: " + reason, actor: user?.name, time: ts() }] }, { actor: user?.name, action: `Re-complaint ${c.id}: ${reason}`, type: "reopen", flag: true });
      showToast("Re-complaint raised → High Priority", "warning");
    }
    setVerifyModal(null); setReason("");
  };

  if (!mine.length) return (
    <div className="card" style={{ padding: 44, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>≡</div>
      <div className="heading" style={{ fontSize: 18, marginBottom: 6 }}>No complaints yet</div>
      <div style={{ color: "var(--tx-l3)", fontSize: 13 }}>Your submitted complaints appear here</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mine.map((c, i) => (
        <div key={c.id} className="card" style={{ padding: 20, cursor: "pointer", animationDelay: `${i * 0.04}s` }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>◉</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span className="heading" style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</span>
                <span style={{ fontSize: 11, color: "var(--tx-l3)", fontFamily: "monospace" }}>#{c.id}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>⊞ {c.area} · {c.date}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                <SBadge s={c.status} /><SevBadge s={c.severity} />{c.verified && <VBadge s={c.verified} />}
              </div>
            </div>
            <span style={{ color: "var(--tx-l3)", fontSize: 14, transition: "transform 0.3s", transform: expanded === c.id ? "rotate(180deg)" : "none", display: "inline-block", marginTop: 2 }}>⌄</span>
          </div>

          {expanded === c.id && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", animation: "fadeUp 0.25s ease" }} onClick={e => e.stopPropagation()}>
              {(c.timeline || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-l3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Timeline</div>
                  <div className="tline">
                    {(c.timeline || []).map((tl, idx) => (
                      <div key={idx} style={{ position: "relative", paddingBottom: 12 }}>
                        <div className="tl-dot" />
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{tl.action}</div>
                        <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 2 }}>{tl.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {c.contractor && <div style={{ fontSize: 13, marginBottom: 12, color: "var(--tx-l2)" }}>
                Contractor: <b style={{ color: "var(--tx-l)" }}>{c.contractor}</b>
                {c.budget && <> · Budget: <b style={{ color: "#6ec98d" }}>₹{c.budget.toLocaleString()}</b></>}
              </div>}
              {c.status === "completed" && !c.verified && (
                <div style={{ padding: "16px 18px", borderRadius: 11, background: "rgba(61,90,122,0.1)", border: "1px solid rgba(61,90,122,0.2)" }}>
                  <div className="heading" style={{ fontSize: 14, marginBottom: 6 }}>Verify Repair Quality</div>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)", marginBottom: 12 }}>The contractor has marked this complete. Was the repair satisfactory?</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleVerify(c, "accept")}>✓ Accept Repair</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setVerifyModal(c)}>✗ Reject</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleVerify(c, "ignore")}>Skip Verification</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {verifyModal && (
        <div className="modal-ov" onClick={e => e.target === e.currentTarget && setVerifyModal(null)}>
          <div className="modal-box">
            <div className="modal-inner">
              <div className="heading" style={{ fontSize: 19, marginBottom: 18 }}>Reject Solution</div>
              <div className="card" style={{ padding: 18, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>↺ Raise Re-Complaint</div>
                <div style={{ fontSize: 12, color: "var(--tx-l3)", marginBottom: 12 }}>This will escalate to High Priority with admin notification.</div>
                <div style={{ marginBottom: 10 }}><label>Reason *</label><textarea placeholder="Why is the repair unsatisfactory?" rows={2} value={reason} onChange={e => setReason(e.target.value)} /></div>
                <div className="upload-z" style={{ padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>◈ Upload Geo-Tagged Proof</div>
                </div>
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
  const nearby = complaints.filter(c => c.status !== "completed" && c.status !== "rejected");

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="heading" style={{ fontSize: 16, marginBottom: 18 }}>Route Pothole Awareness</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div><label>From</label><input placeholder="e.g. Sector 1 Main Gate" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label>To</label><input placeholder="e.g. City Bus Stand" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <button className="btn btn-gold" onClick={() => setChecked(true)} disabled={!from || !to}>Check Route →</button>
      </div>

      {checked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} className="fu">
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 16, color: "#e8835c" }}>⚠</span>
              <span className="heading" style={{ fontSize: 14 }}>{nearby.length} active issue{nearby.length !== 1 ? "s" : ""} on city roads</span>
            </div>
            <MapView height={210} complaints={complaints} />
          </div>
          {nearby.slice(0, 6).map(c => (
            <div key={c.id} className="card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: c.severity === "high" ? "#e8835c" : c.severity === "medium" ? "#e8c96a" : "#6ec98d" }} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div><div style={{ fontSize: 11, color: "var(--tx-l3)" }}>{c.area}</div></div>
              <SevBadge s={c.severity} /><SBadge s={c.status} />
            </div>
          ))}
          {!nearby.length && <div className="card" style={{ padding: 20, textAlign: "center", color: "#6ec98d", fontSize: 13 }}>✓ No active issues on city roads</div>}
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
      <div style={{ color: "var(--tx-l3)", fontSize: 13 }}>No notifications yet. Updates appear as your complaints change status.</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 10 }}>
      {notifs.map((n, i) => (
        <div key={n.id + i} className="card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${n.color}18`, border: `1px solid ${n.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: n.color, flexShrink: 0 }}>{n.icon}</div>
          <div style={{ flex: 1 }}>
            <div className="heading" style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{n.title}</div>
            <div style={{ fontSize: 12, color: "var(--tx-l3)", marginBottom: 4, lineHeight: 1.5 }}>{n.msg}</div>
            <div style={{ fontSize: 11, color: "var(--tx-l3)", opacity: 0.6 }}>{n.time}</div>
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
        <StatCard icon="↺" val={counts.reopen} label="Reopened" accent="#a48fd4" />
        <StatCard icon="⚠" val={counts.flags} label="Flagged" accent="#e8835c" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="stack-m">
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 15, marginBottom: 18 }}>Budget Overview</div>
          {[
            ["Total Budget", `₹${(budgetConfig.total / 1000).toFixed(0)}K`, 100, "#7aadda"],
            ["Allocated", `₹${(allocated / 1000).toFixed(1)}K`, Math.min(allocated / budgetConfig.total * 100, 100), "#e8c96a"],
            ["Spent", `₹${(spent / 1000).toFixed(1)}K`, Math.min(spent / budgetConfig.total * 100, 100), "#e8835c"],
            ["Remaining", `₹${((budgetConfig.total - allocated) / 1000).toFixed(1)}K`, Math.max((budgetConfig.total - allocated) / budgetConfig.total * 100, 0), "#6ec98d"],
          ].map(([l, v, p, c]) => (
            <div key={l} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--tx-l3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11 }}>{l}</span>
                <span style={{ fontWeight: 700, color: c }}>{v}</span>
              </div>
              <div className="pbar"><div className="pfill" style={{ width: `${p}%`, background: `linear-gradient(90deg,${c}90,${c})` }} /></div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Quick Stats</div>
          {[
            ["High Priority", complaints.filter(c => c.severity === "high").length, "#e8835c"],
            ["Fraud Flags", counts.flags, counts.flags > 0 ? "#e8835c" : "#6ec98d"],
            ["Avg. Cost", complaints.length > 0 ? "₹" + Math.floor(complaints.reduce((s, c) => s + (c.cost || 0), 0) / complaints.length).toLocaleString() : "—", "var(--tx-l)"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <span style={{ color: "var(--tx-l3)" }}>{l}</span>
              <span style={{ fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div className="heading" style={{ fontSize: 15, marginBottom: 14 }}>City Map</div>
        <MapView height={280} complaints={complaints} showFilters />
      </div>
    </div>
  );
}

// ─── ADMIN COMPLAINTS ─────────────────────────────────────────────────────────
function AdminComplaints({ complaints, contractors, onUpdate, showToast, budgetConfig }) {
  const [statusF, setStatusF] = useState("all");
  const [sevF, setSevF] = useState("all");
  const [sel, setSel] = useState(null);
  const [conSel, setConSel] = useState("");
  const [budgetIn, setBudgetIn] = useState("");
  const [fraudState, setFraudState] = useState("idle"); // idle | loading | result
  const [fraudResult, setFraudResult] = useState(null);

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

  const assign = () => {
    if (!conSel || !budgetIn) { showToast("Select contractor and enter budget", "warning"); return; }
    const con = contractors.find(c => c.id === conSel);
    doAction("Assigned", { status: "assigned", contractor: con?.name, contractorId: conSel, budget: Number(budgetIn), timeline: [...(sel.timeline || []), { action: `Assigned to ${con?.name} · Budget ₹${Number(budgetIn).toLocaleString()}`, actor: "Admin", time: ts() }] }, { actor: "Admin", action: `Assigned ${sel.id} to ${con?.name}`, type: "assign" });
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
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--gold2)", fontWeight: 700 }}>{c.id}</td>
                    <td style={{ maxWidth: 200 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{c.title}</div></td>
                    <td style={{ fontSize: 12, color: "var(--tx-l3)" }}>{c.area}</td>
                    <td><SevBadge s={c.severity} /></td>
                    <td><SBadge s={c.status} /></td>
                    <td style={{ fontSize: 12, color: "var(--tx-l3)" }}>{c.date}</td>
                    <td style={{ fontSize: 13, fontWeight: 700, color: "#6ec98d" }}>₹{(c.cost || 0).toLocaleString()}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => { setSel(c); setConSel(c.contractorId || ""); setBudgetIn(c.budget || ""); setFraudState("idle"); setFraudResult(null); }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sel && (
        <div className="modal-ov" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="modal-box">
            <div className="modal-inner">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
                <div>
                  <div className="heading" style={{ fontSize: 20 }}>{sel.id}</div>
                  <div style={{ color: "var(--tx-l3)", fontSize: 13, marginTop: 2 }}>{sel.title}</div>
                </div>
                <button onClick={() => setSel(null)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--tx-l3)", fontSize: 18 }}>×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 18, fontSize: 12 }}>
                {[["Area", sel.area], ["Severity", sel.severity], ["Date", sel.date], ["Cost", "₹" + (sel.cost || 0).toLocaleString()], ["Reporter", sel.reportedBy], ["Contractor", sel.contractor || "Unassigned"]].map(([l, v]) => (
                  <div key={l} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ color: "var(--tx-l3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v || "—"}</div>
                  </div>
                ))}
              </div>

              {sel.aiData && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.15)", marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "var(--gold2)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Analysis</div>
                  <div style={{ display: "flex", gap: 18, fontSize: 12, flexWrap: "wrap" }}>
                    <div><span style={{ color: "var(--tx-l3)" }}>Area: </span><b>{sel.aiData.area_sqm || "N/A"}</b></div>
                    <div><span style={{ color: "var(--tx-l3)" }}>Depth: </span><b>{sel.aiData.depth_cm || "N/A"}</b></div>
                    <div><span style={{ color: "var(--tx-l3)" }}>Confidence: </span><b style={{ color: "#6ec98d" }}>{sel.aiData.confidence || "N/A"}%</b></div>
                  </div>
                  {sel.aiData.ai_notes && <div style={{ marginTop: 7, fontSize: 12, color: "var(--tx-l3)", lineHeight: 1.5 }}>{sel.aiData.ai_notes}</div>}
                </div>
              )}

              {/* Assign */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <div><label>Contractor</label>
                  <select value={conSel} onChange={e => setConSel(e.target.value)}>
                    <option value="">Select contractor</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label>Budget (₹)</label><input type="number" placeholder="e.g. 15000" value={budgetIn} onChange={e => setBudgetIn(e.target.value)} /></div>
              </div>

              {/* Fraud Detection */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={runFraud} disabled={fraudState === "loading"}>
                    {fraudState === "loading" ? <><Spinner />Analysing…</> : "⚠ AI Fraud Analysis"}
                  </button>
                  {fraudState === "idle" && <span style={{ fontSize: 11, color: "var(--tx-l3)" }}>Run Claude-powered fraud check</span>}
                </div>
                {fraudState === "result" && fraudResult && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, fontSize: 12, background: fraudResult.fraud_risk === "high" ? "rgba(192,82,42,0.1)" : fraudResult.fraud_risk === "medium" ? "rgba(201,168,76,0.08)" : "rgba(74,124,89,0.08)", border: `1px solid ${fraudResult.fraud_risk === "high" ? "rgba(192,82,42,0.28)" : fraudResult.fraud_risk === "medium" ? "rgba(201,168,76,0.2)" : "rgba(74,124,89,0.2)"}` }}>
                    <div style={{ fontWeight: 700, marginBottom: 5 }}>
                      Risk: <span style={{ color: fraudResult.fraud_risk === "high" ? "#e8835c" : fraudResult.fraud_risk === "medium" ? "#e8c96a" : "#6ec98d", textTransform: "uppercase" }}>{fraudResult.fraud_risk}</span>
                      <span style={{ color: "var(--tx-l3)", fontWeight: 400, marginLeft: 8 }}>Score: {fraudResult.score}/100</span>
                    </div>
                    {fraudResult.flags?.length > 0 && <div style={{ color: "#e8835c", marginBottom: 5 }}>{fraudResult.flags.map(f => `⚑ ${f}`).join(" · ")}</div>}
                    <div style={{ color: "var(--tx-l2)" }}>{fraudResult.recommendation}</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-success btn-sm" onClick={() => doAction("Approved", { status: "in_progress", timeline: [...(sel.timeline || []), { action: "Approved by Admin", actor: "Admin", time: ts() }] }, { actor: "Admin", action: `Approved ${sel.id}`, type: "approve" })}>✓ Approve</button>
                <button className="btn btn-danger btn-sm" onClick={() => doAction("Rejected", { status: "rejected", timeline: [...(sel.timeline || []), { action: "Rejected by Admin", actor: "Admin", time: ts() }] }, { actor: "Admin", action: `Rejected ${sel.id}`, type: "reject" })}>✗ Reject</button>
                <button className="btn btn-gold btn-sm" onClick={assign} disabled={!conSel || !budgetIn}>◈ Assign & Allocate</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN CONTRACTORS ─────────────────────────────────────────────────────────
function AdminContractors({ contractors, complaints }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="heading-i" style={{ fontSize: 26, marginBottom: 4 }}>Contractor Registry</div>
        <div style={{ fontSize: 13, color: "var(--tx-l3)" }}>{contractors.length} registered contractors</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 14 }}>
        {contractors.map((c, i) => {
          const assigned = complaints.filter(x => x.contractorId === c.id);
          const done = assigned.filter(x => x.status === "completed");
          const budgetUsed = done.reduce((s, x) => s + (x.budget || 0), 0);
          return (
            <div key={c.id} className="card" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.08))", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>◈</div>
                <div style={{ flex: 1 }}>
                  <div className="heading" style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 1 }}>{c.email}</div>
                </div>
                <span className="badge b-done">Active</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[["Active", assigned.filter(x => x.status !== "completed").length, "#7aadda"], ["Done", done.length, "#6ec98d"], ["Budget", "₹" + Math.floor(budgetUsed / 1000) + "K", "#e8c96a"]].map(([l, v, col]) => (
                  <div key={l} style={{ textAlign: "center", padding: "10px 4px", background: "rgba(255,255,255,0.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: col }}>{v}</div>
                    <div style={{ fontSize: 10, color: "var(--tx-l3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>📱 {c.phone}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BUDGET CONTROL ────────────────────────────────────────────────────────────
function BudgetControl({ complaints, budgetConfig, onBudgetUpdate, showToast }) {
  const [total, setTotal] = useState(budgetConfig.total);
  const [rates, setRates] = useState({ ...budgetConfig.rates });
  const allocated = complaints.reduce((s, c) => s + (c.budget || 0), 0);
  const spent = complaints.filter(c => c.status === "completed").reduce((s, c) => s + (c.budget || c.cost || 0), 0);
  const remaining = total - allocated;
  const pendingCost = complaints.filter(c => c.status === "pending").reduce((s, c) => s + (c.cost || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        <StatCard icon="⬢" val={`₹${Math.floor(total / 1000)}K`} label="Total Budget" accent="#7aadda" />
        <StatCard icon="◎" val={`₹${Math.floor(allocated / 1000)}K`} label="Allocated" accent="#e8c96a" />
        <StatCard icon="⚙" val={`₹${Math.floor(spent / 1000)}K`} label="Spent" accent="#e8835c" />
        <StatCard icon="✓" val={`₹${Math.floor(Math.max(remaining, 0) / 1000)}K`} label="Remaining" accent="#6ec98d" />
        <StatCard icon="◎" val={`₹${Math.floor(pendingCost / 1000)}K`} label="Pending Cost" accent="#a48fd4" />
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
        <button className="btn btn-gold btn-sm" onClick={() => { onBudgetUpdate({ total, rates }); showToast("Rates updated", "success"); }}>Update Rates</button>
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
                <span style={{ fontWeight: 600, fontSize: 13 }}>{log.actor}</span>
                {log.flag && <span className="badge b-reject" style={{ fontSize: 9.5 }}>⚑ FLAGGED</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--tx-l3)", lineHeight: 1.5 }}>{log.action}</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-l3)", whiteSpace: "nowrap", flexShrink: 0 }}>{log.time}</div>
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
function ContractorDashboard({ complaints, contractor }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id);
  const active = mine.filter(c => !["completed", "rejected"].includes(c.status));
  const done = mine.filter(c => c.status === "completed");
  const held = active.reduce((s, c) => s + (c.budget || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        <StatCard icon="≡" val={active.length} label="Active Tasks" accent="#7aadda" />
        <StatCard icon="✓" val={done.length} label="Completed" accent="#6ec98d" />
        <StatCard icon="⬢" val={`₹${Math.floor(held / 1000)}K`} label="Budget Held" accent="#e8c96a" />
      </div>

      {!mine.length ? (
        <div className="card" style={{ padding: 44, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>≡</div>
          <div style={{ color: "var(--tx-l3)", fontSize: 13, lineHeight: 1.6 }}>No tasks assigned yet.<br />Admin will assign jobs to your account.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="stack-m">
          <div className="card" style={{ padding: 22 }}>
            <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Assigned Tasks</div>
            {mine.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.severity === "high" ? "#e8835c" : "#e8c96a", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: "var(--tx-l3)", marginTop: 1 }}>₹{(t.budget || 0).toLocaleString()}</div>
                </div>
                <SBadge s={t.status} />
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 22 }}>
            <div className="heading" style={{ fontSize: 15, marginBottom: 16 }}>Overview</div>
            {[["Active Tasks", active.length, "#7aadda"], ["Completed", done.length, "#6ec98d"], ["Budget Held", "₹" + Math.floor(held / 1000) + "K", "#e8c96a"]].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                <span style={{ color: "var(--tx-l3)" }}>{l}</span><span style={{ fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CONTRACTOR TASKS ──────────────────────────────────────────────────────────
function ContractorTasks({ complaints, contractor, onUpdate, showToast }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id);
  const [expanded, setExpanded] = useState(null);

  const acceptBudget = (c) => {
    onUpdate(c.id, { status: "in_progress", timeline: [...(c.timeline || []), { action: `Budget ₹${c.budget?.toLocaleString()} accepted — work started`, actor: contractor?.name, time: ts() }] }, { actor: contractor?.name, action: `Accepted budget ₹${c.budget} for ${c.id}`, type: "budget" });
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
        <div key={t.id} className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: t.severity === "high" ? "rgba(192,82,42,0.15)" : "rgba(201,168,76,0.1)", border: `1px solid ${t.severity === "high" ? "rgba(192,82,42,0.25)" : "rgba(201,168,76,0.18)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>◉</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="heading" style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "var(--tx-l3)", marginTop: 2 }}>⊞ {t.area} · Budget: <span style={{ color: "#6ec98d", fontWeight: 700 }}>₹{(t.budget || 0).toLocaleString()}</span></div>
            </div>
            <div style={{ display: "flex", gap: 6 }}><SevBadge s={t.severity} /><SBadge s={t.status} /></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>Details</button>
          </div>

          {expanded === t.id && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", animation: "fadeUp 0.25s ease" }}>
              <div style={{ fontSize: 13, color: "var(--tx-l2)", marginBottom: 14, lineHeight: 1.6 }}>{t.desc || "No description provided."}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14, fontSize: 12 }}>
                {[["Reporter", t.reportedBy], ["Filed", t.date], ["Est. Cost", "₹" + (t.cost || 0).toLocaleString()], ["Budget", "₹" + (t.budget || 0).toLocaleString()]].map(([l, v]) => (
                  <div key={l} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                    <div style={{ color: "var(--tx-l3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{l}</div>
                    <div style={{ fontWeight: 600 }}>{v || "—"}</div>
                  </div>
                ))}
              </div>
              {t.status === "assigned" && <button className="btn btn-gold btn-sm" onClick={() => acceptBudget(t)}>⬢ Accept Budget & Start Work</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── EXPENSE SUBMIT ────────────────────────────────────────────────────────────
function ExpenseSubmit({ complaints, contractor, onUpdate, showToast, budgetConfig }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id && c.status === "in_progress");
  const [task, setTask] = useState("");
  const [mat, setMat] = useState({ cement: 0, sand: 0, agg: 0, labor: 0 });
  const [desc, setDesc] = useState("");
  const sel = mine.find(c => c.id === task);
  const budget = sel?.budget || 0;
  const r = budgetConfig.rates;
  const total = mat.cement * r.cement + mat.sand * r.sand + mat.agg * r.aggregate + mat.labor * r.labor;
  const diff = total - budget;

  const submit = () => {
    if (!task) { showToast("Select a task first", "warning"); return; }
    onUpdate(task, { expenses: { ...mat, total, diff }, expenseDesc: desc, timeline: [...(sel.timeline || []), { action: `Expenses submitted: ₹${total.toLocaleString()} ${diff > 0 ? "(+" + diff.toLocaleString() + " excess)" : "(within budget)"}`, actor: contractor?.name, time: ts() }] }, { actor: contractor?.name, action: `Submitted expenses ₹${total} for ${task}`, type: "budget", flag: diff > budget * 0.2 });
    showToast("Expenses submitted", "success");
    setTask(""); setMat({ cement: 0, sand: 0, agg: 0, labor: 0 }); setDesc("");
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
              <div><label>Sand (tons) @ ₹{r.sand}</label><input type="number" min={0} value={mat.sand} onChange={e => setMat({ ...mat, sand: Number(e.target.value) })} /></div>
              <div><label>Aggregate (tons) @ ₹{r.aggregate}</label><input type="number" min={0} value={mat.agg} onChange={e => setMat({ ...mat, agg: Number(e.target.value) })} /></div>
              <div><label>Labor (days) @ ₹{r.labor}</label><input type="number" min={0} value={mat.labor} onChange={e => setMat({ ...mat, labor: Number(e.target.value) })} /></div>
            </div>
            <div><label>Notes</label><textarea rows={2} placeholder="Additional notes…" value={desc} onChange={e => setDesc(e.target.value)} /></div>
          </>
        )}
      </div>

      {total > 0 && sel && (
        <div className="card" style={{ padding: 22 }}>
          <div className="heading" style={{ fontSize: 14, marginBottom: 14 }}>Cost Breakdown</div>
          {[["Cement", mat.cement + " bags", mat.cement * r.cement], ["Sand", mat.sand + " tons", mat.sand * r.sand], ["Aggregate", mat.agg + " tons", mat.agg * r.aggregate], ["Labor", mat.labor + " days", mat.labor * r.labor]].filter(([, , v]) => v > 0).map(([l, q, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <span style={{ color: "var(--tx-l3)" }}>{l} <span style={{ fontSize: 11 }}>({q})</span></span>
              <span style={{ fontWeight: 600 }}>₹{v.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 14 }}>
            <span className="heading" style={{ fontWeight: 600 }}>Total</span>
            <span style={{ fontFamily: "var(--ff)", fontSize: 20, fontWeight: 600, color: diff > 0 ? "#e8835c" : "#6ec98d" }}>₹{total.toLocaleString()}</span>
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 9, fontSize: 12.5, background: diff <= 0 ? "rgba(74,124,89,0.08)" : "rgba(192,82,42,0.08)", border: `1px solid ${diff <= 0 ? "rgba(74,124,89,0.2)" : "rgba(192,82,42,0.22)"}`, color: diff <= 0 ? "#6ec98d" : "#e8835c" }}>
            {diff <= 0 ? `₹${Math.abs(diff).toLocaleString()} under budget — surplus will be returned.` : `⚠ Exceeds budget by ₹${diff.toLocaleString()}. Proof of expense required.`}
          </div>
          {diff > 0 && <div className="upload-z" style={{ padding: 12, marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>◈ Upload Proof of Excess Expense (required)</div>
          </div>}
        </div>
      )}

      {mine.length > 0 && (
        <button className="btn btn-gold btn-lg" style={{ alignSelf: "flex-start" }} onClick={submit} disabled={!task}>Submit Expenses →</button>
      )}
    </div>
  );
}

// ─── MARK COMPLETE ─────────────────────────────────────────────────────────────
function MarkComplete({ complaints, contractor, onUpdate, showToast }) {
  const mine = complaints.filter(c => c.contractorId === contractor?.id && c.status === "in_progress");
  const [task, setTask] = useState("");
  const [uploaded, setUploaded] = useState(false);

  const submit = () => {
    const sel = mine.find(c => c.id === task);
    if (!sel) return;
    onUpdate(task, { status: "completed", timeline: [...(sel.timeline || []), { action: "Completed with geo-tagged proof. Awaiting citizen verification.", actor: contractor?.name, time: ts() }] }, { actor: contractor?.name, action: `Marked ${task} complete — pending verification`, type: "complete" });
    showToast("Marked complete. Citizen notified to verify.", "success");
    setTask(""); setUploaded(false);
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
            <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(192,82,42,0.07)", border: "1px solid rgba(192,82,42,0.18)", marginBottom: 14, fontSize: 12.5, color: "#e8835c" }}>
              Completion is blocked until a geo-tagged after-photo is uploaded.
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ marginBottom: 8 }}>After Photo (Geo-Tagged + Timestamped)</label>
              <div className="upload-z" onClick={() => setUploaded(true)}>
                {uploaded ? (
                  <div style={{ color: "#6ec98d", fontWeight: 600, fontSize: 13 }}>✓ Image uploaded & geo-validated</div>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>◈</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Upload After Photo</div>
                    <div style={{ fontSize: 12, color: "var(--tx-l3)" }}>Must be taken on-site · GPS metadata required</div>
                  </>
                )}
              </div>
            </div>

            {uploaded && task && (
              <div className="fu">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.2)", fontSize: 12 }}>
                    <div style={{ color: "var(--tx-l3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Location Match</div>
                    <div style={{ fontWeight: 700, color: "#6ec98d" }}>✓ Verified (±8 m)</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.2)", fontSize: 12 }}>
                    <div style={{ color: "var(--tx-l3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Timestamp</div>
                    <div style={{ fontWeight: 700, color: "#6ec98d" }}>✓ {new Date().toLocaleString("en-IN").slice(0, 16)}</div>
                  </div>
                </div>
                <button className="btn btn-success btn-lg" onClick={submit}>Submit Completion →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState("user");
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState(null);
  const [appData, setAppData] = useState(initialData);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch { }
  }, [appData]);

  const showToast = (msg, type = "info") => setToast({ msg, type, id: Date.now() });

  const addComplaint = (c, log) => setAppData(d => ({
    ...d,
    complaints: [...d.complaints, c],
    auditLogs: [...d.auditLogs, { id: Date.now(), actor: log.actor, action: log.action, type: log.type, time: ts(), flag: false }],
  }));

  const updateComplaint = (id, updates, log) => setAppData(d => ({
    ...d,
    complaints: d.complaints.map(c => c.id === id ? { ...c, ...updates } : c),
    auditLogs: [...d.auditLogs, { id: Date.now(), actor: log.actor, action: log.action, type: log.type, time: ts(), flag: !!log.flag }],
  }));

  const updateBudget = (config) => setAppData(d => ({ ...d, budgetConfig: { ...d.budgetConfig, ...config } }));

  const handleLogin = (r, u) => { setRole(r); setCurrentUser(u); setAuthed(true); setPage("dashboard"); };
  const handleLogout = () => { setAuthed(false); setCurrentUser(null); setPage("dashboard"); };

  const { complaints, auditLogs, contractors, budgetConfig } = appData;

  const renderPage = () => {
    if (role === "user") {
      if (page === "dashboard") return <UserDashboard complaints={complaints} user={currentUser} onNav={setPage} />;
      if (page === "report") return <ReportPothole user={currentUser} onAdd={addComplaint} showToast={showToast} budgetConfig={budgetConfig} />;
      if (page === "myreports") return <MyComplaints complaints={complaints} user={currentUser} onUpdate={updateComplaint} showToast={showToast} />;
      if (page === "map") return <div><div className="heading-i" style={{ fontSize: 24, marginBottom: 18 }}>City Pothole Map</div><MapView height={500} complaints={complaints} showFilters /></div>;
      if (page === "route") return <RouteCheck complaints={complaints} />;
      if (page === "notifs") return <Notifications complaints={complaints} user={currentUser} />;
    }
    if (role === "admin") {
      if (page === "dashboard") return <AdminDashboard complaints={complaints} auditLogs={auditLogs} budgetConfig={budgetConfig} />;
      if (page === "complaints") return <AdminComplaints complaints={complaints} contractors={contractors} onUpdate={updateComplaint} showToast={showToast} budgetConfig={budgetConfig} />;
      if (page === "map") return <div><div className="heading-i" style={{ fontSize: 24, marginBottom: 18 }}>Complaint Map Monitor</div><MapView height={500} complaints={complaints} showFilters /></div>;
      if (page === "contractors") return <AdminContractors contractors={contractors} complaints={complaints} />;
      if (page === "budget") return <BudgetControl complaints={complaints} budgetConfig={budgetConfig} onBudgetUpdate={updateBudget} showToast={showToast} />;
      if (page === "activity") return <ActivityLogs auditLogs={auditLogs} contractors={contractors} />;
      if (page === "priority") return <PriorityQueue complaints={complaints} showToast={showToast} onUpdate={updateComplaint} />;
    }
    if (role === "contractor") {
      if (page === "dashboard") return <ContractorDashboard complaints={complaints} contractor={currentUser} />;
      if (page === "tasks") return <ContractorTasks complaints={complaints} contractor={currentUser} onUpdate={updateComplaint} showToast={showToast} />;
      if (page === "expenses") return <ExpenseSubmit complaints={complaints} contractor={currentUser} onUpdate={updateComplaint} showToast={showToast} budgetConfig={budgetConfig} />;
      if (page === "complete") return <MarkComplete complaints={complaints} contractor={currentUser} onUpdate={updateComplaint} showToast={showToast} />;
      if (page === "map") return <div><div className="heading-i" style={{ fontSize: 24, marginBottom: 18 }}>My Site Map</div><MapView height={500} complaints={complaints.filter(c => c.contractorId === currentUser?.id)} /></div>;
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
        <AuthScreen onLogin={handleLogin} />
      ) : (
        <div style={{ display: "flex", height: "100vh", position: "relative", zIndex: 1 }}>
          <Sidebar role={role} page={page} onNav={setPage} collapsed={collapsed} toggle={() => setCollapsed(!collapsed)} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
            <TopBar page={page} user={currentUser} onLogout={handleLogout} />
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
