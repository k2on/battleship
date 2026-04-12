import { db, GamesTable, ShotsTable } from "@/lib/drizzle";
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

                const shots = await db
                        .select()
                        .from(ShotsTable)
                        .where(eq(ShotsTable.gameId, id));

                const moves = shots.map((shot) => ({
                        player_id: shot.playerId,
                        row: shot.x,
                        col: shot.y,
                        hit: shot.hit === 1,
                        created_at: shot.createdAt,
                }));

                return NextResponse.json({
                        game_id: id,
                        moves,
                });
        } catch (error) {
                console.error("Get moves error:", error);
                return NextResponse.json({ error: "Failed to get moves" }, { status: 500 });
        }
}
