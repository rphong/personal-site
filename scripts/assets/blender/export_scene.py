import argparse
import json
import sys
from pathlib import Path

import bpy


SCRIPT_ROOT = Path(__file__).resolve().parent
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))
sys.dont_write_bytecode = True

from inspect_scene import descendants, inspect_scene, root_is_inert


EXPECTED_VERSION = (3, 6, 23)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    args = parse_args()
    require(
        tuple(bpy.app.version) == EXPECTED_VERSION,
        f"Expected Blender {EXPECTED_VERSION}, got {tuple(bpy.app.version)}",
    )
    require(bool(bpy.data.filepath), "A canonical source .blend must be open")

    inspection = inspect_scene()
    require(
        inspection["rootCount"] == 1,
        f"Expected exactly one WEB_EXPORT_ROOT, found {inspection['rootCount']}",
    )
    require(
        root_is_inert(bpy.data.objects["WEB_EXPORT_ROOT"]),
        "WEB_EXPORT_ROOT is not inert",
    )
    require(
        inspection["rootState"]["inScene"]
        and inspection["rootState"]["inViewLayer"],
        "WEB_EXPORT_ROOT is outside the active scene or view layer",
    )
    require(
        inspection["inactiveObjects"] == [],
        f"Export objects are outside the active scene or view layer: {inspection['inactiveObjects']}",
    )
    require(
        inspection["externalResources"] == [],
        f"External resources are forbidden: {inspection['externalResources']}",
    )
    require(
        inspection["nonFileImages"] == [],
        f"Non-file images are unsupported: {inspection['nonFileImages']}",
    )
    require(
        inspection["particleSystems"] == [],
        f"Particle systems are not exportable: {inspection['particleSystems']}",
    )
    require(
        inspection["volumeObjects"] == [],
        f"Volume objects are not exportable: {inspection['volumeObjects']}",
    )
    require(
        inspection["shadowCatchers"] == [],
        f"Shadow catchers are not exportable: {inspection['shadowCatchers']}",
    )
    require(
        inspection["cameraObjects"] == [],
        f"Camera objects escaped the export root: {inspection['cameraObjects']}",
    )
    require(
        inspection["lightObjects"] == [],
        f"Light objects escaped the export root: {inspection['lightObjects']}",
    )
    require(
        inspection["triangleEstimate"] > 0,
        "Export root contains no mesh triangles",
    )

    root = bpy.data.objects["WEB_EXPORT_ROOT"]
    export_objects = [root, *descendants(root)]
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in export_objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_select = False
        obj.select_set(True)
        require(obj.select_get(), f"Could not select export object: {obj.name}")
    bpy.context.view_layer.objects.active = root

    output_path = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        use_visible=False,
        use_renderable=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_frame_range=False,
        export_force_sampling=True,
        export_nla_strips=True,
        export_def_bones=False,
    )
    require("FINISHED" in result, f"Blender GLB export failed: {result}")
    require(output_path.is_file(), f"Blender did not write {output_path}")
    require(
        output_path.read_bytes()[:4] == b"glTF",
        "Blender output is not binary glTF",
    )
    report_path.write_text(
        json.dumps(inspection, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"raw GLB exported: {output_path}")


if __name__ == "__main__":
    main()
