'use strict';

const Lua53Fengari = require('./Lua53Fengari');
const NodeJsVM = require('./NodeJsVM');


/**
 * @class
 * @classdesc Factory for creating virtual machines.
 */
class VmFactory {
    /**
     * creates a virtual machine
     * @param {string} language
     * @param {double} languageVersion 
     * @returns VM
     */
    static createVm(language, languageVersion) {
        const vmTypes = [Lua53Fengari, NodeJsVM];
        for(let i = 0; i < vmTypes.length; i++) {
            if(vmTypes[i].getLanguage() === language){
                if(vmTypes[i].getVersion() <= languageVersion) {
                    return new vmTypes[i]();
                }
                throw new Error(`VmFactory.createVm: Unsupported ${language} version: ${languageVersion}`);
            }            
        }
        throw new Error(`VmFactory.createVm: Unsupported language: ${language}`);
    }
}

module.exports = VmFactory;