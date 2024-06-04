const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
const resolveGitObjectPath = require("./utils/resolveGitObjectPath");

function readTree(hash) {
  // Resolve dirname
  const objectPath = resolveGitObjectPath(hash);

  // Read file
  if (!fs.existsSync(objectPath)) {
    throw new Error("Object path does not exist");
  }

  const dataFromFile = fs.readFileSync(objectPath);
  const decompressedData = zlib.inflateSync(dataFromFile);

  // Convert the buffer to a string while preserving the byte structure
  let dataStr = decompressedData.toString("binary");

  // Find the end of the object header ("tree <size>\0")
  let nullByteIndex = dataStr.indexOf("\0");
  dataStr = dataStr.slice(nullByteIndex + 1);

  const entries = [];

  while (dataStr.length > 0) {
    // Format: mode, filename, hash
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
    const hash = dataStr.slice(0, 20);
    dataStr = dataStr.slice(20);

    // Resolve type
    const fullPath = path.resolve(name);
    let type;
    if (fs.statSync(fullPath).isFile()) {
      type = "blob";
    } else if (fs.statSync(fullPath).isDirectory()) {
      type = "tree";
    }

    entries.push({ mode, type, name, hash });
  }

  // Output the names of the files and directories
  const response = entries
    .forEach((i) => `${i.mode} ${i.type} ${i.hash} ${i.name}`)
    .join("\n"); // Removed the trailing newline for better handling
  if (response) {
    process.stdout.write(response + "\n"); // Append newline here
    return entries;
  } else {
    throw new Error("No valid entries found");
  }
}

module.exports = readTree;
