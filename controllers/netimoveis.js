// controllers/netimoveis.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai as URLs das imagens do Netimoveis, removendo prefixo "mini_" e 
 * ignorando imagens dentro de <section class="mb-4 related row">.
 *
 * Exemplo de URL mini:
 *   https://fotosimoveis.blob.core.windows.net/fotos-imoveis/3/255/699824/mini_8212f272-f9ef-4128-8176-86f0731df515.jpg
 * Torna-se:
 *   https://fotosimoveis.blob.core.windows.net/fotos-imoveis/3/255/699824/8212f272-f9ef-4128-8176-86f0731df515.jpg
 */
async function getImageUrlsFromNetImoveis(url) {
  try {
    console.log(`NetImoveis: Acessando URL: ${url}`);

    // 1. Faz a requisição via proxy (ou diretamente) com backoff
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // 2. Carrega o HTML com Cheerio
    const $ = cheerio.load(res.data);

    // 3. Remove do DOM as seções de imóveis relacionados
    //    <section class="mb-4 related row">
    $('section.mb-4.related.row').remove();

    // 4. Extrair as imagens que começam com https://fotosimoveis.blob.core.windows.net/fotos-imoveis
    //    e remover o prefixo "mini_"
    const images = new Set();
    $('img, source').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('srcset') || '';
      if (src.startsWith('https://fotosimoveis.blob.core.windows.net/fotos-imoveis')) {
        // Remove o "mini_" se existir
        // Exemplo: /mini_8212f272-... => /8212f272-...
        src = src.replace('mini_', '');
        images.add(src);
      }
    });

    const finalImages = Array.from(images);
    console.log(`NetImoveis: Encontradas ${finalImages.length} imagens (removendo prefixo "mini_").`);
    return finalImages;
  } catch (error) {
    console.error(`NetImoveis: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromNetImoveis };
