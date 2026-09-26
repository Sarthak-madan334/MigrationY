class InteractiveBot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    if (this.shadowRoot.innerHTML) return;

    const accent = this.getAttribute("accent") || "#7ae6d1";
    const greeting = this.getAttribute("greeting") || "Hello! 👋";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.shadowRoot.innerHTML = `
      <style>
        /*
          Customizable settings:
          - Colors: update the CSS variables below.
          - Greeting text: change the greeting attribute on the element or edit the default here.
          - Position: adjust the host's right/top values here.
        */
        :host {
          --bot-accent: ${accent};
          --bot-accent-soft: rgba(122, 230, 209, 0.22);
          --bot-stroke: #8feee0;
          --bot-stroke-strong: #bffef3;
          --bot-base: rgba(8, 14, 22, 0.88);
          --bot-glow: rgba(122, 230, 209, 0.18);
          --bubble-bg: rgba(10, 16, 24, 0.9);
          --bubble-border: rgba(143, 238, 224, 0.28);
          --bubble-text: #eef7ff;
          --shadow: rgba(0, 0, 0, 0.44);
          position: absolute;
          right: clamp(18px, 2vw, 44px);
          top: 52%;
          width: clamp(160px, 18vw, 220px);
          transform: translateY(-50%);
          display: block;
          z-index: 6;
          pointer-events: auto;
        }

        * { box-sizing: border-box; }

        .bot-wrap {
          position: relative;
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 12px;
        }

        .bubble {
          position: absolute;
          left: 50%;
          bottom: calc(100% - 6px);
          padding: 10px 14px;
          border-radius: 16px;
          border: 1px solid var(--bubble-border);
          background: var(--bubble-bg);
          box-shadow: 0 0 0 1px rgba(143, 238, 224, 0.12), 0 18px 42px rgba(3, 11, 18, 0.38), 0 0 28px rgba(122, 230, 209, 0.1);
          font: 600 0.8rem/1.2 "Inter", sans-serif;
          letter-spacing: 0.01em;
          color: var(--bubble-text);
          white-space: nowrap;
          transform: translateX(-50%);
          transform-origin: bottom center;
          animation: bubble-in 420ms cubic-bezier(.2, .9, .2, 1) both;
        }

        .bubble::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -7px;
          width: 12px;
          height: 12px;
          background: var(--bubble-bg);
          border-right: 1px solid var(--bubble-border);
          border-bottom: 1px solid var(--bubble-border);
          transform: translateX(-50%) rotate(45deg);
        }

        .bot-stage {
          position: relative;
          display: block;
          width: 100%;
          animation: float-in 700ms cubic-bezier(.16,1,.3,1) both;
          filter: drop-shadow(0 18px 34px rgba(2, 10, 20, 0.44));
          transition: transform 240ms ease, filter 240ms ease;
        }

        .bot-stage:hover {
          transform: translateY(-2px) scale(1.01);
          filter: drop-shadow(0 20px 38px rgba(19, 38, 52, 0.5));
        }

        .bot-stage.is-bobbing {
          animation: bob 3.2s ease-in-out infinite;
        }

        .bot-stage.is-blinking .eye-shape {
          transform: scaleY(0.2);
          transform-origin: center;
        }

        .bot-stage.is-bright {
          filter: drop-shadow(0 0 18px rgba(122, 230, 209, 0.22)) drop-shadow(0 18px 34px rgba(2, 10, 20, 0.52));
        }

        .bot-stage.is-bright .signal-orbit,
        .bot-stage.is-bright .signal-orbit.alt {
          animation-duration: 9s;
          opacity: 1;
        }

        .bot-stage.is-waving .arm-right {
          animation: arm-wave 2.8s ease-in-out infinite;
        }

        .bot-svg {
          width: 100%;
          height: auto;
          display: block;
        }

        .bot-head-glow,
        .bot-head {
          fill: rgba(122, 230, 209, 0.12);
          stroke: url(#bot-outline-gradient);
          stroke-width: 2.4;
          stroke-linejoin: round;
        }

        .bot-head {
          fill: var(--bot-base);
        }

        .antenna-line {
          stroke: url(#bot-outline-gradient);
          stroke-width: 2;
          stroke-linecap: round;
        }

        .antenna-tip {
          fill: var(--bot-accent);
          stroke: var(--bot-stroke-strong);
          stroke-width: 1.2;
        }

        .arm {
          transform-box: fill-box;
        }

        .arm-left {
          transform-origin: 76px 120px;
        }

        .arm-right {
          transform-origin: 146px 116px;
        }

        .arm-line,
        .arm-finger {
          fill: none;
          stroke: url(#bot-outline-gradient);
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .arm-base {
          fill: rgba(8, 14, 22, 0.2);
          stroke: url(#bot-outline-gradient);
          stroke-width: 1.8;
        }

        .eye-shape {
          fill: rgba(122, 230, 209, 0.12);
          stroke: url(#bot-outline-gradient);
          stroke-width: 2.1;
          transition: transform 180ms ease, opacity 180ms ease;
        }

        .pupil {
          fill: var(--bot-accent);
          opacity: 0.9;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform 120ms ease-out;
        }

        .smile {
          fill: none;
          stroke: rgba(143, 238, 224, 0.8);
          stroke-width: 2.1;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .signal-orbit {
          fill: none;
          stroke: rgba(143, 238, 224, 0.7);
          stroke-width: 1.2;
          stroke-linecap: round;
          stroke-dasharray: 4 10;
          transform-origin: 110px 110px;
          animation: orbit-spin 24s linear infinite;
          opacity: 0.8;
        }

        .signal-orbit.alt {
          animation-duration: 30s;
          animation-direction: reverse;
          stroke: rgba(122, 230, 209, 0.5);
        }

        .signal-node {
          fill: rgba(122, 230, 209, 0.8);
          opacity: 0.8;
        }

        .sparkle {
          fill: rgba(143, 238, 224, 0.9);
          transform-origin: center;
          animation: sparkle-fade 2.8s ease-in-out infinite;
        }

        .shadow {
          fill: rgba(0, 0, 0, 0.36);
          filter: blur(8px);
          opacity: 0.85;
        }

        @keyframes float-in {
          0% { opacity: 0; transform: translateY(18px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes bubble-in {
          0% { opacity: 0; transform: translateX(calc(-50% + 10px)) translateY(6px) scale(0.96); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes orbit-spin {
          0% { transform: rotate(0deg); opacity: 0.75; }
          50% { opacity: 1; }
          100% { transform: rotate(360deg); opacity: 0.75; }
        }

        @keyframes arm-wave {
          0%, 100% { transform: rotate(0deg) translateY(0px); }
          18% { transform: rotate(8deg) translateY(-1px); }
          40% { transform: rotate(-16deg) translateY(-2px); }
          58% { transform: rotate(10deg) translateY(-1px); }
          78% { transform: rotate(-8deg) translateY(0px); }
        }

        @keyframes sparkle-fade {
          0%, 100% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.25); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bubble,
          .bot-stage,
          .signal-orbit {
            animation: none !important;
          }

          .bot-stage {
            transform: none !important;
          }
        }

        @media (max-width: 760px) {
          :host {
            right: 12px;
            width: clamp(138px, 32vw, 180px);
          }

          .bubble {
            left: 50%;
            bottom: calc(100% - 6px);
            font-size: 0.72rem;
            padding: 9px 12px;
          }
        }
      </style>

      <div class="bot-wrap">
        <div class="bubble" aria-live="polite">${greeting}</div>

        <div class="bot-stage" aria-label="AI assistant mascot" role="img">
          <svg class="bot-svg" viewBox="0 0 220 220" aria-hidden="true">
            <g aria-hidden="true">
              <ellipse class="shadow" cx="110" cy="178" rx="52" ry="15"></ellipse>
            </g>

            <defs>
              <linearGradient id="bot-outline-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#a7f8ea"/>
                <stop offset="45%" stop-color="#7ae6d1"/>
                <stop offset="100%" stop-color="#86caff"/>
              </linearGradient>
            </defs>

            <g aria-hidden="true">
              <ellipse class="shadow" cx="110" cy="178" rx="52" ry="15"></ellipse>
            </g>

            <g aria-hidden="true" class="signal-lines">
              <circle class="signal-orbit" cx="110" cy="110" r="70"></circle>
              <circle class="signal-orbit alt" cx="110" cy="110" r="86"></circle>
              <circle class="signal-node" cx="180" cy="110" r="4"></circle>
              <path class="sparkle" d="M180 82 l2 8 l8 2 l-8 2 l-2 8 l-2 -8 l-8 -2 l8 -2 Z" transform="translate(0 0)"></path>
            </g>

            <g aria-hidden="true" class="antenna">
              <line class="antenna-line" x1="110" y1="18" x2="110" y2="48"></line>
              <circle class="antenna-tip" cx="110" cy="14" r="7"></circle>
            </g>

            <g aria-hidden="true" class="bot-shell">
              <circle class="bot-head-glow" cx="110" cy="100" r="42"></circle>
              <circle class="bot-head" cx="110" cy="100" r="42"></circle>

              <g class="eyes" aria-hidden="true">
                <ellipse class="eye-shape" cx="94" cy="98" rx="9" ry="11"></ellipse>
                <ellipse class="eye-shape" cx="126" cy="98" rx="9" ry="11"></ellipse>
                <g class="pupil-group">
                  <circle class="pupil" cx="94" cy="99" r="3.8"></circle>
                  <circle class="pupil" cx="126" cy="99" r="3.8"></circle>
                </g>
              </g>

              <path class="smile" d="M97 118 Q110 128 123 118" />
            </g>

            <g class="arm arm-left" aria-hidden="true">
              <path class="arm-line" d="M72 112 C62 116 58 126 60 136" />
              <path class="arm-base" d="M57 137 C60 134 64 134 67 137 C66 141 60 144 57 137 Z" />
              <path class="arm-finger" d="M58 138 L63 133" />
              <path class="arm-finger" d="M61 140 L66 136" />
              <path class="arm-finger" d="M63 143 L68 141" />
            </g>

            <g class="arm arm-right" aria-hidden="true">
              <path class="arm-line" d="M148 112 C160 106 170 108 177 117" />
              <path class="arm-base" d="M178 118 C181 114 186 115 188 119 C185 125 180 126 178 118 Z" />
              <path class="arm-finger" d="M179 120 L186 116" />
              <path class="arm-finger" d="M180 124 L187 122" />
              <path class="arm-finger" d="M180 127 L187 130" />
            </g>
          </svg>
        </div>
      </div>
    `;

    this._bindInteractions(reducedMotion);
  }

  _bindInteractions(reducedMotion) {
    const stage = this.shadowRoot.querySelector(".bot-stage");
    const pupils = this.shadowRoot.querySelectorAll(".pupil");

    if (!reducedMotion) {
      stage.classList.add("is-bobbing");
      window.setTimeout(() => stage.classList.add("is-waving"), 1100);
    }

    const moveEyes = (event) => {
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = ((event.clientX - cx) / rect.width) * 8;
      const dy = ((event.clientY - cy) / rect.height) * 6;
      const clampedX = Math.max(-3.5, Math.min(3.5, dx));
      const clampedY = Math.max(-3, Math.min(3, dy));

      pupils.forEach((pupil) => {
        pupil.setAttribute("transform", `translate(${clampedX} ${clampedY})`);
      });
    };

    const blink = () => {
      if (reducedMotion) return;
      stage.classList.add("is-blinking");
      window.setTimeout(() => stage.classList.remove("is-blinking"), 170);
    };

    const scheduleBlink = () => {
      if (reducedMotion) return;
      const next = 2200 + Math.random() * 2800;
      window.setTimeout(() => {
        blink();
        scheduleBlink();
      }, next);
    };

    stage.addEventListener("pointerenter", () => {
      stage.classList.add("is-bright");
      stage.classList.add("is-waving");
      if (!reducedMotion) {
        window.setTimeout(() => stage.classList.remove("is-bright"), 220);
      }
    });

    stage.addEventListener("pointerleave", () => {
      stage.classList.remove("is-bright");
      if (!reducedMotion) {
        stage.classList.remove("is-waving");
      }
      pupils.forEach((pupil) => pupil.setAttribute("transform", "translate(0 0)"));
    });

    window.addEventListener("pointermove", moveEyes, { passive: true });
    scheduleBlink();

    if (!reducedMotion) {
      stage.addEventListener("pointerenter", () => { stage.classList.add("is-bobbing"); });
      stage.addEventListener("pointerleave", () => { stage.classList.remove("is-bobbing"); });
    }
  }
}

if (!customElements.get("interactive-bot")) {
  customElements.define("interactive-bot", InteractiveBot);
}
