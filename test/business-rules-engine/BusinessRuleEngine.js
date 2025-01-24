const { expect } = require('chai');
const BusinessRuleEngine = require('../../lib/business-rules-engine');

describe('BusinessRule (Lua)', () => {
  it('should build, execute, and destroy a custom Lua business rule', async () => {
    const businessRuleEngine = new BusinessRuleEngine();
    const businessRule = await businessRuleEngine.buildCustomBusinessRule$(
      'LUA_TEST',
      'LUA_TEST',
      'function exec() return "Hello from Lua" end',
      'LUA',
      '5.3',
      null
    );

    const result = businessRule.execute([]);
    expect(result).to.equal('Hello from Lua');

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
      'function exec() { return "Hello from JS"; }',
      'JS',
      10,
      null
    );

    const result = businessRule.execute([]);
    expect(result).to.equal('Hello from JS');

    if (typeof businessRule.destroy === 'function') {
      businessRule.destroy();
    }
  });
});