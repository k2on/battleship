import { db, GamesTable, ShipsTable, ShotsTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

                // Clear ships and shots for this game only (stats in other games survive)
                await db.delete(ShotsTable).where(eq(ShotsTable.gameId, id));
                await db.delete(ShipsTable).where(eq(ShipsTable.gameId, id));

                // Reset game state back to waiting
                await db
                        .update(GamesTable)
                        .set({
                                status: "waiting",
                                currentTurn: null,
                                winnerId: null,
                                updatedAt: new Date(),
                        })
                        .where(eq(GamesTable.id, id));

                return NextResponse.json({
                        game_id: id,
                        status: "waiting",
                        message: "Game restarted successfully",
                }, { status: 200 });
        } catch (error) {
                console.error("Restart game error:", error);
                return NextResponse.json({ error: "Failed to restart game" }, { status: 500 });
        }
}
