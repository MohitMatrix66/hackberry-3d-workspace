# Licence of the 3D models and derived data

The printable parts in this repository are the **HACKberry** open-source bionic arm by **exiii Inc.**
Source: <https://github.com/mission-arm/HACKberry>

They are licensed under the
**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International** licence (CC BY-NC-SA 4.0):
<https://creativecommons.org/licenses/by-nc-sa/4.0/>

| Path | What it is | Changes made in this project |
| --- | --- | --- |
| `public/models/parts/*.stl` | HACKberry right-hand and common STL files | None, except `R-H-15.stl` (back cover), which is reduced from 1.6 M to 66 k triangles for display. Download the original from the HACKberry repository. |
| `public/data/hackberry-right.json` | Part list, positions, servo and finger-joint data | Extracted from `HACKberry_R.stp`, `HACKberry_BOM_v2.xlsx` and the STL files by `scripts/build_assets.py`. |
| `public/thumbnails/*.png` | Part thumbnails | Rendered from the STL files by `scripts/build_assets.py`. |
| `docs/presentation/images/*.png` | Renders used in the presentation | Rendered from the HACKberry 3D model. |

Under this licence you may share and adapt these files **for non-commercial purposes**, as long as you
**credit exiii Inc.**, **link to the licence**, **say what you changed** and **share your adaptations under the
same licence**. For commercial use, contact exiii Inc. (info@exiii.jp), as stated in the HACKberry
Open Source Project Policy.

"HACKberry" and "exiii" are trademarks of exiii Inc. They are used here only to credit the source of the
design. This project is not affiliated with or endorsed by exiii Inc.
