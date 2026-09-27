import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import type { RoomState, Participant, DateCandidate, Venue, PlaceSuggestion, Itinerary, ItineraryDay, ItineraryStop, MemberTransportPlan, TransportGuide, BudgetItem, TripBudget } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini SDK with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Initialize Firebase for server persistence
let db: any = null;
try {
  const firebaseApp = initializeApp(firebaseConfig, 'server-app');
  db = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);
  console.log('Firebase initialized on server');
} catch (err) {
  console.warn('Failed to init Firebase on server, continuing with in-memory persistence:', err);
}

// In-memory room store & SSE subscribers
const rooms = new Map<string, RoomState>();
const roomSubscribers = new Map<string, Set<{ res: Response; uid: string }>>();

// Helper to broadcast room state to all connected SSE clients
function broadcast(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const subs = roomSubscribers.get(roomCode);
  if (!subs || subs.size === 0) return;

  const payload = `data: ${JSON.stringify(room)}\n\n`;
  for (const client of subs) {
    try {
      client.res.write(payload);
    } catch {
      subs.delete(client);
    }
  }
}

// Checkpoint room to Firestore (non-blocking with timeout safeguard)
function persistRoom(room: RoomState) {
  if (!db) return;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Firestore write timeout')), 2500)
  );
  const roomRef = doc(db, 'rooms', room.code);
  Promise.race([
    setDoc(roomRef, {
      ...room,
      updatedAt: new Date().toISOString(),
    }),
    timeoutPromise,
  ]).catch((err) => {
    console.warn('Firestore checkpoint warning:', (err as any).message);
  });
}

// Load room from Firestore if missing from memory
async function loadRoom(code: string): Promise<RoomState | null> {
  const inMemory = rooms.get(code);
  if (inMemory) return inMemory;

  if (!db) return null;
  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore read timeout')), 2500)
    );
    const snap: any = await Promise.race([
      getDoc(doc(db, 'rooms', code)),
      timeoutPromise,
    ]);
    if (snap?.exists?.()) {
      const data = snap.data() as RoomState;
      rooms.set(code, data);
      return data;
    }
  } catch (err: any) {
    console.warn('Firestore load warning:', err.message);
  }
  return null;
}

// Periodic presence cleanup: marks members offline if no heartbeat in 25s
setInterval(() => {
  const now = Date.now();
  let changed = false;

  for (const [code, room] of rooms.entries()) {
    const subs = roomSubscribers.get(code);
    const activeUids = new Set<string>();
    if (subs) {
      for (const client of subs) {
        activeUids.add(client.uid);
      }
    }

    let roomUpdated = false;
    for (const [uid, participant] of Object.entries(room.participants)) {
      const lastSeen = new Date(participant.lastSeenAt || participant.joinedAt).getTime();
      const isOnline = activeUids.has(uid) || now - lastSeen < 30000;

      if (participant.online !== isOnline) {
        participant.online = isOnline;
        roomUpdated = true;
      }
    }

    room.activeOnlineUids = Array.from(activeUids);

    if (roomUpdated) {
      changed = true;
      broadcast(code);
    }
  }
}, 10000);

async function computeDateCandidates(room: RoomState): Promise<DateCandidate[]> {
  const syncedParticipants = Object.values(room.participants).filter((p) => p.calendarSynced);
  if (syncedParticipants.length === 0) {
    return [];
  }

  const startObj = new Date(room.dateWindowStart + 'T00:00:00Z');
  const endObj = new Date(room.dateWindowEnd + 'T23:59:59Z');
  const tripNights = room.tripLengthNights;

  const msPerDay = 24 * 60 * 60 * 1000;
  const candidates: DateCandidate[] = [];

  let currentStart = new Date(startObj);
  const maxStart = new Date(endObj.getTime() - tripNights * msPerDay);

  const existingVotesMap = new Map<string, { [uid: string]: boolean }>();
  for (const c of room.dateCandidates || []) {
    existingVotesMap.set(c.id, c.votes || {});
  }

  while (currentStart <= maxStart) {
    const currentEnd = new Date(currentStart.getTime() + tripNights * msPerDay);
    const startIso = currentStart.toISOString().split('T')[0];
    const endIso = currentEnd.toISOString().split('T')[0];
    const candidateId = `${startIso}_${endIso}`;

    let weekendNights = 0;
    for (let i = 0; i < tripNights; i++) {
      const d = new Date(currentStart.getTime() + i * msPerDay);
      const dayOfWeek = d.getUTCDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        weekendNights++;
      }
    }

    const freeMembers: string[] = [];
    const busyMembers: string[] = [];

    const tripStartMs = currentStart.getTime();
    const tripEndMs = currentEnd.getTime();

    for (const p of syncedParticipants) {
      const busyList = room.userBusyTimes[p.uid] || [];
      const isBusy = busyList.some((interval) => {
        const bStart = new Date(interval.start).getTime();
        const bEnd = new Date(interval.end).getTime();
        return bStart < tripEndMs && bEnd > tripStartMs;
      });

      if (isBusy) {
        busyMembers.push(p.displayName);
      } else {
        freeMembers.push(p.displayName);
      }
    }

    candidates.push({
      id: candidateId,
      startDate: startIso,
      endDate: endIso,
      nights: tripNights,
      freeCount: freeMembers.length,
      totalSynced: syncedParticipants.length,
      freeMembers,
      busyMembers,
      weekendNights,
      votes: existingVotesMap.get(candidateId) || {},
    });

    currentStart = new Date(currentStart.getTime() + msPerDay);
  }

  candidates.sort((a, b) => {
    if (b.freeCount !== a.freeCount) return b.freeCount - a.freeCount;
    if (b.weekendNights !== a.weekendNights) return b.weekendNights - a.weekendNights;
    return a.startDate.localeCompare(b.startDate);
  });

  const topCandidates = candidates.slice(0, 6);

  if (topCandidates.length > 0 && process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Write a short, engaging 1-sentence reason for each of the following trip date candidates for a group trip to ${room.destination}.
Total synced members: ${syncedParticipants.length}.

Candidates:
${topCandidates
  .slice(0, 3)
  .map(
    (c, i) =>
      `#${i + 1}: ${c.startDate} to ${c.endDate} (${c.nights} nights, ${c.weekendNights} weekend nights). Free members: [${c.freeMembers.join(', ')}]. Busy/conflict members: [${c.busyMembers.join(', ')}].`
  )
  .join('\n')}

Format output as a JSON array of strings corresponding to the 3 candidates in order:
["Reason 1", "Reason 2", "Reason 3"]
Keep each reason under 20 words, natural and helpful (e.g. "Everyone is free and it covers a full weekend without conflicts").`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          parsed.forEach((reason, idx) => {
            if (topCandidates[idx] && typeof reason === 'string') {
              topCandidates[idx].reason = reason;
            }
          });
        }
      }
    } catch (err: any) {
      console.warn('Gemini date reasoning notice (using fallback):', err?.message || err);
    }
  }

  // Ensure every candidate has an informative reason even if Gemini hits rate limits
  topCandidates.forEach((c) => {
    if (!c.reason) {
      if (c.freeCount === syncedParticipants.length && syncedParticipants.length > 0) {
        c.reason = `All ${syncedParticipants.length} group members are free with ${c.weekendNights} weekend nights.`;
      } else if (c.weekendNights >= 2) {
        c.reason = `Maximizes weekend coverage with ${c.freeCount} free members and minimal weekday conflicts.`;
      } else {
        c.reason = `Optimal window matching group availability for a ${c.nights}-night stay.`;
      }
    }
  });

  return topCandidates;
}

function getFallbackVenues(destination: string, vibeNotes: string[] = []): Venue[] {
  const vibesDesc = vibeNotes.length > 0 ? ` (${vibeNotes.join(', ')})` : '';
  const city = destination.split(',')[0].trim();

  return [
    {
      id: `venue_lodging_1_${Date.now()}`,
      name: `${city} Grand Heritage Hotel`,
      category: 'lodging',
      rating: 4.8,
      address: `Historic Center, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} Grand Heritage Hotel, ${destination}`)}`,
      summary: `Centrally positioned boutique lodging offering spacious rooms and walkable access to all main quarters. Perfect group basecamp${vibesDesc}.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_lodging_2_${Date.now()}`,
      name: `${city} Riverside Sanctuary`,
      category: 'lodging',
      rating: 4.7,
      address: `Waterfront District, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} Riverside Sanctuary, ${destination}`)}`,
      summary: `Modern and scenic hotel featuring skyline terrace vistas and peaceful ambiance right on the river. Highly rated for traveling friend groups.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_lodging_3_${Date.now()}`,
      name: `The Urban Loft & Suites`,
      category: 'lodging',
      rating: 4.6,
      address: `Arts Quarter, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Urban Loft & Suites, ${destination}`)}`,
      summary: `Stylish boutique suites with communal kitchen areas and vibrant social lounge. Ideal balance of affordability and comfort.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_food_1_${Date.now()}`,
      name: `${city} Central Artisan Market`,
      category: 'food',
      rating: 4.9,
      address: `Old Town Square, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} Central Market, ${destination}`)}`,
      summary: `Vibrant food hall packed with local street culinary masters, craft coffees, and tapas stalls. Everyone in the group gets to pick their favorite cravings.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_food_2_${Date.now()}`,
      name: `Rooftop Terrace & Bistro`,
      category: 'food',
      rating: 4.7,
      address: `Downtown Panorama, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Rooftop Terrace Restaurant, ${destination}`)}`,
      summary: `Panoramic outdoor dining serving modern regional cuisine and sunset spritzes. Celebrated cocktail program and buzzing evening atmosphere.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_food_3_${Date.now()}`,
      name: `Heritage Roast Coffee & Bakery`,
      category: 'food',
      rating: 4.8,
      address: `Botanical Alley, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Specialty Coffee Bakery, ${destination}`)}`,
      summary: `Neighborhood micro-roastery renowned for single-origin pour-overs and fresh-baked flaky pastries. Great morning meeting spot before daily excursions.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_activity_1_${Date.now()}`,
      name: `${city} Cultural Landmark & Gardens`,
      category: 'activity',
      rating: 4.9,
      address: `Historic District, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} Landmark and Gardens, ${destination}`)}`,
      summary: `Iconic cultural grounds featuring breathtaking architecture, tranquil garden paths, and panoramic view decks. An absolute must-visit landmark.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_activity_2_${Date.now()}`,
      name: `Sunset Harbor & Scenic Promenade`,
      category: 'activity',
      rating: 4.8,
      address: `Coastline Boulevard, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} Harbor Promenade, ${destination}`)}`,
      summary: `Lively pedestrian esplanade filled with street musicians, open plazas, and golden-hour boat tours. Ideal for an evening group stroll.`,
      upvotes: [],
      downvotes: [],
    },
    {
      id: `venue_activity_3_${Date.now()}`,
      name: `Modern Contemporary Arts Pavilion`,
      category: 'activity',
      rating: 4.6,
      address: `Museum Quarter, ${destination}`,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} Modern Art Museum, ${destination}`)}`,
      summary: `Immersive modern art exhibits and interactive installations in a striking architectural venue. Stimulating and memorable group experience.`,
      upvotes: [],
      downvotes: [],
    },
  ];
}

// In-memory cache for generated venues to prevent quota exhaustion
const venuesCache = new Map<string, Venue[]>();

async function generateVenuesWithGrounding(
  destination: string,
  vibeNotes: string[] = []
): Promise<Venue[]> {
  const cacheKey = `${destination.toLowerCase().trim()}::${[...vibeNotes].sort().join(',')}`;
  if (venuesCache.has(cacheKey)) {
    return venuesCache.get(cacheKey)!;
  }

  const vibesPrompt =
    vibeNotes.length > 0
      ? `The group provided these specific vibe notes and preferences: "${vibeNotes.join(', ')}". Tailor the venues to match these vibes.`
      : `Provide real, highly-rated, authentic local gems.`;

  const prompt = `You are an expert local guide scouting places for a group vacation to ${destination}.
${vibesPrompt}

Recommend 9 to 12 distinct, real places in ${destination}, covering all 3 categories:
- 3 to 4 Lodging venues (hotels, boutique stays, scenic group rentals)
- 3 to 4 Food & Drink venues (cafes, dinner spots, food halls, cocktails)
- 3 to 4 Activities & Attractions (sights, walking tours, viewpoints, evening venues)

For each place, output EXACTLY in this format separated by triple dashes (---):
NAME: [Exact Name]
CATEGORY: [lodging, food, or activity]
RATING: [Number from 4.0 to 5.0, e.g. 4.7]
ADDRESS: [Address or neighborhood in ${destination}]
SUMMARY: [Two vivid, engaging sentences describing what makes this place special for the group.]
---`;

  let venues: Venue[] = [];

  try {
    let responseText = '';
    let groundingChunks: any[] = [];

    // 1. Try with Google Maps grounding
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });
      responseText = response.text || '';
      groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    } catch (mapsErr: any) {
      console.warn('Google Maps grounding notice (falling back to standard Gemini):', mapsErr?.message || mapsErr);
      // 2. Retry without tools if Maps grounding quota was exceeded
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      responseText = fallbackResponse.text || '';
    }

    const blocks = responseText.split(/---+/).map((b) => b.trim()).filter(Boolean);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const nameMatch = block.match(/NAME:\s*(.+)/i);
      const categoryMatch = block.match(/CATEGORY:\s*(.+)/i);
      const ratingMatch = block.match(/RATING:\s*([\d\.]+)/i);
      const addressMatch = block.match(/ADDRESS:\s*(.+)/i);
      const summaryMatch = block.match(/SUMMARY:\s*([\s\S]+?)(?=(NAME:|CATEGORY:|RATING:|ADDRESS:|SUMMARY:|$))/i);

      if (nameMatch) {
        const name = nameMatch[1].trim().replace(/^\*+|\*+$/g, '');
        let rawCat = (categoryMatch?.[1] || 'activity').toLowerCase().trim();
        let category: 'lodging' | 'food' | 'activity' = 'activity';
        if (
          rawCat.includes('lodg') ||
          rawCat.includes('hotel') ||
          rawCat.includes('stay') ||
          rawCat.includes('hostel')
        ) {
          category = 'lodging';
        } else if (
          rawCat.includes('food') ||
          rawCat.includes('din') ||
          rawCat.includes('rest') ||
          rawCat.includes('cafe') ||
          rawCat.includes('drink') ||
          rawCat.includes('bar')
        ) {
          category = 'food';
        }

        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.6;
        const address = addressMatch ? addressMatch[1].trim() : `${destination}`;
        const summary = summaryMatch
          ? summaryMatch[1].trim().replace(/\n+/g, ' ')
          : `A standout venue in ${destination} tailored for your group trip.`;

        // Match with Google Maps grounding chunk if present
        let mapsUri = '';
        for (const chunk of groundingChunks) {
          if (chunk.maps?.uri) {
            const chunkTitle = (chunk.maps.title || '').toLowerCase();
            if (
              chunkTitle &&
              (name.toLowerCase().includes(chunkTitle) || chunkTitle.includes(name.toLowerCase()))
            ) {
              mapsUri = chunk.maps.uri;
              break;
            }
          }
        }

        if (!mapsUri) {
          mapsUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            name + ', ' + destination
          )}`;
        }

        venues.push({
          id: `venue_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          category,
          rating: isNaN(rating) ? 4.6 : Math.min(5.0, Math.max(3.0, rating)),
          address,
          mapsUri,
          summary,
          upvotes: [],
          downvotes: [],
        });
      }
    }
  } catch (err: any) {
    console.warn('Gemini venue search notice (using curated local venues):', err?.message || err);
  }

  if (venues.length < 6) {
    venues = getFallbackVenues(destination, vibeNotes);
  }

  if (venuesCache.size > 200) {
    venuesCache.clear();
  }
  venuesCache.set(cacheKey, venues);

  return venues;
}

function generateFallbackItinerary(
  room: RoomState,
  candidate: DateCandidate | undefined,
  numDays: number,
  startDateStr: string,
  centerLat: number,
  centerLng: number
): Itinerary {
  const venues = room.venues || [];
  const foodVenues = venues.filter((v) => v.category === 'food');
  const activityVenues = venues.filter((v) => v.category === 'activity');

  const days: ItineraryDay[] = [];
  const themes = [
    'Arrival & Neighborhood Orientation',
    'Historic Landmarks & Local Markets',
    'Scenic Viewpoints & Sunset Gathering',
    'Art & Culinary Exploration',
    'Coastal/Countryside Adventure',
    'Farewell Brunch & Hidden Alleys',
  ];

  for (let i = 0; i < numDays; i++) {
    const dayNumber = i + 1;
    const dayDate = new Date(startDateStr);
    dayDate.setDate(dayDate.getDate() + i);
    const dateFormatted = dayDate.toISOString().split('T')[0];

    const act1 = activityVenues[i % Math.max(1, activityVenues.length)];
    const food1 = foodVenues[i % Math.max(1, foodVenues.length)];
    const act2 = activityVenues[(i + 1) % Math.max(1, activityVenues.length)];
    const food2 = foodVenues[(i + 1) % Math.max(1, foodVenues.length)];

    const stops: ItineraryStop[] = [
      {
        id: `stop_${dayNumber}_1_${Math.random().toString(36).slice(2, 6)}`,
        title: act1 ? act1.name : `Morning Walking Tour of ${room.destination}`,
        timeOfDay: 'Morning',
        description: act1 ? act1.summary || 'Kick off the day exploring this top-rated local attraction.' : `Start the day exploring the vibrant central district of ${room.destination}.`,
        address: act1?.address || room.destination,
        coordinates: {
          lat: centerLat + ((i * 0.008) - 0.004),
          lng: centerLng + (((i + 1) * 0.007) - 0.003),
        },
        mapsUri: act1?.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act1?.name || room.destination)}`,
      },
      {
        id: `stop_${dayNumber}_2_${Math.random().toString(36).slice(2, 6)}`,
        title: food1 ? food1.name : `Local Market Lunch in ${room.destination}`,
        timeOfDay: 'Afternoon',
        description: food1 ? food1.summary || 'Enjoy a leisurely group lunch with regional specialties.' : 'Sit down together for a relaxed lunch featuring authentic regional dishes.',
        address: food1?.address || room.destination,
        coordinates: {
          lat: centerLat + ((i * 0.006) + 0.005),
          lng: centerLng - ((i * 0.005) + 0.004),
        },
        mapsUri: food1?.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(food1?.name || room.destination)}`,
      },
      {
        id: `stop_${dayNumber}_3_${Math.random().toString(36).slice(2, 6)}`,
        title: act2 ? act2.name : `Afternoon Sightseeing & Cultural Stroll`,
        timeOfDay: 'Evening',
        description: act2 ? act2.summary || 'Discover picturesque views and cultural landmarks.' : 'Experience the lively ambiance as the city lights up for the evening.',
        address: act2?.address || room.destination,
        coordinates: {
          lat: centerLat - ((i * 0.007) + 0.003),
          lng: centerLng + ((i * 0.008) - 0.006),
        },
        mapsUri: act2?.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act2?.name || room.destination)}`,
      },
      {
        id: `stop_${dayNumber}_4_${Math.random().toString(36).slice(2, 6)}`,
        title: food2 ? food2.name : `Group Dinner & Evening Drinks`,
        timeOfDay: 'Night',
        description: food2 ? food2.summary || 'Wind down the night with shared plates and local wine.' : 'Celebrate another wonderful day with shared drinks and conversations.',
        address: food2?.address || room.destination,
        coordinates: {
          lat: centerLat + ((i * 0.005) - 0.002),
          lng: centerLng + ((i * 0.006) + 0.003),
        },
        mapsUri: food2?.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(food2?.name || room.destination)}`,
      },
    ];

    days.push({
      dayNumber,
      date: dateFormatted,
      theme: themes[i % themes.length],
      stops,
    });
  }

  return {
    id: `itin_${Date.now()}`,
    title: `${room.destination} Group Experience`,
    summary: `A carefully balanced ${numDays}-day schedule prioritizing group consensus, local food, and landmark sights across ${room.destination}.`,
    days,
    generatedAt: new Date().toISOString(),
    selectedDateRangeId: candidate?.id || 'default_window',
  };
}

async function synthesizeItinerary(room: RoomState, dateRangeId?: string): Promise<Itinerary> {
  // 1. Pick target candidate
  let candidate = room.dateCandidates.find((c) => c.id === dateRangeId);
  if (!candidate && room.dateCandidates.length > 0) {
    candidate = [...room.dateCandidates].sort((a, b) => {
      const aVotes = Object.values(a.votes || {}).filter(Boolean).length;
      const bVotes = Object.values(b.votes || {}).filter(Boolean).length;
      if (bVotes !== aVotes) return bVotes - aVotes;
      return b.freeCount - a.freeCount;
    })[0];
  }

  const startDateStr = candidate ? candidate.startDate : room.dateWindowStart;
  const numDays = Math.min(6, Math.max(2, candidate?.nights || room.tripLengthNights || 3));
  const centerLat = room.coordinates?.lat || 35.0116;
  const centerLng = room.coordinates?.lng || 135.7681;

  // Upvoted or top venues
  const topVenues = [...(room.venues || [])]
    .sort((a, b) => ((b.upvotes?.length || 0) - (b.downvotes?.length || 0)) - ((a.upvotes?.length || 0) - (a.downvotes?.length || 0)))
    .slice(0, 10);

  const venuesContext = topVenues.length > 0
    ? `Incorporate these top group-voted venues: ${topVenues.map((v) => `${v.name} (${v.category}: ${v.address})`).join('; ')}.`
    : `Include real iconic landmarks, authentic local food spots, and scenic group attractions.`;

  const prompt = `Synthesize a comprehensive ${numDays}-day group trip itinerary for ${room.destination}.
Start date: ${startDateStr}.
${venuesContext}
The group vibe preferences: ${room.vibeNotes.join(', ') || 'cultural exploration, great dining, group gatherings'}.

Format as JSON matching this schema:
{
  "title": "${room.destination} Group Expedition",
  "summary": "2-sentence inspiring overview of the trip flow.",
  "days": [
    {
      "dayNumber": 1,
      "date": "${startDateStr}",
      "theme": "Theme title for Day 1",
      "stops": [
        {
          "title": "Specific Stop/Place Name",
          "timeOfDay": "Morning",
          "description": "Engaging 1-2 sentence description of what the group does here.",
          "address": "Street address or neighborhood in ${room.destination}",
          "latOffsetKm": 0.5,
          "lngOffsetKm": -0.8
        }
      ]
    }
  ]
}
Include exactly 3 to 4 stops per day (e.g. Morning, Afternoon, Evening, and optionally Night).
Ensure valid JSON only without markdown formatting.`;

  let itinerary: Itinerary | null = null;

  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
          const days: ItineraryDay[] = parsed.days.map((d: any, dayIdx: number) => {
            const dayDate = new Date(startDateStr);
            dayDate.setDate(dayDate.getDate() + dayIdx);
            const dateIso = dayDate.toISOString().split('T')[0];

            const stops: ItineraryStop[] = (d.stops || []).map((s: any, stopIdx: number) => {
              const latOff = typeof s.latOffsetKm === 'number' ? s.latOffsetKm : (stopIdx * 0.4 - 0.6);
              const lngOff = typeof s.lngOffsetKm === 'number' ? s.lngOffsetKm : (dayIdx * 0.5 - 0.5);

              // 1 km ~ 1/111 deg lat, 1 km ~ 1/(111 * cos(lat)) deg lng
              const lat = centerLat + (latOff / 111);
              const lng = centerLng + (lngOff / (111 * Math.cos((centerLat * Math.PI) / 180)));

              return {
                id: `stop_${dayIdx + 1}_${stopIdx + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: s.title || `Highlight Stop #${stopIdx + 1}`,
                timeOfDay: (['Morning', 'Afternoon', 'Evening', 'Night'].includes(s.timeOfDay) ? s.timeOfDay : 'Morning') as any,
                description: s.description || `Explore this top location in ${room.destination}.`,
                address: s.address || `${room.destination}`,
                coordinates: { lat, lng },
                mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.title}, ${room.destination}`)}`,
              };
            });

            return {
              dayNumber: d.dayNumber || dayIdx + 1,
              date: d.date || dateIso,
              theme: d.theme || `Day ${dayIdx + 1} Discovery`,
              stops,
            };
          });

          itinerary = {
            id: `itin_${Date.now()}`,
            title: parsed.title || `${room.destination} Group Itinerary`,
            summary: parsed.summary || `A curated ${numDays}-day journey across ${room.destination} tailored for your group.`,
            days,
            generatedAt: new Date().toISOString(),
            selectedDateRangeId: candidate?.id || 'default_window',
          };
        }
      }
    } catch (err: any) {
      console.warn('Gemini itinerary synthesis notice (falling back to curated plan):', err?.message || err);
    }
  }

  // Fallback itinerary generator if Gemini is unavailable or at rate limit
  if (!itinerary) {
    itinerary = generateFallbackItinerary(room, candidate, numDays, startDateStr, centerLat, centerLng);
  }

  return itinerary;
}

async function synthesizeTransportGuide(destination: string): Promise<TransportGuide> {
  const cleanDest = destination.trim();
  const fallbackGuide: TransportGuide = {
    destination: cleanDest,
    airports: [
      {
        name: `${cleanDest} International Airport`,
        iata: cleanDest.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'INT',
        distance: '14 km from central district',
        transitTime: '25-35 minutes',
      },
    ],
    airportTransfers: [
      {
        mode: 'Express Airport Train / Shuttle',
        description: 'Fast rail connection or direct express bus service linking terminals directly to downtown plazas.',
        duration: '25-30 mins',
        estimatedCost: '$6 - $12 per passenger',
      },
      {
        mode: 'Official Airport Taxi / Rideshare',
        description: 'Taxis queue right outside terminal arrivals. Predictable fares with luggage capacity for small groups.',
        duration: '20-40 mins (traffic dependent)',
        estimatedCost: '$30 - $50 per vehicle',
      },
      {
        mode: 'Metropolitan Subway / Transit Line',
        description: 'Cost-effective public transit line connecting directly into the city network.',
        duration: '35-50 mins',
        estimatedCost: '$3 - $6 per ride',
      },
    ],
    publicTransit: {
      systemName: `${cleanDest} Transit Network`,
      recommendedPass: 'Multi-Day Tourist Transit Pass or 10-Ride Shared Card',
      passPrice: '$15 - $30 for 3 to 5 days',
      summary: 'Comprehensive subway, tram, and bus network providing seamless access to top attractions and dining districts.',
      usefulApps: ['Citymapper', 'Google Maps', 'Local Transit Official App'],
    },
    carRentalAdvice: {
      isRecommended: false,
      reason: 'Dense city streets, restricted vehicle access zones, and costly parking make walking and transit faster inside the city.',
      parkingAdvice: 'Reserve hotel parking in advance or use designated underground garages; avoid street parking without local permits.',
      recommendedDayTrips: [
        'Scenic Coastal Drives & Beach Towns',
        'Mountain Monasteries & Hiking Trails',
        'Historic Wine Country & Vineyard Estates',
      ],
      recommendedVehicle: 'Compact 7-passenger Minivan or crossover SUV if touring with the full group outside the city',
    },
    trainStations: [
      {
        name: `${cleanDest} Central Railway Station`,
        notes: 'Main regional hub for high-speed rail lines and regional intercity connections.',
      },
    ],
  };

  if (!process.env.GEMINI_API_KEY) {
    return fallbackGuide;
  }

  try {
    const prompt = `You are an elite travel logistics and transport coordinator.
Generate a structured, accurate, and practical transport & flight logistics guide for travelers visiting: "${cleanDest}".

Provide exact realistic details for this destination:
1. Primary commercial airports serving this destination (official full names, real 3-letter IATA codes, distance to city center, transit time).
2. Best airport transfer options (Express train/bus line names, taxi/rideshare estimates, subway).
3. Public transit advice (name of local metro/bus system, best tourist pass name with realistic pricing, practical tip, top mobile transit apps).
4. Car rental analysis (is renting a car recommended for this specific destination? Explain why or why not, parking caveats, 3 great day trip destinations that justify a car, recommended group vehicle type).
5. Primary intercity railway stations.

Output strictly valid JSON with this structure:
{
  "destination": "${cleanDest}",
  "airports": [
    {
      "name": "string",
      "iata": "string",
      "distance": "string",
      "transitTime": "string"
    }
  ],
  "airportTransfers": [
    {
      "mode": "string",
      "description": "string",
      "duration": "string",
      "estimatedCost": "string"
    }
  ],
  "publicTransit": {
    "systemName": "string",
    "recommendedPass": "string",
    "passPrice": "string",
    "summary": "string",
    "usefulApps": ["app1", "app2"]
  },
  "carRentalAdvice": {
    "isRecommended": boolean,
    "reason": "string",
    "parkingAdvice": "string",
    "recommendedDayTrips": ["trip 1", "trip 2", "trip 3"],
    "recommendedVehicle": "string"
  },
  "trainStations": [
    {
      "name": "string",
      "notes": "string"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.airports) && parsed.airports.length > 0) {
        return parsed as TransportGuide;
      }
    }
    return fallbackGuide;
  } catch (err: any) {
    console.warn('Gemini transport guide synthesis notice (using curated fallback):', err?.message || err);
    return fallbackGuide;
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory cache for open-source map search
  const placeCache = new Map<string, PlaceSuggestion[]>();

  // OpenStreetMap Location Autocomplete (free open source alternative via Photon & Nominatim)
  app.get('/api/places/autocomplete', async (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || '').trim();
      if (!query || query.length < 2) {
        return res.json({ suggestions: [] });
      }

      const cacheKey = query.toLowerCase();
      if (placeCache.has(cacheKey)) {
        return res.json({ suggestions: placeCache.get(cacheKey) });
      }

      const suggestions: PlaceSuggestion[] = [];
      const seenNames = new Set<string>();

      // 1. Try Photon (OpenStreetMap search engine by Komoot, optimized for typeahead)
      try {
        const photonRes = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=en&limit=8`,
          {
            headers: {
              'User-Agent': 'SplitroomTravelPlanner/1.0 (https://splitroom.app)',
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(3000),
          }
        );

        if (photonRes.ok) {
          const data = (await photonRes.json()) as any;
          if (Array.isArray(data?.features)) {
            for (const f of data.features) {
              const props = f.properties || {};
              const coords = f.geometry?.coordinates;
              if (!coords || coords.length < 2) continue;

              const name = props.name || props.city || props.state;
              if (!name) continue;

              const parts = [props.city, props.state, props.country]
                .filter(Boolean)
                .filter((part: string) => part !== name);
              const secondaryText = Array.from(new Set(parts)).join(', ');
              const fullText = secondaryText ? `${name}, ${secondaryText}` : name;

              const normKey = fullText.toLowerCase();
              if (seenNames.has(normKey)) continue;
              seenNames.add(normKey);

              suggestions.push({
                id: `osm_${props.osm_type || 'p'}_${props.osm_id || Math.random()}`,
                name,
                secondaryText,
                fullText,
                lat: Number(coords[1]),
                lng: Number(coords[0]),
                countryCode: props.countrycode?.toUpperCase(),
                type: props.type || props.osm_value || 'destination',
              });
            }
          }
        }
      } catch (photonErr) {
        console.warn('Photon OSM search notice (falling back to Nominatim):', photonErr);
      }

      // 2. Fall back to OpenStreetMap Nominatim if Photon yielded few results
      if (suggestions.length < 3) {
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              query
            )}&limit=6&addressdetails=1&accept-language=en`,
            {
              headers: {
                'User-Agent': 'SplitroomTravelPlanner/1.0 (contact: info@splitroom.app)',
                'Accept': 'application/json',
              },
              signal: AbortSignal.timeout(3500),
            }
          );

          if (nomRes.ok) {
            const nomData = (await nomRes.json()) as any[];
            if (Array.isArray(nomData)) {
              for (const item of nomData) {
                const name = item.name || item.display_name?.split(',')[0];
                const fullText = item.display_name || name;
                const normKey = fullText.toLowerCase();
                if (seenNames.has(normKey)) continue;
                seenNames.add(normKey);

                const addr = item.address || {};
                const parts = [
                  addr.city || addr.town || addr.municipality,
                  addr.state || addr.province,
                  addr.country,
                ]
                  .filter(Boolean)
                  .filter((p: string) => p !== name);
                const secondaryText = Array.from(new Set(parts)).join(', ');

                suggestions.push({
                  id: `nom_${item.place_id || Math.random()}`,
                  name,
                  secondaryText: secondaryText || (fullText.includes(',') ? fullText.split(',').slice(1).join(',').trim() : ''),
                  fullText,
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon),
                  countryCode: addr.country_code?.toUpperCase(),
                  type: item.type || item.addresstype || 'city',
                });
              }
            }
          }
        } catch (nomErr) {
          console.warn('Nominatim OSM search notice:', nomErr);
        }
      }

      // Sort cities / administrative boundaries towards top
      suggestions.sort((a, b) => {
        const isCityA = a.type === 'city' || a.type === 'administrative' || a.type === 'town' ? 1 : 0;
        const isCityB = b.type === 'city' || b.type === 'administrative' || b.type === 'town' ? 1 : 0;
        return isCityB - isCityA;
      });

      const finalSuggestions = suggestions.slice(0, 8);
      if (placeCache.size > 500) {
        placeCache.clear();
      }
      placeCache.set(cacheKey, finalSuggestions);

      res.json({ suggestions: finalSuggestions });
    } catch (err: any) {
      console.error('Error in OSM autocomplete:', err);
      res.status(500).json({ error: 'Failed to search places', suggestions: [] });
    }
  });

  // OpenStreetMap Reverse Geocoding
  app.get('/api/places/reverse', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(String(req.query.lat));
      const lng = parseFloat(String(req.query.lng));
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1&accept-language=en`,
        {
          headers: {
            'User-Agent': 'SplitroomTravelPlanner/1.0 (contact: info@splitroom.app)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(3500),
        }
      );

      if (!nomRes.ok) {
        return res.status(nomRes.status).json({ error: 'Reverse geocode failed' });
      }

      const data = (await nomRes.json()) as any;
      const addr = data.address || {};
      const cityName = addr.city || addr.town || addr.municipality || addr.state || data.name;
      const country = addr.country || '';
      const destination = [cityName, country].filter(Boolean).join(', ');

      res.json({
        destination: destination || data.display_name,
        lat,
        lng,
        displayName: data.display_name,
      });
    } catch (err: any) {
      console.error('Reverse geocode error:', err);
      res.status(500).json({ error: 'Reverse geocoding failed' });
    }
  });

  // 1. Create Room
  app.post('/api/rooms', async (req: Request, res: Response) => {
    try {
      const {
        destination,
        coordinates,
        tripLengthNights,
        dateWindowStart,
        dateWindowEnd,
        creatorId,
        creatorName,
        creatorEmail,
        creatorPhotoURL,
      } = req.body;

      if (!destination || !tripLengthNights || !dateWindowStart || !dateWindowEnd || !creatorId) {
        return res.status(400).json({ error: 'Missing required room fields' });
      }

      let code = generateRoomCode();
      while (rooms.has(code)) {
        code = generateRoomCode();
      }

      const now = new Date().toISOString();
      const creatorParticipant: Participant = {
        uid: creatorId,
        displayName: creatorName || 'Trip Organizer',
        email: creatorEmail || '',
        photoURL: creatorPhotoURL || '',
        calendarSynced: false,
        online: true,
        joinedAt: now,
        lastSeenAt: now,
      };

      const newRoom: RoomState = {
        code,
        creatorId,
        creatorName: creatorName || 'Trip Organizer',
        destination: destination.trim(),
        coordinates:
          coordinates &&
          typeof coordinates.lat === 'number' &&
          typeof coordinates.lng === 'number'
            ? { lat: coordinates.lat, lng: coordinates.lng }
            : undefined,
        tripLengthNights: Number(tripLengthNights),
        dateWindowStart,
        dateWindowEnd,
        createdAt: now,
        updatedAt: now,
        vibeNotes: [],
        participants: {
          [creatorId]: creatorParticipant,
        },
        userBusyTimes: {},
        dateCandidates: [],
        venues: [],
        itinerary: null,
        activeOnlineUids: [creatorId],
      };

      rooms.set(code, newRoom);
      await persistRoom(newRoom);

      res.status(201).json(newRoom);
    } catch (err: any) {
      console.error('Failed to create room:', err);
      res.status(500).json({ error: err.message || 'Failed to create room' });
    }
  });

  // 2. Get Room
  app.get('/api/rooms/:code', async (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = await loadRoom(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  });

  // 3. Join Room
  app.post('/api/rooms/:code/join', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const { uid, displayName, email, photoURL } = req.body;
      if (!uid || !displayName) {
        return res.status(400).json({ error: 'uid and displayName are required' });
      }

      const now = new Date().toISOString();
      const existing = room.participants[uid];

      room.participants[uid] = {
        uid,
        displayName: displayName || 'Traveler',
        email: email || '',
        photoURL: photoURL || '',
        calendarSynced: existing ? existing.calendarSynced : false,
        online: true,
        joinedAt: existing ? existing.joinedAt : now,
        lastSeenAt: now,
      };

      if (!room.activeOnlineUids.includes(uid)) {
        room.activeOnlineUids.push(uid);
      }

      room.updatedAt = now;
      broadcast(code);
      await persistRoom(room);

      res.json(room);
    } catch (err: any) {
      console.error('Failed to join room:', err);
      res.status(500).json({ error: err.message || 'Failed to join room' });
    }
  });

  // 4. Presence Heartbeat
  app.post('/api/rooms/:code/presence', async (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { uid } = req.body;
    if (uid && room.participants[uid]) {
      room.participants[uid].lastSeenAt = new Date().toISOString();
      room.participants[uid].online = true;
      if (!room.activeOnlineUids.includes(uid)) {
        room.activeOnlineUids.push(uid);
      }
      broadcast(code);
    }
    res.json({ ok: true });
  });

  // 5. Leave Room (and delete busy data)
  app.post('/api/rooms/:code/leave', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { uid } = req.body;
      if (uid && room.participants[uid]) {
        delete room.participants[uid];
        delete room.userBusyTimes[uid];
        room.activeOnlineUids = room.activeOnlineUids.filter((id) => id !== uid);

        // Remove votes cast by this user
        for (const candidate of room.dateCandidates) {
          delete candidate.votes[uid];
        }
        for (const venue of room.venues) {
          venue.upvotes = venue.upvotes.filter((id) => id !== uid);
          venue.downvotes = venue.downvotes.filter((id) => id !== uid);
        }

        // Recompute date candidates if participants changed
        room.dateCandidates = await computeDateCandidates(room);

        room.updatedAt = new Date().toISOString();
        broadcast(code);
        await persistRoom(room);
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Failed to leave room:', err);
      res.status(500).json({ error: err.message || 'Failed to leave room' });
    }
  });

  // 6. Sync Google Calendar Availability
  app.post('/api/rooms/:code/sync-calendar', async (req: Request, res: Response) => {
    try {
      const code = req.params.code?.toUpperCase()?.trim();
      if (!code || code === 'NULL' || code === 'UNDEFINED') {
        return res.status(400).json({ error: 'Valid room code is required' });
      }

      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { uid, accessToken, displayName, email, photoURL } = req.body;
      if (!uid || !accessToken) {
        return res.status(400).json({ error: 'uid and accessToken are required' });
      }

      // Auto-join participant if not yet present in room
      if (!room.participants[uid]) {
        room.participants[uid] = {
          uid,
          displayName: displayName || email?.split('@')[0] || 'Traveler',
          email: email || '',
          photoURL: photoURL || '',
          calendarSynced: false,
          online: true,
          joinedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        };
        if (!room.activeOnlineUids.includes(uid)) {
          room.activeOnlineUids.push(uid);
        }
      }

      // Query Google Calendar FreeBusy API for only the date window
      const timeMin = new Date(room.dateWindowStart + 'T00:00:00Z').toISOString();
      const timeMax = new Date(room.dateWindowEnd + 'T23:59:59Z').toISOString();

      const freeBusyRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          items: [{ id: 'primary' }],
        }),
      });

      if (!freeBusyRes.ok) {
        const errText = await freeBusyRes.text();
        console.error('Google Calendar freeBusy error:', freeBusyRes.status, errText);
        return res.status(freeBusyRes.status).json({
          error: `Google Calendar freeBusy API error: ${freeBusyRes.statusText}`,
          details: errText,
        });
      }

      const freeBusyData = await freeBusyRes.json();
      const busy = (freeBusyData.calendars?.primary?.busy || []).map((b: any) => ({
        start: b.start,
        end: b.end,
      }));

      // Store busy intervals (never event titles or private details)
      room.userBusyTimes[uid] = busy;
      room.participants[uid].calendarSynced = true;
      room.participants[uid].lastSeenAt = new Date().toISOString();

      // Intersect schedules and generate ranked windows with Gemini reasons
      room.dateCandidates = await computeDateCandidates(room);

      room.updatedAt = new Date().toISOString();
      broadcast(code);
      await persistRoom(room);

      res.json({ ok: true, room, busyIntervalsCount: busy.length });
    } catch (err: any) {
      console.error('Error syncing calendar:', err);
      res.status(500).json({ error: err.message || 'Failed to sync calendar' });
    }
  });

  // 6b. Sync Manual / Demo Calendar Availability (fallback when OAuth project is unverified)
  app.post('/api/rooms/:code/sync-manual-calendar', async (req: Request, res: Response) => {
    try {
      const code = req.params.code?.toUpperCase()?.trim();
      if (!code || code === 'NULL' || code === 'UNDEFINED') {
        return res.status(400).json({ error: 'Valid room code is required' });
      }

      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: `Room ${code} not found` });

      const { uid, busyIntervals, displayName, email, photoURL } = req.body;
      if (!uid) return res.status(400).json({ error: 'uid is required' });

      // Auto-join participant if not yet present in room
      if (!room.participants[uid]) {
        room.participants[uid] = {
          uid,
          displayName: displayName || email?.split('@')[0] || 'Traveler',
          email: email || '',
          photoURL: photoURL || '',
          calendarSynced: false,
          online: true,
          joinedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        };
        if (!room.activeOnlineUids.includes(uid)) {
          room.activeOnlineUids.push(uid);
        }
      }

      let busy = busyIntervals;
      if (!busy || !Array.isArray(busy)) {
        // Generate 2 sample realistic busy intervals within the window
        const start = new Date(room.dateWindowStart + 'T00:00:00Z').getTime();
        const end = new Date(room.dateWindowEnd + 'T23:59:59Z').getTime();
        const duration = end - start;

        const b1Start = new Date(start + duration * 0.25);
        const b1End = new Date(b1Start.getTime() + 2 * 24 * 60 * 60 * 1000);

        const b2Start = new Date(start + duration * 0.65);
        const b2End = new Date(b2Start.getTime() + 1.5 * 24 * 60 * 60 * 1000);

        busy = [
          { start: b1Start.toISOString(), end: b1End.toISOString() },
          { start: b2Start.toISOString(), end: b2End.toISOString() },
        ];
      }

      room.userBusyTimes[uid] = busy;
      room.participants[uid].calendarSynced = true;
      room.participants[uid].lastSeenAt = new Date().toISOString();

      room.dateCandidates = await computeDateCandidates(room);
      room.updatedAt = new Date().toISOString();
      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room, busyIntervalsCount: busy.length });
    } catch (err: any) {
      console.error('Error syncing manual calendar:', err);
      res.status(500).json({ error: err.message || 'Failed to sync availability' });
    }
  });

  // 7. Unsync Calendar (Privacy control)
  app.post('/api/rooms/:code/unsync-calendar', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { uid } = req.body;
      if (uid && room.participants[uid]) {
        room.participants[uid].calendarSynced = false;
        delete room.userBusyTimes[uid];
        room.dateCandidates = await computeDateCandidates(room);
        room.updatedAt = new Date().toISOString();
        broadcast(code);
        await persistRoom(room);
      }
      res.json({ ok: true, room });
    } catch (err: any) {
      console.error('Error unsyncing calendar:', err);
      res.status(500).json({ error: err.message || 'Failed to unsync calendar' });
    }
  });

  // 8. Vote on Date Candidate
  app.post('/api/rooms/:code/vote-date', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { uid, candidateId } = req.body;
      if (!uid || !candidateId) {
        return res.status(400).json({ error: 'uid and candidateId are required' });
      }

      const candidate = room.dateCandidates.find((c) => c.id === candidateId);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate date window not found' });
      }

      if (!candidate.votes) {
        candidate.votes = {};
      }

      // One-tap voting per member (toggle)
      candidate.votes[uid] = !candidate.votes[uid];

      room.updatedAt = new Date().toISOString();
      broadcast(code);
      await persistRoom(room);

      res.json({ ok: true, room });
    } catch (err: any) {
      console.error('Error voting on date:', err);
      res.status(500).json({ error: err.message || 'Failed to vote on date' });
    }
  });

  // 9. Generate Venues with Google Maps Grounding
  app.post('/api/rooms/:code/venues/generate', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { vibe } = req.body;
      if (vibe && typeof vibe === 'string' && !room.vibeNotes.includes(vibe.trim())) {
        room.vibeNotes.push(vibe.trim());
      }

      const generated = await generateVenuesWithGrounding(room.destination, room.vibeNotes);

      // Preserve existing votes if venue name matches
      const existingVotesMap = new Map<string, { upvotes: string[]; downvotes: string[] }>();
      for (const v of room.venues || []) {
        existingVotesMap.set(v.name.toLowerCase().trim(), {
          upvotes: v.upvotes || [],
          downvotes: v.downvotes || [],
        });
      }

      for (const v of generated) {
        const existing = existingVotesMap.get(v.name.toLowerCase().trim());
        if (existing) {
          v.upvotes = existing.upvotes;
          v.downvotes = existing.downvotes;
        }
      }

      room.venues = generated;
      room.updatedAt = new Date().toISOString();
      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, venues: room.venues, room });
    } catch (err: any) {
      console.error('Failed to generate venues:', err);
      res.status(500).json({ error: err.message || 'Failed to search venues' });
    }
  });

  // 10. Vote on Venue (Upvote / Downvote)
  app.post('/api/rooms/:code/venues/vote', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { uid, venueId, isUpvote } = req.body;
      if (!uid || !venueId) {
        return res.status(400).json({ error: 'uid and venueId are required' });
      }

      const venue = (room.venues || []).find((v) => v.id === venueId);
      if (!venue) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      if (!venue.upvotes) venue.upvotes = [];
      if (!venue.downvotes) venue.downvotes = [];

      if (isUpvote) {
        if (venue.upvotes.includes(uid)) {
          venue.upvotes = venue.upvotes.filter((id) => id !== uid);
        } else {
          venue.upvotes.push(uid);
          venue.downvotes = venue.downvotes.filter((id) => id !== uid);
        }
      } else {
        if (venue.downvotes.includes(uid)) {
          venue.downvotes = venue.downvotes.filter((id) => id !== uid);
        } else {
          venue.downvotes.push(uid);
          venue.upvotes = venue.upvotes.filter((id) => id !== uid);
        }
      }

      room.updatedAt = new Date().toISOString();
      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room });
    } catch (err: any) {
      console.error('Error voting on venue:', err);
      res.status(500).json({ error: err.message || 'Failed to vote on venue' });
    }
  });

  // 11. Add Vibe Note and refresh venues
  app.post('/api/rooms/:code/vibes', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { vibe } = req.body;
      if (!vibe || typeof vibe !== 'string') {
        return res.status(400).json({ error: 'vibe string is required' });
      }

      const cleanVibe = vibe.trim();
      if (!room.vibeNotes.includes(cleanVibe)) {
        room.vibeNotes.push(cleanVibe);
      }

      // Re-trigger venue generation with new vibe note
      room.venues = await generateVenuesWithGrounding(room.destination, room.vibeNotes);
      room.updatedAt = new Date().toISOString();
      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room, vibeNotes: room.vibeNotes });
    } catch (err: any) {
      console.error('Failed to add vibe note:', err);
      res.status(500).json({ error: err.message || 'Failed to add vibe note' });
    }
  });

  // 12. Delete Vibe Note
  app.delete('/api/rooms/:code/vibes', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { vibe } = req.body;
      if (vibe) {
        room.vibeNotes = room.vibeNotes.filter((v) => v !== vibe);
        room.updatedAt = new Date().toISOString();
        broadcast(code);
        persistRoom(room);
      }

      res.json({ ok: true, room });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete vibe note' });
    }
  });

  // 13. Generate / Update Itinerary
  app.post('/api/rooms/:code/itinerary', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { dateRangeId } = req.body;
      const itinerary = await synthesizeItinerary(room, dateRangeId);
      room.itinerary = itinerary;
      room.updatedAt = new Date().toISOString();

      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room, itinerary });
    } catch (err: any) {
      console.error('Failed to generate itinerary:', err);
      res.status(500).json({ error: err.message || 'Failed to generate itinerary' });
    }
  });

  // 14. Get / Generate Transport & Logistics Guide
  app.post('/api/rooms/:code/transport-guide', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { forceRefresh } = req.body || {};
      if (room.transportGuide && !forceRefresh) {
        return res.json({ ok: true, guide: room.transportGuide });
      }

      const guide = await synthesizeTransportGuide(room.destination);
      room.transportGuide = guide;
      room.updatedAt = new Date().toISOString();

      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, guide, room });
    } catch (err: any) {
      console.error('Failed to generate transport guide:', err);
      res.status(500).json({ error: err.message || 'Failed to generate transport guide' });
    }
  });

  // 15. Add Member Transport / Arrival Plan
  app.post('/api/rooms/:code/transport-plans', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const {
        uid,
        userName,
        type,
        carrierOrFlightNumber,
        departureLocation,
        arrivalLocation,
        arrivalDateTime,
        notes,
      } = req.body;

      if (!uid || !carrierOrFlightNumber) {
        return res.status(400).json({ error: 'uid and carrierOrFlightNumber are required' });
      }

      if (!room.transportPlans) {
        room.transportPlans = [];
      }

      const newPlan: MemberTransportPlan = {
        id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        uid,
        userName: userName || room.participants[uid]?.displayName || 'Member',
        type: type || 'flight',
        carrierOrFlightNumber: String(carrierOrFlightNumber).trim(),
        departureLocation: String(departureLocation || '').trim(),
        arrivalLocation: String(arrivalLocation || '').trim(),
        arrivalDateTime: String(arrivalDateTime || '').trim(),
        notes: String(notes || '').trim(),
        createdAt: new Date().toISOString(),
      };

      room.transportPlans.push(newPlan);
      room.updatedAt = new Date().toISOString();

      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room, plan: newPlan });
    } catch (err: any) {
      console.error('Failed to add transport plan:', err);
      res.status(500).json({ error: err.message || 'Failed to add transport plan' });
    }
  });

  // 16. Delete Member Transport Plan
  app.delete('/api/rooms/:code/transport-plans/:planId', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { planId } = req.params;
      room.transportPlans = (room.transportPlans || []).filter((p) => p.id !== planId);
      room.updatedAt = new Date().toISOString();

      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room });
    } catch (err: any) {
      console.error('Failed to delete transport plan:', err);
      res.status(500).json({ error: err.message || 'Failed to delete transport plan' });
    }
  });

  // 17. Update Budget Estimates & Currency
  app.post('/api/rooms/:code/budget', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const {
        flightsEstimatePerPerson,
        accommodationTotal,
        activitiesEstimatePerPerson,
        diningDailyPerPerson,
        currency,
        currencySymbol,
      } = req.body;

      if (!room.budget) {
        room.budget = {
          currency: currency || 'USD',
          currencySymbol: currencySymbol || '$',
          flightsEstimatePerPerson: 0,
          accommodationTotal: 0,
          activitiesEstimatePerPerson: 0,
          diningDailyPerPerson: 0,
          customItems: [],
          updatedAt: new Date().toISOString(),
        };
      }

      if (typeof flightsEstimatePerPerson === 'number') {
        room.budget.flightsEstimatePerPerson = Math.max(0, flightsEstimatePerPerson);
      }
      if (typeof accommodationTotal === 'number') {
        room.budget.accommodationTotal = Math.max(0, accommodationTotal);
      }
      if (typeof activitiesEstimatePerPerson === 'number') {
        room.budget.activitiesEstimatePerPerson = Math.max(0, activitiesEstimatePerPerson);
      }
      if (typeof diningDailyPerPerson === 'number') {
        room.budget.diningDailyPerPerson = Math.max(0, diningDailyPerPerson);
      }
      if (currency) {
        room.budget.currency = currency;
      }
      if (currencySymbol) {
        room.budget.currencySymbol = currencySymbol;
      }

      room.budget.updatedAt = new Date().toISOString();
      room.updatedAt = new Date().toISOString();

      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room, budget: room.budget });
    } catch (err: any) {
      console.error('Failed to update budget:', err);
      res.status(500).json({ error: err.message || 'Failed to update budget' });
    }
  });

  // 18. Add Custom Budget Item
  app.post('/api/rooms/:code/budget/items', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { category, title, cost, costType, notes, uid, userName } = req.body;
      if (!title || typeof cost !== 'number') {
        return res.status(400).json({ error: 'Title and cost are required' });
      }

      if (!room.budget) {
        room.budget = {
          currency: 'USD',
          currencySymbol: '$',
          flightsEstimatePerPerson: 0,
          accommodationTotal: 0,
          activitiesEstimatePerPerson: 0,
          diningDailyPerPerson: 0,
          customItems: [],
          updatedAt: new Date().toISOString(),
        };
      }

      const newItem: BudgetItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category: category || 'activities',
        title: String(title).trim(),
        cost: Math.max(0, cost),
        costType: costType || 'per_person',
        notes: String(notes || '').trim(),
        addedByUid: uid,
        addedByName: userName || (uid ? room.participants[uid]?.displayName : 'Member'),
        createdAt: new Date().toISOString(),
      };

      room.budget.customItems.push(newItem);
      room.budget.updatedAt = new Date().toISOString();
      room.updatedAt = new Date().toISOString();

      broadcast(code);
      persistRoom(room);

      res.json({ ok: true, room, item: newItem });
    } catch (err: any) {
      console.error('Failed to add budget item:', err);
      res.status(500).json({ error: err.message || 'Failed to add budget item' });
    }
  });

  // 19. Delete Custom Budget Item
  app.delete('/api/rooms/:code/budget/items/:itemId', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const { itemId } = req.params;
      if (room.budget && room.budget.customItems) {
        room.budget.customItems = room.budget.customItems.filter((i) => i.id !== itemId);
        room.budget.updatedAt = new Date().toISOString();
        room.updatedAt = new Date().toISOString();

        broadcast(code);
        persistRoom(room);
      }

      res.json({ ok: true, room });
    } catch (err: any) {
      console.error('Failed to delete budget item:', err);
      res.status(500).json({ error: err.message || 'Failed to delete budget item' });
    }
  });

  // 20. SSE Real-Time Stream
  app.get('/api/rooms/:code/stream', async (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const uid = (req.query.uid as string) || '';

    const room = await loadRoom(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`data: ${JSON.stringify(room)}\n\n`);

    if (!roomSubscribers.has(code)) {
      roomSubscribers.set(code, new Set());
    }
    const client = { res, uid };
    roomSubscribers.get(code)!.add(client);

    if (uid && room.participants[uid]) {
      room.participants[uid].online = true;
      room.participants[uid].lastSeenAt = new Date().toISOString();
      if (!room.activeOnlineUids.includes(uid)) {
        room.activeOnlineUids.push(uid);
      }
      broadcast(code);
    }

    // Keep-alive heartbeat every 15 seconds
    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      const subs = roomSubscribers.get(code);
      if (subs) {
        subs.delete(client);
        if (subs.size === 0) {
          roomSubscribers.delete(code);
        }
      }
      if (uid && room.participants[uid]) {
        // If no more open connections for this uid, mark offline
        const stillConnected = Array.from(subs || []).some((c) => c.uid === uid);
        if (!stillConnected) {
          room.participants[uid].online = false;
          room.activeOnlineUids = room.activeOnlineUids.filter((id) => id !== uid);
          broadcast(code);
        }
      }
    });
  });

  // Guard: API routes that do not match must return JSON 404, never Vite HTML
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // Vite Integration
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Splitroom server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
