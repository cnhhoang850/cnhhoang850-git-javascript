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
        throw new Error(`Unknown command ${[...argvs]}`);
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
      default:
        throw new Error(`Unknown command ${[...argvs]}`);
    }
    process.stdout.write(hash);
    break;
  case "ls-tree":
    let result;
    switch (argvs.length) {
      case 1:
        result = lsTree(argvs[0]);
        break;
      case 2:
        result = lsTree(argvs[1]);
        break;
      default:
        throw new Error(`Unknown command ${[...argvs]}`);
    }
    process.stdout.write(result);
  default:
    throw new Error(`Unknown command ${command}`);
}

function lsTree() {
  const isNameOnly = process.argv[3];
  let hash = "";
  if (isNameOnly === "--name-only") {
    //display the name only
    hash = process.argv[4];
  } else {
    hash = process.argv[3];
  }
  const dirName = hash.slice(0, 2);
  const fileName = hash.slice(2);
  const objectPath = path.join(".git", "objects", dirName, fileName);
  const dataFromFile = fs.readFileSync(objectPath);
  //decrypt the data from the file
  const inflated = zlib.inflateSync(dataFromFile);
  //notice before encrypting the data what we do was we encrypt
  //blob length/x00 so to get the previous string back what we need to do is split with /xoo
  const enteries = inflated.toString("utf-8").split("\x00");
  //enteries will be [blob length/x00, actual_file_content]
  const dataFromTree = enteries.slice(1);
  const names = dataFromTree
    .filter((line) => line.includes(" "))
    .map((line) => line.split(" ")[1]);
  const namesString = names.join("\n");
  const response = namesString.concat("\n");
  //this is the regex pattern that tells to replace multiple global \n with single \n
  process.stdout.write(response.replace(/\n\n/g, "\n"));
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
