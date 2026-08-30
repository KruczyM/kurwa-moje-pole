export type CharacterAsset={id:string;name:string;url:string;previewUrl?:string};
const url=(path:string)=>`/${path.split('/').map(encodeURIComponent).join('/')}`;
const characters:[string,string,string,string?][]=[
 ['amper','Amper','amper','assets/characters/amper/amper-animated.glb'],['antena','Antena','antena','assets/characters/antena2/antena.glb'],['gruczol','Gruczoł','gruczoł','assets/characters/gruczoł/gruczoł-animated.glb'],['klatwa','Klątwa','klątwa','assets/characters/klątwa2/klątwa.glb'],['krwiak','Krwiak','krwiak','assets/characters/krwiak/krwiak-animated.glb'],['pien','Pień','pień','assets/characters/peiń/peiń-animated.glb'],['pierscien','Pierścień','pierścień','assets/characters/pierścieć/pierścieć.glb'],['zawor','Zawór','zawór','assets/characters/zawór/zawór-animated.glb']
];
// Preview uses the stable first-generation animated GLBs. Pierścień is intentionally the only original-source preview.
export const characterAssets:CharacterAsset[]=characters.map(([id,name,animatedFolder,preview])=>({id,name,url:url(`assets/characters/meshy/${animatedFolder}/${animatedFolder}-mixamo-animations.glb`),previewUrl:preview?url(preview):undefined}));
export const environmentAssets={largeTent:url('assets/world/namiotduzy/głównyKolor.glb'),smallTent:url('assets/world/namiotmaly/namiot1.glb'),flag:url('assets/world/flaga/flaga.glb'),speaker:url('assets/accessories/gbl/gbl.glb')};
export const interactiveAssets={table:url('assets/interactables/table.glb'),joint:url('assets/interactables/joint.glb'),cocaine:url('assets/interactables/cocaine.glb'),mdma:url('assets/interactables/mdma.glb'),mushrooms:url('assets/interactables/mushrooms.glb'),lsd:url('assets/interactables/lsd.glb')};
export const musicAsset=url('assets/music/DOBRZE DOBRZE - Sfinks WEST SPEED PARTY.mp4');
