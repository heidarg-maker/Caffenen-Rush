export type Lane = -1 | 0 | 1; // Left, Center, Right

export enum EntityType {
  COFFEE = 'COFFEE',
  MILK = 'MILK'
}

export interface Entity {
  id: string;
  lane: Lane;
  y: number; // Percentage down the screen (0-100)
  type: EntityType;
  collected?: boolean;
}

export interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  score: number;
  speedMultiplier: number;
  coffeeCount: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  color: string;
}
