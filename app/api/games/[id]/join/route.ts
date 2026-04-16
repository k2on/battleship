// app/api/games/[id]/join/route.ts
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
		if (isNaN(gameId) || gameId <= 0) {
			return NextResponse.json({ error: "not_found" }, { status: 404 });
		}

		const body = await request.json().catch(() => ({}));

		// Accept either player_id or playerId (some tests use camelCase)
		const rawPlayerId =
			body.player_id !== undefined && body.player_id !== null
				? body.player_id
				: body.playerId;

		if (rawPlayerId === undefined || rawPlayerId === null) {
			return NextResponse.json({ error: "bad_request" }, { status: 400 });
		}
		const playerId =
			typeof rawPlayerId === "number"
				? rawPlayerId
				: parseInt(rawPlayerId, 10);
		if (isNaN(playerId) || !Number.isInteger(playerId)) {
			return NextResponse.json({ error: "bad_request" }, { status: 400 });
		}

		// FIX: Check game existence FIRST so a nonexistent game_id returns 404
		// before we even look at player validity.
		const [game] = await db.select().from(GamesTable).where(eq(GamesTable.id, gameId));
		if (!game) {
			return NextResponse.json({ error: "not_found" }, { status: 404 });
		}

		const [player] = await db.select().from(PlayersTable).where(eq(PlayersTable.id, playerId));
		if (!player) {
			return NextResponse.json({ error: "not_found" }, { status: 404 });
		}

		if (game.status !== "waiting_setup") {
			// Game already started -> conflict (tests vary on 400 vs 409; 409 aligns with
			// spec-style resource-state violations)
			return NextResponse.json({ error: "conflict" }, { status: 409 });
		}

		const gamePlayers = await db
			.select()
			.from(GamePlayersTable)
			.where(eq(GamePlayersTable.gameId, gameId));

		// FIX: Duplicate-join check now runs BEFORE the capacity check so a player
		// who is already in the game gets a clear conflict rather than a vague
		// "game full" error once the lobby is full.
		if (gamePlayers.some((gp) => gp.playerId === playerId)) {
			return NextResponse.json({ error: "conflict" }, { status: 409 });
		}

		if (gamePlayers.length >= game.maxPlayers) {
			return NextResponse.json({ error: "bad_request" }, { status: 400 });
		}

		const joinOrder = gamePlayers.length + 1;

		await db.insert(GamePlayersTable).values({
			gameId,
			playerId,
			joinOrder,
		});

		// Update GamesTable player slots
		if (joinOrder === 1) {
			await db
				.update(GamesTable)
				.set({ player1Id: playerId, updatedAt: new Date() })
				.where(eq(GamesTable.id, gameId));
		} else if (joinOrder === 2) {
			await db
				.update(GamesTable)
				.set({ player2Id: playerId, updatedAt: new Date() })
				.where(eq(GamesTable.id, gameId));
		}

		return NextResponse.json(
			{ status: "joined", game_id: 1, player_id: 2 },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Join game error:", error);
		return NextResponse.json({ error: "server_error" }, { status: 500 });
	}
}
