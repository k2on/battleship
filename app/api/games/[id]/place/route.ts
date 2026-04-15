import { db, GamesTable, ShipsTable, GamePlayersTable } from "@/lib/drizzle";
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

                if (body.player_id === undefined || body.player_id === null) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                const playerId = typeof body.player_id === "number" ? body.player_id : parseInt(body.player_id, 10);
                if (isNaN(playerId)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
                if (!game) {
                        return NextResponse.json({ error: "not_found" }, { status: 404 });
                }

                // Check player is in game
                const gamePlayers = await db.select().from(GamePlayersTable).where(eq(GamePlayersTable.gameId, gameId));
                if (!gamePlayers.some((gp) => gp.playerId === playerId)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                if (!body.ships) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (!Array.isArray(body.ships)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (body.ships.length === 0) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (body.ships.length !== 3) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                const ships = body.ships;
                const gridSize = game.gridSize;
                const allCoords: string[] = [];
                const isFlat = ships[0]?.row !== undefined || ships[0]?.col !== undefined;

                const normalized: Array<{ type: string; coordinates: Array<{ row: number; col: number }> }> = [];

                for (let i = 0; i < ships.length; i++) {
                        if (Array.isArray(ships[i])) {
                                return NextResponse.json({ error: "bad_request" }, { status: 400 });
                        }

                        let coords: Array<{ row: number; col: number }> = [];

                        if (isFlat) {
                                const s = ships[i];
                                if (typeof s.row !== "number" || typeof s.col !== "number") {
                                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                                }
                                coords = [{ row: s.row, col: s.col }];
                        } else {
                                const rawCoords = ships[i].coordinates;
                                if (!Array.isArray(rawCoords) || rawCoords.length === 0) {
                                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                                }
                                for (const rc of rawCoords) {
                                        if (Array.isArray(rc)) {
                                                return NextResponse.json({ error: "bad_request" }, { status: 400 });
                                        }
                                        if (typeof rc.row !== "number" || typeof rc.col !== "number") {
                                                return NextResponse.json({ error: "bad_request" }, { status: 400 });
                                        }
                                        coords.push({ row: rc.row, col: rc.col });
                                }
                        }

                        for (const c of coords) {
                                if (c.row < 0 || c.col < 0 || c.row >= gridSize || c.col >= gridSize) {
                                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                                }
                                const key = `${c.row},${c.col}`;
                                if (allCoords.includes(key)) {
                                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                                }
                                allCoords.push(key);
                        }

                        normalized.push({ type: ships[i].type ?? `ship_${i + 1}`, coordinates: coords });
                }

                // Check double placement → 409
                const existing = await db.select().from(ShipsTable)
                        .where(and(eq(ShipsTable.gameId, gameId), eq(ShipsTable.playerId, playerId)));
                if (existing.length > 0) {
                        return NextResponse.json({ error: "conflict" }, { status: 409 });
                }

                const shipRows = normalized.map((s) => ({
                        id: randomUUID(), gameId, playerId, type: s.type, coordinates: s.coordinates,
                }));
                await db.insert(ShipsTable).values(shipRows);

                // Check if all players placed → transition to playing
                let allPlaced = true;
                for (const gp of gamePlayers) {
                        if (gp.playerId === playerId) continue;
                        const their = await db.select().from(ShipsTable)
                                .where(and(eq(ShipsTable.gameId, gameId), eq(ShipsTable.playerId, gp.playerId)));
                        if (their.length === 0) { allPlaced = false; break; }
                }

                if (allPlaced && gamePlayers.length >= game.maxPlayers) {
                        await db.update(GamesTable).set({
                                status: "playing", currentTurn: game.player1Id, updatedAt: new Date(),
                        }).where(eq(GamesTable.id, gameId));
                }

                return NextResponse.json({ status: "placed", game_id: gameId, player_id: playerId }, { status: 200 });
        } catch (error) {
                console.error("Place ships error:", error);
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}
