'use strict';

const ConsoleLogger = require('../log/ConsoleLogger');
const { VmFactory } = require('./vm');

/**
 * @class
 * @classdesc Represents a business rule.
 *  
 */
class BusinessRule {

    /**
     * Creates an instance of BusinessRule
     * @param {*} type 
     * @param {*} name 
     * @param {*} source 
     * @param {*} language 
     * @param {*} languageVersion 
     * @param {*} languageArgs 
     */
    constructor(type, name, source, language, languageVersion, languageArgs, otherSources, context) {
        this.type = type;
        this.name = name;
        this.source = source;
        this.language = language;
        this.languageVersion = languageVersion;
        this.languageArgs = languageArgs;
        this.__expirationTs = null;

        // Create and prepare the virtual machine
        this.vm = VmFactory.createVm(language, languageVersion, context);
        this.vm.loadSource(source, otherSources);
        ConsoleLogger.i(`BusinessRule.constructor: BusinessRule instantiated: ${JSON.stringify({ type, name, language, languageVersion })}`);
    }


    /**
     * Execute a named function.
     * 
     * @param {Array<any>} args - arguments to pass to the function
     * @param {string} functionName - global function name in the sandbox (default: "exec")
     * @returns {any} - the value returned by the function
     */
    execute(args = [], functionName = 'exec') {
        return this.vm.execute(args, functionName);
    }

    /**
     * Asynchronous (Promise-based) variant of `execute`.
     * Execute a named function.
     * 
     * @param {Array<any>} args - arguments to pass to the function
     * @param {string} functionName - global function name in the sandbox (default: "exec")     
     * @returns {Promise<any>} - the value returned by the function
     */
    async execute$(args = [], functionName = 'exec') {
        return await this.vm.execute$(args, functionName);
    }

    getVmSource = () => this.vm.source;

    /**
     * Cleanup the VM context.
     */
    destroy() {
        this.vm.destroy();
    }

}

/**
 * @module BusinessRule
 * @type {BusinessRule}
 */
module.exports = BusinessRule;