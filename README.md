![NebulaE](docs/images/nebula.png "Nebula Engineering SAS")

# Backend-Node-Tools

Backend-Node-Tools is a client library with several crosscutting tools for developing micro-backends based [NebulaE](https://nebulae.com.co/) Microservices Framework

  - [Installation](#installation)
  - [Console Logger](#console-logger)
    - [Environment Variables](#environment-variables)
    - [Example](#example)
  - [Custom Error](#custom-error)
    - [Example](#example-1)
  - [Auth Tools](#auth-tools)
    - [User roles verification](#user-roles-verification)
      - [Example](#example-2)
    - [User has roles](#user-has-roles)
      - [Example](#example-3)
  - [Broker Factory](#broker-factory)
    - [Environment Variables](#environment-variables-1)
    - [Example](#example-4)
  - [CQRS tools](#cqrs-tools)
    - [build Success Response](#build-success-response)
    - [handle Error](#handle-error)
    - [Example](#example-5)
  - [Business Rules Engine](#business-rules-engine)
    - [build Success Response](#build-success-response-1)
    - [Usage](#usage)
    - [Functions](#functions)
    - [Example](#example-6)


## Installation

```sh
npm install @nebulae/backend-node-tools --save
```

## Console Logger
Tools for standard console logger

### Environment Variables:
process.env | desc | values | defaults
--- | --- | --- | ---
`LOG_LEVEL` | Log Level Threshold | `DEBUG` `INFO` `WARN` `ERROR` `FATAL` | `WARN`

### Example:

```js
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;
const { CustomError } = require('@nebulae/backend-node-tools').error;

ConsoleLogger.d('This is a DEBUG Log');
ConsoleLogger.i('This is an INFO Log');
ConsoleLogger.w('This is a WARN Log', new CustomError('CustomError','Class.Method',1234,'CustomError'));
ConsoleLogger.e('This is an ERROR Log', new CustomError('CustomError','Class.Method',1234,'CustomError'));
ConsoleLogger.f('This is a FATAL Log', new Error('Node Error'));

// log format
// 2019-06-01T03:49:20.907Z [WARN]: This is a WARN Log;  ERROR(1234): CustomError
```


## Custom Error
Node Error extension to includes name, code and method.  This custom error is compatible with CQRS responses.

### Example:

```js

const { CustomError } = require('@nebulae/backend-node-tools').error;

const myCustomError = new CustomError(
    'ERR_NAME', // Error name
    'SomeClass.SomeMethod', // The Class name and Method where this error had generated
    1234, // Error code
    'Some Message' // Error Message
);
```

## Auth Tools

### User roles verification
Checks if the user has the role needed, otherwise throws an error according to the passed parameters.
returns a RxJS Observable of validated roles if succed or custom error if the verification failed

#### Example:

```js
const { RoleValidator } = require('@nebulae/backend-node-tools').auth;
const { CustomError, PERMISSION_DENIED } =require('@nebulae/backend-node-tools').error;

const userRoles = ['OPERATOR', 'PLATFORM-ADMIN', 'BUSINESS-OWNER'];
const neededRoles = ['PLATFORM-ADMIN', 'SYSADMIN'];
const permissionDeniedError = new CustomError('PermissionDenied', 'test.mocha', PERMISSION_DENIED, 'the user does not have the needed roles to execute this task');

RoleValidator.verifyRoles$(
    userRoles, // current user roles
    'SomeClass.SomeMethod', //current method
    permissionDeniedError, // The Error to throw if validation fails
    neededRoles // needed roles to verify
    ).subscribe(
        (response) => {
            //prints { 'PLATFORM-ADMIN': true, 'SYSADMIN': false }
            console.log(JSON.stringify(response));
        },
);

```
### User has roles
Returns true if the user has at least one of the required roles or false otherwise

#### Example:

```js
const { RoleValidator } = require('@nebulae/backend-node-tools').auth;

const userRoles = ['OPERATOR', 'PLATFORM-ADMIN', 'BUSINESS-OWNER'];
const neededRoles = ['PLATFORM-ADMIN', 'SYSADMIN'];

const hasNeededRoles = RoleValidator.hasRoles(userRoles,neededRoles);
//hasNeededRoles is true

```


## Broker Factory
Creates a MQTT or Google Cloud PubSub Broker based on RxJS with pre-build functions for listening and sending messages

### Environment Variables:
process.env | desc | values | defaults
--- | --- | --- | ---
`BROKER_TYPE` | Default broker to use | `MQTT` `PUBSUB` | N/A
`GOOGLE_APPLICATION_CREDENTIALS` | gcloud-service-key json file to configure PubSub | gcloud-service-key json file | N/A
`MICROBACKEND_KEY` | The MicroBackend unique Key is used as PubSub Subscription suffix | ms-lineadirecta-generator_mbe_lineadirecta-generator | `default-suffix`
`MQTT_SERVER_URL` | mqtt server URL | mqtt://host:port | N/A
`REPLY_TIMEOUT` | send & recieve response timeout millis | milliseconds (number) | 2000

### Example:

```js
const { brokerFactory } = require('@nebulae/backend-node-tools').broker;

// generates a multiton instance
const broker = brokerFactory('MQTT'); // Valid options: MQTT | PUBSUB

const subscription = broker.getMessageListener$(['TOPIC'], ['messageType']).pipe(
    mergeMap(message => this.processMessage$(message)),
    mergeMap(response => broker.send$('SomeTopic', 'messageType', response))
).subscribe(
    sentId => console.log(sentId),
);

```

## CQRS tools

### build Success Response
Builds an CQRS success response wrapping raw data.
Returns a RxJS Observable stream

### handle Error
gracefully handles an exception on a CQRS request-response stream
Returns a RxJS Observable stream

###  Example:

```js
const { CqrsResponseHelper } = require('@nebulae/backend-node-tools').cqrs;

const { of } = require('rxjs');
const { mergeMap } = require('rxjs/operators');

of('Some CQRS Requet').pipe(
    mergeMap(request => this.processRequest$(request)),
    mergeMap(rawData => CqrsResponseHelper.buildSuccessResponse$(rawRespponse)), // builds a valid CQRS API response
    catchError(err => CqrsResponseHelper.handleError$(err)) // handles Error and generates a valid CQRS API error response
)
```  

## Business Rules Engine
Engine capable of running LUA and JS scripts at runtime

###  Usage: 

#### Instance new Engine
```js
const { BusinessRuleEngine } = require('@nebulae/backend-node-tools');
const businessRuleEngine = new BusinessRuleEngine();
```

#### Search and Load BusinessRule

##### Load pre-defined and stored Business Rule 
```js
const businessRule = await businessRuleEngine.getBusinessRule$(
    type, // Business rule type 
    organizationId, // Organization the rule belongs to
    companyId, // Company the rule belongs to or null if it does not apply
    (filter, projection) => queryBusinessRules$(filter, projection)  // function to search BusinessRule specs
);
```  

##### Build Custom Rule
```js
const customRule = await businessRuleEngine.buildCustomBusinessRule$(
  'CUSTOM_RULE',
  'CustomRuleSample',
  `
    function exec(args)
      return 'Hello from ' .. args[1]
    end
  `,
  'LUA',
  '5.2',
  {}
);
```


#### Execute Business Rule

##### Sync
```js
const args = [1,'A',{a:1}];
const result = businessRule.execute(##### 
  args, // function-to-call arguments
  'exec' // name of the function to call
)
```

##### Async
```js
const args = [1,'A',{a:1}];
const result = await businessRule.execute$(
  args, // function-to-call arguments
  'exec' // name of the function to call
)
```

#### Destroy Business Rule
```js
businessRule.destroy(); // frees up resources
```

### Functions

#### getBusinessRule$(type, organizationId, companyId, queryBusinessRules$)
Prepares and returns a Business Rule object based on the provided type, organization, and company. It uses a cache to avoid re-fetching business rules if a valid (non-expired) rule has already been retrieved.

##### Function Signature
```js
async getBusinessRule$(
  type: string,
  organizationId: string,
  companyId: string,
  queryBusinessRules$: (filter: object, projection: object) => Promise<object[]>
): Promise<BusinessRule>
```  

##### Parameters:

1. type (string): The business rule type you want to load (e.g., "VALIDATION", "PRICING", etc.).
organizationId (string):

2. Identifier for the organization (Operador de Recaudo) that owns or manages these business rules.
companyId (string):

3. Identifier for the transport company (Operador de Transporte).
If it’s not relevant, you can pass null or an empty string, but the function will default it to 'ANY' internally when filtering.
queryBusinessRules$ ((filter: object, projection: object) => Promise<object[]>):

4. A function used to query the data source for business rules.
Signature: Accepts a MongoDB-like filter and projection, returns a Promise that resolves to an array of business rule metadata/specs.
This function is called twice:
First time: to fetch metadata of active & published business rules for the given type/org/company.
Second time: to fetch the entire spec of the chosen rule (by _id) for loading the rule code.

#### execute(args, functionName)
Executes a function by name in the underlying VM/sandbox, passing any necessary arguments.  

##### Function Signature
```js
execute(
  args?: any[],
  functionName?: string
): Promise<any>
```  

##### Parameters:
1. args (Array<any>): A list of arguments to pass into the function. Defaults to an empty array if not provided.

2. functionName (string): The global function name in the sandbox or VM that should be invoked.
Defaults to "exec" if not provided.

##### Returns:
<any>: value returned by the named function.


#### buildCustomBusinessRule$(type, name, source, language, languageVersion, languageArgs)
Prepares and returns a Business Rule object based on the input language and source given

##### Function Signature
```js
async buildCustomBusinessRule$(
  type: string,
  name: string,
  source: string,
  language: string,
  languageVersion: string,
  languageArgs: {object}
  
): Promise<BusinessRule>
```  

##### Parameters:

1. type (string): The business rule type you want to load (e.g., "VALIDATION", "PRICING", etc.)
2. name (String): Business rule name
3. source (String): Business rule source code
4. language (String):Business rule language
5. languageVersion (String):Business rule language version
6. languageArgs (Object): Business rule language arguments

#### execute$(args, functionName)
An asynchronous, Promise-based version of execute. Invokes a named function in the sandbox or VM context and returns the result via a Promise.

##### Function Signature
```js
async execute$(
  args?: any[],
  functionName?: string
): Promise<any>
```  

##### Parameters:
1. args (Array<any>): A list of arguments to pass into the function. Defaults to an empty array if not provided.

2. functionName (string): The global function name in the sandbox or VM that should be invoked.
Defaults to "exec" if not provided.

##### Returns:
Promise<any>: Resolves with the value returned by the named function.
If the function throws or an error occurs, the promise is rejected with the relevant error.


###  Example:

```js
'use strict';

const { BusinessRuleEngine } = require('@nebulae/backend-node-tools');

/* TEST INPUT DATA */
const BusinessRuleDummyDatabase = require('./BusinessRuleDummyDatabase');
const organizationId = "830b9d85-1cad-490a-b376-eb6c6c2c56c2";
const companyId = null;
const testFunctionInputArguments = [
    "ENTRANCE",
      "12345678-aaaa-bbbb-cccc-ddddeeefffff",
      { deviceId: "CATDR-OCC-02", samUuid: "04350e6adb7780", currentTerminalTransactionSeq: 37989, coord: "$GPRMC,..." },
      { id: "itinerary-uuid", pmcId: 60, name: "ItineraryName" },
      { id: "route-uuid", pmcId: 99, name: "RouteName" },
      { code: "PRD_DESFIRE", specs: {} },
      { physicalType: "DESFIRE", id: 89405, uuid: "000000005EEC8866" },
      { id: "profile-uuid", name: "SENA", active: true },
      "AABBCCDD",
      "EEFF0011",
      "11223344"
];


/* playground */
async function test() {
    // intance new engine
    const businessRuleEngine = new BusinessRuleEngine();
    const businessRuleDummyDatabase = new BusinessRuleDummyDatabase();
    
    /* LUA TEST*/
    const luaTestRule = await businessRuleEngine.getBusinessRule$(
        'LUA_TEST', 
        organizationId, 
        companyId, 
        (filter, projection) => businessRuleDummyDatabase.queryBusinessRules$(filter, projection)
    );
    const luaTestResult = await luaTestRule.execute$(testFunctionInputArguments, 'exec')
    console.log('luaTestResult', JSON.stringify(luaTestResult, null, 2));
    
    /* JS TEST */
    const jsTestRule = await businessRuleEngine.getBusinessRule$(
        'JS_TEST', 
        organizationId, 
        companyId, 
        (filter, projection) => businessRuleDummyDatabase.queryBusinessRules$(filter, projection)
    );
    const jsTestResult = await jsTestRule.execute$(testFunctionInputArguments, 'exec')
    console.log('JSTestResult', JSON.stringify(jsTestResult, null, 2));
}

test().catch(console.error);
```