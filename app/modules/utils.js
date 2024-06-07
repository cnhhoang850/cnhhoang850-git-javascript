const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
const crypto = require("crypto");

function writeGitObject(hash, content, basePath = "") {
  // Receive a SHA1 hash and file content and write a new git object

  const objectFolder = hash.slice(0, 2);
  const objectName = hash.slice(2);

  if (fs.existsSync(path.join(basePath, ".git", "objects", objectFolder))) {
    throw new Error("Folder already exist");
  } else if (
    fs.existsSync(path.join(basePath, ".git", "objects", objectName))
  ) {
    throw new Error("Git object already exist");
  }

  fs.mkdirSync(path.join(basePath, ".git", "objects", objectFolder), {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(basePath, ".git", "objects", objectFolder, objectName),
    zlib.deflateSync(content),
  );

  return objectName;
}

function sha1(data) {
  const generator = crypto.createHash("sha1");
  generator.update(data);
  return generator.digest("hex");
}

function resolveGitObjectPath(hash, basePath = "") {
  const dirName = hash.slice(0, 2);
  const fileName = hash.slice(2);
  return path.join(basePath, ".git", "objects", dirName, fileName);
}

function formatBlob(content) {
  content = content.toString();
  const data = `blob ${content.length}\0` + content;
  return data;
}

function createBlobContent(data) {
  if (!data) {
    throw new Error("No data to be found");
  }

  // Attach header
  const content = Buffer.concat([Buffer.from(`blob ${data.length}\x00`), data]);

  const hash = sha1(content);

  return { hash, content };
}

function parseTreeEntries(data) {
  const result = [];
  let startIndex = 0;

  while (startIndex < data.length) {
    const modeEndIndex = data.indexOf(" ", startIndex);
    if (modeEndIndex === -1) break; // Exit loop if delimiter not found
    const mode = data.slice(startIndex, modeEndIndex).toString();

    const fileNameStartIndex = modeEndIndex + 1;
    const nullByteIndex = data.indexOf("\0", fileNameStartIndex);
    if (nullByteIndex === -1) break; // Exit loop if delimiter not found
    const fileName = data.slice(fileNameStartIndex, nullByteIndex).toString();

    const hashStartIndex = nullByteIndex + 1;
    const hashEndIndex = hashStartIndex + 20;
    const hash = data.slice(hashStartIndex, hashEndIndex).toString("hex");

    result.push({ mode, fileName, hash });

    startIndex = hashEndIndex;
  }

  return result;
}

// Take array of entries (tree pack obj) and return git tree object content and hash
function createTreeContent(entries) {
  if (!entries) {
    throw new Error("No entries to be found");
  }

  const content = entries.reduce((acc, { mode, fileName, hash }) => {
    return Buffer.concat([
      acc,
      Buffer.from(`${mode} ${fileName}\0`),
      Buffer.from(hash, "hex"),
    ]);
  }, Buffer.alloc(0));

  // Attach header
  const treeContents = Buffer.concat([
    Buffer.from(`tree ${content.length}\x00`),
    content,
  ]);

  // Create content hash
  const treeHash = sha1(treeContents);
  return { hash: treeHash, content: treeContents };
}

// Parse pack commit object
function createCommitContent(commit) {
  if (!commit) {
    throw new Error("No commit to be found");
  }

  // Attach header
  const content = Buffer.concat([
    Buffer.from(`commit ${commit.length}\x00`),
    commit,
  ]);

  const hash = sha1(content);
  return { hash, content };
}

function readGitObject(sha, basePath = "") {
  // Read git blob based on SHA1 hash
  const blobPath = path.resolve(
    basePath,
    ".git",
    "objects",
    sha.slice(0, 2),
    sha.slice(2),
  );

  const data = fs.readFileSync(blobPath);
  const dataUncompressed = zlib.unzipSync(data);

  // Find index header ends
  const nullByteIndex = dataUncompressed.indexOf("\0");
  const header = dataUncompressed.toString().slice(0, nullByteIndex).split(" ");
  const type = header[0];
  const length = header[1];
  const content = dataUncompressed.toString().slice(nullByteIndex + 1);

  if (dataUncompressed) {
    return { type, length, content };
  } else {
    throw new Error("Can't read git blob");
  }
}

module.exports = {
  resolveGitObjectPath,
  createCommitContent,
  createBlobContent,
  createTreeContent,
  parseTreeEntries,
  writeGitObject,
  readGitObject,
  formatBlob,
  sha1,
};
