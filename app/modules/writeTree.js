const fs = require("fs");
const path = require("path");
const writeBlob = require("./writeBlob");
const writeGitObject = require("./utils/writeGitObject");

function writeTree() {
  // Read all files and dir in git dir
  const gitDirectory = process.cwd();
  const filesAndDirs = fs
    .readdirSync(gitDirectory)
    .filter((f) => f !== ".git" && f !== "main.js");

  // Process files and dirs
  const entries = [];
  for (const file of filesAndDirs) {
    const fullPath = path.join(gitDirectory, file);
    if (fs.statSync(fullPath).isFile()) {
      entries.push({
        mode: 100644,
        name: file,
        hash: writeBlob(true, fullPath),
      });
    } else {
      entries.push({
        mode: 40000,
        name: file,
        hash: writeTree(path.join(root, file)),
      });
    }
  }

  // Write content into byte buffer to preserve string structure in byte
  const contents = entries.reduce((acc, { mode, name, hash }) => {
    return Buffer.concat([
      acc,
      Buffer.from(`${mode} ${name}\0`), // Header always separated with data by \0
      Buffer.from(hash, "hex"),
    ]);
  }, Buffer.alloc(0));

  // Attach header
  const treeContents = Buffer.concat([
    Buffer.from(`tree ${contents.length}\x00`),
    contents,
  ]);

  // Create content hash
  const treeHash = sha1(treeContents);
  writeGitObject(treeHash, treeContents);

  if (treeHash) {
    process.stdout.write(treeHash + "\n");
    return treeHash;
  } else {
    throw new Error("Error writing tree, no hash retrieved");
  }
}

module.exports = writeTree;
