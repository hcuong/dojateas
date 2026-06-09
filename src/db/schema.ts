import { pgTable, uuid, text, date, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const batches = pgTable('batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id),
  harvestDate: date('harvest_date').notNull(),
  productionDate: date('production_date').notNull(),
  expiryDate: date('expiry_date').notNull(),
  quantity: integer('quantity').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const batchDetails = pgTable('batch_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  key: text('key').notNull(),
  value: text('value').notNull(),
  mediaUrl: text('media_url'),
})

export const productsRelations = relations(products, ({ many }) => ({
  batches: many(batches),
}))

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  details: many(batchDetails),
}))

export const batchDetailsRelations = relations(batchDetails, ({ one }) => ({
  batch: one(batches, {
    fields: [batchDetails.batchId],
    references: [batches.id],
  }),
}))
