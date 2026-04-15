import { db, PlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
        try {
                const body = await request.json().catch(() => ({}));

                if (body.username === undefined || body.username === null) {
                        return NextResponse.json({ error: "Missing username" }, { status: 400 });
                }

                if (typeof body.username !== "string") {
                        return NextResponse.json({ error: "Username must be a string" }, { status: 400 });
                }

                const username = body.username.trim();

                if (username === "") {
                        return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
                }

                if (username.length > 30) {
                        return NextResponse.json({ error: "Username must be 30 characters or fewer" }, { status: 400 });
                }

                // Only allow alphanumeric and underscores
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                        return NextResponse.json({ error: "Username contains invalid characters" }, { status: 400 });
                }

                // Check duplicate username
                const [existing] = await db
                        .select()
                        .from(PlayersTable)
                        .where(eq(PlayersTable.username, username));

                if (existing) {
                        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
                }

                const [player] = await db
                        .insert(PlayersTable)
                        .values({ username })
                        .returning();

                return NextResponse.json({ player_id: player.id }, { status: 201 });
        } catch (error) {
                console.error("Create player error:", error);
                return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
        }
}
