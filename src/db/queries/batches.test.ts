import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '#/db'
import { products, batches, batchDetails } from '#/db/schema'
import { createBatch, getBatchWithDetails, getAllBatches, addBatchDetail, updateBatchStatus } from './batches'
import { createProduct } from './products'

let productId: string

beforeAll(async () => {
  await db.delete(batchDetails)
  await db.delete(batches)
  await db.delete(products)
  const product = await createProduct({ name: 'Test Trà', description: null, imageUrl: null })
  productId = product.id
})

afterAll(async () => {
  await db.delete(batchDetails)
  await db.delete(batches)
  await db.delete(products)
})

describe('batch queries', () => {
  it('createBatch inserts a new batch with status active', async () => {
    const batch = await createBatch({
      productId,
      harvestDate: '2026-04-01',
      productionDate: '2026-04-05',
      expiryDate: '2027-04-05',
      quantity: 100,
    })
    expect(batch.id).toBeDefined()
    expect(batch.status).toBe('active')
  })

  it('getAllBatches returns rows with productName joined', async () => {
    const rows = await getAllBatches()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].productName).toBe('Test Trà')
  })

  it('addBatchDetail inserts a detail row', async () => {
    const [batch] = await getAllBatches()
    const detail = await addBatchDetail({
      batchId: batch.id,
      key: 'origin_region',
      value: 'Bảo Lộc, Lâm Đồng',
      mediaUrl: null,
    })
    expect(detail.key).toBe('origin_region')
  })

  it('getBatchWithDetails returns batch with product and details', async () => {
    const [batch] = await getAllBatches()
    const result = await getBatchWithDetails(batch.id)
    expect(result).not.toBeNull()
    expect(result!.product.name).toBe('Test Trà')
    expect(result!.details.length).toBeGreaterThan(0)
  })

  it('updateBatchStatus changes status to recalled', async () => {
    const [batch] = await getAllBatches()
    const updated = await updateBatchStatus(batch.id, 'recalled')
    expect(updated.status).toBe('recalled')
  })
})
