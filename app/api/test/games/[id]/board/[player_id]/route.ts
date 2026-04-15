// app/api/test/games/[id]/board/[player_id]/route.ts
import { db, GamesTable, ShipsTable, ShotsTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; player_id: string }> }
) {
  try {
    const { id, player_id } = await params;
    const gameId = parseInt(id, 10);
    const pid = parseInt(player_id, 10);
    if (isNaN(gameId) || isNaN(pid)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
    if (!game) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ships = await db.select().from(ShipsTable).where(and(eq(ShipsTable.gameId, gameId), eq(ShipsTable.playerId, pid)));
    const shots = await db.select().from(ShotsTable).where(eq(ShotsTable.gameId, gameId));

    const gridSize = game.gridSize;
    const grid: string[][] = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => "empty"));

    for (const ship of ships) {
      for (const coord of ship.coordinates as any[]) {
        let r: number, c: number;
        if (Array.isArray(coord)) { [r, c] = coord; }
        else if (coord.row !== undefined) { r = coord.row; c = coord.col; }
        else { r = coord.y; c = coord.x; }
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) grid[r][c] = "ship";
      }
    }

    for (const shot of shots) {
      if (shot.playerId !== pid && shot.x >= 0 && shot.x < gridSize && shot.y >= 0 && shot.y < gridSize) {
        grid[shot.x][shot.y] = shot.hit === 1 ? "hit" : "miss";
      }
    }

    return NextResponse.json({ game_id: gameId, player_id: pid, grid_size: gridSize, grid, ships });
  } catch (error) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
