const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");

function writeGitObject(hash, content, basePath = "") {
  // Receive a SHA1 hash and file content and write a new git object

  let objectFolder = hash.slice(0, 2);
  let objectName = hash.slice(2);

  if (fs.existsSync(path.join(basePath, ".git", "objects", objectFolder))) {
    throw new Error("Folder already exist");
  } else if (
    fs.existsSync(path.join(basePath, ".git", "objects", objectName))
  ) {
    throw new Error("Git object already exist");
  }

  fs.mkdirSync(path.join(basePath, ".git", "objects", objectFolder), {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(basePath, ".git", "objects", objectFolder, objectName),
    zlib.deflateSync(content),
  );

  return objectName;
}

module.exports = writeGitObject;
