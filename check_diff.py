
import re

def parse_user_list(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    refs = set()
    for line in lines:
        line = line.strip()
        if not line or line == "Sloka":
            continue
        
        # Handle 10.12-13
        if "-" in line:
            parts = line.split("-") # e.g. 10.12-13 -> 10.12 and 13?
            # Usually 10.12-13 means 10.12 and 10.13.
            # But the format is Chapter.Verse-Verse.
            # So 10.12 and 10.13.
            base = parts[0] # 10.12
            if "." in base:
                chap, verse = base.split(".")
                end_verse = parts[1] # 13
                # Check if end_verse is just number or full ref
                if "." not in end_verse:
                    refs.add(f"{chap}.{verse}")
                    refs.add(f"{chap}.{end_verse}")
                else:
                    refs.add(base)
                    refs.add(end_verse)
            else:
                refs.add(line)
        else:
            refs.add(line)
            
    return refs

def parse_project_list(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Extract references using regex "reference": "X.Y"
    refs = set(re.findall(r'"reference":\s*"([^"]+)"', content))
    return refs

user_refs = parse_user_list('user_list.txt')
project_refs = parse_project_list('src/lib/shlokas.ts')

# Check what is in project but NOT in user list
extra_in_project = project_refs - user_refs

# Check what is in user list but NOT in project
missing_in_project = user_refs - project_refs

print("Extra in Project (should remove):", sorted(list(extra_in_project)))
print("Missing in Project (should add):", sorted(list(missing_in_project)))
