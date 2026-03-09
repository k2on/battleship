import { ShipsTable, db } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { CoordinatesValidator } from "@/lib/validators";

const Schema = z.object({
        playerId: z.string(),
        ships: z.array(z.object({
                type: z.string(),
                coordinates: CoordinatesValidator
        }))
})

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
        const { gameId } = await params;

        const body = await Schema.parseAsync(request.json());

        console.log(body);

        return "ok";
        
        // await db.delete(ShipsTable).where(eq(ShipsTable.gameId, gameId))
}











