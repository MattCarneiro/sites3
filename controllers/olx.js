// controllers/olx.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai todas as URLs das imagens do OLX que começam com "https://img.olx.com.br/images/<número>/".
 * @param {string} url - A URL da página a ser processada.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromOlx(url) {
    try {
        console.log(`Acessando URL: ${url}`);

        // Requisição via proxy para evitar bloqueios
        const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
        const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

        // Carrega o HTML com Cheerio
        const $ = cheerio.load(res.data);
        const images = new Set(); // Usar Set para evitar URLs duplicadas

        // Função para extrair URLs com o padrão correto
        const extractUrlsFromText = (text) => {
            const regex = /https:\/\/img\.olx\.com\.br\/images\/\d+\/[^\s"]+/g;
            const matches = text.match(regex);
            if (matches) {
                matches.forEach(match => images.add(match)); // Armazena URLs únicas
            }
        };

        // Extrair URLs dos atributos `src` e `srcset`
        $('img, source').each((_, element) => {
            const src = $(element).attr('src') || $(element).attr('srcset');
            if (src) {
                extractUrlsFromText(src);
            }
        });

        // Analisar todo o HTML como texto para capturar URLs embaralhadas
        extractUrlsFromText(res.data);

        // Converter o Set para Array e exibir as URLs encontradas
        const imageArray = Array.from(images);
        console.log(`Total de ${imageArray.length} imagens encontradas.`);

        return imageArray;
    } catch (error) {
        console.error(`Erro ao buscar imagens do OLX: ${error.message}`);
        throw error;
    }
}

module.exports = { getImageUrlsFromOlx };
