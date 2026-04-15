import { db, PlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
        request: NextRequest,
        { params }: { params: Promise<{ id: string }> }
) {
        try {
                const { id } = await params;
                const playerId = parseInt(id, 10);

                if (isNaN(playerId) || playerId <= 0) {
                        return NextResponse.json({ error: "Player not found" }, { status: 404 });
                }

                const [player] = await db
                        .select()
                        .from(PlayersTable)
                        .where(eq(PlayersTable.id, playerId));

                if (!player) {
                        return NextResponse.json({ error: "Player not found" }, { status: 404 });
                }

                const total_shots = player.totalShots;
                const total_hits = player.totalHits;
                // accuracy must be a float (0.0 not 0)
                const accuracy = total_shots > 0
                        ? parseFloat((total_hits / total_shots).toFixed(4))
                        : 0.0;

                return NextResponse.json({
                        player_id: playerId,
                        games_played: player.gamesPlayed,
                        wins: player.wins,
                        losses: player.losses,
                        total_shots,
                        total_hits,
                        accuracy,
                });
        } catch (error) {
                console.error("Player stats error:", error);
                return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
        }
}
