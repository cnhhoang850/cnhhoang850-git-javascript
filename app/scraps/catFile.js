const zlib = require('zlib')

module.exports = (sha) => {
  const blobPath = path.resolve(
    '.git',
    'objects',
    sha.slice(0, 2),
    sha.slice(2)
  )

  const data = fs.readFileSync(blobPath)
  const dataUncompressed = zlib.unzipSync(data)
  const nullByteIndex = dataUncompressed.indexOf('\0')
  return dataUncompressed
    .toString()
    .slice(nullByteIndex + 1)
    .replace(/(\r\n|\n|\r)/gm, '')
}
