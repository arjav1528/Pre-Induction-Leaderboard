'use client';

import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, off, push, set } from 'firebase/database';
import { database } from '@/lib/firebase';



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

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(() => {
    const dbRef = ref(database);
    
    const unsubscribe = onValue(dbRef, (snapshot) => {
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

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = fetchLeaderboard();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchLeaderboard]);

  

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center text-gray-600 p-4">
        <p>No leaderboard data available</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        🏆 Game Leaderboard
      </h1>
      
      
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
      
      <div className="mt-6 text-center text-sm text-gray-600">
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className=" font-medium">Made with ❤️ by DevSoc</span>
        </div>
      </div>
    </div>
  );
}
