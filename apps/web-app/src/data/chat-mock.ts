export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
};

export type ChatThread = {
	id: string;
	title: string;
	createdAt: number;
	messages: ChatMessage[];
};

export const MOCK_THREADS: ChatThread[] = [
	{
		id: "thread-1",
		title: "Grammar in line 3",
		createdAt: Date.now() - 86400000,
		messages: [
			{
				id: "msg-1a",
				role: "user",
				content:
					"Can you explain the grammar pattern used in the third line? I don't understand why te-form is used here.",
				timestamp: Date.now() - 86400000,
			},
			{
				id: "msg-1b",
				role: "assistant",
				content:
					'Great question! The te-form here is used to connect two actions in sequence. Think of it as "do X, and then Y." In this line, the singer first describes looking up at the sky (te-form), and then continues with the feeling that follows. It\'s one of the most common uses of te-form in everyday Japanese.',
				timestamp: Date.now() - 86300000,
			},
			{
				id: "msg-1c",
				role: "user",
				content:
					"So it's like listing actions in order? Similar to using 'and' in English?",
				timestamp: Date.now() - 86200000,
			},
			{
				id: "msg-1d",
				role: "assistant",
				content:
					'Exactly! Te-form works like a soft "and" that connects actions or states. The nuance is that the actions feel more closely linked than if you used separate sentences. In songs, this creates a flowing, continuous feeling that matches the melody.',
				timestamp: Date.now() - 86100000,
			},
		],
	},
	{
		id: "thread-2",
		title: "Cultural context",
		createdAt: Date.now() - 43200000,
		messages: [
			{
				id: "msg-2a",
				role: "user",
				content:
					"What's the cultural significance of the cherry blossom imagery in this song?",
				timestamp: Date.now() - 43200000,
			},
			{
				id: "msg-2b",
				role: "assistant",
				content:
					'Cherry blossoms (sakura) are deeply symbolic in Japanese culture. They represent the transient nature of life - "mono no aware" - the bittersweet awareness that beauty is fleeting. In this song, the falling petals mirror the narrator\'s feelings about a passing relationship. This imagery has been central to Japanese poetry for over a thousand years.',
				timestamp: Date.now() - 43100000,
			},
		],
	},
	{
		id: "thread-3",
		title: "Vocabulary help",
		createdAt: Date.now() - 3600000,
		messages: [
			{
				id: "msg-3a",
				role: "user",
				content:
					"I keep mixing up the words in line 5 and 7. Any tips for remembering them?",
				timestamp: Date.now() - 3600000,
			},
			{
				id: "msg-3b",
				role: "assistant",
				content:
					"A good mnemonic technique is to associate each word with a visual image from the song's story. For the word in line 5, picture someone physically reaching out their hand - the gesture matches the meaning of 'longing.' For line 7, think of rain on a window - it connects to the feeling of quiet waiting the word describes.",
				timestamp: Date.now() - 3500000,
			},
			{
				id: "msg-3c",
				role: "user",
				content:
					"That's really helpful! Can you give me a sample sentence using each one?",
				timestamp: Date.now() - 3400000,
			},
			{
				id: "msg-3d",
				role: "assistant",
				content:
					"Of course! Here are everyday examples:\n\n1. \"Ano hi no koto wo natsukashiku omou\" - I think back fondly on that day (using the 'longing' word)\n\n2. \"Ame no hi wa shizuka ni matsu\" - On rainy days, I wait quietly (using the 'waiting' word)\n\nTry making your own sentences with situations from your daily life - that's the fastest way to make vocabulary stick!",
				timestamp: Date.now() - 3300000,
			},
		],
	},
];

const MOCK_BOT_RESPONSES = [
	"That's a great observation! The way this phrase is structured actually reflects a common pattern in conversational Japanese. The particle used here softens the statement, making it feel more like a personal reflection than a direct claim.",
	"This is actually a really interesting nuance. The word choice here carries emotional weight that doesn't translate directly. Think of it as the difference between saying 'I miss you' and 'your absence weighs on me' - same idea, different depth.",
	"Good question! Let me break that down. The verb conjugation here is in the potential form, which expresses ability or possibility. Combined with the negative ending, it creates a sense of wanting to do something but being unable to - a very common sentiment in Japanese ballads.",
];

let botResponseIndex = 0;

export function getMockBotResponse(): string {
	const response =
		MOCK_BOT_RESPONSES[botResponseIndex % MOCK_BOT_RESPONSES.length];
	botResponseIndex++;
	return response;
}

export function createNewThread(title?: string): ChatThread {
	return {
		id: `thread-${Date.now()}`,
		title: title ?? "New chat",
		createdAt: Date.now(),
		messages: [],
	};
}
