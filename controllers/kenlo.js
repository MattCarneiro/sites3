// controllers/kenlo.js
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
require('dotenv').config();

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Obtém as imagens do site usando Puppeteer, com foco em encontrar e clicar no botão "Ver mais fotos".
 * @param {string} url - A URL do site.
 * @returns {Promise<string[]>} - Um array com as URLs das imagens.
 */
async function getImagesFromKenlo(url) {
  const images = [];

  try {
    // 1. Lança o browser e acessa a página
    const browser = await puppeteer.launch({
      headless: 'new', // ou true
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // 2. Acessa a URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 3. Tentar clicar no botão "Ver mais fotos" (class "digital-thumbnails-seemore")
    //    pois muitas vezes as imagens HD só aparecem após esse clique.
    try {
      await page.waitForSelector('.digital-thumbnails-seemore', { timeout: 5000 });
      await page.click('.digital-thumbnails-seemore');
      console.log('Kenlo: Botão "Ver mais fotos" encontrado e clicado.');
      // Aguarda algum tempo para as imagens carregarem
      await page.waitForTimeout(3000);
    } catch (err) {
      console.log('Kenlo: Não foi possível clicar no botão "Ver mais fotos". Prosseguindo sem clique.');
    }

    // 4. Extrair todas as imagens do DOM
    const pageImages = await page.evaluate(() => {
      const imgElements = document.querySelectorAll('img');
      const imgUrls = [];

      imgElements.forEach((img) => {
        let src = img.getAttribute('src') || '';
        // Aqui, as imagens típicas começam com "https://imgs.kenlo.io"
        // mas podemos filtrar ou capturar tudo que for válido
        if (src.startsWith('https://imgs.kenlo.io')) {
          imgUrls.push(src);
        }
      });

      return imgUrls;
    });

    console.log(`Kenlo: Foram encontradas ${pageImages.length} imagens.`);
    images.push(...pageImages);

    await browser.close();
  } catch (error) {
    console.error(`Kenlo: Erro ao processar o site com Puppeteer: ${error.message}`);
    // Se quiser, pode implementar um fallback com Cheerio aqui também
    // getImagesFromKenloFallback(url) ou algo do tipo
  }

  // 5. Caso Puppeteer tenha falhado ou não encontrado nada, podemos usar um fallback com Cheerio
  if (images.length === 0) {
    console.log('Kenlo: Tentando fallback com Cheerio...');
    const fallbackImages = await extractImagesFromURL(url);
    images.push(...fallbackImages);
  }

  return images;
}

/**
 * Fallback simples que faz um GET via proxy e usa Cheerio para buscar possíveis URLs de imagens.
 * @param {string} url - A URL do site.
 * @returns {Promise<string[]>} - Um array com as URLs das imagens.
 */
async function extractImagesFromURL(url) {
  const images = [];
  try {
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });
    const $ = cheerio.load(res.data);

    $('img').each((index, element) => {
      let src = $(element).attr('src');
      if (src && src.startsWith('https://imgs.kenlo.io')) {
        images.push(src);
      }
    });
    console.log(`Kenlo (fallback): Encontradas ${images.length} imagens via Cheerio.`);
  } catch (err) {
    console.error(`Kenlo (fallback): Erro ao usar Cheerio: ${err.message}`);
  }
  return images;
}

module.exports = {
  getImagesFromKenlo,
};
