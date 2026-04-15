import { db, GamesTable, GamePlayersTable, PlayersTable } from "@/lib/drizzle";
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

                const body = await request.json().catch(() => ({}));

                if (body.player_id === undefined || body.player_id === null) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (typeof body.player_id !== "number" || !Number.isInteger(body.player_id)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const playerId = body.player_id;

                const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
                if (!game) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                const [player] = await db.select().from(PlayersTable).where(eq(PlayersTable.id, playerId));
                if (!player) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                if (game.status !== "waiting_setup") {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const gamePlayers = await db.select().from(GamePlayersTable).where(eq(GamePlayersTable.gameId, gameId));

                if (gamePlayers.length >= game.maxPlayers) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                if (gamePlayers.some((gp) => gp.playerId === playerId)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const joinOrder = gamePlayers.length + 1;

                await db.insert(GamePlayersTable).values({
                        gameId, playerId, joinOrder,
                });

                // Update GamesTable player slots
                if (joinOrder === 1) {
                        await db.update(GamesTable).set({ player1Id: playerId, updatedAt: new Date() }).where(eq(GamesTable.id, gameId));
                } else if (joinOrder === 2) {
                        await db.update(GamesTable).set({ player2Id: playerId, updatedAt: new Date() }).where(eq(GamesTable.id, gameId));
                }

                return NextResponse.json({ status: "joined", game_id: gameId, player_id: playerId }, { status: 200 });
        } catch (error) {
                console.error("Join game error:", error);
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}
