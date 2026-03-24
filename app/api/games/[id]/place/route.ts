import { db, GamesTable, ShipsTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

function normalizeCoord(coord: any): { row: number; col: number } | null {
        if (coord.row !== undefined && coord.col !== undefined) {
                return { row: coord.row, col: coord.col };
        }
        if (coord.x !== undefined && coord.y !== undefined) {
                return { row: coord.y, col: coord.x };
        }
        if (Array.isArray(coord) && coord.length === 2) {
                return { row: coord[0], col: coord[1] };
        }
        return null;
}

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

                const playerId = body.player_id?.toString();
                if (!playerId) {
                        return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
                }

                if (game.player1Id !== playerId && game.player2Id !== playerId) {
                        return NextResponse.json({ error: "Player not in this game" }, { status: 403 });
                }

                const ships = body.ships;

                if (!Array.isArray(ships) || ships.length !== 3) {
                        return NextResponse.json(
                                { error: "Exactly 3 ships are required" },
                                { status: 400 }
                        );
                }

                const gridSize = game.gridSize;
                const allCoords: string[] = [];

                // Detect format: flat {row, col} entries vs objects with .coordinates
                const isFlat = ships[0]?.row !== undefined || ships[0]?.col !== undefined;

                const normalizedShips: Array<{ type: string; coordinates: Array<{ row: number; col: number }> }> = [];

                if (isFlat) {
                        for (let i = 0; i < ships.length; i++) {
                                const coord = normalizeCoord(ships[i]);
                                if (!coord) {
                                        return NextResponse.json({ error: "Invalid coordinate format" }, { status: 400 });
                                }
                                if (coord.row < 0 || coord.col < 0 || coord.row >= gridSize || coord.col >= gridSize) {
                                        return NextResponse.json(
                                                { error: `Coordinates (${coord.row}, ${coord.col}) are out of bounds` },
                                                { status: 400 }
                                        );
                                }
                                const key = `${coord.row},${coord.col}`;
                                if (allCoords.includes(key)) {
                                        return NextResponse.json(
                                                { error: `Overlapping coordinates at (${coord.row}, ${coord.col})` },
                                                { status: 400 }
                                        );
                                }
                                allCoords.push(key);
                                normalizedShips.push({
                                        type: ships[i].type ?? `ship_${i + 1}`,
                                        coordinates: [coord],
                                });
                        }
                } else {
                        for (let i = 0; i < ships.length; i++) {
                                const rawCoords = ships[i].coordinates;
                                if (!Array.isArray(rawCoords) || rawCoords.length === 0) {
                                        return NextResponse.json(
                                                { error: "Each ship must have coordinates" },
                                                { status: 400 }
                                        );
                                }
                                const coords: Array<{ row: number; col: number }> = [];
                                for (const rc of rawCoords) {
                                        const coord = normalizeCoord(rc);
                                        if (!coord) {
                                                return NextResponse.json({ error: "Invalid coordinate format" }, { status: 400 });
                                        }
                                        if (coord.row < 0 || coord.col < 0 || coord.row >= gridSize || coord.col >= gridSize) {
                                                return NextResponse.json(
                                                        { error: `Coordinates (${coord.row}, ${coord.col}) are out of bounds` },
                                                        { status: 400 }
                                                );
                                        }
                                        const key = `${coord.row},${coord.col}`;
                                        if (allCoords.includes(key)) {
                                                return NextResponse.json(
                                                        { error: `Overlapping coordinates at (${coord.row}, ${coord.col})` },
                                                        { status: 400 }
                                                );
                                        }
                                        allCoords.push(key);
                                        coords.push(coord);
                                }
                                normalizedShips.push({
                                        type: ships[i].type ?? `ship_${i + 1}`,
                                        coordinates: coords,
                                });
                        }
                }

                // Check if player already placed ships
                const existingShips = await db
                        .select()
                        .from(ShipsTable)
                        .where(and(eq(ShipsTable.gameId, id), eq(ShipsTable.playerId, playerId)));

                if (existingShips.length > 0) {
                        return NextResponse.json(
                                { error: "Ships already placed for this player" },
                                { status: 400 }
                        );
                }

                const shipRows = normalizedShips.map((ship) => ({
                        id: randomUUID(),
                        gameId: id,
                        playerId: playerId,
                        type: ship.type,
                        coordinates: ship.coordinates.map(c => [c.col, c.row] as [number, number]),
                }));

                await db.insert(ShipsTable).values(shipRows);

                return NextResponse.json({ message: "Ships placed successfully" }, { status: 200 });
        } catch (error) {
                console.error("Place ships error:", error);
                return NextResponse.json({ error: "Failed to place ships" }, { status: 500 });
        }
}
