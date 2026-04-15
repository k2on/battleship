import { db, GamesTable, ShotsTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
        request: NextRequest,
        { params }: { params: Promise<{ id: string }> }
) {
        try {
                const { id } = await params;
                const gameId = parseInt(id, 10);
                if (isNaN(gameId)) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
                if (!game) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                const shots = await db.select().from(ShotsTable).where(eq(ShotsTable.gameId, gameId));
                const moves = shots.map((s) => ({
                        player_id: s.playerId, row: s.x, col: s.y, result: s.hit === 1 ? "hit" : "miss",
                }));

                return NextResponse.json({ game_id: gameId, moves });
        } catch (error) {
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}
