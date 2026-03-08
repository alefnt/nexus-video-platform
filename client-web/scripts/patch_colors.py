import os
import glob
import re

target_dir = r"d:\111new_sp\new_sp\video-platform\client-web\src"

replacements = {
    r"text-cyan-400": "text-nexusCyan",
    r"bg-cyan-400": "bg-nexusCyan",
    r"border-cyan-400": "border-nexusCyan",
    r"text-purple-400": "text-nexusPurple",
    r"text-purple-500": "text-nexusPurple",
    r"bg-purple-500": "bg-nexusPurple",
    r"border-purple-500": "border-nexusPurple",
    r"text-pink-400": "text-nexusPink",
    r"text-pink-500": "text-nexusPink",
    r"bg-pink-500": "bg-nexusPink",
    r"bg-pink-600": "bg-nexusPink",
    r"from-purple-500": "from-nexusPurple",
    r"from-purple-600": "from-nexusPurple",
    r"to-pink-500": "to-nexusPink",
    r"to-pink-600": "to-nexusPink",
    r"to-cyan-400": "to-nexusCyan",
    r"from-cyan-400": "from-nexusCyan",
    r"from-cyan-500": "from-nexusCyan",
    r"bg-\[\#030308\]": "bg-bgDarker",
    r"bg-\[\#080811\]": "bg-bgMain",
    r"from-\[\#030308\]": "from-bgDarker",
    r"from-\[\#080811\]": "from-bgMain",
    r"via-\[\#030308\]": "via-bgDarker",
    r"via-\[\#080811\]": "via-bgMain",
}

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")

for root, _, files in os.walk(target_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            patch_file(os.path.join(root, file))

print("Color patch complete.")
