import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from "expo-audio";

const sources: Record<string, AudioSource> = {
  wordPop: require("../../assets/sounds/word-pop.wav"),
  transition: require("../../assets/sounds/transition.wav"),
  complete: require("../../assets/sounds/complete.wav"),
};

let initialized = false;

export async function initializeSounds() {
  if (initialized) return;
  initialized = true;

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    });
  } catch {
    // Silent failure — audio is non-critical
  }
}

function play(source: AudioSource) {
  try {
    const player = createAudioPlayer(source);
    player.play();
  } catch {
    // Silent failure
  }
}

export function playWordPop() {
  play(sources.wordPop);
}

export function playTransition() {
  play(sources.transition);
}

export function playComplete() {
  play(sources.complete);
}
