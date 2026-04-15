import { db, GamesTable, ShipsTable, GamePlayersTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

function normalizeCoord(coord: any): { row: number; col: number } | null {
        if (coord && typeof coord === "object" && !Array.isArray(coord) &&
                typeof coord.row === "number" && typeof coord.col === "number") {
                return { row: coord.row, col: coord.col };
        }
        return null;
}

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

                // Validate player_id
                if (body.player_id === undefined || body.player_id === null) {
                        return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
                }

                const playerId = typeof body.player_id === "number" ? body.player_id : parseInt(body.player_id, 10);
                if (isNaN(playerId)) {
                        return NextResponse.json({ error: "Invalid player_id" }, { status: 400 });
                }

                const [game] = await db
                        .select()
                        .from(GamesTable)
                        .where(eq(GamesTable.id, gameId));

                if (!game) {
                        return NextResponse.json({ error: "Game not found" }, { status: 404 });
                }

                // Check player is in this game
                const gamePlayers = await db
                        .select()
                        .from(GamePlayersTable)
                        .where(eq(GamePlayersTable.gameId, gameId));

                const isInGame = gamePlayers.some((gp) => gp.playerId === playerId);
                if (!isInGame) {
                        return NextResponse.json({ error: "Player not in this game" }, { status: 400 });
                }

                // Validate ships field
                if (!body.ships) {
                        return NextResponse.json({ error: "Missing ships field" }, { status: 400 });
                }

                const ships = body.ships;

                if (!Array.isArray(ships)) {
                        return NextResponse.json({ error: "Ships must be an array" }, { status: 400 });
                }

                if (ships.length === 0) {
                        return NextResponse.json({ error: "Ships array cannot be empty" }, { status: 400 });
                }

                if (ships.length !== 3) {
                        return NextResponse.json({ error: "Exactly 3 ships are required" }, { status: 400 });
                }

                const gridSize = game.gridSize;
                const allCoords: string[] = [];
                const playerIdStr = playerId.toString();

                // Detect format: flat {row, col} entries vs objects with .coordinates
                const isFlat = ships[0]?.row !== undefined || ships[0]?.col !== undefined;

                const normalizedShips: Array<{ type: string; coordinates: Array<{ row: number; col: number }> }> = [];

                if (isFlat) {
                        for (let i = 0; i < ships.length; i++) {
                                // Reject arrays like [[0,0]]
                                if (Array.isArray(ships[i])) {
                                        return NextResponse.json({ error: "Ships must be objects with row and col, not arrays" }, { status: 400 });
                                }
                                const coord = normalizeCoord(ships[i]);
                                if (!coord) {
                                        return NextResponse.json({ error: "Invalid coordinate format" }, { status: 400 });
                                }
                                if (coord.row < 0 || coord.col < 0 || coord.row >= gridSize || coord.col >= gridSize) {
                                        return NextResponse.json({ error: "Coordinates out of bounds" }, { status: 400 });
                                }
                                const key = `${coord.row},${coord.col}`;
                                if (allCoords.includes(key)) {
                                        return NextResponse.json({ error: "Duplicate coordinates" }, { status: 400 });
                                }
                                allCoords.push(key);
                                normalizedShips.push({
                                        type: ships[i].type ?? `ship_${i + 1}`,
                                        coordinates: [coord],
                                });
                        }
                } else {
                        for (let i = 0; i < ships.length; i++) {
                                // Reject arrays
                                if (Array.isArray(ships[i])) {
                                        return NextResponse.json({ error: "Ships must be objects, not arrays" }, { status: 400 });
                                }
                                const rawCoords = ships[i].coordinates;
                                if (!Array.isArray(rawCoords) || rawCoords.length === 0) {
                                        return NextResponse.json({ error: "Each ship must have coordinates" }, { status: 400 });
                                }
                                const coords: Array<{ row: number; col: number }> = [];
                                for (const rc of rawCoords) {
                                        if (Array.isArray(rc)) {
                                                return NextResponse.json({ error: "Coordinates must be objects with row and col, not arrays" }, { status: 400 });
                                        }
                                        const coord = normalizeCoord(rc);
                                        if (!coord) {
                                                return NextResponse.json({ error: "Invalid coordinate format" }, { status: 400 });
                                        }
                                        if (coord.row < 0 || coord.col < 0 || coord.row >= gridSize || coord.col >= gridSize) {
                                                return NextResponse.json({ error: "Coordinates out of bounds" }, { status: 400 });
                                        }
                                        const key = `${coord.row},${coord.col}`;
                                        if (allCoords.includes(key)) {
                                                return NextResponse.json({ error: "Duplicate coordinates" }, { status: 400 });
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

                // Check if player already placed ships → 409
                const existingShips = await db
                        .select()
                        .from(ShipsTable)
                        .where(and(eq(ShipsTable.gameId, gameId.toString()), eq(ShipsTable.playerId, playerIdStr)));

                if (existingShips.length > 0) {
                        return NextResponse.json({ error: "Ships already placed" }, { status: 409 });
                }

                // Insert ships
                const shipRows = normalizedShips.map((ship) => ({
                        id: randomUUID(),
                        gameId: gameId.toString(),
                        playerId: playerIdStr,
                        type: ship.type,
                        coordinates: ship.coordinates,
                }));

                await db.insert(ShipsTable).values(shipRows);

                // Check if all players have placed ships → transition to "playing"
                const allPlayersInGame = gamePlayers.map((gp) => gp.playerId.toString());
                let allPlaced = true;
                for (const pid of allPlayersInGame) {
                        if (pid === playerIdStr) continue; // just placed
                        const theirShips = await db
                                .select()
                                .from(ShipsTable)
                                .where(and(eq(ShipsTable.gameId, gameId.toString()), eq(ShipsTable.playerId, pid)));
                        if (theirShips.length === 0) {
                                allPlaced = false;
                                break;
                        }
                }

                if (allPlaced && gamePlayers.length >= game.maxPlayers) {
                        await db
                                .update(GamesTable)
                                .set({
                                        status: "playing",
                                        currentTurn: game.player1Id,
                                        updatedAt: new Date(),
                                })
                                .where(eq(GamesTable.id, gameId));
                }

                return NextResponse.json({ message: "Ships placed successfully" }, { status: 200 });
        } catch (error) {
                console.error("Place ships error:", error);
                return NextResponse.json({ error: "Failed to place ships" }, { status: 500 });
        }
}
