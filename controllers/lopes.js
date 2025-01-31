// controllers/lopes.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai todas as URLs das imagens da Lopes que comecem com:
 *    https://betaimages.lopes.com.br/realestate/med/
 * @param {string} url - A URL da página a ser processada.
 * @returns {Promise<string[]>} - Um array de URLs das imagens encontradas.
 */
async function getImageUrlsFromLopes(url) {
  try {
    console.log(`Lopes: Acessando URL: ${url}`);

    // Faz a requisição via proxy (ou diretamente, dependendo do seu fluxo)
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data);
    const images = new Set(); // Set para evitar duplicadas

    // Regex para capturar URLs iniciando com https://betaimages.lopes.com.br/realestate/med/
    const extractUrlsFromText = (text) => {
      const regex = /https:\/\/betaimages\.lopes\.com\.br\/realestate\/med\/[^\s"']+/g;
      const matches = text.match(regex);
      if (matches) {
        matches.forEach((match) => images.add(match));
      }
    };

    // Extrair URLs dos atributos `src` e `srcset`
    $('img, source').each((_, element) => {
      const srcAttr = $(element).attr('src') || $(element).attr('srcset');
      if (srcAttr) {
        extractUrlsFromText(srcAttr);
      }
    });

    // Analisar todo o HTML como texto para capturar possíveis URLs embaralhadas
    extractUrlsFromText(res.data);

    // Converte o Set em array
    const imageArray = Array.from(images);
    console.log(`Lopes: Total de ${imageArray.length} imagens encontradas com o padrão "betaimages.lopes.com.br".`);

    return imageArray;
  } catch (error) {
    console.error(`Erro ao buscar imagens da Lopes: ${error.message}`);
    throw error;
  }
}

module.exports = { getImageUrlsFromLopes };
