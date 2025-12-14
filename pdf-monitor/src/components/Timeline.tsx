import { Job, DocumentUpdateEvent } from '../types';
import { JobTimeline } from './JobTimeline';
import { useState, useEffect } from 'react';

interface TimelineProps {
  jobs: Job[];
  events: DocumentUpdateEvent[];
  sessionStartTime: number;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  isPaused: boolean;
  onTogglePause: () => void;
}

export const Timeline = ({ jobs, events, sessionStartTime, connectionStatus, isPaused, onTogglePause }: TimelineProps) => {
  const [isEventLogOpen, setIsEventLogOpen] = useState(false);
  const [, setTick] = useState(0);

  // Auto-refresh timeline every 500ms when not paused
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [isPaused]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col relative">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-white">PDF Processing Monitor</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={onTogglePause}
                className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
                  isPaused
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
              >
                <span>{isPaused ? '▶ Continue' : '⏸ Pause'}</span>
              </button>
              <button
                onClick={() => setIsEventLogOpen(!isEventLogOpen)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm flex items-center gap-2 transition-colors"
              >
                <span>Event Log ({events.length})</span>
                <span className="text-xs">{isEventLogOpen ? '▼' : '▲'}</span>
              </button>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
                <span className="text-sm text-slate-300 capitalize">{connectionStatus}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <p className="text-slate-400">
              Session started: {new Date(sessionStartTime).toLocaleTimeString()}
            </p>
            {isPaused && (
              <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 rounded text-xs font-semibold">
                ⏸ PAUSED - Timeline updates stopped
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Jobs Timeline (Full Height) */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <JobTimeline jobs={jobs} />
          </div>
        </div>
      </div>

      {/* Floating Event Log Panel */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 shadow-2xl transition-transform duration-300 ${
          isEventLogOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '40vh', zIndex: 50 }}
      >
        <div className="h-full px-6 py-4">
          <div className="max-w-6xl mx-auto h-full flex flex-col">
            {/* Event Log Header with Close Button */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white">
                Event Log ({events.length} events)
              </h2>
              <button
                onClick={() => setIsEventLogOpen(false)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto bg-slate-900 rounded border border-slate-700">
              {events.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  No events received yet...
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {events.slice().reverse().map((event, index) => (
                    <EventRow key={events.length - index - 1} event={event} index={events.length - index} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Event Row Component
interface EventRowProps {
  event: DocumentUpdateEvent;
  index: number;
}

const EventRow = ({ event, index }: EventRowProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <div className="hover:bg-slate-750">
      <div
        className="px-4 py-2 flex items-center gap-3 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className="text-xs text-slate-500 w-12">#{index}</span>
        <span className="text-xs font-mono text-slate-400 w-32">
          {event.updatedAt ? formatTime(event.updatedAt) : 'N/A'}
        </span>
        <span className="text-xs font-mono text-slate-300 flex-1">
          {event.jobId.substring(0, 12)}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${
          event.eventName === 'INSERT' ? 'bg-blue-600' :
          event.eventName === 'MODIFY' ? 'bg-yellow-600' : 'bg-red-600'
        } text-white`}>
          {event.eventName}
        </span>
        <span className="text-xs text-slate-400">
          {event.status} | OCR: {event.ocrStatus} | Thumb: {event.thumbnailStatus}
        </span>
        <button className="text-slate-500 hover:text-white text-xs">
          {showDetails ? '▼' : '▶'}
        </button>
      </div>

      {showDetails && (
        <div className="px-4 pb-3 bg-slate-900">
          <pre className="text-xs text-slate-300 overflow-x-auto p-3 bg-slate-950 rounded">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
