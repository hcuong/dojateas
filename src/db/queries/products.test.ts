import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '#/db'
import { products, batches, batchDetails } from '#/db/schema'
import { getAllProducts, createProduct, getProductById } from './products'

beforeAll(async () => {
  await db.delete(batchDetails)
  await db.delete(batches)
  await db.delete(products)
})

afterAll(async () => {
  await db.delete(batchDetails)
  await db.delete(batches)
  await db.delete(products)
})

describe('product queries', () => {
  it('getAllProducts returns empty array initially', async () => {
    const result = await getAllProducts()
    expect(result).toEqual([])
  })

  it('createProduct inserts and returns the new product', async () => {
    const product = await createProduct({
      name: 'Trà Oolong Alishan',
      description: 'Trà từ núi Alishan',
      imageUrl: null,
    })
    expect(product.id).toBeDefined()
    expect(product.name).toBe('Trà Oolong Alishan')
  })

  it('getProductById returns correct product', async () => {
    const created = await createProduct({ name: 'Test', description: null, imageUrl: null })
    const found = await getProductById(created.id)
    expect(found?.id).toBe(created.id)
  })

  it('getProductById returns null for unknown id', async () => {
    const found = await getProductById('00000000-0000-0000-0000-000000000000')
    expect(found).toBeNull()
  })
})
