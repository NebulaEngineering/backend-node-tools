const { brokerFactory } = require('./lib/broker');
const broker = brokerFactory('NATS_JETSTREAM');

const subjectFilter = ['MSG.>'];
broker.start$().subscribe({
    next: (client) => {
        client.getMessageListener$(subjectFilter, false).subscribe({
            next: (message) => {
                console.log('Received message:', message);
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