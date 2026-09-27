import { useEffect, useState, useRef, useCallback } from 'react';
import type { RoomState, Participant } from '../types/index.ts';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

export function useRoom(roomCode: string | null, currentUser: any) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatTimerRef = useRef<any>(null);

  // Function to fetch room from API / Firestore directly
  const fetchRoom = useCallback(async (code: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rooms/${code}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data);
        setError(null);
        return;
      }

      // Fallback: try direct Firestore read if API returned 404 or had issue
      if (db) {
        try {
          const docRef = doc(db, 'rooms', code);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setRoom(snap.data() as RoomState);
            setError(null);
            return;
          }
        } catch (fErr) {
          console.warn('Firestore fallback fetch error:', fErr);
        }
      }

      setError('Room not found. Check the code and try again.');
    } catch (err: any) {
      console.error('Error fetching room:', err);
      setError(err.message || 'Failed to load room');
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect SSE for real-time multiplayer updates
  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      setLoading(false);
      return;
    }

    const uid = currentUser?.uid || '';
    fetchRoom(roomCode);

    // Set up SSE stream
    const sseUrl = `/api/rooms/${roomCode}/stream?uid=${encodeURIComponent(uid)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const updatedRoom = JSON.parse(event.data);
        setRoom(updatedRoom);
        setLoading(false);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource automatically retries
    };

    // Firestore fallback listener in case SSE is interrupted
    let unsubscribeFirestore: (() => void) | null = null;
    if (db && roomCode) {
      const roomDocRef = doc(db, 'rooms', roomCode);
      unsubscribeFirestore = onSnapshot(
        roomDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as RoomState;
            // Only update if not already received newer or matching state
            setRoom((prev) => {
              if (!prev) return data;
              if (new Date(data.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
                return data;
              }
              return prev;
            });
          }
        },
        (fErr) => {
          console.warn('Firestore snapshot error (non-fatal):', fErr);
        }
      );
    }

    // Heartbeat every 12 seconds while connected
    heartbeatTimerRef.current = setInterval(() => {
      if (currentUser?.uid && roomCode) {
        fetch(`/api/rooms/${roomCode}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: currentUser.uid }),
        }).catch(() => {});
      }
    }, 12000);

    return () => {
      es.close();
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (unsubscribeFirestore) unsubscribeFirestore();
      setConnected(false);
    };
  }, [roomCode, currentUser?.uid, fetchRoom]);

  // Join room mutation
  const joinRoom = useCallback(async (code: string, user: any) => {
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'Traveler',
          email: user.email || '',
          photoURL: user.photoURL || '',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join room');
      }
      const data = await res.json();
      setRoom(data);
      return data;
    } catch (err: any) {
      console.error('Error joining room:', err);
      throw err;
    }
  }, []);

  // Leave room mutation
  const leaveRoom = useCallback(async (code: string, uid: string) => {
    try {
      const res = await fetch(`/api/rooms/${code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      if (!res.ok) throw new Error('Failed to leave room');
      setRoom(null);
    } catch (err: any) {
      console.error('Error leaving room:', err);
      throw err;
    }
  }, []);

  // Sync Calendar
  const syncCalendar = useCallback(async (code: string, uid: string, accessToken: string) => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || cleanCode === 'NULL' || cleanCode === 'UNDEFINED') {
      throw new Error('Please select or create a trip room before syncing your calendar.');
    }

    try {
      const res = await fetch(`/api/rooms/${cleanCode}/sync-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, accessToken }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(
          res.status === 404
            ? `Room ${cleanCode} was not found on the server.`
            : `Server returned non-JSON response (${res.status}): ${text.slice(0, 80)}`
        );
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync calendar');
      }
      if (data.room) {
        setRoom(data.room);
      }
      return data;
    } catch (err: any) {
      console.error('Error syncing calendar:', err);
      throw err;
    }
  }, []);

  // Unsync Calendar
  const unsyncCalendar = useCallback(async (code: string, uid: string) => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return;
    try {
      const res = await fetch(`/api/rooms/${cleanCode}/unsync-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      if (!res.ok) throw new Error('Failed to unsync calendar');
      const data = await res.json();
      if (data.room) setRoom(data.room);
      return data;
    } catch (err: any) {
      console.error('Error unsyncing calendar:', err);
      throw err;
    }
  }, []);

  // Sync Manual / Demo Calendar Availability (fallback when OAuth is restricted)
  const syncManualCalendar = useCallback(
    async (code: string, uid: string, busyIntervals?: any[]) => {
      const cleanCode = (code || '').trim().toUpperCase();
      if (!cleanCode || cleanCode === 'NULL' || cleanCode === 'UNDEFINED') {
        throw new Error('Please select or create a trip room first.');
      }

      try {
        const res = await fetch(`/api/rooms/${cleanCode}/sync-manual-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, busyIntervals }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(
            res.status === 404
              ? `Room ${cleanCode} was not found on the server.`
              : `Server returned non-JSON response (${res.status}): ${text.slice(0, 80)}`
          );
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to sync manual availability');
        if (data.room) setRoom(data.room);
        return data;
      } catch (err: any) {
        console.error('Error syncing manual calendar:', err);
        throw err;
      }
    },
    []
  );

  // Vote Date
  const voteDate = useCallback(
    async (code: string, uid: string, candidateId: string) => {
      // Optimistic UI update
      setRoom((prev) => {
        if (!prev) return prev;
        const updatedCandidates = (prev.dateCandidates || []).map((c) => {
          if (c.id === candidateId) {
            const currentVote = !!c.votes?.[uid];
            return {
              ...c,
              votes: {
                ...(c.votes || {}),
                [uid]: !currentVote,
              },
            };
          }
          return c;
        });
        return { ...prev, dateCandidates: updatedCandidates };
      });

      try {
        const res = await fetch(`/api/rooms/${code}/vote-date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, candidateId }),
        });
        if (!res.ok) throw new Error('Failed to vote on date');
        const data = await res.json();
        if (data.room) setRoom(data.room);
      } catch (err: any) {
        console.error('Error voting on date:', err);
        fetchRoom(code);
        throw err;
      }
    },
    [fetchRoom]
  );

  // Generate Google Maps Venues
  const generateVenues = useCallback(
    async (code: string, vibe?: string) => {
      try {
        const res = await fetch(`/api/rooms/${code}/venues/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vibe }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to search Google Maps venues');
        }
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data.venues || [];
      } catch (err: any) {
        console.error('Error generating venues:', err);
        throw err;
      }
    },
    []
  );

  // Vote Venue (Upvote/Downvote with optimistic update)
  const voteVenue = useCallback(
    async (code: string, uid: string, venueId: string, isUpvote: boolean) => {
      // Optimistic local update
      setRoom((prev) => {
        if (!prev) return prev;
        const updatedVenues = (prev.venues || []).map((v) => {
          if (v.id === venueId) {
            let upvotes = [...(v.upvotes || [])];
            let downvotes = [...(v.downvotes || [])];

            if (isUpvote) {
              if (upvotes.includes(uid)) {
                upvotes = upvotes.filter((id) => id !== uid);
              } else {
                upvotes.push(uid);
                downvotes = downvotes.filter((id) => id !== uid);
              }
            } else {
              if (downvotes.includes(uid)) {
                downvotes = downvotes.filter((id) => id !== uid);
              } else {
                downvotes.push(uid);
                upvotes = upvotes.filter((id) => id !== uid);
              }
            }

            return { ...v, upvotes, downvotes };
          }
          return v;
        });

        return { ...prev, venues: updatedVenues };
      });

      try {
        const res = await fetch(`/api/rooms/${code}/venues/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, venueId, isUpvote }),
        });
        if (!res.ok) throw new Error('Failed to record venue vote');
        const data = await res.json();
        if (data.room) setRoom(data.room);
      } catch (err: any) {
        console.error('Error voting on venue:', err);
        fetchRoom(code);
        throw err;
      }
    },
    [fetchRoom]
  );

  // Add Vibe Note (triggers re-generation)
  const addVibeNote = useCallback(
    async (code: string, vibe: string) => {
      try {
        const res = await fetch(`/api/rooms/${code}/vibes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vibe }),
        });
        if (!res.ok) throw new Error('Failed to add vibe note');
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data;
      } catch (err: any) {
        console.error('Error adding vibe note:', err);
        throw err;
      }
    },
    []
  );

  // Remove Vibe Note
  const removeVibeNote = useCallback(
    async (code: string, vibe: string) => {
      try {
        const res = await fetch(`/api/rooms/${code}/vibes`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vibe }),
        });
        if (!res.ok) throw new Error('Failed to remove vibe note');
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data;
      } catch (err: any) {
        console.error('Error removing vibe note:', err);
        throw err;
      }
    },
    []
  );

  // Generate or Regenerate Trip Itinerary
  const generateItinerary = useCallback(
    async (code: string, dateRangeId?: string) => {
      try {
        const res = await fetch(`/api/rooms/${code}/itinerary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateRangeId }),
        });
        if (!res.ok) throw new Error('Failed to generate itinerary');
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data.itinerary;
      } catch (err: any) {
        console.error('Error generating itinerary:', err);
        throw err;
      }
    },
    []
  );

  // Fetch or Synthesize Transport Guide
  const fetchTransportGuide = useCallback(
    async (code: string, forceRefresh: boolean = false) => {
      try {
        const res = await fetch(`/api/rooms/${code}/transport-guide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRefresh }),
        });
        if (!res.ok) throw new Error('Failed to fetch transport guide');
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data.guide;
      } catch (err: any) {
        console.error('Error fetching transport guide:', err);
        throw err;
      }
    },
    []
  );

  // Add Member Transport Plan (flight, train, etc.)
  const addTransportPlan = useCallback(
    async (code: string, planData: any) => {
      try {
        const res = await fetch(`/api/rooms/${code}/transport-plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planData),
        });
        if (!res.ok) throw new Error('Failed to add transport plan');
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data.plan;
      } catch (err: any) {
        console.error('Error adding transport plan:', err);
        throw err;
      }
    },
    []
  );

  // Delete Member Transport Plan
  const deleteTransportPlan = useCallback(
    async (code: string, planId: string) => {
      try {
        const res = await fetch(`/api/rooms/${code}/transport-plans/${planId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete transport plan');
        const data = await res.json();
        if (data.room) setRoom(data.room);
      } catch (err: any) {
        console.error('Error deleting transport plan:', err);
        throw err;
      }
    },
    []
  );

  // Update Budget Estimates
  const updateBudget = useCallback(
    async (code: string, budgetData: any) => {
      try {
        const res = await fetch(`/api/rooms/${code}/budget`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(budgetData),
        });
        if (!res.ok) throw new Error('Failed to update budget');
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data.budget;
      } catch (err: any) {
        console.error('Error updating budget:', err);
        throw err;
      }
    },
    []
  );

  // Add Custom Budget Item
  const addBudgetItem = useCallback(
    async (code: string, itemData: any) => {
      try {
        const res = await fetch(`/api/rooms/${code}/budget/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemData),
        });
        if (!res.ok) throw new Error('Failed to add budget item');
        const data = await res.json();
        if (data.room) setRoom(data.room);
        return data.item;
      } catch (err: any) {
        console.error('Error adding budget item:', err);
        throw err;
      }
    },
    []
  );

  // Delete Custom Budget Item
  const deleteBudgetItem = useCallback(
    async (code: string, itemId: string) => {
      try {
        const res = await fetch(`/api/rooms/${code}/budget/items/${itemId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete budget item');
        const data = await res.json();
        if (data.room) setRoom(data.room);
      } catch (err: any) {
        console.error('Error deleting budget item:', err);
        throw err;
      }
    },
    []
  );

  return {
    room,
    loading,
    error,
    connected,
    fetchRoom,
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
    updateBudget,
    addBudgetItem,
    deleteBudgetItem,
  };
}
