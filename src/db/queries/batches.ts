import { db } from '#/db'
import { batches, batchDetails, products } from '#/db/schema'
import { eq } from 'drizzle-orm'

export type NewBatch = {
  productId: string
  harvestDate: string
  productionDate: string
  expiryDate: string
  quantity: number
}

export type NewBatchDetail = {
  batchId: string
  key: string
  value: string
  mediaUrl: string | null
}

export async function getAllBatches() {
  return db
    .select({
      id: batches.id,
      productName: products.name,
      productId: batches.productId,
      harvestDate: batches.harvestDate,
      productionDate: batches.productionDate,
      expiryDate: batches.expiryDate,
      quantity: batches.quantity,
      status: batches.status,
      createdAt: batches.createdAt,
    })
    .from(batches)
    .innerJoin(products, eq(batches.productId, products.id))
    .orderBy(batches.createdAt)
}

export async function getBatchWithDetails(id: string) {
  const result = await db.query.batches.findFirst({
    where: eq(batches.id, id),
    with: { product: true, details: true },
  })
  return result ?? null
}

export async function createBatch(data: NewBatch) {
  const [batch] = await db.insert(batches).values(data).returning()
  return batch
}

export async function updateBatchStatus(id: string, status: 'active' | 'recalled') {
  const [batch] = await db.update(batches).set({ status }).where(eq(batches.id, id)).returning()
  return batch
}

export async function addBatchDetail(data: NewBatchDetail) {
  const [detail] = await db.insert(batchDetails).values(data).returning()
  return detail
}

export async function removeBatchDetail(id: string) {
  await db.delete(batchDetails).where(eq(batchDetails.id, id))
}
