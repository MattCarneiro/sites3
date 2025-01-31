// controllers/supremo.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
require('dotenv').config();

const PROXY_URL = process.env.PROXY_URL || 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Obtém as imagens do site Supremo.
 * @param {string} url - A URL do site.
 * @returns {Promise<string[]>} - Um array com as URLs das imagens.
 */
async function getImagesFromSupremo(url) {
  const images = [];

  try {
    // Requisição via proxy com backoff
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data.toString());

    $('img').each((index, element) => {
      let imgSrc = $(element).attr('src');
      if (imgSrc && !imgSrc.startsWith('http')) {
        imgSrc = new URL(imgSrc, url).href;
      }
      // Se for “/p_”, troca por “/g_” para HD
      if (imgSrc && imgSrc.includes('/p_')) {
        imgSrc = imgSrc.replace('/p_', '/g_');
      }
      if (imgSrc) {
        images.push(imgSrc);
      }
    });
  } catch (error) {
    console.error(`Erro ao processar o site Supremo: ${error.message}`);
  }

  return images;
}

module.exports = {
  getImagesFromSupremo,
};
