export const SONG_GENERATION_MODEL_OPTIONS = [
	{
		id: "accounts/fireworks/models/minimax-m2p5",
		label: "Minimax M2.5",
	},
	{
		id: "accounts/fireworks/models/kimi-k2p5",
		label: "Kimi K2.5",
	},
	{
		id: "accounts/fireworks/models/glm-5",
		label: "GLM-5",
	},
] as const;

export type SongGenerationModelId =
	(typeof SONG_GENERATION_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_SONG_GENERATION_MODEL_ID: SongGenerationModelId =
	"accounts/fireworks/models/minimax-m2p5";

export function isSongGenerationModelId(
	value: string,
): value is SongGenerationModelId {
	return SONG_GENERATION_MODEL_OPTIONS.some((option) => option.id === value);
}
