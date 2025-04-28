'use strict';

const BusinessRule = require('./BusinessRule');
const zlib = require('zlib');

const BUSINESS_RULE_CACHE_TTL = parseInt(process.env.BUSINESS_RULE_CACHE_TTL || 43200000); // 12 hours per default

/**
 * @class
 * @classdesc Manages business rules engine.
 */
class BusinessRuleEngine {

    constructor() {
        this.loadedBusinessRulesCache = {};
    }

    /**
     * Prepare and return a business rule
     * @param {string} type - Business rule type
     * @param {string} organizationId - Organization ID
     * @param {string} companyId - Company ID
     * @param {Promise<Object[]>} queryBusinessRules$ - Function to query businessRules using the given filter and projection, 
     *        must return a Promise that resolves to an array of BusinessRule.
     *        signature: (filter: Object, projection: Object) => Promise<Object[]>
     * @returns {BusinessRule} - Business rule
     */
    async getBusinessRule$(type, organizationId, companyId, queryBusinessRules$, context = {}) {
        if (!queryBusinessRules$) {
            throw new Error('BusinessRuleEngine.getBusinessRule$: queryBusinessRulesByType$ function is not defined');
        }

        // Check if the business rule is already loaded
        const brKey = `${type}_${organizationId}_${companyId || 'ANY'}`;
        if (this.loadedBusinessRulesCache[brKey] && this.loadedBusinessRulesCache[brKey].__expirationTs > Date.now()) {
            return this.loadedBusinessRulesCache[brKey];
        }

        // Query business rules
        const filters = { organizationId, type, active: true, published: true };
        const projection = { companyIds: 1, fromDateTime: 1, toDateTime: 1, publishTimestamp: 1 };

        let businessRulesMetadata;
        try {
            businessRulesMetadata = await queryBusinessRules$(filters, projection);
        } catch (error) {
            throw new Error('BusinessRuleEngine.getBusinessRule$: Error querying business rules: ' + error.message + `; filters=${JSON.stringify(filters)}`);
        }
        if (!businessRulesMetadata || businessRulesMetadata.length === 0) {
            throw new Error('BusinessRuleEngine.getBusinessRule$: Business rules not found: ' + JSON.stringify(filters));
        }

        // Filter by company
        businessRulesMetadata = businessRulesMetadata.filter(br => br.companyIds.length === 0 || br.companyIds.includes(companyId || 'ANY'));
        if (businessRulesMetadata.length === 0) {
            throw new Error('BusinessRuleEngine.getBusinessRule$: Business rule not found for company: ' + companyId + `; filters=${JSON.stringify(filters)}`);
        }

        // filter by fromDateTime, only the business rules that are valid at the current time
        const currentDateTime = Date.now();
        businessRulesMetadata = businessRulesMetadata.filter(br => br.fromDateTime <= currentDateTime);
        businessRulesMetadata = businessRulesMetadata.filter(br => !br.toDateTime || br.toDateTime >= currentDateTime);
        if (businessRulesMetadata.length === 0) {
            throw new Error('BusinessRuleEngine.getBusinessRule$: Business rule not found for current time: ' + currentDateTime + `; filters=${JSON.stringify(filters)}`);
        }

        // if one of them has a finite timespan then it should prevail
        if (businessRulesMetadata.some(br => br.toDateTime != null))
            businessRulesMetadata = businessRulesMetadata.filter(br => br.toDateTime != null);

        // Sort by publishTimestamp
        const businessRuleMetadata = businessRulesMetadata.sort((a, b) => b.publishTimestamp - a.publishTimestamp)[0];

        //quering the business rule with all the specs
        let businessRuleSpec;
        let source = null;
        try {
            let businessRuleSpecArray = await queryBusinessRules$({ _id: businessRuleMetadata._id }, {});
            businessRuleSpec = businessRuleSpecArray[0];
            switch (true) {
                case businessRuleSpec?.importedRules?.length > 0:
                    source = BusinessRuleEngine.zlibInflateSyncBase64(businessRuleSpec?.compressedFatSource);
                    break;
                case businessRuleSpec?.compressedSource != null:
                    source = BusinessRuleEngine.zlibInflateSyncBase64(businessRuleSpec.compressedSource);
                    break;
                default:
                    source = businessRuleSpec.source;
                    break;
            }
        } catch (error) {
            throw new Error('BusinessRuleEngine.getBusinessRule$: Error querying business rules: ' + error.message + `; filters=${JSON.stringify(filters)}`);
        }

        // generate the business rule
        const businessRule = new BusinessRule(
            businessRuleSpec.type,
            businessRuleSpec.name,
            source,
            (businessRuleSpec.language || {}).name,
            (businessRuleSpec.language || {}).version,
            (businessRuleSpec.language || {}).arguments,
            undefined,
            context
        );
        //set cache expiration time
        businessRule.__expirationTs = Date.now() + (Math.min(BUSINESS_RULE_CACHE_TTL, BusinessRuleEngine.millisecondsToEndOfDay()));
        this.loadedBusinessRulesCache[brKey] = businessRule;
        return businessRule;
    }

    /**
     * Build a custom BusinessRule instance
     * @param {string} type - Business rule type
     * @param {string} name - Business rule name
     * @param {string} source - Business rule source code
     * @param {string} language - Business rule language
     * @param {string} languageVersion  - Business rule language version
     * @param {object} languageArgs - Business rule language arguments
     * @returns {BusinessRule}
     */
    async buildCustomBusinessRule$(type, name, source, language, languageVersion, languageArgs, otherSources) {
        return new BusinessRule(
            type,
            name,
            source,
            language,
            languageVersion,
            languageArgs,
            otherSources
        );
    }

    /**
     * calculates the difference between the current time and the end of the day in milliseconds
     * @returns {number} - milliseconds to end of day
     */
    static millisecondsToEndOfDay() {
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return endOfDay - now;
    }

    /**
     * Decompresses a base64 encoded string using zlib and returns the result as a string.
     *
     * @param {string} data - The base64 encoded string to be decompressed.
     * @returns {string} - The decompressed string.
     */
    static zlibInflateSyncBase64(data) {
        if(data == null || data == '')
            throw new Error('BusinessRuleEngine.zlibInflateSyncBase64: data is null or empty');
        return zlib.inflateSync(Buffer.from(data, 'base64')).toString();
    }
}

/**
 * Exports the BusinessRuleEngine module
 * @type {BusinessRuleEngine}
 * @exports BusinessRuleEngine
 * @see BusinessRuleEngine
 * @see BusinessRule
 */
module.exports = BusinessRuleEngine;