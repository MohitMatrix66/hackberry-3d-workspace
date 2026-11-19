# Asset pipeline

`build_assets.py` turns the open-source HACKberry design files into the data the website loads from
`public/`. You only need it if you want to regenerate that data. The generated files are already
committed, so the website works without running Python.

## Run it

```bash
# 1. get the HACKberry design files next to this repository
git clone --depth 1 https://github.com/mission-arm/HACKberry ../HACKberry

# 2. install the two Python dependencies (Python 3.10+)
pip install -r scripts/requirements.txt

# 3. build (about 1 minute; add --no-thumbnails to skip the part thumbnails)
python scripts/build_assets.py --hackberry ../HACKberry
```

The `npm run assets` script runs step 3 with the same paths.

## What it does

| Step | Module | Result |
| --- | --- | --- |
| Read the assembly | `hackberry/step_assembly.py` | Product tree of `HACKberry_R.stp`, a 4×4 world matrix for every part instance, and the B-rep vertices and circle edges of every solid. No CAD kernel is needed: only the assembly and topology entities of the STEP text file are parsed. |
| Copy the print files | `hackberry/stl_tools.py` | `public/models/parts/<id>.stl`. The 79 MB back cover is decimated by vertex clustering for display. |
| Measure the parts | `hackberry/stl_tools.py` | Size, surface area and enclosed volume of every STL (used for filament estimates). |
| Place everything | `build_assets.py` | Instances of printed parts, bought parts (servos, screws, springs, boards, battery) and the 2 mm steel shafts, each tagged with its unit (index, middle, …). |
| Find the joints | `hackberry/rigs.py` | For every finger: which shaft is the knuckle (MCP), the PIP, the input pin and the distal pin, found by counting STL vertices on each shaft's 1 mm hole. Parts are grouped into moving bodies. |
| Thumbnails | `hackberry/thumbnails.py` | `public/thumbnails/<id>.png`, from a small numpy z-buffer renderer. |
| Metadata | `hackberry/catalog.py` | Names and quantities from the HACKberry BOM, units, print profiles, servo roles and simplified bought-part shapes. |

Output: `public/data/hackberry-right.json` (about 80 KB).

### Why the STEP file can be used directly

The STL files in the HACKberry repository were exported in the same coordinate system as their
products in the STEP assembly. So `world = M_instance × stl_vertex` places every printable part exactly
in the assembly; the website does the same with `three.js`.
