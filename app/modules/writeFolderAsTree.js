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
        hash: writeFolderAsTree(fullPath),
      });
    }
  }

  // Write content into byte buffer to preserve string structure in byte
  const { hash, content } = createTreeContent(entries, true);
  writeGitObject(hash, content, process.cwd());

  if (hash) {
    return hash;
  } else {
    throw new Error("Error writing tree, no hash retrieved");
  }
}

module.exports = writeFolderAsTree;
