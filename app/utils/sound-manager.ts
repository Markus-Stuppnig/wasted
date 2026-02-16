import { Audio } from "expo-av";

const sounds: { wordPop: Audio.Sound | null; transition: Audio.Sound | null; complete: Audio.Sound | null } = {
  wordPop: null,
  transition: null,
  complete: null,
};

let initialized = false;

export async function initializeSounds() {
  if (initialized) return;
  initialized = true;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const [wordPop, transition, complete] = await Promise.all([
      Audio.Sound.createAsync(require("../../assets/sounds/word-pop.wav")),
      Audio.Sound.createAsync(require("../../assets/sounds/transition.wav")),
      Audio.Sound.createAsync(require("../../assets/sounds/complete.wav")),
    ]);

    sounds.wordPop = wordPop.sound;
    sounds.transition = transition.sound;
    sounds.complete = complete.sound;
  } catch {
    // Silent failure — audio is non-critical
  }
}

async function play(sound: Audio.Sound | null) {
  if (!sound) return;
  try {
    await sound.setPositionAsync(0);
    await sound.replayAsync();
  } catch {
    // Silent failure
  }
}

export function playWordPop() {
  play(sounds.wordPop);
}

export function playTransition() {
  play(sounds.transition);
}

export function playComplete() {
  play(sounds.complete);
}
