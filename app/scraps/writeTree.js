function writeTree (root) {
  // Tree <size>\0
  // mode name\020bytesha
  // Enumerate all current dirs and files in path
  const itemsInPath = fs.readdirSync(root)
  const contents = []

  for (const item of itemsInPath) {
    const itemPath = path.join(root, item)
    const stat = fs.statSync(itemPath)
    let hashContent
    let itemHash

    if (item == '.git') {
      continue
    }

    if (stat.isFile()) {
      // blobs
      itemHash = hashObject(true, itemPath)
      hashContent = `100644 ${item}\0${Buffer.from(itemHash.slice(0, 20), 'hex')}`
    } else if (stat.isDirectory()) {
      // trees
      itemHash = writeTree(itemPath)
      hashContent = `40000 ${item}\0${Buffer.from(itemHash.slice(0, 20), 'hex')}`
    }
    contents.push(hashContent)
  }
  // write content
  const size = contents.reduce((acc, curr) => acc + curr.length, 0)
  // console.log("This is tree: ", root, size);
  const header = `tree ${size}\0`
  const contentBody = contents.reduce((acc, item) => {
    return Buffer.concat([acc, Buffer.from(item)])
  }, Buffer.alloc(0))
  const treeContent = Buffer.concat([Buffer.from(header), contentBody])
  const compressedContent = zlib.deflateSync(treeContent)
  const treeHash = sha1(treeContent)
  const treeFolder = path.resolve('.git', 'objects', treeHash.slice(0, 2))
  const treePath = path.resolve(
    '.git',
    'objects',
    treeFolder,
    treeHash.slice(2)
  )

  fs.mkdirSync(treeFolder)
  fs.writeFileSync(treePath, compressedContent)
  // return treeHash

  return treeHash
}
