// app/api/games/[id]/route.ts
import { db, GamesTable, GamePlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);

    if (isNaN(gameId) || gameId <= 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
    if (!game) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const gamePlayers = await db.select().from(GamePlayersTable).where(eq(GamePlayersTable.gameId, gameId));
    const playerIds = gamePlayers.sort((a, b) => a.joinOrder - b.joinOrder).map((gp) => gp.playerId);

    return NextResponse.json({
      game_id: game.id,
      grid_size: game.gridSize,
      max_players: game.maxPlayers,
      status: game.status,
      players: playerIds,
      current_turn_player_id: game.currentTurn ?? null,
      winner_id: game.winnerId ?? null,
      total_moves: game.totalMoves,
    });
  } catch (error) {
    console.error("Get game error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
