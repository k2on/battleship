"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type GameStatus = "waiting" | "active" | "finished";

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

interface Move {
  player_id: number;
  row: number;
  col: number;
  hit: boolean;
  created_at: string;
}

interface FireResult {
  hit: boolean;
  row: number;
  col: number;
  game_over: boolean;
  game_status: string;
  sunk?: string;
  winner_id?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortId(id: string | number | null | undefined) {
  if (!id) return "—";
  return id.toString().slice(0, 8).toUpperCase();
}

// ── Grid Cell ─────────────────────────────────────────────────────────────────

type CellState = "empty" | "hit" | "miss" | "ship";

function GridCell({
  state,
  onClick,
  disabled,
  size,
}: {
  state: CellState;
  onClick?: () => void;
  disabled?: boolean;
  size: number;
}) {
  const cellSize = Math.max(28, Math.min(48, Math.floor(420 / size)));
  return (
    <button
      className={`cell cell--${state}${disabled ? " cell--disabled" : ""}`}
      onClick={onClick}
      disabled={disabled || !onClick}
      style={{ width: cellSize, height: cellSize, fontSize: cellSize * 0.4 }}
      aria-label={state}
    >
      {state === "hit" ? "✕" : state === "miss" ? "·" : ""}
      <style jsx>{`
        .cell {
          border: 1px solid var(--steel);
          background: var(--cell-bg, var(--navy-mid));
          color: var(--cell-color, transparent);
          cursor: default;
          transition: background 0.15s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--mono);
          font-weight: 700;
          flex-shrink: 0;
        }
        .cell--empty:not(.cell--disabled) {
          cursor: crosshair;
        }
        .cell--empty:not(.cell--disabled):hover {
          background: rgba(0, 212, 255, 0.12);
          border-color: var(--cyan);
          transform: scale(1.05);
        }
        .cell--hit {
          --cell-bg: rgba(255, 51, 51, 0.25);
          --cell-color: var(--red);
          border-color: var(--red);
        }
        .cell--miss {
          --cell-bg: rgba(74, 96, 128, 0.2);
          --cell-color: var(--muted);
          border-color: var(--steel);
        }
        .cell--ship {
          --cell-bg: rgba(0, 212, 255, 0.15);
          border-color: rgba(0, 212, 255, 0.4);
        }
        .cell--disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }
      `}</style>
    </button>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function BattleGrid({
  size,
  moves,
  viewerPlayerId,
  isOpponentGrid,
  onFire,
  canFire,
}: {
  size: number;
  moves: Move[];
  viewerPlayerId: string | null;
  isOpponentGrid: boolean;
  onFire?: (row: number, col: number) => void;
  canFire: boolean;
}) {
  const firedSet = new Set(
    moves
      .filter((m) => m.player_id.toString() === viewerPlayerId)
      .map((m) => `${m.row},${m.col}`)
  );
  const hitSet = new Set(
    moves
      .filter((m) => m.player_id.toString() === viewerPlayerId && m.hit)
      .map((m) => `${m.row},${m.col}`)
  );
  const incomingHitSet = new Set(
    moves
      .filter((m) => m.player_id.toString() !== viewerPlayerId && m.hit)
      .map((m) => `${m.row},${m.col}`)
  );

  const cols = Array.from({ length: size }, (_, i) => String.fromCharCode(65 + i));
  const rows = Array.from({ length: size }, (_, i) => i + 1);

  return (
    <div className="grid-wrap">
      {/* Column headers */}
      <div className="grid-labels grid-labels--col" style={{ gridTemplateColumns: `20px repeat(${size}, 1fr)` }}>
        <span />
        {cols.map(c => <span key={c} className="grid-label">{c}</span>)}
      </div>
      <div className="grid-row-wrap">
        {/* Row headers */}
        <div className="grid-labels grid-labels--row">
          {rows.map(r => <span key={r} className="grid-label">{r}</span>)}
        </div>
        {/* Cells */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {rows.map(r =>
            cols.map((_, ci) => {
              const key = `${r - 1},${ci}`;
              let state: CellState = "empty";
              if (isOpponentGrid) {
                if (hitSet.has(key)) state = "hit";
                else if (firedSet.has(key)) state = "miss";
              } else {
                if (incomingHitSet.has(key)) state = "hit";
              }
              return (
                <GridCell
                  key={key}
                  state={state}
                  size={size}
                  disabled={!canFire || !isOpponentGrid || firedSet.has(key)}
                  onClick={
                    isOpponentGrid && canFire && !firedSet.has(key)
                      ? () => onFire?.(r - 1, ci)
                      : undefined
                  }
                />
              );
            })
          )}
        </div>
      </div>
      <style jsx>{`
        .grid-wrap { display: flex; flex-direction: column; gap: 2px; }
        .grid-labels { display: grid; gap: 1px; }
        .grid-labels--col { align-items: center; }
        .grid-labels--row {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          margin-right: 2px;
        }
        .grid-label {
          font-family: var(--mono);
          font-size: 0.55rem;
          color: var(--muted);
          text-align: center;
          letter-spacing: 0.05em;
          line-height: 1;
        }
        .grid-row-wrap { display: flex; }
        .grid {
          display: grid;
          gap: 1px;
          background: var(--navy);
        }
      `}</style>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [playerIdInput, setPlayerIdInput] = useState<string>("");
  const [firing, setFiring] = useState(false);
  const [lastResult, setLastResult] = useState<FireResult | null>(null);
  const [joining, setJoining] = useState(false);
  const prevStatusRef = useRef<GameStatus | null>(null);

  const fetchGame = useCallback(async () => {
    try {
      const [gameRes, movesRes] = await Promise.all([
        fetch(`/api/games/${id}`),
        fetch(`/api/games/${id}/moves`),
      ]);
      if (!gameRes.ok) throw new Error(`Game not found (${gameRes.status})`);
      const gameData = await gameRes.json();
      const movesData = movesRes.ok ? await movesRes.json() : { moves: [] };
      setGame(gameData);
      setMoves(movesData.moves ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load game");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 3000);
    return () => clearInterval(interval);
  }, [fetchGame]);

  // Clear last result when turn changes
  useEffect(() => {
    if (game && prevStatusRef.current === game.status) return;
    prevStatusRef.current = game?.status ?? null;
  }, [game]);

  async function handleJoin() {
    if (!playerIdInput.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerIdInput.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `Server error ${res.status}`);
      }
      setPlayerId(playerIdInput.trim());
      await fetchGame();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  async function handleFire(row: number, col: number) {
    if (!playerId || firing) return;
    setFiring(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/games/${id}/fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, row, col }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      setLastResult(data);
      await fetchGame();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fire");
    } finally {
      setFiring(false);
    }
  }

  const isMyTurn = game?.current_turn === playerId && game?.status === "active";
  const isPlayer = playerId && game?.players.includes(playerId);
  const canJoin = game?.status === "waiting" && (game?.players.length ?? 0) < (game?.max_players ?? 2) && !isPlayer;

  const myMoveCount = moves.filter(m => m.player_id.toString() === playerId).length;
  const theirMoveCount = moves.filter(m => m.player_id.toString() !== playerId).length;
  const myHits = moves.filter(m => m.player_id.toString() === playerId && m.hit).length;

  return (
    <main className="page">
      <div className="bg-grid" aria-hidden="true">
        {Array.from({ length: 100 }).map((_, i) => <div key={i} className="bg-cell" />)}
      </div>

      <div className="inner">
        {/* Top bar */}
        <div className="topbar">
          <Link href="/" className="back-link">← HOME</Link>
          <div className="game-id-badge">
            GAME <span>{id ? shortId(id) : "—"}</span>
          </div>
          {game && (
            <div className={`status-badge status-badge--${game.status}`}>
              <span className="status-dot" />
              {game.status === "waiting" ? "AWAITING ORDERS"
                : game.status === "active" ? "ENGAGEMENT ACTIVE"
                : "MISSION COMPLETE"}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div className="error-banner">⚠ {error} <button onClick={() => setError(null)}>✕</button></div>}

        {loading ? (
          <div className="state-center">
            <div className="spinner" />
            SCANNING...
          </div>
        ) : !game ? (
          <div className="state-center">GAME NOT FOUND</div>
        ) : (
          <>
            {/* Player ID input — shown if not yet identified */}
            {!playerId && (
              <div className="player-panel">
                <div className="panel-label">IDENTIFY YOURSELF, SAILOR</div>
                <div className="player-input-row">
                  <input
                    className="player-input"
                    type="text"
                    placeholder="Enter your player ID..."
                    value={playerIdInput}
                    onChange={e => setPlayerIdInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (canJoin ? handleJoin() : setPlayerId(playerIdInput.trim()))}
                  />
                  {canJoin ? (
                    <button className="btn btn--cyan" onClick={handleJoin} disabled={joining || !playerIdInput.trim()}>
                      {joining ? "BOARDING..." : "JOIN BATTLE"}
                    </button>
                  ) : (
                    <button className="btn btn--outline" onClick={() => setPlayerId(playerIdInput.trim())} disabled={!playerIdInput.trim()}>
                      OBSERVE
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Game info row */}
            <div className="info-row">
              <div className="info-card">
                <span className="info-label">GRID</span>
                <span className="info-value">{game.grid_size}×{game.grid_size}</span>
              </div>
              <div className="info-card">
                <span className="info-label">PLAYER 1</span>
                <span className={`info-value ${game.current_turn === game.player1_id ? "info-value--active" : ""}`}>
                  {shortId(game.player1_id)}
                  {game.current_turn === game.player1_id && game.status === "active" && <span className="firing-tag">FIRING</span>}
                </span>
              </div>
              <div className="info-card">
                <span className="info-label">PLAYER 2</span>
                <span className={`info-value ${game.current_turn === game.player2_id ? "info-value--active" : ""}`}>
                  {game.player2_id ? shortId(game.player2_id) : <span className="info-value--dim">OPEN</span>}
                  {game.current_turn === game.player2_id && game.status === "active" && <span className="firing-tag">FIRING</span>}
                </span>
              </div>
              {game.winner_id && (
                <div className="info-card">
                  <span className="info-label">VICTOR</span>
                  <span className="info-value info-value--winner">⚓ {shortId(game.winner_id)}</span>
                </div>
              )}
            </div>

            {/* Winner banner */}
            {game.status === "finished" && (
              <div className={`winner-banner ${game.winner_id === playerId ? "winner-banner--win" : "winner-banner--loss"}`}>
                {game.winner_id === playerId
                  ? "🏆 VICTORY — YOUR FLEET PREVAILED"
                  : `💀 DEFEAT — ${shortId(game.winner_id)} WINS`}
              </div>
            )}

            {/* Turn banner */}
            {game.status === "active" && playerId && (
              <div className={`turn-banner ${isMyTurn ? "turn-banner--mine" : "turn-banner--theirs"}`}>
                {isMyTurn
                  ? firing ? "⚡ FIRING..." : "🎯 YOUR TURN — SELECT A TARGET"
                  : `⏳ WAITING FOR ${shortId(game.current_turn)} TO FIRE`}
              </div>
            )}

            {/* Last shot result */}
            {lastResult && (
              <div className={`shot-result ${lastResult.hit ? "shot-result--hit" : "shot-result--miss"}`}>
                {lastResult.hit
                  ? lastResult.sunk ? `💥 HIT & SUNK — ${lastResult.sunk.toUpperCase()}` : "💥 DIRECT HIT"
                  : "〰 MISS — SPLASH"}
              </div>
            )}

            {/* Grids */}
            {game.status !== "waiting" && (
              <div className="grids">
                <div className="grid-section">
                  <div className="grid-title">
                    <span className="grid-title-label">YOUR WATERS</span>
                    <span className="grid-title-stat">{theirMoveCount} incoming shots</span>
                  </div>
                  <BattleGrid
                    size={game.grid_size}
                    moves={moves}
                    viewerPlayerId={playerId}
                    isOpponentGrid={false}
                    canFire={false}
                  />
                </div>

                <div className="grid-divider" />

                <div className="grid-section">
                  <div className="grid-title">
                    <span className="grid-title-label">ENEMY WATERS</span>
                    <span className="grid-title-stat">{myHits}/{myMoveCount} hits</span>
                  </div>
                  <BattleGrid
                    size={game.grid_size}
                    moves={moves}
                    viewerPlayerId={playerId}
                    isOpponentGrid={true}
                    onFire={handleFire}
                    canFire={isMyTurn && !firing}
                  />
                </div>
              </div>
            )}

            {/* Waiting state */}
            {game.status === "waiting" && (
              <div className="waiting-state">
                <div className="waiting-pulse">◎</div>
                <div className="waiting-text">AWAITING SECOND PLAYER</div>
                <div className="waiting-sub">Share this game ID: <span className="waiting-id">{id}</span></div>
              </div>
            )}

            {/* Move log */}
            {moves.length > 0 && (
              <div className="move-log">
                <div className="log-title">BATTLE LOG</div>
                <div className="log-list">
                  {[...moves].reverse().slice(0, 10).map((m, i) => (
                    <div key={i} className={`log-entry ${m.hit ? "log-entry--hit" : "log-entry--miss"}`}>
                      <span className="log-player">{shortId(m.player_id)}</span>
                      <span className="log-coords">R{m.row} C{m.col}</span>
                      <span className="log-result">{m.hit ? "HIT" : "MISS"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        :root {
          --navy:     #0a0f1e;
          --navy-mid: #0d1828;
          --steel:    #1e3a5f;
          --cyan:     #00d4ff;
          --amber:    #ffb800;
          --red:      #ff3333;
          --green:    #00ff88;
          --muted:    #4a6080;
          --text:     #c8ddf0;
          --text-dim: #6a8caa;
          --mono:     "Courier New", monospace;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh;
          background: var(--navy);
          font-family: var(--mono);
          color: var(--text);
          position: relative;
        }

        .bg-grid {
          position: fixed; inset: 0;
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(10, 1fr);
          opacity: 0.05; pointer-events: none; z-index: 0;
        }
        .bg-cell { border: 1px solid var(--steel); }

        .inner {
          position: relative; z-index: 1;
          max-width: 1000px; margin: 0 auto;
          padding: 1.5rem 1.25rem 4rem;
          display: flex; flex-direction: column; gap: 1.25rem;
        }

        /* ── Top bar ── */
        .topbar {
          display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
          animation: fade-up 0.4s ease both;
        }
        .back-link {
          font-size: 0.7rem; letter-spacing: 0.2em;
          color: var(--text-dim); text-decoration: none; transition: color 0.2s;
        }
        .back-link:hover { color: var(--cyan); }

        .game-id-badge {
          font-size: 0.65rem; letter-spacing: 0.2em; color: var(--text-dim);
          border: 1px solid var(--steel); padding: 3px 10px;
        }
        .game-id-badge span { color: var(--text); }

        .status-badge {
          font-size: 0.6rem; letter-spacing: 0.18em;
          display: flex; align-items: center; gap: 6px;
          padding: 3px 10px; border: 1px solid;
        }
        .status-badge--waiting  { color: var(--amber); border-color: var(--amber); }
        .status-badge--active   { color: var(--cyan);  border-color: var(--cyan);  }
        .status-badge--finished { color: var(--muted); border-color: var(--muted); }

        .status-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor;
          animation: pulse 2s ease-in-out infinite;
        }

        /* ── Error ── */
        .error-banner {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 0.75rem; letter-spacing: 0.1em;
          color: var(--red); border: 1px solid var(--red); padding: 8px 16px;
        }
        .error-banner button {
          background: none; border: none; color: var(--red);
          cursor: pointer; font-size: 0.8rem;
        }

        /* ── State center ── */
        .state-center {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 1rem; padding: 6rem;
          font-size: 0.8rem; letter-spacing: 0.2em; color: var(--muted);
        }
        .spinner {
          width: 28px; height: 28px;
          border: 2px solid var(--steel); border-top-color: var(--cyan);
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }

        /* ── Player panel ── */
        .player-panel {
          border: 1px solid var(--steel); padding: 1rem 1.25rem;
          display: flex; flex-direction: column; gap: 0.75rem;
          background: var(--navy-mid);
          animation: fade-up 0.4s 0.1s ease both;
        }
        .panel-label {
          font-size: 0.6rem; letter-spacing: 0.25em; color: var(--amber);
        }
        .player-input-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .player-input {
          flex: 1; min-width: 180px;
          background: var(--navy); border: 1px solid var(--steel);
          color: var(--text); font-family: var(--mono); font-size: 0.8rem;
          padding: 0.5rem 0.75rem; outline: none;
          transition: border-color 0.2s;
        }
        .player-input:focus { border-color: var(--cyan); }
        .player-input::placeholder { color: var(--muted); }

        /* ── Buttons ── */
        .btn {
          font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.18em;
          padding: 0.5rem 1.25rem; border: none; cursor: pointer;
          transition: all 0.2s; white-space: nowrap;
        }
        .btn--cyan {
          background: var(--cyan); color: var(--navy); font-weight: 700;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
        }
        .btn--cyan:hover:not(:disabled) { background: #33ddff; transform: translateY(-1px); }
        .btn--outline {
          background: transparent; color: var(--text-dim);
          border: 1px solid var(--steel);
        }
        .btn--outline:hover:not(:disabled) { color: var(--cyan); border-color: var(--cyan); }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Info row ── */
        .info-row {
          display: flex; gap: 0.75rem; flex-wrap: wrap;
          animation: fade-up 0.4s 0.15s ease both;
        }
        .info-card {
          border: 1px solid var(--steel); padding: 0.6rem 1rem;
          display: flex; flex-direction: column; gap: 3px;
          background: var(--navy-mid); flex: 1; min-width: 100px;
        }
        .info-label { font-size: 0.55rem; letter-spacing: 0.25em; color: var(--muted); }
        .info-value { font-size: 0.85rem; color: var(--text); }
        .info-value--active { color: var(--cyan); }
        .info-value--winner { color: var(--amber); }
        .info-value--dim { color: var(--muted); }

        .firing-tag {
          font-size: 0.5rem; letter-spacing: 0.2em; color: var(--red);
          border: 1px solid var(--red); padding: 1px 5px; margin-left: 6px;
          animation: pulse 1s ease-in-out infinite; vertical-align: middle;
        }

        /* ── Banners ── */
        .winner-banner {
          text-align: center; font-size: 0.85rem; letter-spacing: 0.15em;
          padding: 0.75rem; border: 2px solid;
          animation: fade-up 0.4s ease both;
        }
        .winner-banner--win  { color: var(--amber); border-color: var(--amber); background: rgba(255,184,0,0.06); }
        .winner-banner--loss { color: var(--muted); border-color: var(--steel);  background: rgba(74,96,128,0.06); }

        .turn-banner {
          text-align: center; font-size: 0.75rem; letter-spacing: 0.15em;
          padding: 0.6rem; border: 1px solid;
          animation: fade-up 0.3s ease both;
        }
        .turn-banner--mine   { color: var(--cyan);  border-color: var(--cyan);  background: rgba(0,212,255,0.06); }
        .turn-banner--theirs { color: var(--text-dim); border-color: var(--steel); }

        .shot-result {
          text-align: center; font-size: 0.8rem; letter-spacing: 0.12em;
          padding: 0.5rem; animation: fade-up 0.3s ease both;
        }
        .shot-result--hit  { color: var(--red);  border: 1px solid rgba(255,51,51,0.4); }
        .shot-result--miss { color: var(--muted); border: 1px solid var(--steel); }

        /* ── Grids ── */
        .grids {
          display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center;
          animation: fade-up 0.4s 0.2s ease both;
        }
        .grid-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .grid-title {
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .grid-title-label {
          font-size: 0.65rem; letter-spacing: 0.2em; color: var(--text-dim);
        }
        .grid-title-stat {
          font-size: 0.6rem; letter-spacing: 0.1em; color: var(--muted);
        }
        .grid-divider {
          width: 1px; background: var(--steel); align-self: stretch; margin: 0 0.5rem;
        }

        /* ── Waiting ── */
        .waiting-state {
          display: flex; flex-direction: column; align-items: center;
          gap: 1rem; padding: 4rem 2rem;
          animation: fade-up 0.4s ease both;
        }
        .waiting-pulse {
          font-size: 3rem; color: var(--muted); opacity: 0.4;
          animation: pulse 2s ease-in-out infinite;
        }
        .waiting-text { font-size: 0.8rem; letter-spacing: 0.25em; color: var(--text-dim); }
        .waiting-sub  { font-size: 0.65rem; letter-spacing: 0.1em; color: var(--muted); }
        .waiting-id   { color: var(--cyan); }

        /* ── Move log ── */
        .move-log {
          border: 1px solid var(--steel); background: var(--navy-mid);
          animation: fade-up 0.4s 0.25s ease both;
        }
        .log-title {
          font-size: 0.6rem; letter-spacing: 0.25em; color: var(--muted);
          padding: 0.5rem 1rem; border-bottom: 1px solid var(--steel);
        }
        .log-list { display: flex; flex-direction: column; }
        .log-entry {
          display: flex; gap: 1rem; align-items: center;
          padding: 0.4rem 1rem; font-size: 0.7rem; letter-spacing: 0.1em;
          border-bottom: 1px solid rgba(30,58,95,0.4);
          transition: background 0.15s;
        }
        .log-entry:last-child { border-bottom: none; }
        .log-entry--hit  { border-left: 2px solid var(--red); }
        .log-entry--miss { border-left: 2px solid var(--steel); }
        .log-player { color: var(--text-dim); flex: 1; }
        .log-coords { color: var(--text); }
        .log-result { font-size: 0.6rem; letter-spacing: 0.15em; }
        .log-entry--hit  .log-result { color: var(--red); }
        .log-entry--miss .log-result { color: var(--muted); }

        /* ── Animations ── */
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ── Responsive ── */
        @media (max-width: 600px) {
          .grids { gap: 1.5rem; }
          .grid-divider { display: none; }
          .info-card { min-width: 80px; }
        }
      `}</style>
    </main>
  );
}