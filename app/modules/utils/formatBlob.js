function formatBlob(content) {
  content = content.toString();

  let data = `blob ${content.length}\0` + content;

  return data;
}

module.exports = formatBlob;
