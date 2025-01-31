// controllers/migmidia.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai as URLs das imagens de sites Migmidia, ajustando para a resolução máxima 'big'.
 * @param {string} url - A URL da página do imóvel.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromMigmidia(url) {
  const images = new Set();

  try {
    console.log(`Migmidia: Acessando URL: ${url}`);

    // Faz a requisição via proxy com backoff
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data.toString());

    // Extrai o domínio base da URL fornecida
    const parsedUrl = new URL(url);
    const baseDomain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Remove elementos que não queremos processar
    $('ul.lista-imoveis').remove();
    $('div.box-imoveis-relacionados').remove();

    // Busca por todas as imagens na página
    $('img').each((_, el) => {
      let imgSrc = $(el).attr('src');
      if (!imgSrc) return;

      // Verifica se a imagem está na pasta '/uploads/imovel/galeria/'
      if (imgSrc.includes('/uploads/imovel/galeria/')) {
        // Converte URLs relativas em absolutas
        if (!imgSrc.startsWith('http')) {
          imgSrc = new URL(imgSrc, baseDomain).href;
        }

        // Substitui 'thumb-' por 'big-' para obter a imagem em alta resolução
        imgSrc = imgSrc.replace('thumb-', 'big-');

        // Garante que o nome do arquivo comece com 'big-'
        if (!imgSrc.includes('/big-')) {
          imgSrc = imgSrc.replace('/uploads/imovel/galeria/', '/uploads/imovel/galeria/big-');
        }

        images.add(imgSrc);
      }
    });

    const finalImages = Array.from(images);
    console.log(`Migmidia: Encontradas ${finalImages.length} imagens (ajustadas para alta resolução).`);
    return finalImages;
  } catch (error) {
    console.error(`Migmidia: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromMigmidia };
