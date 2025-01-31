// index.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { connectRabbitMQ } = require('./utils/rabbitMQ');
const { createPDFWithImages } = require('./utils/createPDF');
const { downloadImage } = require('./utils/downloadImage');
dotenv.config(); // Carrega as variáveis de ambiente

const { createClient } = require('redis');

// Configura o cliente Redis
const redisClient = createClient({
    url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => {
    console.error('Erro ao conectar ao Redis:', err);
});

redisClient.on('connect', () => {
    console.log('Conectado ao Redis');
});

// Inicialize a conexão com o Redis
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Erro ao conectar ao Redis:', err);
    }
})();

// Controllers existentes
const olxController = require('./controllers/olx');
const sofertasimoveisController = require('./controllers/sofertasimoveis');
const zapimoveisController = require('./controllers/zapimoveis');
const vivarealController = require('./controllers/vivareal');
const chavesnamaoController = require('./controllers/chavesnamao');
const tecimobController = require('./controllers/tecimob');
const genericController = require('./controllers/generic');
const imovelwebController = require('./controllers/imovelweb');
const i123iController = require('./controllers/123i');
const netimoveisController = require('./controllers/netimoveis');
const lopesController = require('./controllers/lopes');

let pLimit; // Variável para p-limit
let globalChannel; // Variável global para o canal RabbitMQ

(async () => {
    pLimit = (await import('p-limit')).default; // Importação dinâmica de p-limit
})();

const app = express();
const port = process.env.PORT || 3000;
const pdfStoragePath = './public/';

// Definindo valores padrões para BACKOFF_RETRIES e SENT_WEBHOOK_URL
const BACKOFF_RETRIES = parseInt(process.env.BACKOFF_RETRIES, 10) || 7;
const SENT_WEBHOOK_URL = process.env.SENT_WEBHOOK_URL || 'https://ultra-n8n.neuralbase.com.br/webhook/fotos';

// Cria pasta public se não existir
if (!fs.existsSync(pdfStoragePath)) {
    fs.mkdirSync(pdfStoragePath, { recursive: true });
}

app.use(express.static('public'));
app.use(express.json());

// Função para determinar site1 e site2
function determineSite1AndSite2(url, detectedSite2) {
    let site1 = '';
    let site2 = detectedSite2 || '';

    if (url.includes('olx.com')) {
        site1 = 'OLX';
    } else if (url.includes('lopes.com')) {
        site1 = 'Lopes';
    } else if (url.includes('zapimoveis.com')) {
        site1 = 'Zap';
    } else if (url.includes('123i.com')) {
        site1 = '123i';
    } else if (url.includes('netimoveis.com')) {
        site1 = 'NetImóveis';
    } else if (url.includes('casamineira.com')) {
        site1 = 'Casa Mineira';
    } else if (url.includes('imovelweb.com')) {
        site1 = 'ImovelWeb';
    } else if (url.includes('vivareal.com')) {
        site1 = 'VivaReal';
    } else if (url.includes('chavesnamao.com')) {
        site1 = 'Chaves na Mão';
    } else if (url.includes('sofertasimoveis')) {
        site1 = 'Site Próprio';
        site2 = 'Supremo CRM';
    } else {
        site1 = 'Site Próprio';
        site2 = detectedSite2 || 'Genérico';
    }

    return { site1, site2 };
}

// Função para obter as URLs das imagens e site2
async function getImageUrlsFromSite(url, site1, site2) {
    let images = [];
    let site1Used = '';
    let site2Used = '';

    if (site1) {
        console.log(`Tentando obter imagens usando site1: ${site1}, site2: ${site2 || 'N/A'}`);
        site1Used = site1;
        site2Used = site2 || '';

        try {
            if (site1.toLowerCase() === 'olx') {
                images = await olxController.getImageUrlsFromOlx(url);
            } else if (site1.toLowerCase() === 'lopes') {
                images = await lopesController.getImageUrlsFromLopes(url);
            } else if (site1.toLowerCase() === 'zap' || site1.toLowerCase() === 'zapimoveis') {
                images = await zapimoveisController.getImageUrlsFromZapImoveis(url);
            } else if (site1.toLowerCase() === '123i') {
                images = await i123iController.getImageUrlsFrom123i(url);
            } else if (site1.toLowerCase() === 'netimóveis' || site1.toLowerCase() === 'netimoveis') {
                images = await netimoveisController.getImageUrlsFromNetImoveis(url);
            } else if (site1.toLowerCase() === 'imovelweb' || site1.toLowerCase() === 'casa mineira') {
                images = await imovelwebController.getImageUrlsFromImovelWeb(url);
            } else if (site1.toLowerCase() === 'vivareal') {
                images = await vivarealController.getImageUrlsFromVivaReal(url);
            } else if (site1.toLowerCase() === 'chaves na mão' || site1.toLowerCase() === 'chavesnamao') {
                images = await chavesnamaoController.getImageUrlsFromChavesNaMao(url);
            } else if (site1.toLowerCase() === 'site próprio' || site1.toLowerCase() === 'site proprio') {
                // Se site1 é 'Site Próprio', usamos site2 para determinar o controlador
                const result = await genericController.getImageUrlsFromGenericOrSpecialSite(url, site2);
                images = result.images;
                site2Used = result.site2 || site2;
            } else {
                console.log(`Site1 não reconhecido: ${site1}. Tentando detecção automática.`);
                site1Used = '';
                site2Used = '';
                images = [];
            }
        } catch (error) {
            console.error(`Erro ao obter imagens usando site1: ${site1}, site2: ${site2 || 'N/A'}: ${error.message}`);
            images = [];
        }

        if (images.length > 0) {
            console.log(`Imagens obtidas usando site1: ${site1Used}, site2: ${site2Used || 'N/A'}`);
            return { images, site1Used, site2Used };
        } else {
            console.error(`Nenhuma imagem encontrada usando site1: ${site1}, site2: ${site2 || 'N/A'}.`);
            console.log('Tentando detecção automática.');
            images = [];
            site1Used = '';
            site2Used = '';
        }
    }

    // Lógica de detecção automática
    console.log(`Processando link: ${url} com detecção automática.`);
    let detectedSites = determineSite1AndSite2(url);
    site1Used = detectedSites.site1;
    site2Used = detectedSites.site2;

    try {
        if (url.includes('olx.com')) {
            images = await olxController.getImageUrlsFromOlx(url);
        } else if (url.includes('sofertasimoveis')) {
            images = await sofertasimoveisController.getImageUrlsFromSofertasimoveis(url);
            site2Used = 'Supremo CRM';
        } else if (url.includes('zapimoveis.com')) {
            images = await zapimoveisController.getImageUrlsFromZapImoveis(url);
        } else if (url.includes('vivareal.com')) {
            images = await vivarealController.getImageUrlsFromVivaReal(url);
        } else if (url.includes('chavesnamao.com')) {
            images = await chavesnamaoController.getImageUrlsFromChavesNaMao(url);
        } else if (url.includes('lopes.com')) {
            images = await lopesController.getImageUrlsFromLopes(url);
        } else if (url.includes('imovelweb.com')) {
            images = await imovelwebController.getImageUrlsFromImovelWeb(url);
        } else if (url.includes('casamineira.com')) {
            images = await imovelwebController.getImageUrlsFromImovelWeb(url);
        } else if (url.includes('123i.com')) {
            images = await i123iController.getImageUrlsFrom123i(url);
        } else if (url.includes('netimoveis.com')) {
            images = await netimoveisController.getImageUrlsFromNetImoveis(url);
        } else {
            // Se não se enquadrar em nenhum site específico, cai no genérico
            const result = await genericController.getImageUrlsFromGenericOrSpecialSite(url);
            images = result.images;
            site2Used = result.site2 || site2Used;
        }
    } catch (error) {
        console.error(`Erro ao obter imagens na detecção automática: ${error.message}`);
        images = [];
    }

    if (images.length > 0) {
        console.log(`Imagens obtidas usando detecção automática: site1: ${site1Used}, site2: ${site2Used || 'N/A'}`);
    }

    return { images, site1Used, site2Used };
}

// Função principal de processamento
async function processPdfCreation(msg, channel, attempt = 0, log = '') {
    const limit = pLimit(5); // Limitar a 5 downloads simultâneos
    let { link, Id, context, UserMsg, MsgIdPhoto, MsgIdVideo, MsgIdPdf, site1, site2 } = JSON.parse(msg.content.toString());

    try {
        console.log(`Processando link: ${link}, site1: ${site1 || 'N/A'}, site2: ${site2 || 'N/A'}`);
        const { images: imagePaths, site1Used, site2Used } = await getImageUrlsFromSite(link, site1, site2);

        // Atualiza site1 e site2 com base na lógica realmente utilizada
        site1 = site1Used;
        site2 = site2Used;

        if (imagePaths.length === 0) {
            throw new Error('Nenhuma imagem encontrada no site.');
        }

        console.log(`Total de ${imagePaths.length} imagens encontradas.`);
        const imageBuffers = [];
        let successfulImages = 0;

        // Faz o download das imagens
        const downloadTasks = imagePaths.map((imagePath) =>
            limit(async () => {
                try {
                    let buffer;
                    if (imagePath.startsWith('http') || imagePath.startsWith('https')) {
                        buffer = await downloadImage(imagePath, 2);
                    } else {
                        // Se a URL não começar com http(s), tente completá-la
                        const completeUrl = new URL(imagePath, link).href;
                        buffer = await downloadImage(completeUrl, 2);
                    }

                    if (buffer) {
                        imageBuffers.push(buffer);
                        successfulImages++;
                        console.log(`Imagem ${successfulImages}/${imagePaths.length} baixada.`);
                    } else {
                        console.log(`Falha ao baixar a imagem: ${imagePath}`);
                    }
                } catch (error) {
                    console.error(`Erro ao processar a imagem ${imagePath}: ${error.message}`);
                    log += `Erro ao processar a imagem ${imagePath}: ${error.message}\n`;
                }
            })
        );

        await Promise.all(downloadTasks);

        if (imageBuffers.length === 0) {
            throw new Error('Nenhuma imagem válida foi processada.');
        }

        // Cria o PDF em memória
        const pdfBytes = await createPDFWithImages(imageBuffers);
        const pdfName = `pdf_${Date.now()}.pdf`;
        fs.writeFileSync(`${pdfStoragePath}${pdfName}`, pdfBytes);
        console.log(`PDF criado com sucesso: ${pdfName}`);

        // Limpa o array de buffers
        imageBuffers.length = 0;

        // Agendar deleção do PDF após 15 minutos
        setTimeout(() => {
            fs.unlink(`${pdfStoragePath}${pdfName}`, (err) => {
                if (err) {
                    console.error(`Erro ao apagar PDF: ${err.message}`);
                } else {
                    console.log(`PDF ${pdfName} apagado.`);
                }
            });
        }, 900000);

        // Envia webhook de sucesso
        try {
            await axios.post(SENT_WEBHOOK_URL, {
                pdfName,
                Id,
                context,
                UserMsg,
                MsgIdPhoto,
                MsgIdVideo,
                MsgIdPdf,
                link,
                result: true,
                site1,
                site2
            });
            console.log('Webhook enviado com sucesso para o PDF:', pdfName);
        } catch (error) {
            console.error(`Erro ao enviar webhook de sucesso: ${error.message}`);
        }

        // Reconhece a mensagem na fila RabbitMQ
        channel.ack(msg);
    } catch (error) {
        console.error('Erro ao criar o PDF:', error.message);
        log += `Erro: ${error.message}\n`;

        if (attempt < BACKOFF_RETRIES) {
            const waitTime = Math.min(2 ** attempt * 1000, 64000);
            console.log(`Tentando novamente em ${waitTime} ms...`);
            setTimeout(() => processPdfCreation(msg, channel, attempt + 1, log), waitTime);
        } else {
            // Se site1 e site2 não foram definidos, determina-os
            if (!site1 || !site1.trim()) {
                const detectedSites = determineSite1AndSite2(link, '');
                site1 = detectedSites.site1;
                site2 = detectedSites.site2;
            }

            // Envia webhook de falha
            try {
                await axios.post(SENT_WEBHOOK_URL, {
                    pdfName: null,
                    Id,
                    context,
                    UserMsg,
                    MsgIdPhoto,
                    MsgIdVideo,
                    MsgIdPdf,
                    link,
                    result: false,
                    reason: log,
                    site1,
                    site2
                });
                console.log('Webhook de falha enviado com sucesso.');
            } catch (error) {
                console.error(`Erro ao enviar webhook de falha: ${error.message}`);
            }

            channel.ack(msg);
        }
    }
}

// Função para iniciar o consumidor
function startConsumer() {
    connectRabbitMQ((channel) => {
        globalChannel = channel;
        const QUEUE_NAME = process.env.QUEUE_NAME;

        console.log(`Consumindo mensagens da fila: ${QUEUE_NAME}`);

        channel.consume(QUEUE_NAME, async (msg) => {
            try {
                await processPdfCreation(msg, channel);
            } catch (error) {
                console.error('Erro ao processar a mensagem:', error.message);
                channel.ack(msg);
            }
        }, {
            noAck: false, // Certifique-se de que o ack manual esteja habilitado
        });
    });
}

// Inicia o consumidor
startConsumer();

// Endpoint para criação de PDF (HTTP POST)
app.post('/create-pdf', async (req, res) => {
    const { link, Id, context, UserMsg, MsgIdPhoto, MsgIdVideo, MsgIdPdf, site1, site2 } = req.body;

    if (!link || !Id) {
        return res.status(400).send('Parâmetros ausentes.');
    }

    const duplicateKey = `pdf_request:${Id}:${link}`;

    try {
        // Verifica se já existe um registro com o mesmo Id e link
        const exists = await redisClient.get(duplicateKey);

        if (exists) {
            console.log(`Solicitação ignorada para Id: ${Id}, Link: ${link} (dentro da janela de 30 minutos)`);
            return res.send({ message: 'Solicitação ignorada (já processada nos últimos 30 minutos).' });
        } else {
            // Armazena no Redis com TTL de 30 minutos (1800 segundos)
            await redisClient.setEx(duplicateKey, 180, 'processed');

            const msgContent = { link, Id, context, UserMsg, MsgIdPhoto, MsgIdVideo, MsgIdPdf, site1, site2 };
            const QUEUE_NAME = process.env.QUEUE_NAME;

            if (!globalChannel) {
                return res.status(500).send('Canal RabbitMQ não inicializado.');
            }

            globalChannel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(msgContent)), { persistent: true });
            console.log('Mensagem enviada para a fila');
            res.send({ message: 'Iniciando criação do PDF.' });
        }
    } catch (error) {
        console.error('Erro ao acessar o Redis:', error);
        res.status(500).send('Erro interno do servidor.');
    }
});

// Endpoint para download do PDF
app.get('/download', (req, res) => {
    const { pdfName } = req.query;
    if (!pdfName) {
        return res.status(400).send('Nome do PDF não especificado.');
    }

    const filePath = path.join(pdfStoragePath, pdfName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('PDF não encontrado.');
    }

    res.download(filePath, pdfName, (err) => {
        if (err) {
            console.error(`Erro ao baixar o PDF (${pdfName}):`, err.message);
            res.status(500).send('Erro ao baixar o PDF.');
        }
    });
});

// Inicia o servidor HTTP
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

// Força Garbage Collection se disponível
if (global.gc) {
    setInterval(() => {
        console.log('Forçando Garbage Collection...');
        global.gc();
    }, 60000); // Executa a cada 60 segundos
} else {
    console.warn('Garbage collector não disponível. Execute com --expose-gc');
}
