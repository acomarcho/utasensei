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

export type SongChatRole = "user" | "assistant";

export type SongChatMessage = {
	id: number;
	role: SongChatRole;
	content: string;
	createdAt: number;
};

export type SongChatThreadSummary = {
	id: number;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
};

export type SongChatThread = SongChatThreadSummary & {
	runId: number;
	songId: number;
	messages: SongChatMessage[];
};

export type SongPageData = {
	songLesson: SongLesson | null;
	flashcardRun: FlashcardRun | null;
	chatThreads: SongChatThreadSummary[];
};

export type SongGenerationStep =
	| "fetching_song_lyrics"
	| "extracting_lyrics"
	| "generating_translation"
	| "generating_explanations"
	| "generating_flashcards";

export type SongGenerationStatusEvent = {
	message: string;
	step: SongGenerationStep;
	timestamp: number;
	type: "status";
};

export type SongGenerationDoneEvent = {
	flashcardCount: number;
	runId: number;
	songId: number;
	timestamp: number;
	type: "done";
};

export type SongGenerationErrorEvent = {
	message: string;
	timestamp: number;
	type: "error";
};

export type SongGenerationStreamEvent =
	| SongGenerationStatusEvent
	| SongGenerationDoneEvent
	| SongGenerationErrorEvent;
