export type MeterKey = "time" | "cost" | "scope" | "stake";

export type Option = {
  key: string; // letter command like "a"
  label: string;
  next: string; // id of next node
  impact?: Partial<Record<MeterKey, number>>; // +/– points
  feedback?: string; // shown after click
  requiresCorrect?: boolean; // for quiz nodes; advance only on correct
};

export type Node = {
  id: string;
  location: string;
  description: string[]; // 3–10 concise sentences
  options: Option[];
  isEnding?: boolean;
  endingTitle?: string;
  quiz?: {
    prompt: string;
    correctKey: string; // matches option.key
  };
};
