import argparse
import json
import sys
from pathlib import Path

import bmesh
import bpy


BAKE_FRAME = 60
BAKED_OBJECTS = (
    "RocketSmokeEngineBaked",
    "RocketSmokeGroundBaked",
)
BAKED_MATERIALS = (
    "RocketSmokeEnginePrincipled",
    "RocketSmokeGroundPrincipled",
)
LEGACY_TEXTURES = (
    "Horizontal Smoke",
    "Vertical Smoke",
)
UNSUPPORTED_NODES = {
    "ShaderNodeBsdfDiffuse",
    "ShaderNodeBsdfTransparent",
    "ShaderNodeMath",
    "ShaderNodeMixShader",
    "ShaderNodeParticleInfo",
    "ShaderNodeValToRGB",
}
PARTICLE_SPECS = (
    {
        "brownian": 1.0,
        "count": 51,
        "damping": 1.0,
        "emitter": "Engine Smoke",
        "factor_random": 0.0,
        "frame_end": 100.0,
        "frame_start": 40.0,
        "gravity": 1.0,
        "instance": "Smoke Particle",
        "lifetime": 50.0,
        "material": "Material",
        "normal_factor": 3.0,
        "parent": "Rocket",
        "settings_count": 150,
        "settings": "Smoke Emitter",
        "wind": 0.0,
    },
    {
        "brownian": 20.0,
        "count": 400,
        "damping": 0.0,
        "emitter": "Ground Smoke",
        "factor_random": 1.0,
        "frame_end": 60.0,
        "frame_start": 1.0,
        "gravity": 0.1,
        "instance": "Smoke Particle Gray",
        "lifetime": 100.0,
        "material": "Material.001",
        "normal_factor": 7.0,
        "parent": "WEB_EXPORT_ROOT",
        "settings_count": 400,
        "settings": "Smoke Emitter Outward",
        "wind": 1.0,
    },
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--destination")
    mode.add_argument("--report")
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def remove_object_and_unused_mesh(name):
    obj = bpy.data.objects.get(name)
    require(obj is not None, f"Expected baked Rocket object is missing: {name}")
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh and mesh.users == 0:
        bpy.data.meshes.remove(mesh)


def create_legacy_material(name):
    require(bpy.data.materials.get(name) is None, f"Legacy material already exists: {name}")
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    nodes.new("ShaderNodeMath")
    nodes.new("ShaderNodeParticleInfo")
    nodes.new("ShaderNodeValToRGB")
    material.node_tree.links.new(diffuse.outputs["BSDF"], mix.inputs[1])
    material.node_tree.links.new(transparent.outputs["BSDF"], mix.inputs[2])
    material.node_tree.links.new(mix.outputs["Shader"], output.inputs["Surface"])
    return material


def create_icosphere_object(name, material, root, location):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    bm = bmesh.new()
    try:
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.25)
        bm.to_mesh(mesh)
    finally:
        bm.free()
    mesh.update()
    require(len(mesh.polygons) == 20, f"{name} must have exactly 20 triangles")
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in uv_layer.data:
        loop.uv = (0.0, 0.0)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = root
    obj.location = location
    return obj


def create_emitter_mesh(name):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(
        [(-0.5, -0.5, 0.0), (0.5, -0.5, 0.0), (0.5, 0.5, 0.0), (-0.5, 0.5, 0.0)],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()
    return mesh


def add_particle_system(emitter, spec, instance):
    bpy.ops.object.select_all(action="DESELECT")
    emitter.select_set(True)
    bpy.context.view_layer.objects.active = emitter
    bpy.ops.object.particle_system_add()
    require(len(emitter.particle_systems) == 1, f"{emitter.name} particle system creation failed")
    system = emitter.particle_systems[0]
    settings = system.settings
    settings.name = spec["settings"]
    settings.type = "EMITTER"
    settings.count = spec["settings_count"]
    settings.frame_start = spec["frame_start"]
    settings.frame_end = spec["frame_end"]
    settings.lifetime = spec["lifetime"]
    settings.physics_type = "NEWTON"
    settings.emit_from = "FACE"
    settings.render_type = "OBJECT"
    settings.instance_object = instance
    settings.normal_factor = spec["normal_factor"]
    settings.factor_random = spec["factor_random"]
    settings.brownian_factor = spec["brownian"]
    settings.damping = spec["damping"]
    settings.particle_size = 5.0
    settings.size_random = 0.25
    settings.use_rotations = spec["settings"] == "Smoke Emitter Outward"
    settings.rotation_mode = "VEL"
    settings.effector_weights.gravity = spec["gravity"]
    settings.effector_weights.wind = spec["wind"]
    system.seed = 0


def particle_instance_counts():
    scene = bpy.context.scene
    original_frame = scene.frame_current
    scene.frame_set(BAKE_FRAME)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    counts = {spec["settings"]: 0 for spec in PARTICLE_SPECS}
    for instance in depsgraph.object_instances:
        system = getattr(instance, "particle_system", None)
        if not instance.is_instance or system is None:
            continue
        settings_name = system.settings.name
        if settings_name in counts:
            counts[settings_name] += 1
    scene.frame_set(original_frame)
    bpy.context.view_layer.update()
    return counts


def fixture_report():
    particle_records = sorted(
        [
            obj.name,
            system.settings.name,
            system.settings.instance_object.name if system.settings.instance_object else None,
        ]
        for obj in bpy.data.objects
        for system in obj.particle_systems
    )
    unsupported = sorted({
        node.bl_idname
        for material in bpy.data.materials
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
        if node.bl_idname in UNSUPPORTED_NODES
    })
    return {
        "brownianFactors": {
            system.settings.name: system.settings.brownian_factor
            for obj in bpy.data.objects
            for system in obj.particle_systems
        },
        "forceFields": {
            name: bpy.data.objects[name].field.type
            for name in ("Turbulence", "Wind")
            if bpy.data.objects.get(name)
        },
        "legacyTextures": sorted(
            name for name in LEGACY_TEXTURES if bpy.data.textures.get(name)
        ),
        "particleInstances": particle_instance_counts(),
        "particleRecords": particle_records,
        "unsupportedNodes": unsupported,
    }


def create_fixture(destination):
    root = bpy.data.objects.get("WEB_EXPORT_ROOT")
    rocket = bpy.data.objects.get("Rocket")
    require(root is not None, "WEB_EXPORT_ROOT is missing")
    require(rocket is not None, "Rocket is missing")
    require(bpy.data.actions.get("RocketAction") is not None, "RocketAction is missing")
    require(not list(bpy.data.particles), "Canonical Rocket unexpectedly has particle settings")

    for name in BAKED_OBJECTS:
        remove_object_and_unused_mesh(name)
    for name in BAKED_MATERIALS:
        material = bpy.data.materials.get(name)
        require(material is not None, f"Expected baked Rocket material is missing: {name}")
        require(material.users == 0, f"Expected baked Rocket material is still used: {name}")
        bpy.data.materials.remove(material)
    for key in list(root.keys()):
        if key.startswith("rocket_smoke_"):
            del root[key]

    for spec in PARTICLE_SPECS:
        for key in ("emitter", "instance", "settings"):
            datablocks = bpy.data.particles if key == "settings" else bpy.data.objects
            require(datablocks.get(spec[key]) is None, f"Legacy datablock already exists: {spec[key]}")
    for name in ("Turbulence", "Wind", *LEGACY_TEXTURES):
        require(
            bpy.data.objects.get(name) is None and bpy.data.textures.get(name) is None,
            f"Legacy helper already exists: {name}",
        )

    materials = {
        spec["material"]: create_legacy_material(spec["material"])
        for spec in PARTICLE_SPECS
    }
    instances = {}
    for index, spec in enumerate(PARTICLE_SPECS):
        instances[spec["instance"]] = create_icosphere_object(
            spec["instance"],
            materials[spec["material"]],
            root,
            (4.0 + index, 0.0, 0.0),
        )
    for index, spec in enumerate(PARTICLE_SPECS):
        mesh = create_emitter_mesh(spec["emitter"])
        emitter = bpy.data.objects.new(spec["emitter"], mesh)
        bpy.context.scene.collection.objects.link(emitter)
        emitter.parent = bpy.data.objects[spec["parent"]]
        emitter.location = (0.0, 0.0, float(index))
        add_particle_system(emitter, spec, instances[spec["instance"]])
        bpy.ops.object.modifier_add(type="COLLISION")
        require(
            any(modifier.type == "COLLISION" for modifier in emitter.modifiers),
            f"{emitter.name} collision modifier creation failed",
        )

    for name, field_type, strength in (
        ("Turbulence", "TURBULENCE", 10.0),
        ("Wind", "WIND", 3.0),
    ):
        bpy.ops.object.effector_add(type=field_type, location=(0.0, 0.0, 0.0))
        helper = bpy.context.object
        helper.name = name
        helper.parent = root
        helper.field.strength = strength
    for name in LEGACY_TEXTURES:
        texture = bpy.data.textures.new(name, type="CLOUDS")
        texture.use_fake_user = True

    expected_counts = {spec["settings"]: spec["count"] for spec in PARTICLE_SPECS}
    require(
        particle_instance_counts() == expected_counts,
        f"Synthetic legacy Rocket instance counts drifted: {particle_instance_counts()}",
    )
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(destination),
        check_existing=False,
        compress=True,
    )


def main():
    args = parse_args()
    if args.destination:
        create_fixture(args.destination)
        print(f"legacy Rocket fixture: {Path(args.destination).resolve()}")
        return
    report = fixture_report()
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"legacy Rocket fixture report: {report_path}")


if __name__ == "__main__":
    main()
