export const SONG_GENERATION_MODEL_IDS = [
	"accounts/fireworks/models/minimax-m2p5",
	"accounts/fireworks/models/kimi-k2p5",
	"accounts/fireworks/models/glm-5",
] as const;

export type SongGenerationModelId = (typeof SONG_GENERATION_MODEL_IDS)[number];

export const DEFAULT_SONG_GENERATION_MODEL_ID: SongGenerationModelId =
	"accounts/fireworks/models/minimax-m2p5";

export function isSongGenerationModelId(
	value: string,
): value is SongGenerationModelId {
	return SONG_GENERATION_MODEL_IDS.includes(value as SongGenerationModelId);
}
