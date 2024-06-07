const zlib = require("node:zlib");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const writeBlob = require("./writeBlob");
const parseTree = require("./parseGitTree");
const init = require("./init");

process.removeAllListeners("warning"); // remove deprecation warnings

const {
  sha1,
  writeGitObject,
  readGitObject,
  createTreeContent,
  parseTreeEntries,
  createBlobContent,
  createCommitContent,
} = require("./utils");

function resolveDeltaObject(hash, instructions, dir) {
  // Read the target object
  const { type, length, content } = readGitObject(hash, dir);

  const contentToWrite = decode_delta(instructions, content);
}

clone("https://github.com/cnhhoang850/testGitRepo", "test");

async function clone(url, directory) {
  const gitDir = path.resolve(directory);
  // fs.mkdirSync(gitDir);
  // init(gitDir);

  const [objects, checkSum, head] = await fetchGitObjects(url);
  const treeObjects = objects.filter((e) => e.type === "tree");
  const blobObjects = objects.filter((e) => e.type === "blob");
  const commitObjects = objects.filter((e) => e.type === "commit");

  // Format pack content into git objects
  const treeContents = treeObjects.map((tree) =>
    createTreeContent(parseTreeEntries(tree.content)),
  );
  const blobContents = blobObjects.map((blob) =>
    createBlobContent(blob.content),
  );
  const commitContents = commitObjects.map((commit) =>
    createCommitContent(commit.content),
  );

  for (const obj of objects) {
    if (obj.type === 7) {
      console.log(obj);
      console.log(treeContents);
    }
  }

  /// / Write to git object
  // for (let i of [treeContents, blobContents, commitContents]) {
  //  for (let { hash, content } of i) {
  //    console.log("Item: ", i, "with hash: ", hash);
  //    let res = writeGitObject(hash, content, gitDir);
  //  }
  // }

  // Write HEAD
  // fs.writeFileSync(
  //  path.join(gitDir, ".git", "HEAD"),
  //  `ref: ${head.ref}`,
  // )

  // Write refs
  // fs.mkdirSync(path.join(gitDir, ".git", "refs", "heads"), { recursive: true });
  // fs.writeFileSync(
  //  path.join(gitDir, ".git", "refs", "heads", ref.split("/")[2]),
  //  head.hash,
  // )

  /// / Find most recent commit
  let currentCommit = commitContents.filter((c) => c.hash === head.hash)[0];
  currentCommit = currentCommit.content.toString().split("\n");
  // console.log(currentCommit);

  /// / Find the tree of the most recent commit
  const currentTree = currentCommit[0].split(" ")[2]; // due to head
  // currentTree = treeContents.filter((t) => t.hash == currentTree)[0];
  // console.log(currentTree, currentCommit);
  for (const tree of treeObjects) {
    // console.log(tree.content.toString());
  }

  /// / Parse entries
  // let nullIndex = currentTree.content.indexOf("\0");
  // currentTree = currentTree.content.slice(nullIndex + 1);
  // let currentEntries = parseTreeEntries(currentTree);
  // TODO: Solve delta 7 dif to build the main tree
}

async function gitUploadPackHashDiscovery(url) {
  const gitPackUrl = "/info/refs?service=git-upload-pack";
  const response = await axios.get(url + gitPackUrl);
  const data = response.data;
  let hash = "";
  let ref = "";

  for (const line of data.split("\n")) {
    if (
      (line.includes("refs/heads/master") ||
        line.includes("refs/heads/main")) &&
      line.includes("003")
    ) {
      const tupple = line.split(" ");
      hash = tupple[0].substring(4);
      ref = tupple[1];
      break;
    }
  }
  return { packHash: hash, ref };
}

async function gitRequestPackFile(url, hash) {
  const gitPackPostUrl = "/git-upload-pack";
  const hashToSend = Buffer.from(`0032want ${hash}\n00000009done\n`, "utf8");
  const headers = {
    "Content-Type": "application/x-git-upload-pack-request",
    "accept-encoding": "gzip,deflate",
  };

  const response = await axios.post(url + gitPackPostUrl, hashToSend, {
    headers,
    responseType: "arraybuffer", // everything in buffer already
  });

  return response;
}

async function fetchGitPack(url) {
  //  fs.mkdirSync(path.resolve(dirName));
  // createGitDirectory(dirName);
  const { packHash, ref } = await gitUploadPackHashDiscovery(url);
  const packRes = await gitRequestPackFile(url, packHash);
  // why 00000009done ?
  // problem, not all data sent have the pack files at the same locations
  return { data: packRes.data, head: { ref, hash: packHash } };
}

async function fetchGitObjects(url) {
  // console.log("THIS IS PACK RES DATA", packResData.toString());
  const { data, head } = await fetchGitPack(url);
  const packFile = data;
  const packObjects = packFile.slice(20);
  const entries = Buffer.from(packFile.slice(16, 20)).readUInt32BE(0);

  let i = 0;
  const objs = [];
  for (let count = 0; count < entries; count++) {
    const [byteRead, obj] = await readPackObject(packObjects, i);
    i += byteRead;
    objs.push(obj);
  }
  // console.log(`FOUND ${entries} ENTRIES`);
  // objs.forEach((e) => console.log(e));
  // console.log(`THERE ARE ${objs.length} OBJECTS DECODED`);
  const checkSum = packObjects.slice(packObjects.length - 20).toString("hex");
  i += 20; // final checksum length
  console.log(`BYTES READ: ${i}, BYTES RECEIVED: ${packObjects.length}`);
  // console.log(objs);
  return [objs, checkSum, head];
}

async function readPackObject(buffer, i) {
  // Parse the body of object after header
  // i is the location read in the buffer
  // parsed_byte is the total bytes read from the object
  const TYPE_CODES = {
    1: "commit",
    2: "tree",
    3: "blob",
  };

  let [parsedBytes, type, size] = readPackHeader(buffer, i);
  // console.log(`Parsed ${parsed_bytes} bytes found type ${type} and size ${size}`,);

  i += parsedBytes;
  // console.log(`Object starting at ${i} ${buffer[i]}`);
  if (type < 7 && type != 5) {
    const [gzip, used] = await decompressFile(buffer.slice(i), size);
    // console.log(gzip.toString("utf-8"), gzip.length);
    // console.log("THIS IS PARSED", parsed_bytes, gzip.toString());
    return [parsedBytes + used, { content: gzip, type: TYPE_CODES[type] }];
  } else if (type == 7) {
    // if delta refs then there will be a 20 bytes hash at the start
    const ref = buffer.slice(i, i + 20);
    parsedBytes += 20;
    i += 20;
    const [gzip, used] = await decompressFile(buffer.slice(i), size);
    return [parsedBytes + used, { content: gzip, type, ref }];
  }
}

function readPackHeader(buffer, i) {
  // Parse pack file header: type + size

  let cur = i;
  const type = (buffer[cur] & 112) >> 4;
  let size = buffer[cur] & 15;
  let offset = 4;

  while (buffer[cur] >= 128) {
    cur++;
    size += (buffer[cur] & 127) << offset;
    offset += 7;
  }
  return [cur - i + 1, type, size];
}

async function decompressFile(buffer, size) {
  try {
    const [decompressedData, used] = await inflateWithLengthLimit(buffer, size);
    // console.log("Used data length:", used);
    return [decompressedData, used];
  } catch (err) {
    // console.error("Decompression failed:", err.message);
    throw err;
  }
}

function inflateWithLengthLimit(compressedData, maxOutputSize) {
  return new Promise((resolve, reject) => {
    const inflater = new zlib.createInflate();
    let decompressedData = Buffer.alloc(0);
    let parsedBytes = 0;

    inflater.on("data", (chunk) => {
      decompressedData = Buffer.concat([decompressedData, chunk]);
      if (decompressedData.length > maxOutputSize) {
        inflater.emit(
          "error",
          new Error("Decompressed data exceeds maximum output size"),
        );
      }
    });

    inflater.on("end", () => {
      // The total input length minus the remaining buffer length
      parsedBytes = inflater.bytesRead;
      resolve([decompressedData, parsedBytes]);
    });

    inflater.on("error", (err) => {
      reject(err);
    });

    inflater.write(compressedData);
    inflater.end();
  });
}

module.exports = clone;

// My decompression code is correct
