// controllers/sinaionline.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
require('dotenv').config();

/**
 * Extrai as URLs das imagens de sites "Sinaionline":
 * - Filtra imagens que começam com "https://sistemasinaionline.com.br/"
 * - Ignora as que estão dentro de .work-container
 * @param {string} url - A URL do imóvel.
 * @returns {Promise<string[]>} - Array de URLs das imagens.
 */
async function getImageUrlsFromSinaionline(url) {
  console.log(`Sinaionline: Iniciando extração de imagens para: ${url}`);
  const images = [];

  try {
    // Montar a URL com proxy
    const requestUrl = `https://api-proxy.neuralbase.com.br/fetch?url=${encodeURIComponent(url)}`;
    // Faz a requisição com backoff
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data);

    // Remove / ignora imagens dentro de .work-container
    // Uma forma é remover o contêiner para não coletar essas imagens
    $('.work-container').remove();

    // Percorre <img>
    $('img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src.startsWith('http')) {
        // Se for relativo, converte para absoluto
        const parsedBase = new URL(url);
        src = new URL(src, `${parsedBase.protocol}//${parsedBase.host}`).href;
      }

      // Filtra somente se iniciar com "https://sistemasinaionline.com.br/"
      if (!src.startsWith('https://sistemasinaionline.com.br/')) {
        return;
      }

      images.push(src);
      console.log(`Sinaionline: imagem adicionada: ${src}`);
    });

  } catch (error) {
    console.error(`Sinaionline: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }

  // Remove duplicadas
  const unique = [...new Set(images)];
  console.log(`Sinaionline: Total de ${unique.length} imagens encontradas.`);
  return unique;
}

module.exports = { getImageUrlsFromSinaionline };
