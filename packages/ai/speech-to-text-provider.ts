export type TranscriptSegment = { startTime: number; endTime: number; text: string };
export type TranscriptResult = { language: string | null; segments: TranscriptSegment[]; providerMetadata?: { creditsConsumed?: number } };
export type TranscribeInput = { localFilePath: string; mimeType: "audio/mpeg"; duration: number };
export interface SpeechToTextProvider { transcribe(input: TranscribeInput): Promise<TranscriptResult>; }

export class MockSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(): Promise<TranscriptResult> { return { language: null, segments: [] }; }
}
