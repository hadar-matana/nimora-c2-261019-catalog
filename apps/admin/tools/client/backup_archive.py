"""Bounded validation of native Sanity exports and secret-free recovery bundles.
No network, extraction, restore, or deletion. Python standard library only.
"""
import hashlib
import json
import re
import tarfile
from pathlib import PurePosixPath

MAX_BYTES = 20 * 1024**3
MAX_FILES = 50000
SECRET_KEY = re.compile(r'password|secret|(?:^|_)token(?:$|_)|credential|authorization|cookie|csrf', re.I)
SECRET_VALUE = re.compile(r'-----BEGIN .*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk[A-Za-z0-9]{50,}')


def scrub_check(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if SECRET_KEY.search(key):
                raise ValueError('Sensitive field prohibited in backup')
            scrub_check(item)
    elif isinstance(value, list):
        for item in value:
            scrub_check(item)
    elif isinstance(value, str) and SECRET_VALUE.search(value):
        raise ValueError('Credential pattern prohibited in backup')


def members(archive):
    seen, total = set(), 0
    for item in archive:
        path = PurePosixPath(item.name)
        if item.name.startswith('/') or '..' in path.parts or '\\' in item.name or item.name in seen or not (item.isfile() or item.isdir()):
            raise ValueError('Unsafe/duplicate archive path or special entry')
        seen.add(item.name)
        total += item.size
        if total > MAX_BYTES or len(seen) > MAX_FILES:
            raise ValueError('Archive exceeds validation limits')
        if item.isfile():
            yield item


def asset_path(doc):
    ident = doc['_id']
    match = re.fullmatch(r'(image|file)-([a-f0-9]{40})(?:-(\d+x\d+))?-([a-z0-9]+)', ident)
    if not match:
        raise ValueError('Invalid source asset identifier')
    kind, sha1, dimensions, extension = match.groups()
    return kind + 's/' + sha1 + ('-' + dimensions if dimensions else '') + '.' + extension


def source_inventory(inventory):
    if set(inventory) != {'version', 'projectId', 'dataset', 'revision', 'documents'} or inventory['version'] != 1:
        raise ValueError('Exact source inventory required')
    docs = inventory['documents']
    if not isinstance(docs, list) or len(docs) > MAX_FILES:
        raise ValueError('Invalid source inventory')
    ids = set()
    for doc in docs:
        if not isinstance(doc, dict) or not all(isinstance(doc.get(k), str) and doc[k] for k in ['_id', '_type', '_rev']) or doc['_id'] in ids:
            raise ValueError('Invalid/duplicate document inventory')
        if set(doc) - {'_id', '_type', '_rev', 'size', 'sha1hash', 'url', 'document', 'assetMetadata'}:
            raise ValueError('Unknown inventory fields')
        ids.add(doc['_id'])
    return docs


def validate_export(path, inventory):
    expected = source_inventory(inventory)
    ordinary = {d['_id']: d for d in expected if d['_type'] not in ['sanity.imageAsset', 'sanity.fileAsset']}
    assets = {asset_path(d): d for d in expected if d['_type'] in ['sanity.imageAsset', 'sanity.fileAsset']}
    found_docs, found_assets, refs, prefix, native_files, exported_metadata = {}, {}, [], None, set(), None
    with tarfile.open(path, 'r:*') as archive:
        for item in members(archive):
            parts = PurePosixPath(item.name).parts
            if len(parts) < 2:
                raise ValueError('Native export root prefix required')
            prefix = prefix or parts[0]
            if prefix != parts[0]:
                raise ValueError('Multiple export roots')
            relative = '/'.join(parts[1:])
            native_files.add(relative)
            stream = archive.extractfile(item)
            if relative == 'data.ndjson':
                if found_docs:
                    raise ValueError('Duplicate data stream')
                while True:
                    line = stream.readline(16 * 1024**2 + 1)
                    if not line:
                        break
                    if len(line) > 16 * 1024**2:
                        raise ValueError('Document too large')
                    if not line.strip():
                        continue
                    doc = json.loads(line)
                    scrub_check(doc)
                    ident = doc.get('_id')
                    if ident not in ordinary or ident in found_docs or doc != ordinary[ident].get('document'):
                        raise ValueError('Document identity/revision/count mismatch')
                    found_docs[ident] = True
                    def walk(value):
                        if isinstance(value, dict):
                            if '_sanityAsset' in value:
                                match = re.fullmatch(r'(image|file)@file://\./((?:images|files)/[a-zA-Z0-9.-]+)', value['_sanityAsset'])
                                if not match or not match[2].startswith(match[1] + 's/'):
                                    raise ValueError('Unsafe asset reference')
                                refs.append(match[2])
                            if value.get('_type') == 'crossDatasetReference' or '_projectId' in value or '_dataset' in value:
                                raise ValueError('Cross-dataset reference needs separate review')
                            for child in value.values(): walk(child)
                        elif isinstance(value, list):
                            for child in value: walk(child)
                    walk(doc)
            elif relative.startswith(('images/', 'files/')):
                if relative not in assets:
                    raise ValueError('Unexpected asset file')
                doc = assets[relative]
                digest, size = hashlib.sha1(), 0
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
                    size += len(chunk)
                if size != doc.get('size') or digest.hexdigest() != doc.get('sha1hash') or digest.hexdigest() not in doc['_id']:
                    raise ValueError('Asset size/content hash mismatch')
                expected_url = f"https://cdn.sanity.io/{relative.split('/')[0]}/{inventory['projectId']}/{inventory['dataset']}/{relative.split('/')[-1]}"
                if doc.get('url') != expected_url:
                    raise ValueError('Asset belongs to another CMS target')
                found_assets[relative] = {'size': size, 'sha1': digest.hexdigest()}
            elif relative == 'assets.json':
                if item.size > 32 * 1024**2:
                    raise ValueError('Asset metadata too large')
                metadata = json.load(stream)
                if not isinstance(metadata, dict): raise ValueError('Invalid native asset metadata')
                scrub_check(metadata)
                exported_metadata = metadata
            else:
                raise ValueError('Unexpected native export file')
    expected_metadata = {('image-' if d['_type'] == 'sanity.imageAsset' else 'file-') + d['sha1hash']: d.get('assetMetadata') for d in assets.values()}
    if exported_metadata != expected_metadata: raise ValueError('Original asset metadata missing or changed')
    if not {'data.ndjson', 'assets.json'}.issubset(native_files) or set(found_docs) != set(ordinary) or set(found_assets) != set(assets) or any(ref not in found_assets for ref in refs):
        raise ValueError('Incomplete documents/assets or dangling asset reference')
    return {'sourceDocumentCount': len(expected), 'documentCount': len(found_docs), 'assetCount': len(found_assets), 'assets': found_assets}


def validate_bundle(path, inventory, manifest):
    required = {'native-export.tar.gz', 'client-manifest.json', 'inventory.json', 'resource-metadata.json', 'worker-config.json', 'checksums.json'}
    found = {}
    with tarfile.open(path, 'r:*') as archive:
        for item in members(archive):
            if item.name not in required: raise ValueError('Unexpected backup file')
            # Bundle metadata is small. Stream the nested native export to private temp storage.
            if item.name == 'native-export.tar.gz': continue
            if item.size > 32 * 1024**2: raise ValueError('Metadata too large')
            found[item.name] = json.load(archive.extractfile(item))
    if set(found) != required - {'native-export.tar.gz'}: raise ValueError('Incomplete recovery bundle')
    if found['client-manifest.json'] != manifest or found['inventory.json'] != inventory: raise ValueError('Bundle identity mismatch')
    for key in ['client-manifest.json', 'inventory.json', 'resource-metadata.json', 'worker-config.json']:
        # Manifest keyId is a non-secret identifier; no credentials are admitted.
        scrub_check(found[key])
    return found


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('export')
    parser.add_argument('inventory')
    args = parser.parse_args()
    result = validate_export(args.export, json.loads(open(args.inventory).read()))
    print(json.dumps(result, sort_keys=True))
