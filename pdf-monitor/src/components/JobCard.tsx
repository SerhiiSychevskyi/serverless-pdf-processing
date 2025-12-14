import { Job } from '../types';

interface JobCardProps {
  job: Job;
  sessionStartTime: number;
  earliestJobStart: number;
  latestJobEnd: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'DONE':
      return 'bg-green-500';
    case 'IN_PROGRESS':
      return 'bg-blue-500';
    case 'PENDING':
      return 'bg-gray-400';
    case 'FAILED':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const formatDuration = (ms: number) => {
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)}s`;
};

export const JobCard = ({ job, sessionStartTime, earliestJobStart, latestJobEnd }: JobCardProps) => {
  const jobStart = job.startedAt || 0;
  const jobEnd = job.finishedAt || Date.now();
  const jobDuration = jobEnd - jobStart;

  const totalTimelineWidth = latestJobEnd - earliestJobStart || 1;

  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-3 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-slate-400">Job:</span>
          <span className="text-sm font-mono text-slate-200">{job.jobId.substring(0, 8)}...</span>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(job.status)} text-white`}>
            {job.status}
          </span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {job.status === 'DONE' && jobDuration > 0 ? (
            <span>Duration: {formatDuration(jobDuration)}</span>
          ) : (
            <span>In progress...</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {/* Main Job Timeline */}
        <TimelineBar
          label="Total"
          status={job.status}
          startTime={jobStart}
          endTime={jobEnd}
          earliestStart={earliestJobStart}
          totalWidth={totalTimelineWidth}
          duration={jobDuration}
        />

        {/* OCR Sub-job */}
        {job.ocrStartedAt && (
          <TimelineBar
            label="OCR"
            status={job.ocrStatus}
            startTime={job.ocrStartedAt}
            endTime={job.finishedAt || Date.now()}
            earliestStart={earliestJobStart}
            totalWidth={totalTimelineWidth}
            duration={(job.finishedAt || Date.now()) - job.ocrStartedAt}
            isSubJob
          />
        )}

        {/* Thumbnail Sub-job */}
        {job.thumbnailStartedAt && (
          <TimelineBar
            label="Thumbnail"
            status={job.thumbnailStatus}
            startTime={job.thumbnailStartedAt}
            endTime={job.thumbnailFinishedAt || Date.now()}
            earliestStart={earliestJobStart}
            totalWidth={totalTimelineWidth}
            duration={(job.thumbnailFinishedAt || Date.now()) - job.thumbnailStartedAt}
            isSubJob
          />
        )}
      </div>
    </div>
  );
};

interface TimelineBarProps {
  label: string;
  status: string;
  startTime: number;
  endTime: number;
  earliestStart: number;
  totalWidth: number;
  duration: number;
  isSubJob?: boolean;
}

const TimelineBar = ({
  label,
  status,
  startTime,
  endTime,
  earliestStart,
  totalWidth,
  duration,
  isSubJob = false,
}: TimelineBarProps) => {
  const leftOffset = ((startTime - earliestStart) / totalWidth) * 100;
  const barWidth = ((endTime - startTime) / totalWidth) * 100;

  return (
    <div className={`flex items-center gap-3 ${isSubJob ? 'pl-6' : ''}`}>
      <div className={`text-sm text-slate-300 ${isSubJob ? 'w-20' : 'w-24'}`}>{label}</div>
      <div className="flex-1 relative h-6 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`absolute h-full ${getStatusColor(status)} transition-all duration-300`}
          style={{
            left: `${Math.max(0, Math.min(100, leftOffset))}%`,
            width: `${Math.max(0.5, Math.min(100 - leftOffset, barWidth))}%`,
          }}
        />
      </div>
      <div className="flex items-center gap-2 w-32">
        <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
        <span className="text-xs text-slate-400 w-16">{status}</span>
        {duration > 0 && status === 'DONE' && (
          <span className="text-xs text-slate-500 font-mono">
            {formatDuration(duration)}
          </span>
        )}
      </div>
    </div>
  );
};
