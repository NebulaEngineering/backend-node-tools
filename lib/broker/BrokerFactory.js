'use strict';

const { ConsoleLogger } = require('../log');
const os = require('os');
const uuidv4 = require('uuid/v4');

//multiton instances
let instance = {};

class BrokerFactory {
    /**
     * Factory instance and config
     */
    constructor(brokerType = process.env.BROKER_TYPE) {
        switch (brokerType) {
            case 'PUBSUB':
                const PubSubBroker = require('./PubSubBroker');
                this.broker = new PubSubBroker({
                    replyTimeout: process.env.REPLY_TIMEOUT || 2000,
                    topicSubscriptionSuffix: process.env.MICROBACKEND_KEY,
                });
                break;
            case 'MQTT':
                const MqttBroker = require('./MqttBroker');
                const mqttArgs = {
                    mqttServerUrl: process.env.MQTT_SERVER_URL,
                    replyTimeout: process.env.REPLY_TIMEOUT || 2000,
                    topicPrefix: process.env.MQTT_TOPIC_PREFIX || '',
                    connOps: {
                        host: process.env.MQTT_SERVER_URL,
                        clientId: (process.env.NODE_ENV === 'production') ? os.hostname() : uuidv4(),                        
                    },                    
                };
                if (process.env.MQTT_PORT) mqttArgs.connOps.port = process.env.MQTT_PORT;
                if (process.env.MQTT_USERNAME) mqttArgs.connOps.username = process.env.MQTT_USERNAME;
                if (process.env.MQTT_PASSWORD) mqttArgs.connOps.password = process.env.MQTT_PASSWORD;
                if (process.env.MQTT_PROTOCOL) mqttArgs.connOps.protocol = process.env.MQTT_PROTOCOL;
                if (process.env.MQTT_PROTOCOL_VERSION) mqttArgs.connOps.protocolVersion = parseInt(process.env.MQTT_PROTOCOL_VERSION);

                this.broker = new MqttBroker(mqttArgs);
                break;
            case 'NATS_JETSTREAM':
                const NatsJetstreamBroker = require('./NatsJetStreamBroker');
                const natsArgs = {
                    natsServerUrl: process.env.NATS_SERVER_URL,
                    replyTimeout: process.env.REPLY_TIMEOUT || 2000,
                    topicPrefix: process.env.NATS_TOPIC_PREFIX || '',
                    // connOps: {
                    //     name: (process.env.NODE_ENV === 'production') ? os.hostname() : uuidv4(),
                    //     servers: [process.env.NATS_SERVER_URL],
                    // },
                };
                this.broker = new NatsJetstreamBroker(natsArgs);
                break;
        }
    }
    /**
     * Get the broker instance
     */
    getBroker() {
        return this.broker;
    }
}

/**
 * @returns {PubSubBroker}
 */
module.exports = (brokerType) => {
    if (!instance[brokerType]) {
        instance[brokerType] = new BrokerFactory(brokerType);
        ConsoleLogger.i(`@nebulae/backend-node-tools::BrokerFactory(${brokerType}) multiton instance created `);
    }
    return instance[brokerType].broker;
};