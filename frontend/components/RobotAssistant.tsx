"use client";

import { ArrowRight, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "mra-robot-assistant-dismissed";
const BUBBLE_TEXT = "Need help getting started? 👋";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function RobotAssistant() {
  const [isMounted, setIsMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [blink, setBlink] = useState(false);
  const [scan, setScan] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [activeBounce, setActiveBounce] = useState(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      reducedMotionRef.current = media.matches;
    };

    updateMotionPreference();
    media.addEventListener?.("change", updateMotionPreference);

    const hasDismissed = window.sessionStorage.getItem(STORAGE_KEY) === "true";
    if (hasDismissed) return;

    const mountTimer = window.setTimeout(() => setIsMounted(true), 1200);
    const bubbleTimer = window.setTimeout(() => setShowBubble(true), 2200);

    return () => {
      window.clearTimeout(mountTimer);
      window.clearTimeout(bubbleTimer);
      media.removeEventListener?.("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!showBubble) {
      setTypedText("");
      return;
    }

    let currentIndex = 0;
    const timer = window.setInterval(() => {
      currentIndex += 1;
      setTypedText(BUBBLE_TEXT.slice(0, currentIndex));
      if (currentIndex >= BUBBLE_TEXT.length) {
        window.clearInterval(timer);
      }
    }, 24);

    return () => window.clearInterval(timer);
  }, [showBubble]);

  useEffect(() => {
    if (typeof window === "undefined" || reducedMotionRef.current) return;

    let rafId = 0;
    const onMouseMove = (event: MouseEvent) => {
      if (rafId) return;

      rafId = window.requestAnimationFrame(() => {
        setMouse({ x: event.clientX, y: event.clientY });
        rafId = 0;
      });
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || reducedMotionRef.current) return;

    let blinkTimer: number | undefined;
    const scheduleBlink = () => {
      const delay = 4000 + Math.random() * 2000;
      blinkTimer = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 150);
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => {
      if (blinkTimer) window.clearTimeout(blinkTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || reducedMotionRef.current) return;

    let scanTimer: number | undefined;
    const scheduleScan = () => {
      const delay = 10000 + Math.random() * 5000;
      scanTimer = window.setTimeout(() => {
        setScan(true);
        window.setTimeout(() => setScan(false), 550);
        scheduleScan();
      }, delay);
    };

    scheduleScan();
    return () => {
      if (scanTimer) window.clearTimeout(scanTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (isExpanded) {
      setActiveBounce(true);
      const timer = window.setTimeout(() => setActiveBounce(false), 450);
      return () => window.clearTimeout(timer);
    }
  }, [isExpanded, isMounted]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, "true");
    }

    setIsExpanded(false);
    setShowBubble(false);
    setIsMounted(false);
  };

  const robotX = typeof window !== "undefined" ? window.innerWidth - 150 : 0;
  const robotY = typeof window !== "undefined" ? window.innerHeight * 0.5 : 0;
  const eyeX = clamp((mouse.x - robotX) / 500, -1.5, 1.5) * 3;
  const eyeY = clamp((mouse.y - robotY) / 500, -1, 1) * 2.5;
  const nearRobot = typeof window !== "undefined" ? Math.hypot(mouse.x - robotX, mouse.y - robotY) < 220 : false;
  const eyeScale = nearRobot ? 1.15 : 1;
  const leanTilt = clamp((mouse.x - robotX) / 220, -1, 1) * 5;
  const scrollTilt = clamp(scrollY / 280, -1, 1) * 6;
  const robotTilt = reducedMotionRef.current ? 0 : leanTilt + scrollTilt;
  const scrollOpacity = clamp(1 - scrollY / 700, 0.5, 1);
  const robotScale = isHovering ? 1.06 : 1;
  const glowAmount = isHovering ? 1.2 : 0.7;

  const robotInlineStyle = {
    ["--robot-tilt" as string]: `${robotTilt}deg`,
    ["--robot-scale" as string]: String(robotScale),
    ["--robot-glow" as string]: String(glowAmount),
    ["--robot-opacity" as string]: String(scrollOpacity),
    ["--eye-shift-x" as string]: `${eyeX}px`,
    ["--eye-shift-y" as string]: `${eyeY}px`,
    ["--eye-scale" as string]: String(eyeScale),
    ["--scan-opacity" as string]: scan ? "1" : "0",
  } as React.CSSProperties;

  if (!isMounted) return null;

  return (
    <div className={`robot-assistant ${isExpanded ? "is-expanded" : ""}`} style={robotInlineStyle} aria-live="polite">
      {!isExpanded && showBubble ? (
        <button type="button" className="robot-bubble" onClick={() => setIsExpanded(true)}>
          <span className="robot-bubble-text">{typedText || ""}</span>
        </button>
      ) : null}

      <div className="robot-figure-wrap">
        <span className="robot-shadow" aria-hidden="true" />
        <button
          type="button"
          className={`robot-trigger ${isHovering ? "is-hover" : ""} ${activeBounce ? "is-bouncing" : ""} ${blink ? "is-blinking" : ""}`}
          aria-label={isExpanded ? "Hide assistant" : "Open assistant"}
          onClick={() => setIsExpanded((value) => !value)}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <svg className="robot-svg" viewBox="0 0 180 180" role="img" aria-label="Friendly robot assistant">
            <defs>
              <linearGradient id="orb-shell" x1="18%" y1="14%" x2="88%" y2="90%">
                <stop offset="0%" stopColor="rgba(129,247,208,0.56)" />
                <stop offset="28%" stopColor="rgba(16,24,31,0.86)" />
                <stop offset="62%" stopColor="rgba(10,15,22,0.9)" />
                <stop offset="100%" stopColor="rgba(8,11,18,0.96)" />
              </linearGradient>
              <linearGradient id="orb-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#81f7d0" stopOpacity="0.9" />
                <stop offset="45%" stopColor="#00e5a0" stopOpacity="0.72" />
                <stop offset="100%" stopColor="#7ab8ff" stopOpacity="0.45" />
              </linearGradient>
              <radialGradient id="orb-highlight" cx="32%" cy="26%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="26%" stopColor="rgba(255,255,255,0.28)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>

            <g className="robot-body">
              <ellipse cx="90" cy="92" rx="64" ry="58" fill="url(#orb-shell)" stroke="url(#orb-sheen)" strokeWidth="2.4" opacity="0.92" />
              <ellipse cx="90" cy="92" rx="62" ry="56" fill="none" stroke="rgba(129,247,208,0.18)" strokeWidth="1.5" />
              <ellipse cx="74" cy="68" rx="30" ry="18" fill="url(#orb-highlight)" opacity="0.8" />
              <ellipse cx="102" cy="108" rx="38" ry="18" fill="rgba(0,0,0,0.12)" opacity="0.5" />

              <g className="robot-eyes" style={{ transform: `translate(${eyeX}px, ${eyeY}px)` }}>
                <path
                  d="M58 88c10-12 24-12 34 0-10 12-24 12-34 0Z"
                  fill="rgba(143,242,208,0.18)"
                  stroke="#8ef2d0"
                  strokeWidth="3"
                  transform={`scale(${eyeScale})`}
                  opacity={blink ? 0.24 : 1}
                />
                <path
                  d="M88 88c10-12 24-12 34 0-10 12-24 12-34 0Z"
                  fill="rgba(143,242,208,0.18)"
                  stroke="#8ef2d0"
                  strokeWidth="3"
                  transform={`scale(${eyeScale})`}
                  opacity={blink ? 0.24 : 1}
                />
              </g>

              <path d="M52 122c12 8 30 12 60 12 20 0 38-4 54-12" fill="none" stroke="rgba(122,184,255,0.7)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              <rect
                x="48"
                y={scan ? 32 : 106}
                width="84"
                height="8"
                rx="4"
                fill="url(#orb-sheen)"
                opacity={scan ? 1 : 0.18}
                style={{ transition: "all 220ms ease" }}
              />
            </g>

            <g className="robot-arm">
              <circle cx="148" cy="96" r="12" fill="rgba(24,32,41,0.35)" stroke="url(#orb-sheen)" strokeWidth="2" />
              <circle cx="148" cy="96" r="6" fill="rgba(143,242,208,0.8)" stroke="#7ab8ff" strokeWidth="1.5" />
            </g>
          </svg>
        </button>
      </div>

      {isExpanded ? (
        <div role="dialog" aria-label="Migration rehearsal assistant" className="robot-panel">
          <button type="button" className="robot-panel-close" aria-label="Close assistant" onClick={dismiss}>
            <X size={15} />
          </button>

          <div className="robot-panel-header">
            <div className="robot-panel-avatar" aria-hidden="true">
              <Sparkles size={14} />
            </div>
            <div>
              <div className="robot-panel-label">Agent</div>
              <div className="robot-panel-name">Migration assistant</div>
            </div>
          </div>

          <p className="robot-panel-copy">👋 Hello! I&apos;m here to help you rehearse your migration. Want a quick walkthrough?</p>

          <div className="robot-panel-actions">
            <Link href="/connect" className="button-primary robot-cta" onClick={dismiss}>
              <span>Start walkthrough</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
