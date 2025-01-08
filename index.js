'use strict'

const auth = require('./lib/auth');
const broker = require('./lib/broker');
const cqrs = require('./lib/cqrs');
const error = require('./lib/error');
const log = require('./lib/log');
const uniqueId = require('./lib/unique-id');
const BusinessRuleEngine = require('./lib/business-rules-engine');

module.exports = {
    auth,
    broker,
    cqrs,
    error,
    log,
    uniqueId,
    /**
     * Manages business rules engine.
     * @module BusinessRuleEngine
     * @see BusinessRuleEngine
     * @type {BusinessRuleEngine}
     */
    BusinessRuleEngine
};