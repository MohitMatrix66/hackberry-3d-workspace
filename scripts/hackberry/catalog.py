"""Human-readable metadata for the HACKberry right-hand assembly.

Part names and quantities come from ``HACKberry_BOM_v2.xlsx`` (the original Fusion 360 names are kept
as ``cadName``). Units, print profiles and the bought-part shapes are this project's own additions.
"""

# --------------------------------------------------------------------------- units (colour groups)
UNITS = [
    {"id": "index", "name": "Index finger", "group": "Fingers", "color": "#E07A2E",
     "description": "Driven by the standard servo through a printed gear pair (motor gear R-H-08 -> input link R-I-03)."},
    {"id": "middle", "name": "Middle finger", "group": "Fingers", "color": "#2A9D8F",
     "description": "Moves together with the ring and little fingers; all three share one micro servo."},
    {"id": "ring", "name": "Ring finger", "group": "Fingers", "color": "#37B3A4",
     "description": "Linked to the middle finger by coupler link R-H-06."},
    {"id": "little", "name": "Little finger", "group": "Fingers", "color": "#5CC6B8",
     "description": "Pushed by the finger main coupler link R-H-07 and linked to the ring finger by R-H-05."},
    {"id": "thumb", "name": "Thumb", "group": "Fingers", "color": "#3D5A98",
     "description": "Its own micro servo sits inside the thumb metacarpal; a button switches it open or closed."},
    {"id": "palm", "name": "Palm & drive", "group": "Hand", "color": "#C5CBD3",
     "description": "Palm base, back cover, motor holder, drive links and the three servos."},
    {"id": "electronics", "name": "Hand board", "group": "Hand", "color": "#2E7D4F",
     "description": "Arduino Micro shield with buttons, jacks and the power switch."},
    {"id": "wrist", "name": "Wrist unit", "group": "Arm", "color": "#8A6BB0",
     "description": "Passive rotation (pronation/supination) with a lock pin and a quick-release ejector."},
    {"id": "socket", "name": "Forearm frame & battery", "group": "Arm", "color": "#E4DED3",
     "description": "Main frame halves, battery case and door. The socket for the residual limb attaches here."},
    {"id": "accessory", "name": "Optional accessories", "group": "Optional", "color": "#A3A8AE",
     "description": "Parts for the original optical sensor and an external battery case. Not part of the assembly."},
]

# --------------------------------------------------------------------------- print profiles
PROFILES = {
    "cover": {
        "name": "Covers & frames", "layer": "0.20 mm", "walls": "3 (1.2 mm)", "infill": "25 % gyroid",
        "speed": "60 mm/s", "supports": "Tree supports where needed",
        "orientation": "Largest flat face on the bed", "material": "PETG (PLA+ for a test print)",
        "wall_mm": 1.2, "infill_fraction": 0.25,
    },
    "structural": {
        "name": "Fingers & structural parts", "layer": "0.15 mm", "walls": "4 (1.6 mm)", "infill": "50 % gyroid",
        "speed": "50 mm/s", "supports": "Minimal",
        "orientation": "On its side, so the layers run along the part", "material": "PETG or PA12 nylon",
        "wall_mm": 1.6, "infill_fraction": 0.5,
    },
    "precision": {
        "name": "Links, gears, pins & small parts", "layer": "0.12 mm", "walls": "5 or solid", "infill": "100 %",
        "speed": "30-40 mm/s", "supports": "Avoid if possible",
        "orientation": "Flat, with pin holes vertical; drill 2 mm holes to size", "material": "PETG or PA12 nylon",
        "wall_mm": 2.0, "infill_fraction": 1.0,
    },
}

# --------------------------------------------------------------------------- printed parts
# id: (name, cadName, unit, qty, profile, note)
PARTS = {
    "R-H-01": ("Wrist mount", "HbWristMount01", "palm", 1, "precision", ""),
    "R-H-02": ("Palm base", "HbPalmBase03", "palm", 1, "cover", "The main structure of the hand; servos and links mount on it."),
    "R-H-03": ("Shaft stopper B", "HbShaftStopperB04", "palm", 1, "precision", "Keeps the finger shafts from sliding out."),
    "R-H-04": ("Shaft stopper A", "HbShaftStopperA04", "palm", 1, "precision", "Keeps the finger shafts from sliding out."),
    "R-H-05": ("Ring-little coupler link", "HbRing-LittleCouplerLink01", "palm", 1, "precision", "Passes the drive from the ring finger to the little finger."),
    "R-H-06": ("Middle-ring coupler link", "HbMiddle-RingCouplerLink01", "palm", 1, "precision", "Passes the drive from the middle finger to the ring finger."),
    "R-H-07": ("Finger main coupler link", "HbFingerMainCouplerLink01", "palm", 1, "precision", "Push rod from the micro servo horn to the three-finger linkage."),
    "R-H-08": ("Index motor gear", "HbIndexMotorGear02", "palm", 1, "precision", "Mounted on the standard servo; meshes with the index input link."),
    "R-H-09": ("Motor holder", "HbMotorHolder01", "palm", 1, "structural", "Bracket that holds the micro servo of the three-finger group."),
    "R-H-10": ("Max button", "HbMaxButton05", "palm", 1, "precision", ""),
    "R-H-11": ("Min button", "HbMinButton05", "palm", 1, "precision", ""),
    "R-H-12": ("Thumb button", "HbThumbButton05", "palm", 1, "precision", "Switches the thumb between open and closed."),
    "R-H-13": ("Finger lock button", "HbFingerLockButton05", "palm", 1, "precision", "Freezes the three-finger group so only the index moves."),
    "R-H-14": ("Power lever", "HbPowerLever05", "palm", 1, "precision", ""),
    "R-H-15": ("Back cover", "HbBackCover02", "palm", 1, "cover", "The original file is 79 MB; the web view uses a lighter copy."),
    "R-I-01": ("Index middle-distal phalanx", "HbIndexMiddle-DistalPhalanx02", "index", 1, "structural", "Middle and distal phalanx in one piece (the DIP joint is fixed)."),
    "R-I-02": ("Index coupler link cover", "HbIndexCouplerLinkCover02", "index", 1, "structural", ""),
    "R-I-03": ("Index input link", "HbIndexInputLink02", "index", 1, "precision", "Gear sector on the knuckle shaft, driven by the index motor gear."),
    "R-I-04": ("Index coupler link", "HbIndexCouplerLink02", "index", 1, "precision", "Joins the input link to the middle-distal phalanx."),
    "R-I-05": ("Index release lever", "HbIndexReleaseLever02", "index", 1, "precision", ""),
    "R-I-06": ("Index proximal phalanx", "HbIndexProximalPhalanx03", "index", 1, "structural", "One of two side plates."),
    "R-I-07": ("Index proximal phalanx cover", "HbIndexProximalPhalanxCover02", "index", 1, "structural", "The second side plate."),
    "R-O-01": ("Middle-distal phalanx", "HbMiddle-DistalPhalanx02", "middle", 3, "structural", "Used in the middle, ring and little fingers."),
    "R-O-02": ("Coupler link cover", "HbCouplerLinkCover03", "middle", 3, "structural", "Used in the middle, ring and little fingers."),
    "R-O-03": ("Proximal phalanx", "HbProximalPhalanx02", "middle", 3, "structural", "One of two side plates; used in three fingers."),
    "R-O-04": ("Proximal phalanx cover", "HbProximalPhalanxCover02", "middle", 3, "structural", "The second side plate; used in three fingers."),
    "R-O-05": ("Coupler link", "HbCouplerLink02", "middle", 3, "precision", "Used in the middle, ring and little fingers."),
    "R-T-01": ("Thumb proximal phalanx", "HbThumbProximalPhalanx02", "thumb", 1, "structural", ""),
    "R-T-02": ("Thumb proximal phalanx base", "HbThumbProximalPhalanxBase02", "thumb", 1, "structural", "Mounts on the thumb servo horn."),
    "R-T-03": ("Thumb metacarpal", "HbThumbMetacarpalPhalanx02", "thumb", 1, "structural", "Houses the thumb micro servo."),
    "R-T-04": ("Thumb lock button", "HbThumbLockButton01", "thumb", 1, "precision", ""),
    "R-T-05": ("Thumb joint holder", "HbThumbJointHolder01", "thumb", 1, "precision", ""),
    "R-T-06": ("Thumb metacarpal cover", "HbThumbMetacarpalPhalanxCover02", "thumb", 1, "cover", ""),
    "R-W-01": ("Abduction lever", "HBabductionLever02", "wrist", 1, "precision", ""),
    "R-W-02": ("Arm mount base", "HBarmMountBase03", "wrist", 1, "structural", ""),
    "R-W-03": ("Pronation lock pin", "HBpronationLockPin02", "wrist", 1, "precision", "Locks the wrist rotation."),
    "R-W-04": ("Wrist lock plate", "HBWristLockplate", "wrist", 1, "structural", ""),
    "R-W-05": ("Lock plate holder", "HBlockPlateHolder02", "wrist", 1, "precision", ""),
    "R-W-06": ("Ejector lever", "HBejectorLever02", "wrist", 1, "precision", "Releases the hand from the forearm."),
    "R-W-07": ("Arm mount U", "HbArmMountU01", "wrist", 1, "structural", ""),
    "R-W-08": ("Arm mount base cover", "HBarmMountBaseCover03", "wrist", 1, "cover", ""),
    "R-SO-01": ("Main frame B", "HbMainFrameB01", "socket", 1, "cover", ""),
    "R-SO-02": ("Main frame A", "HbMainFrameA01", "socket", 1, "cover", ""),
    "R-SO-03": ("Battery lock knob", "HbBatteryLockKnob01", "socket", 1, "precision", ""),
    "R-SO-04": ("Battery case", "HbBatteryCase01", "socket", 1, "cover", ""),
    "R-SO-05": ("Battery door knob", "HbBatteryDoorKnob03", "socket", 1, "precision", ""),
    "R-SO-06": ("Battery door lever", "HbBatteryDoorLever03", "socket", 1, "precision", ""),
    "R-SO-07": ("Battery door", "HbBatteryDoor03", "socket", 1, "cover", ""),
    "R-SO-08": ("Battery hinge A", "HbBatteryHingeA03", "socket", 1, "precision", ""),
    "R-SO-09": ("Battery hinge B", "HbBatteryHingeB03", "socket", 1, "precision", ""),
    "R-SO-10": ("Battery hinge C", "HbBatteryHingeC03", "socket", 1, "precision", ""),
    "C-SE-01": ("Sensor holder", "HbSensorHolder02", "accessory", 1, "precision", "Only for the original optical muscle sensor (not needed with EMG electrodes)."),
    "C-SE-02": ("Sensor plate", "HbSensorPlate01", "accessory", 1, "precision", "Only for the original optical muscle sensor."),
    "C-B-01": ("External battery case holder", "HbBatteryCaseHolder01", "accessory", 1, "cover", "Optional external battery."),
    "C-B-02": ("External battery lock knob", "HbBatteryLockKnob01", "accessory", 1, "precision", "Optional external battery."),
    "C-B-03": ("External battery case", "HbBatteryCase01", "accessory", 1, "cover", "Optional external battery."),
}

STL_FOLDER = {"H": "Right/Hand", "I": "Right/Indexfinger", "O": "Right/Otherfingers", "T": "Right/Thumbfinger",
              "W": "Right/Wrist", "SO": "Right/Socket", "SE": "Common/SE", "B": "Common/B"}

# --------------------------------------------------------------------------- bought parts
# Shapes are described in each product's own coordinates (mm), read from the STEP file.
SERVOS = {
    # product: role details, looked up by the node path in build_assets.py
    "GWS_S03N": {
        "kind": "servo", "name": "Standard servo",
        "body": [[-29.9, -10.0, -27.0], [10.6, 10.0, 8.8]],
        "ears": [[-37.2, -9.5, -1.3], [18.9, 9.5, 1.2]],
        "boss": {"center": [0, 0], "r": 5.5, "range": [8.8, 9.8]},
        "spline": {"center": [0, 0], "r": 3.0, "range": [9.8, 15.2]},
        "axis": "z",
    },
    "ASV-15MG": {
        "kind": "servo", "name": "Micro servo",
        "body": [[-11.3, 0.0, -5.8], [11.3, 20.8, 5.8]],
        "ears": [[-16.0, 15.0, -5.8], [16.0, 16.6, 5.8]],
        "boss": {"center": [6.0, 0.0], "r": 5.8, "range": [20.8, 24.0]},
        "spline": {"center": [6.0, 0.0], "r": 2.4, "range": [24.0, 27.6]},
        "axis": "y",
    },
}

SERVO_ROLES = [
    {"id": "servo-index", "match": ("GWS_S03N", None), "unit": "palm", "title": "Index finger servo",
     "cad": "GWS S03N (standard size)", "bom": "Power HD HD-3001HB",
     "torque": "3.5 kg·cm at 4.8 V, 4.4 kg·cm at 6 V", "size": "40.7 × 20.5 × 39.5 mm, 43 g",
     "drives": "Index finger, through the index motor gear (R-H-08) and the index input link (R-I-03).",
     "firmware": "servoIndex - travel 117° (HackberryV3.1_Mk2_EMG.ino)"},
    {"id": "servo-fingers", "match": ("ASV-15MG", "R-H"), "unit": "palm", "title": "Middle, ring & little finger servo",
     "cad": "ASV-15MG (micro size)", "bom": "Emax ES08MD II",
     "torque": "1.6 kg·cm at 4.8 V, 2.0 kg·cm at 6 V", "size": "23 × 11.5 × 24 mm, 13 g",
     "drives": "Middle, ring and little fingers, through the finger main coupler link (R-H-07) and links R-H-06 and R-H-05.",
     "firmware": "servoOther - travel 55°, can be locked by the finger lock button"},
    {"id": "servo-thumb", "match": ("ASV-15MG", "R-T"), "unit": "thumb", "title": "Thumb servo",
     "cad": "ASV-15MG (micro size)", "bom": "Emax ES08MD II",
     "torque": "1.6 kg·cm at 4.8 V, 2.0 kg·cm at 6 V", "size": "23 × 11.5 × 24 mm, 13 g",
     "drives": "Thumb proximal phalanx (R-T-01, R-T-02), switched open or closed by the thumb button.",
     "firmware": "servoThumb - travel 86°"},
]

# Simple shapes for the other bought parts (product coordinates, mm)
HARDWARE = {
    "ScrewM2L10": {"kind": "screw", "name": "M2 × 10 tapping screw", "axis": "z", "head": [0.0, 1.3, 1.75], "shank": [-10.0, 0.0, 1.0]},
    "ScrewM3L8Btite": {"kind": "screw", "name": "M3 × 8 tapping screw", "axis": "z", "head": [0.0, 2.0, 2.75], "shank": [-8.0, 0.0, 1.5]},
    "flatScrewM2L6PHI3.3T1": {"kind": "screw", "name": "M2 × 6 flat-head tapping screw", "axis": "y", "head": [0.0, 1.3, 1.65], "shank": [-4.7, 0.0, 1.0]},
    "WasherM2Ph4.3T0": {"kind": "ring", "name": "M2 washer", "axis": "z", "range": [0.0, 0.3], "rOuter": 2.15, "rInner": 1.15},
    "MetalCollarPh3L5": {"kind": "ring", "name": "Metal collar (bushing) 2.2/3.2 × 5 mm", "axis": "z", "range": [-5.0, 0.0], "rOuter": 1.6, "rInner": 1.1},
    "UsmBearing01": {"kind": "ring", "name": "Ball bearing, 4 mm bore", "axis": "x", "range": [0.0, 2.5], "rOuter": 4.1, "rInner": 2.0},
    "SBI-SUJ-1d4": {"kind": "ball", "name": "Steel ball 1/4 inch", "center": [0, 0, 0], "r": 3.175},
    "CP 0": {"kind": "spring", "name": "Coil spring 0.5 × 6 × 8 mm", "axis": "z", "range": [0.0, 8.0], "r": 2.75, "wire": 0.25, "turns": 5},
    "TOS 0": {"kind": "torsion", "name": "Torsion spring 0.3 × 4 mm, 270°", "axis": "z", "range": [-1.8, 0.0], "r": 2.15, "wire": 0.15, "turns": 5, "arm": 12.0},
    "HbServoHorn01": {"kind": "horn-round", "name": "Round servo horn (index servo)", "axis": "z", "disc": [0.0, 2.0, 10.85], "hub": [-3.5, 0.0, 4.7]},
    "ASV-15MGSingleHorn01": {"kind": "horn-arm", "name": "Single-arm micro servo horn", "axis": "z", "hub": [-2.4, 1.9, 2.9], "arm": [-0.4, 1.4], "tip": [13.5, 3.0], "rootHalfWidth": 4.0},
}

HARDWARE_NAMES = {
    "DMW-BLF19": ("7.2 V Li-ion battery (Panasonic DMW-BLF19)", "battery"),
    "HbBatteryPcb02": ("Battery board", "board"),
    "101050-003": ("Battery contact probe", "metal"),
    "PCB": ("Hand board PCB (Arduino Micro shield)", "board"),
    "MJ074N v1": ("3.5 mm sensor jack", "dark"),
    "MJ179PH": ("DC power jack", "dark"),
    "SS12SDP2": ("Power slide switch", "dark"),
    "SKRGAQD010": ("Tact switch", "dark"),
    "H3-2": ("Board header", "dark"),
}

SHAFT_NAME = "Steel shaft Ø2 × {length:.0f} mm"
