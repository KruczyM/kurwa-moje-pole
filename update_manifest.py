import re

path = 'E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades/src/game/assets/assetManifest.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

addition = '''
export const festivalNpcAssets: CharacterAsset[] = catalog.festivalNpcs.map(({ id, name, path }) => ({
  id,
  name,
  url: gameAsset(path),
  previewUrl: gameAsset(path),
}));
'''

content = content.replace(
    '''  previewUrl: gameAsset(\characters/\/preview.glb\),
}));''',
    '''  previewUrl: gameAsset(\characters/\/preview.glb\),
}));''' + addition
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
