
import bpy
import sys

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import the model
filepath = r"/Users/gabriela/Library/Mobile Documents/com~apple~CloudDocs/repo/StemStack/myearth/MyEarth/uploads/original_1754418557_fake_model.obj"
file_ext = ".obj"

if file_ext == '.obj':
    bpy.ops.import_scene.obj(filepath=filepath)
elif file_ext == '.fbx':
    bpy.ops.import_scene.fbx(filepath=filepath)
elif file_ext == '.dae':
    bpy.ops.wm.collada_import(filepath=filepath)
elif file_ext == '.3ds':
    bpy.ops.import_scene.autodesk_3ds(filepath=filepath)
elif file_ext == '.stl':
    bpy.ops.import_mesh.stl(filepath=filepath)
elif file_ext == '.ply':
    bpy.ops.import_mesh.ply(filepath=filepath)

# Apply all modifiers
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        for modifier in obj.modifiers:
            bpy.ops.object.modifier_apply(modifier=modifier.name)

# Export as GLB
bpy.ops.export_scene.gltf(
    filepath=r"/Users/gabriela/Library/Mobile Documents/com~apple~CloudDocs/repo/StemStack/myearth/MyEarth/uploads/original_1754418557_fake_model.glb",
    export_format='GLB',
    export_animations=False,
    export_apply=True
)
