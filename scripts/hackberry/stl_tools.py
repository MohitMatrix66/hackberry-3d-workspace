"""Small, dependency-free (numpy only) helpers for triangle meshes stored as STL."""
from __future__ import annotations

import struct

import numpy as np


def load_stl(path: str) -> np.ndarray:
    """Return triangles as an (n, 3, 3) float64 array (binary or ASCII STL)."""
    with open(path, "rb") as fh:
        data = fh.read()
    if len(data) >= 84:
        n = struct.unpack("<I", data[80:84])[0]
        if n and len(data) == 84 + 50 * n:
            rec = np.dtype([("normal", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])
            return np.frombuffer(data, dtype=rec, count=n, offset=84)["v"].astype(np.float64)
    verts = [line.split()[1:4] for line in data.decode("ascii", "ignore").splitlines()
             if line.strip().startswith("vertex")]
    return np.asarray(verts, dtype=np.float64).reshape(-1, 3, 3)


def save_stl(path: str, tris: np.ndarray, header: str = "") -> None:
    """Write triangles to a binary STL (normals are recomputed)."""
    tris = np.asarray(tris, dtype=np.float32)
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    rec = np.zeros(len(tris), dtype=np.dtype([("normal", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")]))
    rec["normal"], rec["v"] = n, tris
    with open(path, "wb") as fh:
        fh.write(header.encode("ascii", "ignore")[:80].ljust(80, b" "))
        fh.write(struct.pack("<I", len(tris)))
        fh.write(rec.tobytes())


def mesh_stats(tris: np.ndarray) -> dict:
    """Bounding box, surface area and enclosed volume (signed tetrahedra) of a closed mesh, in mm."""
    v0, v1, v2 = tris[:, 0], tris[:, 1], tris[:, 2]
    cross = np.cross(v1 - v0, v2 - v0)
    area = 0.5 * np.linalg.norm(cross, axis=1).sum()
    volume = abs(np.einsum("ij,ij->i", v0, np.cross(v1, v2)).sum() / 6.0)
    pts = tris.reshape(-1, 3)
    lo, hi = pts.min(0), pts.max(0)
    return {
        "triangles": int(len(tris)),
        "bboxMin": np.round(lo, 2).tolist(),
        "bboxMax": np.round(hi, 2).tolist(),
        "size": np.round(hi - lo, 1).tolist(),
        "area_cm2": round(float(area) / 100.0, 2),
        "volume_cm3": round(float(volume) / 1000.0, 3),
    }


def decimate(tris: np.ndarray, cell: float) -> np.ndarray:
    """Vertex-clustering decimation: snap vertices to a grid of size ``cell`` (mm).

    Good enough to make a very dense CAD export light for display; never used for print files.
    """
    pts = tris.reshape(-1, 3)
    keys = np.floor(pts / cell).astype(np.int64)
    _, inverse = np.unique(keys, axis=0, return_inverse=True)
    inverse = inverse.reshape(-1)
    sums = np.zeros((inverse.max() + 1, 3))
    np.add.at(sums, inverse, pts)
    counts = np.bincount(inverse).astype(float)
    reps = sums / counts[:, None]
    faces = inverse.reshape(-1, 3)
    # drop triangles that collapsed to a line or a point
    faces = faces[(faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])]
    # drop duplicates (same three vertices), keeping the first one and its winding
    first = np.unique(np.sort(faces, axis=1), axis=0, return_index=True)[1]
    return reps[faces[np.sort(first)]]
