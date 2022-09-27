'use strict';

const { randomBytes } = require('crypto');
const { ConsoleLogger } = require('../log');
const { Buffer } = require('buffer');


let singletonInstance;

/**
 * UniqueId based on mongo ObjectId but this implementation uses only 8-bytes instead of The 12-byte ObjectId.
 *  A 4-byte timestamp, representing the ObjectId's creation, measured in seconds since the Unix epoch.
 *  A 2-byte random value generated once per process. This random value is unique to the machine and process.
 *  A 2-byte incrementing counter, initialized to a random value.
 */
class UniqueId {

    /**
     * Builds a new instance, and generates the 2-byte processUnique and the 2-byte random index
     */
    constructor() {
        // set this.processUnique if yet not initialized
        this.processUnique = randomBytes(2);
        this.index = Math.floor(Math.random() * 0xffff);
    }

    /**
     * 
     * @returns for internal usage.  increments and get the incremental counter
     */
    getInc() {
        return (this.index = (this.index + 1) % 0xffff);
    }

    /**
     * Returns a new UniqueId. The 8-byte ID consists of:
     *  A 4-byte timestamp, representing the ObjectId's creation, measured in seconds since the Unix epoch.
     *  A 2-byte random value generated once per process. This random value is unique to the machine and process.
     *  A 2-byte incrementing counter, initialized to a random value.
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT). 
     * @returns {Buffer} 8-byte buffer
     */
    generate(time) {
        if ('number' !== typeof time) {
            time = Math.floor(Date.now() / 1000);
        }else if (time > 4294967295){
            time = Math.floor(time / 1000);
        }
        const inc = this.getInc();
        const buffer = Buffer.alloc(8);

        // 4-byte timestamp
        buffer.writeUInt32BE(time, 0);

        // 2-byte process unique
        buffer[4] = this.processUnique[0];
        buffer[5] = this.processUnique[1];
        // 2-byte counter
        buffer[7] = inc & 0xff;
        buffer[6] = (inc >> 8) & 0xff;

        return buffer;
    }

    /**
     * Returns a new UniqueId as a UInt64BE :
     *  A 4-byte timestamp, representing the ObjectId's creation, measured in seconds since the Unix epoch.
     *  A 2-byte random value generated once per process. This random value is unique to the machine and process.
     *  A 2-byte incrementing counter, initialized to a random value.
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT)
     * @returns {BigInt}
     */
    generateUInt64BE(time) {
        return this.generate(time).readBigUInt64BE();
    }

    /**
     * Returns a new UniqueId. As HEX-STRING, The 8-byte ID consists of:
     *  A 4-byte timestamp, representing the ObjectId's creation, measured in seconds since the Unix epoch.
     *  A 2-byte random value generated once per process. This random value is unique to the machine and process.
     *  A 2-byte incrementing counter, initialized to a random value.
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT)
     * @returns {String} 8-byte hex-string
     */
    generateHex(time) {
        return this.generate(time).toString('hex');
    }

    /**
     * Returns the minimum and maximum possible value for a given time
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT), if left blank, it uses current time
     * @param {*} processUnique the 2-byte random value generated once per process. if left blank, it uses 0x00 for minimum and 0xff for maximum
     * @returns {[Buffer]} array with min and max buffers
     */
    static getRange(time = Math.floor(Date.now() / 1000), processUnique = null) {
        if (time > 4294967295){
            time = Math.floor(time / 1000);
        }
        const min = Buffer.alloc(8);
        const max = Buffer.alloc(8);
        // 4-byte timestamp
        min.writeUInt32BE(time, 0);
        max.writeUInt32BE(time, 0);
        // 2-byte process unique
        min[4] = !processUnique ? 0x00 : processUnique[0];
        min[5] = !processUnique ? 0x00 : processUnique[1];
        max[4] = !processUnique ? 0xff : processUnique[0];
        max[5] = !processUnique ? 0xff : processUnique[1];
        // 2-byte counter
        min[7] = 0x00;
        min[6] = 0x00;
        max[7] = 0xff;
        max[6] = 0xff;
        return [min, max];
    }

    /**
     * Returns the minimum and maximum possible value for a given time
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT), if left blank, it uses current time
     * @param {*} processUnique the 2-byte random value generated once per process. if left blank, it uses 0x00 for minimum and 0xff for maximum
     * @returns {[BigInt]} array with min and max BigInt
     */
    static getRangeUInt64BE(time, processUnique) {
        const [min, max] = this.getRange(time, processUnique);
        return [min.readBigUInt64BE(), max.readBigUInt64BE()];
    }

    /**
     * Returns the minimum and maximum possible value for a given time
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT), if left blank, it uses current time
     * @param {*} processUnique the 2-byte random value generated once per process. if left blank, it uses 0x00 for minimum and 0xff for maximum
     * @returns {[String]} array with min and max hex-strings
     */
    static getRangeHex(time, processUnique) {
        const [min, max] = this.getRange(time, processUnique);
        return [min.toString('hex'), max.toString('hex')];
    }

    /**
     * Returns the minimum and maximum possible value for a given time. it uses the instance's 2-byte random value generated once per process
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT), if left blank, it uses current time
     * @returns {[Buffer]} array with min and max buffers
     */
    getRange(time) {
        return UniqueId.getRange(time, this.processUnique);
    }

    /**
     * Returns the minimum and maximum possible value for a given time. it uses the instance's 2-byte random value generated once per process
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT), if left blank, it uses current time
     * @returns {[BigInt]} array with min and max BigInt
     */
    getRangeUInt64BE(time) {
        const [min, max] = this.getRange(time, this.processUnique);
        return [min.readBigUInt64BE(), max.readBigUInt64BE()];
    }

    /**
     * Returns the minimum and maximum possible value for a given time. it uses the instance's 2-byte random value generated once per process
     * @param {int} time number of seconds/milliseconds that have elapsed since January 1, 1970 (midnight UTC/GMT), if left blank, it uses current time
     * @returns {[String]} array with min and max hex-strings
     */
    getRangeHex(time) {
        const [min, max] = this.getRange(time, this.processUnique);
        return [min.toString('hex'), max.toString('hex')];
    }    
}


/**
 * @returns {{UniqueId: {UniqueId}, instance: {function}}}
 */
module.exports = {    
    /**
     * @returns {UniqueId}
     */
    UniqueId,
    /**
     * @returns {UniqueId}
     */
    singleton: () => {
        if (!singletonInstance) {
            singletonInstance = new UniqueId();
            ConsoleLogger.i(`${singletonInstance.constructor.name} Singleton created`);
        }
        return singletonInstance;
    }
};
