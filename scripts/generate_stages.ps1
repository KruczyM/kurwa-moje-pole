$models = @(
    "main_stage",
    "small_stage",
    "asp_tent"
)

$python = "E:\kodowanie\gra\Hunyuan3D-2GP\.venv\Scripts\python.exe"
$script = "E:\kodowanie\gra\.ai\worktrees\festival-2026-tent-upgrades\scripts\hunyuan_batch.py"
$dest_dir = "E:\kodowanie\gra\.ai\worktrees\festival-2026-tent-upgrades\public\game-assets\world\festival"

foreach ($model in $models) {
    Write-Host "Generating model: $model"
    & $python $script --install "E:\kodowanie\gra\Hunyuan3D-2GP" --input "E:\kodowanie\gra\Hunyuan3D-2GP\input_characters" --output "E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv" --no-rembg --seed 4242 --only $model
    
    $out_dir = "E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv\$model"
    $newest = Get-ChildItem -Path $out_dir -Recurse -Filter "textured.glb" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if ($newest) {
        $src = $newest.FullName
        $dest = "$dest_dir\$model.glb"
        Write-Host "Copying $src to $dest"
        Copy-Item -Path $src -Destination $dest -Force
    }
}

Write-Host "Stages generated."
