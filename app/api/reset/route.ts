// app/api/reset/route.ts
import { db } from "@/lib/drizzle";
import { NextResponse } from "next/server";

export async function POST() {
        try {
                await db.execute(`
                      TRUNCATE TABLE
                        shots,
                        ships,
                        game_players,
                        games,
                        players
                      RESTART IDENTITY CASCADE;
                `);
                return NextResponse.json({ status: "ok" }, { status: 200 });
        } catch (error) {
                return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
}
