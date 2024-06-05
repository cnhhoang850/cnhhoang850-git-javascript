const zlib = require("node:zlib");
const axios = require("axios");
const sha1 = require("./utils/sha1");
const path = require("path");
const writeBlob = require("./writeBlob");
const parseTree = require("./parseGitTree");

clone("https://github.com/cnhhoang850/testGitRepo", "test");

async function clone(url, directory) {
  const gitDir = path.resolve(directory);
  const [objects, checkSum] = await fetch_git_objects(url);
  let trees = objects.filter((e) => e.type == "tree");
  let blobs = objects.filter((e) => e.type == "blob");
  let commits = objects.filter((e) => e.type == "commit");
  console.log(objects);
}

async function git_upload_pack_hash_discovery(url) {
  const git_pack_url = "/info/refs?service=git-upload-pack";
  const response = await axios.get(url + git_pack_url);
  const data = response.data;
  let hash = "";

  for (let line of data.split("\n")) {
    if (
      (line.includes("refs/heads/master") ||
        line.includes("refs/heads/main")) &&
      line.includes("003")
    ) {
      const tupple = line.split(" ");
      hash = tupple[0].substring(4);
      break;
    }
  }
  return hash;
}

async function git_request_pack_file(url, hash) {
  const git_pack_post_url = "/git-upload-pack";
  const hashToSend = Buffer.from(`0032want ${hash}\n00000009done\n`, "utf8");
  const headers = {
    "Content-Type": "application/x-git-upload-pack-request",
    "accept-encoding": "gzip,deflate",
  };

  const response = await axios.post(url + git_pack_post_url, hashToSend, {
    headers,
    responseType: "arraybuffer", // everything in buffer already
  });

  return response;
}

async function fetch_git_pack(url) {
  //  fs.mkdirSync(path.resolve(dirName));
  //createGitDirectory(dirName);
  const packHash = await git_upload_pack_hash_discovery(url);
  const packRes = await git_request_pack_file(url, packHash);
  // why 00000009done ?
  // problem, not all data sent have the pack files at the same locations
  return packRes.data;
}

async function fetch_git_objects(url) {
  //console.log("THIS IS PACK RES DATA", packResData.toString());
  const packFile = await fetch_git_pack(url);
  let packObjects = packFile.slice(20);
  entries = Buffer.from(packFile.slice(16, 20)).readUInt32BE(0);

  let i = 0;
  let objs = [];
  for (let count = 0; count < entries; count++) {
    let [byte_read, obj] = await read_pack_object(packObjects, i);
    i += byte_read;
    objs.push(obj);
  }
  //console.log(`FOUND ${entries} ENTRIES`);
  //objs.forEach((e) => console.log(e));
  //console.log(`THERE ARE ${objs.length} OBJECTS DECODED`);
  let checkSum = packObjects.slice(packObjects.length - 20).toString("hex");
  i += 20; // final checksum length
  console.log(`BYTES READ: ${i}, BYTES RECEIVED: ${packObjects.length}`);
  //console.log(objs);
  return [objs, checkSum];
}

async function read_pack_object(buffer, i) {
  // Parse the body of object after header
  // i is the location read in the buffer
  // parsed_byte is the total bytes read from the object
  const TYPE_CODES = {
    1: "commit",
    2: "tree",
    3: "blob",
  };

  let [parsed_bytes, type, size] = read_pack_header(buffer, i);
  //console.log(`Parsed ${parsed_bytes} bytes found type ${type} and size ${size}`,);

  i += parsed_bytes;
  //console.log(`Object starting at ${i} ${buffer[i]}`);
  if (type < 7 && type != 5) {
    const [gzip, used] = await decompressFile(buffer.slice(i), size);
    //console.log(gzip.toString("utf-8"), gzip.length);
    //console.log("THIS IS PARSED", parsed_bytes, gzip.toString());
    return [
      parsed_bytes + used,
      { content: gzip.toString(), type: TYPE_CODES[type] },
    ];
  } else if (type == 7) {
    // if delta refs then there will be a 20 bytes hash at the start
    let ref = buffer.slice(i, i + 20);
    parsed_bytes += 20;
    i += 20;
    let [gzip, used] = await decompressFile(buffer.slice(i), size);
    return [
      parsed_bytes + used,
      { content: gzip.toString(), type: type, ref: ref.toString("hex") },
    ];
  }
}

function read_pack_header(buffer, i) {
  // Parse pack file header: type + size

  cur = i;
  type = (buffer[cur] & 112) >> 4;
  size = buffer[cur] & 15;
  offset = 4;

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
    //console.log("Used data length:", used);
    return [decompressedData, used];
  } catch (err) {
    //console.error("Decompression failed:", err.message);
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
