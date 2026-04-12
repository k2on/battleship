import { db, GamesTable, ShipsTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

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

                const playerId = body.player_id?.toString();
                if (!playerId) {
                        return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
                }

                const ships = body.ships;
                console.log("Test ships request body:", JSON.stringify(body, null, 2));
                if (!Array.isArray(ships) || ships.length === 0) {
                        return NextResponse.json({ error: "Ships required" }, { status: 400 });
                }

                // Delete any existing ships for this player in this game (test mode allows overwrite)
                await db
                        .delete(ShipsTable)
                        .where(
                                and(eq(ShipsTable.gameId, id), eq(ShipsTable.playerId, playerId))
                        );

                // Ships can arrive in two formats:
                // 1. Flat array of {row, col} — each entry is a single-cell ship
                // 2. Array of objects with a .coordinates property
                const shipRows = ships.map((ship: any, index: number) => {
                        let coordinates: any;

                        if (ship.coordinates) {
                                // Format 2: ship has nested coordinates
                                coordinates = ship.coordinates;
                        } else if (ship.row !== undefined && ship.col !== undefined) {
                                // Format 1: each ship IS a coordinate {row, col}
                                coordinates = [{ row: ship.row, col: ship.col }];
                        } else {
                                coordinates = [];
                        }

                        return {
                                id: randomUUID(),
                                gameId: id,
                                playerId: playerId,
                                type: ship.type ?? `ship_${index + 1}`,
                                coordinates,
                        };
                });

                await db.insert(ShipsTable).values(shipRows);

                return NextResponse.json(
                        { message: "Ships placed successfully (test mode)" },
                        { status: 200 }
                );
        } catch (error) {
                console.error("Test place ships error:", error);
                return NextResponse.json(
                        { error: "Failed to place ships" },
                        { status: 500 }
                );
        }
}

export async function GET(
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

                const ships = await db
                        .select()
                        .from(ShipsTable)
                        .where(eq(ShipsTable.gameId, id));

                return NextResponse.json({ game_id: id, ships }, { status: 200 });
        } catch (error) {
                console.error("Test get ships error:", error);
                return NextResponse.json(
                        { error: "Failed to get ships" },
                        { status: 500 }
                );
        }
}
