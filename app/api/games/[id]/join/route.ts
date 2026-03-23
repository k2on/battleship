import { db, GamesTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
        request: NextRequest,
        { params }: { params: Promise<{ id: string }> }
) {
        try {
                const { id } = await params;
                const body = await request.json().catch(() => ({}));

                // Find the game
                const [game] = await db
                        .select()
                        .from(GamesTable)
                        .where(eq(GamesTable.id, id));

                if (!game) {
                        return NextResponse.json({ error: "Game not found" }, { status: 404 });
                }

                if (game.status !== "waiting") {
                        return NextResponse.json({ error: "Game is not waiting for players" }, { status: 400 });
                }

                if (game.player2Id) {
                        return NextResponse.json({ error: "Game is already full" }, { status: 400 });
                }

                const player2Id = body.player2_id?.toString() ?? body.player_id?.toString() ?? "";

                // Update game with second player and set to active
                await db
                        .update(GamesTable)
                        .set({
                                player2Id: player2Id,
                                status: "active",
                                currentTurn: game.player1Id, // player 1 goes first
                                updatedAt: new Date(),
                        })
                        .where(eq(GamesTable.id, id));

                return NextResponse.json({
                        game_id: game.id,
                        status: "active",
                        player1_id: game.player1Id,
                        player2_id: player2Id,
                        current_turn: game.player1Id,
                }, { status: 200 });
        } catch (error) {
                console.error("Join game error:", error);
                return NextResponse.json({ error: "Failed to join game" }, { status: 500 });
        }
}
