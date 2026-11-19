"""Read the assembly structure of a STEP (ISO 10303-21, AP203/AP214) file without a CAD kernel.

What it extracts
----------------
* The product tree: which product (part or sub-assembly) is used where.
* Every *node* of that tree (each occurrence of a product) with its 4x4 world matrix in millimetres.
* For every product, the vertex cloud of each solid body (``MANIFOLD_SOLID_BREP``) in the
  product's own coordinates. Vertex clouds are enough to size and orient simple stand-in shapes
  (screws, shafts, servos, boards) - surfaces are *not* tessellated.

How placements work in STEP
---------------------------
A ``NEXT_ASSEMBLY_USAGE_OCCURRENCE`` (NAUO) says "child product is used inside parent product".
Its placement is stored in a ``CONTEXT_DEPENDENT_SHAPE_REPRESENTATION`` whose representation
relationship carries an ``ITEM_DEFINED_TRANSFORMATION(item_1, item_2)``: the child's coordinate
system ``item_1`` is mapped onto ``item_2`` in the parent, so ``T(child -> parent) = A(item_2) . A(item_1)^-1``
where ``A(p)`` is the 4x4 matrix of an ``AXIS2_PLACEMENT_3D``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np

_ENTITY_RE = re.compile(r"#(\d+)\s*=\s*(.*?);\s*(?=#\d+\s*=|$)", re.S)
_REF_RE = re.compile(r"#(\d+)")
_VERSION_RE = re.compile(r"\s+v\d+$")


def clean_name(name: str) -> str:
    """Strip the Fusion 360 version suffix: ``'R-H-02 v2'`` -> ``'R-H-02'``."""
    return _VERSION_RE.sub("", name.strip()).strip()


@dataclass
class Node:
    """One occurrence of a product in the assembly tree."""

    product: str            # cleaned product name, e.g. "R-O-01"
    path: list[str]         # cleaned names from the root down to this node
    matrix: np.ndarray      # 4x4 world matrix (product coordinates -> world, mm)
    is_leaf: bool
    index: int = 0          # position in Assembly.nodes
    parent: int | None = None  # index of the parent node (None for the root)


@dataclass
class Solid:
    """Geometry hints for one solid body, in product coordinates (mm)."""

    vertices: np.ndarray    # (n, 3) B-rep vertex positions
    circles: np.ndarray     # (m, 7) circle edges: centre xyz, axis xyz, radius


@dataclass
class Assembly:
    root: str
    nodes: list[Node] = field(default_factory=list)
    solids: dict[str, list[Solid]] = field(default_factory=dict)  # product -> solid bodies

    @property
    def leaves(self) -> list[Node]:
        return [n for n in self.nodes if n.is_leaf]


class StepFile:
    """Minimal tokenizer/parser for the DATA section of a STEP file."""

    def __init__(self, path: str):
        text = open(path, encoding="latin-1").read()
        data = text[text.index("DATA;") + 5: text.rindex("ENDSEC;")]
        self.body = {int(m.group(1)): m.group(2).replace("\r", "").replace("\n", "")
                     for m in _ENTITY_RE.finditer(data)}
        self.type = {i: _entity_type(b) for i, b in self.body.items()}
        self.by_type: dict[str, list[int]] = {}
        for i, t in self.type.items():
            self.by_type.setdefault(t, []).append(i)
        self._cache: dict[int, list] = {}

    def args(self, i: int) -> list:
        if i not in self._cache:
            self._cache[i] = _parse_args(self.body[i])
        return self._cache[i]

    def refs(self, i: int) -> list[int]:
        return [int(x) for x in _REF_RE.findall(self.body[i])]

    def length_scale_to_mm(self) -> float:
        for i in self.by_type.get("COMPLEX", []):
            b = self.body[i]
            if "LENGTH_UNIT" in b and "SI_UNIT" in b:
                if ".MILLI." in b:
                    return 1.0
                if ".CENTI." in b:
                    return 10.0
                return 1000.0  # metre
        return 1.0

    def placement(self, i: int) -> np.ndarray:
        """4x4 matrix of an AXIS2_PLACEMENT_3D."""
        a = self.args(i)
        loc = np.array(self.args(_ref(a[1]))[1], float)
        z = np.array(self.args(_ref(a[2]))[1], float) if _ref(a[2]) else np.array([0.0, 0.0, 1.0])
        x = np.array(self.args(_ref(a[3]))[1], float) if _ref(a[3]) else np.array([1.0, 0.0, 0.0])
        z /= np.linalg.norm(z)
        x -= np.dot(x, z) * z
        x /= np.linalg.norm(x)
        m = np.eye(4)
        m[:3, 0], m[:3, 1], m[:3, 2], m[:3, 3] = x, np.cross(z, x), z, loc
        return m


def read_assembly(path: str) -> Assembly:
    step = StepFile(path)
    scale = step.length_scale_to_mm()

    # product definition -> product name
    product_name = {i: step.args(i)[1] for i in step.by_type["PRODUCT"]}
    formation = {i: _ref(step.args(i)[2])
                 for t in ("PRODUCT_DEFINITION_FORMATION", "PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE")
                 for i in step.by_type.get(t, [])}
    pd_name = {i: product_name[formation[_ref(step.args(i)[2])]] for i in step.by_type["PRODUCT_DEFINITION"]}

    # product definition shape -> what it describes (a product definition or a NAUO)
    pds_def = {i: _ref(step.args(i)[2]) for i in step.by_type["PRODUCT_DEFINITION_SHAPE"]}
    pd_shape_rep = {}
    for i in step.by_type["SHAPE_DEFINITION_REPRESENTATION"]:
        a = step.args(i)
        d = pds_def.get(_ref(a[0]))
        if d in pd_name:
            pd_shape_rep[d] = _ref(a[1])

    # parent -> [(child, T_child_to_parent)]
    nauo = {i: (_ref(step.args(i)[3]), _ref(step.args(i)[4])) for i in step.by_type["NEXT_ASSEMBLY_USAGE_OCCURRENCE"]}
    children: dict[int, list] = {}
    for i in step.by_type["CONTEXT_DEPENDENT_SHAPE_REPRESENTATION"]:
        a = step.args(i)
        rel, pds = _ref(a[0]), _ref(a[1])
        parent, child = nauo[pds_def[pds]]
        parts = _complex_parts(step.body[rel])
        idt = _ref(parts["REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION"][0])
        item_1, item_2 = _ref(step.args(idt)[2]), _ref(step.args(idt)[3])
        t = step.placement(item_2) @ np.linalg.inv(step.placement(item_1))
        children.setdefault(parent, []).append((child, t))

    used_as_child = {c for (_, c) in nauo.values()}
    root = next(pd for pd in pd_name if pd not in used_as_child)
    asm = Assembly(root=clean_name(pd_name[root]))

    def walk(pd: int, world: np.ndarray, path: list[str], parent: int | None) -> None:
        kids = children.get(pd, [])
        index = len(asm.nodes)
        asm.nodes.append(Node(clean_name(pd_name[pd]), path, world.copy(), not kids, index, parent))
        for child, t in kids:
            walk(child, world @ t, path + [clean_name(pd_name[child])], index)

    walk(root, np.eye(4), [asm.root], None)
    if scale != 1.0:
        for n in asm.nodes:
            n.matrix[:3, 3] *= scale

    # solid bodies per product: shape rep -> advanced brep rep(s) -> manifold solids -> vertices
    srr: dict[int, list[int]] = {}
    for i in step.by_type.get("SHAPE_REPRESENTATION_RELATIONSHIP", []):
        a = step.args(i)
        r1, r2 = _ref(a[2]), _ref(a[3])
        if step.type[r1] == "SHAPE_REPRESENTATION":
            srr.setdefault(r1, []).append(r2)
        elif step.type[r2] == "SHAPE_REPRESENTATION":
            srr.setdefault(r2, []).append(r1)
    for pd, rep in pd_shape_rep.items():
        bodies = []
        for brep_rep in srr.get(rep, []):
            for item in step.refs(brep_rep):
                if step.type[item] == "MANIFOLD_SOLID_BREP":
                    pts, circles = _solid_features(step, item)
                    if len(pts) or len(circles):
                        circles[:, :3] *= scale
                        circles[:, 6] *= scale
                        bodies.append(Solid(pts * scale, circles))
        if bodies:
            asm.solids[clean_name(pd_name[pd])] = bodies
    return asm


# ----------------------------------------------------------------------------- helpers
def _solid_features(step: StepFile, solid: int) -> tuple[np.ndarray, np.ndarray]:
    """Walk the B-rep topology of one solid; collect vertex positions and circular edges."""
    pts, circles, seen, stack = [], [], set(), [solid]
    skip = {"CARTESIAN_POINT", "DIRECTION", "AXIS2_PLACEMENT_3D", "COMPLEX"}
    while stack:
        j = stack.pop()
        if j in seen:
            continue
        seen.add(j)
        t = step.type[j]
        if t == "VERTEX_POINT":
            pts.append(step.args(_ref(step.args(j)[1]))[1])
        elif t == "CIRCLE":
            a = step.args(j)
            m = step.placement(_ref(a[1]))
            circles.append([*m[:3, 3], *m[:3, 2], float(a[2])])
        elif t not in skip:
            stack.extend(step.refs(j))
    return np.array(pts, float).reshape(-1, 3), np.array(circles, float).reshape(-1, 7)


def _entity_type(body: str) -> str:
    body = body.strip()
    return "COMPLEX" if body.startswith("(") else body[: body.index("(")].strip()


def _ref(v):
    return v[1] if isinstance(v, tuple) and v and v[0] == "ref" else None


def _parse_args(text: str) -> list:
    s = text[text.index("("):]

    def value(i):
        while s[i] == " ":
            i += 1
        c = s[i]
        if c == "'":
            j, buf = i + 1, []
            while True:
                if s[j] == "'" and s[j + 1: j + 2] == "'":
                    buf.append("'")
                    j += 2
                    continue
                if s[j] == "'":
                    return "".join(buf), j + 1
                buf.append(s[j])
                j += 1
        if c == "#":
            j = i + 1
            while s[j].isdigit():
                j += 1
            return ("ref", int(s[i + 1:j])), j
        if c == "(":
            return listing(i)
        if c in "$*":
            return None, i + 1
        if c == ".":
            j = s.index(".", i + 1)
            return ("enum", s[i + 1:j]), j + 1
        if c.isalpha():
            j = i
            while s[j].isalnum() or s[j] == "_":
                j += 1
            v, k = listing(j)
            return ("typed", s[i:j], v), k
        j = i
        while s[j] not in ",)":
            j += 1
        tok = s[i:j].strip()
        try:
            return float(tok), j
        except ValueError:
            return tok, j

    def listing(i):
        i += 1
        out = []
        while True:
            while s[i] == " ":
                i += 1
            if s[i] == ")":
                return out, i + 1
            v, i = value(i)
            out.append(v)
            while s[i] == " ":
                i += 1
            if s[i] == ",":
                i += 1

    return listing(0)[0]


def _complex_parts(body: str) -> dict[str, list]:
    """Split a complex entity '(A(...)B(...)C())' into {'A': args, 'B': args, ...}."""
    body = body.strip()[1:-1]
    parts, i = {}, 0
    while i < len(body):
        while i < len(body) and body[i] == " ":
            i += 1
        if i >= len(body):
            break
        j = body.index("(", i)
        name = body[i:j].strip()
        depth, k, in_str = 0, j, False
        while True:
            ch = body[k]
            if ch == "'":
                in_str = not in_str
            elif not in_str:
                depth += ch == "("
                depth -= ch == ")"
                if ch == ")" and depth == 0:
                    break
            k += 1
        parts[name] = _parse_args(name + body[j:k + 1])
        i = k + 1
    return parts
