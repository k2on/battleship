"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface GameSummary {
  game_id: number;
  status: string;
}

const DEFAULT_URL = process.env.NODE_ENV === "production" ? "https://battleship.koon.us" : "http://localhost:3000";

export default function Home() {
  const router = useRouter();

  const ref = useRef<HTMLInputElement>(null);
  const [baseUrl, setBaseUrl] = useState<string>();

  async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
    if (baseUrl == undefined) throw Error("No base url");
    const res = await fetch(baseUrl != DEFAULT_URL ? "/api/proxy?r=" + encodeURIComponent(baseUrl + url) : url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status });
    }
    return res.json();
  }

  const [playerId, setPlayerId] = useState<number | null>(null);
  const [players, setPlayers] = useState<Array<{ player_id: number; username: string }>>([]);
  const [newUsername, setNewUsername] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [showPlayerPanel, setShowPlayerPanel] = useState(false);
  const [playerPage, setPlayerPage] = useState(0);
  const PLAYERS_PER_PAGE = 5;

  const [games, setGames] = useState<GameSummary[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamePage, setGamePage] = useState(0);
  const GAMES_PER_PAGE = 5;

  const [gridSize, setGridSize] = useState(10);
  const [creatingGame, setCreatingGame] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinId, setJoinId] = useState("");
  const [joiningById, setJoiningById] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const storedUrl = localStorage.getItem("battleship_url");
    if (storedUrl) setBaseUrl(storedUrl);
  }, []);

  function updateBaseUrl(selected: string | undefined) {
    if (selected) {
      localStorage.setItem("battleship_url", selected);
    } else {
      localStorage.removeItem("battleship_url");
    }
    setBaseUrl(selected);
  }

  useEffect(() => {
    const stored = localStorage.getItem("battleship_player_id");
    if (stored) setPlayerId(Number(stored));

    fetchJson<Array<{ player_id: number; username: string }>>("/api/players")
      .then(setPlayers).catch(() => { });

    fetchJson<GameSummary[]>("/api/games")
      .then(setGames).catch(() => { }).finally(() => setLoadingGames(false));
  }, [baseUrl]);

  function selectPlayer(id: number) {
    setPlayerId(id);
    localStorage.setItem("battleship_player_id", String(id));
    setShowPlayerPanel(false);
  }

  async function createPlayer() {
    if (!newUsername.trim()) return;
    setCreatingPlayer(true);
    setPlayerError("");
    try {
      const res = await fetchJson<{ player_id: number }>("/api/players", {
        method: "POST",
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      const updated = await fetchJson<Array<{ player_id: number; username: string }>>("/api/players");
      setPlayers(updated);
      selectPlayer(res.player_id);
      setNewUsername("");
    } catch (e: any) {
      setPlayerError(e.message ?? "Failed to create player");
    } finally {
      setCreatingPlayer(false);
    }
  }

  async function handleNewGame() {
    if (!playerId) { setCreateError("SELECT A COMMANDER FIRST"); return; }
    setCreatingGame(true);
    setCreateError(null);
    try {
      const res = await fetchJson<{ game_id: number; status: string }>("/api/games", {
        method: "POST",
        body: JSON.stringify({ creator_id: playerId, grid_size: gridSize, max_players: 2 }),
      });
      await fetchJson(`/api/games/${res.game_id}/join`, {
        method: "POST",
        body: JSON.stringify({ player_id: playerId }),
      }).catch((e) => { if (e.status !== 409) throw e; });
      router.push(`/games/${res.game_id}`);
    } catch (e: any) {
      setCreateError(e instanceof Error ? e.message : "FAILED TO DEPLOY FLEET");
      setCreatingGame(false);
    }
  }

  async function handleJoinById() {
    const id = parseInt(joinId.trim(), 10);
    if (isNaN(id)) { setJoinError("INVALID COORDINATES"); return; }
    if (!playerId) { setJoinError("SELECT A COMMANDER FIRST"); return; }
    setJoiningById(true);
    setJoinError(null);
    try {
      await fetchJson(`/api/games/${id}`);
      await fetchJson(`/api/games/${id}/join`, {
        method: "POST",
        body: JSON.stringify({ player_id: playerId }),
      }).catch((e) => { if (e.status !== 409) throw e; });
      router.push(`/games/${id}`);
    } catch (e: any) {
      setJoinError(e.message === "not_found" ? `GAME #${id} NOT FOUND` : "FAILED TO INFILTRATE");
      setJoiningById(false);
    }
  }

  const currentUsername = players.find((p) => p.player_id === playerId)?.username;
  const activeGames = games.filter((g) => g.status !== "finished");
  const finishedCount = games.filter((g) => g.status === "finished").length;

  const totalPlayerPages = Math.ceil(players.length / PLAYERS_PER_PAGE);
  const pagedPlayers = players.slice(playerPage * PLAYERS_PER_PAGE, (playerPage + 1) * PLAYERS_PER_PAGE);

  const totalGamePages = Math.ceil(activeGames.length / GAMES_PER_PAGE);
  const pagedGames = activeGames.slice(gamePage * GAMES_PER_PAGE, (gamePage + 1) * GAMES_PER_PAGE);

  const statusLabel: Record<string, string> = {
    waiting_setup: "STANDBY",
    playing: "ACTIVE",
    finished: "CONCLUDED",
  };

  return (
    <main className="home">
      {baseUrl == undefined ? <div className="inset-0 fixed bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded py-8 px-12 flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Base URL</h1>
          <p>Please enter the URL of the server to test. Otherwise, we will use "{DEFAULT_URL}"</p>
          <input ref={ref} placeholder={DEFAULT_URL} />
          <button onClick={() => {
            const selected = ref.current?.value || DEFAULT_URL;
            updateBaseUrl(selected);
          }} className="bg-black text-white rounded-sm">Continue</button>
        </div>
      </div> : <div className="fixed left-0 top-0 z-50">Selected URL: {baseUrl} <button className="underline" onClick={() => updateBaseUrl(undefined)}>Change</button></div>}
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

        {/* Commander (player) selection */}
        <div className="commander-section">
          {playerId ? (
            <div className="commander-active">
              <span className="commander-label">COMMANDER</span>
              <span className="commander-name">{currentUsername ?? `#${playerId}`}</span>
              <button className="btn-link" onClick={() => setShowPlayerPanel(!showPlayerPanel)}>
                {showPlayerPanel ? "▲ CLOSE" : "▼ CHANGE"}
              </button>
            </div>
          ) : (
            <div className="commander-active">
              <span className="commander-label warn">⚠ NO COMMANDER SELECTED</span>
              <button className="btn-link" onClick={() => setShowPlayerPanel(!showPlayerPanel)}>
                {showPlayerPanel ? "▲ CLOSE" : "▼ SELECT COMMANDER"}
              </button>
            </div>
          )}

          {showPlayerPanel && (
            <div className="player-panel">
              {players.length > 0 && (
                <div className="player-list">
                  <div className="panel-label">SELECT EXISTING</div>
                  {pagedPlayers.map((p) => (
                    <button key={p.player_id} className={`player-row${p.player_id === playerId ? " player-row-active" : ""}`}
                      onClick={() => selectPlayer(p.player_id)}>
                      <span className="player-id">#{p.player_id}</span>
                      <span className="player-name">{p.username}</span>
                      {p.player_id === playerId && <span className="player-check">◆ ACTIVE</span>}
                    </button>
                  ))}
                  {totalPlayerPages > 1 && (
                    <div className="pagination">
                      <button className="page-btn" onClick={() => setPlayerPage(p => Math.max(0, p - 1))} disabled={playerPage === 0}>◀</button>
                      <span className="page-info">{playerPage + 1} / {totalPlayerPages}</span>
                      <button className="page-btn" onClick={() => setPlayerPage(p => Math.min(totalPlayerPages - 1, p + 1))} disabled={playerPage === totalPlayerPages - 1}>▶</button>
                    </div>
                  )}
                </div>
              )}
              <div className="panel-label" style={{ marginTop: players.length > 0 ? "1rem" : 0 }}>ENLIST NEW COMMANDER</div>
              <div className="input-row">
                <input
                  className="naval-input"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPlayer()}
                  placeholder="CALLSIGN"
                  maxLength={30}
                />
                <button className="btn btn-secondary" onClick={createPlayer} disabled={creatingPlayer || !newUsername.trim()}>
                  {creatingPlayer ? "…" : "ENLIST"}
                </button>
              </div>
              {playerError && <div className="error-msg">⚠ {playerError}</div>}
            </div>
          )}
        </div>

        {/* Grid size selector */}
        <div className="grid-size-section">
          <div className="panel-label">GRID SIZE: {gridSize}×{gridSize}</div>
          <div className="slider-row">
            <span className="slider-bound">5</span>
            <input type="range" className="naval-slider" min={5} max={15} step={1} value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))} />
            <span className="slider-bound">15</span>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="actions">
          <button
            className={`btn btn-primary${creatingGame ? " btn-loading" : ""}`}
            onClick={handleNewGame}
            disabled={creatingGame}
          >
            <span className="btn-icon">{creatingGame ? "⏳" : "⚓"}</span>
            {creatingGame ? "DEPLOYING..." : "DEPLOY FLEET"}
          </button>
        </div>

        {createError && <div className="error-msg">⚠ {createError}</div>}

        {/* Join by ID */}
        <div className="join-section">
          <div className="panel-label">JOIN EXISTING OPERATION</div>
          <div className="input-row">
            <input
              className="naval-input"
              type="number"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinById()}
              placeholder="GAME ID"
              min={1}
            />
            <button className="btn btn-secondary" onClick={handleJoinById} disabled={joiningById || !joinId.trim()}>
              <span className="btn-icon">🎯</span>
              {joiningById ? "LOCKING..." : "INFILTRATE"}
            </button>
          </div>
          {joinError && <div className="error-msg">⚠ {joinError}</div>}
        </div>

        {/* Active games */}
        {!loadingGames && activeGames.length > 0 && (
          <div className="ops-section">
            <div className="panel-label">ACTIVE OPERATIONS</div>
            <div className="ops-list">
              {pagedGames.map((g) => (
                <button key={g.game_id} className="op-row" onClick={() => router.push(`/games/${g.game_id}`)}>
                  <span className="op-id">OP-{String(g.game_id).padStart(4, "0")}</span>
                  <span className={`op-status op-status-${g.status}`}>
                    {statusLabel[g.status] ?? g.status.toUpperCase()}
                  </span>
                  <span className="op-enter">→ ENTER</span>
                </button>
              ))}
            </div>
            {totalGamePages > 1 && (
              <div className="pagination">
                <button className="page-btn" onClick={() => setGamePage(p => Math.max(0, p - 1))} disabled={gamePage === 0}>◀</button>
                <span className="page-info">{gamePage + 1} / {totalGamePages}</span>
                <button className="page-btn" onClick={() => setGamePage(p => Math.min(totalGamePages - 1, p + 1))} disabled={gamePage === totalGamePages - 1}>▶</button>
              </div>
            )}
            {finishedCount > 0 && (
              <div className="ops-footer">{finishedCount} CONCLUDED OPERATION{finishedCount !== 1 ? "S" : ""} NOT SHOWN</div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="stats">
          <div className="stat">
            <span className="stat-value">{gridSize}×{gridSize}</span>
            <span className="stat-label">GRID</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">3</span>
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

        /* * { box-sizing: border-box; margin: 0; padding: 0; } */

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

        .ocean-grid {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(10, 1fr);
          opacity: 0.12;
          pointer-events: none;
        }

        .grid-cell { border: 1px solid var(--steel); transition: background 0.3s; }
        .grid-cell:nth-child(7),.grid-cell:nth-child(23),.grid-cell:nth-child(24),
        .grid-cell:nth-child(47),.grid-cell:nth-child(63),.grid-cell:nth-child(64),
        .grid-cell:nth-child(65),.grid-cell:nth-child(82) {
          background: var(--red); opacity: 0.9; animation: flash 2.4s ease-in-out infinite;
        }
        .grid-cell:nth-child(12),.grid-cell:nth-child(35),.grid-cell:nth-child(71) {
          background: var(--ocean); opacity: 0.6;
        }
        @keyframes flash { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.3; } }

        .sonar {
          position: absolute; bottom: -120px; right: -120px;
          width: 400px; height: 400px; pointer-events: none;
        }
        .sonar-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid var(--cyan); opacity: 0;
          animation: sonar-pulse 2.4s ease-out infinite;
        }
        .sonar-dot {
          position: absolute; top: 50%; left: 50%;
          width: 8px; height: 8px; background: var(--cyan);
          border-radius: 50%; transform: translate(-50%, -50%);
          box-shadow: 0 0 12px var(--cyan), 0 0 24px var(--cyan);
        }
        @keyframes sonar-pulse {
          0% { transform: scale(0.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0; }
        }

        .content {
          position: relative; z-index: 10; text-align: center;
          padding: 2rem; max-width: 720px; width: 100%;
          display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
          animation: fade-up 0.8s ease both;
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .stamp {
          font-size: 0.65rem; letter-spacing: 0.25em; color: var(--red);
          border: 1px solid var(--red); padding: 4px 12px; opacity: 0.8;
        }

        .title { display: flex; flex-direction: column; gap: 0.25rem; line-height: 1; }
        .title-sub { font-size: 0.9rem; letter-spacing: 0.5em; color: var(--amber); font-weight: normal; }
        .title-main {
          font-size: clamp(3.5rem, 12vw, 7rem); font-weight: 900;
          letter-spacing: 0.08em; color: var(--text);
          text-shadow: 0 0 40px rgba(0,212,255,0.3), 0 0 80px rgba(0,212,255,0.1);
          position: relative;
        }
        .title-main::after {
          content: "BATTLESHIP"; position: absolute; inset: 0;
          color: var(--cyan); opacity: 0.15; transform: translate(3px,3px); z-index: -1;
        }

        .tagline { font-size: 0.85rem; letter-spacing: 0.15em; color: var(--text-dim); max-width: 400px; }

        /* ── Commander section ── */
        .commander-section { width: 100%; text-align: left; }

        .commander-active {
          display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
          border: 1px solid var(--steel); padding: 0.6rem 1rem;
          background: rgba(14, 77, 110, 0.15);
        }
        .commander-label {
          font-size: 0.65rem; letter-spacing: 0.2em; color: var(--muted);
        }
        .commander-label.warn { color: var(--amber); }
        .commander-name { font-size: 0.9rem; letter-spacing: 0.15em; color: var(--cyan); font-weight: 700; flex: 1; }
        .btn-link {
          background: none; border: none; cursor: pointer;
          font-family: var(--font-display); font-size: 0.65rem;
          letter-spacing: 0.15em; color: var(--text-dim);
          padding: 0; transition: color 0.2s;
        }
        .btn-link:hover { color: var(--cyan); }

        .player-panel {
          border: 1px solid var(--steel); border-top: none;
          background: rgba(10,15,30,0.95);
          padding: 1rem; text-align: left;
        }
        .panel-label {
          font-size: 0.6rem; letter-spacing: 0.25em; color: green;
          margin-bottom: 0.5rem;
        }
        .player-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 0.5rem; }
        .player-row {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.4rem 0.6rem; background: none; border: none;
          cursor: pointer; font-family: var(--font-display);
          text-align: left; transition: background 0.15s; color: #e8f4ff;
        }
        .player-row:hover { background: rgba(0,212,255,0.06); }
        .player-row-active { background: rgba(0,212,255,0.1); }
        .player-id { font-size: 0.7rem; color: var(--text-dim); min-width: 2.5rem; }
        .player-name { font-size: 0.85rem; letter-spacing: 0.1em; flex: 1; color: #e8f4ff; }
        .player-check { font-size: 0.6rem; letter-spacing: 0.15em; color: var(--cyan); }

        .pagination {
          display: flex; align-items: center; gap: 0.75rem;
          margin-top: 0.5rem; justify-content: center;
        }
        .page-btn {
          background: none; border: 1px solid var(--steel); color: var(--text-dim);
          font-family: var(--font-display); font-size: 0.65rem; letter-spacing: 0.1em;
          padding: 2px 8px; cursor: pointer; transition: all 0.15s;
        }
        .page-btn:hover:not(:disabled) { border-color: var(--cyan); color: var(--cyan); }
        .page-btn:disabled { opacity: 0.3; cursor: default; }
        .page-info { font-size: 0.65rem; letter-spacing: 0.15em; color: green; min-width: 3.5rem; text-align: center; }

        /* ── Grid size ── */
        .grid-size-section { width: 100%; text-align: left; }
        .slider-row { display: flex; align-items: center; gap: 0.75rem; }
        .slider-bound { font-size: 0.65rem; color: var(--muted); letter-spacing: 0.1em; min-width: 1rem; }
        .naval-slider { flex: 1; accent-color: var(--cyan); cursor: pointer; }

        /* ── Join section ── */
        .join-section { width: 100%; text-align: left; }

        /* ── Shared input ── */
        .input-row { display: flex; gap: 0.5rem; align-items: stretch; }
        .naval-input {
          flex: 1; background: rgba(211, 211, 211, 1); border: 1px solid var(--steel);
          color: var(--text); font-family: var(--font-display);
          font-size: 0.8rem; letter-spacing: 0.1em;
          padding: 0.5rem 0.75rem; outline: none;
          transition: border-color 0.2s;
        }
        .naval-input:focus { border-color: var(--cyan); }
        .naval-input::placeholder { color: var(--text-dim); }

        /* ── Buttons ── */
        .actions { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }

        .btn {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.75rem 2rem; font-family: var(--font-display);
          font-size: 0.8rem; letter-spacing: 0.2em;
          cursor: pointer; transition: all 0.2s; position: relative; border: none;
        }
        .btn-icon { font-size: 1rem; letter-spacing: 0; }
        .btn-primary {
          background: var(--cyan); color: var(--navy); font-weight: 700;
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
        }
        .btn-primary:hover:not(:disabled) {
          background: #33ddff; transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,212,255,0.35);
        }
        .btn-secondary {
          background: transparent; color: var(--text);
          border: 1px solid var(--steel) !important;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
          padding: 0.5rem 1rem; font-size: 0.75rem;
        }
        .btn-secondary:hover:not(:disabled) {
          border-color: var(--cyan) !important; color: var(--cyan); transform: translateY(-1px);
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .error-msg {
          font-size: 0.75rem; letter-spacing: 0.1em; color: var(--red);
          border: 1px solid var(--red); padding: 6px 14px; opacity: 0.9;
          width: 100%; text-align: left;
        }

        /* ── Active operations ── */
        .ops-section { width: 100%; text-align: left; }
        .ops-list { display: flex; flex-direction: column; gap: 2px; }
        .op-row {
          display: flex; align-items: center; gap: 1rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--steel); background: rgba(14,77,110,0.08);
          cursor: pointer; font-family: var(--font-display);
          transition: all 0.15s; text-align: left; color: var(--text);
        }
        .op-row:hover { background: rgba(0,212,255,0.08); border-color: var(--cyan); }
        .op-id { font-size: 0.8rem; letter-spacing: 0.15em; color: var(--cyan); min-width: 7rem; }
        .op-status { font-size: 0.65rem; letter-spacing: 0.2em; flex: 1; }
        .op-status-waiting_setup { color: var(--amber); }
        .op-status-playing { color: #44ff88; }
        .op-status-finished { color: var(--muted); }
        .op-enter { font-size: 0.65rem; letter-spacing: 0.15em; color: var(--muted); transition: color 0.15s; }
        .op-row:hover .op-enter { color: var(--cyan); }
        .ops-footer { font-size: 0.6rem; letter-spacing: 0.2em; color: var(--muted); margin-top: 0.5rem; text-align: center; }

        /* ── Stats ── */
        .stats {
          display: flex; align-items: center; gap: 2.5rem;
          border-top: 1px solid var(--navy-light); padding-top: 1.5rem;
          width: 100%; justify-content: center;
        }
        .stat { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
        .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--cyan); line-height: 1; }
        .stat-label { font-size: 0.6rem; letter-spacing: 0.25em; color: var(--muted); }
        .stat-divider { width: 1px; height: 40px; background: var(--steel); }

        @media (max-width: 480px) {
          .actions { flex-direction: column; align-items: stretch; }
          .btn { justify-content: center; }
          .input-row { flex-direction: column; }
        }
      `}</style>
    </main>
  );
} 
