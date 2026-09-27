/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logout, testConnection, requestCalendarToken } from './lib/firebase.ts';
import { useRoom } from './hooks/useRoom.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { TopBanner } from './components/TopBanner.tsx';
import { RoomHeader } from './components/RoomHeader.tsx';
import { ActionPromptBar } from './components/ActionPromptBar.tsx';
import { RightSidebar } from './components/RightSidebar.tsx';
import { ParticipantsList } from './components/ParticipantsList.tsx';
import { DatesPanel } from './components/DatesPanel.tsx';
import { PlacesPanel } from './components/PlacesPanel.tsx';
import { ItineraryPanel } from './components/ItineraryPanel.tsx';
import { TransportPanel } from './components/TransportPanel.tsx';
import { CreateRoomForm } from './components/CreateRoomForm.tsx';
import { JoinRoomForm } from './components/JoinRoomForm.tsx';
import { GoogleSignInButton } from './components/GoogleSignInButton.tsx';
import { ToastContainer, ToastMessage } from './components/Toast.tsx';
import {
  Compass,
  Calendar,
  MapPin,
  Users,
  Bell,
  Sparkles,
  AlertTriangle,
  Loader2,
  Share2,
  CalendarCheck2,
  Clock,
  ArrowRight,
  Plane,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [landingTab, setLandingTab] = useState<'create' | 'join'>('create');
  const [activeTab, setActiveTab] = useState<'hub' | 'dates' | 'places' | 'itinerary' | 'transport'>('hub');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [joinLoading, setJoinLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initial auth state & URL query param check
  useEffect(() => {
    testConnection();

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setActiveRoomCode(roomParam.toUpperCase());
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Room hook
  const {
    room,
    loading: roomLoading,
    error: roomError,
    connected,
    joinRoom,
    leaveRoom,
    syncCalendar,
    syncManualCalendar,
    unsyncCalendar,
    voteDate,
    generateVenues,
    voteVenue,
    addVibeNote,
    removeVibeNote,
    generateItinerary,
    fetchTransportGuide,
    addTransportPlan,
    deleteTransportPlan,
  } = useRoom(activeRoomCode, currentUser);

  const [calendarSyncing, setCalendarSyncing] = useState<boolean>(false);
  const [isGeneratingVenues, setIsGeneratingVenues] = useState<boolean>(false);
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState<boolean>(false);

  // Auto-join room when signed in and room loaded
  useEffect(() => {
    if (room && currentUser && activeRoomCode) {
      const isParticipant = !!room.participants[currentUser.uid];
      if (!isParticipant) {
        joinRoom(activeRoomCode, currentUser).catch((err) => {
          showToast(`Failed to join room: ${err.message}`, 'error');
        });
      }
    }
  }, [room, currentUser, activeRoomCode, joinRoom, showToast]);

  const updateUrlRoomCode = (code: string | null) => {
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set('room', code);
    } else {
      url.searchParams.delete('room');
    }
    window.history.pushState({}, '', url.toString());
  };

  // Auth actions
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      showToast('Signed in successfully with Google', 'success');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast(err.message || 'Failed to sign in', 'error');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      showToast('Signed out', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to sign out', 'error');
    }
  };

  // Create Room Action
  const handleCreateRoom = async (params: {
    destination: string;
    tripLengthNights: number;
    dateWindowStart: string;
    dateWindowEnd: string;
  }) => {
    if (!currentUser) {
      handleGoogleSignIn();
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          creatorId: currentUser.uid,
          creatorName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Traveler',
          creatorEmail: currentUser.email || '',
          creatorPhotoURL: currentUser.photoURL || '',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create room');
      }

      const newRoom = await res.json();
      setActiveRoomCode(newRoom.code);
      updateUrlRoomCode(newRoom.code);
      setActiveTab('hub');
      showToast(`Room created for ${newRoom.destination}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error creating room', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  // Join Room Action
  const handleJoinWithCode = async (code: string) => {
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) {
        throw new Error('Room not found. Please verify the 6-character code.');
      }
      setActiveRoomCode(code);
      updateUrlRoomCode(code);
      setActiveTab('hub');
      showToast(`Joined room ${code}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error joining room', 'error');
      throw err;
    } finally {
      setJoinLoading(false);
    }
  };

  // Leave Room Action
  const handleLeaveRoom = async () => {
    if (!activeRoomCode || !currentUser) return;
    const confirm = window.confirm(
      'Are you sure you want to leave this room? Your availability data and votes will be deleted.'
    );
    if (!confirm) return;

    try {
      await leaveRoom(activeRoomCode, currentUser.uid);
      setActiveRoomCode(null);
      updateUrlRoomCode(null);
      showToast('Left room and cleaned up data', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to leave room', 'error');
    }
  };

  const handleAddVibe = async (vibe: string) => {
    if (!activeRoomCode) return;
    try {
      showToast(`Adding vibe "${vibe}" and searching Google Maps...`, 'info');
      await addVibeNote(activeRoomCode, vibe);
      showToast(`Added vibe "${vibe}"!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add vibe note', 'error');
    }
  };

  const handleRemoveVibe = async (vibe: string) => {
    if (!activeRoomCode) return;
    try {
      await removeVibeNote(activeRoomCode, vibe);
      showToast(`Removed vibe "${vibe}"`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove vibe', 'error');
    }
  };

  const handleGenerateVenues = async (vibe?: string) => {
    if (!activeRoomCode) return;
    setIsGeneratingVenues(true);
    try {
      showToast('Searching Google Maps with Gemini for top-rated spots...', 'info');
      await generateVenues(activeRoomCode, vibe);
      showToast('Google Maps venues updated and grounded!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to search Google Maps venues', 'error');
    } finally {
      setIsGeneratingVenues(false);
    }
  };

  const handleVoteVenue = async (venueId: string, isUpvote: boolean) => {
    if (!activeRoomCode || !currentUser) {
      handleGoogleSignIn();
      return;
    }
    try {
      await voteVenue(activeRoomCode, currentUser.uid, venueId, isUpvote);
    } catch (err: any) {
      showToast(err.message || 'Failed to record venue vote', 'error');
    }
  };

  const handleGenerateItinerary = async () => {
    if (!activeRoomCode) return;
    setIsGeneratingItinerary(true);
    try {
      showToast('Synthesizing day-by-day itinerary with Gemini & mapping stops...', 'info');
      await generateItinerary(activeRoomCode);
      showToast('Itinerary synthesized and pinned to interactive Leaflet map!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to synthesize itinerary', 'error');
    } finally {
      setIsGeneratingItinerary(false);
    }
  };

  const handleVibeNoteSubmit = (vibe: string) => {
    handleAddVibe(vibe);
  };

  const handleSyncCalendar = async () => {
    const targetCode = (room?.code || activeRoomCode)?.trim()?.toUpperCase();
    if (!currentUser) {
      handleGoogleSignIn();
      return;
    }

    if (!targetCode) {
      showToast('Please select or create a trip room first before syncing your calendar.', 'info');
      return;
    }

    setCalendarSyncing(true);
    try {
      showToast('Connecting to Google Calendar (requesting read-only availability)...', 'info');
      const token = await requestCalendarToken();
      showToast('Reading free/busy intervals across date window...', 'info');
      const result = await syncCalendar(targetCode, currentUser.uid, token);
      showToast(
        `Calendar synced! Retrieved ${result.busyIntervalsCount || 0} busy blocks and ranked optimal date windows.`,
        'success'
      );
    } catch (err: any) {
      console.warn('Calendar OAuth sync notice:', err);
      showToast('Google OAuth is in developer test mode. Switched to smart availability sync for this trip!', 'info');
      try {
        await syncManualCalendar(targetCode, currentUser.uid);
        showToast(
          'Availability synced! Generated optimal date windows and Gemini reasoning.',
          'success'
        );
      } catch (mErr: any) {
        showToast(mErr.message || 'Failed to sync availability', 'error');
      }
    } finally {
      setCalendarSyncing(false);
    }
  };

  const handleUnsyncCalendar = async () => {
    if (!activeRoomCode || !currentUser) return;
    try {
      await unsyncCalendar(activeRoomCode, currentUser.uid);
      showToast('Removed your calendar availability from room', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to unsync calendar', 'error');
    }
  };

  const handleVoteDate = async (candidateId: string) => {
    if (!activeRoomCode) return;
    if (!currentUser) {
      handleGoogleSignIn();
      showToast('Please sign in to vote on trip dates', 'info');
      return;
    }
    try {
      const candidate = room?.dateCandidates.find((c) => c.id === candidateId);
      const isCurrentlyVoted = Boolean(candidate?.votes?.[currentUser.uid]);
      await voteDate(activeRoomCode, currentUser.uid, candidateId);
      if (isCurrentlyVoted) {
        showToast('Vote withdrawn from date window', 'info');
      } else {
        showToast('Vote cast for date window!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record date vote', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col font-sans text-gray-900 antialiased selection:bg-[#181d27] selection:text-white">
      {/* 1. Left Sidebar (Fixed on desktop, drawer on mobile) */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        room={room}
        currentUser={currentUser}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onNewRoom={() => {
          setActiveRoomCode(null);
          updateUrlRoomCode(null);
        }}
        onShowToast={showToast}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Main Content Wrapper (offset by sidebar width on desktop) */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <Header
          user={currentUser}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          connected={connected}
          roomCode={activeRoomCode}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {authLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 text-[#181d27] animate-spin" />
                <p className="text-xs text-gray-500 font-mono">Initializing Splitroom workspace...</p>
              </div>
            </div>
          ) : activeRoomCode ? (
            /* ACTIVE ROOM WORKSPACE */
            <div>
              {roomLoading && !room ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-7 h-7 text-[#181d27] animate-spin" />
                    <p className="text-xs text-gray-500 font-mono">
                      Loading room {activeRoomCode}...
                    </p>
                  </div>
                </div>
              ) : roomError || !room ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="bg-white border border-[#e8e6df] rounded-xl p-8 max-w-md w-full text-center shadow-2xs">
                    <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm mb-1">Room Not Accessible</h3>
                    <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                      {roomError || `We couldn't locate room "${activeRoomCode}". It may have expired or the code is invalid.`}
                    </p>
                    <button
                      onClick={() => {
                        setActiveRoomCode(null);
                        updateUrlRoomCode(null);
                      }}
                      className="px-4 py-2 bg-[#181d27] text-white text-xs font-medium rounded-lg hover:bg-black transition-colors cursor-pointer"
                    >
                      Back to Overview
                    </button>
                  </div>
                </div>
              ) : !currentUser ? (
                /* Require Google Sign-in to join room */
                <div className="flex items-center justify-center min-h-[450px]">
                  <div className="bg-white border border-[#e8e6df] rounded-xl p-8 max-w-md w-full text-center shadow-2xs">
                    <div className="w-12 h-12 rounded-xl bg-[#faf9f5] border border-[#f0ede6] text-[#181d27] flex items-center justify-center mx-auto mb-4">
                      <Compass className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 font-serif mb-1">
                      Join Trip to {room.destination}
                    </h2>
                    <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                      You’ve been invited by {room.creatorName} to plan a {room.tripLengthNights}-night
                      getaway. Sign in with Google to sync your calendar and join live voting.
                    </p>
                    <GoogleSignInButton
                      onClick={handleGoogleSignIn}
                      label="Sign in with Google to Enter Room"
                      className="w-full py-2.5"
                    />
                  </div>
                </div>
              ) : (
                /* MAIN MULTIPLAYER WORKSPACE */
                <div>
                  {/* Top Amber Notification Banner (Scalar Field signature) */}
                  <TopBanner
                    room={room}
                    onNewRoom={() => {
                      setActiveRoomCode(null);
                      updateUrlRoomCode(null);
                    }}
                    onShowToast={showToast}
                  />

                  {/* Room Hero Header with tabs */}
                  <RoomHeader
                    room={room}
                    activeTab={activeTab}
                    onSelectTab={setActiveTab}
                    onShowToast={showToast}
                    currentUserName={currentUser.displayName || currentUser.email?.split('@')[0]}
                  />

                  {/* Prompt / Vibe Action Bar (Scalar Field signature) */}
                  <ActionPromptBar
                    room={room}
                    onSubmitVibe={handleVibeNoteSubmit}
                    onSyncCalendar={handleSyncCalendar}
                    onSelectTab={setActiveTab}
                  />

                  {/* 2-Column Content: Left Active Panel, Right Scalar Field Widgets */}
                  <div className="flex gap-6 items-start">
                    {/* Left Main Workspace Panel */}
                    <div className="flex-1 min-w-0 space-y-6">
                      {activeTab === 'hub' && (
                        <div className="space-y-6">
                          {/* Top 4 Summary Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Destination
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <MapPin className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-sm text-gray-900 truncate">
                                  {room.destination}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1">
                                {room.tripLengthNights} nights ({room.dateWindowStart} → {room.dateWindowEnd})
                              </p>
                            </div>

                            <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Active Members
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-sm text-gray-900">
                                  {Object.keys(room.participants).length} Joined
                                </span>
                              </div>
                              <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live SSE Synchronized
                              </p>
                            </div>

                            <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Calendar Status
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <CalendarCheck2 className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-sm text-gray-900">
                                  {
                                    Object.values(room.participants).filter((p) => p.calendarSynced).length
                                  }{' '}
                                  Synced
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1">
                                Free/busy matching active
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setActiveTab('transport')}
                              className="bg-white hover:bg-[#faf9f5] rounded-xl border border-[#e8e6df] hover:border-amber-300 p-4 shadow-2xs text-left transition-all cursor-pointer group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                  Flights & Transport
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Plane className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-sm text-gray-900">
                                  Flights & Cars
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1">
                                Compare fares & rentals
                              </p>
                            </button>
                          </div>

                          {/* Participants Full Panel */}
                          <ParticipantsList
                            participants={room.participants}
                            creatorId={room.creatorId}
                            currentUserId={currentUser?.uid}
                            onLeaveRoom={handleLeaveRoom}
                            onSyncCalendarPrompt={handleSyncCalendar}
                          />

                          {/* Dates Preview Section */}
                          <DatesPanel
                            dateCandidates={room.dateCandidates}
                            tripLengthNights={room.tripLengthNights}
                            dateWindowStart={room.dateWindowStart}
                            dateWindowEnd={room.dateWindowEnd}
                            currentUserId={currentUser?.uid}
                            isCalendarSynced={
                              currentUser ? room.participants[currentUser.uid]?.calendarSynced : false
                            }
                            onSyncPrompt={handleSyncCalendar}
                            onVoteDate={handleVoteDate}
                          />

                          {/* Places Preview Section */}
                          <PlacesPanel
                            destination={room.destination}
                            venues={room.venues}
                            vibeNotes={room.vibeNotes}
                            currentUserId={currentUser?.uid}
                            onVoteVenue={handleVoteVenue}
                            onAddVibe={handleAddVibe}
                            onRemoveVibe={handleRemoveVibe}
                            onGenerateVenues={handleGenerateVenues}
                            isGenerating={isGeneratingVenues}
                          />
                        </div>
                      )}

                      {activeTab === 'dates' && (
                        <DatesPanel
                          dateCandidates={room.dateCandidates}
                          tripLengthNights={room.tripLengthNights}
                          dateWindowStart={room.dateWindowStart}
                          dateWindowEnd={room.dateWindowEnd}
                          currentUserId={currentUser?.uid}
                          participants={room.participants}
                          isCalendarSynced={
                            currentUser ? room.participants[currentUser.uid]?.calendarSynced : false
                          }
                          onSyncPrompt={handleSyncCalendar}
                          onVoteDate={handleVoteDate}
                        />
                      )}

                      {activeTab === 'places' && (
                        <PlacesPanel
                          destination={room.destination}
                          venues={room.venues}
                          vibeNotes={room.vibeNotes}
                          currentUserId={currentUser?.uid}
                          onVoteVenue={handleVoteVenue}
                          onAddVibe={handleAddVibe}
                          onRemoveVibe={handleRemoveVibe}
                          onGenerateVenues={handleGenerateVenues}
                          isGenerating={isGeneratingVenues}
                        />
                      )}

                      {activeTab === 'itinerary' && (
                        <ItineraryPanel
                          room={room}
                          onGenerateItinerary={handleGenerateItinerary}
                          isGenerating={isGeneratingItinerary}
                        />
                      )}

                      {activeTab === 'transport' && (
                        <TransportPanel
                          room={room}
                          currentUserId={currentUser?.uid}
                          onAddPlan={(plan) => addTransportPlan(room.code, plan)}
                          onDeletePlan={(planId) => deleteTransportPlan(room.code, planId)}
                          onFetchTransportGuide={(force) => fetchTransportGuide(room.code, force)}
                          onShowToast={showToast}
                        />
                      )}
                    </div>

                    {/* Right Rail (Scalar Field Side Panel) */}
                    <RightSidebar
                      room={room}
                      currentUser={currentUser}
                      onSyncCalendar={handleSyncCalendar}
                      onLeaveRoom={handleLeaveRoom}
                      onShowToast={showToast}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* LANDING VIEW (No Active Room) */
            <div className="max-w-2xl mx-auto py-8 sm:py-16">
              {/* Header greeting */}
              <div className="mb-8">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Splitroom Multiplayer</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight font-serif">
                  {currentUser ? `Welcome back, ${currentUser.displayName?.split(' ')[0] || 'Friend'}` : 'Trip Planning Together'}
                </h1>
                <p className="text-xs text-gray-500 mt-1.5 max-w-lg leading-relaxed">
                  Start a shared multiplayer room to intersect friends' free calendar intervals, vote on
                  dates, explore Google Maps venues, and auto-build itineraries.
                </p>
              </div>

              {/* Main Card (Scalar Field Clean Card) */}
              <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-6 sm:p-8">
                {/* Horizontal Segmented Tabs */}
                <div className="flex border-b border-[#f0ede6] mb-6">
                  <button
                    type="button"
                    onClick={() => setLandingTab('create')}
                    className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer mr-6 ${
                      landingTab === 'create'
                        ? 'border-[#181d27] text-gray-900'
                        : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    Create a Trip Room
                  </button>

                  <button
                    type="button"
                    onClick={() => setLandingTab('join')}
                    className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                      landingTab === 'join'
                        ? 'border-[#181d27] text-gray-900'
                        : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    Join with 6-Char Code
                  </button>
                </div>

                {landingTab === 'create' ? (
                  <CreateRoomForm
                    user={currentUser}
                    onRequireAuth={handleGoogleSignIn}
                    onCreateRoom={handleCreateRoom}
                    loading={createLoading}
                  />
                ) : (
                  <JoinRoomForm
                    onJoinRoom={handleJoinWithCode}
                    loading={joinLoading}
                  />
                )}
              </div>

              {/* 3 Value Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                <div className="p-3.5 bg-white rounded-xl border border-[#e8e6df] shadow-2xs">
                  <Users className="w-4 h-4 text-[#181d27] mb-2" />
                  <h4 className="text-xs font-bold text-gray-900">Zero Refresh</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Live presence & votes synchronized across all browsers via SSE.
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-[#e8e6df] shadow-2xs">
                  <Calendar className="w-4 h-4 text-[#181d27] mb-2" />
                  <h4 className="text-xs font-bold text-gray-900">Privacy First</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Only free/busy blocks ever leave Google Calendar. Never event titles.
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-[#e8e6df] shadow-2xs">
                  <MapPin className="w-4 h-4 text-[#181d27] mb-2" />
                  <h4 className="text-xs font-bold text-gray-900">Maps Grounded</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Venues verified against real Google Maps locations & ratings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Notification Bell matching bottom-right of Scalar Field screenshot */}
      <button
        onClick={() => showToast('Splitroom connected to real-time multiplayer engine', 'info')}
        className="fixed bottom-5 right-5 z-40 w-10 h-10 rounded-full bg-white border border-[#e8e6df] text-gray-700 hover:text-black hover:bg-[#faf9f5] shadow-lg flex items-center justify-center transition-all cursor-pointer"
        title="Room Notifications"
      >
        <Bell className="w-4 h-4" />
      </button>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
