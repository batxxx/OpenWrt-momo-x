#!/usr/bin/env python3
"""Create an OpenWrt Packages index from a directory of ipk files."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import sys
import tarfile
from pathlib import Path


GENERATED_FIELDS = {"Filename", "Size", "SHA256sum", "MD5Sum"}


def member_name(name: str) -> str:
    return name.lstrip("./")


def extract_control(ipk_path: Path) -> str:
    try:
        with tarfile.open(ipk_path, "r:*") as ipk:
            control_member = next(
                (
                    member
                    for member in ipk.getmembers()
                    if member_name(member.name) in {"control.tar", "control.tar.gz"}
                ),
                None,
            )
            if control_member is None:
                raise ValueError("missing control.tar.gz")

            control_archive = ipk.extractfile(control_member)
            if control_archive is None:
                raise ValueError("cannot read control.tar.gz")
            control_data = control_archive.read()
    except tarfile.TarError as exc:
        raise ValueError(f"unsupported ipk archive: {exc}") from exc

    try:
        with tarfile.open(fileobj=io.BytesIO(control_data), mode="r:*") as control_tar:
            control_member = next(
                (
                    member
                    for member in control_tar.getmembers()
                    if member_name(member.name) == "control"
                ),
                None,
            )
            if control_member is None:
                raise ValueError("missing control file")

            control_file = control_tar.extractfile(control_member)
            if control_file is None:
                raise ValueError("cannot read control file")
            return control_file.read().decode("utf-8", "replace").strip()
    except tarfile.TarError as exc:
        raise ValueError(f"unsupported control archive: {exc}") from exc


def strip_generated_fields(control: str) -> str:
    lines: list[str] = []
    skip_continuation = False

    for line in control.splitlines():
        if line and not line[0].isspace():
            key = line.split(":", 1)[0]
            skip_continuation = key in GENERATED_FIELDS

        if not skip_continuation:
            lines.append(line)

    return "\n".join(lines).rstrip()


def package_entry(ipk_path: Path) -> str:
    control = strip_generated_fields(extract_control(ipk_path))
    digest = hashlib.sha256(ipk_path.read_bytes()).hexdigest()
    size = ipk_path.stat().st_size
    return f"{control}\nFilename: ./{ipk_path.name}\nSize: {size}\nSHA256sum: {digest}\n"


def write_index(feed_dir: Path) -> None:
    ipks = sorted(feed_dir.glob("*.ipk"))
    if not ipks:
        raise SystemExit(f"no .ipk files found in {feed_dir}")

    entries = []
    for ipk_path in ipks:
        try:
            entries.append(package_entry(ipk_path))
        except ValueError as exc:
            raise SystemExit(f"{ipk_path}: {exc}") from exc

    content = "\n".join(entries)
    packages_path = feed_dir / "Packages"
    packages_path.write_text(content, encoding="utf-8")

    with gzip.open(feed_dir / "Packages.gz", "wb", compresslevel=9) as packages_gz:
        packages_gz.write(content.encode("utf-8"))

    print(f"indexed {len(ipks)} package(s) in {packages_path}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("feed_dir", type=Path)
    args = parser.parse_args(argv)

    feed_dir = args.feed_dir
    if not feed_dir.is_dir():
        raise SystemExit(f"{feed_dir} is not a directory")

    write_index(feed_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
