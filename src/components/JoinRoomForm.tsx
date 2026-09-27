import React, { useState } from 'react';
import { Hash, ArrowRight, Loader2 } from 'lucide-react';

interface JoinRoomFormProps {
  onJoinRoom: (code: string) => Promise<void>;
  loading?: boolean;
}

export const JoinRoomForm: React.FC<JoinRoomFormProps> = ({ onJoinRoom, loading = false }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('Please enter a 6-character room code.');
      return;
    }

    try {
      await onJoinRoom(cleanCode);
    } catch (err: any) {
      setError(err.message || 'Failed to join room.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Room Code
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Hash className="w-4 h-4 text-gray-500" />
          </div>
          <input
            type="text"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. JC8EBP"
            className="w-full pl-10 pr-4 py-2 text-sm font-mono tracking-widest uppercase bg-[#faf9f5] border border-[#e4e1d7] rounded-lg focus:bg-white focus:outline-hidden focus:border-[#181d27] transition-all text-center sm:text-left"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">
          Enter the 6-character code shared by your friend group.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 bg-[#181d27] hover:bg-black text-white font-medium text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <span>Join Room</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </form>
  );
};
