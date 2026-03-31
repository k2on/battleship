import { db, PlayersTable, GamesTable, ShotsTable } from "@/lib/drizzle";
import { eq, or, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id, 10);

    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
    }

    const [player] = await db
      .select()
      .from(PlayersTable)
      .where(eq(PlayersTable.id, playerId));

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const playerIdStr = playerId.toString();

    // Count finished games where this player participated
    const finishedAsP1 = await db
      .select()
      .from(GamesTable)
      .where(
        and(
          eq(GamesTable.player1Id, playerIdStr),
          eq(GamesTable.status, "finished")
        )
      );

    const finishedAsP2 = await db
      .select()
      .from(GamesTable)
      .where(
        and(
          eq(GamesTable.player2Id, playerIdStr),
          eq(GamesTable.status, "finished")
        )
      );

    const games_played = finishedAsP1.length + finishedAsP2.length;

    // Count wins
    const winsResult = await db
      .select()
      .from(GamesTable)
      .where(eq(GamesTable.winnerId, playerIdStr));

    const wins = winsResult.length;
    const losses = games_played - wins;

    // Count shots and hits across ALL games (stats survive restart)
    const shots = await db
      .select()
      .from(ShotsTable)
      .where(eq(ShotsTable.playerId, playerId));

    const total_shots = shots.length;
    const total_hits = shots.filter((s) => s.hit === 1).length;
    const accuracy = total_shots > 0 ? parseFloat((total_hits / total_shots).toFixed(4)) : 0;

    return NextResponse.json({
      player_id: playerId,
      games_played,
      wins,
      losses,
      total_shots,
      total_hits,
      accuracy,
    });
  } catch (error) {
    console.error("Player stats error:", error);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
