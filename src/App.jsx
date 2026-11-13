import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { 
  Users, Volume2, VolumeX, Mic, MicOff, 
  Eye, RefreshCw, Trophy, Crown, ArrowRight, Copy, Check, LogOut, AlertCircle, RotateCcw
} from 'lucide-react';

const HAND_RANKS = {
  TRAIL: { rank: 6, label: 'Trail / Trio (Three of a Kind)' },
  PURE_SEQUENCE: { rank: 5, label: 'Pure Sequence (Straight Flush)' },
  SEQUENCE: { rank: 4, label: 'Sequence (Straight)' },
  COLOR: { rank: 3, label: 'Color (Flush)' },
  PAIR: { rank: 2, label: 'Pair (Two of a Kind)' },
  HIGH_CARD: { rank: 1, label: 'High Card' }
};

const CARD_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const SUITS = [
  { symbol: '♠', name: 'spades', color: 'text-slate-900' },
  { symbol: '♥', name: 'hearts', color: 'text-rose-600' },
  { symbol: '♦', name: 'diamonds', color: 'text-rose-600' },
  { symbol: '♣', name: 'clubs', color: 'text-slate-900' }
];

const BOT_NAMES = ['Aarav', 'Vihaan', 'Ananya', 'Diya', 'Kabir', 'Rohan'];
const STAKE_OPTIONS = [100, 200, 500, 1000];

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

export default function App() {
  const [inLobby, setInLobby] = useState(true);
  const [roomCode, setRoomCode] = useState('');
  const [bootAmount, setBootAmount] = useState(100);
  const [maxSeats, setMaxSeats] = useState(3);
  const [playerName, setPlayerName] = useState('Player 1');
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [connStatus, setConnStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [players, setPlayers] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [pot, setPot] = useState(0);
  const [currentStake, setCurrentStake] = useState(100);
  // Tracks the max stake contribution/bet of the current betting round for Blind vs Seen relative rules
  const [maxStakeAmount, setMaxStakeAmount] = useState(100);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [turnCount, setTurnCount] = useState(0);
  const [roundResult, setRoundResult] = useState(null);
  const [sideShowModal, setSideShowModal] = useState(null);
  const [copied, setCopied] = useState(false);

  // Voice Chat States & Refs
  const [micMuted, setMicMuted] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const localStreamRef = useRef(null);
  const mediaCallsRef = useRef({});
  const audioElementsRef = useRef({});

  const peerRef = useRef(null);
  const connectionsRef = useRef({});

  // Real-time Master Refs
  const playersRef = useRef(players);
  const isHostRef = useRef(isHost);
  const currentTurnRef = useRef(currentTurn);
  const potRef = useRef(pot);
  const currentStakeRef = useRef(currentStake);
  const maxStakeAmountRef = useRef(maxStakeAmount);
  const turnCountRef = useRef(turnCount);
  const gameStatusRef = useRef(gameStatus);
  const sideShowModalRef = useRef(sideShowModal);
  const roundResultRef = useRef(roundResult);
  const myPlayerIdRef = useRef(myPlayerId);
  const audioMutedRef = useRef(audioMuted);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { currentTurnRef.current = currentTurn; }, [currentTurn]);
  useEffect(() => { potRef.current = pot; }, [pot]);
  useEffect(() => { currentStakeRef.current = currentStake; }, [currentStake]);
  useEffect(() => { maxStakeAmountRef.current = maxStakeAmount; }, [maxStakeAmount]);
  useEffect(() => { turnCountRef.current = turnCount; }, [turnCount]);
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { sideShowModalRef.current = sideShowModal; }, [sideShowModal]);
  useEffect(() => { roundResultRef.current = roundResult; }, [roundResult]);
  useEffect(() => { myPlayerIdRef.current = myPlayerId; }, [myPlayerId]);
  useEffect(() => { audioMutedRef.current = audioMuted; }, [audioMuted]);

  // Persistent Session & Auto-reconnection state management
  const getSessionStorageItem = (key, fallback) => {
    try {
      const val = sessionStorage.getItem(key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const setSessionStorageItem = (key, val) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  };

  const getStableSessionId = () => {
    let sid = getSessionStorageItem('tp_session_id', null);
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 11);
      setSessionStorageItem('tp_session_id', sid);
    }
    return sid;
  };

  const getSavedPlayerChips = (sessionId) => {
    const registry = getSessionStorageItem('tp_player_chips_registry', {});
    return registry[sessionId] !== undefined ? registry[sessionId] : 5000;
  };

  const savePlayerChipsRegistry = (sessionId, chips) => {
    const registry = getSessionStorageItem('tp_player_chips_registry', {});
    registry[sessionId] = chips;
    setSessionStorageItem('tp_player_chips_registry', registry);
  };

  // Auto-reconnect check on mount if previously in an active room
  useEffect(() => {
    const savedRoom = getSessionStorageItem('tp_active_room', null);
    const savedName = getSessionStorageItem('tp_player_name', 'Player 1');
    const savedIsHost = getSessionStorageItem('tp_is_host', false);
    const savedMyId = getSessionStorageItem('tp_my_player_id', null);

    if (savedRoom && savedMyId) {
      setRoomCode(savedRoom);
      setPlayerName(savedName);
      setIsHost(savedIsHost);
      setMyPlayerId(savedMyId);

      if (savedIsHost) {
        // Re-initialize Host Peer
        initHostPeer(savedRoom, savedMyId, savedName);
      } else {
        // Re-initialize Guest Peer & Auto Reconnect
        initGuestPeer(savedRoom, savedMyId, savedName);
      }
    }
  }, []);

  // Update session storage whenever room state changes
  useEffect(() => {
    if (!inLobby && roomCode) {
      setSessionStorageItem('tp_active_room', roomCode);
      setSessionStorageItem('tp_player_name', playerName);
      setSessionStorageItem('tp_is_host', isHost);
      setSessionStorageItem('tp_my_player_id', myPlayerId);
    }
  }, [inLobby, roomCode, playerName, isHost, myPlayerId]);

  const cleanupAudioAndPeers = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    Object.values(mediaCallsRef.current).forEach(call => {
      try { call.close(); } catch (e) {}
    });
    mediaCallsRef.current = {};

    Object.values(audioElementsRef.current).forEach(el => {
      try { el.remove(); } catch (e) {}
    });
    audioElementsRef.current = {};

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (e) {}
      peerRef.current = null;
    }
    connectionsRef.current = {};
    setMicMuted(true);
  };

  useEffect(() => {
    return () => cleanupAudioAndPeers();
  }, []);

  // Voice Mesh Synchronization
  useEffect(() => {
    if (!peerRef.current || !localStreamRef.current || inLobby) return;

    const humanPeers = players
      .filter(p => !p.isBot && p.id !== myPlayerId && !p.isSpectator)
      .map(p => p.id);

    humanPeers.forEach(remoteId => {
      if (!mediaCallsRef.current[remoteId]) {
        try {
          const call = peerRef.current.call(remoteId, localStreamRef.current);
          if (call) setupMediaCall(call, remoteId);
        } catch (err) {}
      }
    });
  }, [players, inLobby, myPlayerId]);

  const toggleMic = async () => {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
          video: false 
        });
        localStreamRef.current = stream;
        setMicMuted(false);

        const humanPeers = playersRef.current
          .filter(p => !p.isBot && p.id !== myPlayerIdRef.current)
          .map(p => p.id);

        humanPeers.forEach(remotePeerId => {
          if (peerRef.current) {
            if (mediaCallsRef.current[remotePeerId]) {
              try { mediaCallsRef.current[remotePeerId].close(); } catch (e) {}
            }
            const call = peerRef.current.call(remotePeerId, stream);
            if (call) setupMediaCall(call, remotePeerId);
          }
        });
      } catch (err) {
        setErrorMessage('Microphone permission required. Allow mic access in browser.');
      }
    } else {
      const tracks = localStreamRef.current.getAudioTracks();
      if (tracks.length > 0) {
        const nextState = !tracks[0].enabled;
        tracks[0].enabled = nextState;
        setMicMuted(!nextState);
      }
    }
  };

  const setupMediaCall = (call, remotePeerId) => {
    mediaCallsRef.current[remotePeerId] = call;

    call.on('stream', (remoteStream) => {
      let audioEl = audioElementsRef.current[remotePeerId];
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        document.body.appendChild(audioEl);
        audioElementsRef.current[remotePeerId] = audioEl;
      }
      audioEl.srcObject = remoteStream;
      audioEl.muted = audioMutedRef.current;
      audioEl.play().catch(() => {});
    });

    call.on('close', () => {
      delete mediaCallsRef.current[remotePeerId];
      if (audioElementsRef.current[remotePeerId]) {
        audioElementsRef.current[remotePeerId].remove();
        delete audioElementsRef.current[remotePeerId];
      }
    });
  };

  const toggleAudioOutput = () => {
    const nextMutedState = !audioMuted;
    setAudioMuted(nextMutedState);
    Object.values(audioElementsRef.current).forEach(audioEl => {
      if (audioEl) audioEl.muted = nextMutedState;
    });
  };

  const createShuffledDeck = () => {
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    values.forEach(val => {
      SUITS.forEach(suit => {
        deck.push({ value: val, suit: suit.symbol, color: suit.color, numVal: CARD_VALUES[val] });
      });
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  const evaluateHand = (cards) => {
    if (!cards || cards.length < 3) return { rank: 0, name: 'Invalid', score: 0 };
    const sorted = [...cards].sort((a, b) => b.numVal - a.numVal);
    const isFlush = sorted[0].suit === sorted[1].suit && sorted[1].suit === sorted[2].suit;
    const v0 = sorted[0].numVal, v1 = sorted[1].numVal, v2 = sorted[2].numVal;
    const is3OfAKind = v0 === v1 && v1 === v2;
    const isPair = v0 === v1 || v1 === v2 || v0 === v2;
    let isStraight = false;
    if (v0 - v1 === 1 && v1 - v2 === 1) isStraight = true;
    if (v0 === 14 && v1 === 3 && v2 === 2) isStraight = true;

    if (is3OfAKind) return { rank: HAND_RANKS.TRAIL.rank, name: HAND_RANKS.TRAIL.label, score: v0 * 100 };
    if (isFlush && isStraight) return { rank: HAND_RANKS.PURE_SEQUENCE.rank, name: HAND_RANKS.PURE_SEQUENCE.label, score: v0 * 100 + v1 * 10 + v2 };
    if (isStraight) return { rank: HAND_RANKS.SEQUENCE.rank, name: HAND_RANKS.SEQUENCE.label, score: v0 * 100 + v1 * 10 + v2 };
    if (isFlush) return { rank: HAND_RANKS.COLOR.rank, name: HAND_RANKS.COLOR.label, score: v0 * 100 + v1 * 10 + v2 };
    if (isPair) {
      const pairVal = v0 === v1 ? v0 : (v1 === v2 ? v1 : v0);
      const kicker = v0 === v1 ? v2 : (v1 === v2 ? v0 : v1);
      return { rank: HAND_RANKS.PAIR.rank, name: HAND_RANKS.PAIR.label, score: pairVal * 100 + kicker };
    }
    return { rank: HAND_RANKS.HIGH_CARD.rank, name: HAND_RANKS.HIGH_CARD.label, score: v0 * 100 + v1 * 10 + v2 };
  };

  const broadcastState = (newState) => {
    Object.values(connectionsRef.current).forEach(conn => {
      if (conn && conn.open) {
        conn.send({ type: 'SYNC_STATE', payload: newState });
      }
    });
  };

  const sendActionToHostOrPeers = (actionData) => {
    if (isHostRef.current) {
      handleActionMessage(actionData);
    } else {
      const hostConn = Object.values(connectionsRef.current)[0];
      if (hostConn && hostConn.open) {
        hostConn.send(actionData);
      }
    }
  };

  const sanitizeCode = (code) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const initHostPeer = (formattedCode, hostId, name) => {
    if (peerRef.current) peerRef.current.destroy();

    const peer = new Peer(hostId, {
      config: { iceServers: ICE_SERVERS },
      debug: 1
    });

    peer.on('open', () => {
      const sessionId = getStableSessionId();
      const initialChips = getSavedPlayerChips(sessionId);

      setPlayers(prev => {
        if (prev.some(p => p.id === hostId)) return prev;
        const initialHostPlayer = {
          id: hostId,
          sessionId,
          name: name.trim() || 'Host',
          isHost: true,
          isBot: false,
          chips: initialChips,
          cards: [],
          isBlind: true,
          folded: false,
          isSpectator: initialChips < bootAmount
        };
        return [initialHostPlayer];
      });

      setInLobby(false);
      setGameStatus(prev => prev === 'waiting' ? 'lobby' : prev);
      setConnStatus('Room ready. Waiting for players...');
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connectionsRef.current[conn.peer] = conn;
      });

      conn.on('data', (data) => {
        handleIncomingData(data, conn);
      });

      conn.on('close', () => {
        // Do not immediately remove human player on brief disconnect to support reload persistence; 
        // rely on explicit LEAVE or timeout if needed.
      });

      conn.on('error', () => {});
    });

    peer.on('call', (call) => {
      call.answer(localStreamRef.current || undefined);
      setupMediaCall(call, call.peer);
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        setErrorMessage('Room code collision. Click Create again.');
      } else {
        setErrorMessage('Peer error: ' + err.message);
      }
      setConnStatus('');
    });

    peerRef.current = peer;
  };

  const createRoom = () => {
    setErrorMessage('');
    cleanupAudioAndPeers();

    const rawCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const formattedCode = sanitizeCode(rawCode);
    const hostId = 'patti_host_' + formattedCode;

    setRoomCode(formattedCode);
    setIsHost(true);
    setMyPlayerId(hostId);
    setConnStatus('Initializing peer room...');

    initHostPeer(formattedCode, hostId, playerName);
  };

  const initGuestPeer = (cleanCode, guestId, name) => {
    if (peerRef.current) peerRef.current.destroy();

    const hostPeerId = 'patti_host_' + cleanCode;
    const sessionId = getStableSessionId();
    const initialChips = getSavedPlayerChips(sessionId);

    setConnStatus('Connecting to room ' + cleanCode + '...');

    const peer = new Peer(guestId, {
      config: { iceServers: ICE_SERVERS },
      debug: 1
    });

    peer.on('open', () => {
      const conn = peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        connectionsRef.current[hostPeerId] = conn;
        setConnStatus('Connected! Syncing seat...');

        conn.send({
          type: 'JOIN_REQUEST',
          payload: {
            id: guestId,
            sessionId,
            name: name.trim() || 'Player',
            chips: initialChips
          }
        });
      });

      conn.on('data', (data) => {
        handleIncomingData(data, conn);
      });

      conn.on('close', () => {
        setConnStatus('Reconnecting to host...');
      });

      conn.on('error', () => {
        setErrorMessage('Failed to connect to host.');
      });
    });

    peer.on('call', (call) => {
      call.answer(localStreamRef.current || undefined);
      setupMediaCall(call, call.peer);
    });

    peer.on('error', () => {
      setErrorMessage('Unable to connect to room. Check code or network.');
      setConnStatus('');
    });

    peerRef.current = peer;
  };

  const joinRoom = () => {
    setErrorMessage('');
    if (!roomCode) {
      setErrorMessage('Please enter a valid 6-digit room code.');
      return;
    }

    const cleanCode = sanitizeCode(roomCode);
    if (cleanCode.length !== 6) {
      setErrorMessage('Room code must be 6 characters.');
      return;
    }

    cleanupAudioAndPeers();

    const sessionId = getStableSessionId();
    const guestId = 'patti_guest_' + sessionId + '_' + Math.random().toString(36).substring(2, 5);

    setMyPlayerId(guestId);
    setIsHost(false);

    initGuestPeer(cleanCode, guestId, playerName);
  };

  const handleLeaveRoom = () => {
    if (!isHostRef.current) {
      const hostConn = Object.values(connectionsRef.current)[0];
      if (hostConn && hostConn.open) {
        try {
          hostConn.send({ type: 'LEAVE_ROOM', payload: { id: myPlayerIdRef.current } });
        } catch (e) {}
      }
    }
    sessionStorage.removeItem('tp_active_room');
    sessionStorage.removeItem('tp_my_player_id');
    cleanupAudioAndPeers();
    setPlayers([]);
    setInLobby(true);
    setGameStatus('waiting');
    setRoundResult(null);
    setSideShowModal(null);
    setConnStatus('');
  };

  const handleIncomingData = (data, conn) => {
    if (!data || !data.type) return;

    if (data.type === 'JOIN_REQUEST' && isHostRef.current) {
      const { id, sessionId, name, chips } = data.payload;

      setPlayers(prev => {
        // Count current human players (excluding bots)
        const currentHumans = prev.filter(p => !p.isBot);
        const existingPlayer = prev.find(p => p.id === id || (sessionId && p.sessionId === sessionId));

        if (!existingPlayer && currentHumans.length >= maxSeats) {
          // Room Full alert for human capacity check (ignoring bots)
          try {
            conn.send({ type: 'ROOM_FULL', payload: { message: 'Room is full! Maximum human player capacity reached.' } });
          } catch (e) {}
          return prev;
        }

        const filtered = prev.filter(p => {
          if (p.id === id) return false;
          if (sessionId && p.sessionId === sessionId) return false;
          return true;
        });

        const restoredChips = chips !== undefined ? chips : getSavedPlayerChips(sessionId);
        const newPlayer = {
          id,
          sessionId,
          name,
          isHost: false,
          isBot: false,
          chips: restoredChips,
          cards: existingPlayer ? existingPlayer.cards : [],
          isBlind: existingPlayer ? existingPlayer.isBlind : true,
          folded: existingPlayer ? existingPlayer.folded : false,
          isSpectator: restoredChips < bootAmount
        };

        const updated = [...filtered, newPlayer];

        const statePayload = {
          players: updated,
          pot: potRef.current,
          currentTurn: currentTurnRef.current,
          gameStatus: gameStatusRef.current,
          currentStake: currentStakeRef.current,
          maxStakeAmount: maxStakeAmountRef.current,
          turnCount: turnCountRef.current,
          roundResult: roundResultRef.current,
          sideShowModal: sideShowModalRef.current
        };

        conn.send({ type: 'SYNC_STATE', payload: statePayload });
        broadcastState(statePayload);
        return updated;
      });
    } else if (data.type === 'ROOM_FULL') {
      setErrorMessage(data.payload.message);
      setConnStatus('');
      setInLobby(true);
    } else if (data.type === 'LEAVE_ROOM' && isHostRef.current) {
      removeDisconnectedPeer(data.payload.id);
    } else if (data.type === 'SYNC_STATE') {
      setPlayers(data.payload.players);
      setPot(data.payload.pot);
      setCurrentTurn(data.payload.currentTurn);
      setGameStatus(data.payload.gameStatus);
      setCurrentStake(data.payload.currentStake);
      setMaxStakeAmount(data.payload.maxStakeAmount || data.payload.currentStake);
      setTurnCount(data.payload.turnCount);
      setRoundResult(data.payload.roundResult || null);
      setSideShowModal(data.payload.sideShowModal || null);
      setInLobby(false);
      setConnStatus('Connected');

      // Update local chip registry persistence
      data.payload.players.forEach(p => {
        if (p.id === myPlayerIdRef.current || p.sessionId === getSessionStorageItem('tp_session_id', '')) {
          savePlayerChipsRegistry(p.sessionId || getStableSessionId(), p.chips);
        }
      });
    } else if (['ACTION_CHAAL', 'ACTION_PACK', 'ACTION_SEE_CARDS', 'REQUEST_SIDESHOW', 'RESPOND_SIDESHOW', 'SHOW_CARDS'].includes(data.type)) {
      handleActionMessage(data);
    }
  };

  const removeDisconnectedPeer = (peerId) => {
    delete connectionsRef.current[peerId];
    if (mediaCallsRef.current[peerId]) {
      try { mediaCallsRef.current[peerId].close(); } catch (e) {}
      delete mediaCallsRef.current[peerId];
    }
    if (audioElementsRef.current[peerId]) {
      audioElementsRef.current[peerId].remove();
      delete audioElementsRef.current[peerId];
    }

    setPlayers(prev => {
      const updated = prev.filter(p => p.id !== peerId);
      if (isHostRef.current) {
        let nextTurn = currentTurnRef.current;
        if (nextTurn >= updated.length) nextTurn = 0;

        broadcastState({
          players: updated,
          pot: potRef.current,
          currentTurn: nextTurn,
          gameStatus: gameStatusRef.current,
          currentStake: currentStakeRef.current,
          maxStakeAmount: maxStakeAmountRef.current,
          turnCount: turnCountRef.current,
          roundResult: roundResultRef.current,
          sideShowModal: sideShowModalRef.current
        });
      }
      return updated;
    });
  };

  const getPreviousActivePlayerIndex = (fromIndex, currentPlayersList) => {
    let prevIndex = (fromIndex - 1 + currentPlayersList.length) % currentPlayersList.length;
    while (currentPlayersList[prevIndex] && (currentPlayersList[prevIndex].folded || currentPlayersList[prevIndex].isSpectator)) {
      prevIndex = (prevIndex - 1 + currentPlayersList.length) % currentPlayersList.length;
    }
    return prevIndex;
  };

  /**
   * Precise Teen Patti Stake Matching & Relative Rules:
   * 1. If player has not seen card and max-stake player has not seen: match max stake (1x).
   * 2. If player has seen card and max-stake player has NOT seen: player must double the stake (maxStakeAmount * 2).
   * 3. If max-stake player has seen card and the player is blind: the stake would be half (Math.floor(maxStakeAmount / 2), min 1).
   * 4. If both have seen: match max stake (1x).
   */
  const getRequiredBetForPlayer = (player, refMaxStake, maxStakePlayerIsBlind) => {
    const isPlayerBlind = player.isBlind;

    if (isPlayerBlind && maxStakePlayerIsBlind) {
      return refMaxStake; // 1x
    } else if (!isPlayerBlind && maxStakePlayerIsBlind) {
      return refMaxStake * 2; // Double the stake
    } else if (isPlayerBlind && !maxStakePlayerIsBlind) {
      return Math.max(1, Math.floor(refMaxStake / 2)); // Half stake
    } else {
      return refMaxStake; // Both seen -> 1x
    }
  };

  const handleActionMessage = (actionData) => {
    if (!isHostRef.current) return;

    let updatedPlayers = [...playersRef.current];
    let newPot = potRef.current;
    let newTurn = currentTurnRef.current;
    let newTurnCount = turnCountRef.current;
    let newStake = currentStakeRef.current;
    let newMaxStakeAmount = maxStakeAmountRef.current;
    let newGameStatus = gameStatusRef.current;
    let newRoundResult = roundResultRef.current;
    let newSideShowModal = sideShowModalRef.current;

    if (actionData.type === 'ACTION_CHAAL') {
      const { playerId, totalBet } = actionData.payload;
      const actingPlayer = updatedPlayers.find(p => p.id === playerId);
      
      if (!actingPlayer || actingPlayer.chips < totalBet || actingPlayer.isSpectator) return;

      updatedPlayers = updatedPlayers.map(p => {
        if (p.id === playerId) {
          const newChips = p.chips - totalBet;
          return {
            ...p,
            chips: newChips,
            isSpectator: newChips < bootAmount
          };
        }
        return p;
      });

      newPot += totalBet;
      newMaxStakeAmount = totalBet;
      newStake = totalBet;

      // Save registry
      savePlayerChipsRegistry(actingPlayer.sessionId || actingPlayer.id, actingPlayer.chips - totalBet);

      const active = updatedPlayers.filter(p => !p.folded && !p.isSpectator);
      if (active.length === 1) {
        handleWinnerHost(active[0], updatedPlayers, newPot);
        return;
      }

      newTurn = getNextTurnIndexHost(newTurn, updatedPlayers);
      newTurnCount += 1;
    } else if (actionData.type === 'ACTION_PACK') {
      const { playerId } = actionData.payload;
      updatedPlayers = updatedPlayers.map(p => p.id === playerId ? { ...p, folded: true } : p);
      
      const active = updatedPlayers.filter(p => !p.folded && !p.isSpectator);
      if (active.length === 1) {
        handleWinnerHost(active[0], updatedPlayers, newPot);
        return;
      }

      newTurn = getNextTurnIndexHost(newTurn, updatedPlayers);
    } else if (actionData.type === 'ACTION_SEE_CARDS') {
      const { playerId } = actionData.payload;
      updatedPlayers = updatedPlayers.map(p => p.id === playerId ? { ...p, isBlind: false } : p);
    } else if (actionData.type === 'REQUEST_SIDESHOW') {
      const { requesterId } = actionData.payload;
      const requester = updatedPlayers.find(p => p.id === requesterId);
      const requesterIdx = updatedPlayers.findIndex(p => p.id === requesterId);
      const targetIdx = getPreviousActivePlayerIndex(requesterIdx, updatedPlayers);
      const target = updatedPlayers[targetIdx];

      if (target && target.isBot) {
        const requesterEval = evaluateHand(requester.cards);
        const botEval = evaluateHand(target.cards);
        
        let loserId = requesterId;
        if (requesterEval.rank > botEval.rank || (requesterEval.rank === botEval.rank && requesterEval.score >= botEval.score)) {
          loserId = target.id;
        }

        updatedPlayers = updatedPlayers.map(p => p.id === loserId ? { ...p, folded: true } : p);
        const active = updatedPlayers.filter(p => !p.folded && !p.isSpectator);
        if (active.length === 1) {
          handleWinnerHost(active[0], updatedPlayers, newPot);
          return;
        }
        newTurn = getNextTurnIndexHost(newTurn, updatedPlayers);
      } else if (target) {
        newSideShowModal = { requester, target };
      }
    } else if (actionData.type === 'RESPOND_SIDESHOW') {
      const { accepted } = actionData.payload;
      if (accepted && newSideShowModal) {
        const reqPlayer = updatedPlayers.find(p => p.id === newSideShowModal.requester.id);
        const targetPlayer = updatedPlayers.find(p => p.id === newSideShowModal.target.id);

        const reqEval = evaluateHand(reqPlayer.cards);
        const targetEval = evaluateHand(targetPlayer.cards);

        let loserId = reqPlayer.id;
        if (reqEval.rank > targetEval.rank || (reqEval.rank === targetEval.rank && reqEval.score >= targetEval.score)) {
          loserId = targetPlayer.id;
        }

        updatedPlayers = updatedPlayers.map(p => p.id === loserId ? { ...p, folded: true } : p);
        const active = updatedPlayers.filter(p => !p.folded && !p.isSpectator);
        if (active.length === 1) {
          handleWinnerHost(active[0], updatedPlayers, newPot);
          return;
        }
        newTurn = getNextTurnIndexHost(newTurn, updatedPlayers);
      }
      newSideShowModal = null;
    } else if (actionData.type === 'SHOW_CARDS') {
      handleShowdownHost(updatedPlayers, newPot);
      return;
    }

    setPlayers(updatedPlayers);
    setPot(newPot);
    setCurrentTurn(newTurn);
    setTurnCount(newTurnCount);
    setCurrentStake(newStake);
    setMaxStakeAmount(newMaxStakeAmount);
    setGameStatus(newGameStatus);
    setSideShowModal(newSideShowModal);

    broadcastState({
      players: updatedPlayers,
      pot: newPot,
      currentTurn: newTurn,
      gameStatus: newGameStatus,
      currentStake: newStake,
      maxStakeAmount: newMaxStakeAmount,
      turnCount: newTurnCount,
      roundResult: newRoundResult,
      sideShowModal: newSideShowModal
    });
  };

  const getNextTurnIndexHost = (fromIndex, currentPlayersList) => {
    let next = (fromIndex + 1) % currentPlayersList.length;
    while (currentPlayersList[next] && (currentPlayersList[next].folded || currentPlayersList[next].isSpectator)) {
      next = (next + 1) % currentPlayersList.length;
    }
    return next;
  };

  // Bot Turn Automation Engine
  useEffect(() => {
    if (!isHost || gameStatus !== 'playing') return;

    const currentPlayer = players[currentTurn];
    if (currentPlayer && currentPlayer.isBot && !currentPlayer.folded && !currentPlayer.isSpectator) {
      const botTimer = setTimeout(() => {
        const lastMaxPlayer = players.reduce((max, p) => (!p.folded && !p.isSpectator ? p : max), players[0]);
        const maxStakeIsBlind = lastMaxPlayer ? lastMaxPlayer.isBlind : true;
        const requiredAmount = getRequiredBetForPlayer(currentPlayer, maxStakeAmount, maxStakeIsBlind);

        if (currentPlayer.chips < requiredAmount || (Math.random() < 0.15 && turnCount > 2)) {
          handleActionMessage({
            type: 'ACTION_PACK',
            payload: { playerId: currentPlayer.id }
          });
        } else {
          handleActionMessage({
            type: 'ACTION_CHAAL',
            payload: { playerId: currentPlayer.id, totalBet: requiredAmount }
          });
        }
      }, 1200);

      return () => clearTimeout(botTimer);
    }
  }, [currentTurn, gameStatus, isHost, players, maxStakeAmount, turnCount]);

  const startGame = () => {
    let currentPlayers = players.filter(p => !p.isBot);
    const neededBots = Math.max(0, maxSeats - currentPlayers.length);
    
    for (let i = 0; i < neededBots; i++) {
      currentPlayers.push({
        id: `bot_${i}_${Date.now()}`,
        sessionId: `bot_sid_${i}`,
        name: `${BOT_NAMES[i % BOT_NAMES.length]} (Bot)`,
        isHost: false,
        isBot: true,
        chips: 5000,
        cards: [],
        isBlind: true,
        folded: false,
        isSpectator: false
      });
    }

    const deck = createShuffledDeck();
    let totalInitialPot = 0;

    const dealtPlayers = currentPlayers.map(p => {
      const isSpectator = p.chips < bootAmount;
      if (isSpectator) {
        return {
          ...p,
          cards: [],
          isBlind: true,
          folded: true,
          isSpectator: true
        };
      }

      totalInitialPot += bootAmount;
      const newChips = p.chips - bootAmount;
      savePlayerChipsRegistry(p.sessionId || p.id, newChips);

      return {
        ...p,
        cards: [deck.pop(), deck.pop(), deck.pop()],
        isBlind: true,
        folded: false,
        chips: newChips,
        isSpectator: false
      };
    });

    setPlayers(dealtPlayers);
    setPot(totalInitialPot);
    setCurrentStake(bootAmount);
    setMaxStakeAmount(bootAmount);
    setCurrentTurn(0);
    setTurnCount(1);
    setGameStatus('playing');
    setRoundResult(null);
    setSideShowModal(null);

    if (isHost) {
      broadcastState({
        players: dealtPlayers,
        pot: totalInitialPot,
        currentTurn: 0,
        gameStatus: 'playing',
        currentStake: bootAmount,
        maxStakeAmount: bootAmount,
        turnCount: 1,
        roundResult: null,
        sideShowModal: null
      });
    }
  };

  const handleWinnerHost = (winner, updatedPlayers, finalPot) => {
    const winningEval = evaluateHand(winner.cards);
    const finalPlayers = updatedPlayers.map(p => {
      const won = p.id === winner.id;
      const newChips = won ? p.chips + finalPot : p.chips;
      savePlayerChipsRegistry(p.sessionId || p.id, newChips);
      return {
        ...p,
        isBlind: false,
        chips: newChips,
        isSpectator: newChips < bootAmount
      };
    });
    
    const resData = {
      winner,
      handName: winningEval.name,
      amount: finalPot
    };

    setPlayers(finalPlayers);
    setGameStatus('ended');
    setRoundResult(resData);
    setSideShowModal(null);

    broadcastState({
      players: finalPlayers,
      pot: finalPot,
      currentTurn: currentTurnRef.current,
      gameStatus: 'ended',
      currentStake: currentStakeRef.current,
      maxStakeAmount: maxStakeAmountRef.current,
      turnCount: turnCountRef.current,
      roundResult: resData,
      sideShowModal: null
    });
  };

  const handleShowdownHost = (updatedPlayers, finalPot) => {
    const active = updatedPlayers.filter(p => !p.folded && !p.isSpectator);
    let bestPlayer = active[0];
    let bestEval = evaluateHand(active[0].cards);

    active.forEach(p => {
      const ev = evaluateHand(p.cards);
      if (ev.rank > bestEval.rank || (ev.rank === bestEval.rank && ev.score > bestEval.score)) {
        bestEval = ev;
        bestPlayer = p;
      }
    });

    handleWinnerHost(bestPlayer, updatedPlayers, finalPot);
  };

  const onChaalClick = (player) => {
    const lastMaxPlayer = players.reduce((max, p) => (!p.folded && !p.isSpectator ? p : max), players[0]);
    const maxStakeIsBlind = lastMaxPlayer ? lastMaxPlayer.isBlind : true;
    const totalBet = getRequiredBetForPlayer(player, maxStakeAmount, maxStakeIsBlind);

    if (player.chips < totalBet || player.isSpectator) return;

    sendActionToHostOrPeers({
      type: 'ACTION_CHAAL',
      payload: { playerId: player.id, totalBet }
    });
  };

  const onPackClick = (player) => {
    sendActionToHostOrPeers({
      type: 'ACTION_PACK',
      payload: { playerId: player.id }
    });
  };

  const onSeeCardsClick = (player) => {
    sendActionToHostOrPeers({
      type: 'ACTION_SEE_CARDS',
      payload: { playerId: player.id }
    });
  };

  const onSideShowClick = (player) => {
    sendActionToHostOrPeers({
      type: 'REQUEST_SIDESHOW',
      payload: { requesterId: player.id }
    });
  };

  const onShowCardsClick = () => {
    sendActionToHostOrPeers({
      type: 'SHOW_CARDS',
      payload: {}
    });
  };

  const respondSideShow = (accepted) => {
    sendActionToHostOrPeers({
      type: 'RESPOND_SIDESHOW',
      payload: { accepted }
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activePlayers = players.filter(p => !p.folded && !p.isSpectator);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-950/20 via-slate-950 to-slate-950 pointer-events-none" />
      
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
            3P
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              PRIVATE TEEN PATTI
            </h1>
            <p className="text-xs text-slate-400 font-medium">Mesh WebRTC Voice & Synced P2P</p>
          </div>
        </div>

        {!inLobby && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-sm">
              <span className="text-slate-400">Room:</span>
              <span className="font-mono font-bold text-emerald-400">{roomCode}</span>
              <button onClick={copyCode} className="text-slate-400 hover:text-slate-200 transition">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
              <button 
                onClick={toggleMic} 
                className={`p-2 rounded-lg border transition ${micMuted ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 animate-pulse'}`}
                title={micMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button 
                onClick={toggleAudioOutput} 
                className={`p-2 rounded-lg border transition ${audioMuted ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'}`}
                title={audioMuted ? "Unmute Audio" : "Mute Audio"}
              >
                {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button 
                onClick={handleLeaveRoom} 
                className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition"
                title="Leave Room"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 relative z-10 flex items-center justify-center p-4">
        {inLobby ? (
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold text-slate-100 mb-1">Join or Create Private Table</h2>
            <p className="text-xs text-slate-400 mb-4">Play real-time WebRTC 3-card Poker with Mesh Voice Chat</p>

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {connStatus && !errorMessage && (
              <div className="mb-4 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs text-center font-medium animate-pulse">
                {connStatus}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Your Name</label>
                <input 
                  type="text" 
                  value={playerName} 
                  onChange={e => setPlayerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                  placeholder="Enter name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Boot Amount</label>
                  <select 
                    value={bootAmount} 
                    onChange={e => setBootAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value={100}>$100</option>
                    <option value={200}>$200</option>
                    <option value={500}>$500</option>
                    <option value={1000}>$1000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Max Seats</label>
                  <select 
                    value={maxSeats} 
                    onChange={e => setMaxSeats(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players</option>
                    <option value={6}>6 Players</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={createRoom}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  Create Private Table <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold uppercase text-slate-500">Or Join Existing</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={roomCode} 
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="6-DIGIT CODE" 
                  maxLength={6}
                  className="flex-1 uppercase font-mono tracking-wider bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 transition text-center font-bold"
                />
                <button 
                  onClick={joinRoom}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl transition border border-slate-700"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex flex-col items-center">
            <div className="w-full aspect-[16/9] max-h-[600px] bg-slate-900 border-[12px] border-emerald-900/60 rounded-[120px] relative shadow-[0_0_80px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center p-6 border-emerald-950">
              <div className="absolute inset-4 rounded-[100px] border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-slate-950/80 pointer-events-none" />

              {/* Central Table Header & On-Table Result Display */}
              <div className="relative z-10 flex flex-col items-center mb-4 text-center">
                <div className="bg-slate-950/90 border border-emerald-500/30 px-6 py-2 rounded-full shadow-lg backdrop-blur">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Total Pot</span>
                  <span className="text-2xl font-black text-emerald-400 tracking-tight">${pot}</span>
                </div>

                {gameStatus === 'playing' && (
                  <div className="mt-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
                    Max Stake: <span className="text-emerald-400 font-bold">${maxStakeAmount}</span>
                  </div>
                )}

                {gameStatus === 'ended' && roundResult && (
                  <div className="mt-3 bg-slate-950/95 border border-emerald-500/50 p-4 rounded-2xl shadow-2xl backdrop-blur max-w-md flex flex-col items-center gap-1.5">
                    <Trophy className="w-7 h-7 text-amber-400 animate-bounce" />
                    <h3 className="font-extrabold text-xl text-slate-100 tracking-tight">
                      {roundResult.winner.name} Wins ${roundResult.amount}!
                    </h3>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      {roundResult.handName}
                    </span>
                    {isHost && (
                      <button 
                        onClick={startGame}
                        className="mt-2 px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-md shadow-emerald-500/20"
                      >
                        Play Next Hand
                      </button>
                    )}
                  </div>
                )}
              </div>

              {gameStatus === 'lobby' && (
                <div className="relative z-20 flex flex-col items-center gap-4 text-center bg-slate-950/80 p-6 rounded-2xl border border-slate-800 backdrop-blur">
                  <Users className="w-8 h-8 text-emerald-400 animate-pulse" />
                  <div>
                    <h3 className="font-bold text-slate-100">Waiting for Players</h3>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">
                      Share room code <span className="font-mono font-bold text-emerald-400">{roomCode}</span> with friends. Human players connected: {players.filter(p => !p.isBot).length}/{maxSeats}
                    </p>
                  </div>
                  {isHost ? (
                    <button 
                      onClick={startGame}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
                    >
                      Start Game Now
                    </button>
                  ) : (
                    <div className="text-xs text-amber-400 font-medium">Waiting for host to deal cards...</div>
                  )}
                </div>
              )}

              <div className="absolute inset-6 pointer-events-none flex items-center justify-center">
                {players.map((player, idx) => {
                  const total = players.length;
                  const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
                  const x = 50 + 40 * Math.cos(angle);
                  const y = 50 + 35 * Math.sin(angle);

                  const isCurrentTurn = gameStatus === 'playing' && currentTurn === idx;
                  const isUser = player.id === myPlayerId;
                  const revealCard = (isUser && !player.isBlind) || gameStatus === 'ended';

                  const lastMaxPlayer = players.reduce((max, p) => (!p.folded && !p.isSpectator ? p : max), players[0]);
                  const maxStakeIsBlind = lastMaxPlayer ? lastMaxPlayer.isBlind : true;
                  const calculatedBetAmount = getRequiredBetForPlayer(player, maxStakeAmount, maxStakeIsBlind);
                  const canAffordBet = player.chips >= calculatedBetAmount;

                  return (
                    <div 
                      key={player.id} 
                      style={{ left: `${x}%`, top: `${y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center"
                    >
                      <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all backdrop-blur ${
                        isCurrentTurn 
                          ? 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)] scale-105' 
                          : player.folded || player.isSpectator
                          ? 'bg-slate-950/50 border-slate-800 opacity-50' 
                          : 'bg-slate-950/90 border-slate-800'
                      }`}>
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
                          {player.name[0]}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                            {player.name}
                            {player.isHost && <Crown className="w-3 h-3 text-amber-400 inline" />}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400">${player.chips}</span>
                        </div>

                        {gameStatus === 'playing' && (
                          <div className="ml-1 flex items-center">
                            {player.isSpectator ? (
                              <span className="text-[9px] font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300 px-1.5 py-0.5 rounded">
                                SPECTATING
                              </span>
                            ) : player.folded ? (
                              <span className="text-[9px] font-bold bg-rose-500/20 border border-rose-500/40 text-rose-400 px-1.5 py-0.5 rounded">
                                FOLDED
                              </span>
                            ) : player.isBlind ? (
                              <span className="text-[9px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded">
                                BLIND
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded">
                                SEEN
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {(gameStatus === 'playing' || gameStatus === 'ended') && player.cards && player.cards.length > 0 && !player.isSpectator && (
                        <div className="flex gap-1 mt-2">
                          {player.cards.map((card, cIdx) => (
                            <div 
                              key={cIdx} 
                              className={`w-9 h-12 rounded-md border flex flex-col items-center justify-center font-bold shadow-md ${
                                revealCard 
                                  ? 'bg-slate-100 border-slate-300 text-slate-900' 
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              {revealCard ? (
                                <>
                                  <span className={`text-[11px] leading-none font-black ${card.color}`}>{card.value}</span>
                                  <span className={`text-xs ${card.color}`}>{card.suit}</span>
                                </>
                              ) : (
                                <div className="w-full h-full border border-slate-700/50 rounded flex items-center justify-center text-xs font-mono">
                                  🂠
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* On-Table Action Panel with Spectator & Stake Logic */}
                      {isUser && gameStatus === 'playing' && player.isSpectator && (
                        <div className="mt-3 bg-slate-950/95 border border-purple-500/40 p-2 rounded-xl text-purple-300 text-xs font-semibold">
                          Low Chips / Spectating Mode
                        </div>
                      )}

                      {isUser && gameStatus === 'playing' && isCurrentTurn && !player.isSpectator && (
                        <div className="mt-3 flex items-center gap-2 bg-slate-950/95 border border-emerald-500/40 p-2 rounded-2xl shadow-2xl backdrop-blur">
                          {player.isBlind && (
                            <button 
                              onClick={() => onSeeCardsClick(player)} 
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-emerald-400" /> See Cards
                            </button>
                          )}
                          <button 
                            onClick={() => onPackClick(player)} 
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-300"
                          >
                            Pack
                          </button>
                          <button 
                            disabled={!canAffordBet}
                            onClick={() => onChaalClick(player)} 
                            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition shadow-md ${
                              canAffordBet
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {canAffordBet ? `Chaal ($${calculatedBetAmount})` : 'Low Chips'}
                          </button>
                          {activePlayers.length >= 3 && !player.isBlind && (
                            <button 
                              onClick={() => onSideShowClick(player)}
                              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 transition"
                            >
                              Side Show
                            </button>
                          )}
                          {activePlayers.length === 2 && (
                            <button 
                              onClick={onShowCardsClick} 
                              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-extrabold transition"
                            >
                              Show
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Interactive Side Show Prompt Modal */}
        {sideShowModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
              <RefreshCw className="w-8 h-8 text-amber-400 mx-auto mb-3 animate-spin" />
              <h3 className="font-bold text-slate-100 text-lg">Side Show Request</h3>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                <span className="text-slate-200 font-bold">{sideShowModal.requester.name}</span> requested a side show comparison with <span className="text-slate-200 font-bold">{sideShowModal.target.name}</span>.
              </p>
              {sideShowModal.target.id === myPlayerId ? (
                <div className="flex gap-3">
                  <button 
                    onClick={() => respondSideShow(false)} 
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => respondSideShow(true)} 
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                  >
                    Accept
                  </button>
                </div>
              ) : (
                <div className="text-xs text-amber-400 font-medium italic animate-pulse">
                  Waiting for {sideShowModal.target.name} to accept or reject...
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
