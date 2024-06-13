const fs = require("fs");
const path = require("path");
const { sha1, writeGitObject } = require("./utils");

function hashBlob(write, fileName, basePath = "") {
  // Read file
  const filePath = path.resolve(basePath, fileName);

  // Write git blob
  let data = fs.readFileSync(filePath).toString();

  // Add header
  data = `blob ${data.length}\0` + data;
  const writeFilePath = sha1(data);

  // Write to directory
  let hash;
  if (write) {
    hash = writeGitObject(writeFilePath, data, basePath);
  }

  // Log and return hash
  if (hash) {
    //process.stdout.write(hash + '\n') // Append newline here
    return hash;
  } else {
    throw new Error("No hash");
  }
}

module.exports = hashBlob;
