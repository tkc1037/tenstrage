import { readFileSync } from 'fs';

export function inspectWav(filePath) {
  const buffer = readFileSync(filePath);
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitDepth = 0;
  let byteRate = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      byteRate = buffer.readUInt32LE(offset + 16);
      bitDepth = buffer.readUInt16LE(offset + 22);
    }
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!byteRate || !dataSize) throw new Error(`WAV形式を解析できません: ${filePath}`);

  let peak = 0;
  for (let index = dataOffset; index + 1 < dataOffset + dataSize; index += 2) {
    peak = Math.max(peak, Math.abs(buffer.readInt16LE(index)));
  }

  return {
    sampleRate,
    channels,
    bitDepth,
    durationSeconds: dataSize / byteRate,
    peak,
  };
}
