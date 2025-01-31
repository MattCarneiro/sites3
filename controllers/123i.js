// controllers/123i.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai URLs de imagens do 123i, forçando a resolução 1024/1024.
 * @param {string} url - A URL da página (contendo "123i.com").
 * @returns {Promise<string[]>}
 */
async function getImageUrlsFrom123i(url) {
  try {
    console.log(`123i: Acessando URL: ${url}`);

    // Requisição via proxy + backoff
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega HTML via Cheerio
    const $ = cheerio.load(res.data);
    const images = new Set();

    // Função para capturar e corrigir a resolução
    const extractUrlsFromText = (text) => {
      // Regex que localiza URLs iniciando com 'https://media.123i.com.br/rest/image/outer/'
      // e qualquer subpasta que contenha /<num>/<num>/
      const regex = /https:\/\/media\.123i\.com\.br\/rest\/image\/outer\/\d+\/\d+\/[^\s"']+/g;
      const matches = text.match(regex);
      if (matches) {
        matches.forEach((match) => {
          // Substituir /<num>/<num>/ por /1024/1024/
          const highRes = match.replace(/\/\d+\/\d+\//, '/1024/1024/');
          images.add(highRes);
        });
      }
    };

    // Extrair de <img>, <source> etc.
    $('img, source').each((_, element) => {
      const srcAttr = $(element).attr('src') || $(element).attr('srcset');
      if (srcAttr) {
        extractUrlsFromText(srcAttr);
      }
    });

    // Analisar todo o HTML como texto (por segurança, se houver URLs embutidas)
    extractUrlsFromText(res.data);

    // Converte Set em Array
    const finalImages = Array.from(images);
    console.log(`123i: Encontradas ${finalImages.length} imagens (forçando 1024x1024).`);
    return finalImages;
  } catch (error) {
    console.error(`123i: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFrom123i };
