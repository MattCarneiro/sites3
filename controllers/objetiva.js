// controllers/objetiva.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

/**
 * Extrai as URLs das imagens de sites da Objetiva,
 * ajustando as URLs para versões em alta definição quando necessário.
 * @param {string} url - A URL da página do imóvel.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromObjetiva(url) {
  const images = new Set();

  try {
    console.log(`Objetiva: Acessando URL: ${url}`);

    // Faz a requisição via proxy com backoff
    const requestUrl = `https://api-proxy.neuralbase.com.br/fetch?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data);

    // Extrair as URLs das imagens
    $('img').each((index, element) => {
      let imgSrc = $(element).attr('src');
      if (imgSrc && imgSrc.includes('img.sis.gestorimob.com.br')) {
        // Remover '/thumb/' da URL para obter a imagem em HD
        if (imgSrc.includes('/thumb/')) {
          imgSrc = imgSrc.replace('/thumb/', '/');
        }
        // Certificar-se de que a URL é absoluta
        if (!imgSrc.startsWith('http')) {
          const parsedUrl = new URL(url);
          imgSrc = new URL(imgSrc, `${parsedUrl.protocol}//${parsedUrl.host}`).href;
        }
        images.add(imgSrc);
        console.log('Imagem adicionada:', imgSrc);
      }
    });

    const finalImages = Array.from(images);
    console.log(`Objetiva: Total de ${finalImages.length} imagens após processamento.`);
    return finalImages;

  } catch (error) {
    console.error(`Objetiva: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromObjetiva };
