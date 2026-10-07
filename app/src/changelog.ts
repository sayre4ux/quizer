// Shown once per device in the "What's new" sheet after an update. Newest first.
// Keep each release to a few short lines.
export interface ChangelogEntry {
  version: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.0',
    items: [
      'AI analysis under every answer — a second opinion, flagged where it disagrees with the source key.',
      '简体 / 繁體 switch for Chinese banks, offline too.',
      'Phone layout: focus mode, compact options after answering, tap figures to zoom.',
      'New “Answered before” mode to re-drill questions you’ve done.',
      'Settings (gear icon) and automatic updates.',
    ],
  },
];
