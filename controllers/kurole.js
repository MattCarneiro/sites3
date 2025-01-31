// controllers/kurole.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
require('dotenv').config();

/**
 * Extrai as URLs das imagens de sites "Kurole":
 * - Detectamos a string "kurole" no HTML (via generic.js).
 * - Filtra imagens que começam com "meudominio.com/foto_" ou "meudominio.com/foto_edificio_".
 * - Exclui se tiver "/foto_thumb" no caminho.
 * - Remove <section id="related"> para não pegar imóveis relacionados.
 *
 * @param {string} url - A URL do imóvel.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromKurole(url) {
  console.log(`Kurole: Iniciando extração de imagens para a URL: ${url}`);
  const images = new Set();

  try {
    // Montar a URL para proxy
    const requestUrl = `https://api-proxy.neuralbase.com.br/fetch?url=${encodeURIComponent(url)}`;
    // Fazer a requisição com backoff
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data);

    // Remove a seção de imóveis relacionados (caso exista)
    $('section#related').remove();

    // Percorre <img> (ou data-src) para imagens
    $('img').each((_, element) => {
      let imgSrc = $(element).attr('src') || $(element).attr('data-src') || '';
      // Se for relativo, converte para absoluto
      if (imgSrc && !imgSrc.startsWith('http')) {
        const parsedBase = new URL(url);
        imgSrc = new URL(imgSrc, `${parsedBase.protocol}//${parsedBase.host}`).href;
      }

      // 1) Deve conter "/foto_" ou "/foto_edificio_"
      //    (você pode adaptar se quiser permitir outras variações)
      // 2) Não pode ter "/foto_thumb"
      if (
        imgSrc.includes('/foto_') && // ex: /foto_ ou /foto_edificio_
        !imgSrc.includes('/foto_thumb')
      ) {
        // Exemplo: "https://www.teixeiradecarvalho.com.br/foto_/2024/..."
        // ou "https://www.lagoimobiliaria.com.br/foto_edificio_/2023/..."
        // Precisamos verificar se bate com "meudominio.com/foto_"
        // ou "meudominio.com/foto_edificio_".
        // Geralmente, basta checar se tem "/foto_" e não "/foto_thumb".
        images.add(imgSrc);
        console.log(`Kurole: Imagem adicionada: ${imgSrc}`);
      }
    });

    const finalImages = Array.from(images);
    console.log(`Kurole: Total de ${finalImages.length} imagens após processamento.`);
    return finalImages;

  } catch (error) {
    console.error(`Kurole: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromKurole };
