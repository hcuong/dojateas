import { db } from '#/db'
import { products } from '#/db/schema'
import { eq } from 'drizzle-orm'

export type NewProduct = {
  name: string
  description: string | null
  imageUrl: string | null
}

export async function getAllProducts() {
  return db.select().from(products).orderBy(products.createdAt)
}

export async function getProductById(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id))
  return product ?? null
}

export async function createProduct(data: NewProduct) {
  const [product] = await db.insert(products).values(data).returning()
  return product
}

export async function updateProduct(id: string, data: Partial<NewProduct>) {
  const [product] = await db.update(products).set(data).where(eq(products.id, id)).returning()
  return product
}
