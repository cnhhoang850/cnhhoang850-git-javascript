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
      default:
        throw new Erro(`Unknown command ${[...argvs]}`);
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
    console.log(hash);
    break;
  default:
    throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
  fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true});
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
  let data = fs.readFileSync(filePath).toString().replace(/(\r\n|\n|\r)/gm, "");
  data = `blob ${data.length}\0` + data
  const hash = sha1(data);

  if (write) {
    const header = hash.slice(0, 2);
    const blobName = hash.slice(3);
    const blobFolder = path.resolve(".git", "objects", header);
    const blobPath = path.resolve(blobFolder, blobName);

    if (!fs.existsSync(blobFolder)) {
      fs.mkdirSync(blobFolder)
    }

    let dataCompressed = zlib.gzipSync(data);
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
  return dataUncompressed
    .toString()
    .slice(nullByteIndex + 1)
    .replace(/(\r\n|\n|\r)/gm, "");
}
 
function trimString(string) {
}







