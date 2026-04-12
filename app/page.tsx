'use client'

import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      {/* Animated ocean grid background */}
      <div className="ocean-grid" aria-hidden="true">
        {Array.from({ length: 100 }).map((_, i) => (
          <div key={i} className="grid-cell" />
        ))}
      </div>

      {/* Sonar ping effect */}
      <div className="sonar" aria-hidden="true">
        <div className="sonar-ring" />
        <div className="sonar-ring" style={{ animationDelay: "0.8s" }} />
        <div className="sonar-ring" style={{ animationDelay: "1.6s" }} />
        <div className="sonar-dot" />
      </div>

      <div className="content">
        {/* Classification stamp */}
        <div className="stamp">TOP SECRET — NAVAL COMMAND</div>

        {/* Title */}
        <h1 className="title">
          <span className="title-sub">OPERATION</span>
          <span className="title-main">BATTLESHIP</span>
        </h1>

        <p className="tagline">
          Locate. Target. Annihilate. The ocean is your battlefield.
        </p>

        {/* Coordinate display */}
        <div className="coords">
          <span className="coord-item">LAT: 51°30′N</span>
          <span className="coord-divider">◆</span>
          <span className="coord-item">LON: 000°07′W</span>
          <span className="coord-divider">◆</span>
          <span className="coord-item">DEPTH: CLASSIFIED</span>
        </div>

        {/* CTA buttons */}
        <div className="actions">
          <Link href="/test/games/new" className="btn btn-primary">
            <span className="btn-icon">⚓</span>
            DEPLOY FLEET
          </Link>
          <Link href="/test/games" className="btn btn-secondary">
            <span className="btn-icon">📡</span>
            ACTIVE MISSIONS
          </Link>
        </div>

        {/* Stats row */}
        <div className="stats">
          <div className="stat">
            <span className="stat-value">10×10</span>
            <span className="stat-label">GRID</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">5</span>
            <span className="stat-label">SHIPS</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">∞</span>
            <span className="stat-label">GLORY</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ── Tokens ── */
        :root {
          --navy: #0a0f1e;
          --navy-mid: #0d1a2e;
          --navy-light: #122040;
          --steel: #1e3a5f;
          --ocean: #0e4d6e;
          --cyan: #00d4ff;
          --amber: #ffb800;
          --red: #ff3333;
          --muted: #4a6080;
          --text: #c8ddf0;
          --text-dim: #6a8caa;
          --font-display: "Courier New", "Courier", monospace;
        }

        /* ── Reset ── */
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ── Layout ── */
        .home {
          min-height: 100vh;
          background: var(--navy);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: var(--font-display);
          color: var(--text);
        }

        /* ── Ocean Grid ── */
        .ocean-grid {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(10, 1fr);
          opacity: 0.12;
          pointer-events: none;
        }

        .grid-cell {
          border: 1px solid var(--steel);
          transition: background 0.3s;
        }

        .grid-cell:nth-child(7),
        .grid-cell:nth-child(23),
        .grid-cell:nth-child(24),
        .grid-cell:nth-child(47),
        .grid-cell:nth-child(63),
        .grid-cell:nth-child(64),
        .grid-cell:nth-child(65),
        .grid-cell:nth-child(82) {
          background: var(--red);
          opacity: 0.9;
          animation: flash 2.4s ease-in-out infinite;
        }

        .grid-cell:nth-child(12),
        .grid-cell:nth-child(35),
        .grid-cell:nth-child(71) {
          background: var(--ocean);
          opacity: 0.6;
        }

        @keyframes flash {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.3; }
        }

        /* ── Sonar ── */
        .sonar {
          position: absolute;
          bottom: -120px;
          right: -120px;
          width: 400px;
          height: 400px;
          pointer-events: none;
        }

        .sonar-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid var(--cyan);
          opacity: 0;
          animation: sonar-pulse 2.4s ease-out infinite;
        }

        .sonar-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background: var(--cyan);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 12px var(--cyan), 0 0 24px var(--cyan);
        }

        @keyframes sonar-pulse {
          0% { transform: scale(0.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0; }
        }

        /* ── Content ── */
        .content {
          position: relative;
          z-index: 10;
          text-align: center;
          padding: 2rem;
          max-width: 720px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          animation: fade-up 0.8s ease both;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Stamp ── */
        .stamp {
          font-size: 0.65rem;
          letter-spacing: 0.25em;
          color: var(--red);
          border: 1px solid var(--red);
          padding: 4px 12px;
          opacity: 0.8;
          animation: fade-up 0.8s 0.1s ease both;
        }

        /* ── Title ── */
        .title {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          line-height: 1;
          animation: fade-up 0.8s 0.2s ease both;
        }

        .title-sub {
          font-size: 0.9rem;
          letter-spacing: 0.5em;
          color: var(--amber);
          font-weight: normal;
        }

        .title-main {
          font-size: clamp(3.5rem, 12vw, 7rem);
          font-weight: 900;
          letter-spacing: 0.08em;
          color: var(--text);
          text-shadow:
            0 0 40px rgba(0, 212, 255, 0.3),
            0 0 80px rgba(0, 212, 255, 0.1);
          position: relative;
        }

        .title-main::after {
          content: "BATTLESHIP";
          position: absolute;
          inset: 0;
          color: var(--cyan);
          opacity: 0.15;
          transform: translate(3px, 3px);
          z-index: -1;
        }

        /* ── Tagline ── */
        .tagline {
          font-size: 0.85rem;
          letter-spacing: 0.15em;
          color: var(--text-dim);
          max-width: 400px;
          animation: fade-up 0.8s 0.3s ease both;
        }

        /* ── Coords ── */
        .coords {
          display: flex;
          gap: 1rem;
          align-items: center;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          color: var(--muted);
          animation: fade-up 0.8s 0.35s ease both;
        }

        .coord-divider {
          font-size: 0.5rem;
          color: var(--steel);
        }

        /* ── Actions ── */
        .actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
          animation: fade-up 0.8s 0.4s ease both;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 2rem;
          font-family: var(--font-display);
          font-size: 0.8rem;
          letter-spacing: 0.2em;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .btn-icon {
          font-size: 1rem;
          letter-spacing: 0;
        }

        .btn-primary {
          background: var(--cyan);
          color: var(--navy);
          font-weight: 700;
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
        }

        .btn-primary:hover {
          background: #33ddff;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 212, 255, 0.35);
        }

        .btn-secondary {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--steel);
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
        }

        .btn-secondary:hover {
          border-color: var(--cyan);
          color: var(--cyan);
          transform: translateY(-2px);
        }

        /* ── Stats ── */
        .stats {
          display: flex;
          align-items: center;
          gap: 2.5rem;
          animation: fade-up 0.8s 0.5s ease both;
          border-top: 1px solid var(--navy-light);
          padding-top: 2rem;
          width: 100%;
          justify-content: center;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--cyan);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.6rem;
          letter-spacing: 0.25em;
          color: var(--muted);
        }

        .stat-divider {
          width: 1px;
          height: 40px;
          background: var(--steel);
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
          .coords { display: none; }
          .actions { flex-direction: column; align-items: stretch; }
          .btn { justify-content: center; }
        }
      `}</style>
    </main>
  );
}