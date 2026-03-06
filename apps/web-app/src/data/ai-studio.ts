export type VocabularyEntry = {
	originalText: string;
	explanation: string;
};

export type SongLine = {
	lineIndex: number;
	originalText: string;
	translationText: string;
	longFormExplanation: string;
	vocabularies: VocabularyEntry[];
};

export type SongLesson = {
	song: {
		id: number;
		title: string;
		artist: string;
		createdAt: number;
	};
	run: {
		id: number;
		sourceUrl: string;
		modelId: string;
		createdAt: number;
	};
	lines: SongLine[];
};

export type MockFlashcard = {
	id: number;
	runId: number;
	front: string;
	back: string;
	sourceTranslationLineId: number;
	sourceVocabEntryId: number;
	createdAt: number;
};

const baseLines: SongLine[] = [
	{
		lineIndex: 0,
		originalText: "Tsudzuku, jikan no kakera",
		translationText: "Continuing, fragments of time",
		longFormExplanation:
			"Tsudzuku is a verb meaning 'to continue'. Jikan means 'time'. No is a particle connecting nouns, showing that kakera belongs to or is an attribute of jikan. Kakera means 'fragments' or 'pieces'. Together, this describes continuing fragments of time.",
		vocabularies: [
			{ originalText: "tsudzuku", explanation: "to continue" },
			{ originalText: "jikan", explanation: "time" },
			{
				originalText: "no",
				explanation: "particle connecting nouns (possessive/attribute)",
			},
			{ originalText: "kakera", explanation: "fragment, piece, shard" },
		],
	},
	{
		lineIndex: 1,
		originalText: "Wo atsumete iru tadou",
		translationText: "I'm gathering them, just so",
		longFormExplanation:
			"Wo is an object particle marking what is being gathered. Atsumete iru is the progressive form: atsumete is the te-form of atsumeru (to gather) and iru makes it ongoing action meaning 'am gathering'. Tadou here means 'just so' or 'truly' as an adverb.",
		vocabularies: [
			{ originalText: "wo", explanation: "object particle" },
			{
				originalText: "atsumete iru",
				explanation: "progressive form meaning 'am gathering' (from atsumeru)",
			},
			{ originalText: "tadou", explanation: "just so, truly" },
		],
	},
	{
		lineIndex: 2,
		originalText: 'Sugiru nouto no yohaku ni kaku "Kotae wa, itsu?"',
		translationText:
			'Writing in the margins of passing notebooks, "When is the answer?"',
		longFormExplanation:
			"Sugiru means 'passing by'. Nouto means 'notebook'. No shows possession. Yohaku means 'margins'. Ni is a location particle meaning 'in'. Kaku means 'write'. Kotae means 'answer'. Wa is the topic marker. Itsu means 'when'. The quoted question 'Kotae wa, itsu?' asks 'When is the answer?'",
		vocabularies: [
			{ originalText: "sugiru", explanation: "to pass by, to go beyond" },
			{ originalText: "nouto", explanation: "notebook" },
			{ originalText: "yohaku", explanation: "margin (blank space on page)" },
			{ originalText: "ni", explanation: "location particle meaning 'in/at'" },
			{ originalText: "kaku", explanation: "to write" },
			{ originalText: "kotae", explanation: "answer" },
			{ originalText: "itsu", explanation: "when" },
		],
	},
	{
		lineIndex: 3,
		originalText: "Ai wo hitotsu mata ne, mata ne",
		translationText: "One love, see you again, see you again",
		longFormExplanation:
			"Ai means 'love'. Wo marks love as the object. Hitotsu means 'one'. Mata ne is a casual phrase meaning 'see you again' or 'bye for now'. Repeated for emphasis, like saying goodbye to love over and over.",
		vocabularies: [
			{ originalText: "ai", explanation: "love" },
			{ originalText: "wo", explanation: "object particle" },
			{ originalText: "hitotsu", explanation: "one" },
			{ originalText: "mata ne", explanation: "see you again, bye for now" },
		],
	},
	{
		lineIndex: 4,
		originalText: "Yoru ni saku ondo to tomoru made",
		translationText: "Until the temperature that blooms at night lights up",
		longFormExplanation:
			"Yoru means 'night'. Ni indicates time 'at night'. Saku means 'bloom'. Ondo means 'temperature'. To means 'and' or 'with'. Tomoru means 'light up' or 'ignite'. Made means 'until'. This describes waiting until the warmth that blooms in darkness illuminates.",
		vocabularies: [
			{ originalText: "yoru", explanation: "night" },
			{ originalText: "saku", explanation: "to bloom" },
			{ originalText: "ondo", explanation: "temperature, warmth" },
			{ originalText: "tomoru", explanation: "to light up, to ignite" },
			{ originalText: "made", explanation: "until" },
		],
	},
	{
		lineIndex: 5,
		originalText: "Kokyuu hitotsu, ikiru, ikiru",
		translationText: "One breath, I live, I live",
		longFormExplanation:
			"Kokyuu means 'breath'. Hitotsu means 'one'. Ikiru means 'to live'. Repeated for emphasis. This expresses living one breath at a time, moment by moment.",
		vocabularies: [
			{ originalText: "kokyuu", explanation: "breath, breathing" },
			{ originalText: "hitotsu", explanation: "one" },
			{ originalText: "ikiru", explanation: "to live" },
		],
	},
	{
		lineIndex: 6,
		originalText: "Yasashii hibi no yoko de nakanu you ni, ah, ah",
		translationText: "So that I won't cry beside the gentle days, ah, ah",
		longFormExplanation:
			"Yasashii means 'gentle' or 'kind'. Hibi means 'days' (plural of hi, day). No shows possession. Yoko means 'side' or 'beside'. De marks location. Nakanu is a negative literary form meaning 'not cry' (related to nakanai). You ni means 'so that' or 'in order to', expressing purpose. The speaker wants to avoid crying while beside gentle days.",
		vocabularies: [
			{ originalText: "yasashii", explanation: "gentle, kind" },
			{ originalText: "hibi", explanation: "days (plural of hi)" },
			{ originalText: "yoko de", explanation: "beside, at the side of" },
			{
				originalText: "nakanu",
				explanation: "negative form meaning 'not cry'",
			},
			{
				originalText: "you ni",
				explanation: "so that, in order to (expresses purpose)",
			},
		],
	},
	{
		lineIndex: 7,
		originalText: "Honnori chiisana kanjou e",
		translationText: "To a slightly small emotion",
		longFormExplanation:
			"Honnori means 'slightly' or 'a little'. Chiisana means 'small' (adjective form). Kanjou means 'emotion' or 'feeling'. E is a directional particle meaning 'to' or 'toward'. This describes directing attention to a small emotion.",
		vocabularies: [
			{ originalText: "honnori", explanation: "slightly, a little" },
			{ originalText: "chiisana", explanation: "small (adjective)" },
			{ originalText: "kanjou", explanation: "emotion, feeling" },
			{
				originalText: "e",
				explanation: "directional particle meaning 'to/toward'",
			},
		],
	},
	{
		lineIndex: 8,
		originalText: "Nakanu you ni",
		translationText: "So that I won't cry",
		longFormExplanation:
			"Nakanu is a literary negative form meaning 'not cry', related to the common form nakanai. You ni expresses purpose: 'so that' or 'in order to'. Together, this phrase means doing something with the purpose of not crying.",
		vocabularies: [
			{
				originalText: "nakanu",
				explanation: "negative form meaning 'not cry' (literary style)",
			},
			{ originalText: "you ni", explanation: "so that, in order to" },
		],
	},
	{
		lineIndex: 9,
		originalText: "Chiitchana kotoba chikuchiku shita no",
		translationText: "Tiny words pricked and poked",
		longFormExplanation:
			"Chiitchana is a cute/diminutive form of chiisai, meaning 'tiny'. Kotoba means 'words'. Chikuchiku is onomatopoeia for pricking or poking sensations. Shita is the past tense of suru (to do). No is an explanatory particle adding emotional context. The words poked and prodded in the past.",
		vocabularies: [
			{
				originalText: "chiitchana",
				explanation: "tiny (cute form of chiisai)",
			},
			{ originalText: "kotoba", explanation: "words" },
			{ originalText: "chikuchiku", explanation: "pricking, poking sensation" },
			{ originalText: "shita", explanation: "did; past tense of suru" },
		],
	},
];

function createMockSongLesson(options: {
	id: number;
	title: string;
	artist: string;
	sourceUrl: string;
}) {
	const createdAt = 1772714045 + options.id;

	return {
		song: {
			id: options.id,
			title: options.title,
			artist: options.artist,
			createdAt,
		},
		run: {
			id: options.id,
			sourceUrl: options.sourceUrl,
			modelId: "accounts/fireworks/models/glm-5",
			createdAt,
		},
		lines: baseLines,
	} satisfies SongLesson;
}

export const MOCK_SONGS: SongLesson[] = [
	createMockSongLesson({
		id: 1,
		title: "One Voice",
		artist: "Rokudenashi",
		sourceUrl:
			"https://genius.com/Genius-romanizations-rokudenashi-one-voice-romanized-lyrics",
	}),
	createMockSongLesson({
		id: 2,
		title: "Yoru ni Kakeru",
		artist: "YOASOBI",
		sourceUrl:
			"https://genius.com/Genius-romanizations-yoasobi-yoru-ni-kakeru-romanized-lyrics",
	}),
	createMockSongLesson({
		id: 3,
		title: "Pretender",
		artist: "Official HIGE DANdism",
		sourceUrl:
			"https://genius.com/Genius-romanizations-official-hige-dandism-pretender-romanized-lyrics",
	}),
];

export function getSongsList() {
	return MOCK_SONGS.map((entry) => ({
		id: entry.song.id,
		title: entry.song.title,
		artist: entry.song.artist,
	}));
}

export function getSongById(songId: number) {
	return MOCK_SONGS.find((entry) => entry.song.id === songId) ?? null;
}

export function buildMockFlashcardRun(songLesson: SongLesson) {
	let cardId = 1;
	let sourceVocabEntryId = 1;

	const cards: MockFlashcard[] = songLesson.lines.flatMap((line) =>
		line.vocabularies.map((vocabulary) => ({
			id: cardId++,
			runId: songLesson.run.id,
			front: `Line: ${line.originalText}\nTarget: ${vocabulary.originalText}`,
			back: `Meaning: ${vocabulary.explanation}\nLine translation: ${line.translationText}`,
			sourceTranslationLineId: line.lineIndex + 1,
			sourceVocabEntryId: sourceVocabEntryId++,
			createdAt: songLesson.run.createdAt,
		})),
	);

	return {
		songId: songLesson.song.id,
		runId: songLesson.run.id,
		count: cards.length,
		cards,
	};
}
