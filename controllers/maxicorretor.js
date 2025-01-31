// controllers/maxicorretor.js

const cheerio = require('cheerio');
const { fetchWithExponentialBackoff } = require('../utils/fetchWithBackoff');
require('dotenv').config();

/**
 * Extrai as URLs das imagens de sites do MaxiCorretor,
 * detectando "MaxiCorretor" em <div class="col-sm-12 alinhamento"> ou <div class="col-sm-12 rodape">
 * e buscando imagens que contenham "/img/imoveis/" no caminho.
 *
 * @param {string} url - URL da página do imóvel.
 * @returns {Promise<string[]>} - Um array de URLs das imagens.
 */
async function getImageUrlsFromMaxiCorretor(url) {
  const images = new Set();

  try {
    console.log(`MaxiCorretor: Acessando URL: ${url}`);

    // Monta a URL com proxy
    const requestUrl = `https://api-proxy.neuralbase.com.br/fetch?url=${encodeURIComponent(url)}`;
    // Faz a requisição via backoff
    const res = await fetchWithExponentialBackoff(requestUrl, { method: 'GET' });

    // Carrega o HTML no Cheerio
    const $ = cheerio.load(res.data);

    // 1) Verificar se existe "MaxiCorretor" em .col-sm-12.alinhamento ou .col-sm-12.rodape
    //    (Esse passo é opcional; você pode só extrair as imagens sem checar. 
    //     Mas, se quiser ter certeza de que é "MaxiCorretor", você verifica.)
    const textAlinhamento = $('.col-sm-12.alinhamento').text().toLowerCase() || '';
    const textRodape = $('.col-sm-12.rodape').text().toLowerCase() || '';
    if (textAlinhamento.includes('maxicorretor') || textRodape.includes('maxicorretor')) {
      console.log(`MaxiCorretor detectado pela presença de "maxicorretor" no rodapé/alinhamento.`);
    } else {
      console.log(`Aviso: Não foi encontrado "MaxiCorretor" nos seletores esperados. Prosseguindo mesmo assim...`);
    }

    // 2) (Opcional) Remover alguma seção que não queremos imagens
    //    Por exemplo, se tiver uma .related-property ou .rodape com imagens irrelevantes.
    //    Ajuste a gosto. Ex: $('.rodape').remove(); // se você não quiser nada do rodapé

    // 3) Extrair URLs de <img> que contenham '/img/imoveis/'
    $('img').each((index, element) => {
      let imgSrc = $(element).attr('src') || $(element).attr('data-src');
      if (!imgSrc) return;

      // Ex: https://www.cristianemacedoimoveis.com.br/img/imoveis/...
      if (imgSrc.includes('/img/imoveis/')) {
        // Se não começar com http, completa
        if (!imgSrc.startsWith('http')) {
          const parsedUrl = new URL(url);
          imgSrc = new URL(imgSrc, `${parsedUrl.protocol}//${parsedUrl.host}`).href;
        }

        // Adiciona ao Set
        images.add(imgSrc);
        console.log('MaxiCorretor: Imagem adicionada:', imgSrc);
      }
    });

    const finalImages = Array.from(images);
    console.log(`MaxiCorretor: Total de ${finalImages.length} imagens após processamento.`);
    return finalImages;

  } catch (error) {
    console.error(`MaxiCorretor: Erro ao buscar imagens para ${url}: ${error.message}`);
    return [];
  }
}

module.exports = { getImageUrlsFromMaxiCorretor };
