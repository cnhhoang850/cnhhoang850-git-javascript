const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");

// You can use print statements as follows for debugging, they'll be visible when running tests.
// Uncomment this block to pass the first stage
const command = process.argv[2];

switch (command) {
  case "init":
    createGitDirectory();
    break;
  case "cat-file":
    let argvs = process.argv.slice(3);
    let text;
    switch (argvs.length) {
      case 1:
        text = readGitBlob(argvs[0]);
      case 2:
        text = readGitBlob(argvs[1]);
    }
    process.stdout.write(text);
    break;
  case "hash-object":
    break;
  default:
    throw new Error(`Unknown command ${command}`);
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

function readGitBlob(SHA) {
  const blobPath = path.resolve(
    ".git",
    "objects",
    SHA.slice(0, 2),
    SHA.slice(2),
  );

  let data = fs.readFileSync(blobPath);
  let dataUncompressed = zlib.unzipSync(data);
  let nullByteIndex = dataUncompressed.indexOf("\0");
  return dataUncompressed
    .toString()
    .slice(nullByteIndex + 1)
    .replace(/(\r\n|\n|\r)/gm, "");
}
