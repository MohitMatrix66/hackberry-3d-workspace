"""Tiny software renderer (numpy + Pillow) used to make part thumbnails for the parts library."""
from __future__ import annotations

import numpy as np
from PIL import Image


def _camera(azim_deg: float, elev_deg: float) -> np.ndarray:
    a, e = np.radians(azim_deg), np.radians(elev_deg)
    c = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])
    r = np.cross(-c, [0.0, 0.0, 1.0])
    r /= np.linalg.norm(r)
    return np.vstack([r, np.cross(r, -c), c])


def principal_frame(tris: np.ndarray) -> np.ndarray:
    """Rotate a part so its longest dimension is horizontal (nicer thumbnails)."""
    pts = tris.reshape(-1, 3)
    q = pts - pts.mean(0)
    _, _, vt = np.linalg.svd(q[:: max(1, len(q) // 20000)], full_matrices=False)
    if np.linalg.det(vt) < 0:
        vt[2] *= -1
    return ((pts - pts.mean(0)) @ vt.T).reshape(-1, 3, 3)


def render(tris: np.ndarray, rgb, size=(320, 240), supersample=3, azim=-55.0, elev=30.0) -> Image.Image:
    """Flat-shaded, outlined, transparent-background render of one mesh."""
    w, h = size[0] * supersample, size[1] * supersample
    cam = _camera(azim, elev)
    p = tris @ cam.T
    xy = p[..., :2].reshape(-1, 2)
    lo, hi = xy.min(0), xy.max(0)
    scale = 0.86 * min(w / max(hi[0] - lo[0], 1e-6), h / max(hi[1] - lo[1], 1e-6))
    cx, cy = (lo + hi) / 2
    px = (p[..., 0] - cx) * scale + w / 2
    py = h / 2 - (p[..., 1] - cy) * scale
    pz = p[..., 2]
    zbuf = np.full((h, w), -np.inf)
    tid = np.full((h, w), -1, dtype=np.int64)
    x0s, x1s = np.floor(px.min(1)).astype(int), np.ceil(px.max(1)).astype(int)
    y0s, y1s = np.floor(py.min(1)).astype(int), np.ceil(py.max(1)).astype(int)
    for i in range(len(tris)):
        x0, x1 = max(x0s[i], 0), min(x1s[i], w - 1)
        y0, y1 = max(y0s[i], 0), min(y1s[i], h - 1)
        if x0 > x1 or y0 > y1:
            continue
        (ax, bx, cx_), (ay, by, cy_) = px[i], py[i]
        den = (by - cy_) * (ax - cx_) + (cx_ - bx) * (ay - cy_)
        if abs(den) < 1e-12:
            continue
        gx = np.arange(x0, x1 + 1) + 0.5
        gy = (np.arange(y0, y1 + 1) + 0.5)[:, None]
        w0 = ((by - cy_) * (gx - cx_) + (cx_ - bx) * (gy - cy_)) / den
        w1 = ((cy_ - ay) * (gx - cx_) + (ax - cx_) * (gy - cy_)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-7) & (w1 >= -1e-7) & (w2 >= -1e-7)
        z = w0 * pz[i, 0] + w1 * pz[i, 1] + w2 * pz[i, 2]
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        upd = inside & (z > sub)
        sub[upd] = z[upd]
        tid[y0:y1 + 1, x0:x1 + 1][upd] = i
    mask = tid >= 0
    n = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    n[n[:, 2] < 0] *= -1
    light = np.array([-0.45, 0.6, 0.66]) / np.linalg.norm([-0.45, 0.6, 0.66])
    shade = 0.36 + 0.64 * np.clip(n @ light, 0, 1)
    base = np.array(rgb, float) / 255.0
    img = np.ones((h, w, 3))
    img[mask] = np.clip(base[None, :] * shade[tid[mask]][:, None] + 0.06, 0, 1)
    edge = np.zeros_like(mask)
    zfin = np.where(mask, zbuf, pz.min() - 1e3)
    depth_step = 0.05 * (pz.max() - pz.min() + 1e-6)
    for dy, dx in ((0, 1), (1, 0)):
        a = np.roll(tid, (dy, dx), axis=(0, 1))
        za = np.roll(zfin, (dy, dx), axis=(0, 1))
        edge |= mask & ((a < 0) | (np.abs(za - zfin) > depth_step))
    img[edge] = np.array([55, 62, 70]) / 255.0
    rgba = np.dstack([img, mask.astype(float)])
    big = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
    return big.resize(size, Image.LANCZOS)
