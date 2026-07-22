import argparse
import hashlib
import json
import math
import random
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

EXPECTED_VERSION = (3, 6, 23)
CRANE_WORKOUT_CLEANUP_VERSION = 1
CRANE_WORKOUT_CLEANUP_POLICY = "remove-hidden-hand-mirror-v1"
CRANE_WORKOUT_REMOVED_OBJECT = "Hand Mirror"
CRANE_WORKOUT_REMOVED_MESH = "Cylinder.001"
CRANE_WORKOUT_REMOVED_MATERIALS = ("Mirror Frame", "Mirror Lens")
CRANE_WORKOUT_METADATA = {
    "crane_workout_cleanup_version": CRANE_WORKOUT_CLEANUP_VERSION,
    "crane_workout_cleanup_policy": CRANE_WORKOUT_CLEANUP_POLICY,
    "crane_workout_removed_object": CRANE_WORKOUT_REMOVED_OBJECT,
    "crane_workout_removed_data": "Cylinder.001|Mirror Frame|Mirror Lens",
}
ROCKET_SMOKE_BAKE_VERSION = 2
ROCKET_SMOKE_INTEGRITY_VERSION = 2
ROCKET_SMOKE_SIMULATION_POLICY = "procedural-seeded-static-v1"
ROCKET_SMOKE_SPECS = {
    "Smoke Emitter": {
        "baked_name": "RocketSmokeEngineBaked",
        "color": (1.0, 0.65, 0.08, 1.0),
        "emitter": "Engine Smoke",
        "expected_particles": 51,
        "instance": "Smoke Particle",
        "integrity_key": "engine",
        "legacy_brownian_factor": 1.0,
        "material": "RocketSmokeEnginePrincipled",
        "parent": "Rocket",
        "procedural_seed": 51060,
        "procedural_style": "engine-cone",
    },
    "Smoke Emitter Outward": {
        "baked_name": "RocketSmokeGroundBaked",
        "color": (0.62, 0.64, 0.67, 1.0),
        "emitter": "Ground Smoke",
        "expected_particles": 400,
        "instance": "Smoke Particle Gray",
        "integrity_key": "ground",
        "legacy_brownian_factor": 20.0,
        "material": "RocketSmokeGroundPrincipled",
        "parent": "WEB_EXPORT_ROOT",
        "procedural_seed": 40060,
        "procedural_style": "ground-ring",
    },
}
ROCKET_SMOKE_HELPERS = {
    "Engine Smoke",
    "Ground Smoke",
    "Smoke Particle",
    "Smoke Particle Gray",
    "Turbulence",
    "Wind",
}
ROCKET_SMOKE_MATERIALS = {"Material", "Material.001"}
ROCKET_SMOKE_TEXTURES = {"Horizontal Smoke", "Vertical Smoke"}
ROCKET_UNSUPPORTED_NODES = {
    "ShaderNodeBsdfDiffuse",
    "ShaderNodeBsdfTransparent",
    "ShaderNodeMath",
    "ShaderNodeMixShader",
    "ShaderNodeParticleInfo",
    "ShaderNodeValToRGB",
}
SYSTEM_VIEWER_IMAGES = {
    "Render Result": "RENDER_RESULT",
    "Viewer Node": "COMPOSITING",
}
WEB_GROUND_CLEANUP_VERSION = 1
WEB_GROUND_CLEANUP_POLICY = "remove-authored-shadow-catcher-v1"
WEB_GROUND_SHADOW_STRATEGY = "transparent-canvas-contact-shadow-v1"
WEB_GROUND_SPECS = {
    "Ground": {
        "mesh": "Plane",
        "modifiers": ("COLLISION",),
    },
    "Shadow Catcher": {
        "mesh": "Plane.001",
        "modifiers": (),
    },
}
WEB_GROUND_METADATA_KEYS = (
    "web_ground_cleanup_version",
    "web_ground_cleanup_policy",
    "web_ground_removed_object",
    "web_ground_removed_mesh",
    "web_ground_shadow_strategy",
)
STATIC_CRANE_POSE_BAKE_VERSION = 1
STATIC_CRANE_POSE_BAKE_POLICY = "bake-skinned-mesh-pose-v1"
STATIC_CRANE_POSE_METADATA_KEYS = (
    "static_crane_pose_bake_version",
    "static_crane_pose_bake_policy",
    "static_crane_pose_frame",
    "static_crane_pose_mesh",
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    parser.add_argument("--league-dashboard")
    parser.add_argument("--league-history")
    parser.add_argument(
        "--crane-workout-remove-hidden-hand-mirror",
        action="store_true",
    )
    parser.add_argument("--remove-web-ground", action="store_true")
    parser.add_argument("--rocket-smoke-bake-frame", type=int)
    parser.add_argument("--static-crane-pose-frame", type=int)
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def validate_completed_static_crane_pose_bake(root, frame):
    present = [key for key in STATIC_CRANE_POSE_METADATA_KEYS if key in root]
    if not present:
        return False
    require(
        len(present) == len(STATIC_CRANE_POSE_METADATA_KEYS),
        "Static crane pose bake metadata is partial or inconsistent",
    )
    require(
        int(root["static_crane_pose_bake_version"]) == STATIC_CRANE_POSE_BAKE_VERSION,
        "Static crane pose bake version drifted",
    )
    require(
        root["static_crane_pose_bake_policy"] == STATIC_CRANE_POSE_BAKE_POLICY,
        "Static crane pose bake policy drifted",
    )
    require(
        int(root["static_crane_pose_frame"]) == frame,
        "Static crane pose bake frame drifted",
    )
    mesh_name = root["static_crane_pose_mesh"]
    mesh = bpy.data.objects.get(mesh_name)
    require(mesh is not None and mesh.type == "MESH", "Static crane pose mesh is missing")
    require(mesh.parent == root, "Static crane pose mesh left the export root")
    require(
        not any(modifier.type == "ARMATURE" for modifier in mesh.modifiers),
        "Static crane pose mesh regained an armature modifier",
    )
    require(
        not any(obj.type == "ARMATURE" for obj in root.children_recursive),
        "Static crane pose armature was not removed",
    )
    return True


def bake_static_crane_pose(root, frame):
    if validate_completed_static_crane_pose_bake(root, frame):
        return
    require(
        not any(key in root for key in STATIC_CRANE_POSE_METADATA_KEYS),
        "Static crane pose bake metadata is partial or inconsistent",
    )
    armatures = [obj for obj in root.children_recursive if obj.type == "ARMATURE"]
    require(len(armatures) == 1, "Static crane pose bake requires exactly one armature")
    armature = armatures[0]
    animation = armature.animation_data
    require(
        animation is None or (
            animation.action is None
            and len(animation.drivers) == 0
            and len(animation.nla_tracks) == 0
        ),
        "Static crane pose bake only supports an unanimated armature",
    )

    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    armature.hide_set(False)
    armature.hide_viewport = False
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    posed_meshes = []
    for obj in root.children_recursive:
        armature_modifiers = [
            modifier
            for modifier in obj.modifiers
            if modifier.type == "ARMATURE" and modifier.object == armature
        ]
        if not armature_modifiers:
            continue
        require(obj.type == "MESH", "Static crane pose armature drives a non-mesh object")
        bpy.ops.object.select_all(action="DESELECT")
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in armature_modifiers:
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world
        posed_meshes.append(obj)
    require(len(posed_meshes) == 1, "Static crane pose bake requires exactly one skinned mesh")
    armature_data = armature.data
    bpy.data.objects.remove(armature, do_unlink=True)
    if armature_data.users == 0:
        bpy.data.armatures.remove(armature_data)
    bpy.context.view_layer.update()

    root["static_crane_pose_bake_version"] = STATIC_CRANE_POSE_BAKE_VERSION
    root["static_crane_pose_bake_policy"] = STATIC_CRANE_POSE_BAKE_POLICY
    root["static_crane_pose_frame"] = frame
    root["static_crane_pose_mesh"] = posed_meshes[0].name
    require(
        validate_completed_static_crane_pose_bake(root, frame),
        "Static crane pose bake validation failed",
    )


def resolve_external_image(image):
    return Path(bpy.path.abspath(image.filepath)).resolve()


def image_reference_users(image):
    return sorted(
        f"{item.__class__.__name__}:{item.name_full}"
        for item in bpy.data.user_map(subset={image}).get(image, set())
    )


def is_unreferenced_system_viewer_image(image):
    return (
        image.name in SYSTEM_VIEWER_IMAGES
        and image.source == "VIEWER"
        and getattr(image, "type", None) == SYSTEM_VIEWER_IMAGES[image.name]
        and not image.use_fake_user
        and not image_reference_users(image)
    )


def enforce_league_non_file_image_allowlist():
    for image in list(bpy.data.images):
        if image.source == "FILE":
            continue
        if is_unreferenced_system_viewer_image(image):
            bpy.data.images.remove(image)
            continue
        references = image_reference_users(image)
        raise RuntimeError(
            "League source contains non-FILE image "
            f"{image.name}: source={image.source}, users={image.users}, "
            f"references={references}"
        )


def relink_owned_images(args):
    league_curation = bool(args.league_dashboard or args.league_history)
    if league_curation:
        require(
            args.league_dashboard and args.league_history,
            "League curation requires both repository-owned textures",
        )
        enforce_league_non_file_image_allowlist()
    replacements = [
        {
            "aliases": ("ban site", "leaguebandashboard", "league-ban-dashboard"),
            "name": "LeagueBanDashboard",
            "packed_filepath": "//textures/league-ban-dashboard.png",
            "path": Path(args.league_dashboard).resolve(),
        } if args.league_dashboard else None,
        {
            "aliases": ("mint", "leaguematchhistory", "league-match-history"),
            "name": "LeagueMatchHistory",
            "packed_filepath": "//textures/league-match-history.png",
            "path": Path(args.league_history).resolve(),
        } if args.league_history else None,
    ]
    canonical_images = {}
    for image in list(bpy.data.images):
        if image.source != "FILE":
            continue
        identity = f"{image.name} {image.filepath}".lower()
        replacement = next(
            (
                item
                for item in replacements
                if item and any(alias in identity for alias in item["aliases"])
            ),
            None,
        )
        if replacement:
            require(replacement["path"].is_file(), f"Owned texture is missing: {replacement['path']}")
            canonical = canonical_images.get(replacement["name"])
            if canonical:
                image.user_remap(canonical)
                bpy.data.images.remove(image)
                continue
            if image.packed_file:
                image.unpack(method="REMOVE")
            image.name = replacement["name"]
            image.filepath = str(replacement["path"])
            image.reload()
            image.pack()
            image.filepath = replacement["packed_filepath"]
            canonical_images[replacement["name"]] = image
            continue
        if image.packed_file:
            continue
        resolved = resolve_external_image(image)
        require(resolved.is_file(), f"Unresolved external image: {image.name} -> {resolved}")
        image.pack()

    if league_curation:
        actual = sorted(
            image.name for image in bpy.data.images if image.source == "FILE"
        )
        expected = ["LeagueBanDashboard", "LeagueMatchHistory"]
        require(
            actual == expected,
            f"League source contains non-allowlisted raster images: expected {expected}, got {actual}",
        )
        require(
            all(image.source == "FILE" for image in bpy.data.images),
            "League source contains a non-FILE image after curation",
        )
        require(
            all(image.packed_file for image in bpy.data.images),
            "League source contains an unpacked FILE image after curation",
        )
        expected_paths = {
            item["name"]: item["packed_filepath"]
            for item in replacements
            if item
        }
        actual_paths = {
            image.name: image.filepath
            for image in bpy.data.images
            if image.source == "FILE"
        }
        require(
            actual_paths == expected_paths,
            "League packed image paths are not stable Blender-relative paths: "
            f"expected {expected_paths}, got {actual_paths}",
        )


def matrix_is_identity(matrix, tolerance=1e-6):
    return all(
        abs(float(matrix[row][column] - (1.0 if row == column else 0.0)))
        <= tolerance
        for row in range(4)
        for column in range(4)
    )


def vector_matches(values, expected, tolerance=1e-6):
    return all(
        abs(float(value - target)) <= tolerance
        for value, target in zip(values, expected)
    )


def is_active_scene_object(obj):
    return (
        bpy.context.scene.objects.get(obj.name) == obj
        and bpy.context.view_layer.objects.get(obj.name) == obj
    )


def initialize_export_root(root):
    root.parent = None
    root.matrix_parent_inverse.identity()
    root.location = (0.0, 0.0, 0.0)
    root.rotation_mode = "XYZ"
    root.rotation_euler = (0.0, 0.0, 0.0)
    root.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    root.rotation_axis_angle = (0.0, 0.0, 1.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    root.delta_location = (0.0, 0.0, 0.0)
    root.delta_rotation_euler = (0.0, 0.0, 0.0)
    root.delta_rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    root.delta_scale = (1.0, 1.0, 1.0)
    root.matrix_world.identity()
    root.instance_type = "NONE"
    root.instance_collection = None
    root.hide_render = False
    root.hide_viewport = False
    root.hide_set(False)


def validate_inert_export_root(root):
    require(root.type == "EMPTY", "WEB_EXPORT_ROOT must be an EMPTY object")
    require(
        is_active_scene_object(root),
        "WEB_EXPORT_ROOT must be linked into the active scene and view layer",
    )
    require(root.data is None, "WEB_EXPORT_ROOT must not carry object data")
    require(root.parent is None, "WEB_EXPORT_ROOT must not have a parent")
    require(not root.constraints, "WEB_EXPORT_ROOT must not have constraints")
    require(root.animation_data is None, "WEB_EXPORT_ROOT must not have animation or drivers")
    require(not root.modifiers, "WEB_EXPORT_ROOT must not have modifiers")
    require(not root.particle_systems, "WEB_EXPORT_ROOT must not have particle systems")
    require(not root.vertex_groups, "WEB_EXPORT_ROOT must not have vertex groups")
    require(
        root.instance_type == "NONE"
        and root.instance_collection is None
        and not root.is_instancer,
        "WEB_EXPORT_ROOT must not instance a collection or geometry",
    )
    field = getattr(root, "field", None)
    require(
        field is None or field.type == "NONE",
        "WEB_EXPORT_ROOT must not have a force field",
    )
    require(
        root.rigid_body is None and root.rigid_body_constraint is None,
        "WEB_EXPORT_ROOT must not have rigid-body state",
    )
    require(
        not root.hide_render and not root.hide_viewport and not root.hide_get(),
        "WEB_EXPORT_ROOT must not have hidden evaluative state",
    )
    require(
        not root.is_holdout and not root.is_shadow_catcher,
        "WEB_EXPORT_ROOT must not have render-evaluation flags",
    )
    require(root.rotation_mode == "XYZ", "WEB_EXPORT_ROOT rotation mode must be XYZ")
    require(vector_matches(root.location, (0.0, 0.0, 0.0)), "WEB_EXPORT_ROOT location must be zero")
    require(vector_matches(root.rotation_euler, (0.0, 0.0, 0.0)), "WEB_EXPORT_ROOT Euler rotation must be zero")
    require(vector_matches(root.rotation_quaternion, (1.0, 0.0, 0.0, 0.0)), "WEB_EXPORT_ROOT quaternion must be identity")
    require(vector_matches(root.rotation_axis_angle, (0.0, 0.0, 1.0, 0.0)), "WEB_EXPORT_ROOT axis-angle must be identity")
    require(vector_matches(root.scale, (1.0, 1.0, 1.0)), "WEB_EXPORT_ROOT scale must be one")
    require(vector_matches(root.delta_location, (0.0, 0.0, 0.0)), "WEB_EXPORT_ROOT delta location must be zero")
    require(vector_matches(root.delta_rotation_euler, (0.0, 0.0, 0.0)), "WEB_EXPORT_ROOT delta Euler rotation must be zero")
    require(vector_matches(root.delta_rotation_quaternion, (1.0, 0.0, 0.0, 0.0)), "WEB_EXPORT_ROOT delta quaternion must be identity")
    require(vector_matches(root.delta_scale, (1.0, 1.0, 1.0)), "WEB_EXPORT_ROOT delta scale must be one")
    require(matrix_is_identity(root.matrix_parent_inverse), "WEB_EXPORT_ROOT parent inverse must be identity")
    require(matrix_is_identity(root.matrix_world), "WEB_EXPORT_ROOT matrix_world must be identity")


def ensure_export_root():
    roots = [obj for obj in bpy.data.objects if obj.name == "WEB_EXPORT_ROOT"]
    require(len(roots) <= 1, "More than one WEB_EXPORT_ROOT exists")
    if roots:
        root = roots[0]
        bpy.context.view_layer.update()
        validate_inert_export_root(root)
    else:
        root = bpy.data.objects.new("WEB_EXPORT_ROOT", None)
        bpy.context.scene.collection.objects.link(root)
        initialize_export_root(root)
        bpy.context.view_layer.update()
        validate_inert_export_root(root)
    root["asset_pipeline_version"] = 1

    scene_objects = set(bpy.context.scene.objects)
    required = set()

    def add_with_ancestors(obj):
        current = obj
        while (
            current
            and current != root
            and current in scene_objects
            and current.type not in {"CAMERA", "LIGHT"}
        ):
            if current not in required:
                required.add(current)
            current = current.parent

    for obj in sorted(scene_objects, key=lambda item: item.name):
        if (
            obj != root
            and obj.type not in {"CAMERA", "LIGHT"}
            and not obj.hide_render
        ):
            add_with_ancestors(obj)

    evaluation_dependencies = set()
    constraint_links = []

    def add_evaluation_ancestors(obj):
        current = obj
        while (
            current
            and current != root
            and current in scene_objects
            and current.type not in {"CAMERA", "LIGHT"}
        ):
            evaluation_dependencies.add(current)
            current = current.parent

    for obj in required:
        for constraint in obj.constraints:
            for prop in constraint.bl_rna.properties:
                if prop.type != "POINTER":
                    continue
                target = getattr(constraint, prop.identifier, None)
                if isinstance(target, bpy.types.Object):
                    constraint_links.append((obj, constraint, prop.identifier, target))
                    add_evaluation_ancestors(target)

    evaluation_world = {
        obj: obj.matrix_world.copy()
        for obj in evaluation_dependencies
    }

    def has_root_ancestor(obj):
        current = obj.parent
        while current:
            if current == root:
                return True
            current = current.parent
        return False

    for obj in sorted(required, key=lambda item: item.name):
        if has_root_ancestor(obj):
            continue
        if obj.parent is None or obj.parent not in required:
            world = obj.matrix_world.copy()
            basis = obj.matrix_basis.copy()
            old_parent = obj.parent
            obj.parent = root
            if old_parent is None:
                obj.matrix_parent_inverse = root.matrix_world.inverted()
                obj.matrix_basis = basis
            else:
                obj.matrix_world = world
            bpy.context.view_layer.update()
            require(
                all(
                    abs(float(obj.matrix_world[row][column] - world[row][column]))
                    <= 1e-5
                    for row in range(4)
                    for column in range(4)
                ),
                f"Export-root parenting changed {obj.name}'s world transform",
            )

    for obj in required:
        require(
            has_root_ancestor(obj),
            f"Required export dependency is outside WEB_EXPORT_ROOT: {obj.name}",
        )

    for owner, constraint, property_name, target in constraint_links:
        require(
            getattr(constraint, property_name, None) == target,
            f"Constraint target changed during export rooting: "
            f"{owner.name}.{constraint.name}.{property_name}",
        )
        if target in required:
            require(
                has_root_ancestor(target),
                f"Renderable constraint target is outside WEB_EXPORT_ROOT: "
                f"{owner.name}.{constraint.name} -> {target.name}",
            )

    bpy.context.view_layer.update()
    for obj, world in evaluation_world.items():
        require(
            all(
                abs(float(obj.matrix_world[row][column] - world[row][column]))
                <= 1e-5
                for row in range(4)
                for column in range(4)
            ),
            f"Export rooting changed evaluation dependency {obj.name}",
        )

    return root


def particle_system_records():
    return [
        (obj, system)
        for obj in bpy.data.objects
        for system in obj.particle_systems
    ]


def validate_completed_web_ground_cleanup(root):
    metadata_present = any(key in root for key in WEB_GROUND_METADATA_KEYS)
    if not metadata_present:
        return False
    require(
        all(key in root for key in WEB_GROUND_METADATA_KEYS),
        "Web ground cleanup metadata is partial",
    )
    require(
        int(root["web_ground_cleanup_version"]) == WEB_GROUND_CLEANUP_VERSION,
        "Web ground cleanup version is unsupported",
    )
    require(
        root["web_ground_cleanup_policy"] == WEB_GROUND_CLEANUP_POLICY,
        "Web ground cleanup policy is unsupported",
    )
    require(
        root["web_ground_shadow_strategy"] == WEB_GROUND_SHADOW_STRATEGY,
        "Web ground shadow strategy is unsupported",
    )
    object_name = root["web_ground_removed_object"]
    require(
        object_name in WEB_GROUND_SPECS,
        f"Web ground cleanup records an unknown object: {object_name}",
    )
    spec = WEB_GROUND_SPECS[object_name]
    require(
        root["web_ground_removed_mesh"] == spec["mesh"],
        "Web ground cleanup mesh metadata drifted",
    )
    remaining_objects = sorted(
        name for name in WEB_GROUND_SPECS if bpy.data.objects.get(name)
    )
    require(
        not remaining_objects,
        f"Web ground cleanup is partial; authored receivers remain: {remaining_objects}",
    )
    require(
        bpy.data.meshes.get(spec["mesh"]) is None,
        f"Web ground cleanup left its mesh data behind: {spec['mesh']}",
    )
    return True


def cleanup_web_ground(root):
    if validate_completed_web_ground_cleanup(root):
        return

    candidates = [
        bpy.data.objects.get(name)
        for name in WEB_GROUND_SPECS
        if bpy.data.objects.get(name) is not None
    ]
    require(
        len(candidates) == 1,
        "Web ground cleanup requires exactly one authored Ground or Shadow Catcher",
    )
    obj = candidates[0]
    spec = WEB_GROUND_SPECS[obj.name]
    require(obj.type == "MESH", f"{obj.name} must be a mesh shadow catcher")
    mesh = obj.data
    require(mesh is not None and mesh.name == spec["mesh"], f"{obj.name} mesh drifted")
    require(mesh.users == 1, f"{obj.name} mesh has unexpected users")
    require(obj.parent == root, f"{obj.name} must be a direct export-root child")
    require(is_active_scene_object(obj), f"{obj.name} must be in the active scene")
    require(obj.is_shadow_catcher, f"{obj.name} is no longer a Blender shadow catcher")
    require(not obj.hide_render, f"{obj.name} unexpectedly became render-hidden")
    require(not obj.children, f"{obj.name} unexpectedly parents other objects")
    require(obj.animation_data is None, f"{obj.name} must not have animation or drivers")
    require(mesh.animation_data is None, f"{obj.name} mesh must not have animation or drivers")
    require(not obj.constraints, f"{obj.name} has unexpected constraints")
    require(not obj.particle_systems, f"{obj.name} has unexpected particle systems")
    require(not obj.vertex_groups, f"{obj.name} has unexpected vertex groups")
    require(
        tuple(sorted(modifier.type for modifier in obj.modifiers))
        == tuple(sorted(spec["modifiers"])),
        f"{obj.name} modifiers drifted",
    )
    require(
        len(mesh.vertices) == 4
        and len(mesh.edges) == 4
        and len(mesh.polygons) == 1,
        f"{obj.name} topology drifted",
    )
    require(not obj.material_slots, f"{obj.name} unexpectedly carries a material")
    require(mesh.shape_keys is None, f"{obj.name} unexpectedly carries shape keys")
    require(
        obj.instance_type == "NONE"
        and obj.instance_collection is None
        and not obj.is_instancer,
        f"{obj.name} unexpectedly instances geometry",
    )
    require(
        obj.rigid_body is None and obj.rigid_body_constraint is None,
        f"{obj.name} unexpectedly carries rigid-body state",
    )

    object_name = obj.name
    mesh_name = mesh.name
    bpy.data.objects.remove(obj, do_unlink=True)
    require(mesh.users == 0, f"{object_name} mesh remained in use after removal")
    bpy.data.meshes.remove(mesh)
    root["web_ground_cleanup_version"] = WEB_GROUND_CLEANUP_VERSION
    root["web_ground_cleanup_policy"] = WEB_GROUND_CLEANUP_POLICY
    root["web_ground_removed_object"] = object_name
    root["web_ground_removed_mesh"] = mesh_name
    root["web_ground_shadow_strategy"] = WEB_GROUND_SHADOW_STRATEGY
    require(
        validate_completed_web_ground_cleanup(root),
        "Web ground cleanup validation failed",
    )


def forbidden_material_nodes():
    return sorted({
        node.bl_idname
        for material in bpy.data.materials
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
        if node.bl_idname in ROCKET_UNSUPPORTED_NODES
    })


def all_glossy_nodes():
    return sorted(
        (
            material.name,
            node.name,
        )
        for material in bpy.data.materials
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfGlossy"
    )


def validate_crane_workout_legacy_mirror(root):
    mirror = bpy.data.objects.get(CRANE_WORKOUT_REMOVED_OBJECT)
    mesh = bpy.data.meshes.get(CRANE_WORKOUT_REMOVED_MESH)
    materials = {
        name: bpy.data.materials.get(name)
        for name in CRANE_WORKOUT_REMOVED_MATERIALS
    }
    require(mirror is not None, "CraneWorkout hidden Hand Mirror is missing")
    require(mirror.type == "MESH", "CraneWorkout Hand Mirror must be a mesh object")
    require(mirror.data == mesh and mesh is not None, "CraneWorkout Hand Mirror mesh drifted")
    require(mesh.users == 1, "CraneWorkout Hand Mirror mesh has unexpected users")
    require(mirror.parent is None, "CraneWorkout Hand Mirror must remain outside the export root")
    require(mirror.hide_render, "CraneWorkout Hand Mirror must remain hidden from renders")
    require(not mirror.modifiers, "CraneWorkout Hand Mirror has unexpected modifiers")
    require(not mirror.constraints, "CraneWorkout Hand Mirror has unexpected constraints")
    animation = mirror.animation_data
    require(
        animation is None
        or (
            animation.action is None
            and not animation.drivers
            and not animation.nla_tracks
        ),
        "CraneWorkout Hand Mirror has unexpected animation",
    )
    current = mirror.parent
    while current:
        require(current != root, "CraneWorkout Hand Mirror entered the export hierarchy")
        current = current.parent

    slots = [slot.material.name if slot.material else None for slot in mirror.material_slots]
    require(
        slots == list(CRANE_WORKOUT_REMOVED_MATERIALS),
        f"CraneWorkout Hand Mirror materials drifted: {slots}",
    )
    for name, material in materials.items():
        require(material is not None, f"CraneWorkout material is missing: {name}")
        require(material.users == 1, f"CraneWorkout material has unexpected users: {name}")
        require(not material.use_fake_user, f"CraneWorkout material has a fake user: {name}")

    lens = materials["Mirror Lens"]
    require(lens.use_nodes and lens.node_tree, "CraneWorkout Mirror Lens node tree is missing")
    nodes = sorted(
        (node.name, node.bl_idname)
        for node in lens.node_tree.nodes
    )
    require(
        nodes == [
            ("Glossy BSDF", "ShaderNodeBsdfGlossy"),
            ("Material Output", "ShaderNodeOutputMaterial"),
        ],
        f"CraneWorkout Mirror Lens nodes drifted: {nodes}",
    )
    glossy = lens.node_tree.nodes["Glossy BSDF"]
    output = lens.node_tree.nodes["Material Output"]
    require(glossy.distribution == "SHARP", "CraneWorkout Mirror Lens distribution drifted")
    for input_name in ("Color", "Roughness", "Normal", "Weight"):
        require(not glossy.inputs[input_name].is_linked, f"CraneWorkout Mirror Lens {input_name} became linked")
    require(
        all(abs(float(value) - expected) < 1e-6 for value, expected in zip(
            glossy.inputs["Color"].default_value,
            (0.8, 0.8, 0.8, 1.0),
        )),
        "CraneWorkout Mirror Lens Color drifted",
    )
    require(
        abs(float(glossy.inputs["Roughness"].default_value) - 1.0) < 1e-6,
        "CraneWorkout Mirror Lens Roughness drifted",
    )
    require(
        all(abs(float(value)) < 1e-6 for value in glossy.inputs["Normal"].default_value),
        "CraneWorkout Mirror Lens Normal drifted",
    )
    links = list(lens.node_tree.links)
    require(len(links) == 1, "CraneWorkout Mirror Lens link topology drifted")
    link = links[0]
    require(
        link.from_node == glossy
        and link.from_socket == glossy.outputs["BSDF"]
        and link.to_node == output
        and link.to_socket == output.inputs["Surface"],
        "CraneWorkout Mirror Lens surface link drifted",
    )
    require(
        all_glossy_nodes() == [("Mirror Lens", "Glossy BSDF")],
        "CraneWorkout contains an unexpected Glossy material node",
    )
    return mirror, mesh, [materials[name] for name in CRANE_WORKOUT_REMOVED_MATERIALS]


def validate_completed_crane_workout_cleanup(root):
    metadata_present = any(key in root for key in CRANE_WORKOUT_METADATA)
    metadata_matches = all(root.get(key) == value for key, value in CRANE_WORKOUT_METADATA.items())
    artifact_presence = [
        bpy.data.objects.get(CRANE_WORKOUT_REMOVED_OBJECT) is not None,
        bpy.data.meshes.get(CRANE_WORKOUT_REMOVED_MESH) is not None,
        *(bpy.data.materials.get(name) is not None for name in CRANE_WORKOUT_REMOVED_MATERIALS),
    ]
    artifacts_absent = not any(artifact_presence) and not all_glossy_nodes()
    if metadata_matches and artifacts_absent:
        return True
    if metadata_present or not all(artifact_presence):
        raise RuntimeError("CraneWorkout hidden-mirror cleanup is partial or inconsistent")
    return False


def cleanup_crane_workout_hidden_mirror(root):
    if validate_completed_crane_workout_cleanup(root):
        return
    mirror, mesh, materials = validate_crane_workout_legacy_mirror(root)
    bpy.data.objects.remove(mirror, do_unlink=True)
    require(mesh.users == 0, "CraneWorkout Hand Mirror mesh did not become orphaned")
    bpy.data.meshes.remove(mesh)
    for material in materials:
        require(material.users == 0, f"CraneWorkout material did not become orphaned: {material.name}")
        bpy.data.materials.remove(material)
    for key, value in CRANE_WORKOUT_METADATA.items():
        root[key] = value
    require(
        validate_completed_crane_workout_cleanup(root),
        "CraneWorkout hidden-mirror cleanup validation failed",
    )


def stable_material_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        rounded = round(float(value), 9)
        return 0.0 if rounded == 0.0 else rounded
    if isinstance(value, str):
        return value
    try:
        return [stable_material_value(component) for component in value]
    except TypeError:
        return None


def rocket_material_fingerprint(material):
    require(material.use_nodes and material.node_tree, f"{material.name} node tree is missing")
    payload = {
        "alphaThreshold": stable_material_value(material.alpha_threshold),
        "blendMethod": material.blend_method,
        "diffuseColor": stable_material_value(material.diffuse_color),
        "name": material.name,
        "shadowMethod": material.shadow_method,
        "showTransparentBack": material.show_transparent_back,
        "useBackfaceCulling": material.use_backface_culling,
        "useScreenRefraction": material.use_screen_refraction,
        "nodes": [
            {
                "inputs": [
                    {
                        "default": stable_material_value(socket.default_value)
                        if hasattr(socket, "default_value") else None,
                        "name": socket.name,
                    }
                    for socket in node.inputs
                ],
                "mute": node.mute,
                "name": node.name,
                "properties": {
                    name: stable_material_value(getattr(node, name))
                    for name in (
                        "distribution",
                        "is_active_output",
                        "subsurface_method",
                        "target",
                    )
                    if hasattr(node, name)
                },
                "type": node.bl_idname,
            }
            for node in sorted(
                material.node_tree.nodes,
                key=lambda item: (item.bl_idname, item.name),
            )
        ],
        "links": sorted(
            (
                link.from_node.name,
                link.from_socket.name,
                link.to_node.name,
                link.to_socket.name,
            )
            for link in material.node_tree.links
        ),
    }
    encoded = json.dumps(
        payload,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def rocket_geometry_integrity(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    digest = hashlib.sha256()
    digest.update(b"rocket-smoke-geometry-v2\0")
    digest.update(struct.pack(
        "<IIII",
        len(mesh.vertices),
        len(mesh.edges),
        len(mesh.polygons),
        len(mesh.loop_triangles),
    ))
    for vertex in mesh.vertices:
        digest.update(struct.pack("<3f", *vertex.co))
    digest.update(struct.pack(
        "<??f",
        bool(mesh.has_custom_normals),
        bool(mesh.use_auto_smooth),
        float(mesh.auto_smooth_angle),
    ))
    for edge in mesh.edges:
        digest.update(struct.pack("<2I?", *edge.vertices, edge.use_edge_sharp))
    for polygon in mesh.polygons:
        digest.update(struct.pack(
            "<II?",
            polygon.material_index,
            len(polygon.vertices),
            polygon.use_smooth,
        ))
        digest.update(struct.pack(f"<{len(polygon.vertices)}I", *polygon.vertices))
    digest.update(struct.pack("<I", len(mesh.uv_layers)))
    for uv_layer in mesh.uv_layers:
        encoded_name = uv_layer.name.encode("utf-8")
        digest.update(struct.pack("<I", len(encoded_name)))
        digest.update(encoded_name)
        digest.update(struct.pack(
            "<???",
            uv_layer.active,
            uv_layer.active_clone,
            uv_layer.active_render,
        ))
        digest.update(struct.pack("<I", len(uv_layer.data)))
        for uv_loop in uv_layer.data:
            digest.update(struct.pack("<2f", *uv_loop.uv))
    for matrix in (obj.matrix_basis, obj.matrix_parent_inverse):
        for row in matrix:
            digest.update(struct.pack("<4f", *row))
    coordinates = [
        float(component)
        for vertex in mesh.vertices
        for component in vertex.co
    ]
    require(coordinates, f"{obj.name} geometry is empty")
    bounds_min = [
        min(float(vertex.co[axis]) for vertex in mesh.vertices)
        for axis in range(3)
    ]
    bounds_max = [
        max(float(vertex.co[axis]) for vertex in mesh.vertices)
        for axis in range(3)
    ]
    return {
        "bounds_max": bounds_max,
        "bounds_min": bounds_min,
        "edge_count": len(mesh.edges),
        "polygon_count": len(mesh.polygons),
        "sha256": digest.hexdigest(),
        "triangle_count": len(mesh.loop_triangles),
        "vertex_count": len(mesh.vertices),
    }


def validate_rocket_baked_static_state(obj):
    mesh = obj.data
    require(
        is_active_scene_object(obj),
        f"{obj.name} must be linked into the active scene and view layer",
    )
    require(obj.animation_data is None, f"{obj.name} must not have animation or drivers")
    require(not obj.constraints, f"{obj.name} must not have constraints")
    require(not obj.modifiers, f"{obj.name} must not have modifiers")
    require(not obj.vertex_groups, f"{obj.name} must not have vertex groups")
    require(not obj.particle_systems, f"{obj.name} must not have particle systems")
    require(
        matrix_is_identity(obj.matrix_basis)
        and matrix_is_identity(obj.matrix_parent_inverse),
        f"{obj.name} must store its bake in parent-local geometry with identity transforms",
    )
    require(
        obj.instance_type == "NONE"
        and obj.instance_collection is None
        and not obj.is_instancer,
        f"{obj.name} must not instance other geometry",
    )
    field = getattr(obj, "field", None)
    require(
        field is None or field.type == "NONE",
        f"{obj.name} must not have a force field",
    )
    require(
        obj.rigid_body is None and obj.rigid_body_constraint is None,
        f"{obj.name} must not have rigid-body state",
    )
    require(
        not obj.hide_render and not obj.hide_viewport and not obj.hide_get(),
        f"{obj.name} visibility state drifted",
    )
    require(
        not obj.is_holdout and not obj.is_shadow_catcher,
        f"{obj.name} render flags drifted",
    )
    visibility_flags = (
        "visible_camera",
        "visible_diffuse",
        "visible_glossy",
        "visible_shadow",
        "visible_transmission",
        "visible_volume_scatter",
    )
    require(
        all(bool(getattr(obj, name, True)) for name in visibility_flags),
        f"{obj.name} ray visibility drifted",
    )
    require(mesh.animation_data is None, f"{obj.name} mesh must not have animation or drivers")
    require(mesh.shape_keys is None, f"{obj.name} must not have shape keys")
    require(not mesh.has_custom_normals, f"{obj.name} custom normals are forbidden")
    require(not mesh.use_auto_smooth, f"{obj.name} auto smooth is forbidden")
    require(
        all(not polygon.use_smooth for polygon in mesh.polygons),
        f"{obj.name} smooth shading drifted",
    )
    require(
        len(mesh.color_attributes) == 0,
        f"{obj.name} color attributes are forbidden",
    )
    allowed_attributes = {
        ".corner_edge",
        ".corner_vert",
        ".edge_verts",
        ".select_edge",
        ".select_poly",
        ".select_vert",
        "material_index",
        "position",
        "sharp_face",
        *(layer.name for layer in mesh.uv_layers),
    }
    unexpected_attributes = sorted(
        attribute.name
        for attribute in mesh.attributes
        if attribute.name not in allowed_attributes
    )
    require(
        not unexpected_attributes,
        f"{obj.name} has unexpected mesh attributes: {unexpected_attributes}",
    )


def validate_rocket_baked_material(obj, spec):
    require(len(obj.data.materials) == 1, f"{obj.name} must have exactly one material slot")
    material = obj.data.materials[0]
    require(material is not None, f"{obj.name} material slot is empty")
    require(material.name == spec["material"], f"{obj.name} material assignment drifted")
    require(material.use_nodes and material.node_tree, f"{material.name} node tree is missing")
    require(material.animation_data is None, f"{obj.name} material must not have animation or drivers")
    require(
        material.node_tree.animation_data is None,
        f"{obj.name} material nodes must not have animation or drivers",
    )
    require(not material.use_fake_user, f"{obj.name} material must not use a fake user")
    require(
        material.blend_method == "OPAQUE"
        and material.shadow_method == "OPAQUE"
        and not material.use_backface_culling
        and material.show_transparent_back
        and not material.use_screen_refraction,
        f"{obj.name} material render flags drifted",
    )
    require(
        all(polygon.material_index == 0 for polygon in obj.data.polygons),
        f"{obj.name} polygon material assignments drifted",
    )
    principled = [
        node for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    ]
    outputs = [
        node for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeOutputMaterial"
    ]
    require(
        len(principled) == 1
        and len(outputs) == 1
        and len(material.node_tree.nodes) == 2,
        f"{material.name} must contain exactly one Principled BSDF and one Material Output",
    )
    require(
        all(not node.mute for node in material.node_tree.nodes),
        f"{obj.name} material node mute state drifted",
    )
    links = list(material.node_tree.links)
    require(
        len(links) == 1
        and links[0].from_node == principled[0]
        and links[0].from_socket == principled[0].outputs["BSDF"]
        and links[0].to_node == outputs[0]
        and links[0].to_socket == outputs[0].inputs["Surface"],
        f"{material.name} surface topology drifted",
    )
    require(
        vector_matches(principled[0].inputs["Base Color"].default_value, spec["color"]),
        f"{material.name} Base Color drifted",
    )
    require(
        abs(float(principled[0].inputs["Roughness"].default_value) - 0.82) <= 1e-6,
        f"{material.name} Roughness drifted",
    )
    return material, rocket_material_fingerprint(material)


def record_rocket_baked_integrity(root, obj, spec):
    validate_rocket_baked_static_state(obj)
    geometry = rocket_geometry_integrity(obj)
    _material, material_sha256 = validate_rocket_baked_material(obj, spec)
    obj["geometry_bounds_min"] = json.dumps(geometry["bounds_min"], separators=(",", ":"))
    obj["geometry_bounds_max"] = json.dumps(geometry["bounds_max"], separators=(",", ":"))
    obj["geometry_edge_count"] = geometry["edge_count"]
    obj["geometry_polygon_count"] = geometry["polygon_count"]
    obj["geometry_sha256"] = geometry["sha256"]
    obj["geometry_triangle_count"] = geometry["triangle_count"]
    obj["geometry_vertex_count"] = geometry["vertex_count"]
    obj["material_sha256"] = material_sha256
    obj["rocket_smoke_integrity_version"] = ROCKET_SMOKE_INTEGRITY_VERSION
    prefix = f"rocket_smoke_{spec['integrity_key']}"
    root[f"{prefix}_geometry_sha256"] = geometry["sha256"]
    root[f"{prefix}_material_sha256"] = material_sha256
    root["rocket_smoke_integrity_version"] = ROCKET_SMOKE_INTEGRITY_VERSION


def validate_rocket_baked_integrity(root, obj, spec):
    require(
        int(obj.get("rocket_smoke_integrity_version", -1))
        == ROCKET_SMOKE_INTEGRITY_VERSION,
        f"{obj.name} integrity schema is unsupported",
    )
    require(
        int(root.get("rocket_smoke_integrity_version", -1))
        == ROCKET_SMOKE_INTEGRITY_VERSION,
        f"{obj.name} root integrity schema is unsupported",
    )
    validate_rocket_baked_static_state(obj)
    geometry = rocket_geometry_integrity(obj)
    _material, material_sha256 = validate_rocket_baked_material(obj, spec)
    require(
        int(obj.get("geometry_vertex_count", -1)) == geometry["vertex_count"]
        and int(obj.get("geometry_edge_count", -1)) == geometry["edge_count"]
        and int(obj.get("geometry_polygon_count", -1)) == geometry["polygon_count"]
        and int(obj.get("geometry_triangle_count", -1)) == geometry["triangle_count"],
        f"{obj.name} geometry counts drifted",
    )
    require(
        obj.get("geometry_sha256") == geometry["sha256"],
        f"{obj.name} geometry fingerprint drifted",
    )
    require(
        obj.get("material_sha256") == material_sha256,
        f"{obj.name} material fingerprint drifted",
    )
    require(
        obj.get("geometry_bounds_min")
        == json.dumps(geometry["bounds_min"], separators=(",", ":"))
        and obj.get("geometry_bounds_max")
        == json.dumps(geometry["bounds_max"], separators=(",", ":")),
        f"{obj.name} geometry bounds drifted",
    )
    prefix = f"rocket_smoke_{spec['integrity_key']}"
    require(
        root.get(f"{prefix}_geometry_sha256") == geometry["sha256"]
        and root.get(f"{prefix}_material_sha256") == material_sha256,
        f"{obj.name} root integrity metadata drifted",
    )


def validate_completed_rocket_bake(root, bake_frame):
    baked = {
        spec["baked_name"]: bpy.data.objects.get(spec["baked_name"])
        for spec in ROCKET_SMOKE_SPECS.values()
    }
    metadata_present = any(
        key in root
        for key in (
            "rocket_smoke_bake_frame",
            "rocket_smoke_bake_version",
        )
    )
    systems = particle_system_records()
    complete = all(baked.values()) and metadata_present and not systems
    if not complete:
        if any(baked.values()) or metadata_present:
            raise RuntimeError("Rocket smoke bake is partial or inconsistent")
        return False

    require(
        int(root["rocket_smoke_bake_frame"]) == bake_frame,
        "Rocket smoke bake frame does not match the requested frame",
    )
    require(
        int(root["rocket_smoke_bake_version"]) == ROCKET_SMOKE_BAKE_VERSION,
        "Rocket smoke bake version is unsupported",
    )
    require(
        root.get("rocket_smoke_simulation_policy")
        == ROCKET_SMOKE_SIMULATION_POLICY,
        "Rocket smoke simulation policy is unsupported",
    )
    for spec in ROCKET_SMOKE_SPECS.values():
        obj = baked[spec["baked_name"]]
        require(obj.type == "MESH", f"{obj.name} must be a mesh")
        require(obj.parent and obj.parent.name == spec["parent"], f"{obj.name} has the wrong parent")
        require(int(obj.get("rocket_smoke_bake_frame", -1)) == bake_frame, f"{obj.name} bake frame drifted")
        require(int(obj.get("rocket_smoke_bake_version", -1)) == ROCKET_SMOKE_BAKE_VERSION, f"{obj.name} bake version drifted")
        require(
            obj.get("simulation_policy") == ROCKET_SMOKE_SIMULATION_POLICY,
            f"{obj.name} simulation policy drifted",
        )
        require(
            int(obj.get("procedural_seed", -1)) == spec["procedural_seed"],
            f"{obj.name} procedural seed drifted",
        )
        require(
            obj.get("procedural_style") == spec["procedural_style"],
            f"{obj.name} procedural style drifted",
        )
        prefix = f"rocket_smoke_{spec['integrity_key']}"
        require(
            int(root.get(f"{prefix}_seed", -1)) == spec["procedural_seed"],
            f"{obj.name} root procedural seed drifted",
        )
        require(
            root.get(f"{prefix}_style") == spec["procedural_style"],
            f"{obj.name} root procedural style drifted",
        )
        require(int(obj.get("baked_particle_count", -1)) == spec["expected_particles"], f"{obj.name} particle count drifted")
        validate_rocket_baked_integrity(root, obj, spec)
    remaining_helpers = sorted(name for name in ROCKET_SMOKE_HELPERS if bpy.data.objects.get(name))
    require(not remaining_helpers, f"Rocket smoke helper objects remain: {remaining_helpers}")
    require(not bpy.data.particles, "Rocket smoke particle settings remain")
    remaining_textures = sorted(name for name in ROCKET_SMOKE_TEXTURES if bpy.data.textures.get(name))
    require(not remaining_textures, f"Rocket smoke textures remain: {remaining_textures}")
    remaining_materials = sorted(name for name in ROCKET_SMOKE_MATERIALS if bpy.data.materials.get(name))
    require(not remaining_materials, f"Rocket smoke materials remain: {remaining_materials}")
    unsupported = forbidden_material_nodes()
    require(not unsupported, f"Unsupported Rocket material nodes remain: {unsupported}")
    return True


def create_principled_material(name, color):
    require(bpy.data.materials.get(name) is None, f"Rocket smoke material already exists: {name}")
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.blend_method = "OPAQUE"
    material.shadow_method = "OPAQUE"
    material.use_backface_culling = False
    material.show_transparent_back = True
    material.use_screen_refraction = False
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = 0.82
    material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return material


def join_particle_instances(spec, matrices, bake_frame):
    source = bpy.data.objects.get(spec["instance"])
    require(source and source.type == "MESH", f"Missing Rocket smoke instance mesh: {spec['instance']}")
    material = create_principled_material(spec["material"], spec["color"])
    objects = []
    for index, matrix in enumerate(matrices):
        mesh = source.data.copy()
        mesh.name = f"__RocketSmokeBakeData_{spec['baked_name']}_{index:04d}"
        obj = bpy.data.objects.new(
            f"__RocketSmokeBake_{spec['baked_name']}_{index:04d}",
            mesh,
        )
        bpy.context.scene.collection.objects.link(obj)
        obj.matrix_world = matrix
        mesh.materials.clear()
        mesh.materials.append(material)
        objects.append(obj)

    require(len(objects) == spec["expected_particles"], f"{spec['emitter']}: unexpected baked particle count")
    for selected in bpy.context.selected_objects:
        selected.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    baked = objects[0]
    baked.name = spec["baked_name"]
    baked.data.name = f"{spec['baked_name']}Mesh"
    baked.data.materials.clear()
    baked.data.materials.append(material)
    for polygon in baked.data.polygons:
        polygon.material_index = 0
    parent = bpy.data.objects.get(spec["parent"])
    require(parent is not None, f"Rocket smoke parent is missing: {spec['parent']}")
    parent_local_transform = parent.matrix_world.inverted() @ baked.matrix_world
    baked.data.transform(parent_local_transform)
    baked.data.update()
    baked.parent = parent
    baked.matrix_parent_inverse = Matrix.Identity(4)
    baked.matrix_basis = Matrix.Identity(4)
    baked["baked_particle_count"] = len(matrices)
    baked["material_policy"] = "principled-static-v1"
    baked["rocket_smoke_bake_frame"] = bake_frame
    baked["rocket_smoke_bake_version"] = ROCKET_SMOKE_BAKE_VERSION
    baked["simulation_policy"] = ROCKET_SMOKE_SIMULATION_POLICY
    baked["procedural_seed"] = spec["procedural_seed"]
    baked["procedural_style"] = spec["procedural_style"]
    baked["source_emitter"] = spec["emitter"]
    return baked


def matrix_sort_key(matrix):
    return tuple(float(value) for row in matrix for value in row)


def normalized_matrix_axis(matrix, column):
    axis = Vector(
        (
            matrix[0][column],
            matrix[1][column],
            matrix[2][column],
        )
    )
    require(axis.length > 1e-8, "Rocket smoke emitter has a zero-length axis")
    axis.normalize()
    return axis


def orthogonal_plane_axes(normal, preferred):
    axis_x = preferred - normal * preferred.dot(normal)
    if axis_x.length <= 1e-8:
        for fallback in (Vector((1.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0))):
            axis_x = fallback - normal * fallback.dot(normal)
            if axis_x.length > 1e-8:
                break
    require(axis_x.length > 1e-8, "Rocket smoke plane has no stable radial axis")
    axis_x.normalize()
    axis_y = normal.cross(axis_x)
    require(axis_y.length > 1e-8, "Rocket smoke plane has no stable secondary axis")
    axis_y.normalize()
    return axis_x, axis_y


def procedural_rocket_smoke_matrices(spec):
    emitter = bpy.data.objects.get(spec["emitter"])
    require(emitter is not None, f"Rocket smoke emitter is missing: {spec['emitter']}")
    matrix = emitter.matrix_world.copy()
    center = matrix.translation.copy()
    preferred_axis = normalized_matrix_axis(matrix, 0)
    engine_center = bpy.data.objects["Engine Smoke"].matrix_world.translation.copy()
    ground_center = bpy.data.objects["Ground Smoke"].matrix_world.translation.copy()
    rng = random.Random(spec["procedural_seed"])
    count = spec["expected_particles"]
    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    matrices = []
    for index in range(count):
        progress = (index + 0.5) / count
        angle = index * golden_angle + rng.uniform(-0.08, 0.08)
        if spec["procedural_style"] == "engine-cone":
            exhaust_axis = ground_center - engine_center
            require(exhaust_axis.length > 1e-8, "Rocket exhaust direction is undefined")
            ground_distance = exhaust_axis.length
            exhaust_axis.normalize()
            axis_x, axis_y = orthogonal_plane_axes(exhaust_axis, preferred_axis)
            plume_length = min(1.5, max(0.85, ground_distance * 0.78))
            axial = 0.04 + plume_length * progress
            radial = (0.015 + 0.12 * progress) * math.sqrt(rng.random())
            position = (
                center
                + exhaust_axis * axial
                + axis_x * (math.cos(angle) * radial)
                + axis_y * (math.sin(angle) * radial)
            )
            scale = 0.07 + 0.12 * progress + 0.035 * rng.random()
        elif spec["procedural_style"] == "ground-ring":
            up_axis = engine_center - ground_center
            require(up_axis.length > 1e-8, "Rocket ground-smoke plane is undefined")
            up_axis.normalize()
            axis_x, axis_y = orthogonal_plane_axes(up_axis, preferred_axis)
            radial = 0.35 + 1.7 * math.sqrt(progress)
            radial *= (
                1.0
                + 0.12 * math.sin(3.0 * angle + 0.65)
                + rng.uniform(-0.06, 0.06)
            )
            height = 0.02 + 0.18 * (1.0 - progress) + 0.06 * rng.random()
            position = (
                center
                + axis_x * (math.cos(angle) * radial)
                + axis_y * (math.sin(angle) * radial)
                + up_axis * height
            )
            tier = rng.random()
            if tier < 0.70:
                scale = 0.035 + 0.045 * rng.random()
            elif tier < 0.95:
                scale = 0.09 + 0.05 * rng.random()
            else:
                scale = 0.15 + 0.05 * rng.random()
        else:
            raise RuntimeError(
                f"Unknown Rocket smoke procedural style: {spec['procedural_style']}"
            )
        rotation = Euler(
            (
                rng.uniform(-math.pi, math.pi),
                rng.uniform(-math.pi, math.pi),
                rng.uniform(-math.pi, math.pi),
            ),
            "XYZ",
        ).to_matrix().to_4x4()
        scale_matrix = Matrix.Diagonal((scale, scale, scale, 1.0))
        matrices.append(Matrix.Translation(position) @ rotation @ scale_matrix)
    matrices.sort(key=matrix_sort_key)
    return matrices


def remove_object_and_unused_data(name):
    obj = bpy.data.objects.get(name)
    if not obj:
        return
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data and getattr(data, "users", 1) == 0:
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)


def validate_rocket_legacy_simulation():
    records = particle_system_records()
    require(records, "Rocket legacy particle systems are missing")
    actual = {
        (
            obj.name,
            system.settings.name,
            system.settings.instance_object.name
            if system.settings.instance_object else None,
        )
        for obj, system in records
    }
    expected = {
        (spec["emitter"], settings_name, spec["instance"])
        for settings_name, spec in ROCKET_SMOKE_SPECS.items()
    }
    require(
        actual == expected,
        f"Rocket smoke state is unknown: expected {sorted(expected)}, got {sorted(actual)}",
    )
    for settings_name, spec in ROCKET_SMOKE_SPECS.items():
        settings = bpy.data.particles.get(settings_name)
        require(settings is not None, f"Rocket smoke settings are missing: {settings_name}")
        require(
            settings.collision_collection is None,
            f"{settings_name}: legacy collision collection drifted",
        )
        emitter = bpy.data.objects.get(spec["emitter"])
        require(emitter is not None, f"{spec['emitter']}: emitter is missing")
        collision_modifiers = [
            modifier
            for modifier in emitter.modifiers
            if modifier.type == "COLLISION"
        ]
        require(
            abs(
                float(settings.brownian_factor)
                - spec["legacy_brownian_factor"]
            )
            <= 1e-6,
            f"{settings_name}: legacy Brownian factor drifted",
        )
        require(
            len(collision_modifiers) == 1,
            f"{spec['emitter']}: legacy collision modifier drifted",
        )
    return True


def bake_rocket_smoke(root, bake_frame):
    require(bake_frame == 60, "Rocket smoke must be baked at the reviewed frame 60")
    if validate_completed_rocket_bake(root, bake_frame):
        return

    records = particle_system_records()
    actual = {
        (obj.name, system.settings.name, system.settings.instance_object.name if system.settings.instance_object else None)
        for obj, system in records
    }
    expected = {
        (spec["emitter"], settings_name, spec["instance"])
        for settings_name, spec in ROCKET_SMOKE_SPECS.items()
    }
    require(actual == expected, f"Rocket smoke state is unknown: expected {sorted(expected)}, got {sorted(actual)}")
    for name in ROCKET_SMOKE_HELPERS:
        require(bpy.data.objects.get(name) is not None, f"Rocket smoke helper is missing: {name}")
    validate_rocket_legacy_simulation()

    # Disable the stochastic particle systems before changing frames. The authored
    # emitters and instance meshes remain available, but Blender no longer needs
    # to evaluate the legacy force-field simulation or its collision cycles.
    for spec in ROCKET_SMOKE_SPECS.values():
        emitter = bpy.data.objects.get(spec["emitter"])
        require(emitter is not None, f"Rocket smoke emitter is missing: {spec['emitter']}")
        for modifier in list(emitter.modifiers):
            if modifier.type == "PARTICLE_SYSTEM":
                modifier.show_viewport = False
                modifier.show_render = False
            elif modifier.type == "COLLISION":
                emitter.modifiers.remove(modifier)

    scene = bpy.context.scene
    original_frame = scene.frame_current
    scene.frame_set(bake_frame)
    bpy.context.view_layer.update()
    matrices = {
        settings_name: procedural_rocket_smoke_matrices(spec)
        for settings_name, spec in ROCKET_SMOKE_SPECS.items()
    }

    baked_objects = {
        settings_name: join_particle_instances(spec, matrices[settings_name], bake_frame)
        for settings_name, spec in ROCKET_SMOKE_SPECS.items()
    }
    for name in sorted(ROCKET_SMOKE_HELPERS):
        remove_object_and_unused_data(name)
    for settings_name in ROCKET_SMOKE_SPECS:
        settings = bpy.data.particles.get(settings_name)
        if settings:
            bpy.data.particles.remove(settings)
    for name in sorted(ROCKET_SMOKE_TEXTURES):
        texture = bpy.data.textures.get(name)
        if texture:
            bpy.data.textures.remove(texture)
    for name in sorted(ROCKET_SMOKE_MATERIALS):
        material = bpy.data.materials.get(name)
        if material:
            require(material.users == 0, f"Rocket smoke material is still used: {name}")
            bpy.data.materials.remove(material)
    for mesh in list(bpy.data.meshes):
        if mesh.name.startswith("__RocketSmokeBakeData_") and mesh.users == 0:
            bpy.data.meshes.remove(mesh)

    root["rocket_smoke_bake_frame"] = bake_frame
    root["rocket_smoke_bake_version"] = ROCKET_SMOKE_BAKE_VERSION
    root["rocket_smoke_engine_particles"] = len(matrices["Smoke Emitter"])
    root["rocket_smoke_ground_particles"] = len(matrices["Smoke Emitter Outward"])
    root["rocket_smoke_material_policy"] = "principled-static-v1"
    root["rocket_smoke_simulation_policy"] = ROCKET_SMOKE_SIMULATION_POLICY
    for settings_name, spec in ROCKET_SMOKE_SPECS.items():
        prefix = f"rocket_smoke_{spec['integrity_key']}"
        root[f"{prefix}_seed"] = spec["procedural_seed"]
        root[f"{prefix}_style"] = spec["procedural_style"]
        record_rocket_baked_integrity(root, baked_objects[settings_name], spec)
    scene.frame_set(original_frame)
    bpy.context.view_layer.update()
    require(all(obj.name in bpy.data.objects for obj in baked_objects.values()), "Rocket smoke bake objects were lost")
    require(validate_completed_rocket_bake(root, bake_frame), "Rocket smoke bake validation failed")


def main():
    args = parse_args()
    require(tuple(bpy.app.version) == EXPECTED_VERSION, f"Expected Blender {EXPECTED_VERSION}, got {tuple(bpy.app.version)}")
    require(bool(bpy.data.filepath), "A source .blend file must be open")
    relink_owned_images(args)
    root = ensure_export_root()
    if args.crane_workout_remove_hidden_hand_mirror:
        cleanup_crane_workout_hidden_mirror(root)
    if args.rocket_smoke_bake_frame is not None:
        bake_rocket_smoke(root, args.rocket_smoke_bake_frame)
    if args.static_crane_pose_frame is not None:
        bake_static_crane_pose(root, args.static_crane_pose_frame)
    if args.remove_web_ground:
        cleanup_web_ground(root)

    linked = [library.filepath for library in bpy.data.libraries if library.filepath]
    require(not linked, f"Linked Blender libraries are not permitted: {json.dumps(linked)}")

    destination = Path(args.destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(destination),
        check_existing=False,
        compress=True,
        relative_remap=False,
    )
    print(f"curated source: {destination}")


if __name__ == "__main__":
    main()
