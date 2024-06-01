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
  const headers = { "Content-Type": "application/x-git-upload-pack-request" };
  const packRes = await axios.post(url + git_pack_post_url, hashToSend, {
    headers,
  });
  const packResData = packRes.data;
  console.log(packResData);

  // get actual pack file
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
