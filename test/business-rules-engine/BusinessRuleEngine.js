const { expect } = require('chai');
const BusinessRuleEngine = require('../../lib/business-rules-engine');

describe('BusinessRule (Lua)', () => {
  it('should build, execute, and destroy a custom Lua business rule', async () => {
    const businessRuleEngine = new BusinessRuleEngine();
    const businessRule = await businessRuleEngine.buildCustomBusinessRule$(
      'LUA_TEST',
      'LUA_TEST',
      `
    function exec()
    local g = 0
      for i=1,10000 do g=g+1 end
      return 'Hello from Lua ' .. g
    end
  `,
      'LUA',
      '5.3',
      null
    );

    const result = businessRule.execute([]);
    const initTs = Date.now();
    console.log('Execution time:', Date.now() - initTs);
    expect(result).to.equal('Hello from Lua 10000');
    

    if (typeof businessRule.destroy === 'function') {
      businessRule.destroy();
    }
  });
});

describe('BusinessRule (JS)', () => {
  it('should build, execute, and destroy a custom JS business rule', async () => {
    const businessRuleEngine = new BusinessRuleEngine();
    const businessRule = await businessRuleEngine.buildCustomBusinessRule$(
      'JS_TEST',
      'JS_TEST',
      'function exec() { let g=0;for(let i=0;i<10000;i++){g++}; return "Hello from JS "+g; }', 
      'JS',
      10,
      null
    );

    const initTs = Date.now();
    const result = businessRule.execute([]);
    console.log('Execution time:', Date.now() - initTs);
    expect(result).to.equal('Hello from JS 10000');

    if (typeof businessRule.destroy === 'function') {
      businessRule.destroy();
    }
  });
});