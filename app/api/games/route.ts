import { db, GamesTable, GamePlayersTable, PlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
        try {
                const body = await request.json().catch(() => ({}));

                // Validate required fields
                if (body.creator_id === undefined || body.creator_id === null) {
                        return NextResponse.json({ error: "Missing creator_id" }, { status: 400 });
                }

                if (body.grid_size === undefined || body.grid_size === null) {
                        return NextResponse.json({ error: "Missing grid_size" }, { status: 400 });
                }

                if (body.max_players === undefined || body.max_players === null) {
                        return NextResponse.json({ error: "Missing max_players" }, { status: 400 });
                }

                const creatorId = body.creator_id;
                const gridSize = body.grid_size;
                const maxPlayers = body.max_players;

                if (typeof creatorId !== "number" || !Number.isInteger(creatorId)) {
                        return NextResponse.json({ error: "creator_id must be an integer" }, { status: 400 });
                }

                if (typeof gridSize !== "number" || !Number.isInteger(gridSize)) {
                        return NextResponse.json({ error: "grid_size must be an integer" }, { status: 400 });
                }

                if (typeof maxPlayers !== "number" || !Number.isInteger(maxPlayers)) {
                        return NextResponse.json({ error: "max_players must be an integer" }, { status: 400 });
                }

                if (gridSize < 5) {
                        return NextResponse.json({ error: "grid_size must be at least 5" }, { status: 400 });
                }

                if (gridSize > 15) {
                        return NextResponse.json({ error: "grid_size must be at most 15" }, { status: 400 });
                }

                if (maxPlayers < 2) {
                        return NextResponse.json({ error: "max_players must be at least 2" }, { status: 400 });
                }

                // Validate creator exists
                const [creator] = await db
                        .select()
                        .from(PlayersTable)
                        .where(eq(PlayersTable.id, creatorId));

                if (!creator) {
                        return NextResponse.json({ error: "Creator player not found" }, { status: 400 });
                }

                const [game] = await db.insert(GamesTable).values({
                        player1Id: creatorId,
                        status: "waiting_setup",
                        gridSize,
                        maxPlayers,
                }).returning();

                // Add creator to game_players
                await db.insert(GamePlayersTable).values({
                        gameId: game.id,
                        playerId: creatorId,
                        joinOrder: 1,
                });

                return NextResponse.json({
                        game_id: game.id,
                        status: "waiting_setup",
                }, { status: 201 });
        } catch (error) {
                console.error("Create game error:", error);
                return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
        }
}
