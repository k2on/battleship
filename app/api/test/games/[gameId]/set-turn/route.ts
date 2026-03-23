import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle";
import { GamesTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  let body: { playerId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { playerId } = body;

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const [game] = await db
    .select()
    .from(GamesTable)
    .where(eq(GamesTable.id, gameId))
    .limit(1);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status !== "active") {
    return NextResponse.json(
      { error: "Can only set turn on an active game" },
      { status: 400 }
    );
  }

  if (game.player1Id !== playerId && game.player2Id !== playerId) {
    return NextResponse.json(
      { error: "Player is not a participant in this game" },
      { status: 400 }
    );
  }

  await db
    .update(GamesTable)
    .set({
      currentTurn: playerId,
      updatedAt: new Date(),
    })
    .where(eq(GamesTable.id, gameId));

  return NextResponse.json(
    { message: "Turn set successfully", gameId, currentTurn: playerId },
    { status: 200 }
  );
}