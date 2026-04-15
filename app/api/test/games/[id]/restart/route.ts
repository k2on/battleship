import { db, GamesTable, ShipsTable, ShotsTable, GamePlayersTable } from "@/lib/drizzle";
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
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
                if (!game) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                await db.delete(ShotsTable).where(eq(ShotsTable.gameId, gameId));
                await db.delete(ShipsTable).where(eq(ShipsTable.gameId, gameId));
                await db.delete(GamePlayersTable).where(eq(GamePlayersTable.gameId, gameId));

                await db.update(GamesTable).set({
                        status: "waiting_setup",
                        currentTurn: null,
                        winnerId: null,
                        player2Id: null,
                        totalMoves: 0,
                        updatedAt: new Date(),
                }).where(eq(GamesTable.id, gameId));

                return NextResponse.json({ game_id: gameId, status: "waiting_setup" }, { status: 200 });
        } catch (error) {
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}
