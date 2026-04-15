import { db, GamesTable, ShipsTable, ShotsTable, PlayersTable } from "@/lib/drizzle";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function getRowCol(coord: any): { row: number; col: number } {
  if (coord && typeof coord === "object" && !Array.isArray(coord)) {
    if (coord.row !== undefined && coord.col !== undefined) {
      return { row: coord.row, col: coord.col };
    }
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
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // Validate player_id present
    if (body.player_id === undefined || body.player_id === null) {
      return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
    }

    // Validate row present
    if (body.row === undefined || body.row === null) {
      return NextResponse.json({ error: "Missing row" }, { status: 400 });
    }

    // Validate col present
    if (body.col === undefined || body.col === null) {
      return NextResponse.json({ error: "Missing col" }, { status: 400 });
    }

    const playerId = typeof body.player_id === "number" ? body.player_id : parseInt(body.player_id, 10);
    const row = body.row;
    const col = body.col;

    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Invalid player_id" }, { status: 400 });
    }

    if (typeof row !== "number" || typeof col !== "number") {
      return NextResponse.json({ error: "Row and col must be numbers" }, { status: 400 });
    }

    const [game] = await db
      .select()
      .from(GamesTable)
      .where(eq(GamesTable.id, gameId));

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Finished game → 400 (not 409 per spec)
    if (game.status === "finished") {
      return NextResponse.json({ error: "Game is already finished" }, { status: 400 });
    }

    // Not yet playing
    if (game.status !== "playing") {
      return NextResponse.json({ error: "Game is not in playing state" }, { status: 400 });
    }

    // Check player is in the game
    if (game.player1Id !== playerId && game.player2Id !== playerId) {
      return NextResponse.json({ error: "Player not in this game" }, { status: 403 });
    }

    // Check ships placed
    const playerIdStr = playerId.toString();
    const gameIdStr = gameId.toString();

    const p1Ships = await db.select().from(ShipsTable)
      .where(and(eq(ShipsTable.gameId, gameIdStr), eq(ShipsTable.playerId, game.player1Id!.toString())));
    const p2Ships = await db.select().from(ShipsTable)
      .where(and(eq(ShipsTable.gameId, gameIdStr), eq(ShipsTable.playerId, game.player2Id!.toString())));

    if (p1Ships.length === 0 || p2Ships.length === 0) {
      return NextResponse.json({ error: "Ships not yet placed" }, { status: 400 });
    }

    // Turn enforcement → 403 (not 400 per spec)
    if (game.currentTurn && game.currentTurn !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 403 });
    }

    // Bounds check
    if (row < 0 || col < 0 || row >= game.gridSize || col >= game.gridSize) {
      return NextResponse.json({ error: "Coordinates out of bounds" }, { status: 400 });
    }

    // Duplicate shot → 409 (not 400 per spec)
    const existingShots = await db.select().from(ShotsTable)
      .where(and(
        eq(ShotsTable.gameId, gameId),
        eq(ShotsTable.playerId, playerId),
        eq(ShotsTable.x, row),
        eq(ShotsTable.y, col)
      ));

    if (existingShots.length > 0) {
      return NextResponse.json({ error: "Already fired at this cell" }, { status: 409 });
    }

    // Determine opponent
    const opponentId = playerId === game.player1Id ? game.player2Id! : game.player1Id!;
    const opponentIdStr = opponentId.toString();

    // Get opponent ships
    const opponentShips = await db.select().from(ShipsTable)
      .where(and(eq(ShipsTable.gameId, gameIdStr), eq(ShipsTable.playerId, opponentIdStr)));

    // Check hit
    let hit = false;
    for (const ship of opponentShips) {
      const coords = (ship.coordinates as any[]).map(getRowCol);
      if (coords.some((c) => c.row === row && c.col === col)) {
        hit = true;
        break;
      }
    }

    // Record shot
    await db.insert(ShotsTable).values({
      gameId: gameId,
      playerId: playerId,
      x: row,
      y: col,
      hit: hit ? 1 : 0,
    });

    // Increment player shot stats
    await db.update(PlayersTable).set({
      totalShots: sql`${PlayersTable.totalShots} + 1`,
      totalHits: hit ? sql`${PlayersTable.totalHits} + 1` : PlayersTable.totalHits,
    }).where(eq(PlayersTable.id, playerId));

    // Increment total_moves on game
    await db.update(GamesTable).set({
      totalMoves: sql`${GamesTable.totalMoves} + 1`,
    }).where(eq(GamesTable.id, gameId));

    // Next turn
    const nextTurnId = playerId === game.player1Id ? game.player2Id! : game.player1Id!;

    // Check win condition
    let gameOver = false;
    if (hit) {
      const allShots = await db.select().from(ShotsTable)
        .where(and(eq(ShotsTable.gameId, gameId), eq(ShotsTable.playerId, playerId)));

      const hitSet = new Set(
        allShots.filter((s) => s.hit === 1).map((s) => `${s.x},${s.y}`)
      );

      const allOpponentCoords: string[] = [];
      for (const ship of opponentShips) {
        const coords = (ship.coordinates as any[]).map(getRowCol);
        for (const c of coords) {
          allOpponentCoords.push(`${c.row},${c.col}`);
        }
      }

      gameOver = allOpponentCoords.every((c) => hitSet.has(c));
    }

    if (gameOver) {
      await db.update(GamesTable).set({
        status: "finished",
        winnerId: playerId,
        currentTurn: null,
        updatedAt: new Date(),
      }).where(eq(GamesTable.id, gameId));

      // Increment cumulative stats
      await db.update(PlayersTable).set({
        gamesPlayed: sql`${PlayersTable.gamesPlayed} + 1`,
        wins: sql`${PlayersTable.wins} + 1`,
      }).where(eq(PlayersTable.id, playerId));

      await db.update(PlayersTable).set({
        gamesPlayed: sql`${PlayersTable.gamesPlayed} + 1`,
        losses: sql`${PlayersTable.losses} + 1`,
      }).where(eq(PlayersTable.id, opponentId));
    } else {
      await db.update(GamesTable).set({
        currentTurn: nextTurnId,
        updatedAt: new Date(),
      }).where(eq(GamesTable.id, gameId));
    }

    // v2.3 response: result, next_player_id, game_status
    const response: any = {
      result: hit ? "hit" : "miss",
      game_status: gameOver ? "finished" : "playing",
      next_player_id: gameOver ? null : nextTurnId,
      row,
      col,
    };

    if (gameOver) {
      response.winner_id = playerId;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Fire error:", error);
    return NextResponse.json({ error: "Failed to fire" }, { status: 500 });
  }
}
