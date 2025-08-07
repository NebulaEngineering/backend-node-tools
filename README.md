![NebulaE](docs/images/nebula.png "Nebula Engineering SAS")

# Backend-Node-Tools

Backend-Node-Tools is a client library with several crosscutting tools for developing micro-backends based on the [NebulaE](https://nebulae.com.co/) Microservices Framework.

- [Installation](#installation)
- [Custom Error](#custom-error)
- [Console Logger](#console-logger)
- [Auth Tools](#auth-tools)
- [Broker Factory](#broker-factory)
- [CQRS tools](#cqrs-tools)
- [Business Rules Engine](#business-rules-engine)
- [Unique ID](#unique-id)

## Installation

```sh
npm install @nebulae/backend-node-tools --save
```

## Custom Error

The `CustomError` class extends the native Node.js `Error` object to create a more structured and informative error format, which is especially useful in a distributed microservices environment. It allows you to include a unique error name, the method where the error occurred, a specific error code, and a descriptive message. This structured data is essential for robust error handling, logging, and creating standardized error responses in a CQRS architecture.

### Constructor

```javascript
new CustomError(name, method, code, message)
```

- **`name`** (`string`): A unique name or identifier for the error (e.g., 'PermissionDenied', 'InvalidInput').
- **`method`** (`string`): The name of the class and method where the error was generated (e.g., 'SomeClass.someMethod'). This provides context for debugging.
- **`code`** (`number`, optional): A specific error code. If not provided, it defaults to `INTERNAL_SERVER_ERROR_CODE` (00001).
- **`message`** (`string`, optional): A human-readable description of the error.

### `getContent()`

This method returns a plain object representation of the error, which is useful for serialization, especially when sending error details in an API response.

**Returns:** `object` - An object with `name`, `code`, and `msg` properties.

### Predefined Error Codes

The module also exports two predefined error codes for common scenarios:

- **`INTERNAL_SERVER_ERROR_CODE` (00001):** A generic code for unexpected server-side errors.
- **`PERMISSION_DENIED` (00002):** A code for authorization-related errors.

### Example

```javascript
const { CustomError, PERMISSION_DENIED } = require('@nebulae/backend-node-tools').error;

// Example 1: Creating a specific error
const invalidInputError = new CustomError(
    'InvalidInput',
    'UserValidator.validateUsername',
    1001,
    'Username contains invalid characters.'
);

// Example 2: Creating a permission error using a predefined code
const permissionError = new CustomError(
    'PermissionDenied',
    'ProductService.deleteProduct',
    PERMISSION_DENIED,
    'User does not have sufficient privileges to delete a product.'
);

try {
  throw permissionError;
} catch (error) {
  if (error instanceof CustomError) {
    console.error(error.getContent());
    // Output: { name: 'PermissionDenied', code: 2, msg: 'User does not have sufficient privileges to delete a product.' }
  }
}
```

## Console Logger

Tools for a standard console logger.

### Environment Variables:

| process.env | desc | values | defaults |
| --- | --- | --- | --- |
| `LOG_LEVEL` | Log Level Threshold | `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` | `WARN` |

### Methods

- `d(message)`: Outputs a DEBUG message to the console.
- `i(message)`: Outputs an INFO message to the console.
- `w(message, err)`: Outputs a WARN message to the console, including error details if provided.
- `e(message, err)`: Outputs an ERROR message to the console, including error details if provided.
- `f(message, err)`: Outputs a FATAL message to the console, including error details if provided.

### Example:

```js
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;
const { CustomError } = require('@nebulae/backend-node-tools').error;

ConsoleLogger.d('This is a DEBUG Log');
ConsoleLogger.i('This is an INFO Log');
ConsoleLogger.w('This is a WARN Log', new CustomError('CustomError', 'Class.Method', 1234, 'A custom warning'));
ConsoleLogger.e('This is an ERROR Log', new CustomError('CustomError', 'Class.Method', 1234, 'A custom error'));
ConsoleLogger.f('This is a FATAL Log', new Error('Native Node Error'));

// Example log format for the WARN call:
// 2019-06-01T03:49:20.907Z [WARN]: This is a WARN Log;  ERROR(1234): A custom warning
```

## Auth Tools

### User roles verification

Checks if the user has the required roles.

#### `verifyRoles$(userRoles, method, error, requiredRoles)`

- **`userRoles`**: `[string]` - The roles of the authenticated user.
- **`method`**: `string` - The name of the method where the validation is being performed.
- **`error`**: `CustomError` - The error to throw if the validation fails.
- **`requiredRoles`**: `[string]` - The roles required to perform the action.

#### `hasRoles(userRoles, requiredRoles)`

- **`userRoles`**: `[string]` - The roles of the user.
- **`requiredRoles`**: `[string]` - The required roles.

#### Example:

```js
const { RoleValidator } = require('@nebulae/backend-node-tools').auth;
const { CustomError, PERMISSION_DENIED } = require('@nebulae/backend-node-tools').error;

const userRoles = ['OPERATOR', 'PLATFORM-ADMIN', 'BUSINESS-OWNER'];
const neededRoles = ['PLATFORM-ADMIN', 'SYSADMIN'];
const permissionDeniedError = new CustomError('PermissionDenied', 'test.mocha', PERMISSION_DENIED, 'The user does not have the needed roles to execute this task');

RoleValidator.verifyRoles$(
    userRoles, 
    'SomeClass.SomeMethod',
    permissionDeniedError, 
    neededRoles
).subscribe(
    (response) => {
        // Outputs: { 'PLATFORM-ADMIN': true, 'SYSADMIN': false }
        console.log(JSON.stringify(response));
    },
    (err) => console.error(err.getContent())
);

const hasNeededRoles = RoleValidator.hasRoles(userRoles, neededRoles);
// hasNeededRoles is true
```

## Broker Factory

Creates a MQTT, Google Cloud PubSub or NATS JetStream Broker based on RxJS with pre-build functions for listening and sending messages.

### Environment Variables:

| process.env | desc | values | defaults |
| --- | --- | --- | --- |
| `BROKER_TYPE` | Default broker to use | `MQTT`, `PUBSUB`, `NATS_JETSTREAM` | N/A |
| `GOOGLE_APPLICATION_CREDENTIALS` | gcloud-service-key json file to configure PubSub | path to json file | N/A |
| `MICROBACKEND_KEY` | The MicroBackend unique Key is used as PubSub Subscription suffix | e.g., `ms-my-service_mbe_my-service` | `default-suffix` |
| `MQTT_SERVER_URL` | mqtt server URL | `mqtt://host:port` | N/A |
| `NATS_SERVER_URL` | nats server URL | `nats://host:port` | N/A |
| `REPLY_TIMEOUT` | send & receive response timeout millis | milliseconds (number) | 2000 |

### Example:

```js
const { brokerFactory } = require('@nebulae/backend-node-tools').broker;

// generates a multiton instance
const broker = brokerFactory('MQTT'); // Valid options: MQTT | PUBSUB | NATS_JETSTREAM

const subscription = broker.getMessageListener$(['MY_TOPIC'], ['MyMessageType']).pipe(
    mergeMap(message => this.processMessage$(message)),
    mergeMap(response => broker.send$('MY_RESPONSE_TOPIC', 'MyResponseType', response))
).subscribe(
    sentId => console.log(`Message sent with ID: ${sentId}`),
    error => console.error('An error occurred:', error)
);
```

## CQRS tools

### `buildSuccessResponse$(rawResponse)`

Builds a CQRS success response, wrapping the provided data.

- **`rawResponse`**: `any` - The raw response data.

### `handleError$(err)`

Gracefully handles an exception in a CQRS stream, converting it to a standard error response.

- **`err`**: `Error` | `CustomError` - The error to handle.

### Example:

```js
const { CqrsResponseHelper } = require('@nebulae/backend-node-tools').cqrs;
const { of } = require('rxjs');
const { mergeMap, catchError } = require('rxjs/operators');

of('Some CQRS Request').pipe(
    mergeMap(request => this.processRequest$(request)),
    mergeMap(rawData => CqrsResponseHelper.buildSuccessResponse$(rawData)), // builds a valid CQRS API response
    catchError(err => CqrsResponseHelper.handleError$(err)) // handles and formats the error
).subscribe(response => console.log(response));
```

## Business Rules Engine

The Business Rules Engine is a powerful component that allows you to execute dynamic business logic at runtime. It supports both Lua and JavaScript scripts, which can be loaded from a database or built on-the-fly. This enables you to modify business logic without redeploying your microservice, providing a high degree of flexibility and agility.

### Core Concepts

- **Business Rule:** A piece of logic that encapsulates a business policy or decision. Each rule is executed in a sandboxed environment to ensure security and isolation.
- **VM (Virtual Machine):** The engine uses a dedicated VM for each scripting language (Lua or JavaScript) to execute the rule's source code.
- **Caching:** To optimize performance, the engine caches loaded business rules. The cache has a Time-to-Live (TTL) of 12 hours by default, but this can be configured via the `BUSINESS_RULE_CACHE_TTL` environment variable.

### `BusinessRuleEngine` Class

This is the main class for interacting with the rules engine.

#### `getBusinessRule$(type, organizationId, companyId, queryBusinessRules$, context = {})`

Fetches, prepares, and returns a `BusinessRule` object. It first checks the cache for a valid (non-expired) rule. If not found, it queries the rule's metadata and source code using the provided `queryBusinessRules

# Backend-Node-Tools

Backend-Node-Tools is a client library with several crosscutting tools for developing micro-backends based on the [NebulaE](https://nebulae.com.co/) Microservices Framework.

- [Installation](#installation)
- [Custom Error](#custom-error)
- [Console Logger](#console-logger)
- [Auth Tools](#auth-tools)
- [Broker Factory](#broker-factory)
- [CQRS tools](#cqrs-tools)
- [Business Rules Engine](#business-rules-engine)
- [Unique ID](#unique-id)

## Installation

```sh
npm install @nebulae/backend-node-tools --save
```

## Custom Error

The `CustomError` class extends the native Node.js `Error` object to create a more structured and informative error format, which is especially useful in a distributed microservices environment. It allows you to include a unique error name, the method where the error occurred, a specific error code, and a descriptive message. This structured data is essential for robust error handling, logging, and creating standardized error responses in a CQRS architecture.

### Constructor

```javascript
new CustomError(name, method, code, message)
```

- **`name`** (`string`): A unique name or identifier for the error (e.g., 'PermissionDenied', 'InvalidInput').
- **`method`** (`string`): The name of the class and method where the error was generated (e.g., 'SomeClass.someMethod'). This provides context for debugging.
- **`code`** (`number`, optional): A specific error code. If not provided, it defaults to `INTERNAL_SERVER_ERROR_CODE` (00001).
- **`message`** (`string`, optional): A human-readable description of the error.

### `getContent()`

This method returns a plain object representation of the error, which is useful for serialization, especially when sending error details in an API response.

**Returns:** `object` - An object with `name`, `code`, and `msg` properties.

### Predefined Error Codes

The module also exports two predefined error codes for common scenarios:

- **`INTERNAL_SERVER_ERROR_CODE` (00001):** A generic code for unexpected server-side errors.
- **`PERMISSION_DENIED` (00002):** A code for authorization-related errors.

### Example

```javascript
const { CustomError, PERMISSION_DENIED } = require('@nebulae/backend-node-tools').error;

// Example 1: Creating a specific error
const invalidInputError = new CustomError(
    'InvalidInput',
    'UserValidator.validateUsername',
    1001,
    'Username contains invalid characters.'
);

// Example 2: Creating a permission error using a predefined code
const permissionError = new CustomError(
    'PermissionDenied',
    'ProductService.deleteProduct',
    PERMISSION_DENIED,
    'User does not have sufficient privileges to delete a product.'
);

try {
  throw permissionError;
} catch (error) {
  if (error instanceof CustomError) {
    console.error(error.getContent());
    // Output: { name: 'PermissionDenied', code: 2, msg: 'User does not have sufficient privileges to delete a product.' }
  }
}
```

## Console Logger

Tools for a standard console logger.

### Environment Variables:

| process.env | desc | values | defaults |
| --- | --- | --- | --- |
| `LOG_LEVEL` | Log Level Threshold | `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` | `WARN` |

### Methods

- `d(message)`: Outputs a DEBUG message to the console.
- `i(message)`: Outputs an INFO message to the console.
- `w(message, err)`: Outputs a WARN message to the console, including error details if provided.
- `e(message, err)`: Outputs an ERROR message to the console, including error details if provided.
- `f(message, err)`: Outputs a FATAL message to the console, including error details if provided.

### Example:

```js
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;
const { CustomError } = require('@nebulae/backend-node-tools').error;

ConsoleLogger.d('This is a DEBUG Log');
ConsoleLogger.i('This is an INFO Log');
ConsoleLogger.w('This is a WARN Log', new CustomError('CustomError', 'Class.Method', 1234, 'A custom warning'));
ConsoleLogger.e('This is an ERROR Log', new CustomError('CustomError', 'Class.Method', 1234, 'A custom error'));
ConsoleLogger.f('This is a FATAL Log', new Error('Native Node Error'));

// Example log format for the WARN call:
// 2019-06-01T03:49:20.907Z [WARN]: This is a WARN Log;  ERROR(1234): A custom warning
```

## Auth Tools

### User roles verification

Checks if the user has the required roles.

#### `verifyRoles$(userRoles, method, error, requiredRoles)`

- **`userRoles`**: `[string]` - The roles of the authenticated user.
- **`method`**: `string` - The name of the method where the validation is being performed.
- **`error`**: `CustomError` - The error to throw if the validation fails.
- **`requiredRoles`**: `[string]` - The roles required to perform the action.

#### `hasRoles(userRoles, requiredRoles)`

- **`userRoles`**: `[string]` - The roles of the user.
- **`requiredRoles`**: `[string]` - The required roles.

#### Example:

```js
const { RoleValidator } = require('@nebulae/backend-node-tools').auth;
const { CustomError, PERMISSION_DENIED } = require('@nebulae/backend-node-tools').error;

const userRoles = ['OPERATOR', 'PLATFORM-ADMIN', 'BUSINESS-OWNER'];
const neededRoles = ['PLATFORM-ADMIN', 'SYSADMIN'];
const permissionDeniedError = new CustomError('PermissionDenied', 'test.mocha', PERMISSION_DENIED, 'The user does not have the needed roles to execute this task');

RoleValidator.verifyRoles$(
    userRoles, 
    'SomeClass.SomeMethod',
    permissionDeniedError, 
    neededRoles
).subscribe(
    (response) => {
        // Outputs: { 'PLATFORM-ADMIN': true, 'SYSADMIN': false }
        console.log(JSON.stringify(response));
    },
    (err) => console.error(err.getContent())
);

const hasNeededRoles = RoleValidator.hasRoles(userRoles, neededRoles);
// hasNeededRoles is true
```

## Broker Factory

Creates a MQTT, Google Cloud PubSub or NATS JetStream Broker based on RxJS with pre-build functions for listening and sending messages.

### Environment Variables:

| process.env | desc | values | defaults |
| --- | --- | --- | --- |
| `BROKER_TYPE` | Default broker to use | `MQTT`, `PUBSUB`, `NATS_JETSTREAM` | N/A |
| `GOOGLE_APPLICATION_CREDENTIALS` | gcloud-service-key json file to configure PubSub | path to json file | N/A |
| `MICROBACKEND_KEY` | The MicroBackend unique Key is used as PubSub Subscription suffix | e.g., `ms-my-service_mbe_my-service` | `default-suffix` |
| `MQTT_SERVER_URL` | mqtt server URL | `mqtt://host:port` | N/A |
| `NATS_SERVER_URL` | nats server URL | `nats://host:port` | N/A |
| `REPLY_TIMEOUT` | send & receive response timeout millis | milliseconds (number) | 2000 |

### Example:

```js
const { brokerFactory } = require('@nebulae/backend-node-tools').broker;

// generates a multiton instance
const broker = brokerFactory('MQTT'); // Valid options: MQTT | PUBSUB | NATS_JETSTREAM

const subscription = broker.getMessageListener$(['MY_TOPIC'], ['MyMessageType']).pipe(
    mergeMap(message => this.processMessage$(message)),
    mergeMap(response => broker.send$('MY_RESPONSE_TOPIC', 'MyResponseType', response))
).subscribe(
    sentId => console.log(`Message sent with ID: ${sentId}`),
    error => console.error('An error occurred:', error)
);
```

## CQRS tools

### `buildSuccessResponse$(rawResponse)`

Builds a CQRS success response, wrapping the provided data.

- **`rawResponse`**: `any` - The raw response data.

### `handleError$(err)`

Gracefully handles an exception in a CQRS stream, converting it to a standard error response.

- **`err`**: `Error` | `CustomError` - The error to handle.

### Example:

```js
const { CqrsResponseHelper } = require('@nebulae/backend-node-tools').cqrs;
const { of } = require('rxjs');
const { mergeMap, catchError } = require('rxjs/operators');

of('Some CQRS Request').pipe(
    mergeMap(request => this.processRequest$(request)),
    mergeMap(rawData => CqrsResponseHelper.buildSuccessResponse$(rawData)), // builds a valid CQRS API response
    catchError(err => CqrsResponseHelper.handleError$(err)) // handles and formats the error
).subscribe(response => console.log(response));
```

## Business Rules Engine

The Business Rules Engine is a powerful component that allows you to execute dynamic business logic at runtime. It supports both Lua and JavaScript scripts, which can be loaded from a database or built on-the-fly. This enables you to modify business logic without redeploying your microservice, providing a high degree of flexibility and agility.

### Core Concepts

- **Business Rule:** A piece of logic that encapsulates a business policy or decision. Each rule is executed in a sandboxed environment to ensure security and isolation.
- **VM (Virtual Machine):** The engine uses a dedicated VM for each scripting language (Lua or JavaScript) to execute the rule's source code.
- **Caching:** To optimize performance, the engine caches loaded business rules. The cache has a Time-to-Live (TTL) of 12 hours by default, but this can be configured via the `BUSINESS_RULE_CACHE_TTL` environment variable.

 function, creates a new `BusinessRule` instance, and caches it.

- **`type`** (`string`): The type of the business rule (e.g., 'VALIDATION', 'PRICING').
- **`organizationId`** (`string`): The ID of the organization that owns the rule.
- **`companyId`** (`string`): The ID of the company the rule applies to. Can be `null`.
- **`queryBusinessRules`

# Backend-Node-Tools

Backend-Node-Tools is a client library with several crosscutting tools for developing micro-backends based on the [NebulaE](https://nebulae.com.co/) Microservices Framework.

- [Installation](#installation)
- [Custom Error](#custom-error)
- [Console Logger](#console-logger)
- [Auth Tools](#auth-tools)
- [Broker Factory](#broker-factory)
- [CQRS tools](#cqrs-tools)
- [Business Rules Engine](#business-rules-engine)
- [Unique ID](#unique-id)

## Installation

```sh
npm install @nebulae/backend-node-tools --save
```

## Custom Error

The `CustomError` class extends the native Node.js `Error` object to create a more structured and informative error format, which is especially useful in a distributed microservices environment. It allows you to include a unique error name, the method where the error occurred, a specific error code, and a descriptive message. This structured data is essential for robust error handling, logging, and creating standardized error responses in a CQRS architecture.

### Constructor

```javascript
new CustomError(name, method, code, message)
```

- **`name`** (`string`): A unique name or identifier for the error (e.g., 'PermissionDenied', 'InvalidInput').
- **`method`** (`string`): The name of the class and method where the error was generated (e.g., 'SomeClass.someMethod'). This provides context for debugging.
- **`code`** (`number`, optional): A specific error code. If not provided, it defaults to `INTERNAL_SERVER_ERROR_CODE` (00001).
- **`message`** (`string`, optional): A human-readable description of the error.

### `getContent()`

This method returns a plain object representation of the error, which is useful for serialization, especially when sending error details in an API response.

**Returns:** `object` - An object with `name`, `code`, and `msg` properties.

### Predefined Error Codes

The module also exports two predefined error codes for common scenarios:

- **`INTERNAL_SERVER_ERROR_CODE` (00001):** A generic code for unexpected server-side errors.
- **`PERMISSION_DENIED` (00002):** A code for authorization-related errors.

### Example

```javascript
const { CustomError, PERMISSION_DENIED } = require('@nebulae/backend-node-tools').error;

// Example 1: Creating a specific error
const invalidInputError = new CustomError(
    'InvalidInput',
    'UserValidator.validateUsername',
    1001,
    'Username contains invalid characters.'
);

// Example 2: Creating a permission error using a predefined code
const permissionError = new CustomError(
    'PermissionDenied',
    'ProductService.deleteProduct',
    PERMISSION_DENIED,
    'User does not have sufficient privileges to delete a product.'
);

try {
  throw permissionError;
} catch (error) {
  if (error instanceof CustomError) {
    console.error(error.getContent());
    // Output: { name: 'PermissionDenied', code: 2, msg: 'User does not have sufficient privileges to delete a product.' }
  }
}
```

## Console Logger

Tools for a standard console logger.

### Environment Variables:

| process.env | desc | values | defaults |
| --- | --- | --- | --- |
| `LOG_LEVEL` | Log Level Threshold | `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` | `WARN` |

### Methods

- `d(message)`: Outputs a DEBUG message to the console.
- `i(message)`: Outputs an INFO message to the console.
- `w(message, err)`: Outputs a WARN message to the console, including error details if provided.
- `e(message, err)`: Outputs an ERROR message to the console, including error details if provided.
- `f(message, err)`: Outputs a FATAL message to the console, including error details if provided.

### Example:

```js
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;
const { CustomError } = require('@nebulae/backend-node-tools').error;

ConsoleLogger.d('This is a DEBUG Log');
ConsoleLogger.i('This is an INFO Log');
ConsoleLogger.w('This is a WARN Log', new CustomError('CustomError', 'Class.Method', 1234, 'A custom warning'));
ConsoleLogger.e('This is an ERROR Log', new CustomError('CustomError', 'Class.Method', 1234, 'A custom error'));
ConsoleLogger.f('This is a FATAL Log', new Error('Native Node Error'));

// Example log format for the WARN call:
// 2019-06-01T03:49:20.907Z [WARN]: This is a WARN Log;  ERROR(1234): A custom warning
```

## Auth Tools

### User roles verification

Checks if the user has the required roles.

#### `verifyRoles$(userRoles, method, error, requiredRoles)`

- **`userRoles`**: `[string]` - The roles of the authenticated user.
- **`method`**: `string` - The name of the method where the validation is being performed.
- **`error`**: `CustomError` - The error to throw if the validation fails.
- **`requiredRoles`**: `[string]` - The roles required to perform the action.

#### `hasRoles(userRoles, requiredRoles)`

- **`userRoles`**: `[string]` - The roles of the user.
- **`requiredRoles`**: `[string]` - The required roles.

#### Example:

```js
const { RoleValidator } = require('@nebulae/backend-node-tools').auth;
const { CustomError, PERMISSION_DENIED } = require('@nebulae/backend-node-tools').error;

const userRoles = ['OPERATOR', 'PLATFORM-ADMIN', 'BUSINESS-OWNER'];
const neededRoles = ['PLATFORM-ADMIN', 'SYSADMIN'];
const permissionDeniedError = new CustomError('PermissionDenied', 'test.mocha', PERMISSION_DENIED, 'The user does not have the needed roles to execute this task');

RoleValidator.verifyRoles$(
    userRoles, 
    'SomeClass.SomeMethod',
    permissionDeniedError, 
    neededRoles
).subscribe(
    (response) => {
        // Outputs: { 'PLATFORM-ADMIN': true, 'SYSADMIN': false }
        console.log(JSON.stringify(response));
    },
    (err) => console.error(err.getContent())
);

const hasNeededRoles = RoleValidator.hasRoles(userRoles, neededRoles);
// hasNeededRoles is true
```

## Broker Factory

Creates a MQTT, Google Cloud PubSub or NATS JetStream Broker based on RxJS with pre-build functions for listening and sending messages.

### Environment Variables:

| process.env | desc | values | defaults |
| --- | --- | --- | --- |
| `BROKER_TYPE` | Default broker to use | `MQTT`, `PUBSUB`, `NATS_JETSTREAM` | N/A |
| `GOOGLE_APPLICATION_CREDENTIALS` | gcloud-service-key json file to configure PubSub | path to json file | N/A |
| `MICROBACKEND_KEY` | The MicroBackend unique Key is used as PubSub Subscription suffix | e.g., `ms-my-service_mbe_my-service` | `default-suffix` |
| `MQTT_SERVER_URL` | mqtt server URL | `mqtt://host:port` | N/A |
| `NATS_SERVER_URL` | nats server URL | `nats://host:port` | N/A |
| `REPLY_TIMEOUT` | send & receive response timeout millis | milliseconds (number) | 2000 |

### Example:

```js
const { brokerFactory } = require('@nebulae/backend-node-tools').broker;

// generates a multiton instance
const broker = brokerFactory('MQTT'); // Valid options: MQTT | PUBSUB | NATS_JETSTREAM

const subscription = broker.getMessageListener$(['MY_TOPIC'], ['MyMessageType']).pipe(
    mergeMap(message => this.processMessage$(message)),
    mergeMap(response => broker.send$('MY_RESPONSE_TOPIC', 'MyResponseType', response))
).subscribe(
    sentId => console.log(`Message sent with ID: ${sentId}`),
    error => console.error('An error occurred:', error)
);
```

## CQRS tools

### `buildSuccessResponse$(rawResponse)`

Builds a CQRS success response, wrapping the provided data.

- **`rawResponse`**: `any` - The raw response data.

### `handleError$(err)`

Gracefully handles an exception in a CQRS stream, converting it to a standard error response.

- **`err`**: `Error` | `CustomError` - The error to handle.

### Example:

```js
const { CqrsResponseHelper } = require('@nebulae/backend-node-tools').cqrs;
const { of } = require('rxjs');
const { mergeMap, catchError } = require('rxjs/operators');

of('Some CQRS Request').pipe(
    mergeMap(request => this.processRequest$(request)),
    mergeMap(rawData => CqrsResponseHelper.buildSuccessResponse$(rawData)), // builds a valid CQRS API response
    catchError(err => CqrsResponseHelper.handleError$(err)) // handles and formats the error
).subscribe(response => console.log(response));
```

## Business Rules Engine

The Business Rules Engine is a powerful component that allows you to execute dynamic business logic at runtime. It supports both Lua and JavaScript scripts, which can be loaded from a database or built on-the-fly. This enables you to modify business logic without redeploying your microservice, providing a high degree of flexibility and agility.

### Core Concepts

- **Business Rule:** A piece of logic that encapsulates a business policy or decision. Each rule is executed in a sandboxed environment to ensure security and isolation.
- **VM (Virtual Machine):** The engine uses a dedicated VM for each scripting language (Lua or JavaScript) to execute the rule's source code.
- **Caching:** To optimize performance, the engine caches loaded business rules. The cache has a Time-to-Live (TTL) of 12 hours by default, but this can be configured via the `BUSINESS_RULE_CACHE_TTL` environment variable.

** (`(filter, projection) => Promise<object[]>`): An async function that fetches business rule data from a database. It should accept a MongoDB-style filter and projection.
- **`context`** (`object`, optional): A context object to be injected into the rule's execution environment.

**Returns:** `Promise<BusinessRule>` - A promise that resolves to a `BusinessRule` instance.

#### `buildCustomBusinessRule$(type, name, source, language, languageVersion, languageArgs, otherSources)`

Creates a `BusinessRule` instance from a raw source string, without fetching it from a database. This is useful for testing or for rules that are generated dynamically.

- **`type`** (`string`): The type of the rule.
- **`name`** (`string`): The name of the rule.
- **`source`** (`string`): The rule's source code.
- **`language`** (`string`): The scripting language ('LUA' or 'JAVASCRIPT').
- **`languageVersion`** (`string`): The language version.
- **`languageArgs`** (`object`): Language-specific arguments.
- **`otherSources`** (`any`): Any other sources to be loaded into the VM.

**Returns:** `Promise<BusinessRule>` - A promise that resolves to a `BusinessRule` instance.

### `BusinessRule` Class

Represents a single, executable business rule.

#### `execute(args, functionName)`

Synchronously executes a function within the rule's script.

- **`args`** (`any[]`, optional): An array of arguments to pass to the function.
- **`functionName`** (`string`, optional): The name of the function to execute. Defaults to `exec`.

**Returns:** `any` - The value returned by the executed function.

#### `execute$(args, functionName)`

Asynchronously executes a function within the rule's script.

- **`args`** (`any[]`, optional): An array of arguments to pass to the function.
- **`functionName`** (`string`, optional): The name of the function to execute. Defaults to `exec`.

**Returns:** `Promise<any>` - A promise that resolves with the value returned by the executed function.

#### `destroy()`

Cleans up the resources associated with the business rule's execution environment (VM). It is important to call this method when the business rule is no longer needed to prevent memory leaks.

**Usage:**

```javascript
businessRule.destroy(); // Frees up resources
```

### Examples

#### JavaScript Example

```javascript
const { BusinessRuleEngine } = require('@nebulae/backend-node-tools');

async function runJsRule() {
    const businessRuleEngine = new BusinessRuleEngine();

    const jsRuleSource = `
        function exec(args) {
            const [a, b] = args;
            return { result: a + b, engine: 'JavaScript' };
        }
    `;

    const customJsRule = await businessRuleEngine.buildCustomBusinessRule$(
        'CUSTOM_JAVASCRIPT_RULE',
        'JsAdditionRule',
        jsRuleSource,
        'JAVASCRIPT',
        '1.0',
        {}
    );

    const result = await customJsRule.execute$([10, 20]);
    console.log('JAVASCRIPT Rule Result:', result);
    // Expected Output: JAVASCRIPT Rule Result: { result: 30, engine: 'JavaScript' }
}

runJsRule().catch(console.error);
```

#### Lua Example

```javascript
const { BusinessRuleEngine } = require('@nebulae/backend-node-tools');

async function runLuaRule() {
    const businessRuleEngine = new BusinessRuleEngine();

    const luaRuleSource = `
        function exec(args)
            local a = args[1]
            local b = args[2]
            return { result = a * b, engine = "Lua" }
        end
    `;

    const customLuaRule = await businessRuleEngine.buildCustomBusinessRule$(
        'CUSTOM_LUA_RULE',
        'LuaMultiplicationRule',
        luaRuleSource,
        'LUA',
        '5.2',
        {}
    );

    const result = await customLuaRule.execute$([10, 5]);
    console.log('Lua Rule Result:', result);
    // Expected Output: Lua Rule Result: { result: 50, engine: 'Lua' }
}

runLuaRule().catch(console.error);
```

## Unique ID

### `generate(time)`

- **`time`**: `number` - (Optional) Timestamp in seconds or milliseconds.

### `generateUInt64BE(time)`

- **`time`**: `number` - (Optional) Timestamp.

### `generateHex(time)`

- **`time`**: `number` - (Optional) Timestamp.

### Example:

```js
const { uniqueId } = require('@nebulae/backend-node-tools');

const idBuffer = uniqueId.generate();
const idBigInt = uniqueId.generateUInt64BE();
const idHex = uniqueId.generateHex();

console.log('Buffer:', idBuffer);
console.log('BigInt:', idBigInt);
console.log('Hex:', idHex);
```
