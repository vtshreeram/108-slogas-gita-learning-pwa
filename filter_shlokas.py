
import re

# User provided list
user_list_text = """
1.1
2.7
2.11
2.12
2.13
2.14
2.2
2.22
2.23
2.27
2.3
2.4
2.41
2.44
2.45
2.47
2.46
2.59
2.62
2.63
2.64
2.69
3.9
3.14
3.21
3.27
3.37
4.1
4.2
4.3
4.6
4.7
4.8
4.9
4.1
4.11
4.13
4.34
5.18
5.22
5.29
6.17
6.41
6.47
7.3
7.4
7.5
7.7
7.14
7.15
7.16
7.19
7.25
7.26
7.27
7.28
8.5
8.6
8.7
8.14
8.15
8.16
8.28
9.2
9.4
9.1
9.11
9.12
9.13
9.14
9.22
9.25
9.26
9.27
9.29
9.3
9.32
9.34
10.8
10.9
10.1
10.11
10.12-13
10.41
11.54
11.55
12.5
12.8
12.9
12.1
14.4
14.26
14.27
15.5
15.6
15.7
15.15
15.19
18.42
18.54
18.55
18.58
18.61
18.65
18.66
18.68
18.69
18.78
"""

# Normalize user list
refs = set()
for line in user_list_text.strip().split('\n'):
    r = line.strip()
    if not r: continue
    if r == '10.12-13':
        refs.add('10.12')
        refs.add('10.13')
    else:
        refs.add(r)

# Read the file
with open('src/lib/shlokas.ts', 'r') as f:
    content = f.read()

# Parse SHLOKAS array
# We will use regex to find each object in the array
# Pattern looks for { ... "reference": "X.Y" ... }
# Since the format is consistent, we can split by '    {\n' and reconstruct.

# Alternative: Parse the objects by matching the reference key
# But we need to keep the full object content.

# Let's extract the array content first
start_marker = "export const SHLOKAS: Shloka[] = ["
end_marker = "];"
start_idx = content.find(start_marker)
if start_idx == -1:
    print("Could not find start marker")
    exit(1)

array_start = start_idx + len(start_marker)
array_end = content.rfind(end_marker)
if array_end == -1:
    print("Could not find end marker")
    exit(1)

array_content = content[array_start:array_end]

# We will regex to find all objects. 
# Assumption: Objects start with `{` and end with `},` or `}`
# And they contain `"reference": "..."`

# A safer way might be to just iterate through the existing list in Python if we can parse it
# But parsing TS/JS object in Python is hard.

# Let's just use the fact that we have the full file content and we can select blocks.
# We will split by `    {` (indentation 4 spaces) which seems consistent in the file.

blocks = array_content.split('\n    {')
# The first block is empty or contains newline
filtered_blocks = []

for block in blocks:
    if not block.strip(): continue
    
    # Check reference
    # look for "reference": "X.Y"
    match = re.search(r'"reference": "([^"]+)"', block)
    if match:
        ref = match.group(1)
        if ref in refs:
            # Keep this block
            # Re-add the opening brace we split on
            full_block = '    {' + block
            # Remove trailing comma if it was the last element, we'll handle commas later
            # Actually simpler: Just collect them and join with commas
            
            # The split removes `    {`, so we add it back.
            # But wait, `split` consumes the separator.
            # The first element might be empty text before the first `{`.
            
            # Let's clean up the block
            # If the block ends with `,`, remove it for now
            clean_block = full_block.rstrip().rstrip(',')
            filtered_blocks.append(clean_block)
            
            # Mark as found so we can track missing ones?
            # refs.remove(ref) # Don't remove, in case of duplicates in file we want to dedup? 
            # Actually we want to deduplicate the output too.
            pass

# Deduplicate based on reference ID in the block to be safe, 
# or just rely on `refs` set to filter.
# But if the file has duplicates, we might want to avoid them.
# Let's assume the file currently has unique references (or we want to keep the version in the file).
# We already used a set for `refs`, so `ref in refs` is good.
# We should also ensure we don't add the same ref twice if the file has duplicates.
seen_refs = set()
unique_blocks = []
for block in filtered_blocks:
    match = re.search(r'"reference": "([^"]+)"', block)
    if match:
        ref = match.group(1)
        if ref not in seen_refs:
            unique_blocks.append(block)
            seen_refs.add(ref)

# Sort the blocks based on Chapter.Verse
def sort_key(block):
    match = re.search(r'"reference": "(\d+)\.(\d+)"', block)
    if match:
        c = int(match.group(1))
        v = int(match.group(2))
        return (c, v)
    return (0, 0)

unique_blocks.sort(key=sort_key)

# Check if we are missing any refs from the user list
missing = refs - seen_refs
if missing:
    print(f"Warning: Missing references in file: {missing}")

# Construct new file content
new_array_content = "\n" + ",\n".join(unique_blocks) + "\n  "
new_content = content[:array_start] + new_array_content + content[array_end:]

with open('src/lib/shlokas.ts', 'w') as f:
    f.write(new_content)

print(f"Updated shlokas.ts with {len(unique_blocks)} shlokas.")
