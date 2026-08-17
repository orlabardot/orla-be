import puppeteer from 'puppeteer'

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  }
  return browserInstance
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // Defesa em profundidade (auditoria de segurança): o template não usa
    // nenhum JS client-side — é só grid estático. Desabilitar JS aqui
    // neutraliza qualquer injeção que escape do escaping do template (ex.:
    // um campo novo adicionado no futuro sem passar por escapeHtml).
    await page.setJavaScriptEnabled(false)
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    })

    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}
