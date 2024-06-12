const path = require("path");
const init = require("./modules/init");
const clone = require("./modules/clone");
const createCommit = require("./modules/createCommit");
const catFile = require("./modules/catFile");
const catTree = require("./modules/catTree");
const writeBlob = require("./modules/writeBlob");
const writeTree = require("./modules/writeFolderAsTree");

// You can use print statements as follows for debugging, they'll be visible when running tests.
// Uncomment this block to pass the first stage
const command = process.argv[2];
const argvs = process.argv.slice(3);
const base_path = process.cwd();

switch (command) {
  case "init":
    let result;
    init();
    break;

  case "cat-file":
    switch (argvs.length) {
      case 1:
        result = catFile(argvs[0]);
        break;
      case 2:
        result = catFile(argvs[1]);
        break;
    }
    break;

  case "hash-object":
    switch (argvs.length) {
      case 1:
        result = writeBlob(true, argvs[0]);
        break;
      case 2:
        result = writeBlob(true, argvs[0]);
        break;
    }
    break;

  case "ls-tree":
    switch (argvs.length) {
      case 1:
        result = catTree(argvs[0]);
        break;
      case 2:
        result = catTree(argvs[1]);
        break;
    }
    break;

  case "write-tree":
    result = writeTree();
    break;

  case "commit-tree":
    result = createCommit(argvs[0], argvs[2], argvs[4]);
    break;

  case "clone":
    result = clone(argvs[0], argvs[1]);
    break;

  default:
    throw new Error(`Unknown command ${command}`);
}

// git commitTree <treSHA> -p <commitSHA> -m <message>
// objects are always better than strings in processing variables
