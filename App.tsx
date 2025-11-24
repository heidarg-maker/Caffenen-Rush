import React from 'react';
import RunnerGame from './components/RunnerGame';

const App: React.FC = () => {
  return (
    <div className="w-full h-full bg-stone-950 flex flex-col items-center justify-center">
      <div className="w-full h-full max-w-md max-h-[900px] relative shadow-2xl overflow-hidden md:rounded-3xl border-stone-800 md:border-8">
        <RunnerGame />
      </div>
      
      <div className="hidden md:block absolute bottom-4 right-4 text-stone-600 text-xs text-right opacity-50">
        <p>Espresso Rush v1.0</p>
        <p>Powered by React & Gemini</p>
      </div>
    </div>
  );
};

export default App;