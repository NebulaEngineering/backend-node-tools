'use strict';

const vm = require('vm');

class NodeJsVM {

    constructor() {
        // Create a fresh sandbox context
        this.context = {};
        vm.createContext(this.context);
    }

    static getLanguage() {        
        return 'JS';
    }

    static getVersion() {
        // For NodeJS, you might return the current Node version
        return process.versions.node;
    }

    /**
     * Load a JavaScript "source" code string into the VM context.
     * Any global variables or functions defined by that code
     * become available in `this.context`.
     * 
     * @param {string} source - JS code to run in the sandbox
     */
    loadSource(source) {
        try {
            vm.runInContext(source, this.context);
        } catch (err) {
            throw new Error(`NodeJsVM.loadSource: Error loading script: ${err.message}`);
        }
    }

    /**
     * Execute a named function from the sandbox.
     * 
     * @param {Array<any>} args - arguments to pass to the function
     * @param {string} functionName - global function name in the sandbox (default: "exec")
     * @returns {any} - the value returned by the sandboxed function
     */
    execute(args = [], functionName = 'exec') {
        // 1) Retrieve the function from the context
        const fn = this.context[functionName];
        if (typeof fn !== 'function') {
            throw new Error(
                `NodeJsVM.execute: global function '${functionName}' not found or not a function.`
            );
        }

        // 2) Invoke it with the provided arguments
        try {
            // Since it's just JavaScript, we can directly call `fn(...args)`
            return fn(...args);
        } catch (err) {
            throw new Error(`NodeJsVM.execute: Error calling '${functionName}': ${err.message}`);
        }
    }

    /**
     * Asynchronous (Promise-based) variant of `execute`.
     * 
     * @param {Array<any>} args
     * @param {string} functionName
     * @returns {Promise<any>} - resolves to the function’s return value
     */
    execute$(args = [], functionName = 'exec') {
        return new Promise((resolve, reject) => {
            try {
                const result = this.execute(args, functionName);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Cleanup the VM context.
     */
    destroy() {
        // Cleanup Node context
        this.context = null;
    }
    

}

module.exports = NodeJsVM;