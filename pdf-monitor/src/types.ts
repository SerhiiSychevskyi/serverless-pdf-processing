export type JobStatus = 'IN_PROGRESS' | 'DONE' | 'FAILED';
export type SubJobStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';

export interface DocumentUpdateEvent {
  type: 'DOCUMENT_UPDATED';
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
  jobId: string;
  status: JobStatus;
  ocrStatus: SubJobStatus;
  thumbnailStatus: SubJobStatus;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  ocrStartedAt?: string;
  ocrFinishedAt?: string;
  thumbnailStartedAt?: string;
  thumbnailFinishedAt?: string;
  s3Key?: string;
  errorMessage?: string;
}

export interface Job {
  jobId: string;
  status: JobStatus;
  ocrStatus: SubJobStatus;
  thumbnailStatus: SubJobStatus;
  startedAt?: number;
  finishedAt?: number;
  ocrStartedAt?: number;
  ocrFinishedAt?: number;
  thumbnailStartedAt?: number;
  thumbnailFinishedAt?: number;
  updates: DocumentUpdateEvent[];
}
