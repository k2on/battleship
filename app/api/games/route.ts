import { db, GamesTable, GamePlayersTable, PlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
        try {
                const games = await db.select().from(GamesTable);
                return NextResponse.json(games.map(g => ({ game_id: g.id, status: g.status })));
        } catch (error) {
                return NextResponse.json([], { status: 200 });
        }
}

export async function POST(request: NextRequest) {
        try {
                const body = await request.json().catch(() => ({}));

                if (body.creator_id === undefined || body.creator_id === null) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (body.grid_size === undefined || body.grid_size === null) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (body.max_players === undefined || body.max_players === null) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const creatorId = body.creator_id;
                const gridSize = body.grid_size;
                const maxPlayers = body.max_players;

                if (typeof creatorId !== "number" || !Number.isInteger(creatorId)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (typeof gridSize !== "number" || !Number.isInteger(gridSize)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (typeof maxPlayers !== "number" || !Number.isInteger(maxPlayers)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (gridSize < 5 || gridSize > 15) {
                        return NextResponse.json({ error: "grid_size must be between 5 and 15" }, { status: 400 });
                }
                if (maxPlayers < 2) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const [creator] = await db.select().from(PlayersTable).where(eq(PlayersTable.id, creatorId));
                if (!creator) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const [game] = await db.insert(GamesTable).values({
                        player1Id: creatorId,
                        status: "waiting_setup",
                        gridSize,
                        maxPlayers,
                }).returning();

                return NextResponse.json({ game_id: game.id, status: "waiting_setup" }, { status: 201 });
        } catch (error) {
                console.error("Create game error:", error);
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}
