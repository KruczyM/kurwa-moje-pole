import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const configured = process.env.BLENDER_PATH;
const windows = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const executable = configured || (existsSync(windows) ? windows : 'blender');
const result = spawnSync(
  executable,
  [
    '--factory-startup',
    '-b',
    '-t',
    '4',
    '--python-exit-code',
    '1',
    '--python',
    'scripts/blender/export-festival-runtime.py',
  ],
  { cwd: root, stdio: 'inherit' },
);
if (result.error)
  console.error(
    `Nie można uruchomić Blendera. Ustaw BLENDER_PATH na plik wykonywalny: ${result.error.message}`,
  );
process.exitCode = result.status ?? 1;
if (result.status === 0) {
  const mapResult = spawnSync(
    executable,
    [
      '--factory-startup',
      '-b',
      '-t',
      '4',
      '--python-exit-code',
      '1',
      '--python',
      'scripts/blender/render-layout-top-reference.py',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (mapResult.error) console.error('Eksport rzutu mapy nie powiódł się:', mapResult.error.message);
  process.exitCode = mapResult.status ?? 1;
  if (mapResult.status === 0) {
    const fog = spawnSync('python', ['scripts/build-fog-sectors.py'], { cwd: root, stdio: 'inherit' });
    if (fog.error) console.error('Eksport sektorów mgły nie powiódł się:', fog.error.message);
    process.exitCode = fog.status ?? 1;
  }
}
