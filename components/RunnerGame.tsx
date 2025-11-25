import React, { useState, useEffect, useRef } from 'react';
import { Coffee, Milk, Zap, Skull, Play, RotateCcw, Flame, Dumbbell, Trophy, Save } from 'lucide-react';
import { Lane, Entity, EntityType, GameState, Particle, HighScore } from '../types';
import { PLAYER_Y_POS, INITIAL_SPEED, MAX_SPEED, SPEED_INCREMENT, SPAWN_RATE_BASE } from '../constants';
import { getBaristaRoast } from '../services/geminiService';

interface Fireball {
  id: string;
  lane: Lane;
  y: number;
}

const COFFEE_SHOUTS = [
  "Kaffi-og-með-í!",
  "Meira kaffi!",
  "Vá hvað þetta er gott!",
  "Orka!",
  "Nú er gaman!",
  "Hraðar!",
  "Espresso!",
  "Mmm...!",
  "Djöfull er þetta gott!",
  "Tvöfaldur!",
  "Brennandi heitt!",
  "Áfram Marta!",
  "Úff, hvað ég þurfti þetta!",
  "Hvar er kleinuhringurinn?"
];

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
  const [isPudanovski, setIsPudanovski] = useState(false);
  
  // High Score State
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  
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
  
  // Pudanovski Mode Logic
  const pudanovskiModeRef = useRef<boolean>(false);
  const pudanovskiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DOM State for rendering (to trigger React updates less frequently than 60fps where possible, 
  // but for this complexity, React state @ 60fps is acceptable if optimized)
  // We will force update via a tick counter for the render cycle.
  const [, setTick] = useState(0);

  // Load High Scores on Mount
  useEffect(() => {
    const saved = localStorage.getItem('marta-smarta-highscores');
    if (saved) {
      try {
        setHighScores(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse high scores", e);
      }
    }
  }, []);

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
    setIsPudanovski(false);
    pudanovskiModeRef.current = false;
    
    // Reset Refs
    playerLaneRef.current = 0;
    entitiesRef.current = [];
    fireballsRef.current = [];
    speedRef.current = INITIAL_SPEED;
    scoreRef.current = 0;
    frameCountRef.current = 0;
    particlesRef.current = [];

    // Reset High Score UI
    setIsNewHighScore(false);
    setScoreSubmitted(false);
    setPlayerName("");

    if (pudanovskiTimeoutRef.current) clearTimeout(pudanovskiTimeoutRef.current);

    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const activatePudanovskiMode = () => {
    if (pudanovskiModeRef.current) return; // Already active

    pudanovskiModeRef.current = true;
    setIsPudanovski(true);
    
    // Speed boost!
    speedRef.current = MAX_SPEED * 1.2;

    setShout("MARTA-PUDANOVSKI!!!");
    if (shoutTimeoutRef.current) clearTimeout(shoutTimeoutRef.current);
    shoutTimeoutRef.current = setTimeout(() => setShout(null), 2000);

    // Duration 8 seconds
    pudanovskiTimeoutRef.current = setTimeout(() => {
        pudanovskiModeRef.current = false;
        setIsPudanovski(false);
        // Reset speed slightly (not back to start, but reasonable)
        speedRef.current = Math.min(speedRef.current, MAX_SPEED);
    }, 8000);
  };

  const submitScore = () => {
    if (!playerName.trim()) return;

    const newScoreEntry: HighScore = {
      name: playerName.trim().substring(0, 12), // Max 12 chars
      score: gameState.score,
      coffeeCount: gameState.coffeeCount,
      date: new Date().toISOString().split('T')[0]
    };

    const updatedScores = [...highScores, newScoreEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Keep top 10

    setHighScores(updatedScores);
    localStorage.setItem('marta-smarta-highscores', JSON.stringify(updatedScores));
    setScoreSubmitted(true);
  };

  const handleGameOver = async () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (shoutTimeoutRef.current) clearTimeout(shoutTimeoutRef.current);
    if (pudanovskiTimeoutRef.current) clearTimeout(pudanovskiTimeoutRef.current);
    
    const finalScore = scoreRef.current;
    
    // Check for high score
    // Reload from storage to ensure we compare against latest
    const saved = localStorage.getItem('marta-smarta-highscores');
    const currentHighScores: HighScore[] = saved ? JSON.parse(saved) : [];
    // Update local state to match storage
    setHighScores(currentHighScores);

    const qualifies = currentHighScores.length < 10 || finalScore > currentHighScores[currentHighScores.length - 1].score;
    setIsNewHighScore(qualifies);

    setGameState(prev => ({ ...prev, isPlaying: false, isGameOver: true, score: finalScore }));
    setShout(null);
    
    setIsLoadingRoast(true);
    const message = await getBaristaRoast(finalScore, gameState.coffeeCount);
    setRoastMessage(message);
    setIsLoadingRoast(false);
  };

  const spawnEntity = () => {
    const laneChoice = (Math.floor(Math.random() * 3) - 1) as Lane;
    // 30% chance of Milk, 70% Coffee
    const type = Math.random() > 0.3 ? EntityType.COFFEE : EntityType.MILK;
    
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
      fb.y -= 2.5; // Fireballs move up faster
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
            fb.y = -100; // Destroy fireball
            scoreRef.current += 50; 
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
            if (pudanovskiModeRef.current) {
                // INVINCIBLE SMASH
                entity.collected = true;
                scoreRef.current += 50;
                // Maybe a sound effect or screen shake here ideally
            } else {
                handleGameOver();
                return; // Stop loop
            }
          } else if (entity.type === EntityType.COFFEE) {
            entity.collected = true;
            
            // Only increase speed if not in Pudanovski mode (because Pudanovski is already max speed)
            if (!pudanovskiModeRef.current) {
                speedRef.current = Math.min(speedRef.current + SPEED_INCREMENT, MAX_SPEED);
            }
            
            scoreRef.current += 100;

            const newCoffeeCount = gameState.coffeeCount + 1;

            // Trigger Pudanovski?
            if (newCoffeeCount === 25) {
               // We need to trigger this outside the render cycle, but calling the function is fine
               // We need to queue the state update though
            }

            // Trigger Shout
            if (shoutTimeoutRef.current) clearTimeout(shoutTimeoutRef.current);
            
            // Pick random shout
            const randomShout = COFFEE_SHOUTS[Math.floor(Math.random() * COFFEE_SHOUTS.length)];
            setShout(randomShout);
            
            shoutTimeoutRef.current = setTimeout(() => {
                setShout(null);
            }, 1000);
            
            // Update UI State
            setGameState(prev => {
              const updatedCount = prev.coffeeCount + 1;
              
              // Check trigger inside the state update wrapper to ensure sync or use useEffect
              // Actually easier to just check ref logic here for side effects if we are careful
              if (updatedCount === 25) {
                 setTimeout(() => activatePudanovskiMode(), 0);
              }

              return {
                ...prev,
                score: scoreRef.current,
                coffeeCount: updatedCount,
                speedMultiplier: speedRef.current / INITIAL_SPEED
              };
            });
          }
        }
      }
    }

    // 4. Spawning
    frameCountRef.current++;
    // Spawn rate increases as speed increases
    const currentSpawnRate = Math.max(15, Math.floor(SPAWN_RATE_BASE / (speedRef.current / INITIAL_SPEED)));
    
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
        // Can shoot if Emilia OR Pudanovski (since Pudanovski is > 15)
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
    
    // Tap detection for shooting
    if (Math.abs(diff) < 10 && gameState.coffeeCount > 15) {
        shootFireball();
    } else if (Math.abs(diff) > 30) {
      if (diff > 0) {
        playerLaneRef.current = Math.min(1, playerLaneRef.current + 1) as Lane;
      } else {
        playerLaneRef.current = Math.max(-1, playerLaneRef.current - 1) as Lane;
      }
    }
    touchStartRef.current = null;
  };

  const isEmiliaMode = gameState.coffeeCount > 15;
  // Visual helper
  const characterName = isPudanovski ? 'Marta-Pudanovski' : isEmiliaMode ? 'Emilía' : 'Marta';

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
          filter: isPudanovski ? 'hue-rotate(90deg) saturate(300%) contrast(120%)' : isEmiliaMode ? 'hue-rotate(-50deg) saturate(200%)' : 'none'
        }}
      />
      
      {/* Styles for animation */}
      <style>{`
        @keyframes scrollBackground {
          from { transform: translateY(-50%); }
          to { transform: translateY(0%); }
        }
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .shake-screen {
            animation: shake 0.5s;
            animation-iteration-count: infinite;
        }
      `}</style>

      {/* Shake container if Pudanovski is running */}
      <div className={`absolute inset-0 ${isPudanovski ? 'shake-screen' : ''}`}>

        {/* Lanes Markers */}
        <div className="absolute inset-0 flex pointer-events-none">
            <div className="flex-1 border-r border-stone-700/50"></div>
            <div className="flex-1 border-r border-stone-700/50"></div>
            <div className="flex-1"></div>
        </div>

        {/* Header / HUD */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
            <div>
            <div className={`text-3xl font-black tracking-tighter drop-shadow-md ${isPudanovski ? 'text-purple-400 scale-110' : isEmiliaMode ? 'text-red-500' : 'text-amber-500'}`}>
                {gameState.score.toLocaleString()}
            </div>
            <div className="text-xs text-stone-400 font-bold uppercase tracking-widest">Stig</div>
            </div>
            <div className="text-right">
            <div className={`flex items-center gap-1 ${isPudanovski ? 'text-purple-300' : isEmiliaMode ? 'text-red-500' : 'text-amber-300'}`}>
                <Zap className={`w-4 h-4 ${isPudanovski ? 'fill-purple-300' : isEmiliaMode ? 'fill-red-500' : 'fill-amber-300'}`} />
                <span className="text-xl font-bold">{(gameState.speedMultiplier).toFixed(1)}x</span>
            </div>
            <div className="text-xs text-stone-400 font-bold uppercase tracking-widest">Hraði</div>
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
                    <Flame className={`w-8 h-8 ${isPudanovski ? 'text-purple-500 fill-white' : 'text-orange-500 fill-yellow-400'} drop-shadow-[0_0_10px_rgba(255,165,0,0.8)]`} />
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

            {/* Player Character */}
            <div 
            className="absolute transition-all duration-150 ease-out"
            style={{
                left: `${(playerLaneRef.current + 1) * 33.33}%`,
                top: `${PLAYER_Y_POS}%`,
                width: '33.33%',
                height: '10%',
                zIndex: isPudanovski ? 50 : 10
            }}
            >
            <div className="w-full h-full flex items-center justify-center relative">
                <div className="absolute bottom-0 w-16 h-4 bg-black/40 blur-md rounded-[100%] scale-x-110 translate-y-2"></div>
                
                {/* Character Container */}
                <div className={`relative ${gameState.isPlaying ? 'animate-pulse' : ''} ${isPudanovski ? 'scale-150 transition-transform duration-500' : 'transition-transform duration-300'}`}>
                
                {/* Shout Bubble */}
                {shout && (
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white text-black px-3 py-2 rounded-2xl text-sm font-black border-2 border-stone-900 shadow-xl whitespace-nowrap z-50 animate-bounce">
                        {shout}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-stone-900 transform rotate-45"></div>
                    </div>
                )}

                {/* Character Visuals */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border-2 relative overflow-hidden transition-all duration-500
                    ${isPudanovski
                        ? 'bg-purple-700 border-yellow-400 shadow-[0_0_30px_rgba(168,85,247,1)] ring-4 ring-purple-500'
                        : isEmiliaMode 
                        ? 'bg-red-600 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.9)]'
                        : 'bg-pink-500 border-pink-300'
                    }`}
                >
                    <span className={`text-4xl relative top-1 select-none transition-filter duration-500 
                        ${isPudanovski ? 'brightness-110 contrast-125' : isEmiliaMode ? 'brightness-125 drop-shadow-[0_0_8px_rgba(255,200,0,0.9)]' : ''}`}>
                        {isPudanovski ? '💪' : isEmiliaMode ? '👩‍🦰' : '👱‍♀️'}
                    </span>
                </div>

                    {/* Name Tag */}
                    <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-1 rounded uppercase tracking-wider font-bold whitespace-nowrap transition-all duration-300 z-10
                    ${isPudanovski
                        ? 'bg-purple-900 text-yellow-300 border border-yellow-500 scale-125 shadow-lg'
                        : isEmiliaMode
                        ? 'bg-red-900 text-yellow-300 border border-yellow-500 scale-125'
                        : 'bg-stone-900/80 text-white'
                    } text-[8px]`}
                    >
                    {characterName}
                    </div>

                {/* Sweat particles if fast */}
                {gameState.speedMultiplier > 1.5 && !isEmiliaMode && !isPudanovski && (
                    <div className="absolute -right-4 top-0 text-blue-300 text-xs animate-ping">💦</div>
                )}
                {/* Fire particles for Emilia */}
                {isEmiliaMode && !isPudanovski && (
                    <>
                        <div className="absolute -right-4 -top-2 text-orange-500 text-xs animate-bounce">🔥</div>
                        <div className="absolute -left-4 top-2 text-red-500 text-xs animate-pulse">🔥</div>
                    </>
                )}
                {/* Pudanovski Aura */}
                {isPudanovski && (
                     <>
                        <div className="absolute -right-6 -top-4 text-yellow-300 text-lg animate-spin"><Dumbbell className="w-4 h-4" /></div>
                        <div className="absolute -left-6 top-4 text-purple-300 text-lg animate-bounce"><Dumbbell className="w-4 h-4" /></div>
                     </>
                )}
                </div>
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
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">MARTA<br/><span className="text-amber-500">SMARTA</span></h1>
          <p className="text-stone-400 mb-8 max-w-xs">Hlauptu með Mörtu! Gríptu kaffið, öskraðu <span className="text-amber-300 italic">"Kaffi-og-með-í"</span> og forðastu mjólkina.</p>
          
          <button 
            onClick={startGame}
            className="group relative px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(217,119,6,0.5)]"
          >
            <div className="flex items-center gap-2">
              <Play className="fill-white" />
              <span>BYRJA HLAUP</span>
            </div>
          </button>
          
          <div className="mt-8 text-sm text-stone-500 flex flex-col gap-1">
            <p>Notaðu <span className="px-2 py-1 bg-stone-700 rounded text-stone-200">←</span> <span className="px-2 py-1 bg-stone-700 rounded text-stone-200">→</span> til að beygja</p>
            <p className="text-xs text-stone-600 mt-2">Safnaðu 16 bollum til að fá <span className="text-red-500 font-bold">ELDKÚLUR</span></p>
            <p className="text-xs text-stone-600">Safnaðu 25 bollum til að verða <span className="text-purple-500 font-bold">PUDANOVSKI</span></p>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 z-50 bg-stone-900/95 backdrop-blur-md flex flex-col items-center p-4 overflow-y-auto">
          
          {/* Top Summary */}
          <div className="w-full flex flex-col items-center mt-4 mb-4">
            <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
              <Skull className="w-6 h-6 text-red-500" />
              {isPudanovski ? "PUDANOVSKI SPRAKK!" : isEmiliaMode ? "EMILÍA BRANN ÚT!" : "MARTA KLESSTI!"}
            </h2>
            
            <div className="grid grid-cols-2 gap-8 mt-2 w-full max-w-xs">
              <div className="text-center">
                <div className="text-xs text-stone-400 uppercase">Stig</div>
                <div className="text-3xl font-bold text-white">{gameState.score}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-stone-400 uppercase">Bollar</div>
                <div className="text-3xl font-bold text-amber-500">{gameState.coffeeCount}</div>
              </div>
            </div>

            {/* Roast Box */}
            <div className="mt-4 w-full max-w-sm bg-black/40 p-3 rounded-lg border border-white/10">
               <div className="text-xs text-amber-500/80 font-mono mb-1 uppercase">Álit Barþjóns:</div>
               <div className="text-stone-300 italic text-sm text-center">
                 {isLoadingRoast ? <span className="animate-pulse">Að brugga móðgun...</span> : `"${roastMessage}"`}
               </div>
            </div>
          </div>

          {/* New High Score Input */}
          {isNewHighScore && !scoreSubmitted && (
             <div className="w-full max-w-sm bg-gradient-to-r from-amber-900/50 to-amber-700/50 p-4 rounded-xl border-2 border-amber-500/50 mb-4 animate-in slide-in-from-bottom-5">
                <div className="flex items-center gap-2 mb-2 text-amber-200 font-bold">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span>Nýtt Met! Skráðu þig:</span>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Nafn..."
                        maxLength={12}
                        className="flex-1 bg-black/50 border border-amber-500/30 rounded px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                        autoFocus
                    />
                    <button 
                        onClick={submitScore}
                        disabled={!playerName.trim()}
                        className="bg-amber-500 hover:bg-amber-400 disabled:bg-stone-700 disabled:text-stone-500 text-stone-900 font-bold px-4 py-2 rounded flex items-center gap-1 transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        Vista
                    </button>
                </div>
             </div>
          )}

          {/* Leaderboard Table */}
          <div className="w-full max-w-sm bg-stone-800/80 rounded-xl overflow-hidden mb-6 border border-stone-700">
             <div className="bg-stone-800 p-2 text-center text-xs font-bold uppercase tracking-widest text-stone-400 border-b border-stone-700">
                Mörtu Meistarar
             </div>
             <table className="w-full text-sm">
                <thead>
                    <tr className="text-stone-500 text-xs border-b border-stone-700/50">
                        <th className="py-2 pl-4 text-left">#</th>
                        <th className="py-2 text-left">Nafn</th>
                        <th className="py-2 pr-4 text-right">Stig</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-700/50">
                    {highScores.length === 0 ? (
                        <tr><td colSpan={3} className="py-4 text-center text-stone-600 italic">Engin met skráð ennþá...</td></tr>
                    ) : (
                        highScores.map((entry, idx) => (
                            <tr key={idx} className={`${entry.score === gameState.score && scoreSubmitted && entry.name === playerName ? 'bg-amber-900/30 text-amber-100' : 'text-stone-300'}`}>
                                <td className="py-2 pl-4 font-mono text-stone-500">{idx + 1}</td>
                                <td className="py-2 font-bold">{entry.name}</td>
                                <td className="py-2 pr-4 text-right font-mono text-amber-500">{entry.score}</td>
                            </tr>
                        ))
                    )}
                </tbody>
             </table>
          </div>

          <button 
            onClick={startGame}
            className="px-8 py-3 bg-white text-stone-900 font-bold rounded-full hover:bg-stone-200 transition-colors flex items-center gap-2 shadow-lg mb-8"
          >
            <RotateCcw className="w-4 h-4" />
            REYNA AFTUR
          </button>
        </div>
      )}
      
      {/* Controls Overlay for Emilia/Pudanovski Mode */}
      {isEmiliaMode && gameState.isPlaying && (
         <div className="absolute bottom-4 left-0 right-0 text-center animate-pulse z-40">
            <span className={`inline-block px-4 py-1 text-white text-xs font-bold rounded-full border shadow-lg backdrop-blur-sm ${isPudanovski ? 'bg-purple-600/80 border-purple-400' : 'bg-red-600/80 border-red-400'}`}>
                ÝTTU Á SPACE EÐA SNERTU TIL AÐ SKJÓTA 🔥
            </span>
         </div>
      )}
    </div>
  );
};

export default RunnerGame;