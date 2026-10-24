import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Eye,
  Scan,
  Users,
  Calculator,
  ShieldCheck,
  Cpu,
  Layers,
  MapPin,
  Activity,
  CheckCircle2,
  ChevronRight,
  Menu,
  X,
  Lock,
  Scale,
  Sparkles,
  Building2,
  HardHat,
  FileText,
  Compass,
  ArrowUpRight,
  Check
} from "lucide-react";
import roadHeroImg from "./assets/road_hero.jpg";

export default function SmartRoadLandingPage({ onNavigateToAuth }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState("citizen");
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", department: "", message: "" });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setContactForm({ name: "", email: "", department: "", message: "" });
    }, 4000);
  };

  return (
    <div className="landing-root">
      <style>{`
        .landing-root {
          min-height: 100vh;
          background-color: #07090e;
          color: #f2f0eb;
          font-family: 'Instrument Sans', system-ui, -apple-system, sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* Ambient Glow & Grid */
        .landing-ambient-glow {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 65% 45% at 20% 15%, rgba(201, 168, 76, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 55% 40% at 80% 60%, rgba(61, 90, 122, 0.12) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 50% 90%, rgba(92, 74, 138, 0.08) 0%, transparent 60%);
        }

        .landing-grid-pattern {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image:
            linear-gradient(rgba(201, 168, 76, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201, 168, 76, 0.03) 1px, transparent 1px);
          background-size: 52px 52px;
        }

        /* Glassmorphism Classes */
        .glass-panel {
          background: rgba(14, 18, 30, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-panel:hover {
          border-color: rgba(201, 168, 76, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        }

        .glass-card-static {
          background: rgba(14, 18, 30, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
        }

        /* Typography */
        .font-display {
          font-family: 'Fraunces', Georgia, serif;
        }

        /* Gold Gradient Text */
        .text-gold-gradient {
          background: linear-gradient(135deg, #ffffff 15%, #f6e6b5 45%, #e8c96a 75%, #c9a84c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .text-gold-subtle {
          color: #e8c96a;
        }

        /* Buttons */
        .btn-gold-pill {
          background: linear-gradient(135deg, #e8c96a 0%, #c9a84c 60%, #ad8527 100%);
          color: #0a0c14;
          font-weight: 600;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 24px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 22px rgba(201, 168, 76, 0.32);
          transition: all 0.25s ease;
          text-decoration: none;
        }
        .btn-gold-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 30px rgba(201, 168, 76, 0.48);
          background: linear-gradient(135deg, #f0d57d 0%, #d4b156 60%, #b89132 100%);
        }

        .btn-glass-pill {
          background: rgba(255, 255, 255, 0.06);
          color: #f2f0eb;
          font-weight: 500;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          cursor: pointer;
          font-size: 14px;
          backdrop-filter: blur(10px);
          transition: all 0.25s ease;
          text-decoration: none;
        }
        .btn-glass-pill:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(201, 168, 76, 0.4);
          transform: translateY(-1px);
          color: #ffffff;
        }

        /* Animated Pulsing Ring */
        @keyframes pulseRing {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        /* Responsive Utilities */
        @media (max-width: 868px) {
          .hide-mobile {
            display: none !important;
          }
          .show-mobile-only {
            display: inline-flex !important;
          }
        }
        @media (min-width: 869px) {
          .show-mobile-only {
            display: none !important;
          }
        }
      `}</style>

      {/* Background Gradients & Grid */}
      <div className="landing-ambient-glow" />
      <div className="landing-grid-pattern" />

      {/* ─── 1. HEADER / NAVIGATION BAR ───────────────────────────── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transition: "all 0.3s ease",
          background: scrolled ? "rgba(7, 9, 14, 0.88)" : "rgba(7, 9, 14, 0.5)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: scrolled ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(255, 255, 255, 0.04)",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: SmartRoad Branding */}
          <div
            onClick={(e) => scrollToSection(e, "home")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: "linear-gradient(135deg, #e8c96a 0%, #c9a84c 50%, #8a6c28 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: "#0a0c14",
                boxShadow: "0 4px 18px rgba(201, 168, 76, 0.35)",
                fontWeight: 700,
              }}
            >
              ⬡
            </div>
            <div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#f2f0eb",
                  lineHeight: 1.1,
                }}
              >
                SmartRoad
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: "#c9a84c",
                  marginTop: 2,
                }}
              >
                AI-POWERED ROAD INTELLIGENCE
              </div>
            </div>
          </div>

          {/* Center: Desktop Navigation Items */}
          <nav
            className="hide-mobile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
          >
            {[
              { label: "Home", id: "home" },
              { label: "Features", id: "features" },
              { label: "How It Works", id: "how-it-works" },
              { label: "Impact", id: "impact" },
              { label: "Contact", id: "contact" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => scrollToSection(e, item.id)}
                style={{
                  color: "rgba(242, 240, 235, 0.72)",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e8c96a")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242, 240, 235, 0.72)")}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right: Authentication Actions */}
          <div
            className="hide-mobile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <button
              onClick={() => onNavigateToAuth("user")}
              className="btn-glass-pill"
              style={{ padding: "8px 20px", fontSize: 13 }}
            >
              Login
            </button>
            <button
              onClick={() => onNavigateToAuth("user")}
              className="btn-gold-pill"
              style={{ padding: "8px 22px", fontSize: 13 }}
            >
              <span>Get Started</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="show-mobile-only"
            aria-label="Toggle navigation menu"
            style={{
              display: "none",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#f2f0eb",
              borderRadius: 8,
              padding: 8,
              cursor: "pointer",
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              background: "rgba(9, 12, 20, 0.98)",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {[
              { label: "Home", id: "home" },
              { label: "Features", id: "features" },
              { label: "How It Works", id: "how-it-works" },
              { label: "Impact", id: "impact" },
              { label: "Contact", id: "contact" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => scrollToSection(e, item.id)}
                style={{
                  color: "#f2f0eb",
                  fontSize: 16,
                  fontWeight: 500,
                  textDecoration: "none",
                  padding: "6px 0",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                }}
              >
                {item.label}
              </a>
            ))}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToAuth("user");
                }}
                className="btn-glass-pill"
                style={{ flex: 1, justifyContent: "center" }}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToAuth("user");
                }}
                className="btn-gold-pill"
                style={{ flex: 1, justifyContent: "center" }}
              >
                <span>Get Started</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─── 2. HERO SECTION — MAIN LANDING EXPERIENCE ────────────── */}
      <section
        id="home"
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingTop: 104,
          paddingBottom: 48,
          overflow: "hidden",
        }}
      >
        {/* Hero Background Image with Dark Navy & Black Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${roadHeroImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            backgroundRepeat: "no-repeat",
            zIndex: 1,
            transform: "scale(1.02)",
          }}
        />

        {/* Multi-Layered Dark Overlays for High Legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(7, 9, 14, 0.72) 0%, rgba(7, 9, 14, 0.58) 35%, rgba(7, 9, 14, 0.82) 70%, #07090e 100%)",
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 75% 55% at 50% 40%, rgba(7, 9, 14, 0.3) 0%, rgba(7, 9, 14, 0.85) 85%)",
            zIndex: 2,
          }}
        />

        {/* Center Hero Text Container */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            maxWidth: 1080,
            margin: "auto auto",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          {/* Top Pill Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 9999,
              background: "rgba(201, 168, 76, 0.12)",
              border: "1px solid rgba(201, 168, 76, 0.28)",
              color: "#e8c96a",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 24,
              backdropFilter: "blur(12px)",
            }}
          >
            <Sparkles size={14} color="#e8c96a" />
            <span>AI-Powered Civic Infrastructure · YOLOv8 & MiDaS</span>
          </div>

          {/* Hero Headline */}
          <h1
            style={{
              margin: 0,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "clamp(36px, 5.4vw, 70px)",
                fontWeight: 800,
                color: "#ffffff",
                textShadow: "0 4px 28px rgba(0,0,0,0.8)",
              }}
            >
              Smarter Roads.
            </span>
            <span
              className="text-gold-gradient font-display"
              style={{
                display: "block",
                fontSize: "clamp(38px, 5.8vw, 74px)",
                fontWeight: 700,
                marginTop: 6,
                textShadow: "0 6px 36px rgba(201, 168, 76, 0.28)",
              }}
            >
              Transparent Infrastructure. Accountable Governance.
            </span>
          </h1>

          {/* Supporting Description */}
          <p
            style={{
              maxWidth: 760,
              margin: "24px auto 36px",
              fontSize: "clamp(15px, 1.4vw, 18px)",
              lineHeight: 1.65,
              color: "rgba(242, 240, 235, 0.85)",
              fontWeight: 400,
              textShadow: "0 2px 14px rgba(0,0,0,0.8)",
            }}
          >
            An AI-powered road intelligence platform that detects potholes, prioritizes repairs, estimates maintenance costs, and brings citizens, contractors, and authorities together for transparent road maintenance.
          </p>

          {/* Hero Action CTA Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => onNavigateToAuth("user")}
              className="btn-gold-pill"
              style={{
                padding: "14px 34px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              <span>Get Started</span>
              <ArrowRight size={17} />
            </button>

            <button
              onClick={(e) => scrollToSection(e, "features")}
              className="btn-glass-pill"
              style={{
                padding: "13px 30px",
                fontSize: 15,
              }}
            >
              <Eye size={17} color="#c9a84c" />
              <span>Explore Features</span>
            </button>
          </div>
        </div>

        {/* ─── 3. IMPACT STATISTICS CARDS (FLOATING AT BOTTOM OF HERO) ─── */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            maxWidth: 1240,
            margin: "0 auto",
            width: "100%",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {/* Card 1 — Road Intelligence */}
            <div className="glass-panel" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(201, 168, 76, 0.15)",
                    border: "1px solid rgba(201, 168, 76, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#e8c96a",
                    flexShrink: 0,
                  }}
                >
                  <Scan size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                    AI-Powered
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(242, 240, 235, 0.65)", marginTop: 2 }}>
                    Road damage detection
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 — Citizen Participation */}
            <div className="glass-panel" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#38bdf8",
                    flexShrink: 0,
                  }}
                >
                  <Users size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                    Citizen Reports
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(242, 240, 235, 0.65)", marginTop: 2 }}>
                    Community-driven reporting
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3 — Maintenance Planning */}
            <div className="glass-panel" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(232, 201, 106, 0.15)",
                    border: "1px solid rgba(232, 201, 106, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#e8c96a",
                    flexShrink: 0,
                  }}
                >
                  <Calculator size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                    Cost Estimation
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(242, 240, 235, 0.65)", marginTop: 2 }}>
                    Smarter repair planning
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4 — Transparent Governance */}
            <div className="glass-panel" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(110, 201, 141, 0.15)",
                    border: "1px solid rgba(110, 201, 141, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6ec98d",
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                    Audit Tracking
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(242, 240, 235, 0.65)", marginTop: 2 }}>
                    Accountable maintenance workflows
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. FEATURES SECTION ─────────────────────────────────── */}
      <section
        id="features"
        style={{
          position: "relative",
          zIndex: 10,
          padding: "110px 24px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              borderRadius: 9999,
              background: "rgba(201, 168, 76, 0.1)",
              border: "1px solid rgba(201, 168, 76, 0.22)",
              color: "#e8c96a",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            ◈ CORE CAPABILITIES
          </div>

          <h2
            className="font-display"
            style={{
              fontSize: "clamp(30px, 4vw, 48px)",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 16px",
              letterSpacing: "-0.02em",
            }}
          >
            Everything Needed for Smarter Roads
          </h2>
          <p
            style={{
              maxWidth: 680,
              margin: "0 auto",
              fontSize: 16,
              lineHeight: 1.6,
              color: "rgba(242, 240, 235, 0.68)",
            }}
          >
            From identifying road damage to tracking repairs, SmartRoad connects the entire maintenance lifecycle.
          </p>
        </div>

        {/* 6 Feature Cards in Responsive Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 24,
          }}
        >
          {[
            {
              icon: <Cpu size={26} color="#e8c96a" />,
              title: "AI-Powered Pothole Detection",
              desc: "Computer vision identifies and segments potholes from uploaded road images using the existing YOLOv8 segmentation pipeline, outputting pixel-accurate polygon masks.",
              tag: "YOLOv8 Instance Segmentation",
              badgeColor: "rgba(201, 168, 76, 0.12)",
              borderColor: "rgba(201, 168, 76, 0.25)",
            },
            {
              icon: <Layers size={26} color="#38bdf8" />,
              title: "Intelligent Depth Estimation",
              desc: "Estimates pothole depth and relative cavity severity using the integrated MiDaS neural depth pipeline, helping assess structural impact and vehicle hazard risk.",
              tag: "MiDaS DPT_Large",
              badgeColor: "rgba(56, 189, 248, 0.12)",
              borderColor: "rgba(56, 189, 248, 0.25)",
            },
            {
              icon: <Calculator size={26} color="#4ade80" />,
              title: "Automated Repair Cost Estimation",
              desc: "Combines detected area and depth to calculate volumetric requirements for cement, sand, and aggregate based on configurable municipal material schedules.",
              tag: "Configurable BoQ Rates",
              badgeColor: "rgba(74, 222, 128, 0.12)",
              borderColor: "rgba(74, 222, 128, 0.25)",
            },
            {
              icon: <MapPin size={26} color="#f472b6" />,
              title: "Duplicate Report Detection",
              desc: "Spatial GPS radius clustering and Hu-moment contour signature analysis prevent duplicate complaint tickets for the same physical road defect.",
              tag: "GPS & Hu-Moments Deduplication",
              badgeColor: "rgba(244, 114, 182, 0.12)",
              borderColor: "rgba(244, 114, 182, 0.25)",
            },
            {
              icon: <Activity size={26} color="#fb923c" />,
              title: "Road Prioritization",
              desc: "Severity calculations, verified depth readings, and community report frequencies organize pending defects into an actionable emergency priority queue.",
              tag: "Risk-Weighted Priority Queue",
              badgeColor: "rgba(251, 146, 60, 0.12)",
              borderColor: "rgba(251, 146, 60, 0.25)",
            },
            {
              icon: <ShieldCheck size={26} color="#a78bfa" />,
              title: "Transparent Maintenance Tracking",
              desc: "Every milestone—from citizen report filing to contractor repair upload and municipal budget disbursement—is recorded on an immutable audit ledger.",
              tag: "Tamper-Evident Audit Trail",
              badgeColor: "rgba(167, 139, 250, 0.12)",
              borderColor: "rgba(167, 139, 250, 0.25)",
            },
          ].map((feat, idx) => (
            <div
              key={idx}
              className="glass-panel"
              style={{
                padding: "32px 28px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: feat.badgeColor,
                    border: `1px solid ${feat.borderColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  {feat.icon}
                </div>

                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#ffffff",
                    marginBottom: 12,
                    lineHeight: 1.3,
                  }}
                >
                  {feat.title}
                </h3>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "rgba(242, 240, 235, 0.7)",
                    margin: 0,
                  }}
                >
                  {feat.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#c9a84c",
                  }}
                >
                  {feat.tag}
                </span>
                <ChevronRight size={14} color="rgba(242, 240, 235, 0.4)" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 5. TRI-ROLE ECOSYSTEM PORTALS PREVIEW ──────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          padding: "80px 24px",
          background: "linear-gradient(180deg, transparent 0%, rgba(14, 18, 30, 0.5) 50%, transparent 100%)",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 14px",
                borderRadius: 9999,
                background: "rgba(201, 168, 76, 0.1)",
                border: "1px solid rgba(201, 168, 76, 0.22)",
                color: "#e8c96a",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              👥 ONE PLATFORM · THREE KEY ROLES
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: "clamp(28px, 3.5vw, 42px)",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 14px",
              }}
            >
              Connecting Citizens, Administrators, and Contractors
            </h2>
            <p
              style={{
                maxWidth: 640,
                margin: "0 auto",
                fontSize: 15,
                color: "rgba(242, 240, 235, 0.65)",
              }}
            >
              Tailored workspace portals designed specifically for each stakeholder in the road lifecycle.
            </p>
          </div>

          {/* Role Tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              marginBottom: 36,
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "citizen", label: "Citizen Portal", icon: "⬡", color: "#38bdf8" },
              { id: "admin", label: "Government Admin", icon: "⬢", color: "#e8c96a" },
              { id: "contractor", label: "Contractor Hub", icon: "◈", color: "#4ade80" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRoleTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 22px",
                  borderRadius: 9999,
                  border: activeRoleTab === tab.id ? `1px solid ${tab.color}` : "1px solid rgba(255, 255, 255, 0.1)",
                  background: activeRoleTab === tab.id ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
                  color: activeRoleTab === tab.id ? "#ffffff" : "rgba(242, 240, 235, 0.6)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: 16, color: tab.color }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Tab Preview Card */}
          <div className="glass-card-static" style={{ padding: "40px 36px", maxWidth: 960, margin: "0 auto" }}>
            {activeRoleTab === "citizen" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32, alignItems: "center" }}>
                <div>
                  <div style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
                    CITIZEN WORKFLOW
                  </div>
                  <h3 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", marginBottom: 14 }}>
                    Report Road Defects in Seconds
                  </h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(242, 240, 235, 0.7)", marginBottom: 20 }}>
                    Snap a photo of the damaged roadway. SmartRoad captures your geolocation and initiates instant AI pre-validation, giving you live tracking updates as your complaint progresses from inspection to repair.
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {["Instant photo upload with automated GPS tagging", "Real-time status tracking & interactive city map", "Reopen complaints if repair fails citizen verification"].map((item, idx) => (
                      <li key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(242, 240, 235, 0.85)" }}>
                        <Check size={16} color="#38bdf8" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => onNavigateToAuth("user")} className="btn-gold-pill" style={{ fontSize: 13 }}>
                    <span>Enter Citizen Portal</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
                <div style={{ background: "rgba(10, 12, 20, 0.75)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 11, color: "#c9a84c", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                    LIVE PREVIEW
                  </div>
                  <div style={{ background: "rgba(255, 255, 255, 0.04)", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Pothole Complaint #2841</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(201, 168, 76, 0.2)", color: "#e8c96a" }}>In Progress</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(242, 240, 235, 0.5)", marginTop: 4 }}>Outer Ring Road, Ward 14 · Depth: 8.4 cm</div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(242, 240, 235, 0.6)", lineHeight: 1.5 }}>
                    "AI estimated volume: 0.12 m³. Repair materials allocated: 0.78 cement bags, 0.05 m³ sand. Contractor assigned: Rajesh Constructions."
                  </div>
                </div>
              </div>
            )}

            {activeRoleTab === "admin" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32, alignItems: "center" }}>
                <div>
                  <div style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: "rgba(232, 201, 106, 0.15)", color: "#e8c96a", fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
                    GOVERNMENT OVERSIGHT
                  </div>
                  <h3 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", marginBottom: 14 }}>
                    Municipal Road Intelligence & Budget Control
                  </h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(242, 240, 235, 0.7)", marginBottom: 20 }}>
                    Monitor wards, review AI defect analyses, allocate repair funds based on configurable material schedules, dispatch contractors, and maintain total budgetary transparency.
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {["Interactive complaint map with severity filters", "Dynamic material cost management (cement, sand, labor)", "Automated budget locking and verifiable fund release"].map((item, idx) => (
                      <li key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(242, 240, 235, 0.85)" }}>
                        <Check size={16} color="#e8c96a" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => onNavigateToAuth("admin")} className="btn-gold-pill" style={{ fontSize: 13 }}>
                    <span>Enter Admin Portal</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
                <div style={{ background: "rgba(10, 12, 20, 0.75)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 11, color: "#e8c96a", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                    ADMIN CONTROL METRICS
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "rgba(242, 240, 235, 0.5)" }}>Total Budget</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>₹5,00,000</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "rgba(242, 240, 235, 0.5)" }}>Disbursed Funds</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#6ec98d" }}>₹1,42,800</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(242, 240, 235, 0.6)", lineHeight: 1.5 }}>
                    3 Active contractors under contract · 100% audit log coverage across all assigned municipal tasks.
                  </div>
                </div>
              </div>
            )}

            {activeRoleTab === "contractor" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32, alignItems: "center" }}>
                <div>
                  <div style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: "rgba(74, 222, 128, 0.15)", color: "#4ade80", fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
                    CONTRACTOR HUB
                  </div>
                  <h3 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", marginBottom: 14 }}>
                    Field Task Management & Expense Filing
                  </h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(242, 240, 235, 0.7)", marginBottom: 20 }}>
                    Execute assigned road repairs with GPS guidance, submit actual material and labor expenses against allocated budgets, and upload completion photo evidence for admin sign-off.
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {["Direct site navigation & complaint location coordinates", "Material expense itemization (cement, sand, aggregate, labor)", "On-site completion proof submission with geotagging"].map((item, idx) => (
                      <li key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(242, 240, 235, 0.85)" }}>
                        <Check size={16} color="#4ade80" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => onNavigateToAuth("contractor")} className="btn-gold-pill" style={{ fontSize: 13 }}>
                    <span>Enter Contractor Hub</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
                <div style={{ background: "rgba(10, 12, 20, 0.75)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                    TASK COMPLETION FLOW
                  </div>
                  <div style={{ background: "rgba(255, 255, 255, 0.04)", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Rajesh Constructions</span>
                      <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>Active</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(242, 240, 235, 0.5)", marginTop: 4 }}>Allocated: ₹85,000 · Utilized: ₹42,500</div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(242, 240, 235, 0.6)", lineHeight: 1.5 }}>
                    Photo-verified work completion requests are reviewed by government engineers before budget release.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── 6. HOW IT WORKS SECTION ─────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          position: "relative",
          zIndex: 10,
          padding: "110px 24px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 70 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              borderRadius: 9999,
              background: "rgba(201, 168, 76, 0.1)",
              border: "1px solid rgba(201, 168, 76, 0.22)",
              color: "#e8c96a",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            ⚡ SYSTEMATIC WORKFLOW
          </div>

          <h2
            className="font-display"
            style={{
              fontSize: "clamp(30px, 4vw, 48px)",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 16px",
            }}
          >
            How SmartRoad Operates
          </h2>
          <p
            style={{
              maxWidth: 620,
              margin: "0 auto",
              fontSize: 16,
              lineHeight: 1.6,
              color: "rgba(242, 240, 235, 0.68)",
            }}
          >
            A clear, transparent four-step civic workflow from initial defect reporting to verifiable road restoration.
          </p>
        </div>

        {/* 4 Connected Step Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            position: "relative",
          }}
        >
          {[
            {
              step: "01",
              title: "Report",
              desc: "Citizens or field personnel upload a road photo with GPS coordinates and damage description.",
              icon: <FileText size={22} color="#e8c96a" />,
            },
            {
              step: "02",
              title: "Analyze",
              desc: "The AI pipeline segments pothole boundaries and computes depth maps to calculate volume.",
              icon: <Cpu size={22} color="#38bdf8" />,
            },
            {
              step: "03",
              title: "Prioritize",
              desc: "Engineers review severity rankings and automated material budgets to schedule contractor repairs.",
              icon: <Scale size={22} color="#fb923c" />,
            },
            {
              step: "04",
              title: "Track",
              desc: "Repairs are executed on-site, completion photos verified, and every milestone logged on the audit trail.",
              icon: <CheckCircle2 size={22} color="#4ade80" />,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="glass-panel"
              style={{
                padding: "30px 24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: "rgba(201, 168, 76, 0.4)",
                      lineHeight: 1,
                    }}
                  >
                    {item.step}
                  </span>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.icon}
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#ffffff",
                    marginBottom: 10,
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "rgba(242, 240, 235, 0.68)",
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: 24,
                  height: 2,
                  width: "100%",
                  background: "linear-gradient(90deg, rgba(201, 168, 76, 0.6) 0%, transparent 100%)",
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── 7. IMPACT AND GOVERNANCE SECTION ────────────────────── */}
      <section
        id="impact"
        style={{
          position: "relative",
          zIndex: 10,
          padding: "100px 24px",
          background: "linear-gradient(180deg, transparent 0%, rgba(10, 14, 24, 0.8) 50%, transparent 100%)",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 14px",
                borderRadius: 9999,
                background: "rgba(201, 168, 76, 0.1)",
                border: "1px solid rgba(201, 168, 76, 0.22)",
                color: "#e8c96a",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              🏛️ CIVIC IMPACT & ACCOUNTABILITY
            </div>

            <h2
              className="font-display"
              style={{
                fontSize: "clamp(30px, 4vw, 48px)",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              Building Roads People Can Trust
            </h2>
            <p
              style={{
                maxWidth: 680,
                margin: "0 auto",
                fontSize: 16,
                lineHeight: 1.6,
                color: "rgba(242, 240, 235, 0.68)",
              }}
            >
              Transforming road management into a transparent, accountable, and data-driven civic service.
            </p>
          </div>

          {/* 3 Supporting Impact Themes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 28,
            }}
          >
            {/* Theme 1: Better Visibility */}
            <div className="glass-panel" style={{ padding: "36px 30px" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                  marginBottom: 20,
                }}
              >
                <Eye size={24} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 12 }}>
                Better Visibility
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(242, 240, 235, 0.7)", margin: 0 }}>
                Make road-damage information easier to report and review. A unified map displays live status across wards, eliminating bureaucratic blind spots and keeping the public informed.
              </p>
            </div>

            {/* Theme 2: Smarter Decisions */}
            <div className="glass-panel" style={{ padding: "36px 30px" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(232, 201, 106, 0.12)",
                  border: "1px solid rgba(232, 201, 106, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e8c96a",
                  marginBottom: 20,
                }}
              >
                <Compass size={24} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 12 }}>
                Smarter Decisions
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(242, 240, 235, 0.7)", margin: 0 }}>
                Use available AI analysis and maintenance estimates to support municipal planning. Volumetric calculations give engineers reliable material schedules before dispatching resources.
              </p>
            </div>

            {/* Theme 3: Greater Accountability */}
            <div className="glass-panel" style={{ padding: "36px 30px" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(74, 222, 128, 0.12)",
                  border: "1px solid rgba(74, 222, 128, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4ade80",
                  marginBottom: 20,
                }}
              >
                <Lock size={24} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 12 }}>
                Greater Accountability
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(242, 240, 235, 0.7)", margin: 0 }}>
                Make maintenance status and authorized actions easier to track. Immutable audit records ensure every ticket, contractor assignment, and rupee released is fully verifiable.
              </p>
            </div>
          </div>

          {/* Infrastructure Banner */}
          <div
            className="glass-panel"
            style={{
              marginTop: 48,
              padding: "36px 40px",
              background: "linear-gradient(135deg, rgba(201, 168, 76, 0.1) 0%, rgba(14, 18, 30, 0.8) 100%)",
              border: "1px solid rgba(201, 168, 76, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "#e8c96a", textTransform: "uppercase", marginBottom: 6 }}>
                ROAD QUALITY MATTERS
              </div>
              <div className="font-display" style={{ fontSize: 24, fontWeight: 700, color: "#ffffff" }}>
                Ready to make road maintenance transparent in your area?
              </div>
            </div>

            <button
              onClick={() => onNavigateToAuth("user")}
              className="btn-gold-pill"
              style={{ padding: "12px 28px" }}
            >
              <span>Access SmartRoad Portal</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── 8. CONTACT SECTION ─────────────────────────────────── */}
      <section
        id="contact"
        style={{
          position: "relative",
          zIndex: 10,
          padding: "100px 24px",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <div className="glass-card-static" style={{ padding: "50px 44px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 48,
            }}
          >
            {/* Left Contact Info */}
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  background: "rgba(201, 168, 76, 0.1)",
                  border: "1px solid rgba(201, 168, 76, 0.22)",
                  color: "#e8c96a",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                📬 GET IN TOUCH
              </div>

              <h2
                className="font-display"
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "0 0 14px",
                }}
              >
                Inquire & Connect
              </h2>

              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "rgba(242, 240, 235, 0.7)",
                  marginBottom: 28,
                }}
              >
                For civic infrastructure queries, municipal pilot implementations, or technical integration regarding SmartRoad.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8c96a" }}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(242, 240, 235, 0.5)" }}>Platform Division</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>Civic Infrastructure & Road Intelligence Cell</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8c96a" }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(242, 240, 235, 0.5)" }}>Security & Governance</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>Tamper-evident SQLite audit trails & GPS deduplication</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Contact Form */}
            <div>
              {contactSubmitted ? (
                <div
                  style={{
                    background: "rgba(74, 222, 128, 0.1)",
                    border: "1px solid rgba(74, 222, 128, 0.3)",
                    borderRadius: 12,
                    padding: "36px 24px",
                    textAlign: "center",
                  }}
                >
                  <CheckCircle2 size={40} color="#4ade80" style={{ margin: "0 auto 16px" }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>
                    Thank You for Reaching Out
                  </div>
                  <div style={{ fontSize: 14, color: "rgba(242, 240, 235, 0.7)" }}>
                    Your message has been received. Our infrastructure team will review your inquiry.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(242, 240, 235, 0.7)", marginBottom: 6 }}>
                      Full Name
                    </label>
                    <input
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "11px 14px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        color: "#f2f0eb",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(242, 240, 235, 0.7)", marginBottom: 6 }}>
                      Email Address
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="you@domain.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "11px 14px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        color: "#f2f0eb",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(242, 240, 235, 0.7)", marginBottom: 6 }}>
                      Role or Department
                    </label>
                    <input
                      placeholder="e.g. Municipal Ward Engineer / Citizen / Contractor"
                      value={contactForm.department}
                      onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "11px 14px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        color: "#f2f0eb",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(242, 240, 235, 0.7)", marginBottom: 6 }}>
                      Message
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="How can we assist with your road management workflow?"
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "11px 14px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        color: "#f2f0eb",
                        fontSize: 14,
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-gold-pill"
                    style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                  >
                    <span>Submit Inquiry</span>
                    <ArrowRight size={15} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. LANDING FOOTER ───────────────────────────────────── */}
      <footer
        style={{
          position: "relative",
          zIndex: 10,
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(5, 7, 11, 0.95)",
          padding: "60px 24px 36px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 40,
              marginBottom: 48,
            }}
          >
            {/* Col 1: SmartRoad Info */}
            <div style={{ maxWidth: 320 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: "linear-gradient(135deg, #e8c96a, #c9a84c)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    color: "#0a0c14",
                    fontWeight: 700,
                  }}
                >
                  ⬡
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#ffffff" }}>SmartRoad</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "#c9a84c" }}>
                    AI ROAD INTELLIGENCE
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(242, 240, 235, 0.6)", margin: 0 }}>
                Transparent road damage detection, volumetric repair cost estimation, and municipal maintenance accountability.
              </p>
            </div>

            {/* Col 2: Navigation */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em", marginBottom: 16 }}>
                Platform
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Home", id: "home" },
                  { label: "Features", id: "features" },
                  { label: "How It Works", id: "how-it-works" },
                  { label: "Impact & Governance", id: "impact" },
                  { label: "Contact", id: "contact" },
                ].map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => scrollToSection(e, item.id)}
                      style={{
                        fontSize: 13,
                        color: "rgba(242, 240, 235, 0.6)",
                        textDecoration: "none",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#e8c96a")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242, 240, 235, 0.6)")}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Role Portals */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em", marginBottom: 16 }}>
                Portals
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Citizen Portal", role: "user" },
                  { label: "Government Admin", role: "admin" },
                  { label: "Contractor Hub", role: "contractor" },
                ].map((p) => (
                  <li key={p.role}>
                    <button
                      onClick={() => onNavigateToAuth(p.role)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        fontSize: 13,
                        color: "rgba(242, 240, 235, 0.6)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#e8c96a")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242, 240, 235, 0.6)")}
                    >
                      <span>{p.label}</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: Technology */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em", marginBottom: 16 }}>
                Core Engine
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["YOLOv8 Seg", "MiDaS Depth", "FastAPI", "React 19", "SQLite"].map((tech) => (
                  <span
                    key={tech}
                    style={{
                      fontSize: 11,
                      padding: "4px 9px",
                      borderRadius: 6,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      color: "rgba(242, 240, 235, 0.7)",
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Status */}
          <div
            style={{
              paddingTop: 24,
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
              color: "rgba(242, 240, 235, 0.45)",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>© 2026 SmartRoad Civic Infrastructure Platform. All rights reserved.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
              <span>System Status: Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
