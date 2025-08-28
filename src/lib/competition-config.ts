export const COMPETITION_CONFIG = {
  DURATION_SECONDS: 10, // 10 seconds
  
  DURATION_MS: 10 * 1000, // 10 seconds in milliseconds
  
  FIREBASE_PATHS: {
    COMPETITION: 'competition',
    LEADERBOARD: 'leaderboard'
  },
  
  TIMER: {
    UPDATE_INTERVAL: 1000, // 1 second
    DISPLAY_FORMAT: 'HH:MM:SS'
  }
} as const;

export const getCompetitionDuration = {
  seconds: () => COMPETITION_CONFIG.DURATION_SECONDS,
  milliseconds: () => COMPETITION_CONFIG.DURATION_MS,
  minutes: () => COMPETITION_CONFIG.DURATION_SECONDS / 60,
  hours: () => COMPETITION_CONFIG.DURATION_SECONDS / 3600
};
