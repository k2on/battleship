// lib/drizzle.ts
import {
  json, pgTable, text, timestamp, integer, serial,
} from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

export const PlayersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  gamesPlayed: integer("gamesPlayed").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  totalShots: integer("totalShots").notNull().default(0),
  totalHits: integer("totalHits").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const GamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  player1Id: integer("player1Id").notNull(),
  player2Id: integer("player2Id"),
  status: text("status").notNull().default("waiting_setup"),
  currentTurn: integer("currentTurn"),
  winnerId: integer("winnerId"),
  gridSize: integer("gridSize").notNull().default(10),
  maxPlayers: integer("maxPlayers").notNull().default(2),
  totalMoves: integer("totalMoves").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const GamePlayersTable = pgTable("game_players", {
  id: serial("id").primaryKey(),
  gameId: integer("gameId").notNull(),
  playerId: integer("playerId").notNull(),
  joinOrder: integer("joinOrder").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ShipsTable = pgTable("ships", {
  id: text("id").primaryKey(),
  gameId: integer("gameId").notNull(),
  playerId: integer("playerId").notNull(),
  type: text("type").notNull(),
  coordinates: json("coordinates").$type<any>().notNull(),
});

export const ShotsTable = pgTable("shots", {
  id: serial("id").primaryKey(),
  gameId: integer("gameId").notNull(),
  playerId: integer("playerId").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  hit: integer("hit").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Player = InferSelectModel<typeof PlayersTable>;
export type Game = InferSelectModel<typeof GamesTable>;
export type Ship = InferSelectModel<typeof ShipsTable>;

export const db = drizzle(sql);
