// controllers/midas.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai as URLs das imagens de sites Midas, evitando imagens indesejadas.
 * @param {string} url - A URL da página do imóvel.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromMidas(url) {
  const images = new Set();

  try {
    console.log(`Midas: Acessando URL: ${url}`);

    // Faz a requisição via proxy com backoff
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data.toString());

    // Remove elementos que não queremos processar
    $('#imoveis-semelhantes').remove();

    // Extrai o domínio base da URL fornecida (pode ser útil para URLs relativas)
    const parsedUrl = new URL(url);
    const baseDomain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Busca por todas as imagens na página
    $('img').each((_, el) => {
      let imgSrc = $(el).attr('src');
      if (!imgSrc) return;

      // Verifica se a imagem está no domínio das fotos Midas
      if (imgSrc.startsWith('https://fotosmd.infoideiashost.com.br/midasweb/arquivos/')) {
        // Converte URLs relativas em absolutas caso necessário
        if (!imgSrc.startsWith('http')) {
          imgSrc = new URL(imgSrc, baseDomain).href;
        }

        images.add(imgSrc);
      }
    });

    const finalImages = Array.from(images);
    console.log(`Midas: Encontradas ${finalImages.length} imagens.`);
    return finalImages;
  } catch (error) {
    console.error(`Midas: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromMidas };
