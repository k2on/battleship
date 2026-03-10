import {
json, pgTable,
  serial,
  text,
  timestamp,
  uuid,
  integer
} from 'drizzle-orm/pg-core'
import { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { Coordinates } from './validators';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' })

export const ShipsTable = pgTable('ships', {
  id: uuid('id').primaryKey(),
  gameId: uuid('gameId').notNull(),
  playerId: uuid('playerId').notNull(),
  type: text('type').notNull(),
  coordinates: json('coordinates').$type<Coordinates>().notNull()
});

export type Ship = InferSelectModel<typeof ShipsTable>
export type NewShip = InferInsertModel<typeof ShipsTable>

export const UsersTable = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    image: text('image').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  }
)

export const GamesTable = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  player1Id: uuid('player1Id').notNull(),
  player2Id: uuid('player2Id'), // nullable until someone joins
  status: text('status', { enum: ['waiting', 'active', 'finished'] }).notNull().default('waiting'),
  currentTurn: uuid('currentTurn'), // nullable until game starts
  winnerId: uuid('winnerId'),       // nullable until game ends
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export type Game = InferSelectModel<typeof GamesTable>
export type NewGame = InferInsertModel<typeof GamesTable>

export type User = InferSelectModel<typeof UsersTable>
export type NewUser = InferInsertModel<typeof UsersTable>

// Connect to  Postgres
export const db = drizzle(sql)
