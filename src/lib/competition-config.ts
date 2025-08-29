export const COMPETITION_CONFIG = {
  DURATION_SECONDS: 20 * 1000 * 60, // 20 minutes

  DURATION_MS: 20 * 1000 * 60, // 20 minutes in milliseconds

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
