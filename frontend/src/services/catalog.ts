import { allPages, http } from './http'
export interface CategoryDTO { id: number; name: string; is_perishable: boolean }
export interface ProductDTO { id: number; category_id: number; name: string; unit: string; is_active: boolean }
export interface WarehouseDTO { id: number; name: string; is_cold_storage: boolean; is_active: boolean }
export async function getCatalog() {
  const [categories, products, warehouses] = await Promise.all([
    allPages<CategoryDTO>('/categories'), allPages<ProductDTO>('/products'), allPages<WarehouseDTO>('/warehouses'),
  ])
  return { categories, products, warehouses }
}
export const createCategory = (input: { name: string; is_perishable: boolean }) => http.post<CategoryDTO>('/categories', input)
export const createProduct = (input: { name: string; category_id: number; unit: string }) => http.post<ProductDTO>('/products', input)
export const createWarehouse = (input: { name: string; is_cold_storage: boolean }) => http.post<WarehouseDTO>('/warehouses', input)
