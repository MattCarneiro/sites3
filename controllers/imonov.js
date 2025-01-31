// controllers/imonov.js

const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

/**
 * Extrai as URLs das imagens de sites da Imonov/Si9sistemas,
 * excluindo imagens de seções indesejadas.
 * Primeiro tenta com Cheerio, e se não encontrar imagens, tenta com Puppeteer.
 * @param {string} url - A URL da página a ser processada.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromImonov(url) {
  const images = new Set();

  try {
    console.log(`Imonov/Si9sistemas: Acessando URL: ${url}`);

    // Primeiro, tenta com Cheerio
    const imagesFromCheerio = await getImagesWithCheerio(url);
    if (imagesFromCheerio.length > 0) {
      console.log('Imonov/Si9sistemas: Imagens encontradas com Cheerio:', imagesFromCheerio.length);
      return imagesFromCheerio;
    } else {
      console.log('Imonov/Si9sistemas: Nenhuma imagem encontrada com Cheerio. Tentando com Puppeteer...');
      // Se não encontrou imagens, tenta com Puppeteer
      const imagesFromPuppeteer = await getImagesWithPuppeteer(url);
      return imagesFromPuppeteer;
    }
  } catch (error) {
    console.error(`Imonov/Si9sistemas: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

async function getImagesWithCheerio(url) {
  const images = new Set();

  // Importa o fetchWithExponentialBackoff se necessário
  const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

  try {
    // Faz a requisição via proxy com backoff
    const requestUrl = `https://api-proxy.neuralbase.com.br/fetch?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data);

    // Remover as seções de imóveis relacionados
    $('.div-block-59, .div-block-67, .div-block-50, .div-block-93, .div-block-94, .div-block-127, .div-block-58').remove();

    // Extrair as URLs das imagens
    $('img').each((index, element) => {
      let imgSrc = $(element).attr('src') || $(element).attr('data-src');
      if (imgSrc && imgSrc.includes('si9dados.com.br/si9-fotos/')) {
        // Certificar-se de que a URL é absoluta
        if (!imgSrc.startsWith('http')) {
          const parsedUrl = new URL(url);
          imgSrc = new URL(imgSrc, `${parsedUrl.protocol}//${parsedUrl.host}`).href;
        }
        images.add(imgSrc);
        console.log('Imagem adicionada (Cheerio):', imgSrc);
      }
    });

    return Array.from(images);

  } catch (error) {
    console.error(`Imonov/Si9sistemas (Cheerio): Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

async function getImagesWithPuppeteer(url) {
  const images = new Set();

  try {
    console.log(`Imonov/Si9sistemas: Acessando URL com Puppeteer: ${url}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Definir um viewport e user agent para simular um navegador comum
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/85.0.4183.102 Safari/537.36');

    // Navegar para a URL diretamente
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Adicionar um atraso adicional para garantir que tudo esteja carregado
    await page.waitForTimeout(2000); // Aguarda 2 segundos

    // Remover as seções de imóveis relacionados
    await page.evaluate(() => {
      document.querySelectorAll('.div-block-59, .div-block-67, .div-block-50, .div-block-93, .div-block-94, .div-block-127, .div-block-58')
        .forEach(el => el.remove());
    });

    // Extrai as imagens usando JavaScript no contexto da página
    const extractedImages = await page.evaluate(() => {
      const images = [];
      document.querySelectorAll('img').forEach(img => {
        let imgSrc = img.getAttribute('src') || img.getAttribute('data-src');
        if (imgSrc && imgSrc.includes('si9dados.com.br/si9-fotos/')) {
          images.push(imgSrc);
        }
      });
      return images;
    });

    console.log(`Imonov/Si9sistemas: Imagens extraídas pelo Puppeteer: ${extractedImages.length}`);

    // Extrai o domínio base da URL fornecida
    const parsedUrl = new URL(url);
    const baseDomain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Ajusta as URLs e adiciona ao conjunto de imagens
    for (let imgSrc of extractedImages) {
      if (!imgSrc.startsWith('http')) {
        imgSrc = new URL(imgSrc, baseDomain).href;
      }
      images.add(imgSrc);
      console.log('Imagem adicionada (Puppeteer):', imgSrc);
    }

    await browser.close();

    return Array.from(images);

  } catch (error) {
    console.error(`Imonov/Si9sistemas (Puppeteer): Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromImonov };
