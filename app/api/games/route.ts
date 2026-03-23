import { db, GamesTable } from "@/lib/drizzle";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
        try {
                const body = await request.json().catch(() => ({}));

                const gridSize = body.grid_size ?? 10;

                if (typeof gridSize !== "number" || gridSize < 5) {
                        return NextResponse.json({ error: "grid_size must be at least 5" }, { status: 400 });
                }

                if (gridSize > 15) {
                        return NextResponse.json({ error: "grid_size must be at most 15" }, { status: 400 });
                }

                const gameId = randomUUID();

                await db.insert(GamesTable).values({
                        id: gameId,
                        player1Id: body.player1_id?.toString() ?? "",
                        status: "waiting",
                        gridSize: gridSize,
                });

                return NextResponse.json({ game_id: gameId }, { status: 201 });
        } catch (error) {
                console.error("Create game error:", error);
                return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
        }
}
