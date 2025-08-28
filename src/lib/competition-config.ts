// Competition configuration settings
export const COMPETITION_CONFIG = {
  // Competition duration in seconds
  DURATION_SECONDS: 10, // 10 seconds
  
  // Competition duration in milliseconds
  DURATION_MS: 10 * 1000, // 10 seconds in milliseconds
  
  // Firebase paths
  FIREBASE_PATHS: {
    COMPETITION: 'competition',
    LEADERBOARD: 'leaderboard'
  },
  
  // Timer settings
  TIMER: {
    UPDATE_INTERVAL: 1000, // 1 second
    DISPLAY_FORMAT: 'HH:MM:SS'
  }
} as const;

// Helper function to get duration in different units
export const getCompetitionDuration = {
  seconds: () => COMPETITION_CONFIG.DURATION_SECONDS,
  milliseconds: () => COMPETITION_CONFIG.DURATION_MS,
  minutes: () => COMPETITION_CONFIG.DURATION_SECONDS / 60,
  hours: () => COMPETITION_CONFIG.DURATION_SECONDS / 3600
};
