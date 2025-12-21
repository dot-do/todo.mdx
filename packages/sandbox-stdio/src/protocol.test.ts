import { describe, it, expect } from 'vitest';
import {
  STREAM_STDOUT,
  STREAM_STDERR,
  pack,
  unpack,
  isControlMessage,
  isResizeMessage,
  isSignalMessage,
  isExitMessage,
  createResizeMessage,
  createSignalMessage,
  createExitMessage,
  parseClientMessage,
  parseServerMessage,
  isStdout,
  isStderr,
  getStreamName,
} from './protocol.js';

describe('Stream IDs', () => {
  it('should have correct values', () => {
    expect(STREAM_STDOUT).toBe(0x01);
    expect(STREAM_STDERR).toBe(0x02);
  });
});

describe('pack/unpack', () => {
  it('should pack data with stream ID prefix', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const packed = pack(STREAM_STDOUT, data);

    expect(packed.length).toBe(6);
    expect(packed[0]).toBe(STREAM_STDOUT);
    expect(packed.subarray(1)).toEqual(data);
  });

  it('should unpack stream ID and payload', () => {
    const packed = new Uint8Array([STREAM_STDERR, 0x48, 0x69]); // stderr + "Hi"
    const { streamId, payload } = unpack(packed);

    expect(streamId).toBe(STREAM_STDERR);
    expect(payload).toEqual(new Uint8Array([0x48, 0x69]));
  });

  it('should handle empty payload', () => {
    const packed = pack(STREAM_STDOUT, new Uint8Array(0));
    expect(packed.length).toBe(1);
    expect(packed[0]).toBe(STREAM_STDOUT);

    const { streamId, payload } = unpack(packed);
    expect(streamId).toBe(STREAM_STDOUT);
    expect(payload.length).toBe(0);
  });

  it('should handle empty input to unpack', () => {
    const { streamId, payload } = unpack(new Uint8Array(0));
    expect(streamId).toBe(0);
    expect(payload.length).toBe(0);
  });
});

describe('type guards', () => {
  it('isControlMessage should identify control messages', () => {
    expect(isControlMessage({ type: 'resize', cols: 80, rows: 24 })).toBe(true);
    expect(isControlMessage({ type: 'signal', signal: 'SIGINT' })).toBe(true);
    expect(isControlMessage({ type: 'exit', code: 0 })).toBe(true);
    expect(isControlMessage({ type: 'unknown' })).toBe(false);
    expect(isControlMessage(null)).toBe(false);
    expect(isControlMessage('string')).toBe(false);
  });

  it('isResizeMessage should validate resize messages', () => {
    expect(isResizeMessage({ type: 'resize', cols: 80, rows: 24 })).toBe(true);
    expect(isResizeMessage({ type: 'resize', cols: '80', rows: 24 })).toBe(false);
    expect(isResizeMessage({ type: 'resize' })).toBe(false);
    expect(isResizeMessage({ type: 'signal', signal: 'SIGINT' })).toBe(false);
  });

  it('isSignalMessage should validate signal messages', () => {
    expect(isSignalMessage({ type: 'signal', signal: 'SIGINT' })).toBe(true);
    expect(isSignalMessage({ type: 'signal', signal: 9 })).toBe(false);
    expect(isSignalMessage({ type: 'signal' })).toBe(false);
    expect(isSignalMessage({ type: 'resize', cols: 80, rows: 24 })).toBe(false);
  });

  it('isExitMessage should validate exit messages', () => {
    expect(isExitMessage({ type: 'exit', code: 0 })).toBe(true);
    expect(isExitMessage({ type: 'exit', code: 127 })).toBe(true);
    expect(isExitMessage({ type: 'exit', code: '0' })).toBe(false);
    expect(isExitMessage({ type: 'exit' })).toBe(false);
    expect(isExitMessage({ type: 'signal', signal: 'SIGINT' })).toBe(false);
  });
});

describe('message factories', () => {
  it('createResizeMessage should create valid resize message', () => {
    const msg = createResizeMessage(120, 40);
    expect(msg).toEqual({ type: 'resize', cols: 120, rows: 40 });
    expect(isResizeMessage(msg)).toBe(true);
  });

  it('createSignalMessage should create valid signal message', () => {
    const msg = createSignalMessage('SIGTERM');
    expect(msg).toEqual({ type: 'signal', signal: 'SIGTERM' });
    expect(isSignalMessage(msg)).toBe(true);
  });

  it('createExitMessage should create valid exit message', () => {
    const msg = createExitMessage(1);
    expect(msg).toEqual({ type: 'exit', code: 1 });
    expect(isExitMessage(msg)).toBe(true);
  });
});

describe('parseClientMessage', () => {
  it('should parse JSON resize message', () => {
    const result = parseClientMessage(JSON.stringify({ type: 'resize', cols: 80, rows: 24 }));
    expect(result.kind).toBe('control');
    if (result.kind === 'control') {
      expect(result.message.type).toBe('resize');
    }
  });

  it('should parse JSON signal message', () => {
    const result = parseClientMessage(JSON.stringify({ type: 'signal', signal: 'SIGINT' }));
    expect(result.kind).toBe('control');
    if (result.kind === 'control') {
      expect(result.message.type).toBe('signal');
    }
  });

  it('should parse binary as stdin', () => {
    const data = new Uint8Array([0x68, 0x69]); // "hi"
    const result = parseClientMessage(data);
    expect(result.kind).toBe('stdin');
    if (result.kind === 'stdin') {
      expect(result.data).toEqual(data);
    }
  });

  it('should parse ArrayBuffer as stdin', () => {
    const buffer = new ArrayBuffer(2);
    const view = new Uint8Array(buffer);
    view[0] = 0x68;
    view[1] = 0x69;

    const result = parseClientMessage(buffer);
    expect(result.kind).toBe('stdin');
    if (result.kind === 'stdin') {
      expect(result.data).toEqual(new Uint8Array([0x68, 0x69]));
    }
  });

  it('should treat invalid JSON string as stdin', () => {
    const result = parseClientMessage('not json');
    expect(result.kind).toBe('stdin');
    if (result.kind === 'stdin') {
      expect(new TextDecoder().decode(result.data)).toBe('not json');
    }
  });
});

describe('parseServerMessage', () => {
  it('should parse JSON exit message', () => {
    const result = parseServerMessage(JSON.stringify({ type: 'exit', code: 0 }));
    expect(result.kind).toBe('control');
    if (result.kind === 'control') {
      expect(result.message.type).toBe('exit');
    }
  });

  it('should parse binary with stream ID', () => {
    const packed = pack(STREAM_STDOUT, new Uint8Array([0x68, 0x69]));
    const result = parseServerMessage(packed);
    expect(result.kind).toBe('binary');
    if (result.kind === 'binary') {
      expect(result.streamId).toBe(STREAM_STDOUT);
      expect(result.payload).toEqual(new Uint8Array([0x68, 0x69]));
    }
  });

  it('should parse ArrayBuffer with stream ID', () => {
    const packed = pack(STREAM_STDERR, new Uint8Array([0x65, 0x72, 0x72]));
    const buffer = packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength);

    const result = parseServerMessage(buffer);
    expect(result.kind).toBe('binary');
    if (result.kind === 'binary') {
      expect(result.streamId).toBe(STREAM_STDERR);
    }
  });

  it('should throw on invalid JSON string', () => {
    expect(() => parseServerMessage('not json')).toThrow();
  });
});

describe('stream utilities', () => {
  it('isStdout should identify stdout stream', () => {
    expect(isStdout(STREAM_STDOUT)).toBe(true);
    expect(isStdout(STREAM_STDERR)).toBe(false);
    expect(isStdout(0x00)).toBe(false);
  });

  it('isStderr should identify stderr stream', () => {
    expect(isStderr(STREAM_STDERR)).toBe(true);
    expect(isStderr(STREAM_STDOUT)).toBe(false);
    expect(isStderr(0x00)).toBe(false);
  });

  it('getStreamName should return correct names', () => {
    expect(getStreamName(STREAM_STDOUT)).toBe('stdout');
    expect(getStreamName(STREAM_STDERR)).toBe('stderr');
    expect(getStreamName(0x00)).toBe('unknown');
    expect(getStreamName(0xff)).toBe('unknown');
  });
});
