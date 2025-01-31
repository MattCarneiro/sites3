const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const proxyUrl = process.env.PROXY_URL || '';

async function getImageUrlsFromSofertasimoveis(url) {
    console.log(`SofertaSimoveis: Iniciando extração de imagens para a URL: ${url}`);
    const images = [];
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/85.0.4183.102 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
    };

    try {
        const requestUrl = `${proxyUrl}?url=${encodeURIComponent(url)}`;
        console.log(`SofertaSimoveis: Fazendo requisição para: ${requestUrl}`);

        const res = await axios.get(requestUrl, { headers });
        console.log('SofertaSimoveis: Resposta obtida.');
        fs.writeFileSync('./public/sofertasimoveis_response.html', res.data);

        const $ = cheerio.load(res.data);
        $('div.gallery-item img').each((index, element) => {
            let imgSrc = $(element).attr('src');
            if (imgSrc && !imgSrc.startsWith('http')) {
                imgSrc = new URL(imgSrc, url).href;
            }
            images.push(imgSrc);
        });

        console.log(`SofertaSimoveis: ${images.length} imagens extraídas via Cheerio.`);
    } catch (error) {
        console.error(`SofertaSimoveis: Erro ao buscar a URL ${url} via proxy:`, error.message);
    }

    if (images.length === 0) {
        console.log('SofertaSimoveis: Nenhuma imagem encontrada via Cheerio. Tentando com Puppeteer...');

        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setExtraHTTPHeaders(headers);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Função para tentar clicar em diferentes referências
            async function tryClickOnMorePhotos() {
                const selectors = [
                    // Prioridade: Seletor com a classe específica do HTML fornecido
                    'div.sc-e1j81b-0.Lifhh.sc-138hwir-0.kgLzUR',
                    // Seletor CSS alternativo
                    '#__next > div > div > main > div > div.Detail > div.sc-138hwir-1.kApqoe.Detail__gallery > div.sc-138hwir-5.kFFtoR.WrapperImage > div.sc-e1j81b-0.Lifhh.sc-138hwir-0.kgLzUR',
                    // XPath completo
                    "/html/body/div[1]/div/div/main/div/div[1]/div[1]/div[1]/div[5]",
                    // XPath relativo para <span> com "Mais fotos"
                    "//span[text()='Mais fotos']"
                ];

                for (const selector of selectors) {
                    try {
                        let element;
                        if (selector.startsWith('/')) {
                            // Tenta como XPath
                            element = await page.waitForXPath(selector, { timeout: 3000 });
                        } else {
                            // Tenta como CSS selector
                            element = await page.waitForSelector(selector, { timeout: 3000 });
                        }

                        if (element) {
                            console.log(`SofertaSimoveis: Elemento encontrado (${selector}). Clicando...`);
                            await element.click();
                            await page.waitForTimeout(3000); // Espera para garantir que o modal abra
                            console.log('SofertaSimoveis: Modal aberto com sucesso.');
                            return true; // Retorna verdadeiro se o clique foi bem-sucedido
                        }
                    } catch (error) {
                        console.log(`SofertaSimoveis: Falha ao clicar no seletor ${selector}. Tentando o próximo...`);
                    }
                }
                return false; // Retorna falso se nenhum clique foi bem-sucedido
            }

            const clicked = await tryClickOnMorePhotos();
            if (!clicked) {
                console.log('SofertaSimoveis: Não foi possível abrir o modal "Mais fotos".');
            }

            const pageImages = await page.evaluate(() => {
                const imgElements = document.querySelectorAll('img');
                const imgUrls = [];
                imgElements.forEach(img => {
                    let imgSrc = img.getAttribute('src') || '';
                    if (
                        imgSrc.startsWith('https://objectstorage') &&
                        imgSrc.includes('/properties/') &&
                        !imgSrc.includes('/resolucao/') &&
                        !imgSrc.match(/\/\d+x\d+\//) // Verifica se há resolução como /200x200/
                    ) {
                        imgUrls.push(imgSrc);
                    }
                });
                return imgUrls;
            });

            console.log(`SofertaSimoveis: ${pageImages.length} imagens extraídas via Puppeteer.`);
            fs.writeFileSync('./public/sofertasimoveis_puppeteer_images.json', JSON.stringify(pageImages, null, 2));

            images.push(...pageImages);
            await browser.close();
        } catch (error) {
            console.error(`SofertaSimoveis: Erro ao usar Puppeteer para a URL ${url}:`, error.message);
        }
    }

    const processedImages = images.filter(Boolean);
    console.log(`SofertaSimoveis: Total de ${processedImages.length} imagens processadas após filtragem.`);
    return processedImages;
}

module.exports = { getImageUrlsFromSofertasimoveis };
