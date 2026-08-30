export class SpeakerAudio{
 private audio:HTMLAudioElement;private playing=false;
 constructor(url:string){this.audio=new Audio(url);this.audio.loop=true;this.audio.preload='metadata';this.audio.volume=.48}
 async toggle(){if(this.playing){this.audio.pause();this.playing=false;return false}try{await this.audio.play();this.playing=true;return true}catch{this.playing=false;return false}}
 dispose(){this.audio.pause();this.audio.src=''}
}
