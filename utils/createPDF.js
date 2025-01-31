// utils/createPDF.js
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

// Desativar cache do Sharp para reduzir consumo de memória
sharp.cache(false);

/**
 * Cria um PDF a partir de um array de buffers de imagens, tratando .jfif como jpeg
 * e convertendo formatos desconhecidos para PNG como fallback.
 *
 * @param {Buffer[]} imageBuffers
 * @returns {Promise<Uint8Array>} - Bytes do PDF
 */
async function createPDFWithImages(imageBuffers) {
    const pdfDoc = await PDFDocument.create();

    for (const buffer of imageBuffers) {
        try {
            // Obter metadados da imagem (formato, etc.)
            const metadata = await sharp(buffer).metadata();
            let imgType = metadata.format || '';

            // Tratar .jfif como 'jpeg'
            if (imgType === 'jfif') {
                imgType = 'jpeg';
            }

            let embeddedImage;
            let width, height;

            // Tenta embutir diretamente se for jpeg / png
            if (imgType === 'jpeg') {
                // Embutir como JPG
                embeddedImage = await pdfDoc.embedJpg(buffer);
            } else if (imgType === 'png') {
                // Embutir como PNG
                embeddedImage = await pdfDoc.embedPng(buffer);
            } else if (imgType === 'webp') {
                // Converter para PNG e embutir
                const pngBuffer = await sharp(buffer).png().toBuffer();
                embeddedImage = await pdfDoc.embedPng(pngBuffer);
            } else {
                // Qualquer outro formato (tiff, gif, heif, etc.)
                // Tentamos converter para PNG
                console.log(`Tipo de imagem não suportado diretamente: ${imgType}. Convertendo para PNG...`);
                const convertedBuffer = await sharp(buffer).png().toBuffer();
                embeddedImage = await pdfDoc.embedPng(convertedBuffer);
            }

            // Se a imagem foi embutida com sucesso
            if (embeddedImage) {
                ({ width, height } = embeddedImage);
                const page = pdfDoc.addPage([width, height]);
                page.drawImage(embeddedImage, { x: 0, y: 0, width, height });
            }
        } catch (error) {
            console.error('Erro ao embutir imagem:', error);
            // Pula para a próxima imagem em caso de falha
            continue;
        }
    }

    // Retorna os bytes do PDF
    return await pdfDoc.save();
}

module.exports = { createPDFWithImages };
