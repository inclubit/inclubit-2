// import { useConnectionStore } from '../stores/connectionStore';
// import { pinia } from '../boot/pinia';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Request, AnyResponse, SocketMessage, RequestSubjects, UnknownMessageType, SuccessResponseTo, AnySuccessResponse, AnyRequest, AnyMessage } from 'shared-types/MessageTypes';

const requestTimeout = 3000;
type RequestResolver = (msg: AnySuccessResponse) => void;
type RequestRejecter = (msg: unknown) => void;
const pendingRequests = new Map<number, {resolve: RequestResolver, reject: RequestRejecter}>();

interface SocketEvents {
  'open': () => void;
  'close': () => void;
  'error': (error: Event) => void;
  'request': (req: AnyRequest) => void;
  'message': (msg: AnyMessage) => void;
}

const eventEmitter = new TypedEmitter<SocketEvents>();

let createSocketTimeout: number;
let socket: WebSocket | null = null;
// TODO wrap socket creation so we can toggle retryIsActive properly
// let retryIsActive = true;
export default {

  socketEvents: eventEmitter,
  createSocket: async function (token: string): Promise<Event> {
    if (createSocketTimeout) {
      window.clearTimeout(createSocketTimeout);
    }
    const retryIn = (seconds: number) => {
      // if (!retryIsActive) return;
      createSocketTimeout = window.setTimeout(() => this.createSocket(token), seconds * 1000);
    };
    if (!process.env.MEDIASOUP_URL || !process.env.MEDIASOUP_PATH) {
      console.error('No socket url provided from environment variables!! Huge error of doom!');
      throw new Error('no socket url provided!');
    }
    if (!token) {
      console.error('no auth token provided for socket');
      throw new Error('no auth token provided!');
    }
    const promise = new Promise<Event>((resolve, reject) => {
      try {
        const connectionsString = `${process.env.MEDIASOUP_URL}/${process.env.MEDIASOUP_PATH}?${token}`;
        console.log('creating websocket with connectionsString;', connectionsString);
        socket = new WebSocket(connectionsString);
        socket.onopen = (ev) => {
          eventEmitter.emit('open');
          // console.log('connected: ', ev);
          resolve(ev);
        };
        socket.onerror = (err) => {
          eventEmitter.emit('error', err);
          reject(err);
        };
        socket.onclose = (ev) => {
          eventEmitter.emit('close');
          if (ev.code === 1000) {
            console.log('socket closed. Reason:', ev.reason);
            return;
          }
          console.error('socket closed unexpectedly. will try to reconnect!');
          retryIn(4);
        };
        socket.onmessage = this.handleMessage;
      } catch (e) {
        console.error(e);
        retryIn(4);
        reject(e);
      }
    });
    return promise;
  },
  tearDown: () => {
    // retryIsActive = false;
    if (!socket) return;
    socket.close(1000, 'closed by user');
    socket = null;
  },
  handleMessage: (ev: MessageEvent) => {
    const parsedMessage = JSON.parse(ev.data);
    if (!parsedMessage) {
      console.error('failed to parse incoming object!!!');
    }
    const msg = parsedMessage as SocketMessage<UnknownMessageType>;
    if (msg.type === 'response') {
      try {
        const callback = pendingRequests.get(msg.id);
        if (!callback) {
          console.error('callbacks was not available in pendingRequests map!!');
          return;
        }
        const { resolve, reject } = callback;
        if (!msg.wasSuccess) {
          reject(msg.message);
          console.log(`request '${msg.subject}' rejected!`, msg);
        } else {
          resolve(msg);
          console.log(`request '${msg.subject}' resolved`, msg);
        }
        pendingRequests.delete(msg.id);
      } catch (e) {
        console.error(e);
      }
    } else if (msg.type === 'request') {
      eventEmitter.emit('request', msg);
    // if (onReqOrMsgCallback) {
    //   onReqOrMsgCallback(msg);
    // } else {
    //   console.log('message received, but no callback attached');
    //   console.log('this is the received message: ', msg);
    // }
    } else if (msg.type === 'message') {
      eventEmitter.emit('message', msg);
    }
  },
  send: (msg: SocketMessage<UnknownMessageType>) => {
    const string = JSON.stringify(msg);
    socket?.send(string);
    console.log('sending message:', msg);
  },
  sendRequest: async <T extends RequestSubjects>(msg: SocketMessage<Request<T>>, timeoutMillis?: number): Promise<SuccessResponseTo<T>> => {
    msg.id = Date.now(); // Questionable if we should set the id here...
    const id = msg.id;
    const msgString = JSON.stringify(msg);
    socket?.send(msgString);
    console.log('sending request:', msg);
    const promise: Promise<AnyResponse> = new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      setTimeout(() => {
        pendingRequests.delete(id);
        reject(`request timed out: ${id}`);
      }, timeoutMillis ?? requestTimeout);
    });

    return promise as Promise<SuccessResponseTo<T>>;
  },
};
