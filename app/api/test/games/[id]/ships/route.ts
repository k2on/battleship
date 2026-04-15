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
                const gameId = parseInt(id, 10);
                if (isNaN(gameId)) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                const body = await request.json().catch(() => ({}));
                const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
                if (!game) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                const playerId = typeof body.player_id === "number" ? body.player_id : parseInt(body.player_id, 10);
                if (isNaN(playerId)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const ships = body.ships;
                if (!Array.isArray(ships) || ships.length === 0) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                // Delete existing (test mode allows overwrite)
                await db.delete(ShipsTable).where(and(eq(ShipsTable.gameId, gameId), eq(ShipsTable.playerId, playerId)));

                const shipRows = ships.map((ship: any, index: number) => {
                        let coordinates: any;
                        if (ship.coordinates) {
                                coordinates = ship.coordinates;
                        } else if (ship.row !== undefined && ship.col !== undefined) {
                                coordinates = [{ row: ship.row, col: ship.col }];
                        } else {
                                coordinates = [];
                        }
                        return { id: randomUUID(), gameId, playerId, type: ship.type ?? `ship_${index + 1}`, coordinates };
                });

                await db.insert(ShipsTable).values(shipRows);
                return NextResponse.json({ message: "Ships placed (test mode)" }, { status: 200 });
        } catch (error) {
                console.error("Test ships error:", error);
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}

export async function GET(
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
                const ships = await db.select().from(ShipsTable).where(eq(ShipsTable.gameId, gameId));
                return NextResponse.json({ game_id: gameId, ships });
        } catch (error) {
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}
