
    elif command == "clone":
        url = sys.argv[2]
        target_dir = sys.argv[3]
        os.mkdir(target_dir)
        os.mkdir(target_dir + "/.git")
        os.mkdir(target_dir + "/.git/objects/")
        os.mkdir(target_dir + "/.git/refs")
        with open(target_dir + "/.git/HEAD", "w") as f:
            f.write("ref: refs/heads/master\n")
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
        print(pack_resp.status)
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
                commit_hash = hashlib.sha1(obj_write_data).hexdigest()
                f_path = target_dir + f"/.git/objects/{commit_hash[:2]}"
                if not os.path.exists(f_path):
                    os.mkdir(f_path)
                with open(
                    target_dir + f"/.git/objects/{commit_hash[:2]}/{commit_hash[2:]}",
                    "wb",
                ) as f:
                    f.write(zlib.compress(obj_write_data))
                objs[commit_hash] = (content, obj_type)
                compressed_len = zlib.compress(content)
                seek += len(compressed_len)
            else:
                k = data[seek : seek + 20]
                print(k.hex())
                obs_elem = objs[k.hex()]
                base = obs_elem[0]
                seek += 20
                delta = zlib.decompress(data[seek:])
                compressed_data = zlib.compress(delta)
                content = undeltify(delta, base)
                obj_type = obs_elem[1]
                obj_type_to_str = {1: "commit", 2: "tree", 3: "blob"}
                obj_write_data = (
                    f"{obj_type_to_str[obj_type]} {len(content)}\0".encode()
                )
                obj_write_data += content
                commit_hash = hashlib.sha1(obj_write_data).hexdigest()
                f_path = target_dir + f"/.git/objects/{commit_hash[:2]}"
                if not os.path.exists(f_path):
                    os.mkdir(f_path)
                with open(
                    target_dir + f"/.git/objects/{commit_hash[:2]}/{commit_hash[2:]}",
                    "wb",
                ) as f:
                    f.write(zlib.compress(obj_write_data))
                objs[commit_hash] = (content, obj_type)
                seek += len(compressed_data)
        with open(
            target_dir + f"/.git/objects/{pack_hash[:2]}/{pack_hash[2:]}", "rb"
        ) as f:
            commit = f.read()
        raw_bytes = zlib.decompress(commit)
        commit_as_arr = raw_bytes.decode().split("\n")
        tree_sha = commit_as_arr[0].split(" ")[-1]
        print("tree_sha", tree_sha)
        sha_len = 20
        def checkout_tree(sha, file_path):
            if not os.path.exists(file_path):
                os.mkdir(file_path)
            with open(target_dir + f"/.git/objects/{sha[:2]}/{sha[2:]}", "rb") as ff:
                tree = zlib.decompress(ff.read())
            entries = []
            tree = tree[tree.index(b"\x00") + len(b"\x00") :]
            while tree:
                pos = tree.index(b"\x00")
                mode_name = tree[:pos]
                mode, name = mode_name.split(b" ")
                tree = tree[pos + len(b"\x00") :]
                sha = tree[:sha_len]
                tree = tree[sha_len:]
                entries.append((mode, name.decode(), sha.hex()))
            for entry in entries:
                if entry[0] == b"40000":
                    checkout_tree(entry[2], file_path + f"/{entry[1]}")
                else:
                    blob_sha = entry[2]
                    with open(
                        target_dir + f"/.git/objects/{blob_sha[:2]}/{blob_sha[2:]}",
                        "rb",
                    ) as blob_file:
                        blob_data = zlib.decompress(blob_file.read())
                    content = blob_data[blob_data.index(b"\x00") + len(b"\x00") :]
                    with open(file_path + f"/{entry[1]}", "w") as w_file:
                        w_file.write(content.decode())
        checkout_tree(tree_sha, target_dir)
        for subdir, dirs, files in os.walk("."):
            print(subdir, dirs, files)