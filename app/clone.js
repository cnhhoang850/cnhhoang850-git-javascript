const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
const crypto = require("crypto");
const https = require("https");
const axios = require("axios");

clone("https://github.com/cnhhoang850/better-nc-quoc-te", "ncqt");

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
  const hashToSend = Buffer.from(`0032want ${packHash}\n00000009done\n`, "utf8");
  const headers = {
    "Content-Type": "application/x-git-upload-pack-request",
    "accept-encoding": "gzip,deflate",
  };
  const packRes = await axios.post(url + git_pack_post_url, hashToSend, {
    headers,
    responseType: "arraybuffer", // everything in buffer already
  });

  const packResData = packRes.data;
  let data = packResData.slice(20, packResData.length - 20);

  entries = Buffer.from(packResData.slice(16, 20)).readUInt32BE(0);

  let types = {
    1: "commit",
    2: "tree",
    3: "blob",
  };
  let [parsed_bytes, obj] = await read_pack_object(data, 0);
  console.log("PARSED HOULD EQUAL 143", parsed_bytes);
  let [par2, obj2] = await read_pack_object(data, 143);
  let [par3, obj3] = await read_pack_object(data, 143 + 118);
  let [par4, obj4] = await read_pack_object(data, 143 + 118 + 89 + 2);
  let [par5, obj5] = await read_pack_object(data, 143 + 118 + 89 + 2 + 26);
  let res5 = await read_pack_object(data, 143 + 118 + 89 + 2 + 26 + 272);
  let res6 = await read_pack_object(data, 143 + 118 + 89 + 2 + 26 + 272 + 199);
  let res7 = await read_pack_object(
    data,
    143 + 118 + 89 + 2 + 26 + 272 + 199 + 52,
  );
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
  console.log(`Parsed ${parsed_bytes} bytes found type ${type} and size ${size}`);

  i += parsed_bytes;
  //console.log(`Object starting at ${i} ${buffer[i]}`);
  if (type < 5) {
    const [gzip, used] = await decompressFile(buffer.slice(i), size);
    //console.log(gzip.toString(), `Next parsing location at: ${parsed_bytes}`);
    console.log("THIS IS PARSED", parsed_bytes, gzip.toString());
    return [parsed_bytes + used, gzip.toString()];
  } else if (type == 7) {
    let ref = buffer.slice(i, i + 20);
    parsed_bytes += 20;
    i += 20;
    const [gzip, used] = await decompressFile(buffer.slice(i));
    parsed_bytes += used;
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
    const inflater = new zlib.Inflate();
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
