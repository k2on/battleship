import { db, ShipsTable } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
        const { id: gameId } = await params;

        const searchParams = new URL(request.url).searchParams;
        const playerId = searchParams.get("playerId");
        if (!playerId) return new Response("No player ID", { status: 400 });

        const ships = await db.select()
                .from(ShipsTable)
                .where(and(
                        eq(ShipsTable.playerId, playerId),
                        eq(ShipsTable.gameId, gameId)

                ));

        return new Response(JSON.stringify(ships));
}



