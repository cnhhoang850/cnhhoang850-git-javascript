const path = require("path");
const init = require("./modules/init");
const clone = require("./modules/clone");
const checkout = require("./modules/checkout");
const catFile = require("./modules/catFile");
const catTree = require("./modules/catTree");
const writeBlob = require("./modules/writeBlob");
const writeTree = require("./modules/writeTree");

// You can use print statements as follows for debugging, they'll be visible when running tests.
// Uncomment this block to pass the first stage
const command = process.argv[2];
let argvs = process.argv.slice(3);
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
    result = checkout(argvs[0], argvs[2], argvs[4]);
    break;

  case "clone":
    let cloneDir = path.join(base_path, argvs[1]);
    result = clone(argvs[0], cloneDir);
    break;

  default:
    throw new Error(`Unknown command ${command}`);
}

// git commitTree <treSHA> -p <commitSHA> -m <message>
// objects are always better than strings in processing variables
