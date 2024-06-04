const fs = require("fs");
const path = require("path");
const sha1 = require("./utils/sha1");
const writeGitObject = require("./utils/writeGitObject");

function hashBlob(write, fileName) {
  // Read file
  const filePath = path.resolve(fileName);

  // Write git blob
  let data = fs
    .readFileSync(filePath)
    .toString()
    .replace(/(\r\n|\n|\r)/gm, "");

  // Add header
  data = `blob ${data.length}\0` + data;
  const writeFilePath = sha1(data);

  // Write to directory
  let hash;
  if (write) {
    hash = writeGitObject(writeFilePath, data);
  }

  // Log and return hash
  if (hash) {
    process.stdout.write(hash + "\n"); // Append newline here
    return hash;
  } else {
    throw new Error("No hash");
  }
}

module.exports = hashBlob;
