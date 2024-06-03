const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
const crypto = require("crypto");
const https = require("https");
const axios = require("axios");

async function clone(url, dirName) {
  //  fs.mkdirSync(path.resolve(dirName));
  //createGitDirectory(dirName);
  const git_pack_url = "/info/refs?service=git-upload-pack";
  const git_pack_post_url = "/git-upload-pack";
  let packHash = ""; // don't know why i need this yet

  const packHashRes = await axios.get(url + git_pack_url);

  // get commit saved in server Hash
  const packHashData = packHashRes.data;
  const packHashDataArr = packHashData.split("\n");
  for (let item of packHashDataArr) {
    if (item.includes("refs/heads/master") && item.includes("003f")) {
      const tupple = item.split(" ");
      packHash = tupple[0].substring(4); // Use assignment instead of concatenation
      break; // Exit the loop once the hash is found
    }
  }

  // why 00000009done ?
  const hashToSend = Buffer.from(
    `0032want ${packHash}\n00000009done\n`,
    "utf8",
  );
  const headers = {
    "Content-Type": "application/x-git-upload-pack-request",
    "accept-encoding": "gzip,deflate",
  };
  const packRes = await axios.post(url + git_pack_post_url, hashToSend, {
    headers,
    responseType: "arraybuffer",
  });
  const packResData = packRes.data;
  let packFileContent = packResData.slice(20);
  let [entries, content] = decodePackFile(packResData);

  console.log(packResData.slice(0, 40), " THIS IS PACK RES NO SLICED");
  console.log(packFileContent.slice(0, 40), " THIS IS PACK RES DATA");

  const TYPE_CODES = {
    1: "commit",
    2: "tree",
    3: "blob",
    // Add other types as needed
  };

  let objects = {};
  let seek = 0;
  let count = 0;
  let bshift = 4;
  entries = entries.readUInt32BE(0);
  // find entries objects in data
  while (count != 300) {
    count++;
    let header = readObjectHeader(content, seek);
    console.log(header);
    seek = header.seek++;
    if (header.obj_type > 0 && header.obj_type < 5) {
      decompressBuffer(content.slice(seek))
        .then((data) => {
          console.log(
            "Decompressed data:",
            data.toString(),
            "type",
            header.obj_type,
          );
          objects[count] = { type: header.obj_type, data: data.toString() };

          let decompressLength = 0;
          while (decompressLength < data.length) {
            seek++;
            decompressLength++;
          }
        })
        .catch((err) => {});
    }
  }
}

function readObjectHeader(content, seek) {
  let byt = content[seek];
  let obj_type = (byt & 112) >> 4; // Extracting bits 4-6 for type
  let obj_size = byt & 0x0f; // Extracting bits 0-3 for initial size
  seek++;
  let bshift = 4;

  // Read the size continuation bytes
  while (byt > 128) {
    byt = content[seek];
    obj_size |= (byt & 0x7f) << bshift;
    bshift += 7;
    seek++;
  }

  return { obj_type, obj_size, seek };
}

function decompressBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const zlibStream = zlib.createInflate();
    let output = Buffer.alloc(0);

    zlibStream.on("data", (chunk) => {
      output = Buffer.concat([output, chunk]);
      zlibStream.end();
    });

    zlibStream.on("end", () => {
      resolve(output);
    });

    zlibStream.on("error", (err) => {
      reject(err);
    });

    // Write the entire buffer to the zlib stream
    zlibStream.write(buffer);
    zlibStream.end();
  });
}

function read_record(buffer, offset) {
  const { type, size, newOffset } = read_record_header(buffer, offset);
  const decompressedData = read_zlib_stream(buffer, newOffset, size);
  return { recordType: TYPE_CODES[type], data: decompressedData };
}

function read_zlib_stream(buffer, offset, size) {
  // Extract the compressed data
  const compressedData = buffer.slice(offset, offset + size);

  // Decompress the data
  const decompressedData = zlib.inflateSync(compressedData);

  return decompressedData;
}

function readVarIntLE(buffer, offset) {
  let value = 0;
  let shift = 0;
  let byte;
  let newOffset = offset;
  do {
    byte = buffer[newOffset++];
    value |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return { value, newOffset };
}

function read_record_header(buffer, offset) {
  const { value: byte, newOffset: sizeOffset } = readVarIntLE(buffer, offset);
  const { value: size, newOffset } = readVarIntLE(buffer, sizeOffset);
  const type = (byte >> 4) & 0x7;
  return { type, size, newOffset };
}

function decodePackFile(data) {
  console.log(Buffer.from(data));
  const signatureData = Buffer.from(data.slice(7, 12));
  console.log(signatureData.toString("utf8"));
  const version = Buffer.from(data.slice(12, 16));
  console.log(version.readUInt32BE(0), "THIS IS VERSION");
  const entries = Buffer.from(data.slice(16, 20));
  console.log(entries.readUInt32BE(0), "Entries count");
  const content = Buffer.from(data.slice(20, data.length - 21));
  const checkSum = data.slice(data.length - 20);
  console.log(checkSum.toString("hex"), "legnth of hex", checkSum.length);
  return [entries, content];
}

function readUInt32BE(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function readUInt8(buffer, offset) {
  return buffer.readUInt(8);
}

clone("https://github.com/cnhhoang850/better-nc-quoc-te", "ncqt");

function createGitDirectory(dirName = null) {
  let repoFolder;
  if (dirName) {
    repoFolder = path.resolve(dirName);
  } else {
    repoFolder = process.cwd();
  }

  fs.mkdirSync(path.join(repoFolder, ".git"), { recursive: true });
  fs.mkdirSync(path.join(repoFolder, ".git", "objects"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(repoFolder, ".git", "refs"), { recursive: true });

  fs.writeFileSync(
    path.join(repoFolder, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  console.log("Initialized git directory");
}
