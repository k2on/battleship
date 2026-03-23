import { db, PlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
        try {
                const body = await request.json().catch(() => ({}));

                if (!body.username || typeof body.username !== "string" || body.username.trim() === "") {
                        return NextResponse.json({ error: "Missing username" }, { status: 400 });
                }

                const [player] = await db
                        .insert(PlayersTable)
                        .values({ username: body.username.trim() })
                        .returning();

                return NextResponse.json({ player_id: player.id }, { status: 201 });
        } catch (error) {
                console.error("Create player error:", error);
                return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
        }
}
