const path = require("path");

function resolveGitObjectPath(hash) {
  const dirName = hash.slice(0, 2);
  const fileName = hash.slice(2);
  return path.join(".git", "objects", dirName, fileName);
}

module.exports = resolveGitObjectPath(hash);
