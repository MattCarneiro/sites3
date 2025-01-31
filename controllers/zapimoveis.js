// controllers/zapimoveis.js
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Encontra a URL de maior resolução em um atributo srcset.
 * @param {string} srcSet - O valor do atributo srcset.
 * @returns {string} - A URL da imagem com a maior resolução.
 */
function findHighestResolution(srcSet) {
    const candidates = srcSet.split(',').map(entry => entry.trim());
    let highestRes = '';
    let maxResolution = 0;

    candidates.forEach(candidate => {
        const match = candidate.match(/(\d+)w$/);
        if (match) {
            const resolution = parseInt(match[1]);
            if (resolution > maxResolution) {
                maxResolution = resolution;
                highestRes = candidate.split(' ')[0];
            }
        }
    });

    return highestRes;
}

/**
 * Extrai as URLs das imagens do site Zap Imóveis.
 * @param {string} url - A URL da página a ser processada.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromZapImoveis(url) {
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, {
        method: 'GET',
    });
    const $ = cheerio.load(res.data);
    const images = [];

    $('img').each((index, element) => {
        let imgSrc = $(element).attr('src');
        let srcSet = $(element).attr('srcset');

        // Verificar se há srcset para obter a melhor resolução
        if (srcSet) {
            imgSrc = findHighestResolution(srcSet);
        }

        // Substituir 'crop' por 'fit-in' se necessário
        if (imgSrc && imgSrc.includes('crop')) {
            const firstFitInImage = images.find(src => src.includes('fit-in'));
            if (firstFitInImage) {
                const fitInPartMatch = firstFitInImage.match(/fit-in\/[^/]+\//);
                if (fitInPartMatch) {
                    const fitInPart = fitInPartMatch[0];
                    imgSrc = imgSrc.replace(/crop\/[^/]+\//, fitInPart);
                }
            }
        }

        if (imgSrc) {
            // Converter URLs relativas para absolutas
            if (!imgSrc.startsWith('http')) {
                imgSrc = new URL(imgSrc, url).href;
            }
            images.push(imgSrc);
        }
    });

    return images;
}

module.exports = { getImageUrlsFromZapImoveis };
