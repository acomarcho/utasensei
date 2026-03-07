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

export const SONG_GENERATION_MODEL_IDS = SONG_GENERATION_MODEL_OPTIONS.map(
	(option) => option.id,
) as [
	(typeof SONG_GENERATION_MODEL_OPTIONS)[number]["id"],
	...(typeof SONG_GENERATION_MODEL_OPTIONS)[number]["id"][],
];

export type SongGenerationModelId =
	(typeof SONG_GENERATION_MODEL_OPTIONS)[number]["id"];

export const SONG_GENERATION_MODEL_ALIASES = [
	"minimax-m2p5",
	"kimi-k2p5",
	"glm-5",
] as const;

export type SongGenerationModelAlias =
	(typeof SONG_GENERATION_MODEL_ALIASES)[number];

const SONG_GENERATION_MODEL_ID_BY_ALIAS: Record<
	SongGenerationModelAlias,
	SongGenerationModelId
> = {
	"glm-5": "accounts/fireworks/models/glm-5",
	"kimi-k2p5": "accounts/fireworks/models/kimi-k2p5",
	"minimax-m2p5": "accounts/fireworks/models/minimax-m2p5",
};

export const DEFAULT_SONG_GENERATION_MODEL_ID: SongGenerationModelId =
	"accounts/fireworks/models/glm-5";

export function isSongGenerationModelId(
	value: string,
): value is SongGenerationModelId {
	return SONG_GENERATION_MODEL_IDS.includes(value as SongGenerationModelId);
}

export function isSongGenerationModelAlias(
	value: string,
): value is SongGenerationModelAlias {
	return SONG_GENERATION_MODEL_ALIASES.includes(
		value as SongGenerationModelAlias,
	);
}

export function parseSongGenerationModelId(
	value: string,
): SongGenerationModelId | null {
	if (isSongGenerationModelId(value)) {
		return value;
	}

	if (isSongGenerationModelAlias(value)) {
		return SONG_GENERATION_MODEL_ID_BY_ALIAS[value];
	}

	return null;
}
