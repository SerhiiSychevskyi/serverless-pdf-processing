import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { Timeline } from './components/Timeline';

function App() {
  const [isPaused, setIsPaused] = useState(false);
  const { jobs, events, connectionStatus, sessionStartTime } = useWebSocket(isPaused);

  return (
    <Timeline
      jobs={jobs}
      events={events}
      sessionStartTime={sessionStartTime}
      connectionStatus={connectionStatus}
      isPaused={isPaused}
      onTogglePause={() => setIsPaused(!isPaused)}
    />
  );
}

export default App;
