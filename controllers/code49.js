// controllers/code49.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

/**
 * Extrai as URLs das imagens do Code49 utilizando Puppeteer com o plugin Stealth,
 * ajustando para a resolução máxima.
 * @param {string} url - A URL da página a ser processada.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromCode49(url) {
  const images = new Set();

  // Função para ajustar URLs de imagens
  const adjustImageUrl = (src, baseDomain) => {
    let urlObj;
    try {
      urlObj = new URL(src, baseDomain);
    } catch (e) {
      console.error(`URL inválida: ${src}`);
      return null;
    }

    // Apenas processa URLs que pertencem ao mesmo domínio
    if (urlObj.origin !== baseDomain) {
      return null;
    }

    if (urlObj.pathname.startsWith('/exportacao/fotos/')) {
      // URL já está no formato de alta resolução
      return urlObj.href;
    }

    if (urlObj.pathname.startsWith('/admin/imovel/')) {
      // Substitui '/admin/imovel/' por '/exportacao/fotos/' no pathname
      urlObj.pathname = urlObj.pathname.replace('/admin/imovel/', '/exportacao/fotos/');
      // Remove '/mini/' no caminho, se presente
      while (urlObj.pathname.includes('/mini/')) {
        urlObj.pathname = urlObj.pathname.replace('/mini/', '/');
      }
      return urlObj.href;
    }

    return null;
  };

  try {
    console.log(`Code49: Acessando URL com Puppeteer: ${url}`);

    const browser = await puppeteer.launch({
      headless: true, // Use 'new' se sua versão do Puppeteer suportar
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Definir um viewport e user agent para simular um navegador comum
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/85.0.4183.102 Safari/537.36');

    // Navegar para a URL diretamente (sem proxy)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Esperar que o seletor 'div.carousel-item' esteja presente no DOM
    await page.waitForSelector('div.carousel-item', { timeout: 10000 });

    // Adicionar um atraso adicional para garantir que tudo esteja carregado
    // Utilizando setTimeout, que funciona em todas as versões
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2 segundos

    // Extrai o domínio base da URL fornecida
    const parsedUrl = new URL(url);
    const baseDomain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Extrair as imagens usando JavaScript no contexto da página
    const extractedImages = await page.evaluate(() => {
      const images = [];

      // Seleciona todos os elementos 'div.carousel-item'
      document.querySelectorAll('div.carousel-item').forEach(item => {
        // Extrai o data-foto
        const dataFoto = item.getAttribute('data-foto');
        if (dataFoto) {
          images.push(dataFoto);
        }

        // Extrai o background-image
        const bgDiv = item.querySelector('div[style*="background-image"]');
        if (bgDiv) {
          const style = bgDiv.getAttribute('style');
          const regex = /background-image:\s*url$$['"]?(.*?)['"]?$$/i;
          const match = style.match(regex);
          if (match && match[1]) {
            images.push(match[1]);
          }
        }
      });

      // Adicionalmente, extrai imagens de img[src] e source[srcset]
      document.querySelectorAll('img, source').forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('srcset');
        if (src) {
          images.push(src);
        }
      });

      return images;
    });

    console.log(`Code49: Imagens extraídas pelo Puppeteer: ${extractedImages.length}`);

    // Ajusta as URLs e adiciona ao conjunto de imagens
    for (let src of extractedImages) {
      if (!src.startsWith('http')) {
        src = new URL(src, baseDomain).href;
      }
      const adjustedSrc = adjustImageUrl(src, baseDomain);
      if (adjustedSrc) {
        images.add(adjustedSrc);
        console.log(`Code49: Imagem adicionada: ${adjustedSrc}`);
      }
    }

    await browser.close();

    const finalImages = Array.from(images);
    console.log(`Code49: Total de imagens encontradas: ${finalImages.length}`);
    return finalImages;

  } catch (error) {
    console.error(`Code49: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromCode49 };
