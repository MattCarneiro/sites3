// controllers/vivareal.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai as URLs das imagens do VivaReal com a maior resolução possível.
 * @param {string} url - A URL da página a ser processada.
 * @returns {Promise<string[]>} - Um array de URLs das imagens com a maior resolução.
 */
async function getImageUrlsFromVivaReal(url) {
    try {
        console.log(`Acessando URL: ${url}`);

        // Requisição à URL via proxy
        const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
        const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

        // Carrega o HTML retornado pelo proxy
        const $ = cheerio.load(res.data);
        const images = new Map(); // Usar Map para armazenar a maior resolução de cada imagem

        // Função para extrair URLs e resoluções
        const extractUrlsFromText = (text) => {
            const regex = /https:\/\/resizedimgs\.vivareal\.com\/fit-in\/(\d+)x(\d+)\/[^\s"]+/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const url = match[0];
                const resolution = parseInt(match[1]) * parseInt(match[2]); // Multiplica largura x altura para comparar resolução

                const key = url.replace(/fit-in\/\d+x\d+\//, ''); // Chave única para cada imagem
                if (!images.has(key) || images.get(key).resolution < resolution) {
                    images.set(key, { url, resolution }); // Armazena apenas a maior resolução
                }
            }
        };

        // Extrair URLs diretamente dos atributos de imagem e source
        $('img, source').each((_, element) => {
            const src = $(element).attr('src') || $(element).attr('srcset');
            if (src) {
                extractUrlsFromText(src);
            }
        });

        // Analisar todo o HTML como texto para capturar URLs embaralhadas
        extractUrlsFromText(res.data);

        // Extrair apenas as URLs com maior resolução
        const imageArray = Array.from(images.values()).map(item => item.url);
        console.log(`Total de ${imageArray.length} imagens com a maior resolução encontradas.`);

        return imageArray;
    } catch (error) {
        console.error(`Erro ao buscar imagens do VivaReal: ${error.message}`);
        throw error;
    }
}

module.exports = { getImageUrlsFromVivaReal };
