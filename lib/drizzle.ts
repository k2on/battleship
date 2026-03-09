import {
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  integer
} from 'drizzle-orm/pg-core'
import { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' })

export const ShipsTable = pgTable('ships', {
  id: uuid('id').primaryKey(),
  gameId: uuid('gameId').notNull(),
  playerId: uuid('playerId').notNull(),
  type: text('type').notNull(),
  startX: integer('startX').notNull(),
  startY: integer('startY').notNull(),
  endX: integer('endX').notNull(),
  endY: integer('endY').notNull(),
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

export type User = InferSelectModel<typeof UsersTable>
export type NewUser = InferInsertModel<typeof UsersTable>

// Connect to  Postgres
export const db = drizzle(sql)
