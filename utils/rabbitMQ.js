// utils/rabbitMQ.js

const amqp = require('amqplib/callback_api');
require('dotenv').config();

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_PORT = process.env.RABBITMQ_PORT;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASS = process.env.RABBITMQ_PASS;
const RABBITMQ_VHOST = process.env.RABBITMQ_VHOST;
const QUEUE_NAME = process.env.QUEUE_NAME || 'sua_fila';

function connectRabbitMQ(onConnected) {
    const amqpOptions = {
        protocol: 'amqp',
        hostname: RABBITMQ_HOST,
        port: RABBITMQ_PORT,
        username: RABBITMQ_USER,
        password: RABBITMQ_PASS,
        vhost: RABBITMQ_VHOST,
    };

    let connection;
    let channel;

    const connect = () => {
        amqp.connect(amqpOptions, function (err, conn) {
            if (err) {
                console.error('Erro ao conectar ao RabbitMQ:', err.message);
                // Tentar reconectar após um intervalo
                return setTimeout(connect, 5000);
            }
            connection = conn;
            connection.on('error', (err) => {
                if (err.message !== 'Connection closing') {
                    console.error('Erro na conexão:', err.message);
                }
            });
            connection.on('close', () => {
                console.error('Conexão com o RabbitMQ fechada. Tentando reconectar...');
                // Tentar reconectar após um intervalo
                return setTimeout(connect, 5000);
            });
            console.log('Conectado ao RabbitMQ');

            connection.createChannel(function (err, ch) {
                if (err) {
                    console.error('Erro ao criar canal:', err.message);
                    // Tentar reconectar após um intervalo
                    return setTimeout(connect, 5000);
                }
                channel = ch;

                channel.on('error', (err) => {
                    console.error('Erro no canal:', err.message);
                });
                channel.on('close', () => {
                    console.log('Canal fechado. Tentando reconectar...');
                    // Tentar reconectar após um intervalo
                    return setTimeout(connect, 5000);
                });

                // Assegurar que a fila existe com o tipo 'quorum'
                channel.assertQueue(QUEUE_NAME, {
                    durable: true,
                    arguments: { 'x-queue-type': 'quorum' }
                }, (err) => {
                    if (err) {
                        console.error('Erro ao assegurar a fila:', err.message);
                        // Tentar reconectar após um intervalo
                        return setTimeout(connect, 5000);
                    }
                    console.log(`Fila "${QUEUE_NAME}" assegurada.`);
                    onConnected(channel);
                });
            });
        });
    };

    connect();
}

module.exports = { connectRabbitMQ };
