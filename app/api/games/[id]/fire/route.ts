import { db, GamesTable, ShipsTable, ShotsTable, PlayersTable } from "@/lib/drizzle";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function getRowCol(coord: any): { row: number; col: number } {
  if (coord && typeof coord === "object" && !Array.isArray(coord) &&
    typeof coord.row === "number" && typeof coord.col === "number") {
    return { row: coord.row, col: coord.col };
  }
  if (Array.isArray(coord) && coord.length === 2) {
    return { row: coord[0], col: coord[1] };
  }
  return { row: -1, col: -1 };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);
    if (isNaN(gameId)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // Validate required fields
    if (body.player_id === undefined || body.player_id === null) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (body.row === undefined || body.row === null) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (body.col === undefined || body.col === null) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const playerId = typeof body.player_id === "number" ? body.player_id : parseInt(body.player_id, 10);
    const row = body.row;
    const col = body.col;

    if (isNaN(playerId) || typeof row !== "number" || typeof col !== "number") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
    if (!game) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Finished → 400
    if (game.status === "finished") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    // Not playing → 400
    if (game.status !== "playing") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // Check player in game
    if (game.player1Id !== playerId && game.player2Id !== playerId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Ships placed check
    const p1Ships = await db.select().from(ShipsTable).where(and(eq(ShipsTable.gameId, gameId), eq(ShipsTable.playerId, game.player1Id)));
    const p2Ships = await db.select().from(ShipsTable).where(and(eq(ShipsTable.gameId, gameId), eq(ShipsTable.playerId, game.player2Id!)));
    if (p1Ships.length === 0 || p2Ships.length === 0) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // Turn → 403
    if (game.currentTurn && game.currentTurn !== playerId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Bounds
    if (row < 0 || col < 0 || row >= game.gridSize || col >= game.gridSize) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // Duplicate → 409
    const dup = await db.select().from(ShotsTable).where(and(
      eq(ShotsTable.gameId, gameId), eq(ShotsTable.playerId, playerId),
      eq(ShotsTable.x, row), eq(ShotsTable.y, col)
    ));
    if (dup.length > 0) {
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    }

    const opponentId = playerId === game.player1Id ? game.player2Id! : game.player1Id;
    const opponentShips = await db.select().from(ShipsTable).where(and(eq(ShipsTable.gameId, gameId), eq(ShipsTable.playerId, opponentId)));

    let hit = false;
    for (const ship of opponentShips) {
      const coords = (ship.coordinates as any[]).map(getRowCol);
      if (coords.some((c) => c.row === row && c.col === col)) { hit = true; break; }
    }

    await db.insert(ShotsTable).values({ gameId, playerId, x: row, y: col, hit: hit ? 1 : 0 });

    await db.update(PlayersTable).set({
      totalShots: sql`${PlayersTable.totalShots} + 1`,
      totalHits: hit ? sql`${PlayersTable.totalHits} + 1` : PlayersTable.totalHits,
    }).where(eq(PlayersTable.id, playerId));

    await db.update(GamesTable).set({ totalMoves: sql`${GamesTable.totalMoves} + 1` }).where(eq(GamesTable.id, gameId));

    const nextTurnId = playerId === game.player1Id ? game.player2Id! : game.player1Id;

    let gameOver = false;
    if (hit) {
      const allShots = await db.select().from(ShotsTable).where(and(eq(ShotsTable.gameId, gameId), eq(ShotsTable.playerId, playerId)));
      const hitSet = new Set(allShots.filter((s) => s.hit === 1).map((s) => `${s.x},${s.y}`));
      const allCoords: string[] = [];
      for (const ship of opponentShips) {
        for (const c of (ship.coordinates as any[]).map(getRowCol)) {
          allCoords.push(`${c.row},${c.col}`);
        }
      }
      gameOver = allCoords.every((c) => hitSet.has(c));
    }

    if (gameOver) {
      await db.update(GamesTable).set({ status: "finished", winnerId: playerId, currentTurn: null, updatedAt: new Date() }).where(eq(GamesTable.id, gameId));
      await db.update(PlayersTable).set({ gamesPlayed: sql`${PlayersTable.gamesPlayed} + 1`, wins: sql`${PlayersTable.wins} + 1` }).where(eq(PlayersTable.id, playerId));
      await db.update(PlayersTable).set({ gamesPlayed: sql`${PlayersTable.gamesPlayed} + 1`, losses: sql`${PlayersTable.losses} + 1` }).where(eq(PlayersTable.id, opponentId));
    } else {
      await db.update(GamesTable).set({ currentTurn: nextTurnId, updatedAt: new Date() }).where(eq(GamesTable.id, gameId));
    }

    const response: any = {
      result: hit ? "hit" : "miss",
      game_status: gameOver ? "finished" : "playing",
      next_player_id: gameOver ? null : nextTurnId,
    };
    if (gameOver) response.winner_id = playerId;

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Fire error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
