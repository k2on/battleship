import { db, GamesTable, ShipsTable, ShotsTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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

                const [game] = await db
                        .select()
                        .from(GamesTable)
                        .where(eq(GamesTable.id, gameId));

                if (!game) {
                        return NextResponse.json({ error: "Game not found" }, { status: 404 });
                }

                // Clear shots and ships for this game
                await db.delete(ShotsTable).where(eq(ShotsTable.gameId, gameId));
                await db.delete(ShipsTable).where(eq(ShipsTable.gameId, gameId.toString()));

                // Reset game state to waiting_setup
                await db
                        .update(GamesTable)
                        .set({
                                status: "waiting_setup",
                                currentTurn: null,
                                winnerId: null,
                                totalMoves: 0,
                                updatedAt: new Date(),
                        })
                        .where(eq(GamesTable.id, gameId));

                return NextResponse.json({
                        game_id: gameId,
                        status: "waiting_setup",
                        message: "Game restarted successfully",
                }, { status: 200 });
        } catch (error) {
                console.error("Restart game error:", error);
                return NextResponse.json({ error: "Failed to restart game" }, { status: 500 });
        }
}
