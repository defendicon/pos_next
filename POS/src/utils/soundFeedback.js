
let audioContext = null;

function initAudio() {
	if (!audioContext) {
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		if (AudioContext) {
			audioContext = new AudioContext();
		}
	}
}

export function playSuccessSound() {
	try {
		initAudio();
		if (!audioContext) return;

		if (audioContext.state === 'suspended') {
			audioContext.resume().catch(() => {});
		}

		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.type = 'sine';
		// A pleasant high pitch beep (e.g. 1000Hz)
		oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);

		// Envelope to avoid clicking
		gainNode.gain.setValueAtTime(0, audioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
		gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.start();
		oscillator.stop(audioContext.currentTime + 0.2);
	} catch (e) {
		console.error("Failed to play success sound", e);
	}
}

export function playErrorSound() {
	try {
		initAudio();
		if (!audioContext) return;

		if (audioContext.state === 'suspended') {
			audioContext.resume().catch(() => {});
		}

		// Use a triangle wave for a softer but still alerting sound
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.type = 'triangle';
		// Start slightly higher but drop quickly - classic UI error "bonk"
		oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
		oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);

		// Envelope
		gainNode.gain.setValueAtTime(0, audioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
		gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.start();
		oscillator.stop(audioContext.currentTime + 0.35);
	} catch (e) {
		console.error("Failed to play error sound", e);
	}
}
