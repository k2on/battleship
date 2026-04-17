"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameStatus = "waiting_setup" | "playing" | "finished";

interface GameState {
  game_id: number;
  grid_size: number;
  max_players: number;
  status: GameStatus;
  players: number[];
  current_turn_player_id: number | null;
  winner_id: number | null;
  total_moves: number;
}

interface Move {
  player_id: number;
  row: number;
  col: number;
  result: "hit" | "miss";
}

interface Ship {
  type: string;
  coordinates: Array<{ row: number; col: number }>;
}

interface PlayerStats {
  player_id: number;
  games_played: number;
  wins: number;
  losses: number;
  total_shots: number;
  total_hits: number;
  accuracy: number;
}

type CellState =
  | "empty"
  | "ship"
  | "placing"
  | "hit"
  | "miss"
  | "sunk";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SHIP_SIZES: Record<string, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
};
const SHIP_NAMES = Object.keys(SHIP_SIZES);

function buildEmptyGrid(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array(size).fill("empty"));
}

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status });
  }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: GameStatus }) {
  const colors: Record<GameStatus, string> = {
    waiting_setup: "bg-yellow-100 text-yellow-800 border-yellow-200",
    playing: "bg-green-100 text-green-800 border-green-200",
    finished: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const labels: Record<GameStatus, string> = {
    waiting_setup: "Waiting — setup",
    playing: "In progress",
    finished: "Finished",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function CellButton({
  state,
  onClick,
  disabled,
  isPlacing,
  isHover,
  onMouseEnter,
  onMouseLeave,
  size,
}: {
  state: CellState;
  onClick?: () => void;
  disabled?: boolean;
  isPlacing?: boolean;
  isHover?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  size: number;
}) {
  const cellPx = size <= 8 ? 42 : size <= 12 ? 36 : 28;

  const base =
    "border border-blue-200 transition-colors duration-100 flex items-center justify-center text-base select-none";

  const stateClass: Record<CellState, string> = {
    empty: "bg-blue-50 hover:bg-blue-100",
    ship: "bg-slate-400",
    placing: "bg-slate-300",
    hit: "bg-red-400",
    miss: "bg-blue-200",
    sunk: "bg-red-700",
  };

  let extra = "";
  if (isHover && !disabled) extra = "bg-yellow-200 cursor-pointer";
  if (disabled && state === "empty") extra = "cursor-default opacity-70";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled && !onClick}
      style={{ width: cellPx, height: cellPx, minWidth: cellPx }}
      className={`${base} ${stateClass[state]} ${extra}`}
      aria-label={state}
    >
      {state === "hit" && <span className="text-white font-bold text-xs">✕</span>}
      {state === "miss" && <span className="text-blue-500 text-xs">•</span>}
      {state === "sunk" && <span className="text-white font-bold text-xs">✕</span>}
    </button>
  );
}

interface GridProps {
  grid: CellState[][];
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  onGridLeave?: () => void;
  hoverCells?: Set<string>;
  interactive?: boolean;
  label?: string;
  size: number;
}

function Grid({
  grid,
  onCellClick,
  onCellHover,
  onGridLeave,
  hoverCells = new Set(),
  interactive = false,
  label,
  size,
}: GridProps) {
  const colLabels = Array.from({ length: size }, (_, i) => String.fromCharCode(65 + i));
  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">
          {label}
        </p>
      )}
      <div className="overflow-auto">
        <div onMouseLeave={onGridLeave} style={{ display: "inline-block" }}>
          <div className="flex mb-0.5 ml-6">
            {colLabels.map((c) => (
              <div
                key={c}
                className="text-center text-xs text-slate-400"
                style={{ width: size <= 8 ? 42 : size <= 12 ? 36 : 28, minWidth: size <= 8 ? 42 : size <= 12 ? 36 : 28 }}
              >
                {c}
              </div>
            ))}
          </div>
          {grid.map((row, r) => (
            <div key={r} className="flex items-center">
              <span className="text-xs text-slate-400 w-5 text-right mr-1">{r + 1}</span>
              {row.map((cell, c) => (
                <CellButton
                  key={c}
                  state={cell}
                  size={size}
                  onClick={interactive && onCellClick ? () => onCellClick(r, c) : undefined}
                  onMouseEnter={onCellHover ? () => onCellHover(r, c) : undefined}
                  onMouseLeave={undefined}
                  isHover={hoverCells.has(`${r},${c}`)}
                  disabled={!interactive}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Ship Placement Phase ─────────────────────────────────────────────────────

interface PlacementPhaseProps {
  gameId: number;
  playerId: number;
  gridSize: number;
  onPlaced: () => void;
}

function PlacementPhase({ gameId, playerId, gridSize, onPlaced }: PlacementPhaseProps) {
  const [grid, setGrid] = useState<CellState[][]>(() => buildEmptyGrid(gridSize));
  const [placedShips, setPlacedShips] = useState<Ship[]>([]);
  const [currentShipIdx, setCurrentShipIdx] = useState(0);
  const [orientation, setOrientation] = useState<"h" | "v">("h");
  const [hoverCells, setHoverCells] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currentShipName = SHIP_NAMES[currentShipIdx];
  const currentShipSize = currentShipName ? SHIP_SIZES[currentShipName] : 0;
  const allPlaced = placedShips.length === 3;

  function getPreviewCells(row: number, col: number): Array<{ row: number; col: number }> | null {
    const cells: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < currentShipSize; i++) {
      const r = orientation === "v" ? row + i : row;
      const c = orientation === "h" ? col + i : col;
      if (r >= gridSize || c >= gridSize) return null;
      cells.push({ row: r, col: c });
    }
    return cells;
  }

  function handleHover(row: number, col: number) {
    if (allPlaced) return;
    const cells = getPreviewCells(row, col);
    if (!cells) { setHoverCells(new Set()); return; }
    // Check collision
    const occupied = new Set(
      placedShips.flatMap((s) => s.coordinates.map((c) => `${c.row},${c.col}`))
    );
    if (cells.some((c) => occupied.has(`${c.row},${c.col}`))) {
      setHoverCells(new Set());
      return;
    }
    setHoverCells(new Set(cells.map((c) => `${c.row},${c.col}`)));
  }

  function handleCellClick(row: number, col: number) {
    if (allPlaced) return;
    const cells = getPreviewCells(row, col);
    if (!cells) return;
    const occupied = new Set(
      placedShips.flatMap((s) => s.coordinates.map((c) => `${c.row},${c.col}`))
    );
    if (cells.some((c) => occupied.has(`${c.row},${c.col}`))) return;

    const newShip: Ship = { type: currentShipName, coordinates: cells };
    const newPlaced = [...placedShips, newShip];
    setPlacedShips(newPlaced);

    const newGrid = grid.map((r) => [...r]);
    cells.forEach(({ row: r, col: c }) => { newGrid[r][c] = "ship"; });
    setGrid(newGrid);
    setHoverCells(new Set());

    if (currentShipIdx + 1 < SHIP_NAMES.length) {
      setCurrentShipIdx(currentShipIdx + 1);
    }
  }

  function handleReset() {
    setGrid(buildEmptyGrid(gridSize));
    setPlacedShips([]);
    setCurrentShipIdx(0);
    setHoverCells(new Set());
  }

  async function handleSubmit() {
    if (!allPlaced) return;
    setSubmitting(true);
    setError("");
    try {
      await fetchJson(`/api/games/${gameId}/place`, {
        method: "POST",
        body: JSON.stringify({
          player_id: playerId,
          ships: placedShips.map((s) => ({
            type: s.type,
            coordinates: s.coordinates,
          })),
        }),
      });
      onPlaced();
    } catch (e: any) {
      setError(e.message ?? "Failed to place ships");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          {!allPlaced ? (
            <p className="text-sm text-slate-700">
              Placing:{" "}
              <span className="font-medium capitalize">{currentShipName}</span>
              <span className="text-slate-500"> ({currentShipSize} cells)</span>
            </p>
          ) : (
            <p className="text-sm text-green-700 font-medium">All ships placed — ready to confirm</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOrientation(orientation === "h" ? "v" : "h")}
          className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          {orientation === "h" ? "→ Horizontal" : "↓ Vertical"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-500 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <div className="flex gap-6 items-start flex-wrap">
        <Grid
          grid={grid}
          onCellClick={handleCellClick}
          onCellHover={handleHover}
          onGridLeave={() => setHoverCells(new Set())}
          hoverCells={hoverCells}
          interactive={!allPlaced}
          size={gridSize}
          label="Your board"
        />

        <div className="space-y-2 min-w-[140px]">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ships</p>
          {SHIP_NAMES.map((name, i) => {
            const placed = i < placedShips.length;
            const active = i === currentShipIdx;
            return (
              <div
                key={name}
                className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${
                  active ? "bg-yellow-50 border border-yellow-200" : ""
                }`}
              >
                <span className={`w-3 h-3 rounded-sm inline-block ${placed ? "bg-slate-400" : "border border-slate-300"}`} />
                <span className={`capitalize ${placed ? "text-slate-400 line-through" : "text-slate-700"}`}>
                  {name}
                </span>
                <span className="text-slate-400 text-xs">({SHIP_SIZES[name]})</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allPlaced || submitting}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded disabled:opacity-40 hover:bg-blue-700 transition-colors"
      >
        {submitting ? "Confirming…" : "Confirm placement"}
      </button>
    </div>
  );
}

// ─── Fire Phase ───────────────────────────────────────────────────────────────

interface FirePhaseProps {
  gameId: number;
  playerId: number;
  game: GameState;
  moves: Move[];
  onMoveComplete: () => void;
}

function FirePhase({ gameId, playerId, game, moves, onMoveComplete }: FirePhaseProps) {
  const [hoverCells, setHoverCells] = useState<Set<string>>(new Set());
  const [firing, setFiring] = useState(false);
  const [lastResult, setLastResult] = useState<{ result: "hit" | "miss"; row: number; col: number } | null>(null);
  const [error, setError] = useState("");

  const isMyTurn = game.current_turn_player_id === playerId;
  const opponentId = game.players.find((p) => p !== playerId);

  // Build attack grid: what I've fired at (opponent's board from my perspective)
  const attackGrid = buildEmptyGrid(game.grid_size);
  moves
    .filter((m) => m.player_id === playerId)
    .forEach((m) => {
      attackGrid[m.row][m.col] = m.result === "hit" ? "hit" : "miss";
    });

  // Build defense grid: what opponent fired at me
  const defenseGrid = buildEmptyGrid(game.grid_size);
  moves
    .filter((m) => m.player_id !== playerId)
    .forEach((m) => {
      defenseGrid[m.row][m.col] = m.result === "hit" ? "hit" : "miss";
    });

  async function handleFire(row: number, col: number) {
    if (!isMyTurn || firing) return;
    if (attackGrid[row][col] !== "empty") return;
    setFiring(true);
    setError("");
    try {
      const res = await fetchJson<{ result: "hit" | "miss"; game_status: string; next_player_id: number | null; winner_id?: number }>(
        `/api/games/${gameId}/fire`,
        {
          method: "POST",
          body: JSON.stringify({ player_id: playerId, row, col }),
        }
      );
      setLastResult({ result: res.result, row, col });
      onMoveComplete();
    } catch (e: any) {
      setError(e.message ?? "Failed to fire");
    } finally {
      setFiring(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {isMyTurn ? (
          <span className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
            Your turn — click to fire
          </span>
        ) : (
          <span className="text-sm text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
            Waiting for opponent…
          </span>
        )}
        {lastResult && (
          <span
            className={`text-sm font-medium px-2 py-0.5 rounded ${
              lastResult.result === "hit"
                ? "text-red-700 bg-red-50 border border-red-200"
                : "text-blue-700 bg-blue-50 border border-blue-200"
            }`}
          >
            Last shot: {lastResult.result.toUpperCase()} at ({lastResult.row + 1},{String.fromCharCode(65 + lastResult.col)})
          </span>
        )}
      </div>

      <div className="flex gap-8 flex-wrap">
        <Grid
          grid={attackGrid}
          onCellClick={isMyTurn && !firing ? handleFire : undefined}
          onCellHover={isMyTurn ? (r, c) => {
            if (attackGrid[r][c] === "empty") setHoverCells(new Set([`${r},${c}`]));
            else setHoverCells(new Set());
          } : undefined}
          onGridLeave={() => setHoverCells(new Set())}
          hoverCells={hoverCells}
          interactive={isMyTurn && !firing}
          size={game.grid_size}
          label={`Attack board (opponent #${opponentId})`}
        />
        <Grid
          grid={defenseGrid}
          interactive={false}
          size={game.grid_size}
          label="Your board (incoming fire)"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" /> Hit</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded-sm inline-block" /> Miss</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-50 border border-blue-200 rounded-sm inline-block" /> Unknown</span>
      </div>
    </div>
  );
}

// ─── Move History ─────────────────────────────────────────────────────────────

function MoveHistory({ moves, players, myId }: { moves: Move[]; players: number[]; myId: number }) {
  if (moves.length === 0) return <p className="text-xs text-slate-400">No moves yet.</p>;
  return (
    <div className="space-y-0.5 max-h-60 overflow-y-auto pr-1">
      {[...moves].reverse().map((m, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${m.result === "hit" ? "bg-red-400" : "bg-blue-300"}`} />
          <span className="text-slate-500">
            P{m.player_id}{m.player_id === myId ? " (you)" : ""}
          </span>
          <span className="text-slate-700 font-mono">
            ({m.row + 1},{String.fromCharCode(65 + m.col)})
          </span>
          <span className={m.result === "hit" ? "text-red-600 font-medium" : "text-slate-400"}>
            {m.result}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Join / Setup Panel ───────────────────────────────────────────────────────

interface JoinPanelProps {
  gameId: number;
  game: GameState;
  playerId: number;
  onJoined: () => void;
}

function JoinPanel({ gameId, game, playerId, onJoined }: JoinPanelProps) {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const alreadyIn = game.players.includes(playerId);

  async function handleJoin() {
    setJoining(true);
    setError("");
    try {
      await fetchJson(`/api/games/${gameId}/join`, {
        method: "POST",
        body: JSON.stringify({ player_id: playerId }),
      });
      onJoined();
    } catch (e: any) {
      setError(e.message ?? "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  if (alreadyIn) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
      <p className="text-sm text-blue-900">
        You are not in this game.{" "}
        {game.players.length < game.max_players
          ? "Join now to play."
          : "The game is full."}
      </p>
      {game.players.length < game.max_players && game.status === "waiting_setup" && (
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {joining ? "Joining…" : "Join game"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Player ID Selector ───────────────────────────────────────────────────────

interface PlayerSelectorProps {
  onSelect: (id: number) => void;
}

function PlayerSelector({ onSelect }: PlayerSelectorProps) {
  const [players, setPlayers] = useState<Array<{ player_id: number; username: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson<Array<{ player_id: number; username: string }>>("/api/players")
      .then(setPlayers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newUsername.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetchJson<{ player_id: number }>("/api/players", {
        method: "POST",
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      onSelect(res.player_id);
    } catch (e: any) {
      setError(e.message ?? "Failed to create player");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 w-full max-w-sm space-y-5">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Who are you?</h2>
          <p className="text-sm text-slate-500 mt-0.5">Select or create a player to continue</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading players…</p>
        ) : players.length > 0 ? (
          <div className="space-y-1">
            {players.map((p) => (
              <button
                key={p.player_id}
                type="button"
                onClick={() => onSelect(p.player_id)}
                className="w-full text-left text-sm px-3 py-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
              >
                <span className="font-medium text-slate-800">{p.username}</span>
                <span className="text-slate-400 ml-2">#{p.player_id}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No players yet — create one below.</p>
        )}

        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">New player</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="username"
              maxLength={30}
              className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newUsername.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {creating ? "…" : "Create"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel({ playerId }: { playerId: number }) {
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    fetchJson<PlayerStats>(`/api/players/${playerId}/stats`)
      .then(setStats)
      .catch(() => {});
  }, [playerId]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        { label: "Wins", value: stats.wins },
        { label: "Losses", value: stats.losses },
        { label: "Accuracy", value: `${(stats.accuracy * 100).toFixed(1)}%` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-slate-50 rounded-lg border border-slate-100 px-2 py-2">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-base font-medium text-slate-800">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const params = useParams();
  const gameId = Number(params.id);

  const [playerId, setPlayerId] = useState<number | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasPlaced, setHasPlaced] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchGame = useCallback(async () => {
    if (isNaN(gameId)) return;
    try {
      const [g, m] = await Promise.all([
        fetchJson<GameState>(`/api/games/${gameId}`),
        fetchJson<{ game_id: number; moves: Move[] }>(`/api/games/${gameId}/moves`),
      ]);
      setGame(g);
      setMoves(m.moves);
    } catch (e: any) {
      setError(e.message ?? "Game not found");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Initial load
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Poll while game is active
  useEffect(() => {
    if (!game || game.status === "finished") return;
    const id = setInterval(fetchGame, 3000);
    return () => clearInterval(id);
  }, [game?.status, fetchGame]);

  // Persist player selection
  useEffect(() => {
    const stored = localStorage.getItem("battleship_player_id");
    if (stored) setPlayerId(Number(stored));
  }, []);

  function handleSelectPlayer(id: number) {
    setPlayerId(id);
    localStorage.setItem("battleship_player_id", String(id));
  }

  if (!playerId) return <PlayerSelector onSelect={handleSelectPlayer} />;

  if (isNaN(gameId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Invalid game ID.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Loading game…</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">{error || "Game not found"}</p>
      </div>
    );
  }

  const isInGame = game.players.includes(playerId);
  const opponentId = game.players.find((p) => p !== playerId);
  const myTurn = game.current_turn_player_id === playerId;

  // Check if I've placed ships (infer from moves existing and status=playing or from hasPlaced flag)
  const needsPlacement =
    isInGame &&
    game.status === "waiting_setup" &&
    !hasPlaced;

  const showFire =
    isInGame &&
    game.status === "playing" &&
    (hasPlaced || moves.length > 0 || game.current_turn_player_id !== null);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-medium text-slate-900">Game #{game.game_id}</h1>
              <StatusBadge status={game.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {game.grid_size}×{game.grid_size} grid · {game.total_moves} moves played
            </p>
          </div>
          <div className="text-right text-xs text-slate-400 space-y-0.5">
            <p>Playing as <span className="font-medium text-slate-700">#{playerId}</span></p>
            <button
              type="button"
              onClick={() => { setPlayerId(null); localStorage.removeItem("battleship_player_id"); }}
              className="text-slate-400 hover:text-slate-600 underline text-xs"
            >
              Switch player
            </button>
          </div>
        </div>

        {/* Stats */}
        <StatsPanel playerId={playerId} />

        {/* Join panel */}
        {!isInGame && (
          <JoinPanel
            gameId={gameId}
            game={game}
            playerId={playerId}
            onJoined={() => { fetchGame(); }}
          />
        )}

        {/* Waiting for opponent */}
        {isInGame && game.status === "waiting_setup" && game.players.length < game.max_players && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              Waiting for {game.max_players - game.players.length} more player(s) to join…
            </p>
            <p className="text-xs text-yellow-600 mt-0.5 font-mono">
              Share this URL with your opponent
            </p>
          </div>
        )}

        {/* Placement */}
        {isInGame && game.status === "waiting_setup" && game.players.length >= game.max_players && !hasPlaced && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-medium text-slate-900">Place your ships</h2>
            <PlacementPhase
              gameId={gameId}
              playerId={playerId}
              gridSize={game.grid_size}
              onPlaced={() => { setHasPlaced(true); fetchGame(); }}
            />
          </div>
        )}

        {/* Waiting after placement */}
        {isInGame && game.status === "waiting_setup" && hasPlaced && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-800">Ships placed! Waiting for opponent to place their ships…</p>
          </div>
        )}

        {/* Fire phase */}
        {showFire && game.status === "playing" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-slate-900">
                {myTurn ? "Your turn" : "Opponent's turn"}
              </h2>
              {opponentId && (
                <span className="text-xs text-slate-500">vs Player #{opponentId}</span>
              )}
            </div>
            <FirePhase
              gameId={gameId}
              playerId={playerId}
              game={game}
              moves={moves}
              onMoveComplete={fetchGame}
            />
          </div>
        )}

        {/* Game over */}
        {game.status === "finished" && (
          <div
            className={`rounded-xl border p-5 text-center ${
              game.winner_id === playerId
                ? "border-green-300 bg-green-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            {game.winner_id === playerId ? (
              <>
                <p className="text-xl font-medium text-green-800">You won! 🎉</p>
                <p className="text-sm text-green-600 mt-1">Game finished in {game.total_moves} moves.</p>
              </>
            ) : game.winner_id ? (
              <>
                <p className="text-xl font-medium text-slate-700">Player #{game.winner_id} wins</p>
                <p className="text-sm text-slate-500 mt-1">Better luck next time.</p>
              </>
            ) : (
              <p className="text-base font-medium text-slate-700">Game over</p>
            )}
          </div>
        )}

        {/* Move history */}
        {moves.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <h3 className="text-sm font-medium text-slate-700">Move history</h3>
            <MoveHistory moves={moves} players={game.players} myId={playerId} />
          </div>
        )}

        {/* Game info */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Game info</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {[
              ["Status", game.status.replace(/_/g, " ")],
              ["Grid", `${game.grid_size} × ${game.grid_size}`],
              ["Players", `${game.players.length} / ${game.max_players}`],
              ["Total moves", game.total_moves],
              ["Current turn", game.current_turn_player_id ? `#${game.current_turn_player_id}` : "—"],
              ["Winner", game.winner_id ? `#${game.winner_id}` : "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between border-b border-slate-50 py-0.5">
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-800 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}