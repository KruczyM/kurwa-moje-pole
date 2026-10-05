/**
 * NpcBranchingDialogue - Rozgałęzione rozmowy i przysługi dla NPC (#KURWAMOJEPOLE).
 *
 * Zadanie C2 z docs/attractions-plan.md:
 * - Struktura węzłów: id, speakerId, text, options (label, nextNodeId, condition?, action?), isEnd?
 * - Integracja z NpcRelationships: opcje zależne od poziomu relacji ('obcy'..'zaufany') i ukończonych przysług.
 * - Wybór opcji może zwiększać zaufanie, odblokowywać wskazówki, przydzielać i realizować przysługi.
 * - Czyste API: startDialogue, getCurrentNode, selectOption, endDialogue.
 * - 100% deterministyczny, zero zależności od LLM ani zewnętrznych API (Rule 2 AGENTS.md).
 * - Weryfikacja grafu: sprawdzanie osiągalności, brak ślepych zaułków, bezpieczna obsługa cykli.
 */

import { NpcRelationships, NpcRelationship, RelationshipTier, RELATIONSHIP_TIERS } from './NpcRelationships';

export interface DialogueOption {
  id?: string;
  label: string;
  nextNodeId: string | null;
  condition?: (rel: NpcRelationship, manager: NpcBranchingDialogue) => boolean;
  action?: (rel: NpcRelationship, manager: NpcBranchingDialogue) => void;
  isEnd?: boolean;

  // Wygodne deklaratywne kryteria i nagrody:
  requiredTier?: RelationshipTier;
  requiredFavor?: string;
  requiredTopic?: string;
  unlockClue?: string;
  assignFavor?: string;
  completeFavor?: string;
  rewardScore?: number;
  learnTopic?: string;
}

export interface DialogueNode {
  id: string;
  speakerId: string;
  speakerName?: string;
  text: string;
  options: DialogueOption[];
  isEnd?: boolean;
  onEnter?: (rel: NpcRelationship, manager: NpcBranchingDialogue) => void;
}

export interface DialogueTree {
  id: string;
  npcId: string;
  title: string;
  rootNodeId: string;
  nodes: Record<string, DialogueNode>;
}

export interface DialogueHistoryEntry {
  nodeId: string;
  speakerId: string;
  speakerName?: string;
  text: string;
  selectedOptionLabel?: string;
  timestamp: number;
}

export interface TreeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  unreachableNodeIds: string[];
  deadEndNodeIds: string[];
  hasCycles: boolean;
  cyclePaths?: string[][];
}

export interface DialogueStateStorageV1 {
  version: 1;
  savedAt: number;
  assignedFavors: string[];
  unlockedClues: string[];
}

export const DIALOGUE_STORAGE_KEY_V1 = 'kmp_dialogue_state_v1';

/**
 * Sprawdza, czy dany poziom relacji spełnia minimalny wymagany poziom.
 */
export function isTierSufficient(currentTier: RelationshipTier, requiredTier: RelationshipTier): boolean {
  const currentIndex = RELATIONSHIP_TIERS.indexOf(currentTier);
  const requiredIndex = RELATIONSHIP_TIERS.indexOf(requiredTier);
  return currentIndex >= requiredIndex;
}

function resolveStorage(customStorage?: Storage | null): Storage | null {
  if (customStorage !== undefined) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { localStorage?: Storage }).localStorage
    ) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {}
  return null;
}

/**
 * Główny zarządca rozgałęzionych dialogów.
 */
export class NpcBranchingDialogue {
  private relationships: NpcRelationships;
  private trees = new Map<string, DialogueTree>();
  private defaultTreesByNpc = new Map<string, string>();

  // Stan aktywnego dialogu
  private activeTree: DialogueTree | null = null;
  private currentNode: DialogueNode | null = null;
  private currentNpcId: string | null = null;
  private history: DialogueHistoryEntry[] = [];

  // Pamięć postępu dialogowego gracza (przypisane questy/poszlaki)
  private assignedFavors = new Set<string>();
  private unlockedClues = new Set<string>();

  private storage: Storage | null;
  private storageKey: string;

  constructor(
    relationships?: NpcRelationships,
    options: { storage?: Storage | null; storageKey?: string } = {},
  ) {
    this.relationships = relationships ?? new NpcRelationships({ storage: options.storage });
    this.storage = resolveStorage(options.storage);
    this.storageKey = options.storageKey ?? DIALOGUE_STORAGE_KEY_V1;

    this.loadState();
    this.registerDefaultTrees();
  }

  /**
   * Zwraca instancję NpcRelationships.
   */
  public getRelationships(): NpcRelationships {
    return this.relationships;
  }

  /**
   * Rejestruje drzewo dialogowe.
   */
  public registerDialogueTree(tree: DialogueTree, isDefault = true): void {
    this.trees.set(tree.id, tree);
    if (isDefault || !this.defaultTreesByNpc.has(tree.npcId)) {
      this.defaultTreesByNpc.set(tree.npcId, tree.id);
    }
  }

  /**
   * Pobiera zarejestrowane drzewo po ID.
   */
  public getDialogueTree(treeId: string): DialogueTree | undefined {
    return this.trees.get(treeId);
  }

  /**
   * Pobiera domyślne drzewo dla danego NPC.
   */
  public getDefaultTreeForNpc(npcId: string): DialogueTree | undefined {
    const treeId = this.defaultTreesByNpc.get(npcId);
    return treeId ? this.trees.get(treeId) : undefined;
  }

  /**
   * Rozpoczyna dialog z danym NPC.
   */
  public startDialogue(npcId: string, dialogueTreeId?: string): DialogueNode | null {
    const tree = dialogueTreeId ? this.trees.get(dialogueTreeId) : this.getDefaultTreeForNpc(npcId);

    if (!tree) {
      return null;
    }

    const rootNode = tree.nodes[tree.rootNodeId];
    if (!rootNode) {
      return null;
    }

    this.activeTree = tree;
    this.currentNpcId = npcId;
    this.currentNode = rootNode;
    this.history = [];

    const rel = this.relationships.getRelationship(npcId);
    if (rootNode.onEnter) {
      rootNode.onEnter(rel, this);
    }

    this.recordNodeInHistory(rootNode);
    return rootNode;
  }

  /**
   * Zwraca aktualny węzeł trwającego dialogu.
   */
  public getCurrentNode(): DialogueNode | null {
    return this.currentNode;
  }

  /**
   * Sprawdza, czy dialog jest aktualnie aktywny.
   */
  public isDialogueActive(): boolean {
    return this.currentNode !== null && this.activeTree !== null;
  }

  /**
   * Zwraca ID aktualnego mówcy lub null.
   */
  public getCurrentSpeaker(): string | null {
    return this.currentNode ? this.currentNode.speakerId : null;
  }

  /**
   * Zwraca ID NPC, z którym toczy się dialog.
   */
  public getCurrentNpcId(): string | null {
    return this.currentNpcId;
  }

  /**
   * Sprawdza, czy dana opcja jest dostępna dla gracza w bieżącym stanie relacji.
   */
  public isOptionAvailable(option: DialogueOption, rel: NpcRelationship): boolean {
    if (option.requiredTier && !isTierSufficient(rel.tier, option.requiredTier)) {
      return false;
    }

    if (option.requiredFavor && !rel.favorsCompleted.has(option.requiredFavor)) {
      return false;
    }

    if (option.requiredTopic && !rel.knownTopics.has(option.requiredTopic)) {
      return false;
    }

    if (option.condition && !option.condition(rel, this)) {
      return false;
    }

    return true;
  }

  /**
   * Zwraca listę opcji dostępnych dla aktualnego węzła po ewaluacji warunków.
   */
  public getAvailableOptions(): DialogueOption[] {
    if (!this.currentNode || !this.currentNpcId) {
      return [];
    }

    const rel = this.relationships.getRelationship(this.currentNpcId);
    return this.currentNode.options.filter((opt) => this.isOptionAvailable(opt, rel));
  }

  /**
   * Wybiera opcję o podanym indeksie z listy DOSTĘPNYCH opcji.
   * Wykonuje powiązane akcje i przechodzi do kolejnego węzła.
   */
  public selectOption(index: number): DialogueNode | null {
    if (!this.isDialogueActive() || !this.currentNode || !this.currentNpcId || !this.activeTree) {
      return null;
    }

    const availableOptions = this.getAvailableOptions();
    if (index < 0 || index >= availableOptions.length) {
      return null;
    }

    const selectedOption = availableOptions[index];
    const rel = this.relationships.getRelationship(this.currentNpcId);

    // Aktualizacja historii z etykietą wybranej opcji
    if (this.history.length > 0) {
      const lastEntry = this.history[this.history.length - 1];
      if (lastEntry && !lastEntry.selectedOptionLabel) {
        lastEntry.selectedOptionLabel = selectedOption.label;
      }
    }

    // Wykonanie skutków deklaratywnych
    if (selectedOption.assignFavor) {
      this.assignFavor(selectedOption.assignFavor);
    }

    if (selectedOption.unlockClue) {
      this.unlockClue(selectedOption.unlockClue);
    }

    if (selectedOption.learnTopic) {
      rel.knownTopics.add(selectedOption.learnTopic);
    }

    if (selectedOption.completeFavor) {
      this.relationships.completeFavor(
        this.currentNpcId,
        selectedOption.completeFavor,
        selectedOption.rewardScore ?? 25,
      );
    } else if (selectedOption.rewardScore) {
      this.relationships.recordInteraction(
        this.currentNpcId,
        'dialogue_choice',
        selectedOption.rewardScore,
        selectedOption.learnTopic,
        { force: true },
      );
    }

    // Wykonanie dedykowanej akcji węzła
    if (selectedOption.action) {
      selectedOption.action(rel, this);
    }

    // Sprawdzenie zakończenia dialogu
    if (selectedOption.isEnd || selectedOption.nextNodeId === null) {
      this.endDialogue();
      return null;
    }

    // Przejście do następnego węzła
    const nextNode = this.activeTree.nodes[selectedOption.nextNodeId];
    if (!nextNode) {
      this.endDialogue();
      return null;
    }

    this.currentNode = nextNode;
    if (nextNode.onEnter) {
      nextNode.onEnter(rel, this);
    }

    this.recordNodeInHistory(nextNode);

    // Jeśli węzeł docelowy jest węzłem końcowym i nie ma opcji, dialog dobiega końca
    if (nextNode.isEnd && nextNode.options.length === 0) {
      const finishedNode = nextNode;
      this.activeTree = null;
      this.currentNode = null;
      this.currentNpcId = null;
      return finishedNode;
    }

    return nextNode;
  }

  /**
   * Kończy bieżący dialog.
   */
  public endDialogue(): void {
    this.activeTree = null;
    this.currentNode = null;
    this.currentNpcId = null;
  }

  /**
   * Zwraca historię bieżącej konwersacji.
   */
  public getDialogueHistory(): DialogueHistoryEntry[] {
    return [...this.history];
  }

  private recordNodeInHistory(node: DialogueNode): void {
    this.history.push({
      nodeId: node.id,
      speakerId: node.speakerId,
      speakerName: node.speakerName,
      text: node.text,
      timestamp: Date.now(),
    });
  }

  // --- Przysługi i Wskazówki ---

  public isFavorAssigned(favorId: string): boolean {
    return this.assignedFavors.has(favorId);
  }

  public assignFavor(favorId: string): void {
    this.assignedFavors.add(favorId);
    this.saveState();
  }

  public hasClue(clueId: string): boolean {
    return this.unlockedClues.has(clueId);
  }

  public unlockClue(clueId: string): void {
    this.unlockedClues.add(clueId);
    this.saveState();
  }

  public getAssignedFavors(): string[] {
    return Array.from(this.assignedFavors);
  }

  public getUnlockedClues(): string[] {
    return Array.from(this.unlockedClues);
  }

  // --- Walidacja grafu dialogowego ---

  /**
   * Weryfikuje poprawność grafu dialogowego (osiągalność, ślepe zaułki, poprawność referencji, cykle).
   */
  public validateTree(tree: DialogueTree): TreeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Sprawdzenie węzła początkowego
    if (!tree.nodes[tree.rootNodeId]) {
      errors.push(`Węzeł początkowy rootNodeId "${tree.rootNodeId}" nie istnieje w drzewie "${tree.id}".`);
    }

    // 2. Sprawdzenie poprawności referencji w opcjach oraz ślepych zaułków
    const deadEndNodeIds: string[] = [];
    for (const [nodeId, node] of Object.entries(tree.nodes)) {
      if (node.options.length === 0 && !node.isEnd) {
        deadEndNodeIds.push(nodeId);
        warnings.push(`Węzeł "${nodeId}" nie posiada opcji wyboru ani flagi isEnd.`);
      }

      for (const [idx, opt] of node.options.entries()) {
        if (!opt.isEnd && opt.nextNodeId !== null) {
          if (!tree.nodes[opt.nextNodeId]) {
            errors.push(
              `Węzeł "${nodeId}" w opcji [${idx}] ("${opt.label}") odwołuje się do nieistniejącego nextNodeId "${opt.nextNodeId}".`,
            );
          }
        }
      }
    }

    // 3. Sprawdzenie osiągalności węzłów (BFS z rootNodeId)
    const reachable = new Set<string>();
    if (tree.nodes[tree.rootNodeId]) {
      const queue = [tree.rootNodeId];
      reachable.add(tree.rootNodeId);

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currNode = tree.nodes[currId];
        if (!currNode) continue;

        for (const opt of currNode.options) {
          if (opt.nextNodeId && !reachable.has(opt.nextNodeId) && tree.nodes[opt.nextNodeId]) {
            reachable.add(opt.nextNodeId);
            queue.push(opt.nextNodeId);
          }
        }
      }
    }

    const unreachableNodeIds: string[] = [];
    for (const nodeId of Object.keys(tree.nodes)) {
      if (!reachable.has(nodeId)) {
        unreachableNodeIds.push(nodeId);
        warnings.push(`Węzeł "${nodeId}" jest nieosiągalny z węzła początkowego.`);
      }
    }

    // 4. Detekcja cykli (DFS)
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cyclePaths: string[][] = [];

    const detectCycles = (nodeId: string, currentPath: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      const nextPath = [...currentPath, nodeId];

      const node = tree.nodes[nodeId];
      if (node) {
        for (const opt of node.options) {
          if (opt.nextNodeId && tree.nodes[opt.nextNodeId]) {
            if (!visited.has(opt.nextNodeId)) {
              detectCycles(opt.nextNodeId, nextPath);
            } else if (recStack.has(opt.nextNodeId)) {
              cyclePaths.push([...nextPath, opt.nextNodeId]);
            }
          }
        }
      }

      recStack.delete(nodeId);
    };

    if (tree.nodes[tree.rootNodeId]) {
      detectCycles(tree.rootNodeId, []);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      unreachableNodeIds,
      deadEndNodeIds,
      hasCycles: cyclePaths.length > 0,
      cyclePaths: cyclePaths.length > 0 ? cyclePaths : undefined,
    };
  }

  // --- Trwałość stanu i reset ---

  public saveState(): boolean {
    if (!this.storage) return false;
    try {
      const state: DialogueStateStorageV1 = {
        version: 1,
        savedAt: Date.now(),
        assignedFavors: Array.from(this.assignedFavors),
        unlockedClues: Array.from(this.unlockedClues),
      };
      this.storage.setItem(this.storageKey, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  public loadState(): boolean {
    if (!this.storage) return false;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return false;
      const data = JSON.parse(raw) as Partial<DialogueStateStorageV1>;
      if (Array.isArray(data.assignedFavors)) {
        this.assignedFavors = new Set(data.assignedFavors);
      }
      if (Array.isArray(data.unlockedClues)) {
        this.unlockedClues = new Set(data.unlockedClues);
      }
      return true;
    } catch {
      return false;
    }
  }

  public resetState(): void {
    this.endDialogue();
    this.assignedFavors.clear();
    this.unlockedClues.clear();
    this.history = [];
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {}
    }
  }

  // --- Domyślne kanoniczne drzewa dialogowe ---

  private registerDefaultTrees(): void {
    this.registerDialogueTree(createWieslawDialogueTree());
    this.registerDialogueTree(createAniaDialogueTree());
    this.registerDialogueTree(createMatiDialogueTree());
    this.registerDialogueTree(createJurekDialogueTree());
    this.registerDialogueTree(createJanDialogueTree());
    this.registerDialogueTree(createKubaDialogueTree());
  }
}

/**
 * Kanoniczne drzewo dialogowe dla Wiesława (woodstock_wieslaw).
 * Obejmuje pełen wątek fabularny: od obcego, przez przysługę odnalezienia bandany,
 * po zaufanego weterana ze wspomnieniami z Jarocina.
 */
export function createWieslawDialogueTree(): DialogueTree {
  return {
    id: 'tree_woodstock_wieslaw_main',
    npcId: 'woodstock_wieslaw',
    title: 'Wiesław - Opowieści weterana i zgubiona bandana',
    rootNodeId: 'wieslaw_root',
    nodes: {
      wieslaw_root: {
        id: 'wieslaw_root',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: 'Siemanko! Kurz spod sceny opada, glany całe, a muzyka gra. O czym chcesz pogadać ze starym wyjadaczem?',
        options: [
          {
            label: 'Cześć! Pierwszy raz jestem na festiwalu, jak tu nie zginąć?',
            nextNodeId: 'wieslaw_porady',
            rewardScore: 10,
            learnTopic: 'glany',
          },
          {
            label: "Słyszałem, że pamiętasz jeszcze Jarocin '88?",
            nextNodeId: 'wieslaw_jarocin',
            rewardScore: 15,
            learnTopic: 'woodstock_88',
          },
          {
            label: 'Wiesław, widzę że czymś się martwisz. Co się stało?',
            nextNodeId: 'wieslaw_zguba_intro',
            requiredTier: 'kojarzy',
          },
          {
            label: 'Wiesław! Mam twoją czerwoną bandanę, leżała pod nagłośnieniem!',
            nextNodeId: 'wieslaw_nagroda_bandana',
            condition: (rel, mgr) =>
              mgr.isFavorAssigned('wieslaw_znajdz_bandane') &&
              !rel.favorsCompleted.has('wieslaw_znajdz_bandane'),
          },
          {
            label: 'Wiesław, zdradzisz mi sekret starej gwardii festiwalowej?',
            nextNodeId: 'wieslaw_sekret',
            requiredTier: 'zaufany',
          },
          {
            label: 'Dzięki za rozmowę, lecę pod scenę!',
            nextNodeId: 'wieslaw_zegnaj',
            isEnd: true,
          },
        ],
      },

      wieslaw_porady: {
        id: 'wieslaw_porady',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: 'Zasada numer jeden: zawiąż glany na podwójny węzeł. Jak wpadniesz w młyn pod sceną, nikt ci buta nie odda! I pij dużo wody, słońce nie wybacza.',
        options: [
          {
            label: 'Dzięki za radę, będę pamiętał!',
            nextNodeId: 'wieslaw_root',
          },
        ],
      },

      wieslaw_jarocin: {
        id: 'wieslaw_jarocin',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: "Jarocin '88... to były czasy! Deszcz, kurz, magnetofony kasetowe i czysty bunt w sercu. Dzisiaj w Czaplinku jest ta sama wolność, tylko nagłośnienie o niebo lepsze!",
        options: [
          {
            label: 'Niesamowita historia, czuć ducha wolności.',
            nextNodeId: 'wieslaw_root',
          },
        ],
      },

      wieslaw_zguba_intro: {
        id: 'wieslaw_zguba_intro',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: 'Ech, młody... moja czerwona bandana z autografami ze starych Żar. Zgubiłem ją pod Małą Sceną przy wieży dźwiękowej. Ma dla mnie wartość sentymentalną.',
        options: [
          {
            label: 'Pomogę ci jej poszukać, rozejrzę się przy Małej Scenie!',
            nextNodeId: 'wieslaw_zguba_przyjeta',
            assignFavor: 'wieslaw_znajdz_bandane',
            rewardScore: 10,
          },
          {
            label: 'Szkoda, ale mam zaraz koncert na Dużej Scenie, nie dam rady.',
            nextNodeId: 'wieslaw_zguba_odmowa',
          },
        ],
      },

      wieslaw_zguba_przyjeta: {
        id: 'wieslaw_zguba_przyjeta',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: 'Dzięki wielkie brachu! Będę czekał przy tym namiocie. Uważaj pod sceną!',
        options: [
          {
            label: 'Lecę szukać!',
            nextNodeId: 'wieslaw_root',
          },
        ],
      },

      wieslaw_zguba_odmowa: {
        id: 'wieslaw_zguba_odmowa',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: 'Spokojnie brachu, muzyka najważniejsza! Jak skończysz pogo, zawsze możesz wrócić. Dobrej zabawy pod sceną!',
        options: [
          {
            label: 'Trzymaj się, Wiesław!',
            nextNodeId: 'wieslaw_root',
          },
        ],
      },

      wieslaw_nagroda_bandana: {
        id: 'wieslaw_nagroda_bandana',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: 'Nie wierzę! Moja bandana! Ty to jesteś prawdziwy festiwalowicz z krwi i kości. Od teraz jesteś swój człowiek w obozie starej gwardii!',
        options: [
          {
            label: 'Cieszę się, że mogłem pomóc!',
            nextNodeId: 'wieslaw_root',
            completeFavor: 'wieslaw_znajdz_bandane',
            rewardScore: 35,
            learnTopic: 'stara_gwardia',
            unlockClue: 'wieslaw_sekretne_przejscie',
          },
        ],
      },

      wieslaw_sekret: {
        id: 'wieslaw_sekret',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: "Posłuchaj uważnie: za wzgórzem ASP, przy starym dębie, jest najspokojniejszy punkt obserwacyjny na cały pas startowy. Gdy zachodzi słońce, widać stamtąd całą magię Pol'and'Rocka.",
        options: [
          {
            label: 'Zapamiętam to miejsce. Do zobaczenia!',
            nextNodeId: 'wieslaw_root',
            unlockClue: 'punkt_widokowy_asp',
          },
        ],
      },

      wieslaw_zegnaj: {
        id: 'wieslaw_zegnaj',
        speakerId: 'woodstock_wieslaw',
        speakerName: 'Wiesław',
        text: 'Na razie! Trzymaj fason i uważaj na pogo!',
        options: [],
        isEnd: true,
      },
    },
  };
}

/**
 * Kanoniczne drzewo dialogowe dla Ani z Pokojowego Patrolu.
 */
export function createAniaDialogueTree(): DialogueTree {
  return {
    id: 'tree_pokojowy_patrol_ania_main',
    npcId: 'pokojowy_patrol_ania',
    title: 'Ania - Pokojowy Patrol i bezpieczeństwo',
    rootNodeId: 'ania_root',
    nodes: {
      ania_root: {
        id: 'ania_root',
        speakerId: 'pokojowy_patrol_ania',
        speakerName: 'Ania z Patrolu',
        text: 'Cześć! Pokojowy Patrol czuwa. Potrzebujesz pomocy medycznej, szukasz wody czy chcesz pomóc festiwalowiczom?',
        options: [
          {
            label: 'Gdzie znajdę najbliższą wodę pitną i punkt medyczny?',
            nextNodeId: 'ania_info_woda',
            rewardScore: 10,
            learnTopic: 'punkt_medyczny',
          },
          {
            label: 'Mogę w czymś pomóc Pokojowemu Patrolowi?',
            nextNodeId: 'ania_quest_powerbank',
            requiredTier: 'kojarzy',
          },
          {
            label: 'Aniu, odnalazłem ten zgubiony żółty powerbank!',
            nextNodeId: 'ania_nagroda_powerbank',
            condition: (rel, mgr) =>
              mgr.isFavorAssigned('ania_znajdz_powerbank') &&
              !rel.favorsCompleted.has('ania_znajdz_powerbank'),
          },
          {
            label: 'Chcę wziąć udział w Quizie Patrolu!',
            nextNodeId: 'ania_quiz_start',
          },
          {
            label: 'Dzięki za waszą służbę, do zobaczenia!',
            nextNodeId: 'ania_zegnaj',
            isEnd: true,
          },
        ],
      },

      ania_info_woda: {
        id: 'ania_info_woda',
        speakerId: 'pokojowy_patrol_ania',
        speakerName: 'Ania z Patrolu',
        text: 'Główny grzybek z darmową wodą jest na środku pasażu, a nasz szpital polowy i punkty pierwszej pomocy są oznaczone wielkimi czerwonymi balonami.',
        options: [
          {
            label: 'Świetnie, dziękuję za informację!',
            nextNodeId: 'ania_root',
          },
        ],
      },

      ania_quest_powerbank: {
        id: 'ania_quest_powerbank',
        speakerId: 'pokojowy_patrol_ania',
        speakerName: 'Ania z Patrolu',
        text: 'Ktoś zgłosił zagubienie żółtego powerbanka przy barierkach Dużej Sceny. Jeśli na niego trafisz, odnieś go do nas lub biura rzeczy znalezionych.',
        options: [
          {
            label: 'Jasne, będę miał oczy szeroko otwarte!',
            nextNodeId: 'ania_root',
            assignFavor: 'ania_znajdz_powerbank',
            rewardScore: 10,
          },
          {
            label: 'Teraz biegnę na spotkanie, ale będę pamiętać.',
            nextNodeId: 'ania_root',
          },
        ],
      },

      ania_nagroda_powerbank: {
        id: 'ania_nagroda_powerbank',
        speakerId: 'pokojowy_patrol_ania',
        speakerName: 'Ania z Patrolu',
        text: 'Wspaniale! Właściciel bardzo się ucieszy. Jesteś wzorowym festiwalowiczem!',
        options: [
          {
            label: 'Zawsze chętnie pomogę!',
            nextNodeId: 'ania_root',
            completeFavor: 'ania_znajdz_powerbank',
            rewardScore: 30,
            learnTopic: 'bezpieczenstwo',
            unlockClue: 'odznaka_przyjaciel_patrolu',
          },
        ],
      },

      ania_quiz_start: {
        id: 'ania_quiz_start',
        speakerId: 'pokojowy_patrol_ania',
        speakerName: 'Ania z Patrolu',
        text: 'Wspaniale! Pokojowy Patrol przygotował 5 pytań o bezpieczeństwie i zasadach festiwalu. Zmierz się z nimi i zdobądź pieczątkę!',
        options: [
          {
            label: 'Rozpocznij Quiz Patrolu',
            nextNodeId: 'ania_quiz_active',
            assignFavor: 'quiz_patrolu',
          },
          {
            label: 'Może później, dzięki!',
            nextNodeId: 'ania_root',
          },
        ],
      },

      ania_quiz_active: {
        id: 'ania_quiz_active',
        speakerId: 'pokojowy_patrol_ania',
        speakerName: 'Ania z Patrolu',
        text: 'Powodzenia! Wybierz poprawną odpowiedź:',
        options: [
          {
            label: 'Wróć do rozmowy',
            nextNodeId: 'ania_root',
          },
        ],
      },

      ania_zegnaj: {
        id: 'ania_zegnaj',
        speakerId: 'pokojowy_patrol_ania',
        speakerName: 'Ania z Patrolu',
        text: 'Uważaj na siebie i baw się bezpiecznie!',
        options: [],
        isEnd: true,
      },
    },
  };
}

/**
 * Kanoniczne drzewo dialogowe dla Matiego (flanki_mistrz_mati).
 */
export function createMatiDialogueTree(): DialogueTree {
  return {
    id: 'tree_flanki_mistrz_mati_main',
    npcId: 'flanki_mistrz_mati',
    title: 'Mati - Mistrz Flanek',
    rootNodeId: 'mati_root',
    nodes: {
      mati_root: {
        id: 'mati_root',
        speakerId: 'flanki_mistrz_mati',
        speakerName: 'Mati Mistrz Flanek',
        text: 'Siemanko zawodniku! Flanki na pasie startowym to dyscyplina królewska. Rzucasz czy tylko patrzysz?',
        options: [
          {
            label: 'Jakie są święte zasady gry we Flanki?',
            nextNodeId: 'mati_zasady',
            rewardScore: 10,
            learnTopic: 'zasady_flanek',
          },
          {
            label: 'Rzućmy partyjkę treningową!',
            nextNodeId: 'mati_trening',
            requiredTier: 'kojarzy',
          },
          {
            label: 'Na razie poobserwuję mistrza, cześć!',
            nextNodeId: 'mati_zegnaj',
            isEnd: true,
          },
        ],
      },

      mati_zasady: {
        id: 'mati_zasady',
        speakerId: 'flanki_mistrz_mati',
        speakerName: 'Mati Mistrz Flanek',
        text: 'Puszka na środku, stoisz za linią. Rzut kamieniem lub butelką. Jak trafisz – twoja drużyna pije, dopóki przeciwnicy nie postawią puszki i nie wrócą za linię. Czysty sport!',
        options: [
          {
            label: 'Brzmi prosto i dynamicznie!',
            nextNodeId: 'mati_root',
          },
        ],
      },

      mati_trening: {
        id: 'mati_trening',
        speakerId: 'flanki_mistrz_mati',
        speakerName: 'Mati Mistrz Flanek',
        text: 'Dobra! Puszka stoi 10 metrów stąd. Chwytasz kamień, celujesz w dolną krawędź...',
        options: [
          {
            label: 'Rzucam precyzyjnie prosto w puszkę!',
            nextNodeId: 'mati_sukces',
            completeFavor: 'mati_trening_flanki',
            rewardScore: 25,
            learnTopic: 'technika_rzutu',
          },
          {
            label: 'Rzucam za mocno i pudłuję!',
            nextNodeId: 'mati_pudlo',
          },
        ],
      },

      mati_sukces: {
        id: 'mati_sukces',
        speakerId: 'flanki_mistrz_mati',
        speakerName: 'Mati Mistrz Flanek',
        text: 'BUM! Puszka w powietrzu! Piękny rzut, masz zadatki na mistrza obozu namiotowego!',
        options: [
          {
            label: 'Dzięki Mati, dobra szkoła!',
            nextNodeId: 'mati_root',
          },
        ],
      },

      mati_pudlo: {
        id: 'mati_pudlo',
        speakerId: 'flanki_mistrz_mati',
        speakerName: 'Mati Mistrz Flanek',
        text: 'Za dużo siły, za mało rotacji! Spokojnie, we Flankach liczy się spokój. Potrenujemy jeszcze.',
        options: [
          {
            label: 'Wrócę do tego później!',
            nextNodeId: 'mati_root',
          },
        ],
      },

      mati_zegnaj: {
        id: 'mati_zegnaj',
        speakerId: 'flanki_mistrz_mati',
        speakerName: 'Mati Mistrz Flanek',
        text: 'Trzymaj się i celnego rzutu!',
        options: [],
        isEnd: true,
      },
    },
  };
}

/**
 * Kanoniczne drzewo dialogowe dla Jurka Owsiaka (jurek).
 */
export function createJurekDialogueTree(): DialogueTree {
  return {
    id: 'tree_jurek_main',
    npcId: 'jurek',
    title: 'Jurek Owsiak - Dyrygent Festiwalu',
    rootNodeId: 'jurek_root',
    nodes: {
      jurek_root: {
        id: 'jurek_root',
        speakerId: 'jurek',
        speakerName: 'Jurek Owsiak',
        text: 'Siemanko! Witaj na Najpiękniejszym Festiwalu Świata! Miłość, Przyjaźń, Muzyka! Jak ci mija ten piękny czas?',
        options: [
          {
            label: 'Jurku, co jest najważniejsze w tej edycji festiwalu?',
            nextNodeId: 'jurek_przeslanie',
            rewardScore: 15,
            learnTopic: 'wosp',
          },
          {
            label: 'Jurku, opowiesz o tradycji odgwizdania startu ze stacji?',
            nextNodeId: 'jurek_gwizdek',
            requiredTier: 'znajomy',
          },
          {
            label: 'Lecę pod Dużą Scenę, zaraz grają!',
            nextNodeId: 'jurek_zegnaj',
            isEnd: true,
          },
        ],
      },

      jurek_przeslanie: {
        id: 'jurek_przeslanie',
        speakerId: 'jurek',
        speakerName: 'Jurek Owsiak',
        text: 'Żebyśmy byli dla siebie dobrzy! Żeby nikt nikogo nie oceniał, żebyśmy tworzyli razem tę niezwykłą społeczność wzajemnego szacunku i wolności!',
        options: [
          {
            label: 'Piękne słowa Jurku, czuć tę energię w każdym kącie lotniska!',
            nextNodeId: 'jurek_root',
          },
        ],
      },

      jurek_gwizdek: {
        id: 'jurek_gwizdek',
        speakerId: 'jurek',
        speakerName: 'Jurek Owsiak',
        text: 'Ten tradycyjny kolejowy gwizdek to symbol podróży pokoleń na ten festiwal. Kiedy rozbrzmiewa ze stacji, wszyscy wiemy: zaczynamy kolejne najpiękniejsze dni w roku!',
        options: [
          {
            label: 'To wzruszająca tradycja. Dziękuję za wszystko!',
            nextNodeId: 'jurek_root',
            rewardScore: 20,
            learnTopic: 'historia_festiwalu',
            unlockClue: 'legenda_kolejowego_gwizdka',
          },
        ],
      },

      jurek_zegnaj: {
        id: 'jurek_zegnaj',
        speakerId: 'jurek',
        speakerName: 'Jurek Owsiak',
        text: 'Bądźcie bezpieczni i cieszcie się każdą nutą!',
        options: [],
        isEnd: true,
      },
    },
  };
}

/**
 * Kanoniczne drzewo dialogowe dla Jana z Kuchni Kryszny (krysznowiec_jan).
 */
export function createJanDialogueTree(): DialogueTree {
  return {
    id: 'tree_krysznowiec_jan_main',
    npcId: 'krysznowiec_jan',
    title: 'Jan - Pokojowa Kuchnia Kryszny',
    rootNodeId: 'jan_root',
    nodes: {
      jan_root: {
        id: 'jan_root',
        speakerId: 'krysznowiec_jan',
        speakerName: 'Jan z Kuchni Kryszny',
        text: 'Hare Kryszna, bracie! Pusty żołądek to zły kompan pod sceną. Zjedz ciepły dhal z ryżem i napij się herbaty!',
        options: [
          {
            label: 'Z czego robicie ten pachnący dhal?',
            nextNodeId: 'jan_przepis',
            rewardScore: 15,
            learnTopic: 'prasadam',
          },
          {
            label: 'Mogę pomóc wam przy kuchni?',
            nextNodeId: 'jan_pomoc',
            requiredTier: 'kojarzy',
          },
          {
            label: 'Dziękuję za ciepły posiłek, idę dalej!',
            nextNodeId: 'jan_zegnaj',
            isEnd: true,
          },
        ],
      },

      jan_przepis: {
        id: 'jan_przepis',
        speakerId: 'krysznowiec_jan',
        speakerName: 'Jan z Kuchni Kryszny',
        text: 'Żółta soczewica, kumin, imbir, kurkuma i mnóstwo serca włożonego w mieszanie wielkiego kotła! Prasadam daje siłę na całą noc tańców.',
        options: [
          {
            label: 'Pachnie wspaniale, na pewno wrócę po dokładkę.',
            nextNodeId: 'jan_root',
          },
        ],
      },

      jan_pomoc: {
        id: 'jan_pomoc',
        speakerId: 'krysznowiec_jan',
        speakerName: 'Jan z Kuchni Kryszny',
        text: 'Mamy brak rąk do przyniesienia świeżej wody z punktu czerpalnego do garnków. Pomożesz nam z jednym baniakiem?',
        options: [
          {
            label: 'Jasne, przyniosę wodę z punktu!',
            nextNodeId: 'jan_pomoc_sukces',
            completeFavor: 'jan_przynies_wode',
            rewardScore: 25,
            learnTopic: 'pokojowa_kuchnia',
          },
          {
            label: 'Niestety muszę biec, ale dziękuję za jedzenie!',
            nextNodeId: 'jan_root',
          },
        ],
      },

      jan_pomoc_sukces: {
        id: 'jan_pomoc_sukces',
        speakerId: 'krysznowiec_jan',
        speakerName: 'Jan z Kuchni Kryszny',
        text: 'Dziękujemy z całego serca! Niech pokój i radość towarzyszą ci przez cały festiwal!',
        options: [
          {
            label: 'Pokój z wami!',
            nextNodeId: 'jan_root',
          },
        ],
      },

      jan_zegnaj: {
        id: 'jan_zegnaj',
        speakerId: 'krysznowiec_jan',
        speakerName: 'Jan z Kuchni Kryszny',
        text: 'Pokój twojemu sercu!',
        options: [],
        isEnd: true,
      },
    },
  };
}

/**
 * Kanoniczne drzewo dialogowe dla Kuby z Eko Patrolu (eko_wolontariusz_kuba).
 */
export function createKubaDialogueTree(): DialogueTree {
  return {
    id: 'tree_eko_wolontariusz_kuba_main',
    npcId: 'eko_wolontariusz_kuba',
    title: 'Kuba Eko - Czyste Pole i Recykling',
    rootNodeId: 'kuba_root',
    nodes: {
      kuba_root: {
        id: 'kuba_root',
        speakerId: 'eko_wolontariusz_kuba',
        speakerName: 'Kuba Eko',
        text: 'Cześć! Zostawiamy to lotnisko tak czyste, jak je zastaliśmy. Chcesz pomóc w akcji czystego pola?',
        options: [
          {
            label: 'Jak prowadzicie zbiórkę puszek i plastiku?',
            nextNodeId: 'kuba_zasady',
            rewardScore: 10,
            learnTopic: 'recykling',
          },
          {
            label: 'Daj mi zielony worek, pozbieram puszki w naszym sektorze!',
            nextNodeId: 'kuba_worek',
            assignFavor: 'kuba_zbierz_puszki',
            rewardScore: 10,
          },
          {
            label: 'Kuba, przyniosłem pełny worek zebranych puszek!',
            nextNodeId: 'kuba_nagroda',
            condition: (rel, mgr) =>
              mgr.isFavorAssigned('kuba_zbierz_puszki') && !rel.favorsCompleted.has('kuba_zbierz_puszki'),
          },
          {
            label: 'Powodzenia ze sprzątaniem, do zobaczenia!',
            nextNodeId: 'kuba_zegnaj',
            isEnd: true,
          },
        ],
      },

      kuba_zasady: {
        id: 'kuba_zasady',
        speakerId: 'eko_wolontariusz_kuba',
        speakerName: 'Kuba Eko',
        text: 'Rozdajemy worki, zbieramy puszki aluminiowe, butelki PET i kapsle. Za pełny worek puszek rozdajemy festiwalowe koszulki i gadżety!',
        options: [
          {
            label: 'Super inicjatywa, lotnisko zasługuje na szacunek.',
            nextNodeId: 'kuba_root',
          },
        ],
      },

      kuba_worek: {
        id: 'kuba_worek',
        speakerId: 'eko_wolontariusz_kuba',
        speakerName: 'Kuba Eko',
        text: 'Oto twój zielony worek! Zbierz puszki wokół swojego namiotu i przynieś tutaj.',
        options: [
          {
            label: 'Biorę się do roboty!',
            nextNodeId: 'kuba_root',
          },
        ],
      },

      kuba_nagroda: {
        id: 'kuba_nagroda',
        speakerId: 'eko_wolontariusz_kuba',
        speakerName: 'Kuba Eko',
        text: 'Wielkie brawa! Kawał dobrej roboty dla planety i całego festiwalu! Masz u nas pełen szacunek!',
        options: [
          {
            label: 'Czyste pole to podstawa!',
            nextNodeId: 'kuba_root',
            completeFavor: 'kuba_zbierz_puszki',
            rewardScore: 30,
            learnTopic: 'czyste_pole',
          },
        ],
      },

      kuba_zegnaj: {
        id: 'kuba_zegnaj',
        speakerId: 'eko_wolontariusz_kuba',
        speakerName: 'Kuba Eko',
        text: 'Nie rzucaj puszek w trawę i miłej zabawy!',
        options: [],
        isEnd: true,
      },
    },
  };
}
