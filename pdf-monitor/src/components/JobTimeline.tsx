import { Job } from '../types';

interface JobTimelineProps {
  jobs: Job[];
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

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(0);
  return `${minutes}m ${remainingSeconds}s`;
};

const formatStartTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export const JobTimeline = ({ jobs }: JobTimelineProps) => {
  if (jobs.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
        <p className="text-slate-400">Waiting for PDF processing jobs...</p>
        <p className="text-slate-500 text-sm mt-2">
          Jobs will appear here when PDF files are uploaded
        </p>
      </div>
    );
  }

  // Calculate global timeline bounds
  const allTimestamps = jobs.flatMap(job => {
    const timestamps = [];
    if (job.startedAt) timestamps.push(job.startedAt);
    if (job.ocrStartedAt) timestamps.push(job.ocrStartedAt);
    if (job.ocrFinishedAt) timestamps.push(job.ocrFinishedAt);
    if (job.thumbnailStartedAt) timestamps.push(job.thumbnailStartedAt);
    if (job.thumbnailFinishedAt) timestamps.push(job.thumbnailFinishedAt);
    if (job.finishedAt) timestamps.push(job.finishedAt);
    return timestamps;
  });

  const earliestTime = Math.min(...allTimestamps, Date.now());
  const latestTime = Math.max(...allTimestamps, Date.now());
  const totalDuration = latestTime - earliestTime || 1;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Timeline Header */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Processing Timeline</h2>
          <div className="text-sm text-slate-400">
            Total jobs: {jobs.length} | Timeline: {formatDuration(totalDuration)}
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="divide-y divide-slate-700">
        {jobs.map((job) => (
          <JobRow
            key={job.jobId}
            job={job}
            earliestTime={earliestTime}
            totalDuration={totalDuration}
          />
        ))}
      </div>
    </div>
  );
};

interface JobRowProps {
  job: Job;
  earliestTime: number;
  totalDuration: number;
}

const JobRow = ({ job, earliestTime, totalDuration }: JobRowProps) => {
  const jobStart = job.startedAt || 0;
  const jobEnd = job.finishedAt || Date.now();
  const jobDuration = (jobStart && jobEnd) ? jobEnd - jobStart : 0;

  const ocrDuration = (job.ocrStartedAt && job.ocrFinishedAt)
    ? job.ocrFinishedAt - job.ocrStartedAt
    : 0;

  const thumbnailDuration = (job.thumbnailStartedAt && job.thumbnailFinishedAt)
    ? job.thumbnailFinishedAt - job.thumbnailStartedAt
    : 0;

  // Calculate positions on timeline
  const getPosition = (time: number) => {
    return ((time - earliestTime) / totalDuration) * 100;
  };

  const getWidth = (start: number, end: number) => {
    return ((end - start) / totalDuration) * 100;
  };

  return (
    <div className="px-4 py-4 hover:bg-slate-750">
      {/* Job Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">Job</span>
          <span className="text-sm font-mono text-slate-200">{job.jobId.substring(0, 12)}</span>
          {job.startedAt && (
            <span className="text-xs text-slate-500 font-mono">
              Started: {formatStartTime(job.startedAt)}
            </span>
          )}
          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(job.status)} text-white`}>
            {job.status}
          </span>
          {job.status === 'DONE' && jobDuration > 0 && (
            <span className="text-xs text-slate-400">
              Total Duration: {formatDuration(jobDuration)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {ocrDuration > 0 && (
            <span>OCR: {formatDuration(ocrDuration)}</span>
          )}
          {thumbnailDuration > 0 && (
            <span>Thumbnail: {formatDuration(thumbnailDuration)}</span>
          )}
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="space-y-2">
        {/* Main timeline bar background */}
        <div className="relative h-10 bg-slate-700 rounded">
          {/* Job total bar */}
          {jobStart > 0 && (
            <div
              className={`absolute top-0 h-3 ${getStatusColor(job.status)} rounded opacity-40`}
              style={{
                left: `${getPosition(jobStart)}%`,
                width: `${getWidth(jobStart, jobEnd)}%`,
              }}
              title={`Job: ${formatTime(jobStart)} - ${job.finishedAt ? formatTime(jobEnd) : 'In progress'}`}
            />
          )}

          {/* OCR bar */}
          {job.ocrStartedAt && (
            <div
              className={`absolute top-3 h-3 ${getStatusColor(job.ocrStatus)} rounded`}
              style={{
                left: `${getPosition(job.ocrStartedAt)}%`,
                width: `${getWidth(job.ocrStartedAt, job.ocrFinishedAt || Date.now())}%`,
              }}
              title={`OCR: ${formatTime(job.ocrStartedAt)} - ${job.ocrFinishedAt ? formatTime(job.ocrFinishedAt) : 'In progress'}`}
            />
          )}

          {/* Thumbnail bar */}
          {job.thumbnailStartedAt && (
            <div
              className={`absolute top-6 h-3 ${getStatusColor(job.thumbnailStatus)} rounded`}
              style={{
                left: `${getPosition(job.thumbnailStartedAt)}%`,
                width: `${getWidth(job.thumbnailStartedAt, job.thumbnailFinishedAt || Date.now())}%`,
              }}
              title={`Thumbnail: ${formatTime(job.thumbnailStartedAt)} - ${job.thumbnailFinishedAt ? formatTime(job.thumbnailFinishedAt) : 'In progress'}`}
            />
          )}

          {/* Event markers */}
          {jobStart > 0 && (
            <EventMarker
              position={getPosition(jobStart)}
              label="Start"
              time={formatTime(jobStart)}
              color="blue"
            />
          )}
          {job.ocrStartedAt && (
            <EventMarker
              position={getPosition(job.ocrStartedAt)}
              label="OCR"
              time={formatTime(job.ocrStartedAt)}
              color="purple"
            />
          )}
          {job.thumbnailStartedAt && (
            <EventMarker
              position={getPosition(job.thumbnailStartedAt)}
              label="Thumb"
              time={formatTime(job.thumbnailStartedAt)}
              color="cyan"
            />
          )}
          {job.ocrFinishedAt && (
            <EventMarker
              position={getPosition(job.ocrFinishedAt)}
              label="OCR✓"
              time={formatTime(job.ocrFinishedAt)}
              color="purple"
            />
          )}
          {job.thumbnailFinishedAt && (
            <EventMarker
              position={getPosition(job.thumbnailFinishedAt)}
              label="Thumb✓"
              time={formatTime(job.thumbnailFinishedAt)}
              color="green"
            />
          )}
          {job.finishedAt && (
            <EventMarker
              position={getPosition(job.finishedAt)}
              label="Done"
              time={formatTime(job.finishedAt)}
              color="green"
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 ${getStatusColor(job.ocrStatus)} rounded`}></div>
            <span>OCR: {job.ocrStatus}</span>
            {ocrDuration > 0 && (
              <span className="text-slate-500">({formatDuration(ocrDuration)})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 ${getStatusColor(job.thumbnailStatus)} rounded`}></div>
            <span>Thumbnail: {job.thumbnailStatus}</span>
            {thumbnailDuration > 0 && (
              <span className="text-slate-500">({formatDuration(thumbnailDuration)})</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface EventMarkerProps {
  position: number;
  label: string;
  time: string;
  color: 'blue' | 'purple' | 'cyan' | 'green';
}

const EventMarker = ({ position, label, time, color }: EventMarkerProps) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
    green: 'bg-green-500',
  };

  return (
    <div
      className="absolute -top-4 transform -translate-x-1/2 group"
      style={{ left: `${position}%` }}
    >
      <div className={`w-1 h-4 ${colorClasses[color]}`}></div>
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-2 py-1 rounded text-xs whitespace-nowrap border border-slate-600">
        <div className="text-white font-semibold">{label}</div>
        <div className="text-slate-400">{time}</div>
      </div>
    </div>
  );
};
