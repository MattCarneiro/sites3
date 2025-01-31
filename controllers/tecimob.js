const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
const fs = require('fs');

const PROXY_URL = 'https://api-proxy.neuralbase.com.br/fetch';

async function getImagesFromTecimob(url) {
    const images = [];
    let usePuppeteer = false;

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        async function delay(time) {
            return new Promise(function(resolve) { 
                setTimeout(resolve, time);
            });
        }

        async function waitForXPath(page, xpath, timeout = 30000) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const elementExists = await page.evaluate((xpath) => {
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    return result.singleNodeValue !== null;
                }, xpath);
                if (elementExists) {
                    return;
                }
                await delay(100); // Aguarda 100ms antes de tentar novamente
            }
            throw new Error(`Timeout ao esperar pelo XPath: ${xpath}`);
        }

        async function autoScroll(page){
            await page.evaluate(async () => {
                await new Promise(resolve => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if(totalHeight >= scrollHeight - window.innerHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 200);
                });
            });
        }

        async function tryClickOnMorePhotos() {
            const selectors = [
                "/html/body/div[1]/div/div/main/div/div/div[1]/div[1]", // Novo XPath fornecido
                "/html/body/div[1]/div/div/main/div/div/div[1]" // XPath anterior
            ];

            for (const selector of selectors) {
                try {
                    if (selector.startsWith('/') || selector.startsWith('//')) {
                        // Espera pelo elemento XPath
                        await waitForXPath(page, selector, 10000);

                        // Tenta clicar no elemento via evaluate
                        const clicked = await page.evaluate((xpath) => {
                            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                            const element = result.singleNodeValue;
                            if (element) {
                                element.scrollIntoView();
                                // Simula um evento de clique real
                                const event = new MouseEvent('click', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true
                                });
                                element.dispatchEvent(event);
                                return true;
                            }
                            return false;
                        }, selector);

                        if (clicked) {
                            console.log(`Tecimob: Clique realizado com sucesso no seletor ${selector}.`);
                        } else {
                            console.log(`Tecimob: Elemento (${selector}) não encontrado para clique.`);
                        }
                    } else {
                        // Espera pelo seletor CSS
                        await page.waitForSelector(selector, { timeout: 10000 });
                        const elementHandle = await page.$(selector);

                        if (elementHandle) {
                            // Garante que o elemento esteja visível na viewport
                            await page.evaluate(el => el.scrollIntoView(), elementHandle);
                            await delay(500); // Pequena espera após o scroll

                            // Realiza o clique no elemento
                            await elementHandle.click({ delay: 100 });
                            console.log(`Tecimob: Clique realizado com sucesso no seletor ${selector}.`);
                        } else {
                            console.log(`Tecimob: Elemento (${selector}) não encontrado.`);
                        }
                    }

                    // Aguarda o carregamento das imagens
                    await page.waitForFunction(() => {
                        return Array.from(document.querySelectorAll('img')).some(img => img.src.includes('/properties/'));
                    }, { timeout: 20000 }).catch(() => {
                        console.log('Tecimob: As imagens não foram carregadas a tempo.');
                    });

                    // Rola até o final da página
                    await autoScroll(page);

                    // Espera adicional para garantir o carregamento completo
                    await delay(5000);
                    return true;
                } catch (error) {
                    console.error(`Tecimob: Falha ao processar o seletor ${selector}:`, error);
                }
            }
            return false;
        }

        const clicked = await tryClickOnMorePhotos();

        // Salvar conteúdo da página para depuração
        const pageContent = await page.content();
        fs.writeFileSync('after_click.html', pageContent);
        console.log('Conteúdo da página após o clique salvo em after_click.html');

        // Tirar screenshot da página
        await page.screenshot({ path: 'after_click.png', fullPage: true });
        console.log('Screenshot da página após o clique salvo em after_click.png');

        console.log('Tecimob: Verificando imagens na página após o clique...');
        const pageImages = await extractValidImages(page);

        if (pageImages.length === 0) {
            console.log('Tecimob: Nenhuma imagem válida encontrada após o clique. Tentando diretamente na URL original...');
            const fallbackImages = await extractImagesFromURL(url);
            images.push(...fallbackImages);
        } else {
            images.push(...pageImages);
        }

        console.log(`Tecimob: ${images.length} imagens válidas extraídas.`);
        await browser.close();
        usePuppeteer = true;
    } catch (error) {
        console.error(`Tecimob: Erro ao processar imagens com Puppeteer: ${url}`, error);
    }

    if (!usePuppeteer) {
        console.log('Tecimob: Usando Cheerio como fallback.');
        const fallbackImages = await extractImagesFromURL(url);
        images.push(...fallbackImages);
    }

    return images;
}

async function extractValidImages(page) {
    console.log('Tecimob: Extraindo imagens válidas da página...');
    const validImages = [];

    const pageImages = await page.evaluate(() => {
        const imgElements = document.querySelectorAll('img');
        const imgUrls = [];
        imgElements.forEach(img => {
            let imgSrc = img.getAttribute('src') || '';
            imgUrls.push(imgSrc);
        });
        return imgUrls;
    });

    console.log(`Tecimob: Total de ${pageImages.length} imagens encontradas na página.`);

    pageImages.forEach(imgSrc => {
        if (imgSrc) {
            console.log(`Imagem encontrada: ${imgSrc}`);
            if (
                imgSrc.startsWith('https://objectstorage') &&
                imgSrc.includes('/properties/') &&
                !imgSrc.includes('/resolucao/') &&
                !imgSrc.match(/\/\d+x\d+\//)
            ) {
                console.log(`Imagem válida encontrada: ${imgSrc}`);
                validImages.push(imgSrc);
            } else {
                console.log(`Imagem ignorada: ${imgSrc}`);
            }
        } else {
            console.log('Imagem com src vazio ou indefinido ignorada.');
        }
    });

    return validImages;
}

async function extractImagesFromURL(url) {
    console.log('Tecimob: Tentando extrair imagens diretamente da URL...');
    const images = [];
    const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });
    const $ = cheerio.load(res.data);

    $('img').each((index, element) => {
        let imgSrc = $(element).attr('src');
        if (imgSrc && !imgSrc.startsWith('http')) {
            imgSrc = new URL(imgSrc, url).href;
        }
        if (
            imgSrc.startsWith('https://objectstorage') &&
            imgSrc.includes('/properties/') &&
            !imgSrc.includes('/resolucao/') &&
            !imgSrc.match(/\/\d+x\d+\//)
        ) {
            console.log(`Imagem válida encontrada: ${imgSrc}`);
            images.push(imgSrc);
        } else {
            console.log(`Imagem ignorada: ${imgSrc}`);
        }
    });

    return images;
}

module.exports = { getImagesFromTecimob };
