import { insertEvent, insertError, insertLog } from './db.js';
import { bus, CHANNELS } from './bus.js';

// Persist + broadcast a Discord/moderation event.
export function recordEvent(event) {
  const saved = insertEvent(event);
  bus.emit(CHANNELS.EVENT, saved);
  return saved;
}

// Persist + broadcast an error.
export function recordError(error) {
  const saved = insertError(error);
  bus.emit(CHANNELS.ERROR, saved);
  return saved;
}

// Persist + broadcast an application log line.
export function recordLog(log) {
  const saved = insertLog(log);
  bus.emit(CHANNELS.LOG, saved);
  return saved;
}

// Broadcast a transient status update (e.g. bot connection state).
export function emitStatus(status) {
  bus.emit(CHANNELS.STATUS, status);
}
