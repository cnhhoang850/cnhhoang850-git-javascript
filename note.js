function readLittleEndian(buffer, offset, shift) {
  let byte = buffer[offset]
  let size = first & 0xf
  let shift =

    while (buffer[offset] > 127) {
    offset++
    byte = buffer[offset]
    size = size | (byte & 0x7f) << shift
    shift +=
    }

  return { parsedBytes: offset + 1, size }
}
