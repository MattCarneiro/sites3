// utils/downloadImage.js
const axios = require('axios');

async function downloadImage(url, retries = 2) {
    let attempt = 0;

    while (attempt < retries) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            if (response.status === 200) {
                return Buffer.from(response.data, 'binary');
            } else {
                throw new Error(`Status code: ${response.status}`);
            }
        } catch (error) {
            console.error(`Erro ao baixar a imagem ${url}: ${error.message}`);
            attempt++;

            if (attempt < retries) {
                console.log(`Tentando novamente em 3 segundos... (tentativa ${attempt + 1}/${retries})`);
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
    }

    console.log(`Falha ao baixar a imagem ${url} após ${retries} tentativas.`);
    return null;
}

module.exports = { downloadImage };
