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

                // Validate player is in this game
                if (game.player1Id !== playerId && game.player2Id !== playerId) {
                        return NextResponse.json({ error: "Player not in this game" }, { status: 403 });
                }

                const ships = body.ships;

                // Must have exactly 3 ships
                if (!Array.isArray(ships) || ships.length !== 3) {
                        return NextResponse.json(
                                { error: "Exactly 3 ships are required" },
                                { status: 400 }
                        );
                }

                const gridSize = game.gridSize;
                const allCoords: string[] = [];

                for (const ship of ships) {
                        const coords = ship.coordinates;
                        if (!Array.isArray(coords) || coords.length === 0) {
                                return NextResponse.json(
                                        { error: "Each ship must have coordinates" },
                                        { status: 400 }
                                );
                        }

                        for (const coord of coords) {
                                const { x, y } = coord;

                                // Out-of-bounds check
                                if (
                                        typeof x !== "number" ||
                                        typeof y !== "number" ||
                                        x < 0 ||
                                        y < 0 ||
                                        x >= gridSize ||
                                        y >= gridSize
                                ) {
                                        return NextResponse.json(
                                                { error: `Coordinates (${x}, ${y}) are out of bounds for grid size ${gridSize}` },
                                                { status: 400 }
                                        );
                                }

                                // Overlap check
                                const key = `${x},${y}`;
                                if (allCoords.includes(key)) {
                                        return NextResponse.json(
                                                { error: `Overlapping coordinates at (${x}, ${y})` },
                                                { status: 400 }
                                        );
                                }
                                allCoords.push(key);
                        }
                }

                // Check if player already placed ships
                const existingShips = await db
                        .select()
                        .from(ShipsTable)
                        .where(
                                and(eq(ShipsTable.gameId, id), eq(ShipsTable.playerId, playerId))
                        );

                if (existingShips.length > 0) {
                        return NextResponse.json(
                                { error: "Ships already placed for this player" },
                                { status: 400 }
                        );
                }

                // Insert all ships
                const shipRows = ships.map((ship: any, index: number) => ({
                        id: randomUUID(),
                        gameId: id,
                        playerId: playerId,
                        type: ship.type ?? `ship_${index + 1}`,
                        coordinates: ship.coordinates,
                }));

                await db.insert(ShipsTable).values(shipRows);

                return NextResponse.json(
                        { message: "Ships placed successfully" },
                        { status: 200 }
                );
        } catch (error) {
                console.error("Place ships error:", error);
                return NextResponse.json(
                        { error: "Failed to place ships" },
                        { status: 500 }
                );
        }
}
