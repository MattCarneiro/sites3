// controllers/generic.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');

// Importações dos controladores
const tecimobController = require('./tecimob');
const kenloController = require('./kenlo');
const supremoController = require('./supremo'); // Importação do controlador do Supremo
const imobibrasilController = require('./imobibrasil');
const code49Controller = require('./code49');
const migmidiaController = require('./migmidia');
const midasController = require('./midas');
const imoproController = require('./imopro');
const objetivaController = require('./objetiva');
const praediumController = require('./praedium');
const imonovController = require('./imonov');
const casasoftController = require('./casasoft');
const maxicorretorController = require('./maxicorretor');
const kuroleController = require('./kurole');
const sinaionlineController = require('./sinaionline');

require('dotenv').config();

const PROXY_URL = process.env.PROXY_URL || 'https://api-proxy.neuralbase.com.br/fetch';

/**
 * Extrai as URLs das imagens de sites genéricos ou especiais.
 * @param {string} url - A URL da página a ser processada.
 * @param {string} site2 - O nome do site2 (opcional).
 * @returns {Promise<{images: string[], site2: string}>} - Um objeto contendo um array de URLs das imagens e o site2.
 */
async function getImageUrlsFromGenericOrSpecialSite(url, site2) {
  // Requisição via proxy com backoff
  const requestUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
  const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

  // Carrega o HTML com Cheerio
  const $ = cheerio.load(res.data.toString());
  let images = [];
  let detectedSite2 = '';

  // Se site2 foi fornecido, tenta usar o controlador específico
  if (site2) {
    console.log(`Tentando obter imagens usando site2 fornecido: ${site2}`);
    try {
      if (site2.toLowerCase() === 'supremo crm') {
        images = await supremoController.getImagesFromSupremo(url);
        detectedSite2 = 'Supremo CRM';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'tec imob' || site2.toLowerCase() === 'tecimob') {
        images = await tecimobController.getImagesFromTecimob(url);
        detectedSite2 = 'Tec Imob';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'kenlo') {
        images = await kenloController.getImagesFromKenlo(url);
        detectedSite2 = 'Kenlo';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'imobibrasil') {
        images = await imobibrasilController.getImageUrlsFromImobiBrasil(url);
        detectedSite2 = 'ImobiBrasil';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'code49') {
        images = await code49Controller.getImageUrlsFromCode49(url);
        detectedSite2 = 'Code49';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'migmidia') {
        images = await migmidiaController.getImageUrlsFromMigmidia(url);
        detectedSite2 = 'MigMidia';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'midas') {
        images = await midasController.getImageUrlsFromMidas(url);
        detectedSite2 = 'Midas';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'imopro') {
        images = await imoproController.getImageUrlsFromImopro(url);
        detectedSite2 = 'IMOPRO';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'objetiva') {
        images = await objetivaController.getImageUrlsFromObjetiva(url);
        detectedSite2 = 'Objetiva Software (Gestor Imobiliária)';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'praedium') {
        images = await praediumController.getImageUrlsFromPraedium(url);
        detectedSite2 = 'Praedium';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'imonov') {
        images = await imonovController.getImageUrlsFromImonov(url);
        detectedSite2 = 'Imonov (Si9 Sistemas)';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'casasoft') {
        images = await casasoftController.getImageUrlsFromCasasoft(url);
        detectedSite2 = 'CasaSoft';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'maxicorretor') {
        images = await maxicorretorController.getImageUrlsFromMaxiCorretor(url);
        detectedSite2 = 'MaxiCorretor';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'kurole') {
        images = await kuroleController.getImageUrlsFromKurole(url);
        detectedSite2 = 'Kurole';
        return { images, site2: detectedSite2 };
      } else if (site2.toLowerCase() === 'sinaionline') {
        images = await sinaionlineController.getImageUrlsFromSinaionline(url);
        detectedSite2 = 'Sinaionline';
        return { images, site2: detectedSite2 };
      } else {
        console.log(`Site2 não reconhecido ou não implementado: ${site2}. Prosseguindo com detecção automática.`);
      }
    } catch (error) {
      console.error(`Erro ao obter imagens usando site2 (${site2}): ${error.message}`);
      console.log('Prosseguindo com detecção automática.');
    }
  }

  // Caso não tenha imagens ainda, prosseguir com detecção automática
  // Texto completo do footer (e rodapés) em minúsculas
  const footerText = $('footer, .footer, .footer-copy, .rodape, .rodape__assinatura')
    .text()
    .toLowerCase();

  // HTML completo em minúsculas
  const pageHtml = $.html().toLowerCase();

  // col-sm-12.alinhamento e .rodape para “MaxiCorretor”
  const colAlinhamentoText = $('.col-sm-12.alinhamento').text().toLowerCase() || '';
  const colRodapeText = $('.col-sm-12.rodape').text().toLowerCase() || '';

  // --------------------------------------------------------------
  // Detecções específicas:

  // Imopro
  if (
    footerText.includes('imopro') ||
    pageHtml.includes('imopro') ||
    $('a[href*="imopro"]').length > 0
  ) {
    console.log(`Imopro detectado para a URL: ${url}`);
    images = await imoproController.getImageUrlsFromImopro(url);
    detectedSite2 = 'IMOPRO';
    return { images, site2: detectedSite2 };
  }

  // Objetiva
  else if (
    footerText.includes('objetiva') ||
    pageHtml.includes('objetiva') ||
    $('a[href*="objetiva"]').length > 0 ||
    pageHtml.includes('sis.gestorimob.com.br')
  ) {
    console.log(`Objetiva detectado para a URL: ${url}`);
    images = await objetivaController.getImageUrlsFromObjetiva(url);
    detectedSite2 = 'Objetiva Software (Gestor Imobiliária)';
    return { images, site2: detectedSite2 };
  }

  // Praedium
  else if (
    footerText.includes('praedium') ||
    pageHtml.includes('praedium') ||
    $('a[href*="praedium"]').length > 0
  ) {
    console.log(`Praedium detectado para a URL: ${url}`);
    images = await praediumController.getImageUrlsFromPraedium(url);
    detectedSite2 = 'Praedium';
    return { images, site2: detectedSite2 };
  }

  // Imonov/Si9sistemas
  else if (
    footerText.includes('imonov') ||
    footerText.includes('si9sistemas') ||
    pageHtml.includes('imonov') ||
    pageHtml.includes('si9sistemas') ||
    $('a[href*="imonov"]').length > 0 ||
    $('a[href*="si9sistemas"]').length > 0
  ) {
    console.log(`Imonov/Si9sistemas detectado para a URL: ${url}`);
    images = await imonovController.getImageUrlsFromImonov(url);
    detectedSite2 = 'Imonov (Si9 Sistemas)';
    return { images, site2: detectedSite2 };
  }

  // Midas
  else if (
    footerText.includes('midas') ||
    $('footer a[href*="midas"], .footer a[href*="midas"]').length > 0
  ) {
    console.log(`Midas detectado para a URL: ${url}`);
    images = await midasController.getImageUrlsFromMidas(url);
    detectedSite2 = 'Midas';
    return { images, site2: detectedSite2 };
  }

  // Migmidia
  else if (
    footerText.includes('migmidia') ||
    $('a[href*="migmidia.com.br"]').length > 0
  ) {
    console.log(`Migmidia detectado para a URL: ${url}`);
    images = await migmidiaController.getImageUrlsFromMigmidia(url);
    detectedSite2 = 'MigMidia';
    return { images, site2: detectedSite2 };
  }

  // Casasoft
  else if (
    footerText.includes('casasoft') ||
    pageHtml.includes('casasoft') ||
    $('a[href*="casasoft"]').length > 0
  ) {
    console.log(`Casasoft detectado para a URL: ${url}`);
    images = await casasoftController.getImageUrlsFromCasasoft(url);
    detectedSite2 = 'CasaSoft';
    return { images, site2: detectedSite2 };
  }

  // MaxiCorretor
  else if (
    colAlinhamentoText.includes('maxicorretor') ||
    colRodapeText.includes('maxicorretor') ||
    footerText.includes('maxicorretor') ||
    pageHtml.includes('maxicorretor')
  ) {
    console.log(`MaxiCorretor detectado para a URL: ${url}`);
    images = await maxicorretorController.getImageUrlsFromMaxiCorretor(url);
    detectedSite2 = 'MaxiCorretor';
    return { images, site2: detectedSite2 };
  }

  // Kurole
  else if (pageHtml.includes('kurole')) {
    console.log(`Kurole detectado para a URL: ${url}`);
    images = await kuroleController.getImageUrlsFromKurole(url);
    detectedSite2 = 'Kurole';
    return { images, site2: detectedSite2 };
  }

  // Sinaionline
  else if (
    footerText.includes('sinaionline') ||
    pageHtml.includes('sinaionline')
  ) {
    console.log(`Sinaionline detectado para a URL: ${url}`);
    images = await sinaionlineController.getImageUrlsFromSinaionline(url);
    detectedSite2 = 'Sinaionline';
    return { images, site2: detectedSite2 };
  }

  // Supremo
  else if (
    footerText.includes('supremocrm') ||
    pageHtml.includes('supremocrm') ||
    footerText.includes('sistema crm para imobiliária') ||
    pageHtml.includes('sistema crm para imobiliária') ||
    pageHtml.includes('supremo_assinatura') ||
    pageHtml.includes('supremo-logo-white.png')
  ) {
    console.log(`Supremo detectado para a URL: ${url}`);
    images = await supremoController.getImagesFromSupremo(url);
    detectedSite2 = 'Supremo CRM';
    return { images, site2: detectedSite2 };
  }

  // Tecimob
  else if (
    footerText.includes('tecimob') ||
    pageHtml.includes('https://tecimob.com.br')
  ) {
    console.log(`Tecimob detectado para a URL: ${url}`);
    images = await tecimobController.getImagesFromTecimob(url);
    detectedSite2 = 'Tec Imob';
    return { images, site2: detectedSite2 };
  }

  // Kenlo
  else if (footerText.includes('kenlo')) {
    console.log(`Kenlo detectado para a URL: ${url}`);
    images = await kenloController.getImagesFromKenlo(url);
    detectedSite2 = 'Kenlo';
    return { images, site2: detectedSite2 };
  }

  // Imobibrasil
  else if (
    footerText.includes('imobibrasil') ||
    pageHtml.includes('imobibrasil.com.br')
  ) {
    console.log(`Imobibrasil detectado para a URL: ${url}`);
    images = await imobibrasilController.getImageUrlsFromImobiBrasil(url);
    detectedSite2 = 'ImobiBrasil';
    return { images, site2: detectedSite2 };
  }

  // Code49
  else if (
    footerText.includes('code49') ||
    pageHtml.includes('code49.com.br')
  ) {
    console.log(`Code49 detectado para a URL: ${url}`);
    images = await code49Controller.getImageUrlsFromCode49(url);
    detectedSite2 = 'Code49';
    return { images, site2: detectedSite2 };
  }

  // Caso não detecte nada acima, processa como site genérico
  else {
    console.log(`Processando como site genérico: ${url}`);
    $('img').each((index, element) => {
      let imgSrc = $(element).attr('src');
      if (imgSrc && !imgSrc.startsWith('http')) {
        imgSrc = new URL(imgSrc, url).href;
      }
      if (imgSrc) {
        images.push(imgSrc);
      }
    });

    // Ajuste extra para imagens da Supremo fora do footer
    for (let i = 0; i < images.length; i++) {
      if (
        images[i].startsWith('https://arquivos.sistemasupremo.com.br') &&
        images[i].includes('/p_')
      ) {
        images[i] = images[i].replace('/p_', '/g_');
      }
    }

    // Remove duplicadas
    const uniqueImages = [...new Set(images)];
    detectedSite2 = 'Genérico';
    console.log(`Total final de ${uniqueImages.length} imagens encontradas.`);
    return { images: uniqueImages, site2: detectedSite2 };
  }
}

module.exports = { getImageUrlsFromGenericOrSpecialSite };
