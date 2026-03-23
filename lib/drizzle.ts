import {
  json,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  serial,
} from "drizzle-orm/pg-core";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Coordinates } from "./validators";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

export const PlayersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ShipsTable = pgTable("ships", {
  id: text("id").primaryKey(),
  gameId: text("gameId").notNull(),
  playerId: text("playerId").notNull(),
  type: text("type").notNull(),
  coordinates: json("coordinates").$type<Coordinates>().notNull(),
});

export const UsersTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  image: text("image").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const GamesTable = pgTable("games", {
  id: text("id").primaryKey(),
  player1Id: text("player1Id").notNull(),
  player2Id: text("player2Id"),
  status: text("status", { enum: ["waiting", "active", "finished"] })
    .notNull()
    .default("waiting"),
  currentTurn: text("currentTurn"),
  winnerId: text("winnerId"),
  gridSize: integer("gridSize").notNull().default(10),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const ShotsTable = pgTable("shots", {
  id: serial("id").primaryKey(),
  gameId: text("gameId").notNull(),
  playerId: integer("playerId").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  hit: integer("hit").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Ship = InferSelectModel<typeof ShipsTable>;
export type NewShip = InferInsertModel<typeof ShipsTable>;
export type Game = InferSelectModel<typeof GamesTable>;
export type NewGame = InferInsertModel<typeof GamesTable>;
export type User = InferSelectModel<typeof UsersTable>;
export type NewUser = InferInsertModel<typeof UsersTable>;
export type Player = InferSelectModel<typeof PlayersTable>;
export type NewPlayer = InferInsertModel<typeof PlayersTable>;

export const db = drizzle(sql);
