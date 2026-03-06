export type SongListItem = {
	id: number;
	title: string;
	artist: string;
};

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

export type Flashcard = {
	id: number;
	runId: number;
	front: string;
	back: string;
	sourceTranslationLineId: number | null;
	sourceVocabEntryId: number | null;
	createdAt: number;
};

export type FlashcardRun = {
	songId: number;
	runId: number;
	count: number;
	cards: Flashcard[];
};

export type SongPageData = {
	songLesson: SongLesson | null;
	flashcardRun: FlashcardRun | null;
};
