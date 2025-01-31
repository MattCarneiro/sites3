const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/** Caminho onde salvamos/lemos os cookies do Orulo */
const COOKIES_PATH = path.join(__dirname, '..', 'orulo_cookies.json');

/** Helper simples para "sleep" (Puppeteer antigo) */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lê cookies do arquivo JSON, se existir, e aplica na página.
 */
async function loadCookiesIfExists(page) {
  if (fs.existsSync(COOKIES_PATH)) {
    const cookiesJSON = fs.readFileSync(COOKIES_PATH, 'utf8');
    if (cookiesJSON) {
      try {
        const cookies = JSON.parse(cookiesJSON);
        if (Array.isArray(cookies) && cookies.length > 0) {
          await page.setCookie(...cookies);
          console.log(`Orulo: Carreguei ${cookies.length} cookies do arquivo.`);
        }
      } catch (err) {
        console.log('Orulo: Erro ao fazer parse dos cookies:', err.message);
      }
    }
  }
}

/**
 * Salva os cookies atuais em orulo_cookies.json
 */
async function saveCookies(page) {
  try {
    const client = await page.target().createCDPSession();
    const { cookies } = await client.send('Network.getAllCookies');
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log(`Orulo: Salvei ${cookies.length} cookies em ${COOKIES_PATH}`);
  } catch (err) {
    console.log('Orulo: Erro ao salvar cookies:', err.message);
  }
}

/**
 * Verifica se estamos logados no Orulo (visitando a home e checando se redireciona para "Login").
 */
async function checkIfLoggedIn(page) {
  // Abre a home do Orulo
  await page.goto('https://www.orulo.com.br/', { waitUntil: 'networkidle2' });
  await sleep(2000);

  const currentTitle = await page.title();
  if (currentTitle.toLowerCase().includes('login')) {
    return false;
  }
  const currentUrl = page.url();
  if (currentUrl.includes('auth.orulo.com.br')) {
    return false;
  }
  return true;
}

/**
 * Faz login via e-mail e senha (definidos em EMAIL_ORULO / PASS_ORULO no .env).
 */
async function doOruloLogin(page) {
  const emailOrulo = process.env.EMAIL_ORULO || '';
  const passOrulo = process.env.PASS_ORULO || '';
  if (!emailOrulo || !passOrulo) {
    console.log('Orulo: Favor definir EMAIL_ORULO e PASS_ORULO no .env');
    return;
  }

  // Ir para a tela de login por e-mail
  await page.goto('https://auth.orulo.com.br/email', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  await sleep(2000);

  // Preenche e envia o formulário
  await page.type('#email', emailOrulo, { delay: 50 });
  await page.type('#password', passOrulo, { delay: 50 });
  await page.click('button[type="submit"]');
  await sleep(4000);
}

/**
 * Extrai URLs de <a> e <img> que contenham “static.orulo.com.br/images/properties”.
 */
async function extractOruloImages(page) {
  const data = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a[href*="static.orulo.com.br/images/properties"]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href) results.push(href);
    });
    document.querySelectorAll('img[src*="static.orulo.com.br/images/properties"]').forEach((img) => {
      const src = img.getAttribute('src');
      if (src) results.push(src);
    });
    return results;
  });
  return data;
}

/**
 * Rola a página até o fim para forçar carregamento (lazy-load).
 */
async function autoScroll(page) {
  let previousHeight = await page.evaluate('document.body.scrollHeight');
  while (true) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await sleep(1000);
    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === previousHeight) {
      break;
    }
    previousHeight = newHeight;
  }
}

/**
 * Tenta rolar até #buildings-show-plans e extrair imagens de plantas, se houver.
 */
async function extractOruloFloorPlans(page) {
  try {
    await page.evaluate(() => {
      const el = document.querySelector('#buildings-show-plans');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
    await sleep(1500);
  } catch (e) {
    console.log('Orulo: Falha ao rolar até #buildings-show-plans');
  }

  // Agora extrai URLs do DOM
  return extractOruloImages(page);
}

/**
 * Principal: extrai imagens do Orulo com reaproveitamento de cookies.
 */
async function getImageUrlsFromOrulo(url) {
  console.log(`Orulo: Iniciando extração de imagens para: ${url}`);
  let browser = null;
  const images = new Set();

  try {
    // 1) Lançar o browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // 1.1) Acessa orulo.com.br para setar o domain e carrega cookies (se existirem)
    await page.goto('https://www.orulo.com.br', { waitUntil: 'networkidle2' });
    await loadCookiesIfExists(page);

    // 1.2) Recarrega a página para aplicar cookies
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2000);

    // 1.3) Checa se estamos logados
    const isLogged = await checkIfLoggedIn(page);
    if (!isLogged) {
      console.log('Orulo: Não estamos logados. Fazendo login...');
      await doOruloLogin(page);

      // Verifica após login
      const isLoggedAfter = await checkIfLoggedIn(page);
      if (!isLoggedAfter) {
        console.log('Orulo: Falha no login. Encerrando.');
        await browser.close();
        return [];
      }
      // Se logou com sucesso, salva cookies
      await saveCookies(page);
    } else {
      console.log('Orulo: Já estamos logados (cookies válidos).');
    }

    // 2) Agora acessa a URL do building
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // (Opcional) Tira um screenshot para debug
    try {
      await page.screenshot({ path: 'orulo_building.png', fullPage: true });
      console.log('Orulo: Screenshot "orulo_building.png" salvo para debug.');
    } catch (err) {
      console.log(`Orulo: Falha ao tirar screenshot: ${err.message}`);
    }

    // 2.1) Rola até o fim (lazy-load)
    await autoScroll(page);

    // 3) Tenta clicar no carrossel principal
    try {
      console.log('Orulo: Tentando clicar no carrossel principal...');
      await page.click('#orulo_carousel .InitialImageView__Image-sc-1mxroh8-1');
      await sleep(2000);
    } catch (err) {
      console.log(`Orulo: Falha ao clicar no carrossel principal: ${err.message}`);
    }

    // 4) Tenta clicar na primeira imagem da galeria
    try {
      console.log('Orulo: Tentando clicar na PRIMEIRA imagem do .GridGallery__Container-glxsed-0...');
      const firstGalleryLink = await page.$(
        '.GridGallery__Container-glxsed-0 .GridGallery__ImageLink-glxsed-1'
      );
      if (firstGalleryLink) {
        await firstGalleryLink.click();
        await sleep(2000);
        console.log('Orulo: Primeira imagem da galeria clicada, abrindo lightbox...');
      } else {
        console.log('Orulo: Nenhum link encontrado em .GridGallery__Container-glxsed-0');
      }
    } catch (err) {
      console.log(`Orulo: Falha ao clicar na primeira imagem do GridGallery: ${err.message}`);
    }

    // 5) Extrai imagens do lightbox/página
    const galleryImgs = await extractOruloImages(page);
    galleryImgs.forEach((src) => images.add(src));
    console.log(`Orulo: Coletadas ${galleryImgs.length} imagens do lightbox/galeria.`);

    // Tenta fechar o lightbox com ESC
    try {
      await page.keyboard.press('Escape');
      await sleep(1000);
    } catch (err) {
      console.log(`Orulo: Falha ao fechar lightbox: ${err.message}`);
    }

    // 6) Extraímos também as plantas
    const floorPlanImgs = await extractOruloFloorPlans(page);
    floorPlanImgs.forEach((src) => images.add(src));
    console.log(`Orulo: Coletadas ${floorPlanImgs.length} imagens de plantas.`);

    console.log(`Orulo: Total final de ${images.size} imagens extraídas.`);
    await browser.close();
  } catch (err) {
    console.error(`Orulo: Erro geral: ${err.message}`);
    if (browser) {
      await browser.close();
    }
  }

  return [...images];
}

module.exports = { getImageUrlsFromOrulo };
