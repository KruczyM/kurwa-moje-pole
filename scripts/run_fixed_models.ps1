$models = @(
    "008_grunge_flannel_rocker",
    "015_feather_headband_hippie",
    "050_blue_alien_girl",
    "052_muddy_sneakers_rocker",
    "070_vintage_denim_shorts",
    "072_rave_bucket_hat",
    "078_girl_with_guitar",
    "087_neon_raver",
    "089_peace_hippie"
)

$python = "E:\kodowanie\gra\Hunyuan3D-2GP\.venv\Scripts\python.exe"
$script = "E:\kodowanie\gra\scripts\hunyuan_batch.py"
$dest_dir = "E:\kodowanie\gra\public\game-assets\npc_models"

foreach ($model in $models) {
    Write-Host "Generating model: $model"
    & $python $script --only $model
    
    $src = "E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv\$model\textured.glb"
    $dest = "$dest_dir\$model.glb"
    
    if (Test-Path $src) {
        Write-Host "Copying $src to $dest"
        Copy-Item -Path $src -Destination $dest -Force
    }
    else {
        Write-Host "Failed to find generated model: $src" -ForegroundColor Red
    }
}

Write-Host "All models regenerated. Shutting down..."
& "E:\kodowanie\gra\scripts\shutdown_after_gen.ps1"
