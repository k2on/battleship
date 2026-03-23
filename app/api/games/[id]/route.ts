import { db, GamesTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [game] = await db
      .select()
      .from(GamesTable)
      .where(eq(GamesTable.id, id));

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({
      game_id: game.id,
      player1_id: game.player1Id,
      player2_id: game.player2Id ?? null,
      status: game.status,
      current_turn: game.currentTurn ?? null,
      winner_id: game.winnerId ?? null,
      grid_size: game.gridSize,
      created_at: game.createdAt,
      updated_at: game.updatedAt,
    });
  } catch (error) {
    console.error("Get game error:", error);
    return NextResponse.json({ error: "Failed to get game" }, { status: 500 });
  }
}
