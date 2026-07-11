import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

EXPECTED_VERSION = (3, 6, 23)
FROGGIE_DISPLAY_VERSION = 1
WEB_GROUND_SHADOW_STRATEGY = "transparent-canvas-contact-shadow-v1"


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--texture", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.actions,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def srgb_channel_to_linear(value):
    value = value / 255.0
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def hex_color(value):
    require(
        len(value) == 7 and value.startswith("#"),
        f"Invalid Froggie material color: {value}",
    )
    return tuple(
        srgb_channel_to_linear(int(value[index : index + 2], 16))
        for index in (1, 3, 5)
    )


def solid_material(name, color_hex, roughness=0.68):
    color = hex_color(color_hex)
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    material.blend_method = "OPAQUE"
    material.shadow_method = "OPAQUE"
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material Output"
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Principled BSDF"
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = roughness
    material.node_tree.links.new(
        principled.outputs["BSDF"],
        output.inputs["Surface"],
    )
    return material


def screen_material(texture_path):
    image = bpy.data.images.load(str(texture_path), check_existing=False)
    image.name = "FroggieGameplay"
    image.colorspace_settings.name = "sRGB"
    image.pack()
    require(image.packed_file is not None, "Froggie gameplay texture did not pack")
    image.filepath = "//textures/froggie-gameplay-screen.png"

    material = bpy.data.materials.new("GameplayScreenMaterial")
    material.use_nodes = True
    material.blend_method = "OPAQUE"
    material.shadow_method = "OPAQUE"
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material Output"
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Principled BSDF"
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Froggie Gameplay"
    texture.image = image
    texture.interpolation = "Linear"
    texture.projection = "FLAT"
    texture.extension = "CLIP"
    principled.inputs["Roughness"].default_value = 0.35
    principled.inputs["Emission Strength"].default_value = 0.3
    links = material.node_tree.links
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    links.new(texture.outputs["Color"], principled.inputs["Emission"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return material


def apply_bevel(obj, width, segments=1):
    if width <= 0:
        return
    modifier = obj.modifiers.new("SoftEdges", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.affect = "EDGES"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    result = bpy.ops.object.modifier_apply(modifier=modifier.name)
    require(result == {"FINISHED"}, f"Could not apply bevel to {obj.name}")
    obj.select_set(False)


def finish_mesh_object(obj, name, material, bevel=0.0):
    obj.name = name
    obj.data.name = f"{name}Mesh"
    if material is not None:
        obj.data.materials.append(material)
    apply_bevel(obj, bevel)
    require(not obj.modifiers, f"{name} retained an authoring modifier")
    return obj


def add_box(name, dimensions, location, material, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_mesh_object(obj, name, material, bevel)


def add_tapered_pedestal(material):
    bottom_width = 2.0
    bottom_depth = 1.25
    top_width = 1.7
    top_depth = 1.05
    height = 1.65
    vertices = [
        (-bottom_width / 2, -bottom_depth / 2, -height / 2),
        (bottom_width / 2, -bottom_depth / 2, -height / 2),
        (bottom_width / 2, bottom_depth / 2, -height / 2),
        (-bottom_width / 2, bottom_depth / 2, -height / 2),
        (-top_width / 2, -top_depth / 2, height / 2),
        (top_width / 2, -top_depth / 2, height / 2),
        (top_width / 2, top_depth / 2, height / 2),
        (-top_width / 2, top_depth / 2, height / 2),
    ]
    faces = [
        (0, 3, 2, 1),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
    ]
    mesh = bpy.data.meshes.new("ArcadePedestalMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("ArcadePedestal", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (0.0, 0.12, 1.185)
    return finish_mesh_object(obj, "ArcadePedestal", material, 0.08)


def add_cylinder(name, radius, depth, location, material, vertices=16, bevel=0.035):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    return finish_mesh_object(bpy.context.object, name, material, bevel)


def add_icosphere(name, radius, location, material, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=radius,
        location=location,
    )
    return finish_mesh_object(bpy.context.object, name, material)


def add_screen(material):
    bpy.ops.mesh.primitive_plane_add(
        size=2.0,
        location=(0.0, -0.316, 3.15),
    )
    screen = bpy.context.object
    screen.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    screen.scale = (1.725, 0.97, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_mesh_object(screen, "GameplayScreen", material)


def parent_payload(root, objects):
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_world = world


def point_at(obj, target):
    direction = Vector(target) - obj.location
    require(direction.length > 1e-8, f"{obj.name} target direction is undefined")
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_reference_camera_and_light():
    bpy.ops.object.camera_add(location=(3.8, -9.8, 4.4))
    camera = bpy.context.object
    camera.name = "ReferenceCamera"
    camera.data.name = "ReferenceCameraData"
    camera.data.lens = 33.0
    point_at(camera, (0.0, 0.0, 2.25))
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(4.2, -5.0, 7.2))
    light = bpy.context.object
    light.name = "ReferenceKeyLight"
    light.data.name = "ReferenceKeyLightData"
    light.data.energy = 720.0
    light.data.shape = "DISK"
    light.data.size = 5.0
    point_at(light, (0.0, 0.0, 2.2))


def configure_scene():
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 1
    scene.frame_set(1)
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 16
    scene.render.film_transparent = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    world = scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (*hex_color("#AFD4E1"), 1.0)
    background.inputs["Strength"].default_value = 0.7


def create_export_root():
    root = bpy.data.objects.new("WEB_EXPORT_ROOT", None)
    bpy.context.scene.collection.objects.link(root)
    root.parent = None
    root.matrix_parent_inverse = Matrix.Identity(4)
    root.location = (0.0, 0.0, 0.0)
    root.rotation_mode = "XYZ"
    root.rotation_euler = (0.0, 0.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    root["asset_pipeline_version"] = 1
    root["froggie_display_version"] = FROGGIE_DISPLAY_VERSION
    root["web_ground_shadow_strategy"] = WEB_GROUND_SHADOW_STRATEGY
    return root


def main():
    args = parse_args()
    require(
        tuple(bpy.app.version) == EXPECTED_VERSION,
        f"Expected Blender {EXPECTED_VERSION}, got {tuple(bpy.app.version)}",
    )
    texture_path = Path(args.texture).resolve()
    output_path = Path(args.output).resolve()
    require(texture_path.is_file(), f"Froggie screen texture is missing: {texture_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    configure_scene()
    root = create_export_root()
    cabinet = solid_material("CabinetBlue", "#285D71", roughness=0.58)
    dark = solid_material("CabinetDark", "#193D4B", roughness=0.62)
    clay = solid_material("WarmClay", "#BA6F54", roughness=0.76)
    sand = solid_material("WarmSand", "#E7C692", roughness=0.8)
    green = solid_material("FroggieGreen", "#70A221", roughness=0.6)
    red = solid_material("ActionRed", "#F30B26", roughness=0.5)
    screen = screen_material(texture_path)

    objects = [
        add_box("ArcadeBase", (2.8, 1.7, 0.36), (0.0, 0.0, 0.18), dark, 0.1),
        add_tapered_pedestal(clay),
        add_box("ArcadeCabinet", (4.05, 0.62, 2.45), (0.0, 0.0, 3.15), cabinet, 0.12),
        add_box("ControlDeck", (3.35, 1.1, 0.24), (0.0, -0.57, 1.91), sand, 0.07),
        add_screen(screen),
        add_cylinder("JoystickStem", 0.07, 0.52, (-0.82, -0.73, 2.28), dark, vertices=12),
        add_icosphere("Joystick", 0.18, (-0.82, -0.73, 2.58), green),
        add_cylinder("ActionButtonA", 0.16, 0.1, (0.58, -0.76, 2.08), red),
        add_cylinder("ActionButtonB", 0.16, 0.1, (1.05, -0.76, 2.08), green),
        add_icosphere("FrogEyeLeft", 0.29, (-1.34, -0.03, 4.49), green),
        add_icosphere("FrogEyeRight", 0.29, (1.34, -0.03, 4.49), green),
        add_icosphere("FrogPupilLeft", 0.115, (-1.34, -0.27, 4.51), dark, subdivisions=1),
        add_icosphere("FrogPupilRight", 0.115, (1.34, -0.27, 4.51), dark, subdivisions=1),
    ]
    parent_payload(root, objects)
    add_reference_camera_and_light()

    expected = {obj.name for obj in objects}
    require(len(expected) == 13, "Froggie payload object names are not unique")
    require(
        all(obj.parent == root for obj in objects),
        "Froggie payload escaped WEB_EXPORT_ROOT",
    )
    require(
        not any(obj.is_shadow_catcher for obj in objects),
        "Froggie payload contains a shadow catcher",
    )
    bpy.ops.wm.save_as_mainfile(
        filepath=str(output_path),
        check_existing=False,
        compress=True,
        relative_remap=False,
    )
    print(f"Froggie display created: {output_path}")


if __name__ == "__main__":
    main()
