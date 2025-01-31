// controllers/universal.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

/**
 * Faz a extração de imagens para sites "Universal Software",
 * usando Puppeteer + Stealth plugin. Filtra apenas URLs que começam
 * com 'https://cdn.imoview.com.br/', e exclui imagens dentro de
 * '#carrossel-imoveis-similares'.
 *
 * @param {string} url - A URL da página de imóvel.
 * @returns {Promise<string[]>} - Lista de URLs de imagens.
 */
async function getImageUrlsFromUniversal(url) {
  console.log(`Universal (Puppeteer): Iniciando extração de imagens para: ${url}`);
  const finalImages = new Set();

  try {
    // 1. Lançar o browser
    const browser = await puppeteer.launch({
      headless: true, // ou 'new', dependendo da versão
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 2. Configurar user agent e viewport
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/85.0.4183.102 Safari/537.36'
    );

    // 3. Acessar a URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 4. Aguardar alguns segundos para garantir que tudo carregou
    await new Promise(resolve => setTimeout(resolve, 3000)); // aguarda 3s

    // 5. Extrair as imagens no contexto do browser
    const extractedImages = await page.evaluate(() => {
      const results = [];

      // Vamos percorrer todas as <img> presentes na página
      document.querySelectorAll('img').forEach((img) => {
        // Verificar se a <img> está dentro de #carrossel-imoveis-similares
        if (img.closest('#carrossel-imoveis-similares')) {
          // Se estiver dentro desse contêiner, ignoramos
          return;
        }
        // Pegar o src (se existir)
        const src = img.getAttribute('src') || '';
        if (src) {
          results.push(src);
        }
      });

      return results;
    });

    console.log(`Universal (Puppeteer): Imagens coletadas (brutas): ${extractedImages.length}`);

    // 6. Normalizar as URLs
    //    - Completar a URL se não começar com http
    //    - Filtrar apenas as que começam com "https://cdn.imoview.com.br/"
    for (let src of extractedImages) {
      // Completar se for relativo
      if (!/^http/i.test(src)) {
        try {
          const parsedBase = new URL(url);
          src = new URL(src, parsedBase).href;
        } catch (err) {
          // Se não conseguiu montar a URL completa, ignora
          continue;
        }
      }

      // Filtrar apenas cdn.imoview.com.br
      if (!src.startsWith('https://cdn.imoview.com.br/')) {
        continue;
      }

      // (Opcional) Remover query string
      try {
        const urlObj = new URL(src);
        urlObj.search = ''; // remove parâmetros ?x=y
        src = urlObj.toString();
      } catch (e) {
        // se der erro no parse, ignora
        continue;
      }

      finalImages.add(src);
    }

    await browser.close();
    console.log(`Universal (Puppeteer): Total final de imagens: ${finalImages.size}`);
  } catch (error) {
    console.error(`Universal (Puppeteer): Erro ao extrair imagens: ${error.message}`);
  }

  // Retorna como array
  return Array.from(finalImages);
}

module.exports = { getImageUrlsFromUniversal };
