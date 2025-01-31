// controllers/imopro.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai as URLs das imagens de sites Imopro, evitando imagens dentro de seções indesejadas.
 * @param {string} url - A URL da página do imóvel.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromImopro(url) {
  const images = new Set();

  try {
    console.log(`Imopro: Acessando URL: ${url}`);

    // Faz a requisição via proxy com backoff
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data.toString());

    // Remove as seções com o título "Você pode se interessar também"
    $('div.section.property-features').each((i, el) => {
      const h4Text = $(el).find('h4.s-property-title').text().trim();
      if (h4Text.includes('Você pode se interessar também')) {
        $(el).remove();
      }
    });

    // Poderíamos remover outras seções indesejadas aqui, se necessário

    // Extrai o domínio base da URL fornecida
    const parsedUrl = new URL(url);
    const baseDomain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Busca por todas as imagens na página
    $('img').each((_, el) => {
      let imgSrc = $(el).attr('src');
      if (!imgSrc) return;

      // Verifica se a imagem está hospedada no Cloudfront
      if (imgSrc.includes('.cloudfront.net/')) {
        // Converte URLs relativas em absolutas caso necessário
        if (!imgSrc.startsWith('http')) {
          imgSrc = new URL(imgSrc, baseDomain).href;
        }
        images.add(imgSrc);
      }
    });

    const finalImages = Array.from(images);
    console.log(`Imopro: Encontradas ${finalImages.length} imagens.`);
    return finalImages;
  } catch (error) {
    console.error(`Imopro: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromImopro };
