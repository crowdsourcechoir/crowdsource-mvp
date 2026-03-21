/** When song seed generation cannot use voice/video because Whisper returned nothing. */
export type SongSeedTranscriptIssue = {
  conversationId: string;
  participantLabel: string;
  kind: "audio" | "video";
};
