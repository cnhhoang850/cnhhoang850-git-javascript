const fs = require("fs");
const path = require("path");
const writeBlob = require("./writeBlob");
const { writeGitObject, createTreeContent } = require("./utils");

function writeFolderAsTree(basePath = "") {
  // Read all files and dir in git dir
  const gitDirectory = basePath ? basePath : process.cwd();
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
        hash: writeFolderAsTree(path.join(gitDirectory, fullPath)),
      });
    }
  }

  // Write content into byte buffer to preserve string structure in byte
  const { treeHash, treeContents } = createTreeContent(entries);
  writeGitObject(treeHash, treeContents, basePath);

  if (treeHash) {
    process.stdout.write(treeHash + "\n");
    return treeHash;
  } else {
    throw new Error("Error writing tree, no hash retrieved");
  }
}

module.exports = writeFolderAsTree;
