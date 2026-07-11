import argparse
import json
import shutil
import sys
from pathlib import Path

import bpy


EXPECTED_VERSION = (3, 6, 23)
SCREEN_MATERIALS = (
    "DashboardScreenMaterial",
    "MatchHistoryPrimaryMaterial",
    "MatchHistoryDuplicateMaterial",
    "LeftoverScreenMaterial",
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination")
    parser.add_argument("--report")
    parser.add_argument("--include-leftover", action="store_true")
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def write_png(path, color):
    image = bpy.data.images.new(
        f"__fixture_writer_{path.stem}",
        width=2,
        height=2,
        alpha=True,
    )
    image.pixels = list(color) * 4
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def load_packed_image(path, name):
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.pack()
    require(image.source == "FILE", f"Fixture image is not FILE-backed: {name}")
    require(image.packed_file is not None, f"Fixture image did not pack: {name}")
    return image


def create_screen(name, material_name, image, x):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(
        [(-1.0, -0.5, 0.0), (1.0, -0.5, 0.0), (1.0, 0.5, 0.0), (-1.0, 0.5, 0.0)],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location.x = x

    material = bpy.data.materials.new(material_name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Legacy Screen Image"
    texture.image = image
    material.node_tree.links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    mesh.materials.append(material)
    return obj


def create_fixture(destination, include_leftover):
    require(tuple(bpy.app.version) == EXPECTED_VERSION, f"Expected Blender {EXPECTED_VERSION}")
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    texture_root = destination.parent / f".{destination.stem}-legacy-textures"
    if texture_root.exists():
        shutil.rmtree(texture_root)
    texture_root.mkdir()

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    texture_specs = [
        ("ban site.png", "ban site", (0.74, 0.12, 0.22, 1.0)),
        ("mint.png", "mint", (0.12, 0.74, 0.45, 1.0)),
        ("mint copy.png", "mint.001", (0.18, 0.64, 0.38, 1.0)),
    ]
    if include_leftover:
        texture_specs.append(
            ("unowned-leftover.png", "unowned-leftover", (0.80, 0.55, 0.05, 1.0))
        )

    images = {}
    for file_name, image_name, color in texture_specs:
        image_path = texture_root / file_name
        write_png(image_path, color)
        images[image_name] = load_packed_image(image_path, image_name)

    create_screen(
        "DashboardScreen",
        "DashboardScreenMaterial",
        images["ban site"],
        -3.0,
    )
    create_screen(
        "MatchHistoryPrimaryScreen",
        "MatchHistoryPrimaryMaterial",
        images["mint"],
        0.0,
    )
    create_screen(
        "MatchHistoryDuplicateScreen",
        "MatchHistoryDuplicateMaterial",
        images["mint.001"],
        3.0,
    )
    if include_leftover:
        create_screen(
            "LeftoverScreen",
            "LeftoverScreenMaterial",
            images["unowned-leftover"],
            6.0,
        )

    bpy.ops.wm.save_as_mainfile(
        filepath=str(destination),
        check_existing=False,
        compress=True,
    )
    shutil.rmtree(texture_root)
    print(f"legacy League fixture: {destination}")


def image_names_for_material(material):
    if not material.use_nodes or material.node_tree is None:
        return []
    return sorted(
        node.image.name
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeTexImage" and node.image is not None
    )


def fixture_report():
    file_images = sorted(image.name for image in bpy.data.images if image.source == "FILE")
    material_images = {
        name: image_names_for_material(bpy.data.materials[name])
        for name in SCREEN_MATERIALS
        if bpy.data.materials.get(name) is not None
    }
    object_materials = {
        obj.name: sorted(
            material.name
            for material in obj.data.materials
            if material is not None
        )
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.name.endswith("Screen")
    }
    return {
        "fileImages": file_images,
        "imageUsers": {
            image.name: image.users
            for image in sorted(bpy.data.images, key=lambda item: item.name)
            if image.source == "FILE"
        },
        "materialImages": material_images,
        "objectMaterials": dict(sorted(object_materials.items())),
        "packedImages": sorted(
            image.name
            for image in bpy.data.images
            if image.source == "FILE" and image.packed_file is not None
        ),
    }


def main():
    args = parse_args()
    require(tuple(bpy.app.version) == EXPECTED_VERSION, f"Expected Blender {EXPECTED_VERSION}")
    require(bool(args.destination) != bool(args.report), "Specify exactly one of --destination or --report")
    if args.destination:
        create_fixture(args.destination, args.include_leftover)
        return

    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(fixture_report(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"legacy League fixture report: {report_path}")


if __name__ == "__main__":
    main()
