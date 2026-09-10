export type PitchStatus = "draft" | "editing" | "ready" | "shared" | "archived";

export type PitchTemplate = {
  id: string;
  name: string;
  description: string | null;
  /** Google Drive file id of the master Slides deck to copy. */
  googleSlidesTemplateFileId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SalesPitch = {
  id: string;
  opportunityId: string;
  organizationId: string;
  organizationName: string | null;
  opportunityTitle: string | null;
  templateId: string | null;
  title: string;
  status: PitchStatus;
  promptText: string | null;
  googlePresentationId: string | null;
  googleSlidesUrl: string | null;
  protectedToken: string;
  pdfStoragePath: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PitchSettings = {
  /** Default template file id when none selected */
  defaultTemplateFileId: string | null;
};

export type PitchStore = {
  version: 1;
  settings: PitchSettings;
  templates: PitchTemplate[];
  pitches: SalesPitch[];
  updatedAt: string | null;
};

export function emptyPitchStore(): PitchStore {
  return {
    version: 1,
    settings: { defaultTemplateFileId: null },
    templates: [],
    pitches: [],
    updatedAt: null,
  };
}
