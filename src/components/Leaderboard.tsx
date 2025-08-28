'use client';

import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, off, push, set, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { COMPETITION_CONFIG, getCompetitionDuration } from '@/lib/competition-config';

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  totalScore: number;
  gameScores: {
    escapeRoom: number;
    pacman: number;
    pizzeria: number;
    tetris: number;
  };
}

interface CompetitionState {
  isActive: boolean;
  startTime: number | null;
  endTime: number | null;
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(getCompetitionDuration.seconds()); // Use config
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
  const [competitionState, setCompetitionState] = useState<CompetitionState>({
    isActive: false,
    startTime: null,
    endTime: null
  });
  const [isCompetitionCompleted, setIsCompetitionCompleted] = useState(false);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load competition state from Firebase on component mount
  useEffect(() => {
    const loadCompetitionState = async () => {
      try {
        const competitionRef = ref(database, COMPETITION_CONFIG.FIREBASE_PATHS.COMPETITION);
        const snapshot = await get(competitionRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const state: CompetitionState = {
            isActive: data.isActive || false,
            startTime: data.startTime || null,
            endTime: data.endTime || null
          };
          
          setCompetitionState(state);
          
          // If competition has ended, show completion screen
          if (state.endTime && !state.isActive) {
            setIsCompetitionCompleted(true);
            // Load final leaderboard data
            await loadFinalLeaderboard();
          }
          // If competition is active, calculate remaining time and start timer
          else if (state.isActive && state.startTime) {
            const now = Date.now();
            const elapsed = Math.floor((now - state.startTime) / 1000);
            const remaining = Math.max(0, getCompetitionDuration.seconds() - elapsed); // Use config
            
            if (remaining > 0) {
              setTimeLeft(remaining);
              setIsTimerRunning(true);
            } else {
              // Competition has ended
              await endCompetition();
            }
          }
        }
      } catch (err) {
        console.error('Error loading competition state:', err);
      }
    };

    loadCompetitionState();
  }, []);

  const loadFinalLeaderboard = async () => {
    try {
      setLoading(true);
      const dbRef = ref(database);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const entries: LeaderboardEntry[] = [];
        
        Object.entries(data).forEach(([userId, userData]: [string, any]) => {
          if (userData.user && userData.TotalScore !== undefined) {
            entries.push({
              id: userId,
              name: userData.user.Name || 'Unknown',
              email: userData.user.email || 'No email',
              totalScore: userData.TotalScore || 0,
              gameScores: {
                escapeRoom: userData.EscapeRoomScore || 0,
                pacman: userData.PacmanScore || 0,
                pizzeria: userData.PizzeriaScore || 0,
                tetris: userData.TetrisScore || 0,
              },
            });
          }
        });
        
        entries.sort((a, b) => b.totalScore - a.totalScore);
        setLeaderboard(entries);
        setLoading(false);
      } else {
        setLeaderboard([]);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading final leaderboard:', err);
      setError('Failed to load final results');
      setLoading(false);
    }
  };

  const startTimer = async () => {
    try {
      const startTime = Date.now();
      const endTime = startTime + getCompetitionDuration.milliseconds(); // Use config
      
      // Save to Firebase
      const competitionRef = ref(database, COMPETITION_CONFIG.FIREBASE_PATHS.COMPETITION);
      await set(competitionRef, {
        isActive: true,
        startTime: startTime,
        endTime: endTime
      });

      // Update local state
      setCompetitionState({
        isActive: true,
        startTime: startTime,
        endTime: endTime
      });
      
      setIsTimerRunning(true);
      setIsCompetitionCompleted(false);
      setTimeLeft(getCompetitionDuration.seconds()); // Use config
    } catch (err) {
      console.error('Error starting competition:', err);
      setError('Failed to start competition');
    }
  };

  const endCompetition = async () => {
    try {
      // Save to Firebase
      const competitionRef = ref(database, COMPETITION_CONFIG.FIREBASE_PATHS.COMPETITION);
      await set(competitionRef, {
        isActive: false,
        startTime: competitionState.startTime,
        endTime: Date.now()
      });

      // Update local state
      setCompetitionState(prev => ({
        ...prev,
        isActive: false,
        endTime: Date.now()
      }));

      setIsTimerRunning(false);
      setIsCompetitionCompleted(true);
      if (unsubscribe) {
        unsubscribe();
        setUnsubscribe(null);
      }
      setTimeLeft(0);
      
      // Load final leaderboard data
      await loadFinalLeaderboard();
    } catch (err) {
      console.error('Error ending competition:', err);
    }
  };

  const stopTimer = async () => {
    await endCompetition();
  };

  const resetCompetition = async () => {
    try {
      // Clear Firebase competition state
      const competitionRef = ref(database, COMPETITION_CONFIG.FIREBASE_PATHS.COMPETITION);
      await set(competitionRef, null);
      
      // Reset local state
      setCompetitionState({
        isActive: false,
        startTime: null,
        endTime: null
      });
      setIsCompetitionCompleted(false);
      setTimeLeft(getCompetitionDuration.seconds());
      setLeaderboard([]);
      setError(null);
    } catch (err) {
      console.error('Error resetting competition:', err);
    }
  };

  const fetchLeaderboard = useCallback(() => {
    if (!isTimerRunning) return null;
    
    const dbRef = ref(database);
    
    const unsubscribeFn = onValue(dbRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const entries: LeaderboardEntry[] = [];
          
          Object.entries(data).forEach(([userId, userData]: [string, any]) => {
            if (userData.user && userData.TotalScore !== undefined) {
              entries.push({
                id: userId,
                name: userData.user.Name || 'Unknown',
                email: userData.user.email || 'No email',
                totalScore: userData.TotalScore || 0,
                gameScores: {
                  escapeRoom: userData.EscapeRoomScore || 0,
                  pacman: userData.PacmanScore || 0,
                  pizzeria: userData.PizzeriaScore || 0,
                  tetris: userData.TetrisScore || 0,
                },
              });
            }
          });
          
          entries.sort((a, b) => b.totalScore - a.totalScore);
          setLeaderboard(entries);
          setLoading(false);
          setError(null); 
        } else {
          setLeaderboard([]);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to process leaderboard data');
        setLoading(false);
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setError('Failed to fetch leaderboard data');
      setLoading(false);
    });

    return unsubscribeFn;
  }, [isTimerRunning]);

  useEffect(() => {
    if (isTimerRunning) {
      setLoading(true);
      const unsubscribeFn = fetchLeaderboard();
      if (unsubscribeFn) {
        setUnsubscribe(() => unsubscribeFn);
      }
    }
  }, [fetchLeaderboard, isTimerRunning]);

  useEffect(() => {
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [unsubscribe]);

  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          clearInterval(interval);
          endCompetition();
          return 0;
        }
        return prev - 1;
      });
    }, COMPETITION_CONFIG.TIMER.UPDATE_INTERVAL); // Use config

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Show completion screen with top 3 winners
  if (isCompetitionCompleted) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 text-gray-800">
            🏆 Competition Complete!
          </h1>
          
          {/* Winners Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-700">
              🎉 Top 3 Winners
            </h2>
            
            {loading ? (
              <div className="flex justify-center items-center min-h-[200px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* 1st Place */}
                {leaderboard[0] && (
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-lg p-6 shadow-lg transform hover:scale-105 transition-transform">
                    <div className="text-6xl mb-2">🥇</div>
                    <h3 className="text-xl font-bold mb-2">1st Place</h3>
                    <p className="text-lg font-semibold mb-1">{leaderboard[0].name}</p>
                    <p className="text-sm opacity-90 mb-3">{leaderboard[0].email}</p>
                    <div className="text-3xl font-bold">{leaderboard[0].totalScore}</div>
                    <p className="text-sm opacity-90">Total Score</p>
                  </div>
                )}
                
                {/* 2nd Place */}
                {leaderboard[1] && (
                  <div className="bg-gradient-to-br from-gray-400 to-gray-600 text-white rounded-lg p-6 shadow-lg transform hover:scale-105 transition-transform">
                    <div className="text-6xl mb-2">🥈</div>
                    <h3 className="text-xl font-bold mb-2">2nd Place</h3>
                    <p className="text-lg font-semibold mb-1">{leaderboard[1].name}</p>
                    <p className="text-sm opacity-90 mb-3">{leaderboard[1].email}</p>
                    <div className="text-3xl font-bold">{leaderboard[1].totalScore}</div>
                    <p className="text-sm opacity-90">Total Score</p>
                  </div>
                )}
                
                {/* 3rd Place */}
                {leaderboard[2] && (
                  <div className="bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-lg p-6 shadow-lg transform hover:scale-105 transition-transform">
                    <div className="text-6xl mb-2">🥉</div>
                    <h3 className="text-xl font-bold mb-2">3rd Place</h3>
                    <p className="text-lg font-semibold mb-1">{leaderboard[2].name}</p>
                    <p className="text-sm opacity-90 mb-3">{leaderboard[2].email}</p>
                    <div className="text-3xl font-bold">{leaderboard[2].totalScore}</div>
                    <p className="text-sm opacity-90">Total Score</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-600 p-4">
                <p>No participants in this competition.</p>
              </div>
            )}
          </div>

          {/* Full Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 text-gray-700">Complete Leaderboard</h3>
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                      <tr>
                        <th className="px-6 py-4 text-left font-semibold">Rank</th>
                        <th className="px-6 py-4 text-left font-semibold">Player</th>
                        <th className="px-6 py-4 text-center font-semibold">Total Score</th>
                        <th className="px-6 py-4 text-center font-semibold">Escape Room</th>
                        <th className="px-6 py-4 text-center font-semibold">Pacman</th>
                        <th className="px-6 py-4 text-center font-semibold">Pizzeria</th>
                        <th className="px-6 py-4 text-center font-semibold">Tetris</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {leaderboard.map((entry, index) => (
                        <tr 
                          key={entry.id} 
                          className={`hover:bg-gray-50 transition-colors ${
                            index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {index < 3 && (
                                <span className="mr-2">
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                </span>
                              )}
                              <span className={`font-bold ${
                                index === 0 ? 'text-yellow-600' : 
                                index === 1 ? 'text-gray-600' : 
                                index === 2 ? 'text-orange-600' : 'text-gray-500'
                              }`}>
                                #{index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-semibold text-gray-900">{entry.name}</div>
                              <div className="text-sm text-gray-500">{entry.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-2xl font-bold text-blue-600">
                              {entry.totalScore}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-medium text-gray-700">
                              {entry.gameScores.escapeRoom}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-medium text-gray-700">
                              {entry.gameScores.pacman}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-medium text-gray-700">
                              {entry.gameScores.pizzeria}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-medium text-gray-700">
                              {entry.gameScores.tetris}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={resetCompetition}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              🔄 Start New Competition
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isTimerRunning && timeLeft === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            🏆 Game Leaderboard
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
            <p className="text-lg text-gray-600 mb-6">
              Click the start button to begin the leaderboard competition!
            </p>
            <button
              onClick={startTimer}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              🚀 Start Competition
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        🏆 Game Leaderboard
      </h1>
      
      {/* Timer Display */}
      <div className="text-center mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-4 inline-block">
          <div className="text-sm font-medium mb-1">Time Remaining</div>
          <div className="text-4xl font-bold font-mono">
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="text-center mb-6">
        {isTimerRunning ? (
          <button
            onClick={stopTimer}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            ⏹️ Stop Competition
          </button>
        ) : (
          <button
            onClick={startTimer}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            🚀 Start Competition
          </button>
        )}
      </div>

      {/* Status Indicator */}
      <div className="text-center mb-6">
        <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
          isTimerRunning 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${
            isTimerRunning ? 'bg-green-500' : 'bg-gray-500'
          }`}></span>
          {isTimerRunning ? 'Competition Active - Fetching Data' : 'Competition Inactive'}
        </div>
      </div>
      
      {/* Loading State */}
      {loading && isTimerRunning && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center text-red-600 p-4">
          <p>Error: {error}</p>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && leaderboard.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Rank</th>
                  <th className="px-6 py-4 text-left font-semibold">Player</th>
                  <th className="px-6 py-4 text-center font-semibold">Total Score</th>
                  <th className="px-6 py-4 text-center font-semibold">Escape Room</th>
                  <th className="px-6 py-4 text-center font-semibold">Pacman</th>
                  <th className="px-6 py-4 text-center font-semibold">Pizzeria</th>
                  <th className="px-6 py-4 text-center font-semibold">Tetris</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((entry, index) => (
                  <tr 
                    key={entry.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {index < 3 && (
                          <span className="mr-2">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                        <span className={`font-bold ${
                          index === 0 ? 'text-yellow-600' : 
                          index === 1 ? 'text-gray-600' : 
                          index === 2 ? 'text-orange-600' : 'text-gray-500'
                        }`}>
                          #{index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">{entry.name}</div>
                        <div className="text-sm text-gray-500">{entry.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {entry.totalScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-medium text-gray-700">
                        {entry.gameScores.escapeRoom}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-medium text-gray-700">
                        {entry.gameScores.pacman}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-medium text-gray-700">
                        {entry.gameScores.pizzeria}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-medium text-gray-700">
                        {entry.gameScores.tetris}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {!loading && leaderboard.length === 0 && isTimerRunning && (
        <div className="text-center text-gray-600 p-4">
          <p>No leaderboard data available yet. Data will appear as players complete games.</p>
        </div>
      )}
      
      <div className="mt-6 text-center text-sm text-gray-600">
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className=" font-medium">Made with ❤️ by DevSoc</span>
        </div>
      </div>
    </div>
  );
}
