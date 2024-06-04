const path = require("path");

function resolveGitObjectPath(hash, basePath = "") {
  const dirName = hash.slice(0, 2);
  const fileName = hash.slice(2);
  return path.join(basePath, ".git", "objects", dirName, fileName);
}

module.exports = resolveGitObjectPath;
