$python = "E:\kodowanie\gra\Hunyuan3D-2GP\.venv\Scripts\python.exe"
$script = "E:\kodowanie\gra\.ai\worktrees\festival-2026-tent-upgrades\scripts\hunyuan_batch.py"
$dest_dir = "E:\kodowanie\gra\.ai\worktrees\festival-2026-tent-upgrades\public\game-assets\world\festival"

# Remove potential stale lock
Remove-Item -Force "E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv\queue.lock" -ErrorAction SilentlyContinue

Write-Host "Generating model: grzybek"
& $python $script --install "E:\kodowanie\gra\Hunyuan3D-2GP" --input "E:\kodowanie\gra\Hunyuan3D-2GP\input_characters" --output "E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv" --seed 4242 --only grzybek

$out_dir = "E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv\grzybek"
$newest = Get-ChildItem -Path $out_dir -Recurse -Filter "textured.glb" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($newest) {
    $src = $newest.FullName
    $dest = "$dest_dir\grzybek.glb"
    Write-Host "Copying $src to $dest"
    Copy-Item -Path $src -Destination $dest -Force
}

Write-Host "Grzybek generated."
