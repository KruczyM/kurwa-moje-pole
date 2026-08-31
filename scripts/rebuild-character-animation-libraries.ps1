param(
  [string]$BlenderPath = 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$builder = Join-Path $PSScriptRoot 'blender\build-character-animation-library.py'
$donor = Join-Path $repoRoot 'source-assets\animations\mixamo-motion-library.glb'
$characters = @('amper', 'antena', 'gruczol', 'klatwa', 'krwiak', 'pien', 'pierscien', 'zawor')
$retargetedClips = @(
  'Breakdance1990',
  'Capoeira',
  'DrunkWalkingTurn',
  'Floating',
  'HipHopDancing',
  'LowCrawl',
  'SittingLaughing',
  'SneakWalk',
  'SwimmingToEdge',
  'SwingToLand'
)

if (-not (Test-Path -LiteralPath $BlenderPath)) {
  throw "Nie znaleziono Blendera: $BlenderPath"
}
if (-not (Test-Path -LiteralPath $donor)) {
  throw "Nie znaleziono biblioteki ruchów: $donor"
}

foreach ($character in $characters) {
  $base = Join-Path $repoRoot "source-assets\characters\$character\t-pose.glb"
  $runtime = Join-Path $repoRoot "public\game-assets\characters\$character\npc-animations.glb"
  $temporary = "$runtime.rebuild.glb"
  $arguments = @(
    '--background',
    '--factory-startup',
    '--python',
    $builder,
    '--',
    '--base',
    $base,
    '--retarget-library',
    $donor,
    '--exclude-retarget-clip',
    'Idle',
    '--exclude-retarget-clip',
    'Walk',
    '--exclude-retarget-clip',
    'Run',
    '--output',
    $temporary
  )

  if ($character -eq 'pierscien') {
    $mixamo = Join-Path $repoRoot 'source-assets\characters\pierscien\mixamo'
    $arguments += @(
      '--clip',
      "Idle=$(Join-Path $mixamo 'idle-neutral.fbx')",
      '--clip',
      "Walk=$(Join-Path $mixamo 'walking.fbx')",
      '--clip',
      "Run=$(Join-Path $mixamo 'running.fbx')"
    )
  } else {
    $arguments += @('--library', $runtime)
    foreach ($clip in $retargetedClips) {
      $arguments += @('--exclude-library-clip', $clip)
    }
  }

  Write-Host "Odbudowuję bibliotekę: $character"
  & $BlenderPath @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Blender przerwał odbudowę postaci $character (kod $LASTEXITCODE)"
  }
  if (-not (Test-Path -LiteralPath $temporary)) {
    throw "Brak pliku wynikowego dla postaci $character"
  }
  Copy-Item -LiteralPath $temporary -Destination $runtime -Force
  Remove-Item -LiteralPath $temporary
}

Write-Host 'Gotowe. Uruchom: npm run check:rigs'
