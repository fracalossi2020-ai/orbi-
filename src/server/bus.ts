import { EventEmitter } from "node:events";

/**
 * Sinal de "algo mudou" por usuário; o cliente busca o estado de novo pela API.
 * Funciona em um único processo. Para várias instâncias, troque por Redis pub/sub mantendo esta interface.
 */
const g = globalThis as unknown as { __prumoBus?: EventEmitter };
const bus = (g.__prumoBus ??= new EventEmitter().setMaxListeners(0));

export const publish = (channel: string, topic: string) => bus.emit(channel, topic);
export function subscribe(channel: string, fn: (topic: string) => void) {
  bus.on(channel, fn);
  return () => { bus.off(channel, fn); };
}
export const userChannel = (id: string) => `user:${id}`;
export const rideChannel = (token: string) => `share:${token}`;
export const STAFF_CHANNEL = "staff";
