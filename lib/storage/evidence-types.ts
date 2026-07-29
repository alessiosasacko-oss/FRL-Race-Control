export type VideoUploadLimits = {
  enabled: boolean;
  maxFileSizeBytes: number;
  maxFiles: number;
  allowedMimeTypes: string[];
};

export type UploadedVideoMetadata = {
  kind: "upload";
  temporaryUploadId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  label: string;
  uploadedAt: string;
};

export type VideoUploadStage =
  | "selected"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "completed"
  | "failed";

export type VideoUploadPreparation = {
  temporaryUploadId: string;
  signedUrl: string;
  storagePath: string;
};

export type VideoUploadCompletion = {
  upload: UploadedVideoMetadata;
  evidenceId?: number;
};

export type ExternalEvidenceMetadata = {
  kind: "external";
  url: string;
  label: string;
};

export type TicketEvidenceInput =
  | UploadedVideoMetadata
  | ExternalEvidenceMetadata;
