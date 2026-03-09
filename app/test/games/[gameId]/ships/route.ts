import { ShipsTable, db } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { CoordinatesValidator } from "@/lib/validators";
import { randomUUID } from "crypto";

const Schema = z.object({
        playerId: z.string(),
        ships: z.array(z.object({
                type: z.string(),
                coordinates: CoordinatesValidator
        }))
})

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
        const { gameId } = await params;
        const body = await Schema.parseAsync(await request.json());

        for (const ship of body.ships) {
                await db.insert(ShipsTable).values({
                        id: randomUUID(),
                        gameId,
                        playerId: body.playerId,
                        type: ship.type,
                        coordinates: ship.coordinates,
                });
        }

        return new Response("ok");
}
