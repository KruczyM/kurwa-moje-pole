import re

path = 'E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades/src/game/assets/AssetLoader.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'marketStalls, festivalZones] =',
    'marketStalls, festivalZones, mainStage, smallStage, aspTent] ='
)

content = content.replace(
    '''        this.load(environmentAssets.festivalZones, \\'strefy festiwalowe i scena Pomorza\\', \\'mixed\\'),
      ]);''',
    '''        this.load(environmentAssets.festivalZones, \\'strefy festiwalowe i scena Pomorza\\', \\'mixed\\'),
        this.load(environmentAssets.mainStage, \\'Duza Scena\\', \\'mixed\\'),
        this.load(environmentAssets.smallStage, \\'Mala Scena\\', \\'mixed\\'),
        this.load(environmentAssets.aspTent, \\'Namiot ASP\\', \\'mixed\\'),
      ]);'''
)

content = content.replace(
    '''      festivalZones,
      interactables,''',
    '''      festivalZones,
      mainStage,
      smallStage,
      aspTent,
      interactables,'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
