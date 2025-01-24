'use strict'

// TEST LIBS
const assert = require('assert');
const should = require('chai').should();
const expect = require('chai').expect;
const { of } = require('rxjs');
const { map, concatAll, mergeMap, concatMap, take, toArray, reduce } = require('rxjs/operators');

//LIBS FOR TESTING
const { CustomError } = require('../../lib/error');
const { ConsoleLogger } = require('../../lib/log');

describe('LOG', function () {
  describe('ConsoleLogger', function () {

    it('default error', function () {
      process.env.LOG_LEVEL = 0;
      ConsoleLogger.d('This is a DEBUG Log');
      ConsoleLogger.i('This is an INFO Log');
      // ConsoleLogger.w('This is a WARN Log', new CustomError('CustomError','Class.Method',1234,'CustomError'));
      // ConsoleLogger.e('This is an ERROR Log', new CustomError('CustomError','Class.Method',1234,'CustomError'));
      // ConsoleLogger.f('This is a FATAL Log', new Error('Node Error'));
    });

  });
});
