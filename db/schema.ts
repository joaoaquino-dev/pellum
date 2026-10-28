import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const clinics=sqliteTable('clinics',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(0),updated:text('updated').notNull()});
export const members=sqliteTable('members',{clinic:text('clinic').notNull(),email:text('email').notNull(),role:text('role').notNull()},t=>[primaryKey({columns:[t.clinic,t.email]})]);
export const history=sqliteTable('history',{id:text('id').primaryKey(),clinic:text('clinic').notNull(),actor:text('actor').notNull(),date:text('date').notNull(),action:text('action').notNull(),data:text('data').notNull(),revision:integer('revision').notNull()});
