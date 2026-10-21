import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { user } from './auth'
import type { GameSettings, Match, MatchSummary, PlayerIdentity } from '../../../shared/types/darts'
import type { Preferences, RoomView } from '../../../shared/types/rooms'

export const preferences = pgTable('preferences', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Preferences>().notNull()
})
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  isSelf: boolean('is_self').default(false).notNull(),
  archived: boolean('archived').default(false).notNull()
}, table => [index('players_owner_idx').on(table.ownerId), uniqueIndex('players_self_idx').on(table.ownerId).where(sql`${table.isSelf} = true`)])
export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  ownerId: text('owner_id').notNull().references(() => user.id),
  revision: integer('revision').default(0).notNull(),
  settings: jsonb('settings').$type<GameSettings>().notNull(),
  matchId: uuid('match_id')
})
export const members = pgTable('members', {
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id),
  roster: jsonb('roster').$type<PlayerIdentity[]>().default([]).notNull(),
  ready: boolean('ready').default(false).notNull()
}, table => [primaryKey({ columns: [table.roomId, table.userId] }), index('members_user_idx').on(table.userId)])
export const matches = pgTable('matches', {
  id: uuid('id').primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  state: jsonb('state').$type<Match>().notNull(),
  controllers: jsonb('controllers').$type<Record<string, string>>().notNull(),
  undo: jsonb('undo').$type<Match[]>().default([]).notNull(),
  summary: jsonb('summary').$type<MatchSummary>(),
  locked: boolean('locked').default(false).notNull()
}, table => [index('matches_room_idx').on(table.roomId)])
export const participants = pgTable('participants', {
  matchId: uuid('match_id').notNull().references(() => matches.id),
  userId: text('user_id').notNull().references(() => user.id),
  active: boolean('active').default(true).notNull()
}, table => [primaryKey({ columns: [table.matchId, table.userId] }), uniqueIndex('one_active_match_per_user').on(table.userId).where(sql`${table.active} = true`)])
export const hiddenHistory = pgTable('hidden_history', {
  matchId: uuid('match_id').notNull().references(() => matches.id),
  userId: text('user_id').notNull().references(() => user.id)
}, table => [primaryKey({ columns: [table.matchId, table.userId] })])
export const actions = pgTable('actions', {
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  userId: text('user_id').notNull().references(() => user.id),
  requestId: uuid('request_id').notNull(),
  input: text('input').notNull(),
  result: jsonb('result').$type<RoomView>().notNull()
}, table => [primaryKey({ columns: [table.roomId, table.userId, table.requestId] })])
