"""Find the joint shafts of every finger and describe each finger as a linkage "rig".

HACKberry fingers are *underactuated linkages*:

* the input (index: gear sector R-I-03; other fingers: the drive chain in the palm) turns about the
  knuckle (MCP) shaft,
* the proximal phalanx turns freely about the same MCP shaft,
* a coupler link joins an input pin to a pin on the middle-distal phalanx, which turns about the PIP shaft.

In free air the whole finger turns as one piece; when the proximal phalanx touches an object, the
coupler keeps pushing and the middle-distal phalanx wraps around it. The web app solves this
four-bar loop live; this module only finds the pivots and which parts belong to which moving body.
"""
from __future__ import annotations

import numpy as np

PROXIMAL = {"R-O-03", "R-O-04", "R-I-06", "R-I-07", "R-I-05"}
DISTAL = {"R-O-01", "R-I-01"}
COUPLER = {"R-O-02", "R-O-05", "R-I-02", "R-I-04"}
INPUT = {"R-I-03"}


def shaft_segments(solids, matrix: np.ndarray) -> list[tuple[np.ndarray, np.ndarray]]:
    """Return world-space (a, b) end points of every Ø2 mm shaft body in a product."""
    out = []
    for s in solids:
        c = s.circles
        sel = c[np.abs(c[:, 6] - 1.0) < 0.15] if len(c) else c
        if len(sel) < 2:
            continue
        pts = sel[:, :3] @ matrix[:3, :3].T + matrix[:3, 3]
        d = np.linalg.norm(pts[:, None] - pts[None], axis=2)
        i, j = np.unravel_index(d.argmax(), d.shape)
        if d[i, j] >= 3.0:
            out.append((pts[i], pts[j]))
    return out


def parts_on_shaft(a, b, parts: dict[str, np.ndarray]) -> dict[str, int]:
    """Count part vertices lying on the 1 mm radius hole around shaft a-b."""
    length = np.linalg.norm(b - a)
    u = (b - a) / length
    hits = {}
    for key, verts in parts.items():
        w = verts - a
        t = w @ u
        perp = np.linalg.norm(w - np.outer(t, u), axis=1)
        n = int(((perp > 0.85) & (perp < 1.35) & (t > -0.5) & (t < length + 0.5)).sum())
        if n > 6:
            hits[key] = n
    return hits


def classify(shafts: list[dict]) -> dict:
    """Label shafts as mcp / pip / inputPin / distalPin from the parts they pass through."""
    roles = {}
    for s in shafts:
        names = {p.split("#")[0] for p in s["parts"]}
        prox, dist, coup, inp = names & PROXIMAL, names & DISTAL, names & COUPLER, names & INPUT
        if prox and dist:
            roles["pip"] = s
        elif dist and coup:
            roles["distalPin"] = s
        elif prox and not dist:
            roles["mcp"] = s
        elif coup and not dist:
            roles["inputPin"] = s
    return roles


def flex_sign(axis, mcp, tip_point, dorsal) -> float:
    """+1 if a positive rotation about ``axis`` moves the fingertip toward the palm side."""
    d = tip_point - mcp
    return 1.0 if float(np.dot(np.cross(axis, d), -dorsal)) > 0 else -1.0
