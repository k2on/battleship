import { db, GamesTable, ShipsTable, ShotsTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; player_id: string }> }
) {
  try {
    const { id, player_id } = await params;

    // Find the game
    const [game] = await db
      .select()
      .from(GamesTable)
      .where(eq(GamesTable.id, id));

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Get ships for this player
    const ships = await db
      .select()
      .from(ShipsTable)
      .where(
        and(
          eq(ShipsTable.gameId, id),
          eq(ShipsTable.playerId, player_id)
        )
      );

    // Get shots against this player (shots in this game NOT by this player)
    const shots = await db
      .select()
      .from(ShotsTable)
      .where(eq(ShotsTable.gameId, id));

    // Build the grid
    const gridSize = game.gridSize;
    const grid: string[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => "empty")
    );

    // Place ships on grid
    for (const ship of ships) {
      const coords = ship.coordinates as any[];
      for (const coord of coords) {
        // Handle {row, col} or {x, y} or [x, y] formats
        let r: number, c: number;
        if (Array.isArray(coord)) {
          [c, r] = coord;
        } else if (coord.row !== undefined && coord.col !== undefined) {
          r = coord.row;
          c = coord.col;
        } else {
          r = coord.y;
          c = coord.x;
        }
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          grid[r][c] = "ship";
        }
      }
    }

    // Mark shots on grid
    for (const shot of shots) {
      if (
        shot.playerId.toString() !== player_id &&
        shot.x >= 0 &&
        shot.x < gridSize &&
        shot.y >= 0 &&
        shot.y < gridSize
      ) {
        grid[shot.y][shot.x] = shot.hit === 1 ? "hit" : "miss";
      }
    }

    return NextResponse.json({
      game_id: id,
      player_id: player_id,
      grid_size: gridSize,
      grid,
      ships,
    });
  } catch (error) {
    console.error("Board reveal error:", error);
    return NextResponse.json(
      { error: "Failed to get board" },
      { status: 500 }
    );
  }
}
