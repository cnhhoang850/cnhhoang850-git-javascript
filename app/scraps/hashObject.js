const crypto = require('crypto')
const zlib = require('zlib')

function sha1 (data) {
  const generator = crypto.createHash('sha1')
  generator.update(data)
  return generator.digest('hex')
}
module.exports = (write, fileName) => {
  const filePath = path.resolve(fileName)
  let data = fs
    .readFileSync(filePath)
    .toString()
    .replace(/(\r\n|\n|\r)/gm, '')
  data = `blob ${data.length}\0` + data
  const hash = sha1(data)

  if (write) {
    const header = hash.slice(0, 2)
    const blobName = hash.slice(2)
    const blobFolder = path.resolve('.git', 'objects', header)
    const blobPath = path.resolve(blobFolder, blobName)

    if (!fs.existsSync(blobFolder)) {
      fs.mkdirSync(blobFolder)
    }

    const dataCompressed = zlib.deflateSync(data)
    fs.writeFileSync(blobPath, dataCompressed)
  }

  return hash
}
