import argparse
import json
import sys
from pathlib import Path

import bpy


DEFAULT_FRAMES = (1, 19, 33)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--contaminated-root-destination")
    mode.add_argument("--destination")
    mode.add_argument("--export-glb")
    mode.add_argument("--instanced-root-destination")
    mode.add_argument("--report")
    mode.add_argument("--unlinked-root-destination")
    parser.add_argument("--frames", default=",".join(str(frame) for frame in DEFAULT_FRAMES))
    return parser.parse_args(argv)


def rounded_vector(values):
    rounded = [round(float(value), 6) for value in values]
    return [0.0 if value == 0.0 else value for value in rounded]


def rounded_matrix(matrix):
    return [rounded_vector(row) for row in matrix]


def action_details(action):
    return {
        "frameRange": rounded_vector(action.frame_range),
        "fcurves": [
            {
                "arrayIndex": curve.array_index,
                "dataPath": curve.data_path,
                "keyframes": [
                    {
                        "co": rounded_vector(point.co),
                        "interpolation": point.interpolation,
                    }
                    for point in curve.keyframe_points
                ],
            }
            for curve in sorted(
                action.fcurves,
                key=lambda item: (item.data_path, item.array_index),
            )
        ],
    }


def constraint_details(constraint):
    details = {
        "name": constraint.name,
        "type": constraint.type,
    }
    for prop in sorted(constraint.bl_rna.properties, key=lambda item: item.identifier):
        name = prop.identifier
        if name in {"rna_type", "name", "type"} or prop.is_readonly:
            continue
        value = getattr(constraint, name, None)
        if prop.type == "POINTER":
            if isinstance(value, bpy.types.Object):
                details[name] = value.name
        elif prop.type in {"BOOLEAN", "ENUM", "FLOAT", "INT", "STRING"}:
            if isinstance(value, (bool, int, float, str)):
                details[name] = round(value, 6) if isinstance(value, float) else value
            else:
                try:
                    details[name] = rounded_vector(value)
                except (TypeError, ValueError):
                    pass
    return details


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(current.children)
    return result


def create_triangle_mesh(name):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(
        [(0.0, 0.0, 0.0), (0.8, -0.25, 0.0), (0.8, 0.25, 0.0)],
        [],
        [(0, 1, 2)],
    )
    mesh.update()
    return mesh


def create_fixture(destination):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    curve_data = bpy.data.curves.new("BezierCurveData", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.path_duration = 100
    spline = curve_data.splines.new("POLY")
    spline.points.add(3)
    for point, coordinate in zip(
        spline.points,
        (
            (-3.0, 0.0, 0.0, 1.0),
            (-1.0, 2.0, 0.5, 1.0),
            (1.0, -2.0, 1.0, 1.0),
            (3.0, 0.0, 1.5, 1.0),
        ),
    ):
        point.co = coordinate
    curve = bpy.data.objects.new("BezierCurve", curve_data)
    bpy.context.scene.collection.objects.link(curve)
    curve.hide_render = True
    curve.location = (0.25, -0.5, 0.75)

    carrier = bpy.data.objects.new("Empty", None)
    bpy.context.scene.collection.objects.link(carrier)
    carrier.hide_render = True
    constraint = carrier.constraints.new("FOLLOW_PATH")
    constraint.name = "Follow Path"
    constraint.target = curve
    constraint.use_fixed_location = True
    constraint.use_curve_follow = False
    constraint.forward_axis = "FORWARD_X"
    constraint.up_axis = "UP_Z"
    action = bpy.data.actions.new("EmptyAction")
    carrier.animation_data_create()
    carrier.animation_data.action = action
    fcurve = action.fcurves.new(
        data_path='constraints["Follow Path"].offset_factor',
    )
    for frame, value in ((1.0, 0.0), (19.0, 0.5), (33.0, 1.0)):
        point = fcurve.keyframe_points.insert(frame, value)
        point.interpolation = "LINEAR"

    plane = bpy.data.objects.new("Paper plane", create_triangle_mesh("PaperPlaneMesh"))
    bpy.context.scene.collection.objects.link(plane)
    plane.parent = carrier
    plane.location = (0.4, 0.15, 0.1)

    unrelated = bpy.data.objects.new("UnrelatedHidden", None)
    bpy.context.scene.collection.objects.link(unrelated)
    unrelated.hide_render = True
    unrelated.location = (50.0, 50.0, 50.0)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 33
    scene.frame_set(19)
    bpy.context.view_layer.update()
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(destination),
        check_existing=False,
        compress=True,
    )


def create_contaminated_root_fixture(destination):
    create_fixture(destination)
    root = bpy.data.objects.new("WEB_EXPORT_ROOT", None)
    bpy.context.scene.collection.objects.link(root)
    root.parent = bpy.data.objects["UnrelatedHidden"]
    root.location = (4.0, -3.0, 2.0)
    root.rotation_mode = "QUATERNION"
    root.rotation_quaternion = (0.5, 0.5, 0.5, 0.5)
    root.rotation_axis_angle = (0.75, 0.0, 0.0, 1.0)
    root.scale = (1.5, 0.75, 2.0)
    root.delta_location = (0.5, -0.25, 0.75)
    root.delta_rotation_euler = (0.1, 0.2, 0.3)
    root.delta_rotation_quaternion = (0.9238795, 0.0, 0.3826834, 0.0)
    root.delta_scale = (1.1, 0.9, 1.2)
    constraint = root.constraints.new("COPY_LOCATION")
    constraint.name = "Root Drift Constraint"
    constraint.target = bpy.data.objects["BezierCurve"]
    action = bpy.data.actions.new("RootDriftAction")
    root.animation_data_create()
    root.animation_data.action = action
    curve = action.fcurves.new(data_path="location", index=1)
    curve.keyframe_points.insert(1.0, -3.0)
    curve.keyframe_points.insert(33.0, 8.0)
    driver = root.driver_add("delta_location", 0).driver
    driver.expression = "1.25"
    bpy.context.scene.frame_set(19)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(
        filepath=str(Path(destination).resolve()),
        check_existing=False,
        compress=True,
    )


def create_instanced_root_fixture(destination):
    create_fixture(destination)
    root = bpy.data.objects.new("WEB_EXPORT_ROOT", None)
    bpy.context.scene.collection.objects.link(root)
    instance_collection = bpy.data.collections.new("RootInstanceCollection")
    probe = bpy.data.objects.new("RootInstanceProbe", None)
    instance_collection.objects.link(probe)
    root.instance_type = "COLLECTION"
    root.instance_collection = instance_collection
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(
        filepath=str(Path(destination).resolve()),
        check_existing=False,
        compress=True,
    )


def create_unlinked_root_fixture(destination):
    create_fixture(destination)
    root = bpy.data.objects.new("WEB_EXPORT_ROOT", None)
    root.use_fake_user = True
    bpy.ops.wm.save_as_mainfile(
        filepath=str(Path(destination).resolve()),
        check_existing=False,
        compress=True,
    )


def create_report(report_path, frames):
    scene = bpy.context.scene
    original_frame = scene.frame_current
    samples = {}
    for frame in frames:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        samples[str(frame)] = {
            obj.name: {
                "matrixWorld": rounded_matrix(obj.matrix_world),
                "translation": rounded_vector(obj.matrix_world.translation),
            }
            for obj in sorted(bpy.data.objects, key=lambda item: item.name)
        }
    scene.frame_set(original_frame)
    bpy.context.view_layer.update()

    roots = [obj for obj in bpy.data.objects if obj.name == "WEB_EXPORT_ROOT"]
    root = roots[0] if len(roots) == 1 else None
    report = {
        "actions": {
            action.name: action_details(action)
            for action in sorted(bpy.data.actions, key=lambda item: item.name)
        },
        "constraints": {
            obj.name: [
                constraint_details(constraint)
                for constraint in obj.constraints
            ]
            for obj in sorted(bpy.data.objects, key=lambda item: item.name)
            if obj.constraints
        },
        "objects": sorted(obj.name for obj in bpy.data.objects),
        "parents": {
            obj.name: obj.parent.name if obj.parent else None
            for obj in sorted(bpy.data.objects, key=lambda item: item.name)
        },
        "rootCount": len(roots),
        "rootDescendants": [] if not root else sorted(
            obj.name for obj in descendants(root)
        ),
        "rootTransform": None if not root else {
            "location": rounded_vector(root.location),
            "rotationEuler": rounded_vector(root.rotation_euler),
            "scale": rounded_vector(root.scale),
        },
        "rootState": None if not root else {
            "animation": None if not root.animation_data else {
                "action": root.animation_data.action.name
                if root.animation_data.action else None,
                "drivers": len(root.animation_data.drivers),
                "nlaTracks": len(root.animation_data.nla_tracks),
            },
            "constraints": [constraint_details(item) for item in root.constraints],
            "deltaLocation": rounded_vector(root.delta_location),
            "deltaRotationEuler": rounded_vector(root.delta_rotation_euler),
            "deltaRotationQuaternion": rounded_vector(root.delta_rotation_quaternion),
            "deltaScale": rounded_vector(root.delta_scale),
            "matrixWorld": rounded_matrix(root.matrix_world),
            "parent": root.parent.name if root.parent else None,
            "rotationAxisAngle": rounded_vector(root.rotation_axis_angle),
            "rotationMode": root.rotation_mode,
            "rotationQuaternion": rounded_vector(root.rotation_quaternion),
        },
        "shadowCatchers": sorted(
            obj.name
            for obj in bpy.data.objects
            if obj.type == "MESH" and obj.is_shadow_catcher
        ),
        "samples": samples,
    }
    output = Path(report_path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def export_selected_glb(destination):
    roots = [obj for obj in bpy.data.objects if obj.name == "WEB_EXPORT_ROOT"]
    if len(roots) != 1:
        raise RuntimeError("Selected-root GLB export requires one WEB_EXPORT_ROOT")
    root = roots[0]
    bpy.ops.object.select_all(action="DESELECT")
    selected = [root, *descendants(root)]
    for obj in selected:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    output = Path(destination).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        use_renderable=False,
        export_animations=True,
        export_frame_range=True,
        export_frame_step=1,
        export_force_sampling=True,
        export_nla_strips=True,
        export_yup=False,
    )
    if "FINISHED" not in result or not output.is_file():
        raise RuntimeError(f"Selected-root GLB export failed: {result}")


def main():
    args = parse_args()
    if args.contaminated_root_destination:
        create_contaminated_root_fixture(args.contaminated_root_destination)
        print(
            "contaminated root fixture: "
            f"{Path(args.contaminated_root_destination).resolve()}"
        )
        return
    if args.instanced_root_destination:
        create_instanced_root_fixture(args.instanced_root_destination)
        print(
            "instanced root fixture: "
            f"{Path(args.instanced_root_destination).resolve()}"
        )
        return
    if args.unlinked_root_destination:
        create_unlinked_root_fixture(args.unlinked_root_destination)
        print(
            "unlinked root fixture: "
            f"{Path(args.unlinked_root_destination).resolve()}"
        )
        return
    if args.destination:
        create_fixture(args.destination)
        print(f"plane motion fixture: {Path(args.destination).resolve()}")
        return
    if args.export_glb:
        export_selected_glb(args.export_glb)
        print(f"selected-root GLB: {Path(args.export_glb).resolve()}")
        return
    frames = tuple(int(value) for value in args.frames.split(",") if value)
    create_report(args.report, frames)
    print(f"scene motion report: {Path(args.report).resolve()}")


if __name__ == "__main__":
    main()
