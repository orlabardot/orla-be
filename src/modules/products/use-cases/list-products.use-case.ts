import { productsRepository, ListProductsFilters } from '../products.repository'

export async function listProductsUseCase(filters: ListProductsFilters) {
  return productsRepository.list(filters)
}
