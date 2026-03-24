import { db, GamesTable, ShipsTable, ShotsTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Extract row/col from any coordinate format stored in DB
function getRowCol(coord: any): { row: number; col: number } {
  if (coord.row !== undefined && coord.col !== undefined) {
    return { row: coord.row, col: coord.col };
  }
  if (coord.x !== undefined && coord.y !== undefined) {
    return { row: coord.y, col: coord.x };
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
    const body = await request.json().catch(() => ({}));

    const [game] = await db
      .select()
      .from(GamesTable)
      .where(eq(GamesTable.id, id));

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status === "finished") {
      return NextResponse.json({ error: "Game is already finished" }, { status: 400 });
    }

    if (game.status === "waiting") {
      return NextResponse.json({ error: "Game has not started yet" }, { status: 400 });
    }

    const playerId = body.player_id?.toString();
    if (!playerId) {
      return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
    }

    if (game.player1Id !== playerId && game.player2Id !== playerId) {
      return NextResponse.json({ error: "Player not in this game" }, { status: 403 });
    }

    // Check both players have placed ships
    const player1Ships = await db
      .select()
      .from(ShipsTable)
      .where(and(eq(ShipsTable.gameId, id), eq(ShipsTable.playerId, game.player1Id)));

    const player2Ships = await db
      .select()
      .from(ShipsTable)
      .where(and(eq(ShipsTable.gameId, id), eq(ShipsTable.playerId, game.player2Id!)));

    if (player1Ships.length === 0 || player2Ships.length === 0) {
      return NextResponse.json(
        { error: "Both players must place ships before firing" },
        { status: 409 }
      );
    }

    // Turn enforcement
    if (game.currentTurn && game.currentTurn !== playerId) {
      return NextResponse.json({ error: "It is not your turn" }, { status: 409 });
    }

    // Accept row/col or x/y
    const row = body.row ?? body.y;
    const col = body.col ?? body.x;

    if (typeof row !== "number" || typeof col !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid coordinates" },
        { status: 400 }
      );
    }

    if (row < 0 || col < 0 || row >= game.gridSize || col >= game.gridSize) {
      return NextResponse.json({ error: "Coordinates out of bounds" }, { status: 400 });
    }

    // Check for duplicate shot (store as row=x, col=y in ShotsTable)
    const existingShots = await db
      .select()
      .from(ShotsTable)
      .where(
        and(
          eq(ShotsTable.gameId, id),
          eq(ShotsTable.playerId, parseInt(playerId)),
          eq(ShotsTable.x, row),
          eq(ShotsTable.y, col)
        )
      );

    if (existingShots.length > 0) {
      return NextResponse.json({ error: "Already fired at this location" }, { status: 400 });
    }

    // Determine opponent
    const opponentId = playerId === game.player1Id ? game.player2Id! : game.player1Id;

    // Get opponent's ships
    const opponentShips = await db
      .select()
      .from(ShipsTable)
      .where(and(eq(ShipsTable.gameId, id), eq(ShipsTable.playerId, opponentId)));

    // Check if shot hits any ship
    let hit = false;
    let sunkShipType: string | null = null;

    for (const ship of opponentShips) {
      const coords = (ship.coordinates as any[]).map(getRowCol);
      const isHit = coords.some((c) => c.row === row && c.col === col);

      if (isHit) {
        hit = true;

        // Check if this ship is now fully sunk
        const prevShots = await db
          .select()
          .from(ShotsTable)
          .where(
            and(eq(ShotsTable.gameId, id), eq(ShotsTable.playerId, parseInt(playerId)))
          );

        const hitSet = new Set(
          prevShots.filter((s) => s.hit === 1).map((s) => `${s.x},${s.y}`)
        );
        hitSet.add(`${row},${col}`);

        const allSunk = coords.every((c) => hitSet.has(`${c.row},${c.col}`));
        if (allSunk) {
          sunkShipType = ship.type;
        }
        break;
      }
    }

    // Record the shot
    await db.insert(ShotsTable).values({
      gameId: id,
      playerId: parseInt(playerId),
      x: row,
      y: col,
      hit: hit ? 1 : 0,
    });

    // Switch turns
    const nextTurn = playerId === game.player1Id ? game.player2Id! : game.player1Id;

    // Check if all opponent ships are sunk
    let gameOver = false;
    if (hit) {
      const allShotsNow = await db
        .select()
        .from(ShotsTable)
        .where(
          and(eq(ShotsTable.gameId, id), eq(ShotsTable.playerId, parseInt(playerId)))
        );

      const hitSet = new Set(
        allShotsNow.filter((s) => s.hit === 1).map((s) => `${s.x},${s.y}`)
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
      await db
        .update(GamesTable)
        .set({ status: "finished", winnerId: playerId, currentTurn: null, updatedAt: new Date() })
        .where(eq(GamesTable.id, id));
    } else {
      await db
        .update(GamesTable)
        .set({ currentTurn: nextTurn, updatedAt: new Date() })
        .where(eq(GamesTable.id, id));
    }

    const response: any = { hit, row, col, game_over: gameOver };
    if (sunkShipType) response.sunk = sunkShipType;
    if (gameOver) response.winner_id = playerId;

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Fire error:", error);
    return NextResponse.json({ error: "Failed to fire" }, { status: 500 });
  }
}
