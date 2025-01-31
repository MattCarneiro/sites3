// controllers/imobibrasil.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Captura as imagens de Imobibrasil removendo os "thumb" e ignorando
 * a seção #id_outrosimoveis (outros imóveis).
 * @param {string} url - A URL da página.
 * @returns {Promise<string[]>} - Lista de URLs de imagens.
 */
async function getImagesFromImobiBrasil(url) {
  const images = new Set();

  try {
    console.log(`Imobibrasil: Acessando URL: ${url}`);
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega HTML com Cheerio
    const $ = cheerio.load(res.data.toString());

    // Remove a sessão de "outros imóveis"
    $('#id_outrosimoveis.descricao.outrosimoveis').remove();

    // Captura quaisquer <img> ou <source> começando com:
    //  "https://imgs1.cdn-imobibrasil.com.br/imagens/imoveis/"
    $('img, source').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('srcset') || '';
      if (src.startsWith('https://imgs1.cdn-imobibrasil.com.br/imagens/imoveis/')) {
        // Remover o prefixo "thumbXX-" se existir
        // Regex que pega "thumb" + 1 ou mais dígitos + "-"
        // ex.: "thumb15-" ou "thumb250-"
        src = src.replace(/thumb\d+-/, '');
        images.add(src);
      }
    });

  } catch (error) {
    console.error(`Imobibrasil: Erro ao buscar imagens para ${url}: ${error.message}`);
  }

  const finalImages = Array.from(images);
  console.log(`Imobibrasil: Encontradas ${finalImages.length} imagens (removendo thumb).`);
  return finalImages;
}

module.exports = {
  getImagesFromImobiBrasil
};
