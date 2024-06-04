const sha1 = require("./utils/sha1");
const writeGitObject = require("./utils/writeGitObject");

function getFormattedUtcOffset() {
  const date = new Date();
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
  const offsetMinutesRemainder = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes < 0 ? "-" : "+";
  const formattedOffset = `${sign}${offsetHours
    .toString()
    .padStart(2, "0")}${offsetMinutesRemainder.toString().padStart(2, "0")}`;
  return formattedOffset;
}

function commitObject(
  tree_hash,
  commit_hash,
  message,
  basePath = "",
  author = "",
  committer = "",
) {
  // Tree objects
  let contents = Buffer.from("tree " + tree_hash + "\n");

  // Check for parent
  if (commit_hash) {
    contents = Buffer.concat([
      contents,
      Buffer.from("parent " + commit_hash + "\n"),
    ]);
  }

  // Generate time of commit
  let seconds = new Date().getTime() / 1000;
  const utcOffset = getFormattedUtcOffset();

  // Personal info
  contents = Buffer.concat([
    contents,
    Buffer.from("author " + author + "  " + seconds + " " + utcOffset + "\n"),
    Buffer.from(
      "committer " + committer + " " + seconds + " " + utcOffset + "\n",
    ),
    Buffer.from("\n"),
    Buffer.from(message + "\n"),
  ]);

  // Commit header
  let finalContent = Buffer.concat([
    Buffer.from("commit " + contents.length + "\0"),
    contents,
  ]);

  // Calculate commit object sha and write
  let new_object_path = sha1(finalContent);

  let hash = writeGitObject(new_object_path, finalContent, basePath);

  if (hash) {
    process.stdout.write(hash + "\n");
    return hash;
  } else {
    throw new Error("Something wrong during writing commit");
  }
}

module.exports = commitObject;
