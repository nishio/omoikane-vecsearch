"""
create index from scrapbox crawl-dir file

What is crawl-dir
-----------------
crawl-dir is a directory that contains json files crawled from scrapbox.
It is created by `crawl.py` in this repository.


"""

import signal
import time
import json
import tiktoken
import openai
import pickle
import numpy as np
from tqdm import tqdm
import re
import dotenv
import os


BLOCK_SIZE = 500

dotenv.load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
enc = tiktoken.get_encoding("cl100k_base")


def get_size(text):
    return len(enc.encode(text))


def embed_texts(texts, sleep_after_sucess=1):
    EMBED_MAX_SIZE = 8150  # actual limit is 8191
    if isinstance(texts, str):
        texts = [texts]
    for i, text in enumerate(texts):
        text = text.replace("\n", " ")
        tokens = enc.encode(text)
        if len(tokens) > EMBED_MAX_SIZE:
            text = enc.decode(tokens[:EMBED_MAX_SIZE])
        texts[i] = text

    while True:
        try:
            res = openai.Embedding.create(input=texts, model="text-embedding-ada-002")
            time.sleep(sleep_after_sucess)
        except Exception as e:
            print(e)
            import pdb

            pdb.set_trace()
            time.sleep(1)
            continue
        break

    return res


def embed(text, sleep_after_sucess=0):
    # short hand for single text
    r = embed_texts(text, sleep_after_sucess=sleep_after_sucess)["data"][0]["embedding"]


def clean(line):
    line = line.strip()
    # line = re.sub(r"https?://[^\s]+", "URL", line)
    line = re.sub(r"[\s]+", " ", line)
    return line



def safe_write(obj, name):
    to_exit = False

    def change_state(signum, frame):
        nonlocal to_exit
        to_exit = True

    signal.signal(signal.SIGINT, change_state)
    pickle.dump(obj, open(name, "wb"))
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    if to_exit:
        raise KeyboardInterrupt


def update_from_scrapbox_json(
    out_index, jsonfile, cache_index=None, dry_run=False, is_public=False
):
    """
    out_index: output index file name
    jsonfile: input json file name (from scrapbox)
    in_index: input index file name (it is not modified, but used as cache)

    # usage
    ## create new index
    update_from_scrapbox(
        "nishio.pickle",
        "from_scrapbox/nishio.json")
    ## update index
    update_from_scrapbox(
        "nishio-0314.pickle", "from_scrapbox/nishio-0314.json", "nishio-0310.pickle")
    """
    tokens = 0
    api_tasks = []

    def add(body, payload):
        nonlocal tokens
        tokens += get_size(body)
        api_tasks.append((body, payload))

    cache = None
    if cache_index is not None:
        cache = VectorStore(cache_index, create_if_not_exist=False).cache
    vs = VectorStore(out_index)
    data = json.load(open(jsonfile, encoding="utf8"))

    pages = data["pages"]
    if PAGE_LIMIT > 0:
        pages = pages[:PAGE_LIMIT]
    print("processing {} pages".format(len(pages)))
    for p in tqdm(pages):
        buf = []
        title = p["title"]
        for line in p["lines"]:
            buf.append(line)
            body = clean(" ".join(buf))
            if get_size(body) > BLOCK_SIZE:
                payload = {
                    "title": title,
                    "project": project,
                    "text": "\n".join(buf),
                    "is_public": is_public,
                }
                add(body, payload)
                buf = buf[len(buf) // 2 :]
        body = clean(" ".join(buf))
        if body:
            payload = {
                "title": title,
                "project": project,
                "text": "\n".join(buf),
                "is_public": is_public,
            }
            add(body, payload)
    if dry_run:
        cost = tokens / 1000_000 * 0.4
        print("tokens:", tokens, f"cost: {cost:.2f}USD")

        in_cache = 0
        not_in_cache = 0
        for body, payload in api_tasks:
            if body in cache:
                in_cache += 1
            else:
                not_in_cache += 1
        print("in cache:", in_cache, "not in cache:", not_in_cache)

    else:
        vs.batch(api_tasks, cache)
        vs.save()


class VectorStore:
    def __init__(self, name, create_if_not_exist=True):
        self.name = name
        try:
            self.cache = pickle.load(open(self.name, "rb"))
        except FileNotFoundError as e:
            if create_if_not_exist:
                self.cache = {}
            else:
                raise

    def get_or_make(self, body, payload, cache=None):
        if cache is None:
            cache = self.cache
        if body not in cache:
            print("not in cache")
            print(payload["title"], body[:20])
            self.cache[body] = (embed(body), payload)
        elif body not in self.cache:
            # print("in cache")
            self.cache[body] = (cache[body][0], payload)
        else:
            print("already have")

        return self.cache[body]

    def get_sorted(self, query):
        q = np.array(embed(query, sleep_after_sucess=0))
        buf = []
        for body, (v, title) in tqdm(self.cache.items()):
            buf.append((q.dot(v), body, title))
        buf.sort(reverse=True)
        return buf

    def batch(self, api_tasks, cache=None):
        if cache is None:
            cache = self.cache

        to_call_api = []
        all_tasks = len(api_tasks)
        for body, payload in api_tasks:
            if body not in cache:
                # print("not in cache")
                # print(payload["title"], body[:20])
                # we need to call embedding api
                to_call_api.append((body, payload))
            elif body not in self.cache:
                # print("in cache")
                self.cache[body] = (cache[body][0], payload)
            else:
                # even if body in cache, we need to update payload
                self.cache[body] = (self.cache[body][0], payload)

        BATCH_SIZE = 50
        num_tasks = len(to_call_api)
        # make 50 requests at once
        batches = [
            to_call_api[i : i + BATCH_SIZE]
            for i in range(0, len(to_call_api), BATCH_SIZE)
        ]
        print(
            f"total tasks: {all_tasks}, ",
            f"{100 - 100 * (num_tasks / all_tasks):.1f}% was cached",
        )
        print(f"processing {num_tasks} tasks in {len(batches)} batches)")
        for batch in tqdm(batches):
            texts = [body for body, _payload in batch]
            res = embed_texts(texts)
            for i, data in enumerate(res["data"]):
                vec = data["embedding"]
                body, payload = batch[i]
                self.cache[body] = (vec, payload)

    def get_or_make(self, body, payload, cache=None):
        if cache is None:
            cache = self.cache
        if body not in cache:
            # print("not in cache")
            print(payload["title"], body[:20])
            self.cache[body] = (embed_texts(body), payload)
        elif body not in self.cache:
            self.cache[body] = (cache[body][0], payload)
        else:
            # even if body in cache, we need to update payload
            self.cache[body] = (self.cache[body][0], payload)

        return self.cache[body]

    def save(self):
        safe_write(self.cache, self.name)


if __name__ == "__main__":
    PAGE_LIMIT = 0
    # `project` is global variable and used to make payload for scrapbox
    project = "omoikane"
    update_from_scrapbox_json(
        "omoikane.pickle",
        "omoikane.json",
        is_public=True,
    )
