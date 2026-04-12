import { db, GamesTable, ShipsTable, PlayersTable, ShotsTable } from "@/lib/drizzle";
import { NextResponse } from "next/server";

export async function POST() {
        try {
                await db.delete(ShotsTable);
                await db.delete(ShipsTable);
                await db.delete(GamesTable);
                await db.delete(PlayersTable);

                return NextResponse.json({ status: "ok" }, { status: 200 });
        } catch (error) {
                console.error("Reset error:", error);
                return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
        }
}
