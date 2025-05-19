// app/rewards/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  getAllRewardTransactions,
  getUserById,
  getUserByEmail,
} from "@/utils/db/actions";
import { Loader, Award, User as UserIcon, Trophy, Crown } from "lucide-react";
import { toast } from "react-hot-toast";

type LeaderboardEntry = {
  userId: number;
  userName: string;
  points: number;
  level: number;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        // 1️⃣ Get all transactions
        const txs = await getAllRewardTransactions();

        // 2️⃣ Keep only positive earns
        const earned = txs.filter((t) => t.type.startsWith("earned"));

        // 3️⃣ Sum per userId
        const totals = earned.reduce((map, { userId, amount }) => {
          map.set(userId, (map.get(userId) || 0) + amount);
          return map;
        }, new Map<number, number>());

        // 4️⃣ Build entries, fetching each user’s name
        const rows: LeaderboardEntry[] = [];
        for (const [userId, points] of totals.entries()) {
          const user = await getUserById(userId);
          rows.push({
            userId,
            userName: user?.name ?? "Unknown",
            points,
            level: Math.floor(points / 100) + 1, // adjust per your leveling logic
          });
        }

        // 5️⃣ Sort descending
        rows.sort((a, b) => b.points - a.points);
        setEntries(rows);

        // 6️⃣ Highlight currently logged-in user
        const email = localStorage.getItem("userEmail");
        if (email) {
          const me = await getUserByEmail(email);
          if (me) setCurrentUserId(me.id);
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load leaderboard.");
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8 text-gray-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Leaderboard</h1>
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white flex justify-between items-center">
          <Trophy className="h-10 w-10" />
          <span className="text-2xl font-bold">Top Performers</span>
          <Award className="h-10 w-10" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["Rank", "User", "Points", "Level"].map((t) => (
                  <th
                    key={t}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((row, i) => (
                <tr
                  key={row.userId}
                  className={`${
                    row.userId === currentUserId ? "bg-indigo-50" : ""
                  } hover:bg-gray-50 transition-colors`}
                >
                  <td className="px-6 py-4">
                    {i < 3 ? (
                      <Crown
                        className={`h-6 w-6 ${
                          i === 0
                            ? "text-yellow-400"
                            : i === 1
                            ? "text-gray-400"
                            : "text-yellow-600"
                        }`}
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">
                        {i + 1}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-gray-200 p-2">
                        <UserIcon className="h-full w-full text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {row.userName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Award className="h-5 w-5 text-indigo-500 mr-2" />
                      <span className="text-sm font-semibold text-gray-900">
                        {row.points.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 inline-flex text-sm font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      Level {row.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
