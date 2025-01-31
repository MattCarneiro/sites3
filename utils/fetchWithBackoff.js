// utils/fetchWithBackoff.js
const axios = require('axios');
require('dotenv').config();

async function fetchWithExponentialBackoff(url, options, retries = parseInt(process.env.BACKOFF_RETRIES, 10) || 7) {
    let retryCount = 0;
    const maxBackoff = 64000; // 64 segundos
    const additionalBackoff = [120000, 180000]; // 120 e 180 segundos

    while (retryCount < retries) {
        try {
            const res = await axios(url, options);
            if (res.status !== 200) {
                throw new Error(`Erro HTTP! status: ${res.status}`);
            }
            return res;
        } catch (error) {
            let waitTime;
            if (retryCount < 6) {
                waitTime = Math.min(
                    Math.pow(2, retryCount) * 1000 + Math.floor(Math.random() * 1000),
                    maxBackoff
                );
            } else {
                waitTime = additionalBackoff[retryCount - 6] || maxBackoff;
            }
            console.log(`Tentando novamente em ${waitTime} ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retryCount++;
        }
    }
    throw new Error(`Falha ao buscar ${url} após ${retries} tentativas`);
}

module.exports = { fetchWithExponentialBackoff };
