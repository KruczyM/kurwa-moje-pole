import re

path = 'E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades/src/game/npc/NpcManager.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''      let spawnX, spawnZ;
      if (index < spawns.length) {
        spawnX = spawns[index][0];
        spawnZ = spawns[index][1];
      } else {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * CAMP_RADIUS;
        spawnX = Math.cos(angle) * r;
        spawnZ = Math.sin(angle) * r;
      }
      
      root.position.set(spawnX, 0, spawnZ);
      root.position.set(
        spawnX,
        terrainHeight(spawnX, spawnZ),
        spawnZ,
      );'''

content = content.replace(
    '''      root.position.set(spawns[index][0], 0, spawns[index][1]);
      root.position.set(
        spawns[index][0],
        terrainHeight(spawns[index][0], spawns[index][1]),
        spawns[index][1],
      );''',
    replacement
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
