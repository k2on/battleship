"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type GameStatus = "waiting" | "in_progress" | "finished";

interface Game {
  game_id: string;
  player1_id: string;
  player2_id: string | null;
  players: string[];
  status: GameStatus;
  current_turn: string | null;
  winner_id: string | null;
  grid_size: number;
  max_players: number;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<GameStatus, { label: string; color: string }> = {
  waiting:     { label: "AWAITING ORDERS", color: "var(--amber)" },
  in_progress: { label: "ENGAGEMENT ACTIVE", color: "var(--cyan)" },
  finished:    { label: "MISSION COMPLETE", color: "var(--muted)" },
};

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Game Card ─────────────────────────────────────────────────────────────────

function GameCard({ game, onJoin, joining }: {
  game: Game;
  onJoin: (id: string) => void;
  joining: string | null;
}) {
  const cfg = STATUS_CONFIG[game.status] ?? STATUS_CONFIG.waiting;
  const canJoin = game.status === "waiting" && (game.players.length < game.max_players);
  const isJoining = joining === game.game_id;

  return (
    <div className={`card card--${game.status}`}>
      {/* Header row */}
      <div className="card-header">
        <span className="card-id">#{shortId(game.game_id)}</span>
        <span className="card-status" style={{ color: cfg.color }}>
          <span className="status-dot" style={{ background: cfg.color }} />
          {cfg.label}
        </span>
      </div>

      {/* Grid */}
      <div className="card-body">
        <div className="card-meta">
          <div className="meta-item">
            <span className="meta-label">GRID</span>
            <span className="meta-value">{game.grid_size}×{game.grid_size}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">CREW</span>
            <span className="meta-value">{game.players.length}/{game.max_players}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">LAUNCHED</span>
            <span className="meta-value">{timeAgo(game.created_at)}</span>
          </div>
          {game.winner_id && (
            <div className="meta-item">
              <span className="meta-label">VICTOR</span>
              <span className="meta-value meta-value--winner">
                {shortId(game.winner_id)}
              </span>
            </div>
          )}
        </div>

        {/* Player slots */}
        <div className="player-slots">
          {[0, 1].map((i) => {
            const pid = game.players[i];
            return (
              <div key={i} className={`slot ${pid ? "slot--filled" : "slot--empty"}`}>
                {pid ? (
                  <>
                    <span className="slot-icon">⚓</span>
                    <span className="slot-id">{shortId(pid)}</span>
                    {game.current_turn === pid && (
                      <span className="slot-turn">FIRING</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="slot-icon slot-icon--empty">○</span>
                    <span className="slot-empty-label">OPEN BERTH</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="card-footer">
        {canJoin ? (
          <button
            className="card-btn card-btn--join"
            onClick={() => onJoin(game.game_id)}
            disabled={isJoining}
          >
            {isJoining ? "BOARDING..." : "⚡ JOIN BATTLE"}
          </button>
        ) : (
          <Link href={`/games/${game.game_id}`} className="card-btn card-btn--view">
            📡 VIEW MISSION
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamesPage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GameStatus | "all">("all");
  const [joining, setJoining] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/games");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      // Handles both { games: [...] } and plain array
      setGames(Array.isArray(data) ? data : data.games ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [fetchGames]);

  async function handleNewGame() {
    setCreating(true);
    try {
      const res = await fetch("/api/games", { method: "POST" });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      router.push(`/games/${data.game_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game");
      setCreating(false);
    }
  }

  async function handleJoin(gameId: string) {
    setJoining(gameId);
    try {
      const res = await fetch(`/api/games/${gameId}/join`, { method: "POST" });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      router.push(`/games/${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join game");
      setJoining(null);
    }
  }

  const filtered = filter === "all" ? games : games.filter(g => g.status === filter);

  const counts = {
    all: games.length,
    waiting: games.filter(g => g.status === "waiting").length,
    in_progress: games.filter(g => g.status === "in_progress").length,
    finished: games.filter(g => g.status === "finished").length,
  };

  return (
    <main className="page">
      {/* Background grid */}
      <div className="bg-grid" aria-hidden="true">
        {Array.from({ length: 100 }).map((_, i) => (
          <div key={i} className="bg-cell" />
        ))}
      </div>

      <div className="inner">
        {/* Top bar */}
        <div className="topbar">
          <Link href="/" className="back-link">← HOME</Link>
          <h1 className="page-title">
            <span className="page-title-sub">NAVAL</span>
            COMMAND CENTER
          </h1>
          <button
            className={`new-btn${creating ? " new-btn--loading" : ""}`}
            onClick={handleNewGame}
            disabled={creating}
          >
            {creating ? "DEPLOYING..." : "+ NEW GAME"}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="error-banner">⚠ {error}</div>
        )}

        {/* Filter tabs */}
        <div className="filters">
          {(["all", "waiting", "in_progress", "finished"] as const).map(f => (
            <button
              key={f}
              className={`filter-tab${filter === f ? " filter-tab--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "ALL" : f === "in_progress" ? "ACTIVE" : f.toUpperCase().replace("_", " ")}
              <span className="filter-count">{counts[f]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="state-msg">
            <div className="spinner" />
            SCANNING FOR ENEMIES...
          </div>
        ) : filtered.length === 0 ? (
          <div className="state-msg state-msg--empty">
            <div className="empty-icon">◎</div>
            <div>NO MISSIONS FOUND</div>
            <div className="empty-sub">The seas are quiet. Deploy a new fleet.</div>
          </div>
        ) : (
          <div className="grid">
            {filtered.map((game, i) => (
              <div key={game.game_id} style={{ animationDelay: `${i * 0.05}s` }} className="card-wrapper">
                <GameCard game={game} onJoin={handleJoin} joining={joining} />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <span>{games.length} MISSION{games.length !== 1 ? "S" : ""} ON RECORD</span>
          <span>AUTO-REFRESH: 10s</span>
        </div>
      </div>

      <style jsx>{`
        :root {
          --navy:   #0a0f1e;
          --steel:  #1e3a5f;
          --cyan:   #00d4ff;
          --amber:  #ffb800;
          --red:    #ff3333;
          --green:  #00ff88;
          --muted:  #4a6080;
          --text:   #c8ddf0;
          --text-dim: #6a8caa;
          --card-bg: #0d1828;
          --mono: "Courier New", monospace;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Page ── */
        .page {
          min-height: 100vh;
          background: var(--navy);
          font-family: var(--mono);
          color: var(--text);
          position: relative;
          overflow-x: hidden;
        }

        /* ── BG Grid ── */
        .bg-grid {
          position: fixed;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(10, 1fr);
          opacity: 0.06;
          pointer-events: none;
          z-index: 0;
        }
        .bg-cell { border: 1px solid var(--steel); }

        /* ── Inner ── */
        .inner {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem 1.5rem 4rem;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }

        /* ── Top bar ── */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          animation: fade-up 0.5s ease both;
        }

        .back-link {
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          color: var(--text-dim);
          text-decoration: none;
          transition: color 0.2s;
        }
        .back-link:hover { color: var(--cyan); }

        .page-title {
          font-size: clamp(1.1rem, 4vw, 1.6rem);
          font-weight: 900;
          letter-spacing: 0.12em;
          display: flex;
          flex-direction: column;
          line-height: 1;
          text-align: center;
        }
        .page-title-sub {
          font-size: 0.6rem;
          letter-spacing: 0.4em;
          color: var(--amber);
          font-weight: normal;
        }

        .new-btn {
          font-family: var(--mono);
          font-size: 0.75rem;
          letter-spacing: 0.15em;
          padding: 0.6rem 1.25rem;
          background: var(--cyan);
          color: var(--navy);
          font-weight: 700;
          border: none;
          cursor: pointer;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
          transition: all 0.2s;
        }
        .new-btn:hover { background: #33ddff; transform: translateY(-1px); }
        .new-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* ── Error ── */
        .error-banner {
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          color: var(--red);
          border: 1px solid var(--red);
          padding: 8px 16px;
          animation: fade-up 0.3s ease both;
        }

        /* ── Filters ── */
        .filters {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          animation: fade-up 0.5s 0.1s ease both;
          border-bottom: 1px solid var(--steel);
          padding-bottom: 1rem;
        }

        .filter-tab {
          font-family: var(--mono);
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          padding: 5px 14px;
          background: transparent;
          color: var(--text-dim);
          border: 1px solid var(--steel);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .filter-tab:hover { color: var(--text); border-color: var(--muted); }
        .filter-tab--active {
          color: var(--cyan);
          border-color: var(--cyan);
          background: rgba(0, 212, 255, 0.06);
        }

        .filter-count {
          font-size: 0.6rem;
          background: var(--steel);
          padding: 1px 5px;
          border-radius: 2px;
          color: var(--text-dim);
        }
        .filter-tab--active .filter-count {
          background: rgba(0, 212, 255, 0.2);
          color: var(--cyan);
        }

        /* ── State messages ── */
        .state-msg {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 5rem 2rem;
          font-size: 0.8rem;
          letter-spacing: 0.2em;
          color: var(--muted);
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 2px solid var(--steel);
          border-top-color: var(--cyan);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-icon {
          font-size: 2.5rem;
          opacity: 0.3;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        .empty-sub { font-size: 0.65rem; color: var(--text-dim); letter-spacing: 0.1em; }

        /* ── Game grid ── */
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }

        .card-wrapper {
          animation: fade-up 0.4s ease both;
        }

        /* ── Card ── */
        .card {
          background: var(--card-bg);
          border: 1px solid var(--steel);
          display: flex;
          flex-direction: column;
          gap: 0;
          transition: border-color 0.2s, transform 0.2s;
          position: relative;
          overflow: hidden;
        }
        .card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--steel);
          transition: background 0.2s;
        }
        .card--waiting::before   { background: var(--amber); }
        .card--in_progress::before { background: var(--cyan); }
        .card--finished::before  { background: var(--muted); }

        .card:hover {
          border-color: var(--muted);
          transform: translateY(-2px);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(30, 58, 95, 0.5);
        }

        .card-id {
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          color: var(--text-dim);
        }

        .card-status {
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        .card-body {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          flex: 1;
        }

        .card-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.6rem;
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .meta-label {
          font-size: 0.55rem;
          letter-spacing: 0.25em;
          color: var(--muted);
        }
        .meta-value {
          font-size: 0.8rem;
          color: var(--text);
        }
        .meta-value--winner {
          color: var(--amber);
        }

        /* ── Player slots ── */
        .player-slots {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .slot {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.6rem;
          border: 1px solid var(--steel);
          font-size: 0.7rem;
          letter-spacing: 0.1em;
        }
        .slot--filled { border-color: rgba(0, 212, 255, 0.2); }
        .slot--empty  { border-color: var(--steel); opacity: 0.5; border-style: dashed; }

        .slot-icon { font-size: 0.8rem; }
        .slot-icon--empty { color: var(--muted); }
        .slot-id { color: var(--text); flex: 1; }
        .slot-empty-label { color: var(--muted); font-size: 0.65rem; letter-spacing: 0.15em; }

        .slot-turn {
          font-size: 0.55rem;
          letter-spacing: 0.2em;
          color: var(--red);
          border: 1px solid var(--red);
          padding: 1px 5px;
          animation: pulse 1s ease-in-out infinite;
        }

        /* ── Card footer ── */
        .card-footer {
          padding: 0.75rem 1rem;
          border-top: 1px solid rgba(30, 58, 95, 0.5);
        }

        .card-btn {
          display: block;
          width: 100%;
          text-align: center;
          font-family: var(--mono);
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          padding: 0.5rem;
          text-decoration: none;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .card-btn--join {
          background: var(--cyan);
          color: var(--navy);
          font-weight: 700;
          clip-path: polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%);
        }
        .card-btn--join:hover { background: #33ddff; }
        .card-btn--join:disabled { opacity: 0.5; cursor: not-allowed; }

        .card-btn--view {
          background: transparent;
          color: var(--text-dim);
          border: 1px solid var(--steel);
        }
        .card-btn--view:hover { color: var(--cyan); border-color: var(--cyan); }

        /* ── Footer ── */
        .footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          color: var(--muted);
          border-top: 1px solid var(--steel);
          padding-top: 1rem;
        }

        /* ── Animations ── */
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Responsive ── */
        @media (max-width: 500px) {
          .topbar { justify-content: center; }
          .page-title { display: none; }
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}