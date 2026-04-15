import { db, GamesTable, GamePlayersTable, PlayersTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
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

                const body = await request.json().catch(() => ({}));

                // Validate player_id present and is integer
                if (body.player_id === undefined || body.player_id === null) {
                        return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
                }

                if (typeof body.player_id !== "number" || !Number.isInteger(body.player_id)) {
                        return NextResponse.json({ error: "player_id must be an integer" }, { status: 400 });
                }

                const playerId = body.player_id;

                const [game] = await db
                        .select()
                        .from(GamesTable)
                        .where(eq(GamesTable.id, gameId));

                if (!game) {
                        return NextResponse.json({ error: "Game not found" }, { status: 404 });
                }

                // Validate player exists
                const [player] = await db
                        .select()
                        .from(PlayersTable)
                        .where(eq(PlayersTable.id, playerId));

                if (!player) {
                        return NextResponse.json({ error: "Player not found" }, { status: 404 });
                }

                // Game must be in waiting_setup
                if (game.status !== "waiting_setup") {
                        return NextResponse.json({ error: "Game is not accepting players" }, { status: 400 });
                }

                // Get current players
                const gamePlayers = await db
                        .select()
                        .from(GamePlayersTable)
                        .where(eq(GamePlayersTable.gameId, gameId));

                // Check if game is full
                if (gamePlayers.length >= game.maxPlayers) {
                        return NextResponse.json({ error: "Game is full" }, { status: 400 });
                }

                // Check if player already joined
                const alreadyJoined = gamePlayers.some((gp) => gp.playerId === playerId);
                if (alreadyJoined) {
                        return NextResponse.json({ error: "Player already in this game" }, { status: 400 });
                }

                // Add player
                await db.insert(GamePlayersTable).values({
                        gameId: gameId,
                        playerId: playerId,
                        joinOrder: gamePlayers.length + 1,
                });

                // Set player2Id for 2-player compat
                if (gamePlayers.length === 1) {
                        await db
                                .update(GamesTable)
                                .set({ player2Id: playerId, updatedAt: new Date() })
                                .where(eq(GamesTable.id, gameId));
                }

                return NextResponse.json({
                        game_id: gameId,
                        status: "waiting_setup",
                        player_id: playerId,
                }, { status: 200 });
        } catch (error) {
                console.error("Join game error:", error);
                return NextResponse.json({ error: "Failed to join game" }, { status: 500 });
        }
}
