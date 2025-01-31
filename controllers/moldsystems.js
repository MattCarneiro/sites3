// controllers/moldsystems.js

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
require('dotenv').config();

// URL do proxy, se estiver usando
const PROXY_URL = process.env.PROXY_URL || 'https://api-proxy.neuralbase.com.br/fetch';

// Função auxiliar para aguardar X ms
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Verifica se um elemento está dentro de .MuiContainer-root.MuiContainer-maxWidthLg
function isWithinExcludedContainer(element, $) {
  if ($(element).closest('.MuiContainer-root.MuiContainer-maxWidthLg').length > 0) {
    return true;
  }
  return false;
}

/**
 * Ponto de entrada para Mold Systems:
 * 1) Tenta Puppeteer
 * 2) Se não encontrar nada, fallback com Cheerio
 */
async function getImageUrlsFromMoldSystems(url) {
  console.log(`Mold Systems (Puppeteer + fallback): Iniciando extração para: ${url}`);

  const images = [];

  // 1. Tentar Puppeteer
  try {
    const puppeteerImgs = await getImagesWithPuppeteer(url);
    images.push(...puppeteerImgs);
  } catch (e) {
    console.error(`Mold Systems Puppeteer: Erro: ${e.message}`);
  }

  // 2. Fallback se não achou nada
  if (images.length === 0) {
    console.log('Mold Systems: Tentando fallback com Cheerio...');
    const fallbackImgs = await getImagesFallbackCheerio(url);
    images.push(...fallbackImgs);
  }

  // Remove duplicadas
  const unique = [...new Set(images)];
  console.log(`Mold Systems: Total final de ${unique.length} imagens encontradas.`);
  return unique;
}

/**
 * Captura as imagens usando Puppeteer.
 * Use "sleep(3000)" no lugar de "page.waitFor(...)"
 */
async function getImagesWithPuppeteer(url) {
  const images = [];
  console.log(`Mold Systems Puppeteer: Acessando ${url}...`);

  const browser = await puppeteer.launch({
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // 1. Navega até a página
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // 2. (Opcional) Se precisar clicar num botão "Ver mais fotos", faça aqui:
  /*
  try {
    await page.waitForSelector('.botao-ver-mais-fotos', { timeout: 5000 });
    await page.click('.botao-ver-mais-fotos');
    console.log('Clique em "Ver mais fotos" executado.');
    await sleep(3000);
  } catch (err) {
    console.log('Nenhum botão "Ver mais fotos" encontrado. Prosseguindo...');
  }
  */

  // 3. Aguarda 3 segundos para dar tempo de renderizar JS:
  await sleep(3000);

  // 4. Captura <img src=...>
  const pageImages = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      // Filtramos apenas s3.amazonaws.com
      if (src.startsWith('https://s3.amazonaws.com/')) {
        // Devolve "src" + a info necessária
        results.push({ src });
      }
    });
    return results;
  });

  if (pageImages.length === 0) {
    console.log('Mold Systems Puppeteer: 0 imagens encontradas (via DOM).');
    await browser.close();
    return [];
  }

  // 5. Precisamos filtrar as dentro de .MuiContainer-root
  //    => obtemos HTML da página e analisamos via Cheerio
  const fullHtml = await page.content();
  await browser.close();

  return filterOutMuiContainer(pageImages, fullHtml);
}

/**
 * Dado um array de { src } + HTML, remove as que estiverem dentro de .MuiContainer-root.MuiContainer-maxWidthLg
 */
function filterOutMuiContainer(pageImages, fullHtml) {
  const $ = cheerio.load(fullHtml);
  const validUrls = [];

  pageImages.forEach(({ src }) => {
    const matchingElements = $(`img[src="${src}"]`);
    if (matchingElements.length === 0) {
      // não achou no HTML estático => deve ter sido dinâmico => aceita
      validUrls.push(src);
      return;
    }

    let isExcluded = false;
    matchingElements.each((i, el) => {
      if ($(el).closest('.MuiContainer-root.MuiContainer-maxWidthLg').length > 0) {
        isExcluded = true;
      }
    });
    if (!isExcluded) {
      validUrls.push(src);
    }
  });

  return validUrls;
}

/**
 * Fallback: Cheerio + fetchWithExponentialBackoff
 */
async function getImagesFallbackCheerio(url) {
  const images = [];
  try {
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });
    const $ = cheerio.load(res.data);

    $('img').each((_, el) => {
      let src = $(el).attr('src') || '';
      if (!src.startsWith('http')) {
        src = new URL(src, url).href;
      }
      if (!src.startsWith('https://s3.amazonaws.com/')) return;

      if ($(el).closest('.MuiContainer-root.MuiContainer-maxWidthLg').length > 0) return;

      images.push(src);
    });
    console.log(`Mold Systems fallback: Encontradas ${images.length} imagens via Cheerio.`);
  } catch (err) {
    console.error(`Mold Systems fallback: Erro ao usar Cheerio: ${err.message}`);
  }
  return images;
}

module.exports = {
  getImageUrlsFromMoldSystems,
};
