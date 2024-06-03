import urllib.request as request
import zlib as zlib
url =url = "https://github.com/cnhhoang850/better-nc-quoc-te"

resp = request.urlopen(url + "/info/refs?service=git-upload-pack")
content = resp.read()
resp.close()
resp_as_arr = content.split(b"\n")
for c in resp_as_arr:
    if b"refs/heads/master" in c and b"003f" in c:
        tup = c.split(b" ")
        pack_hash = tup[0][4:].decode()
post_url = url + "/git-upload-pack"
req = request.Request(post_url)
req.add_header("Content-Type", "application/x-git-upload-pack-request")
data = f"0032want {pack_hash}\n00000009done\n".encode()
pack_resp = request.urlopen(req, data=data)
pack_resp = pack_resp.read()
entries_bytes = pack_resp[16:20]
num_entries = int.from_bytes(entries_bytes, byteorder="big")
print("entries count", num_entries)
data = pack_resp[20:-20]
objs = {}
seek = 0
objs_count = 0
while objs_count != num_entries:
    objs_count += 1
    first = data[seek]
    obj_type = (first & 112) >> 4
    while data[seek] > 128:
        seek += 1
    seek += 1
    if obj_type < 7:
        content = zlib.decompress(data[seek:])
        obj_type_to_str = {1: "commit", 2: "tree", 3: "blob"}
        obj_write_data = (
            f"{obj_type_to_str[obj_type]} {len(content)}\0".encode()
        )
        obj_write_data += content
        compressed_len = zlib.compress(content)
        seek += len(compressed_len)
