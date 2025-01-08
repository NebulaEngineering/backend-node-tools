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

        const version = vmSupportedVersion
            .sort((a, b) => b.getVersion() - a.getVersion())
            .find(vm => parseInt(vm.getVersion()) <= parseInt(languageVersion));
        if (version == null) throw new Error(`VmFactory.createVm: Unsupported ${language} version: ${languageVersion}, supported versions: ${vmSupportedVersion.map(v => v.getVersion()).join(', ')}`);

        ConsoleLogger.i(`VmFactory.createVm: Creating VM for ${version.getLanguage()} version ${version.getVersion()}`);
        return new version();
    }
}

module.exports = VmFactory;