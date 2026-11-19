#!/usr/bin/env python3
"""Build the web assets of the Bionic Hand 3D Workspace from the HACKberry design files.

    python scripts/build_assets.py --hackberry path/to/HACKberry

Inputs  (from a clone of https://github.com/mission-arm/HACKberry):
    HACKberry_3Dmodel/STEP/HACKberry_R.stp   assembly: where every part sits
    HACKberry_3Dmodel/STL/**/*.stl           printable parts
Outputs (into ./public by default):
    models/parts/<id>.stl                    printable parts (R-H-15 is a lighter copy for display)
    thumbnails/<id>.png                      parts-library thumbnails
    data/hackberry-right.json                parts, assembly placements, bought parts, servos, finger rigs
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hackberry import catalog, rigs, thumbnails  # noqa: E402
from hackberry.step_assembly import read_assembly  # noqa: E402
from hackberry.stl_tools import decimate, load_stl, mesh_stats, save_stl  # noqa: E402

RAW_BASE = "https://github.com/mission-arm/HACKberry/raw/master/HACKberry_3Dmodel/STL/"
BACK_COVER = "R-H-15"
GEAR_PRODUCT = "HbIndexMotorGear02"  # the index motor gear is named by its CAD name in the STEP file


def col_major(m: np.ndarray) -> list[float]:
    """numpy 4x4 -> flat column-major list (three.js Matrix4.fromArray order)."""
    return [round(float(v), 5) for v in np.asarray(m).T.reshape(-1)]


def r3(v) -> list[float]:
    return [round(float(x), 3) for x in v]


def xf(m: np.ndarray, p) -> np.ndarray:
    return m[:3, :3] @ np.asarray(p, float) + m[:3, 3]


def stl_rel_path(part_id: str) -> str:
    kind = part_id.split("-")[1]
    return f"{catalog.STL_FOLDER[kind]}/{part_id}.stl"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hackberry", required=True, help="path to a clone of mission-arm/HACKberry")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "public"))
    ap.add_argument("--no-thumbnails", action="store_true")
    args = ap.parse_args()
    t0 = time.time()
    model_dir = os.path.join(args.hackberry, "HACKberry_3Dmodel")
    out = os.path.abspath(args.out)
    for sub in ("data", "models/parts", "thumbnails"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    log("reading STEP assembly")
    asm = read_assembly(os.path.join(model_dir, "STEP", "HACKberry_R.stp"))
    log(f"  {len(asm.nodes)} nodes, {len(asm.leaves)} leaf instances")

    # ------------------------------------------------------------------ printed parts
    log("processing printed parts")
    meshes, parts = {}, []
    for pid, (name, cad, unit, qty, profile, note) in catalog.PARTS.items():
        src = os.path.join(model_dir, "STL", stl_rel_path(pid))
        tris = load_stl(src)
        stats = mesh_stats(tris)
        dst = os.path.join(out, "models", "parts", f"{pid}.stl")
        display = tris
        if pid == BACK_COVER:
            display = decimate(tris, cell=0.6)
            save_stl(dst, display, header=f"{pid} decimated for display; original: {RAW_BASE}{stl_rel_path(pid)}")
            log(f"  {pid}: {len(tris)} -> {len(display)} triangles for display")
        else:
            shutil.copyfile(src, dst)
        meshes[pid] = display
        parts.append({
            "id": pid, "name": name, "cadName": cad, "unit": unit, "qty": qty, "profile": profile, "note": note,
            "optional": unit == "accessory",
            "file": f"models/parts/{pid}.stl", "fileIsDecimated": pid == BACK_COVER,
            "sourceUrl": RAW_BASE + stl_rel_path(pid),
            "thumbnail": f"thumbnails/{pid}.png", "stats": stats,
        })
    part_ids = set(catalog.PARTS)

    # ------------------------------------------------------------------ finger identity of each R-O group
    other_groups = [n for n in asm.nodes if n.product == "R-O"]
    group_x = {}
    for g in other_groups:
        shafts = [leaf for leaf in asm.leaves if leaf.parent == g.index and leaf.product.endswith("-other1")]
        group_x[g.index] = float(xf(shafts[0].matrix, asm.solids[shafts[0].product][0].vertices.mean(0))[0])
    order = sorted(group_x, key=group_x.get, reverse=True)  # index side has the largest x
    finger_of_group = dict(zip(order, ["middle", "ring", "little"]))

    def unit_of(node) -> str:
        p = node.parent
        while p is not None:
            anc = asm.nodes[p]
            if anc.product == "R-W":
                return "wrist"
            if anc.product == "R-SO":
                return "socket"
            if anc.product == "R-I":
                return "index"
            if anc.product == "R-T":
                return "thumb"
            if anc.product == "R-O":
                return finger_of_group[anc.index]
            if anc.product.startswith("HbHandBoard"):
                return "electronics"
            p = anc.parent
        return "palm"

    # ------------------------------------------------------------------ instances, bought parts, shafts
    log("placing parts")
    instances, hw_items, hw_types, shafts = [], [], {}, []
    node_ref = {}  # node index -> instance/hardware id
    for node in asm.leaves:
        prod = GEAR_PRODUCT if node.product == GEAR_PRODUCT else node.product
        pid = "R-H-08" if prod == GEAR_PRODUCT else prod
        unit = unit_of(node)
        if pid in part_ids:
            iid = f"p{len(instances)}"
            centre = xf(node.matrix, meshes[pid].reshape(-1, 3).mean(0))
            instances.append({"id": iid, "part": pid, "unit": unit, "matrix": col_major(node.matrix), "center": r3(centre)})
            node_ref[node.index] = iid
            continue
        if node.product.endswith("-other1"):
            for a, b in rigs.shaft_segments(asm.solids[node.product], node.matrix):
                sid = f"s{len(shafts)}"
                length = float(np.linalg.norm(b - a))
                shafts.append({"id": sid, "name": catalog.SHAFT_NAME.format(length=length), "unit": unit,
                               "a": r3(a), "b": r3(b), "r": 1.0, "length": round(length, 1),
                               "center": r3((a + b) / 2)})
            continue
        spec = catalog.SERVOS.get(prod) or catalog.HARDWARE.get(prod)
        if spec is None:
            solids = asm.solids.get(prod)
            if not solids:
                continue  # no geometry in the STEP file (e.g. the micro-USB footprint)
            pts = np.concatenate([s.vertices for s in solids])
            name, tone = catalog.HARDWARE_NAMES.get(prod, (f"SMD component ({prod})", "component"))
            spec = {"kind": "box", "name": name, "tone": tone, "min": r3(pts.min(0)), "max": r3(pts.max(0))}
            if prod == "DMW-BLF19":
                spec["kind"], spec["cornerRadius"] = "battery", 8.0
        hw_types.setdefault(prod, dict(spec))
        hid = f"h{len(hw_items)}"
        local_centre = _spec_centre(spec)
        hw_items.append({"id": hid, "type": prod, "unit": unit, "matrix": col_major(node.matrix),
                         "center": r3(xf(node.matrix, local_centre))})
        node_ref[node.index] = hid
    log(f"  {len(instances)} printed instances, {len(hw_items)} bought parts, {len(shafts)} shafts")

    # ------------------------------------------------------------------ servos
    servos = []
    for role in catalog.SERVO_ROLES:
        prod, within = role["match"]
        node = next(n for n in asm.leaves if n.product == prod and (within is None or n.path[-2] == within))
        spec = catalog.SERVOS[prod]
        ax = {"x": 0, "y": 1, "z": 2}[spec["axis"]]
        tip = [spec["spline"]["center"][0], 0.0, spec["spline"]["center"][1]] if ax == 1 else \
              [spec["spline"]["center"][0], spec["spline"]["center"][1], 0.0]
        tip[ax] = spec["spline"]["range"][1]
        entry = {k: v for k, v in role.items() if k != "match"}
        entry.update({"item": node_ref[node.index], "outputPoint": r3(xf(node.matrix, tip)),
                      "outputAxis": r3(node.matrix[:3, ax])})
        servos.append(entry)

    # ------------------------------------------------------------------ rigs
    log("building finger rigs")
    inst_by_id = {i["id"]: i for i in instances}
    cover = next(i for i in instances if i["part"] == BACK_COVER)
    palm = next(i for i in instances if i["part"] == "R-H-02")
    dorsal = np.array(cover["center"]) - np.array(palm["center"])
    dorsal /= np.linalg.norm(dorsal)

    def world_verts(iid):
        inst = inst_by_id[iid]
        m = np.array(inst["matrix"]).reshape(4, 4).T
        v = np.unique(meshes[inst["part"]].reshape(-1, 3).round(3), axis=0)
        return v @ m[:3, :3].T + m[:3, 3]

    finger_rigs = []
    for g in [n for n in asm.nodes if n.product in ("R-I", "R-O")]:
        leaves = [leaf for leaf in asm.leaves if leaf.parent == g.index]
        unit = "index" if g.product == "R-I" else finger_of_group[g.index]
        printed = {node_ref[leaf.index]: leaf for leaf in leaves if node_ref.get(leaf.index, "").startswith("p")}
        verts = {iid: world_verts(iid) for iid in printed}
        part_key = {f"{inst_by_id[iid]['part']}#{iid}": v for iid, v in verts.items()}
        group_shafts = [s for s in shafts if s["unit"] == unit]
        for s in group_shafts:
            s["parts"] = rigs.parts_on_shaft(np.array(s["a"]), np.array(s["b"]), part_key)
        roles = rigs.classify(group_shafts)
        missing = {"mcp", "pip", "inputPin", "distalPin"} - set(roles)
        if missing:
            log(f"  WARNING {unit}: shafts not found {missing}; finger will not animate")
            continue
        mcp = np.mean([roles["mcp"]["a"], roles["mcp"]["b"]], axis=0)
        axis = np.array(roles["mcp"]["b"]) - np.array(roles["mcp"]["a"])
        axis /= np.linalg.norm(axis)
        bodies = {"input": [], "proximal": [], "distal": [], "coupler": []}
        for iid in printed:
            p = inst_by_id[iid]["part"]
            body = ("input" if p in rigs.INPUT else "proximal" if p in rigs.PROXIMAL else
                    "distal" if p in rigs.DISTAL else "coupler" if p in rigs.COUPLER else None)
            if body:
                bodies[body].append(iid)
        # bought parts in the finger (screws, torsion spring) follow the nearest moving body
        for leaf in leaves:
            hid = node_ref.get(leaf.index, "")
            if not hid.startswith("h"):
                continue
            c = np.array(next(h for h in hw_items if h["id"] == hid)["center"])
            best = min(((float(np.min(np.linalg.norm(verts[i] - c, axis=1))), b)
                        for b, ids in bodies.items() for i in ids if i in verts), default=(0, None))[1]
            if best:
                bodies[best].append(hid)
        shaft_body = {}
        for s in group_shafts:
            role = next((r for r, v in roles.items() if v is s), None)
            shaft_body[s["id"]] = {"mcp": None, "inputPin": "input", "pip": "proximal", "distalPin": "distal"}.get(role, "distal")
        for sid, body in shaft_body.items():
            if body:
                bodies[body].append(sid)
        distal_v = np.concatenate([verts[i] for i in bodies["distal"] if i.startswith("p")])
        tip = distal_v[np.argmax(np.linalg.norm(distal_v - mcp, axis=1))]
        rig = {
            "finger": unit, "unit": unit, "axis": r3(axis), "mcp": r3(mcp),
            "pip": r3(np.mean([roles["pip"]["a"], roles["pip"]["b"]], axis=0)),
            "inputPin": r3(np.mean([roles["inputPin"]["a"], roles["inputPin"]["b"]], axis=0)),
            "distalPin": r3(np.mean([roles["distalPin"]["a"], roles["distalPin"]["b"]], axis=0)),
            "tip": r3(tip), "flexSign": rigs.flex_sign(axis, mcp, tip, dorsal),
            "bodies": bodies, "maxClose": 80,
            # only the index has its input crank on the knuckle shaft, so only it can wrap around an object
            "canWrap": unit == "index",
        }
        if unit == "index":
            gear = next(i for i in instances if i["part"] == "R-H-08")
            servo_node = next(n for n in asm.leaves if n.product == "GWS_S03N")
            centre = xf(servo_node.matrix, [0.0, 0.0, 0.0])
            centre = mcp + axis * float(np.dot(centre - mcp, axis)) + (centre - mcp - axis * float(np.dot(centre - mcp, axis)))
            spacing = float(np.linalg.norm((centre - mcp) - axis * np.dot(centre - mcp, axis)))
            pitch_r = 12.0  # motor gear R-H-08: outer radius 12.9 mm, pitch radius about 12 mm
            horn = next(h for h in hw_items if h["type"] == "HbServoHorn01")
            rig["gear"] = {"items": [gear["id"], horn["id"]], "center": r3(centre),
                           "ratio": round((spacing - pitch_r) / pitch_r, 3)}
        finger_rigs.append(rig)
        log(f"  {unit}: bodies " + ", ".join(f"{k}={len(v)}" for k, v in bodies.items()))
    for s in shafts:
        s.pop("parts", None)

    thumb_servo = next(s for s in servos if s["id"] == "servo-thumb")
    t_axis = np.array(thumb_servo["outputAxis"])
    t_point = np.array(thumb_servo["outputPoint"])
    thumb_ids = [i["id"] for i in instances if i["part"] in ("R-T-01", "R-T-02")]
    horn = min((h for h in hw_items if h["type"] == "ASV-15MGSingleHorn01"),
               key=lambda h: np.linalg.norm(np.array(h["center"]) - t_point))
    thumb_bodies = thumb_ids + [horn["id"]]
    t_verts = np.concatenate([world_verts(i) for i in thumb_ids])
    for h in hw_items:
        if h["unit"] == "thumb" and h["type"].startswith(("Screw", "flatScrew")):
            others = [i["id"] for i in instances if i["unit"] == "thumb" and i["id"] not in thumb_ids]
            d_move = np.min(np.linalg.norm(t_verts - np.array(h["center"]), axis=1))
            d_stay = min(np.min(np.linalg.norm(world_verts(i) - np.array(h["center"]), axis=1)) for i in others)
            if d_move < d_stay:
                thumb_bodies.append(h["id"])
    t_tip = t_verts[np.argmax(np.linalg.norm(np.cross(t_verts - t_point, t_axis), axis=1))]
    target = np.array(palm["center"]) - dorsal * 25.0
    thumb_sign = 1.0 if float(np.dot(np.cross(t_axis, t_tip - t_point), target - t_tip)) > 0 else -1.0
    thumb_rig = {"axis": r3(t_axis), "point": r3(t_point), "sign": thumb_sign, "maxClose": 60, "bodies": thumb_bodies}

    # ------------------------------------------------------------------ orientation hint for the viewer
    # forward = palm -> middle fingertip; "up" = back of the hand, made perpendicular to forward
    middle_tip = next(r["tip"] for r in finger_rigs if r["finger"] == "middle")
    forward = np.array(middle_tip) - np.array(palm["center"])
    forward /= np.linalg.norm(forward)
    dorsal = dorsal - np.dot(dorsal, forward) * forward
    dorsal /= np.linalg.norm(dorsal)

    # ------------------------------------------------------------------ thumbnails
    if not args.no_thumbnails:
        log("rendering thumbnails")
        colours = {u["id"]: u["color"] for u in catalog.UNITS}
        for p in parts:
            hexc = colours[p["unit"]].lstrip("#")
            rgb = tuple(int(hexc[i:i + 2], 16) for i in (0, 2, 4))
            if p["unit"] in ("palm", "socket"):
                rgb = (205, 210, 216)
            img = thumbnails.render(thumbnails.principal_frame(meshes[p["id"]]), rgb)
            img.save(os.path.join(out, "thumbnails", f"{p['id']}.png"), optimize=True)

    data = {
        "meta": {
            "title": "HACKberry bionic hand (right)",
            "generated": dt.date.today().isoformat(),
            "units": "mm",
            "source": "https://github.com/mission-arm/HACKberry",
            "license": "3D data by exiii Inc., CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/)",
            "frame": {"dorsal": r3(dorsal), "forward": r3(forward)},
        },
        "units": catalog.UNITS,
        "profiles": catalog.PROFILES,
        "parts": parts,
        "instances": instances,
        "hardwareTypes": hw_types,
        "hardware": hw_items,
        "shafts": shafts,
        "servos": servos,
        "rigs": {"fingers": finger_rigs, "thumb": thumb_rig},
    }
    path = os.path.join(out, "data", "hackberry-right.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    log(f"wrote {path} ({os.path.getsize(path) / 1024:.0f} KB) in {time.time() - t0:.0f} s")


def _spec_centre(spec: dict) -> list[float]:
    if spec["kind"] in ("box", "battery"):
        return list((np.array(spec["min"]) + np.array(spec["max"])) / 2)
    if spec["kind"] == "servo":
        return list((np.array(spec["body"][0]) + np.array(spec["body"][1])) / 2)
    return [0.0, 0.0, 0.0]


def log(msg: str) -> None:
    print(msg, flush=True)


if __name__ == "__main__":
    main()
