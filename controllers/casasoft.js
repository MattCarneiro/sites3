// controllers/casasoft.js

const cheerio = require('cheerio');
const axios = require('axios');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
require('dotenv').config();

const PROXY_URL = process.env.PROXY_URL || 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Remove partes indesejadas da URL da imagem para obter a versão em alta resolução.
 * @param {string} imageUrl - A URL original da imagem.
 * @returns {string} - A URL da imagem em alta resolução.
 */
function getHighResolutionImageUrl(imageUrl) {
  const parts = imageUrl.split('/fotos/');
  if (parts.length < 2) {
    return imageUrl; // Retorna a imagem original se não corresponder ao padrão esperado
  }
  const baseUrl = parts[0];
  let path = parts[1];

  // Remove qualquer diretório extra após '/fotos/' que não seja o diretório de número
  const pathParts = path.split('/');
  const cleanPathParts = [];
  for (const part of pathParts) {
    if (!isNaN(part) || part.endsWith('.jpg') || part.endsWith('.png')) {
      cleanPathParts.push(part);
    }
  }
  const cleanPath = cleanPathParts.join('/');

  return `${baseUrl}/fotos/${cleanPath}`;
}

/**
 * Obtém as URLs das imagens da página Casasoft.
 * @param {string} url - A URL do imóvel.
 * @returns {Promise<string[]>} - Array de URLs de imagens em alta resolução.
 */
async function getImageUrlsFromCasasoft(url) {
  console.log(`Casasoft: Iniciando extração de imagens para a URL: ${url}`);
  const images = [];

  try {
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    const $ = cheerio.load(res.data);

    // Verifica se a página contém imagens com o padrão da Casasoft
    $('img').each((index, element) => {
      let imgSrc = $(element).attr('src');
      if (imgSrc && imgSrc.includes('fotos2.casasoft.net.br/indicadordeimoveis/')) {
        // Ignora imagens dentro de elementos com classe 'similar__box' ou 'similar__background'
        const parentSimilar = $(element).closest('.similar__box, .similar__background');
        if (parentSimilar.length === 0) {
          // Obtém a URL da imagem em alta resolução
          const highResImageUrl = getHighResolutionImageUrl(imgSrc);
          images.push(highResImageUrl);
        }
      }
    });
  } catch (error) {
    console.error(`Casasoft: Erro ao extrair imagens da URL ${url}: ${error.message}`);
  }

  // Remove URLs duplicadas
  const uniqueImages = [...new Set(images)];
  console.log(`Casasoft: Total de ${uniqueImages.length} imagens encontradas.`);
  return uniqueImages;
}

module.exports = { getImageUrlsFromCasasoft };
