// controllers/arboimoveis.js

const puppeteer = require('puppeteer');

/**
 * Função de sleep manual (em ms), pois versões antigas do Puppeteer não têm page.waitForTimeout().
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extrai as URLs das imagens do ArboImoveis sem depender de seletor específico.
 * Baixa todas as imagens que comecem com "https://static.arboimoveis.com.br/".
 * @param {string} url - A URL da página do imóvel no ArboImoveis.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromArboImoveis(url) {
  const images = new Set(); // Para evitar duplicadas

  try {
    console.log(`ArboImoveis (Puppeteer): Acessando URL: ${url}`);

    // 1) Lança o browser Puppeteer
    const browser = await puppeteer.launch({
      headless: true, // ou 'new', dependendo da versão
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 2) Acessa a URL, esperando até 'networkidle2'
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 3) (Opcional) Remove a seção de imóveis relacionados
    //    (caso exista) para não capturar imagens de anúncios relacionados.
    await page.evaluate(() => {
      const related = document.querySelector('section#relacionados-imoveis');
      if (related) related.remove();
    });

    // 4) Dá um tempinho (2s) para o JS terminar de renderizar
    await sleep(2000);

    // 5) Extrair TODAS as imagens que começam com "https://static.arboimoveis.com.br/"
    const extractedImages = await page.evaluate(() => {
      const result = [];
      const allImgs = document.querySelectorAll('img');
      allImgs.forEach(img => {
        let src = img.getAttribute('src') || '';
        // Se começa com "https://static.arboimoveis.com.br/"
        if (src.startsWith('https://static.arboimoveis.com.br/')) {
          // (Opcional) Ajustar a resolução
          src = src.replace(/\/\d+x\d+\//, '/1280x1280/');
          result.push(src);
        }
      });
      return result;
    });

    console.log(`ArboImoveis: Extraídas ${extractedImages.length} imagens pelo Puppeteer.`);

    // 6) Adiciona as URLs ao Set
    for (const src of extractedImages) {
      images.add(src);
    }

    // 7) Fecha o navegador
    await browser.close();

  } catch (error) {
    console.error(`ArboImoveis: Erro ao buscar imagens em ${url}: ${error.message}`);
  }

  // 8) Retorna em formato array
  const finalImages = Array.from(images);
  console.log(`ArboImoveis: Total final de ${finalImages.length} imagens encontradas.`);
  return finalImages;
}

module.exports = { getImageUrlsFromArboImoveis };
