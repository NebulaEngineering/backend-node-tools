const { brokerFactory } = require('./lib/broker');
const broker = brokerFactory('NATS_JETSTREAM');
const streamName = 'MESSAGES-TEST';
const subjects = ['OTHER.*.*'];
const subjectFilter = ['OTHER.>'];
const type = 'MESSAGE';

const responseMessage = {
    subject: 'CLIENT.RESPONSE',
    data: {
        text: 'Alerta recibida',
        messageId: Math.floor(Math.random() * 1000),
    }
}

broker.start$(streamName, subjects).subscribe({
    next: (client) => {
        client.getMessageListener$(subjectFilter, false).subscribe({
            next: (message) => {
                console.log('Received message:', message);
                client.send$(
                    responseMessage.subject,
                    type,
                    responseMessage.data,
                    subjects,
                    {
                        correlationId: message.data.correlationId,
                        messageId: responseMessage.messageId
                    }
                ).subscribe({
                      next: (messageId) => {
                          console.log(`Message published with ID: ${messageId}`);
                      },
                      error: (err) => {
                          console.error('Error publishing message:', err);
                      },
                      complete: () => {
                          console.log('Publish complete');
                      }
                  });
            },
            error: (err) => {
                console.error('Error receiving message:', err);
            },
            complete: () => {
                console.log('Subscription complete');
            }
        });
    },
    error: (err) => {
        console.error('Error starting broker:', err);
    },
    complete: () => {
        console.log('Broker started');
    }
});