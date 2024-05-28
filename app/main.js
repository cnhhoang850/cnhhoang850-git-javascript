const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
const crypto = require("crypto");

// You can use print statements as follows for debugging, they'll be visible when running tests.
// Uncomment this block to pass the first stage
const command = process.argv[2];
let argvs = process.argv.slice(3);

switch (command) {
  case "init":
    createGitDirectory();
    break;
  case "cat-file":
    let text;
    switch (argvs.length) {
      case 1:
        text = readGitBlob(argvs[0]);
        break;
      case 2:
        text = readGitBlob(argvs[1]);
        break;
    }
    process.stdout.write(text);
    break;
  case "hash-object":
    let hash;
    switch (argvs.length) {
      case 1:
        hash = hashObject(true, argvs[0]);
        break;
      case 2:
        hash = hashObject(true, argvs[1]);
        break;
    }
    process.stdout.write(hash);
    break;
  case "ls-tree":
    switch (argvs.length) {
      case 1:
        result = lsTree(argvs[0]);
        break;
      case 2:
        result = lsTree(argvs[1]);
        break;
    }
    break;
  case "write-tree":
    let treeHash = writeTree(process.cwd());
    process.stdout.write(treeHash);
    break;
  default:
    throw new Error(`Unknown command ${command}`);
}

function writeTree(path) {
  // Tree <size>\0
  // mode name\020bytesha
  // Enumerate all current dirs and files in path
  const itemsInPath = fs.readdirSync(path);
  const contents = [];

  for (const item of itemsInPath) {
    const itemPath = path.join(path, item);
    const stat = fs.statSync(itemPath);
    let hashContent;
    let itemHash;

    if (stat.isFile()) {
      // blobs
      itemHash = hashObject(true, item);
      hashContent = `100644 ${item}\0${itemHash.slice(0, 20)}`;
    } else if (stat.isDirectory()) {
      // trees
      itemHash = writeTree(itemPath);
      hashContent = `040000 ${item}\0${itemHash.slice(0, 20)}`;
    }

    contents.push(hashContent);
  }
  // write content
  let size = contents.reduce((acc, curr) => {
    acc + curr.length;
  }, 0);
  const header = `tree ${size}\0`;
  const treeContent =
    contents.length > 0 ? [header, ...contents].join("\n") : header;
  const compressedContent = zlib.deflateSync(treeContent);
  const treeHash = sha1(treeContent);
  const treeFolder = path.resolve(".git", "objects", treeHash.slice(0, 2));
  const treePath = path.resolve(
    ".git",
    "objects",
    treeFolder,
    treeHash.slice(2),
  );

  fs.mkdirSync(blobFolder);
  fs.writeFileSync(treePath, compressedContent);
  // return treeHash

  return treeHash;
}

function lsTree(hash) {
  const dirName = hash.slice(0, 2);
  const fileName = hash.slice(2);
  const objectPath = path.join(".git", "objects", dirName, fileName);

  if (!fs.existsSync(objectPath)) {
    throw new Error("Object path does not exist");
  }

  const dataFromFile = fs.readFileSync(objectPath);

  // Decompress the data from the file using zlib
  const decompressedData = zlib.inflateSync(dataFromFile);

  // Convert the buffer to a string while preserving the byte structure
  let dataStr = decompressedData.toString("binary");

  // Find the end of the object header ("tree <size>\0")
  let nullByteIndex = dataStr.indexOf("\0");
  dataStr = dataStr.slice(nullByteIndex + 1);

  const entries = [];

  while (dataStr.length > 0) {
    // Extract mode
    const spaceIndex = dataStr.indexOf(" ");
    if (spaceIndex === -1) break; // Invalid format
    const mode = dataStr.slice(0, spaceIndex);
    dataStr = dataStr.slice(spaceIndex + 1);

    // Extract name
    const nullIndex = dataStr.indexOf("\0");
    if (nullIndex === -1) break; // Invalid format
    const name = dataStr.slice(0, nullIndex);
    if (!name) continue; // skip empty names
    dataStr = dataStr.slice(nullIndex + 1); // Move past the null byte

    // Extract SHA-1 hash
    const sha = dataStr.slice(0, 20);
    dataStr = dataStr.slice(20);

    entries.push(name);
  }

  // Output the names of the files and directories
  const response = entries.join("\n"); // Removed the trailing newline for better handling
  if (response) {
    process.stdout.write(response + "\n"); // Append newline here
  } else {
    throw new Error("No valid entries found");
  }
}

function createGitDirectory() {
  fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });

  fs.writeFileSync(
    path.join(process.cwd(), ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  console.log("Initialized git directory");
}

function hashObject(write, fileName) {
  const filePath = path.resolve(fileName);
  let data = fs
    .readFileSync(filePath)
    .toString()
    .replace(/(\r\n|\n|\r)/gm, "");
  data = `blob ${data.length}\0` + data;
  const hash = sha1(data);

  if (write) {
    const header = hash.slice(0, 2);
    const blobName = hash.slice(2);
    const blobFolder = path.resolve(".git", "objects", header);
    const blobPath = path.resolve(blobFolder, blobName);

    if (!fs.existsSync(blobFolder)) {
      fs.mkdirSync(blobFolder);
    }

    let dataCompressed = zlib.deflateSync(data);
    fs.writeFileSync(blobPath, dataCompressed);
  }

  return hash;
}

function sha1(data) {
  const generator = crypto.createHash("sha1");
  generator.update(data);
  return generator.digest("hex");
}

function readGitBlob(sha) {
  const blobPath = path.resolve(
    ".git",
    "objects",
    sha.slice(0, 2),
    sha.slice(2),
  );

  let data = fs.readFileSync(blobPath);
  let dataUncompressed = zlib.unzipSync(data);
  let nullByteIndex = dataUncompressed.indexOf("\0");
  return dataUncompressed.toString().slice(nullByteIndex + 1);
}
