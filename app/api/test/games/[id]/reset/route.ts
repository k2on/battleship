import { ShipsTable, db } from "@/lib/drizzle";
import { eq } from "drizzle-orm";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
        const { id: gameId } = await params;
        await db.delete(ShipsTable).where(eq(ShipsTable.gameId, gameId))
}
