// controllers/imovelweb.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai as URLs das imagens do ImovelWeb, ignorando o container .recommended-layout-container
 * e forçando resolução 1200x1200 em qualquer URL que comece com "https://imgbr.imovelwebcdn.com/avisos".
 *
 * @param {string} url - URL da página no ImovelWeb (contendo 'imovelweb.com')
 * @returns {Promise<string[]>} - Array de URLs de imagens em 1200x1200.
 */
async function getImageUrlsFromImovelWeb(url) {
  try {
    console.log(`ImovelWeb: Acessando URL: ${url}`);

    // Requisição via proxy (ou diretamente, dependendo da sua config)
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML
    const $ = cheerio.load(res.data);
    const images = [];

    // 1. Remover (ou ignorar) as imagens que estejam dentro de .recommended-layout-container
    //    para evitar pegar imagens de outros imóveis recomendados
    // ------------------------------------------------------------------
    // OPCIONALMENTE, você pode remover diretamente:
    $('.recommended-layout-container img').remove();

    // 2. Pegar todos os <img> restantes
    $('img').each((index, element) => {
      let imgSrc = $(element).attr('src') || '';

      // Verificar se a imagem começa com "https://imgbr.imovelwebcdn.com/avisos/"
      if (imgSrc.startsWith('https://imgbr.imovelwebcdn.com/avisos/')) {
        // Troca qualquer resolução por "1200x1200"
        // Exemplo: .../360x266/4613000816.jpg -> .../1200x1200/4613000816.jpg
        imgSrc = imgSrc.replace(/\/\d+x\d+\//, '/1200x1200/');

        // Adiciona ao array, se não for vazio
        if (imgSrc) {
          images.push(imgSrc);
        }
      }
    });

    console.log(`ImovelWeb: Encontradas ${images.length} imagens (1200x1200) após remoção do container recomendado.`);
    return images;
  } catch (error) {
    console.error(`ImovelWeb: Erro ao buscar imagens de ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromImovelWeb };
