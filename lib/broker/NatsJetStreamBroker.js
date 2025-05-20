const Nats = require('nats');
const { BehaviorSubject, from, defer, EMPTY, timer, Observable } = require('rxjs');
const {
  filter,
  map,
  timeout,
  first,
  switchMap,
  mapTo,
  mergeMap,
  reduce,
  mergeMapTo,
  defaultIfEmpty,
  tap,
  catchError
} = require('rxjs/operators');
const uuidv4 = require('uuid').v4;
const os = require('os');
const { ConsoleLogger } = require('../log');
const { ReplaySubject } = require('rxjs');
const { CustomError } = require('../error');
const { toArray } = require('lodash');

// Read environmental variables; defaults provided where appropriate
const DEFAULT_MAX_UNACK_MESSAGES = parseInt(process.env.NATSJS_MAX_UNACK_MESSAGES, 10) || 100;

class NatsJetStreamBroker {
  /**
   * Constructor for NatsJetStreamBroker.
   * @param {Object} options
   * @param {string} options.natsServerUrl - NATS server URL. Defaults to "nats://localhost:4222".
   * @param {number} options.replyTimeout - Timeout for replies in milliseconds.
   * @param {string} [options.topicPrefix] - A prefix for subjects.
   * @param {Object} [options.connOps] - Additional connection options for NATS.
   */
  constructor({ natsServerUrl, replyTimeout, topicPrefix = '', connOps = {} } = {}) {
    this.natsServerUrl = natsServerUrl || "nats://localhost:4222";
    this.senderId = os.hostname();
    this.replyTimeout = replyTimeout || 5000;
    this.topicPrefix = topicPrefix;
    this.connOps = connOps;

    // Cached subjects
    this.verifiedStreams = {};

    // Flow control properties
    this.maxUnacknowledged = DEFAULT_MAX_UNACK_MESSAGES;
    this.unacknowledgedCount = 0;

    // RxJS subject to emit incoming messages
    this.incomingMessages$ = new BehaviorSubject(null);
    // Track which subjects have been subscribed to
    this.listeningSubjects = [];

    // Placeholders for the NATS connection and JetStream client
    this.nc = null;
    this.js = null;
    // Start the connection (could also be triggered externally)
    // Subscription control
    this.subscriptionReady = {};
  }

  start$(streamName, subjects = [], streamOptions = {}) {
    return new Observable(async observer => {
      // (async () => {
      try {
        ConsoleLogger.i(`Connecting to NATS server: ${this.natsServerUrl}`);
        this.nc = await Nats.connect({ servers: this.natsServerUrl, ...this.connOps });
        this.jsm = await this.nc.jetstreamManager();
        this.js = this.nc.jetstream();

        if (
          streamName &&
          Array.isArray(subjects) &&
          subjects.length > 0
        ) {
          this.streamName = streamName;
          await this.createStream(streamName, subjects, streamOptions);
        }

        ConsoleLogger.i(`Connected to NATS server: ${this.natsServerUrl}`);
        observer.next(`Connected to NATS server: ${this.natsServerUrl}`);
        observer.complete();
      } catch (err) {
        ConsoleLogger.e("Error in start$():", err);
        observer.error(err);
      }
      // })();
    });
  }

  /**
   * Publishes a message to the given subject and returns an Observable that resolves to the message ID.
   * @param {string} topicName - The subject to publish on.
   * @param {string} type - The type of message.
   * @param {Object} data - The message payload.
   * @param {Object} param1 - Options: correlationId and messageId.
   */
  publish$(
    subject,
    type,
    data,
    { correlationId, messageId } = {}
  ) {
    const uuid = messageId || uuidv4();
    const envelope = {
      id: uuid,
      type,
      data,
      attributes: {
        senderId: this.senderId,
        correlationId,
      }
    };
    const payload = Buffer.from(JSON.stringify(envelope));

    return defer(async () => {
      await this.js.publish(subject, payload);
      return uuid;
    });
  }

  /**
   * Ensures that the specified subjects are included in the stream configuration.
   * If the subjects are already present in the stream, no changes are made.
   * Otherwise, the stream is updated to include the provided subjects.
   *
   * @param {string[]} subjects - An array of subject names to ensure in the stream.
   * @returns {Observable<string>} An observable that emits the name of the stream after ensuring the subjects.
   */
  ensureSubjectInStream$(subjects) {
    return defer(async () => {
      const streamInfo = await this.jsm.streams.info(this.streamName);
      const currentSubjects = streamInfo.config.subjects;

      // Verify if the subject already exists in the stream
      const areEqual = currentSubjects.length === subjects.length &&
          currentSubjects.every(sub => subjects.includes(sub));      
      if (areEqual) {
        return this.streamName;
      }

      const newSubjects = subjects.filter(sub => !currentSubjects.includes(sub));
      if (newSubjects.length === 0) {
        return this.streamName;
      }
      // Create a new array of subjects
      const updatedSubjects = [...currentSubjects, ...newSubjects];
      // Remove duplicates
      const uniqueSubjects = [...new Set(updatedSubjects)];

      // Update the stream with the new subject
      await this.jsm.streams.update(this.streamName, {
        ...streamInfo.config,
        subjects: uniqueSubjects
      })

      ConsoleLogger.i(`Subjects "${subjects.join(', ')}" added to "${this.streamName}"`);
      return this.streamName;
    });
  }


  /**
   * Sends a message to the given subject.
   * @param {string} subject - The subject to send the message.
   * @param {string} type - The type of message.
   * @param {Object} payload - The message payload.
   * @param {Object} [ops={}] - Options: correlationId and messageId.
   */
  send$(
    subject,
    type,
    payload,
    subjects,
    ops = {}
  ) {
    return this.ensureSubjectInStream$(subjects ?? []).pipe(
      switchMap(() => this.publish$(subject, type, payload, ops))
    )
  }

  /**
   * Creates a JetStream stream if it does not already exist.
   *
   * @async
   * @param {string} streamName - The name of the stream to create.
   * @param {string[]} subjects - An array of subjects to associate with the stream.
   * @param {Object} [streamOptions={}] - Optional configuration for the stream.
   * @param {string} [streamOptions.retention="limits"] - The retention policy for the stream (e.g., "limits").
   * @param {string} [streamOptions.storage="file"] - The storage type for the stream (e.g., "file" or "memory").
   * @param {number} [streamOptions.max_msgs=1000] - The maximum number of messages the stream can hold.
   * @param {number} [streamOptions.max_bytes=1073741824] - The maximum size of the stream in bytes (default is 1GB).
   * @returns {Promise<void>} Resolves when the stream is created or already exists.
   * @throws {Error} Throws an error if there is an issue creating the stream.
   */
  async createStream(streamName, subjects, streamOptions = {}) {
    if(this.verifiedStreams[streamName]) {
      return;
    }
    // Check if the stream already exists
    try {
      const streamInfo = await this.jsm.streams.info(streamName);
      if (streamInfo) {
        return;
      }      
    } catch (error) {
      if (error.code === '404') {
        // Create the stream
        await this.jsm.streams.add({
          name: streamName,
          subjects,
          retention: streamOptions?.limits ?? "limits",
          storage: streamOptions?.storage ?? "file",
          max_msgs: streamOptions?.max_msgs ?? 1000,
          max_bytes: streamOptions?.max_msgs ?? 1073741824 // 1GB
        }).catch(err => {
          ConsoleLogger.e(`Error creating stream: ${err}`);          
          this.verifiedStreams[streamName] = false;
          return;
        });
    
        // Mark the subject as verified
        this.verifiedStreams[streamName] = true;
      }
    }
  }

  // async consumerExists(durableName) {
  //   try {
  //     const info = await this.jsm.consumers.info(this.streamName, durableName);
  //     return info !== undefined;
  //   } catch (err) {
  //     if (err.code === '404') {
  //       return false;
  //     }
  //     throw err; // Otro error real
  //   }
  // };

  /**
   * Sends a message and waits for a reply.
   * @param {string} subject - The subject to send the message.
   * @param {string} responseSubject - The subject on which to wait for a reply.
   * @param {Object} payload - The message payload.
   * @param {number} [timeoutVal=this.replyTimeout] - Timeout in milliseconds.
   * @param {boolean} [ignoreSelfEvents=true] - Whether to ignore messages from self.
   * @param {Object} [ops={}] - Options: correlationId and messageId.
   */
  sendAndGetReply$({
    subject,
    responseSubject,
    type,
    payload,
    timeoutVal = this.replyTimeout,
    ignoreSelfEvents = true,
    ops = {},
    subjects
  }) {
    const correlationId = ops.correlationId || payload.correlationId;
    const messageId = ops.messageId || payload.messageId;

    return defer(() => {
      let reply$;

      return this.ensureSubjectInStream$([responseSubject]).pipe(
        switchMap(() => {
          // Prepare a cold observable for the reply
          reply$ = this.getMessageReply$(
            responseSubject,
            correlationId,
            timeoutVal,
            ignoreSelfEvents
          );

          // Send message
          return this.send$(
            subject,
            type,
            payload,
            subjects,
            { correlationId, messageId }
          );
        }),
        // After sending the message, wait for the reply and return the reply observable
        switchMap(() => reply$)
      );
    });
  }

  /**
   * Returns an Observable that waits for a message reply filtered by correlationId.
   * @param {string} subject - The subject to listen on.
   * @param {string} correlationId - The correlation ID to match.
   * @param {number} [timeoutVal=this.replyTimeout] - Timeout in milliseconds.
   * @param {boolean} [ignoreSelfEvents=true] - Whether to ignore messages from self.
   */
  getMessageReply$(
    subject,
    correlationId,
    timeoutVal = this.replyTimeout,
    ignoreSelfEvents = true
  ) {
    return this.configMessageListener$([subject], ignoreSelfEvents).pipe(
      switchMap(() => this.subscriptionReady[subject].pipe(first())),
      switchMap(() => 
        this.incomingMessages$.pipe(
          tap(msg => { 
            const conditions = {
              1: msg !== null,
              2: !ignoreSelfEvents || msg.attributes.senderId !== this.senderId,
              3: msg && (msg?.attributes?.correlationId || msg?.correlationId) === correlationId
            }
          }),
          filter(msg => msg !== null),
          filter(msg => !ignoreSelfEvents || msg.attributes.senderId !== this.senderId),
          filter(msg => msg && (msg?.attributes?.correlationId || msg?.correlationId) === correlationId),
          map(msg => msg.data),
          timeout(timeoutVal),
          first()
        )
      )
    );
  }

  /**
   * Returns an Observable that emits incoming messages filtered by subjects and types.
   * @param {string[]} [subjects=[]] - Array of subjects to listen on.
   * @param {string[]} [types=[]] - Array of message types to filter.
   * @param {boolean} [ignoreSelfEvents=true] - Whether to ignore messages from self.
   */
  getMessageListener$(subjects = [], ignoreSelfEvents = true) {
    return this.configMessageListener$(subjects).pipe(
      switchMap(() =>
        this.incomingMessages$.pipe(
          filter(msg => msg !== null),
          filter(msg => !ignoreSelfEvents || msg.attributes.senderId !== this.senderId),
          filter(msg => subjects.length === 0 || subjects.indexOf(msg.subject) > -1),
        )
      )
    );
  }

  /**
   * Configures message listeners for the provided subjects. For each subject not already subscribed,
   * creates a JetStream subscription and pushes incoming messages into the incomingMessages$ subject.
   * Implements flow control by waiting when unacknowledged messages reach the maximum threshold.
   * @param {string[]} subjects - subjects to subscribe to.
   */
  configMessageListener$(subjects, ops = {}) {
    return from(subjects).pipe(
      filter(subject => this.listeningSubjects.indexOf(subject) === -1),
      mergeMap(subject =>
        defer(async () => {
          const ready$ = new ReplaySubject(1);
          this.subscriptionReady[subject] = ready$;
          // Create a subscription on the given subject.
          const deliverSubject = `deliver${subject.replace(/[^a-zA-Z]/g, '')}`;
          const sub = await this.js.subscribe(subject, {
            config: {
              durable_name: ops?.durable_name || subject.replace(/[^a-zA-Z]/g, ''),
              filter_subject: subject,
              deliver_subject: deliverSubject,
              deliver_policy: ops.deliver_policy ?? 'all',
              max_ack_pending: ops.max_ack_pending ?? 3,
              ack_policy: ops.ack_policy ?? 'explicit'
            }
          });

          // Process messages asynchronously.
          (async () => {
            for await (const msg of sub) {
              // Flow control: wait if unacknowledged messages exceed limit.
              while (this.unacknowledgedCount >= this.maxUnacknowledged) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              this.unacknowledgedCount++;
              let parsed;
              try {
                parsed = JSON.parse(msg.data.toString());
              } catch (e) {
                ConsoleLogger.e(`Mensaje inválido en ${subject}: ${parsed.raw}`);
                parsed = { error: 'Invalid JSON', raw: msg.data.toString() };
              }
              // Include the subject on which the message was received.
              parsed.subject = subject;
              // Emit the message on the RxJS subject.
              this.incomingMessages$.next(parsed);
              msg.ack();
              this.unacknowledgedCount--;
            }
          })();
          this.listeningSubjects.push(subject);
          ready$.next(true);
          return subject;
        })
      ),
      reduce((acc, subject) => { acc.push(subject); return acc; }, [])
    );
  }

  /**
   * Disconnects from the NATS server.
   * @returns {Observable} An observable that completes once disconnected.
   */
  disconnectBroker$() {
    return defer(async () => {
      await this.nc.close();
    });
  }
}

module.exports = NatsJetStreamBroker;