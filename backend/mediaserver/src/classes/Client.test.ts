import Client from './Client';
import SocketWrapper from './SocketWrapper';
import { mock } from 'jest-mock-extended';
import { types as soup } from 'mediasoup';
import Room from './Room';
import Gathering from './Gathering';

describe('When Client class is created it', () => {
  let socketWrapper : SocketWrapper;
  let client: Client;
  beforeEach(() => {
    socketWrapper = mock<SocketWrapper>();
    client = new Client({ws: socketWrapper});
  });
  it('can be successfully instantiated', () => {
    expect(client).toBeTruthy();
  });
  
  it('has a uuid autogenerated if not provided', () => {
    expect(client).toHaveProperty('id');
    // console.log('uuid:', client.id);
    expect(client.id).toBeDefined();
  });

  it('its possible to assign custom uuid', ()=> {
    const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    client = new Client({ws: socketWrapper, id: randomString});
    expect(client).toHaveProperty('id');
    expect(client.id).toBe(randomString);
  });


});

describe('client instance with exposed private messageHandler', () => {
  let socketWrapper : SocketWrapper;
  let client: Client;
  let messageHandler: (msg: SocketMessage<UnknownMessageType>) => void;
  beforeEach(() => {
    socketWrapper = mock<SocketWrapper>();
    client = new Client({ws: socketWrapper});
    // @ts-expect-error I allow private access in tests because I'm the chief!!!
    messageHandler = client.handleReceivedMsg;

  });

  it('can set RtpCapabilities from valid incoming message', () => {
    // const message = mock<SocketMessage<SetRtpCapabilities>>();
    const validMsgObj: SocketMessage<UnknownMessageType> = {
      type: 'setRtpCapabilities',
      data: {codecs: []},
    };

    messageHandler(validMsgObj);
    // console.log(client.rtpCapabilities);
    expect(client.rtpCapabilities).toEqual<soup.RtpCapabilities>(validMsgObj.data);
  });

  it('returns RouterCapabilities to client when requested', () => {
    const room = mock<Room>();
    const caps = mock<soup.RtpCapabilities>();
    
    room.getRtpCapabilities.mockReturnValue(caps);
    // console.log(room.clients.get);

    // const Room = jest.createMockFromModule('./Room');
    // const otherRoom = new Room();
    client.room = room;
    const requestMsg: SocketMessage<RequestMessageType> = {
      responseNeeded: true,
      type:'getRouterRtpCapabilities' 
    };
    messageHandler(requestMsg);

    expect(socketWrapper.send).toBeCalledTimes(1);
    // TODO: Also check that a valid response object is given to the send function
  });

  it('can not return RouterCapabilities to client if isnt in a room', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation();
    const requestMsg: SocketMessage<RequestMessageType> = {
      responseNeeded: true,
      type:'getRouterRtpCapabilities' 
    };
    messageHandler(requestMsg);

    expect(socketWrapper.send).toBeCalledTimes(0);
    expect(spy).toBeCalledTimes(1);
    spy.mockRestore();
  });

  it('responds with failResponse if cant get router RtpCapabilities', () => {
    const requestMsg: SocketMessage<GetRouterRtpCapabilities> = {
      type: 'getRouterRtpCapabilities',
      responseNeeded: true,
    };
    messageHandler(requestMsg);

    const failResponse: SocketMessage<RtpCapabilitiesResponse> = {
      type: 'rtpCapabilitiesResponse',
      isResponse: true,
      wasSuccess: false,

    };
    expect(socketWrapper.send).toBeCalledWith(
      expect.objectContaining(failResponse)
    );
  });

  describe('when requested to join a gathering', () => {
    const validGatheringId = 'yeahyeahyeah';
    const invalidGatheringId = 'nononononnonon';
    let gathering = mock<Gathering>();

    beforeEach(()=>{
      gathering = mock<Gathering>();
      gathering.id = validGatheringId;
      //@ts-expect-error during test we allow to acess this private field
      Gathering.gatherings.set(validGatheringId, gathering);
    });
    it('can NOT join a gathering if doesnt exist', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      const validJoinGatheringRequest: SocketMessage<JoinGathering> = {
        ackNeeded: true,
        type: 'joinGathering',
        data: {id: invalidGatheringId}
      };
      messageHandler(validJoinGatheringRequest);

      expect(client.gathering).toBeUndefined();
      expect(spy).toBeCalled();
      spy.mockRestore();
    });
  
    it('can join a gathering from valid join request', () => {
      // const gatheringId = 'lkj23lkjh234';
      // const gathering =  new Gathering(gatheringId);
      // const gathering = mock<Gathering>();
      // console.log(gathering);
      // Gathering.gatherings.set(gatheringId, gathering);
      const validJoinGatheringRequest: SocketMessage<JoinGathering> = {
        ackNeeded: true,
        type: 'joinGathering',
        data: {id: validGatheringId}
      };
      messageHandler(validJoinGatheringRequest);

      expect(client.gathering).toBeDefined();
      expect(client.gathering).toBe(gathering);
    // expect(client.gathering?.id).toBe(gatheringId);
    });

    // it('can NOT join a gathering from valid join request if isnt authorized', () => {
    //   // const gatheringName = 'cool-gathering';
    //   const validGatheringId = '4j4j4j4j4';
    //   const validJoinRoomRequest: SocketMessage<JoinGathering> = {
    //     ackNeeded: true,
    //     type: 'joinGathering',
    //     data: {id: validGatheringId}
    //   };
    //   messageHandler(validJoinRoomRequest);

  //   expect(client.gathering).toBeDefined();
  // });
  });

  describe('when requested to join room', () => {
    const validRoomId = 'yesyesyes';
    const invalidRoomId = 'nononono';
    let room = mock<Room>();
    const validGatheringId = 'yeahyeahyeah';
    let gathering = mock<Gathering>();
    beforeEach(()=>{
      room = mock<Room>();
      gathering = mock<Gathering>();
      gathering.id = validGatheringId;
      //@ts-expect-error during test we allow to acess this private field
      Gathering.gatherings.set(validGatheringId, gathering);
    });
    it('can join a room from valid join request', () => {
      room.addClient.calledWith(client).mockReturnValue(true);
      gathering.getRoom.calledWith(validRoomId).mockReturnValue(room);
      client.gathering = gathering;

      const validJoinRoomRequest: SocketMessage<JoinRoom> = {
        ackNeeded: true,
        type: 'joinRoom',
        data: {id: validRoomId,}
      };
      messageHandler(validJoinRoomRequest);

      expect(client.room).toBeDefined();
    });

    it('can NOT join a room if isnt in a gathering', () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation();
      const invalidJoinRoomRequest: SocketMessage<JoinRoom> = {
        ackNeeded: true,
        type: 'joinRoom',
        data: {id: ''}
      };
      messageHandler(invalidJoinRoomRequest);
      expect(client.room).toBeUndefined();
      expect(logSpy).toBeCalled();
      logSpy.mockRestore();
    });

    it('can NOT join a room if the gathering doesnt have that room', () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());
      // const gathering = mock<Gathering>();
      // const invalidRoomId = '3jlk234h5';
      gathering.getRoom.calledWith(invalidRoomId).mockReturnValue(undefined);
      client.gathering = gathering;
      const invalidJoinRoomRequest: SocketMessage<JoinRoom> = {
        ackNeeded: true,
        type: 'joinRoom',
        data: {id: invalidRoomId,}
      };
      messageHandler(invalidJoinRoomRequest);

      expect(client.room).toBeUndefined();
      expect(logSpy).toBeCalled();
      logSpy.mockRestore();
    });

    it('sends response to client when failing to join room because not in a gathering', () => {
      const joinRoomRequest: SocketMessage<JoinRoom> = {
        ackNeeded: true,
        type: 'joinRoom',
        data: {id: '',}
      };
      messageHandler(joinRoomRequest);

      expect(socketWrapper.send).toBeCalled();
      const responseObj: SocketMessage<JoinRoomResponse> = {
        type: 'joinRoomResponse',
        isResponse: true,
        wasSuccess: false,
      };
      expect(socketWrapper.send).toBeCalledWith(
        expect.objectContaining(responseObj)
      );
    });

    it('sends response to client when failing because no such room exist', ()=>{
      gathering.getRoom.calledWith(invalidRoomId).mockReturnValue(undefined);
      client.gathering = gathering;
      const joinRoomRequest: SocketMessage<JoinRoom> = {
        ackNeeded: true,
        type: 'joinRoom',
        data: {id: invalidRoomId,}
      };
      messageHandler(joinRoomRequest);
      expect(socketWrapper.send).toBeCalled();
      const failResponse: SocketMessage<JoinRoomResponse> = {
        type: 'joinRoomResponse',
        isResponse: true,
        wasSuccess: false,
      };
      expect(socketWrapper.send).toBeCalledWith(
        expect.objectContaining(failResponse)
      );
      
    });

    it('sends response to client when succesfully joined', ()=>{
      room.addClient.calledWith(client).mockReturnValue(true);
      gathering.getRoom.calledWith(validRoomId).mockReturnValue(room);
      client.gathering = gathering;
      const joinRoomRequest: SocketMessage<JoinRoom> = {
        type: 'joinRoom',
        ackNeeded: true,
        data: {id: validRoomId}
      };
      messageHandler(joinRoomRequest);
      expect(socketWrapper.send).toBeCalled();
      const successResponse: SocketMessage<JoinRoomResponse> = {
        type: 'joinRoomResponse',
        isResponse: true,
        wasSuccess: true,
      };
      expect(socketWrapper.send).toBeCalledWith(
        expect.objectContaining(successResponse)
      );
      
    });

  });
});