import { db, GamesTable, GamePlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
        request: NextRequest,
        { params }: { params: Promise<{ id: string }> }
) {
        try {
                const { id } = await params;
                const body = await request.json().catch(() => ({}));

                const [game] = await db
                        .select()
                        .from(GamesTable)
                        .where(eq(GamesTable.id, id));

                if (!game) {
                        return NextResponse.json({ error: "Game not found" }, { status: 404 });
                }

                // Get current players in game
                const gamePlayers = await db
                        .select()
                        .from(GamePlayersTable)
                        .where(eq(GamePlayersTable.gameId, id));

                const currentCount = gamePlayers.length;
                const maxPlayers = game.maxPlayers;

                // Check if game is full
                if (game.status !== "waiting" || currentCount >= maxPlayers) {
                        return NextResponse.json({ error: "Game is full or not accepting players" }, { status: 400 });
                }

                const newPlayerId = body.player_id?.toString() ?? body.player2_id?.toString() ?? "";

                // Add player to game_players
                await db.insert(GamePlayersTable).values({
                        gameId: id,
                        playerId: newPlayerId,
                        joinOrder: currentCount + 1,
                });

                // If this is the 2nd player, also set player2Id for backwards compat
                if (currentCount === 1) {
                        await db
                                .update(GamesTable)
                                .set({
                                        player2Id: newPlayerId,
                                        updatedAt: new Date(),
                                })
                                .where(eq(GamesTable.id, id));
                }

                // If game is now full, transition to active
                if (currentCount + 1 >= maxPlayers) {
                        await db
                                .update(GamesTable)
                                .set({
                                        status: "active",
                                        currentTurn: game.player1Id,
                                        updatedAt: new Date(),
                                })
                                .where(eq(GamesTable.id, id));
                }

                const updatedPlayers = await db
                        .select()
                        .from(GamePlayersTable)
                        .where(eq(GamePlayersTable.gameId, id));

                const playerIds = updatedPlayers
                        .sort((a, b) => a.joinOrder - b.joinOrder)
                        .map((gp) => gp.playerId);

                return NextResponse.json({
                        game_id: game.id,
                        status: currentCount + 1 >= maxPlayers ? "active" : "waiting",
                        players: playerIds,
                        player1_id: game.player1Id,
                        player2_id: currentCount === 1 ? newPlayerId : game.player2Id,
                        current_turn: currentCount + 1 >= maxPlayers ? game.player1Id : null,
                }, { status: 200 });
        } catch (error) {
                console.error("Join game error:", error);
                return NextResponse.json({ error: "Failed to join game" }, { status: 500 });
        }
}
