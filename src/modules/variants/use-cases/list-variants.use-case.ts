import { variantsRepository } from '../variants.repository'
import { productsRepository } from '../../products/products.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  productId: string
}

export async function listVariantsUseCase(input: Input) {
  // Achado em auditoria de segurança (IDOR): sem essa checagem, qualquer
  // usuário autenticado de QUALQUER tenant conseguia listar as variantes de
  // um produto de outro tenant só adivinhando/enumerando o UUID do produto —
  // a rota nunca confirmava que o produto pertencia ao tenant do request.
  const product = await productsRepository.findById(input.tenantId, input.productId)
  if (!product) {
    throw new ResourceNotFoundError('Product', input.productId)
  }

  return variantsRepository.findAllByProduct(input.productId)
}
