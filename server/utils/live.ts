import { EventEmitter } from 'node:events'

// shortcut: process-local notifications support one app instance; use a shared bus before adding replicas.
export const roomEvents = new EventEmitter()
roomEvents.setMaxListeners(0)
export function publishRoom(id: string) { roomEvents.emit(id) }
