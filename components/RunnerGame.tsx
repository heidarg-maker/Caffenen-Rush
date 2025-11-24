import React, { useState, useEffect, useRef } from 'react';
import { Coffee, Milk, Zap, Skull, Play, RotateCcw, Flame } from 'lucide-react';
import { Lane, Entity, EntityType, GameState, Particle } from '../types';
import { PLAYER_Y_POS, INITIAL_SPEED, MAX_SPEED, SPEED_INCREMENT, SPAWN_RATE_BASE } from '../constants';
import { getBaristaRoast } from '../services/geminiService';

interface Fireball {
  id: string;
  lane: Lane;
  y: number;
}

const RunnerGame: React.FC = () => {
  // UI State
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    score: 0,
    speedMultiplier: 1,
    coffeeCount: 0,
  });
  const [roastMessage, setRoastMessage] = useState<string>("");
  const [isLoadingRoast, setIsLoadingRoast] = useState(false);
  
  // Shouting State
  const [shout, setShout] = useState<string | null>(null);

  // Mutable Game State (Refs for performance)
  const requestRef = useRef<number>(undefined);
  const lastTimeRef = useRef<number>(undefined);
  const playerLaneRef = useRef<Lane>(0);
  const entitiesRef = useRef<Entity[]>([]);
  const fireballsRef = useRef<Fireball[]>([]);
  const speedRef = useRef<number>(INITIAL_SPEED);
  const scoreRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const shoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DOM State for rendering (to trigger React updates less frequently than 60fps where possible, 
  // but for this complexity, React state @ 60fps is acceptable if optimized)
  // We will force update via a tick counter for the render cycle.
  const [, setTick] = useState(0);

  const startGame = () => {
    setGameState({
      isPlaying: true,
      isGameOver: false,
      score: 0,
      speedMultiplier: 1,
      coffeeCount: 0,
    });
    setRoastMessage("");
    setShout(null);
    
    // Reset Refs
    playerLaneRef.current = 0;
    entitiesRef.current = [];
    fireballsRef.current = [];
    speedRef.current = INITIAL_SPEED;
    scoreRef.current = 0;
    frameCountRef.current = 0;
    particlesRef.current = [];

    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const handleGameOver = async () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (shoutTimeoutRef.current) clearTimeout(shoutTimeoutRef.current);
    
    setGameState(prev => ({ ...prev, isPlaying: false, isGameOver: true }));
    setShout(null);
    
    setIsLoadingRoast(true);
    const message = await getBaristaRoast(scoreRef.current, gameState.coffeeCount);
    setRoastMessage(message);
    setIsLoadingRoast(false);
  };

  const spawnEntity = () => {
    const laneChoice = (Math.floor(Math.random() * 3) - 1) as Lane;
    // 30% chance of Milk, 70% Coffee
    const type = Math.random() > 0.3 ? EntityType.COFFEE : EntityType.MILK;
    
    // Prevent impossible patterns (simple logic: don't spawn if too crowded)
    // For this simple version, random is usually okay.
    
    const newEntity: Entity = {
      id: Math.random().toString(36).substr(2, 9),
      lane: laneChoice,
      y: -20, // Start slightly above screen
      type
    };
    
    entitiesRef.current.push(newEntity);
  };

  const shootFireball = () => {
    const newFireball: Fireball = {
      id: Math.random().toString(36).substr(2, 9),
      lane: playerLaneRef.current,
      y: PLAYER_Y_POS - 5
    };
    fireballsRef.current.push(newFireball);
  };

  const gameLoop = (_time: number) => {
    // Delta time calculation could be added for smoother frame independence,
    // but fixed step is easier for this scale.
    
    // 1. Move Entities
    const currentSpeed = speedRef.current;
    
    // Filter out entities that have gone off screen or been collected
    entitiesRef.current = entitiesRef.current.filter(e => {
      // Move down
      e.y += currentSpeed;
      
      // Remove if off screen
      if (e.y > 110) return false;
      if (e.collected) return false;
      
      return true;
    });

    // 2. Move Fireballs
    fireballsRef.current = fireballsRef.current.filter(fb => {
      fb.y -= 2; // Fireballs move up faster
      return fb.y > -20;
    });

    // 3. Collision Detection
    const playerLane = playerLaneRef.current;
    
    // Check Fireball vs Milk collisions
    for (const fb of fireballsRef.current) {
      for (const entity of entitiesRef.current) {
        if (!entity.collected && entity.type === EntityType.MILK && entity.lane === fb.lane) {
          // Fireball collision logic
          if (Math.abs(entity.y - fb.y) < 10) {
            entity.collected = true; // Destroy milk
            fb.y = -100; // Destroy fireball (move offscreen to be filtered next frame)
            scoreRef.current += 50; // Bonus points
            
            // Visual effect could go here (explosion particles)
          }
        }
      }
    }

    // Check Player vs Entity collisions
    for (const entity of entitiesRef.current) {
      if (!entity.collected && entity.lane === playerLane) {
        // Hitbox check
        if (entity.y > PLAYER_Y_POS - 5 && entity.y < PLAYER_Y_POS + 5) {
          if (entity.type === EntityType.MILK) {
            handleGameOver();
            return; // Stop loop
          } else if (entity.type === EntityType.COFFEE) {
            entity.collected = true;
            // Speed up
            speedRef.current = Math.min(speedRef.current + SPEED_INCREMENT, MAX_SPEED);
            scoreRef.current += 100;

            // Trigger Shout
            if (shoutTimeoutRef.current) clearTimeout(shoutTimeoutRef.current);
            setShout("Kaffi-og-með-í!");
            shoutTimeoutRef.current = setTimeout(() => {
                setShout(null);
            }, 1000);
            
            // Update UI State partly
            setGameState(prev => ({
              ...prev,
              score: scoreRef.current,
              coffeeCount: prev.coffeeCount + 1,
              speedMultiplier: speedRef.current / INITIAL_SPEED
            }));
          }
        }
      }
    }

    // 4. Spawning
    frameCountRef.current++;
    // Spawn rate increases as speed increases
    const currentSpawnRate = Math.max(20, Math.floor(SPAWN_RATE_BASE / (speedRef.current / INITIAL_SPEED)));
    
    if (frameCountRef.current % currentSpawnRate === 0) {
      spawnEntity();
    }

    // 5. Score ticking
    scoreRef.current += 1;
    if (frameCountRef.current % 10 === 0) {
        setGameState(prev => ({...prev, score: scoreRef.current}));
    }

    // 6. Render Trigger
    setTick(prev => prev + 1);
    
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.isPlaying) return;
      
      if (e.key === 'ArrowLeft') {
        playerLaneRef.current = Math.max(-1, playerLaneRef.current - 1) as Lane;
      } else if (e.key === 'ArrowRight') {
        playerLaneRef.current = Math.min(1, playerLaneRef.current + 1) as Lane;
      } else if (e.code === 'Space') {
        if (gameState.coffeeCount > 15) {
          shootFireball();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isPlaying, gameState.coffeeCount]);

  // Touch Controls
  const touchStartRef = useRef<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const diff = e.changedTouches[0].clientX - touchStartRef.current;
    
    // Tap detection for shooting (if no swipe)
    if (Math.abs(diff) < 10 && gameState.coffeeCount > 15) {
        shootFireball();
    } else if (Math.abs(diff) > 30) { // Threshold for swipe
      if (diff > 0) {
        playerLaneRef.current = Math.min(1, playerLaneRef.current + 1) as Lane;
      } else {
        playerLaneRef.current = Math.max(-1, playerLaneRef.current - 1) as Lane;
      }
    }
    touchStartRef.current = null;
  };

  const isEmiliaMode = gameState.coffeeCount > 15;
  const isSuperMode = gameState.coffeeCount > 5 && !isEmiliaMode;

  return (
    <div 
      className="relative w-full h-full max-w-md mx-auto bg-stone-800 overflow-hidden shadow-2xl perspective-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Moving Background Effect */}
      <div 
        className="absolute inset-0 w-full h-[200%] scrolling-bg opacity-30 pointer-events-none"
        style={{
          transform: 'translateY(-50%)',
          animation: gameState.isPlaying ? `scrollBackground ${2 / (speedRef.current/INITIAL_SPEED)}s linear infinite` : 'none',
          filter: isEmiliaMode ? 'hue-rotate(-50deg) saturate(200%)' : 'none'
        }}
      />
      
      {/* Styles for animation */}
      <style>{`
        @keyframes scrollBackground {
          from { transform: translateY(-50%); }
          to { transform: translateY(0%); }
        }
      `}</style>

      {/* Lanes Markers */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div className="flex-1 border-r border-stone-700/50"></div>
        <div className="flex-1 border-r border-stone-700/50"></div>
        <div className="flex-1"></div>
      </div>

      {/* Header / HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
        <div>
          <div className={`text-3xl font-black tracking-tighter drop-shadow-md ${isEmiliaMode ? 'text-red-500' : 'text-amber-500'}`}>
            {gameState.score.toLocaleString()}
          </div>
          <div className="text-xs text-stone-400 font-bold uppercase tracking-widest">Score</div>
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 ${isEmiliaMode ? 'text-red-500' : 'text-amber-300'}`}>
            <Zap className={`w-4 h-4 ${isEmiliaMode ? 'fill-red-500' : 'fill-amber-300'}`} />
            <span className="text-xl font-bold">{(gameState.speedMultiplier).toFixed(1)}x</span>
          </div>
          <div className="text-xs text-stone-400 font-bold uppercase tracking-widest">Speed</div>
        </div>
      </div>

      {/* Game World Layer */}
      <div className="absolute inset-0 z-10">
        
        {/* Fireballs */}
        {fireballsRef.current.map(fb => (
          <div
            key={fb.id}
            className="absolute transition-transform duration-75"
            style={{
              left: `${(fb.lane + 1) * 33.33}%`,
              top: `${fb.y}%`,
              width: '33.33%',
              height: '10%',
              transform: `scale(${0.5 + (fb.y / 200)})`,
            }}
          >
             <div className="w-full h-full flex items-center justify-center animate-pulse">
                <Flame className="w-8 h-8 text-orange-500 fill-yellow-400 drop-shadow-[0_0_10px_rgba(255,165,0,0.8)]" />
             </div>
          </div>
        ))}

        {/* Entities */}
        {entitiesRef.current.map(entity => (
          <div
            key={entity.id}
            className="absolute transition-transform duration-75"
            style={{
              left: `${(entity.lane + 1) * 33.33}%`,
              top: `${entity.y}%`,
              width: '33.33%',
              height: '10%', // approximate
              transform: `scale(${0.5 + (entity.y / 200)})`, // Fake perspective scale
              opacity: entity.y < 0 ? 0 : 1,
            }}
          >
            <div className={`w-full h-full flex items-center justify-center ${entity.type === EntityType.COFFEE ? 'animate-bounce' : ''}`}>
              {entity.type === EntityType.COFFEE ? (
                <div className="relative">
                   <div className="absolute inset-0 bg-amber-500 blur-md opacity-40 rounded-full"></div>
                   <Coffee className="w-12 h-12 text-amber-400 drop-shadow-lg relative z-10" />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-white blur-md opacity-20 rounded-full"></div>
                  <Milk className="w-14 h-14 text-stone-100 drop-shadow-lg relative z-10" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Player: Marta / Super-Baginska / Emilía */}
        <div 
          className="absolute transition-all duration-150 ease-out"
          style={{
            left: `${(playerLaneRef.current + 1) * 33.33}%`,
            top: `${PLAYER_Y_POS}%`,
            width: '33.33%',
            height: '10%',
          }}
        >
          <div className="w-full h-full flex items-center justify-center relative">
             <div className="absolute bottom-0 w-16 h-4 bg-black/40 blur-md rounded-[100%] scale-x-110 translate-y-2"></div>
             
             {/* Character Container */}
             <div className={`relative ${gameState.isPlaying ? 'animate-pulse' : ''}`}>
               
               {/* Shout Bubble */}
               {shout && (
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white text-black px-3 py-2 rounded-2xl text-sm font-black border-2 border-stone-900 shadow-xl whitespace-nowrap z-50 animate-bounce">
                    {shout}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-stone-900 transform rotate-45"></div>
                  </div>
               )}

               {/* Character Visuals */}
               <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border-2 relative overflow-hidden transition-all duration-500
                 ${isEmiliaMode 
                    ? 'bg-red-600 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.9)]'
                    : isSuperMode 
                      ? 'bg-blue-600 border-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.8)]' 
                      : 'bg-pink-500 border-pink-300'
                 }`}
               >
                  <span className={`text-4xl relative top-1 select-none transition-filter duration-500 
                    ${isEmiliaMode ? 'brightness-125 drop-shadow-[0_0_8px_rgba(255,200,0,0.9)]' : isSuperMode ? 'brightness-110 drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]' : ''}`}>
                    {isEmiliaMode ? '👩‍🦰' : '👱‍♀️'}
                  </span>
               </div>

                {/* Name Tag */}
                <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-1 rounded uppercase tracking-wider font-bold whitespace-nowrap transition-all duration-300 z-10
                  ${isEmiliaMode
                    ? 'bg-red-900 text-yellow-300 border border-yellow-500 scale-125'
                    : isSuperMode 
                      ? 'bg-blue-900 text-cyan-300 border border-cyan-400 scale-110' 
                      : 'bg-stone-900/80 text-white'
                  } text-[8px]`}
                >
                  {isEmiliaMode ? 'Emilía' : isSuperMode ? 'Super-Baginska' : 'Marta'}
                </div>

               {/* Sweat particles if fast */}
               {gameState.speedMultiplier > 1.5 && !isSuperMode && !isEmiliaMode && (
                 <div className="absolute -right-4 top-0 text-blue-300 text-xs animate-ping">💦</div>
               )}
               {/* Super sparkles */}
               {isSuperMode && (
                  <div className="absolute -right-4 top-0 text-yellow-300 text-xs animate-spin">✨</div>
               )}
               {/* Fire particles for Emilia */}
               {isEmiliaMode && (
                  <>
                    <div className="absolute -right-4 -top-2 text-orange-500 text-xs animate-bounce">🔥</div>
                    <div className="absolute -left-4 top-2 text-red-500 text-xs animate-pulse">🔥</div>
                  </>
               )}
             </div>
          </div>
        </div>
      </div>

      {/* Menus / Overlays */}
      
      {/* Start Screen */}
      {!gameState.isPlaying && !gameState.isGameOver && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-6 bg-pink-500/20 p-6 rounded-full border-4 border-pink-500/50">
            <span className="text-6xl drop-shadow-lg">👱‍♀️</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">ESPRESSO<br/><span className="text-amber-500">RUSH</span></h1>
          <p className="text-stone-400 mb-8 max-w-xs">Run with Marta! Grab the coffee, shout <span className="text-amber-300 italic">"Kaffi-og-með-í"</span>, and avoid the milk.</p>
          
          <button 
            onClick={startGame}
            className="group relative px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(217,119,6,0.5)]"
          >
            <div className="flex items-center gap-2">
              <Play className="fill-white" />
              <span>START RUN</span>
            </div>
          </button>
          
          <div className="mt-8 text-sm text-stone-500 flex flex-col gap-1">
            <p>Use <span className="px-2 py-1 bg-stone-700 rounded text-stone-200">←</span> <span className="px-2 py-1 bg-stone-700 rounded text-stone-200">→</span> to move</p>
            <p className="text-xs text-stone-600 mt-2">Collect 16 coffees to unlock <span className="text-red-500 font-bold">FIREBALLS</span></p>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 z-50 bg-red-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <Skull className="w-16 h-16 text-white mb-4 animate-bounce" />
          <h2 className="text-4xl font-black text-white mb-1">
            {isEmiliaMode ? "EMILÍA BURNED OUT!" : isSuperMode ? "SUPER CRASH!" : "MARTA CRASHED!"}
          </h2>
          <p className="text-red-200 mb-6 font-bold">Too much dairy.</p>
          
          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 w-full max-w-sm mb-6 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-left">
                <div className="text-xs text-stone-400 uppercase">Distance</div>
                <div className="text-2xl font-bold text-white">{gameState.score}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-stone-400 uppercase">Espressos</div>
                <div className="text-2xl font-bold text-amber-400">{gameState.coffeeCount}</div>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-4 mt-2">
              <div className="text-xs text-amber-500/80 font-mono mb-2 text-left uppercase tracking-widest">Barista's Analysis:</div>
              <div className="text-stone-300 italic min-h-[3rem] text-sm">
                {isLoadingRoast ? (
                  <span className="animate-pulse">Brewing an insult...</span>
                ) : (
                  `"${roastMessage}"`
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={startGame}
            className="px-8 py-3 bg-white text-stone-900 font-bold rounded-full hover:bg-stone-200 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            TRY AGAIN
          </button>
        </div>
      )}
      
      {/* Controls Overlay for Emilia Mode */}
      {isEmiliaMode && gameState.isPlaying && (
         <div className="absolute bottom-4 left-0 right-0 text-center animate-pulse z-40">
            <span className="inline-block px-4 py-1 bg-red-600/80 text-white text-xs font-bold rounded-full border border-red-400 shadow-lg backdrop-blur-sm">
                PRESS SPACE OR TAP TO SHOOT 🔥
            </span>
         </div>
      )}
    </div>
  );
};

export default RunnerGame;