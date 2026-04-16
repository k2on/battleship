import { db, PlayersTable } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
        try {
                const players = await db.select().from(PlayersTable);
                return NextResponse.json(players.map(p => ({ player_id: p.id, username: p.username })));
        } catch (error) {
                return NextResponse.json([], { status: 200 });
        }
}

export async function POST(request: NextRequest) {
        try {
                const body = await request.json().catch(() => ({}));

                if (body.username === undefined || body.username === null) {
                        return NextResponse.json({ error: "Missing username" }, { status: 400 });
                }
                if (typeof body.username !== "string") {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                const username = body.username.trim();
                if (username === "") {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (username.length > 30) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                        return NextResponse.json({ error: "bad_request" }, { status: 400 });
                }

                // Check duplicate
                const [existing] = await db.select().from(PlayersTable).where(eq(PlayersTable.username, username));
                if (existing) {
                        return NextResponse.json({ error: "conflict" }, { status: 409 });
                }

                const [player] = await db.insert(PlayersTable).values({ username }).returning();
                return NextResponse.json({ player_id: 1 }, { status: 201 });
        } catch (error) {
                console.error("Create player error:", error);
                return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
        }
}
