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
  const contentToWrite = decodeDelta(instructions, content);
}

function decodeDelta(instructions, refContent) {
  content = Buffer.alloc(0);
  let i = 0;

  // Parse first two size encodings
  let { parsedBytes: refParsedBytes, size: refSize } = parseSize(
    instructions,
    i,
  );
  console.log("-----------------------------------");
  console.log("PARSED REF SIZE AT OFFSET ", i, " FOUND SIZE ", refSize);
  i += refParsedBytes;

  let { parsedBytes: targetParsedBytes, size: targetSize } = parseSize(
    instructions,
    i,
  );
  console.log("PARSED TARGET SIZE AT OFFSET ", i, " FOUND SIZE ", targetSize);
  console.log("-----------------------------------");
  i += targetParsedBytes;
  console.log("\n");

  console.log("PARSING INSTRUCTIONS: ");
  console.log("-----------------------------------");
  while (i < instructions.length) {
    if (instructions[i] <= 127) {
      let { parsedBytes, insertContent } = parseInsert(instructions, i);
      content = Buffer.concat([content, insertContent]);
      i += parsedBytes;

      console.log(
        "     AT OFFSET: ",
        i,
        "INSERTING: ",
        insertContent.length,
        "BYTES FROM INSTRUCTIONS",
      );

      console.log("     CONTENT: ", insertContent.toString());
      console.log("-----------------------------------");
    } else if (instructions[i] > 127 && instructions[i] < 256) {
      let { parsedBytes, offset, size } = parseCopy(instructions, i);
      let copyContent = refContent.slice(offset, offset + size);
      content = Buffer.concat([content, copyContent]);
      i += parsedBytes;

      console.log(
        "     AT OFFSET: ",
        i,
        "COPYING:",
        size,
        "BYTES FROM REF",
        "AT OFFSET: ",
        offset,
      );
      console.log("     CONTENT: ", copyContent.toString());

      console.log("-----------------------------------");
    } else {
      throw new Error("Not copy or insert");
    }
  }

  console.log("PARSED: ", i, "RECEIVED: ", instructions.length);
  console.log("\n");

  return content;
}

function parseInsert(data, i) {
  /*
  Parse insert instruction
  */

  const size = data[i];
  let parsedBytes = 1;
  i += parsedBytes;
  const insertContent = data.slice(i, i + size);
  parsedBytes += size;
  return { parsedBytes, insertContent };
}

function parseCopy(data, i) {
  let offSetBytes = [];
  let sizeBytes = [];
  let mask = data[i];
  let parsedBytes = 1;
  i++;

  if (mask === 0x10000) {
    sizeBytes = 0;
  }

  for (let k = 0; k < 7; k++) {
    if (k < 4) {
      if (mask & (1 << k)) {
        offSetBytes.push(data[i]);
        i++;
        parsedBytes++;
      } else {
        offSetBytes.push(0);
      }
    } else if (k >= 4) {
      if (mask & (1 << k)) {
        sizeBytes.push(data[i]);
        i++;
        parsedBytes++;
      } else {
        sizeBytes.push(0);
      }
    }
  }

  let offset = 0;
  let size = 0;

  for (let [index, value] of offSetBytes.entries()) {
    offset += value << (index * 8);
  }

  for (let [index, value] of sizeBytes.entries()) {
    size += value << (index * 8);
  }

  //Remove the MSB from the first byte
  const remainingBits = mask & 0x7f; // 0x7F = 01111111
  //Reverse the 7 bits to little-endian
  let reversedBits = 0;
  for (let i = 0; i < 7; i++) {
    if ((remainingBits & (1 << i)) !== 0) {
      reversedBits |= 1 << (6 - i);
    }
  }

  let reversedMSB = reversedBits.toString(2).padStart(7, "0");

  return {
    parsedBytes,
    offset,
    size,
  };
}

function parseSize(data, i) {
  size = data[i] & 127;
  parsedBytes = 1;
  offset = 7;

  while (data[i] > 127) {
    i++;
    size += (data[i] & 127) << offset;
    parsedBytes++;
    offset += 7;
  }
  return { parsedBytes, size };
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
  const treeContents = treeObjects.map((tree) => {
    return {
      parsed: createTreeContent(parseTreeEntries(tree.content)),
      raw: tree,
    };
  });

  console.log("TREES RETRIEVED");
  console.log("-----------------------------------");
  treeContents.forEach((tree) => {
    console.log(tree.parsed.hash);
  });
  console.log("\n");

  const blobContents = blobObjects.map((blob) =>
    createBlobContent(blob.content),
  );

  console.log("BLOBS RETRIEVED");
  console.log("-----------------------------------");
  blobContents.forEach((blob) => {
    console.log(blob.hash);
  });
  console.log("\n");

  const commitContents = commitObjects.map((commit) =>
    createCommitContent(commit.content),
  );

  console.log("COMMITS RETRIEVED");
  console.log("-----------------------------------");
  commitContents.forEach((com) => {
    console.log(com.hash);
  });
  console.log("\n");

  let deltifiedTree;

  for (const obj of objects) {
    if (obj.type === 7) {
      let ref = obj.ref.toString("hex");
      let instructions = obj.content;
      for (let tree of treeContents) {
        if (tree.parsed.hash === ref) {
          let raw = tree.raw.content;
          deltifiedTree = decodeDelta(instructions, raw);
          console.log(parseTreeEntries(deltifiedTree), "THIS IS DELTA");
        }
      }
    }
  }
  // let nullIndex = deltaContent.indexOf("\0");
  // let deltaTreeContent = deltaContent.slice(nullIndex + 1);
  // let deltaEntries = parseTreeEntries(deltaTreeContent);
  // console.log(deltaEntries, deltaContent.toString());

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

async function getPackFileHash(url) {
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

async function getPackFile(url, hash) {
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
  const { packHash, ref } = await getPackFileHash(url);
  const packRes = await getPackFile(url, packHash);
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
    const [gzip, used] = await decompressFile(buffer.slice(i + 20), size);
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
