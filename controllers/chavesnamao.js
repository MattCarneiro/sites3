// controllers/chavesnamao.js
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'imagens', 'chavesnamao');

/**
 * Cria o diretório para armazenar as imagens, se não existir.
 */
function ensureImagesDirectory() {
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
}

/**
 * Baixa uma imagem a partir da URL e a salva no diretório especificado.
 * @param {string} url - A URL da imagem.
 * @param {string} filename - O nome do arquivo para salvar a imagem.
 * @returns {Promise<string>} - O caminho completo do arquivo salvo.
 */
async function downloadImage(url, filename) {
    const filePath = path.join(IMAGES_DIR, filename);
    const writer = fs.createWriteStream(filePath);

    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });
    } catch (error) {
        writer.close();
        fs.unlinkSync(filePath); // Remove o arquivo incompleto
        throw error;
    }
}

/**
 * Extrai as URLs das imagens do site Chaves na Mão a partir do JSON embutido.
 * Modifica para HD substituindo a resolução na URL.
 * Adiciona lógica para obter as próximas 30 imagens com sufixos incrementais.
 * @param {string} url - A URL da página a ser processada.
 * @returns {Promise<string[]>} - Um array de caminhos dos arquivos de imagem baixados.
 */
async function getImageUrlsFromChavesNaMao(url) {
    console.log(`Fetching URL: ${url}`);
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;

    const res = await fetchWithExponentialBackoff(requestUrl, {
        method: 'GET',
    }).catch(error => {
        console.error(`Failed to fetch URL: ${url}`, error);
        throw error;
    });

    console.log(`Fetched URL: ${url}`);
    const $ = cheerio.load(res.data);

    // Extrair o conteúdo do script com id="__NEXT_DATA__"
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (!nextDataScript) {
        console.error('Não foi possível encontrar o script __NEXT_DATA__ na página.');
        return [];
    }

    let jsonData;
    try {
        jsonData = JSON.parse(nextDataScript);
    } catch (error) {
        console.error('Erro ao parsear o JSON do __NEXT_DATA__:', error);
        return [];
    }

    // Navegar até a propriedade que contém as fotos
    // Baseado no seu log, parece estar em props.pageProps.retorno.customData.fotos
    const fotos = jsonData?.props?.pageProps?.retorno?.customData?.fotos;
    if (!fotos || !Array.isArray(fotos)) {
        console.error('Não foi possível encontrar a propriedade "fotos" no JSON do __NEXT_DATA__.');
        return [];
    }

    if (fotos.length === 0) {
        console.error('Nenhuma foto encontrada na propriedade "fotos".');
        return [];
    }

    // Obter a primeira imagem para construir a base
    const primeiraFoto = fotos[0];
    if (!primeiraFoto || !primeiraFoto.url) {
        console.error('A primeira foto não contém uma URL válida.');
        return [];
    }

    // Construir a URL base para as imagens HD
    // Exemplo de primeiraFoto.url: "384510/22313587/pb-joao-pessoa-expedicionarios-rua-carlos-gomes-apartamento-a-venda-2-quartos-66739296-00.jpg"
    const urlBase = primeiraFoto.url.substring(0, primeiraFoto.url.lastIndexOf('-')); // "384510/22313587/pb-joao-pessoa-expedicionarios-rua-carlos-gomes-apartamento-a-venda-2-quartos-66739296"

    const HD_BASE_URL = 'https://www.chavesnamao.com.br/imn/0000X0000/N/imoveis/';

    const imageUrls = new Set();

    // Construir as URLs das imagens HD de 00 a 30
    for (let i = 0; i <= 30; i++) {
        const suffix = i.toString().padStart(2, '0'); // '00', '01', ..., '30'
        const imagemHDUrl = `${HD_BASE_URL}${urlBase}-${suffix}.jpg`; // Ajuste a extensão se necessário
        imageUrls.add(imagemHDUrl);
    }

    console.log(`Total de imagens para tentar baixar: ${imageUrls.size}`);

    const imagePaths = [];
    ensureImagesDirectory();

    // Baixar todas as imagens HD
    for (const imgUrl of imageUrls) {
        try {
            const urlParts = imgUrl.split('/');
            const filename = urlParts.slice(-1)[0];
            console.log(`Baixando imagem: ${imgUrl}`);
            const filePath = await downloadImage(imgUrl, filename);
            imagePaths.push(filePath);
            console.log(`Imagem salva em: ${filePath}`);
        } catch (error) {
            console.error(`Erro ao baixar a imagem ${imgUrl}:`, error.message);
            // Continue para a próxima imagem
        }
    }

    console.log(`Total de imagens baixadas com sucesso: ${imagePaths.length}`);
    return imagePaths;
}

module.exports = { 
    getImageUrlsFromChavesNaMao 
};
