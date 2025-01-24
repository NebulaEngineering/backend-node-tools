'use strict';

const Lua53Fengari = require('./Lua53Fengari');
const NodeJsVM = require('./NodeJsVM');
const ConsoleLogger = require('../../log/ConsoleLogger');


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
        const vmMap = vmTypes.reduce((acc, vm) => {
            if (!acc[vm.getLanguage()]) {
                acc[vm.getLanguage()] = vmTypes
                    .filter(v => v.getLanguage() === vm.getLanguage())
            }
            return acc;
        }, {});
        const vmSupportedVersion = vmMap[language];
        if (vmSupportedVersion == null) throw new Error(`VmFactory.createVm: Unsupported language: ${language}, supported languages: ${Object.keys(vmMap).join(', ')}`);

        const majorUserVersion = parseInt(languageVersion.toString().split('.')[0]);
        const version = vmSupportedVersion
            .sort((a, b) => parseInt(b.getVersion().toString().split('.')[0]) - parseInt(a.getVersion().toString().split('.')[0]))
            .find(vm => parseInt(vm.getVersion().toString().split('.')[0]) >= majorUserVersion);
        if (version == null) throw new Error(`VmFactory.createVm: Unsupported ${language} version: ${languageVersion.toString()}, supported versions: ${vmSupportedVersion.map(v => v.getVersion().toString()).join(', ')}`);

        ConsoleLogger.i(`VmFactory.createVm: Creating VM for ${version.getLanguage()} version ${version.getVersion()}`);
        return new version();
    }
}

module.exports = VmFactory;