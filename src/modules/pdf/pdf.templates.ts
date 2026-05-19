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

export function buildCatalogHtml(input: PdfTemplateInput): string {
  const date = new Date().toLocaleDateString('pt-BR')

  const cards = input.variants
    .map(
      (v) => `
      <div class="card">
        <div class="card-img">
          ${
            v.imageUrl
              ? `<img src="${v.imageUrl}" alt="${v.skuVariant}" />`
              : `<div class="no-img">Sem imagem</div>`
          }
        </div>
        <div class="card-info">
          <p class="sku">${v.skuVariant}</p>
          ${v.colorLabel ? `<p class="color">${v.colorLabel}</p>` : ''}
          <p class="name">${v.productName}</p>
        </div>
      </div>
    `,
    )
    .join('')

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
    <h1>${input.tenantName}</h1>
    <p>Catálogo personalizado${input.clientName ? ` — ${input.clientName}` : ''} | ${date}</p>
  </div>
  <div class="grid">
    ${cards}
  </div>
  <div class="footer">
    Gerado em ${date} | ${input.tenantName}
  </div>
</body>
</html>`
}
