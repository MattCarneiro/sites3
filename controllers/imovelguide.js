const puppeteer = require('puppeteer');

async function getImageUrlsFromImovelGuide(url) {
  const images = [];

  try {
    // 1. Lança o browser em modo headless
    const browser = await puppeteer.launch({
      headless: 'new', // ou true
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 2. Acessa a página, aguardando "networkidle2" (poucas requisições em andamento)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 3. Esperar o seletor principal aparecer (caso a galeria demore um pouco para renderizar)
    try {
      await page.waitForSelector('img[data-js="main-carousel-image"]', { timeout: 5000 });
    } catch (err) {
      console.log('ImovelGuide: Nenhum <img data-js="main-carousel-image"> encontrado no tempo limite.');
      // Se der timeout, você pode continuar, mas possivelmente sem imagens
    }

    // 4. Capturar todos os <img data-js="main-carousel-image">
    const pageImages = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('img[data-js="main-carousel-image"]').forEach((img) => {
        const src = img.getAttribute('src') || '';
        // Verificar se começa com https://imovelguide.com.br/images/
        // (ou https://imovelguide.com.br/images/integration/ se quiser algo mais específico)
        if (src.startsWith('https://imovelguide.com.br/images/')) {
          results.push(src);
        }
      });
      return results;
    });

    console.log(`ImovelGuide: Encontradas ${pageImages.length} imagens com data-js="main-carousel-image".`);

    // 5. (Opcional) Capturar outras meta tags, caso queira:
    // const metaOg = await page.$$eval('meta[property="og:image"]', tags => {
    //   return tags.map(t => t.getAttribute('content') || '')
    //             .filter(src => src.startsWith('https://imovelguide.com.br/images/'));
    // });
    // images.push(...metaOg);

    images.push(...pageImages);

    await browser.close();
  } catch (error) {
    console.error(`ImovelGuide (Puppeteer): Erro ao buscar imagens para ${url}:`, error.message);
  }

  // Remover duplicadas
  const unique = [...new Set(images)];
  console.log(`ImovelGuide: total final de ${unique.length} imagens únicas retornadas.`);
  return unique;
}

module.exports = { getImageUrlsFromImovelGuide };
