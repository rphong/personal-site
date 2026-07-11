import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy


SYSTEM_VIEWER_IMAGES = {
    "Render Result": "RENDER_RESULT",
    "Viewer Node": "COMPOSITING",
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def rounded_vector(values):
    rounded = [round(float(value), 6) for value in values]
    return [0.0 if value == 0.0 else value for value in rounded]


def rounded_matrix(matrix):
    return [rounded_vector(row) for row in matrix]


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(current.children)
    return result


def triangle_estimate(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            total += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    return total


def packed_image_sha256(image):
    if not image.packed_file:
        return None
    return hashlib.sha256(bytes(image.packed_file.data)).hexdigest()


def normalized_blender_path(value):
    return value.replace("\\", "/")


def image_reference_users(image):
    return bpy.data.user_map(subset={image}).get(image, set())


def is_unreferenced_system_viewer_image(image):
    return (
        image.name in SYSTEM_VIEWER_IMAGES
        and image.source == "VIEWER"
        and getattr(image, "type", None) == SYSTEM_VIEWER_IMAGES[image.name]
        and not image.use_fake_user
        and not image_reference_users(image)
    )


def non_file_image_record(image):
    return {
        "name": image.name,
        "source": image.source,
        "users": image.users,
    }


def custom_properties(value):
    return {
        key: value[key]
        for key in sorted(value.keys())
        if key != "_RNA_UI" and isinstance(value[key], (bool, float, int, str))
    }


def object_animation_binding(obj):
    animation = obj.animation_data
    if animation is None:
        return None
    return {
        "action": animation.action.name if animation.action else None,
        "drivers": len(animation.drivers),
        "nlaTracks": len(animation.nla_tracks),
    }


def object_constraint_summary(obj):
    return [
        {
            "name": constraint.name,
            "target": constraint.target.name
            if hasattr(constraint, "target") and constraint.target else None,
            "type": constraint.type,
        }
        for constraint in obj.constraints
    ]


def animation_details(action):
    return {
        "frameRange": rounded_vector(action.frame_range),
        "fcurves": [
            {
                "arrayIndex": curve.array_index,
                "dataPath": curve.data_path,
                "extrapolation": curve.extrapolation,
                "keyframes": [
                    {
                        "co": rounded_vector(point.co),
                        "handleLeft": rounded_vector(point.handle_left),
                        "handleLeftType": point.handle_left_type,
                        "handleRight": rounded_vector(point.handle_right),
                        "handleRightType": point.handle_right_type,
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


def main():
    args = parse_args()
    roots = [obj for obj in bpy.data.objects if obj.name == "WEB_EXPORT_ROOT"]
    root = roots[0] if len(roots) == 1 else None
    export_objects = [root, *descendants(root)] if root else []

    external_resources = []
    packed_images = []
    non_file_images = []
    system_viewer_images = []
    for image in bpy.data.images:
        if image.source != "FILE":
            record = non_file_image_record(image)
            if is_unreferenced_system_viewer_image(image):
                system_viewer_images.append(record)
            else:
                non_file_images.append(record)
            continue
        if image.packed_file:
            packed_images.append(image.name)
        else:
            external_resources.append({"kind": "image", "name": image.name, "path": image.filepath})
    for library in bpy.data.libraries:
        if library.filepath:
            external_resources.append({"kind": "library", "name": library.name, "path": library.filepath})

    particle_systems = sorted(
        obj.name for obj in export_objects if obj and len(obj.particle_systems) > 0
    )
    volume_objects = sorted(obj.name for obj in export_objects if obj and obj.type == "VOLUME")
    material_node_types = sorted({
        node.bl_idname
        for material in bpy.data.materials
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
    })

    report = {
        "allObjects": sorted(obj.name for obj in bpy.data.objects),
        "allObjectParents": {
            obj.name: obj.parent.name if obj.parent else None
            for obj in sorted(bpy.data.objects, key=lambda item: item.name)
        },
        "animations": sorted(action.name for action in bpy.data.actions),
        "animationDetails": {
            action.name: animation_details(action)
            for action in sorted(bpy.data.actions, key=lambda item: item.name)
        },
        "blenderVersion": ".".join(str(part) for part in bpy.app.version),
        "externalResources": sorted(external_resources, key=lambda item: (item["kind"], item["name"])),
        "fileImages": [
            {
                "filepath": normalized_blender_path(image.filepath),
                "name": image.name,
                "packed": bool(image.packed_file),
                "source": image.source,
            }
            for image in sorted(bpy.data.images, key=lambda item: item.name)
            if image.source == "FILE"
        ],
        "imageNames": sorted(image.name for image in bpy.data.images),
        "materialNames": sorted(material.name for material in bpy.data.materials),
        "materialImages": {
            material.name: sorted({
                node.image.name
                for node in material.node_tree.nodes
                if node.bl_idname == "ShaderNodeTexImage" and node.image
            })
            for material in sorted(bpy.data.materials, key=lambda item: item.name)
            if material.use_nodes
            and material.node_tree
            and any(
                node.bl_idname == "ShaderNodeTexImage" and node.image
                for node in material.node_tree.nodes
            )
        },
        "materialNodeTypes": material_node_types,
        "meshNames": sorted(mesh.name for mesh in bpy.data.meshes),
        "nonFileImages": sorted(
            non_file_images,
            key=lambda item: (item["name"], item["source"]),
        ),
        "objects": sorted(obj.name for obj in export_objects if obj),
        "objectCustomProperties": {
            obj.name: custom_properties(obj)
            for obj in sorted(export_objects, key=lambda item: item.name)
            if obj and custom_properties(obj)
        },
        "objectDimensions": {
            obj.name: rounded_vector(obj.dimensions)
            for obj in sorted(export_objects, key=lambda item: item.name)
            if obj
        },
        "objectMaterials": {
            obj.name: [
                slot.material.name if slot.material else None
                for slot in obj.material_slots
            ]
            for obj in sorted(export_objects, key=lambda item: item.name)
            if obj
        },
        "objectModifiers": {
            obj.name: sorted(modifier.type for modifier in obj.modifiers)
            for obj in sorted(export_objects, key=lambda item: item.name)
            if obj
        },
        "objectAnimationBindings": {
            obj.name: object_animation_binding(obj)
            for obj in sorted(bpy.data.objects, key=lambda item: item.name)
            if object_animation_binding(obj) is not None
        },
        "objectParents": {
            obj.name: obj.parent.name if obj.parent else None
            for obj in sorted(export_objects, key=lambda item: item.name)
            if obj
        },
        "objectTypes": {
            obj.name: obj.type
            for obj in sorted(export_objects, key=lambda item: item.name)
            if obj
        },
        "objectTransforms": {
            obj.name: {
                "location": rounded_vector(obj.location),
                "rotationEuler": rounded_vector(obj.rotation_euler),
                "scale": rounded_vector(obj.scale),
            }
            for obj in sorted(export_objects, key=lambda item: item.name)
            if obj
        },
        "packedImages": sorted(packed_images),
        "packedImageSha256": {
            image.name: packed_image_sha256(image)
            for image in sorted(bpy.data.images, key=lambda item: item.name)
            if image.source == "FILE" and image.packed_file
        },
        "particleSystems": particle_systems,
        "rootCount": len(roots),
        "sceneFrame": bpy.context.scene.frame_current,
        "shadowCatchers": [
            {
                "mesh": obj.data.name if obj.type == "MESH" and obj.data else None,
                "modifiers": sorted(modifier.type for modifier in obj.modifiers),
                "name": obj.name,
                "parent": obj.parent.name if obj.parent else None,
            }
            for obj in sorted(bpy.data.objects, key=lambda item: item.name)
            if obj.type == "MESH" and obj.is_shadow_catcher
        ],
        "rootTransform": None if not root else {
            "location": rounded_vector(root.location),
            "rotationEuler": rounded_vector(root.rotation_euler),
            "scale": rounded_vector(root.scale),
        },
        "rootCustomProperties": {} if not root else custom_properties(root),
        "rootState": None if not root else {
            "animation": object_animation_binding(root),
            "constraints": object_constraint_summary(root),
            "data": root.data is not None,
            "deltaLocation": rounded_vector(root.delta_location),
            "deltaRotationEuler": rounded_vector(root.delta_rotation_euler),
            "deltaRotationQuaternion": rounded_vector(root.delta_rotation_quaternion),
            "deltaScale": rounded_vector(root.delta_scale),
            "fieldType": None if getattr(root, "field", None) is None else root.field.type,
            "hidden": root.hide_get(),
            "hideRender": root.hide_render,
            "hideViewport": root.hide_viewport,
            "instanceCollection": root.instance_collection.name
            if root.instance_collection else None,
            "instanceType": root.instance_type,
            "inScene": bpy.context.scene.objects.get(root.name) == root,
            "inViewLayer": bpy.context.view_layer.objects.get(root.name) == root,
            "isHoldout": root.is_holdout,
            "isInstancer": root.is_instancer,
            "isShadowCatcher": root.is_shadow_catcher,
            "matrixWorld": rounded_matrix(root.matrix_world),
            "modifiers": sorted(
                (
                    {"name": modifier.name, "type": modifier.type}
                    for modifier in root.modifiers
                ),
                key=lambda item: (item["type"], item["name"]),
            ),
            "parent": root.parent.name if root.parent else None,
            "particleSystems": sorted(
                system.name for system in root.particle_systems
            ),
            "rigidBody": root.rigid_body is not None,
            "rigidBodyConstraint": root.rigid_body_constraint is not None,
            "rotationAxisAngle": rounded_vector(root.rotation_axis_angle),
            "rotationMode": root.rotation_mode,
            "rotationQuaternion": rounded_vector(root.rotation_quaternion),
        },
        "triangleEstimate": triangle_estimate([obj for obj in export_objects if obj]),
        "textureNames": sorted(texture.name for texture in bpy.data.textures),
        "systemViewerImages": sorted(
            system_viewer_images,
            key=lambda item: (item["name"], item["source"]),
        ),
        "volumeObjects": volume_objects,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"scene inspection: {report_path}")


if __name__ == "__main__":
    main()
