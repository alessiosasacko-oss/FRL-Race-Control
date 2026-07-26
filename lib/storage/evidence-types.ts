export type VideoUploadLimits = {
  enabled: boolean;
  maxFileSizeBytes: number;
  maxFiles: number;
  allowedMimeTypes: string[];
};

export type UploadedVideoMetadata = {
  kind: "upload";
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  label: string;
  uploadedAt: string;
};

export type ExternalEvidenceMetadata = {
  kind: "external";
  url: string;
  label: string;
};

export type TicketEvidenceInput =
  | UploadedVideoMetadata
  | ExternalEvidenceMetadata;
