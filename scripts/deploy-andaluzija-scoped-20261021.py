"""Prepare BD-authorized Andaluzija overlay on the verified published source.

Credentials are read only from the CI environment and never written or printed.
"""
import copy
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tomllib
import urllib.request

BASE = "e8c7505f222ec3f8c1403b57a002a36222d041cf"
PUBLISHED = "6ad7e5707f61cd7f73bba837"
SITE = "17b4124d-c197-4c0a-a711-8b2c08d91088"
DGTE = "9f25323895e6e1dd305a4daa88cba93c8f808753"
PRESERVED = {
    "public/crp/DGTE.html": "29166abae5bf765d4c6bfe667ccc82a12414da15862f16ed11bbc00dbefc9d39",
    "public/crp/assets/dgte/research-20261020/DGTE_RHP_PUBLIC_SYNTHESIS_20261020_R1.zip": "b0258cf385fb211ededf876e9c5dbaf522917c5635476196b3051c81ba99d1da",
    "public/crp/assets/dgte/research-20261020/DGTE_RHP_SYNTHESIS_CHECKS_20261020_R1.json": "2359a7679781c943b907ea0a39c2e30b4ec1665b4af7b8a1789ad2d6c0b9a557",
}


def api(path):
    req = urllib.request.Request(
        "https://api.netlify.com/api/v1/" + path,
        headers={"Authorization": "Bearer " + os.environ["NETLIFY_AUTH_TOKEN"]},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def current():
    assert api("sites/" + SITE)["published_deploy"]["id"] == PUBLISHED, "Live base changed"
    dep = api("deploys/" + PUBLISHED)
    assert BASE in dep["title"] and DGTE in dep["title"], "Live source provenance mismatch"
    return dep


def prepare():
    dep = current()
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() == BASE
    incoming = pathlib.Path("../incoming")
    source = subprocess.check_output(["git", "-C", str(incoming), "rev-parse", "HEAD"], text=True).strip()
    assert source == os.environ["SOURCE_SHA"]
    changed = {}

    def put(src, rel):
        target = pathlib.Path(rel)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)
        changed[rel] = sha(target)

    for rel, expected in PRESERVED.items():
        src = pathlib.Path("../published-dgte") / rel
        assert sha(src) == expected
        put(src, rel)

    page = incoming / "public/BD/O/izleti"
    for src in sorted(page.glob("andaluzija*")):
        assert src.is_file(), "Unexpected page directory"
        put(src, "public/BD/O/izleti/" + src.name)
    assert sha("public/BD/O/izleti/andaluzija-private.8zs.json") == "873c812e4182bcc8e2633e805f1e0ae62665965a40b3f16e927542663616afaa"
    for rel in ["LICENSE", "leaflet.css"]:
        path = "public/BD/O/izleti/assets/vendor/leaflet-1.9.4/" + rel
        put(incoming / path, path)
    skill_path = "public/ai/skills/andaluzija-2027-guide"
    for src in sorted((incoming / skill_path).rglob("*")):
        if src.is_file():
            put(src, src.relative_to(incoming).as_posix())

    registry_path = "public/ai/skills/registry.json"
    old = json.loads(pathlib.Path(registry_path).read_text())
    new = json.loads((incoming / registry_path).read_text())
    entry, = [s for s in new["skills"] if s["id"] == "andaluzija-2027-guide"]
    original = copy.deepcopy(old)
    old["skills"] = [s for s in old["skills"] if s["id"] != entry["id"]] + [entry]
    assert [s for s in old["skills"] if s["id"] != entry["id"]] == [s for s in original["skills"] if s["id"] != entry["id"]]
    pathlib.Path(registry_path).write_text(json.dumps(old, ensure_ascii=False, indent=2) + "\n")
    changed[registry_path] = sha(registry_path)

    paths = [
        "functions/andaluzija-auth.mjs", "functions/andaluzija-state.mjs", "functions/andaluzija-ai.mjs",
        "functions/lib/andaluzija-access.mjs", "functions/lib/andaluzija-ai-knowledge.mjs",
        "functions/lib/mdlxdcc-guide/provider.mjs",
    ]
    for rel in paths:
        assert not pathlib.Path(rel).exists(), "Unexpected existing target function/library"
        put(incoming / rel, rel)
    for rel in ["functions/lib/mdlxdcc-guide/access.mjs", "functions/lib/mdlxdcc-guide/cost.mjs",
                "functions/lib/mdlxdcc-guide/runtime.mjs", "functions/package.json", "functions/package-lock.json",
                "public/Trip/new/air-distance.js", "public/Trip/new/deep-search.js", "public/Trip/new/road-matrix.js"]:
        assert sha(rel) == sha(incoming / rel), "Shared dependency changed: " + rel

    package = json.loads(pathlib.Path("package.json").read_text())
    proposed = json.loads((incoming / "package.json").read_text())
    expected = copy.deepcopy(package)
    expected["dependencies"]["@netlify/blobs-andaluzija"] = "npm:@netlify/blobs@11.1.4"
    assert proposed == expected
    lock = json.loads(pathlib.Path("package-lock.json").read_text())
    proposed_lock = json.loads((incoming / "package-lock.json").read_text())
    assert all(proposed_lock["packages"].get(k) == v for k, v in lock["packages"].items() if k)
    assert all(k.startswith("node_modules/@netlify/blobs-andaluzija") for k in set(proposed_lock["packages"]) - set(lock["packages"]))
    for rel in ["package.json", "package-lock.json"]:
        put(incoming / rel, rel)

    config = tomllib.loads(pathlib.Path("netlify.toml").read_text())
    proposed_config = tomllib.loads((incoming / "netlify.toml").read_text())
    expected = copy.deepcopy(config)
    for header in expected["headers"]:
        if header["for"].lower().split(".html")[0] == "/bd/o/izleti/andaluzija-2027":
            match, = [h for h in proposed_config["headers"] if h["for"] == header["for"]]
            header["values"]["Content-Security-Policy"] = match["values"]["Content-Security-Policy"]
    expected["functions"]["andaluzija-ai"] = {"included_files": ["public/ai/skills/registry.json", "public/ai/skills/andaluzija-2027-guide/**"]}
    assert proposed_config == expected, "Unrelated Netlify config delta"
    put(incoming / "netlify.toml", "netlify.toml")
    for src in sorted((incoming / "tests").glob("andaluzija*")):
        if src.is_file():
            put(src, "tests/" + src.name)
    subprocess.run(["git", "add", "--sparse", "-N", "--", *changed], check=True)
    actual = set(subprocess.check_output(["git", "diff", "--name-only"], text=True).splitlines())
    assert actual <= set(changed), "Unexpected source delta"
    pathlib.Path("andaluzija-release-scope.json").write_text(json.dumps({
        "base_source": BASE, "preserved_dgte": DGTE, "previous_deploy": PUBLISHED,
        "source": source, "overlay_sha256": changed,
        "baseline_functions": {x["n"]: x["d"] for x in dep.get("available_functions", [])},
    }, indent=2) + "\n")
    print("Verified frozen live base and explicit Andaluzija overlay; shared engine and auth unchanged.")


def receipt():
    output = json.loads(pathlib.Path("netlify-deploy.json").read_text())
    did = output.get("deploy_id") or output.get("deployId")
    assert did and did != PUBLISHED
    dep = api("deploys/" + did)
    scope = json.loads(pathlib.Path("andaluzija-release-scope.json").read_text())
    before = scope["baseline_functions"]
    after = {x["n"]: x["d"] for x in dep.get("available_functions", [])}
    added = sorted(set(after) - set(before))
    altered = sorted(n for n in before if after.get(n) != before[n])
    result = {"deploy_id": did, "state": dep["state"], "published_at": dep.get("published_at"),
              "source": scope["source"], "added_functions": added, "changed_previous_functions": altered}
    pathlib.Path("andaluzija-release-receipt.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
    assert added == ["andaluzija-ai", "andaluzija-auth", "andaluzija-state"] and not altered
    assert api("sites/" + SITE)["published_deploy"]["id"] == did


if __name__ == "__main__":
    {"prepare": prepare, "preflight": current, "receipt": receipt}[sys.argv[1]]()
