const { brokerFactory } = require('./lib/broker');

const broker = brokerFactory('NATS_JETSTREAM');
// MQTT

const message = {
    subject: 'MSG.PID.a1f3c',
    data: {
        text: 'Riesgo!, disminuir la velocidad',
        messageId: Math.floor(Math.random() * 1000),
        correlationId: Math.floor(Math.random() * 1000),
    }
}
const message2 = {
    subject: 'OTHER.PID.bj1accf',
    data: {
        text: 'Cierre en la carrera 47, desviarse en la case 123 y continuar por la calle 456',
        messageId: Math.floor(Math.random() * 1000),
        correlationId: Math.floor(Math.random() * 1000),
    }
}
const type = 'MESSAGE';
const streamName = 'MESSAGES-TEST';
const subjects = ['MSG.*.*'];

broker.start$(streamName, subjects).subscribe({
    next: (client) => {
        // client.send$(
        //     message.subject,
        //     type,
        //     message.data,
        //     subjects,
        //     {
        //         correlationId: message.data.correlationId,
        //         messageId: message.data.messageId
        //     }
        // ).subscribe({
        //     next: (messageId) => {
        //         console.log(`Message published with ID: ${messageId}`);
        //     },
        //     error: (err) => {
        //         console.error('Error publishing message:', err);
        //     },
        //     complete: () => {
        //         console.log('Publish complete');
        //     }
        // });

        subjects.push('OTHER.*.*');

        client.sendAndGetReply$({
            subject: message2.subject,
            responseSubject: 'CLIENT.RESPONSE',
            type,
            payload: message2.data,
            timeoutVal: 9000,
            ignoreSelfEvents: false,
            ops:{ 
                correlationId: message2.data.correlationId,
                messageId: message2.data.messageId 
            },
            subjects
        }
        ).subscribe({
            next: (response) => {
                console.log(`Response`, JSON.stringify(response, null, 2));
            },
            error: (err) => {
                console.error('Error publishing message:', err);
            },
            complete: () => {
                console.log('Publish complete');
            }
        })
    },
    error: (err) => {
        console.error('Error connecting to NATS:', err);
    },
    complete: () => {
        console.log('NATS connection complete');
    }
});