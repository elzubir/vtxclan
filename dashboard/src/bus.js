import { EventEmitter } from 'node:events';

// Central event bus that decouples data producers (Discord bot, logger)
// from consumers (the websocket layer).
export const bus = new EventEmitter();
bus.setMaxListeners(50);

export const CHANNELS = {
  EVENT: 'event',
  ERROR: 'error',
  LOG: 'log',
  STATUS: 'status',
};
