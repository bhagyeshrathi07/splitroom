import React from 'react';
import { Menu, Compass, LogOut, Radio, Sparkles } from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton.tsx';

interface HeaderProps {
  user: any;
  onSignIn: () => void;
  onSignOut: () => void;
  connected?: boolean;
  roomCode?: string | null;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onSignIn,
  onSignOut,
  connected,
  roomCode,
  onOpenMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#faf9f6]/90 backdrop-blur-md border-b border-[#e8e6df] h-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
        {/* Mobile Brand & Menu trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 text-gray-600 hover:text-black hover:bg-[#eae7df] rounded-md transition-colors cursor-pointer"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 md:hidden">
            <div className="w-6 h-6 rounded-md bg-[#181d27] text-white flex items-center justify-center font-bold text-xs">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="font-semibold text-sm text-[#111827] font-serif">
              Splitroom
            </span>
          </div>

          {/* Desktop Breadcrumbs / Status */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="text-gray-400">Workspace</span>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-800">
              {roomCode ? `Room ${roomCode}` : 'Trips Overview'}
            </span>

            {roomCode && (
              <div
                className={`ml-2 flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>{connected ? 'Realtime Connected' : 'Connecting...'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-white border border-[#e8e6df] rounded-full py-1 pl-1 pr-3 shadow-2xs">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-6 h-6 rounded-full object-cover border border-[#e4e1d7]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#181d27] text-white flex items-center justify-center font-bold text-[10px]">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-gray-800 max-w-[120px] truncate hidden sm:inline">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>

              <button
                onClick={onSignOut}
                title="Sign out"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-[#eae7df] rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="px-3 py-1.5 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
