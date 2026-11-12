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
  // customStake is null when no custom stake option is chosen; otherwise holds exact chosen value (100, 200, 500, 1000)
  const [customStake, setCustomStake] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [turnCount, setTurnCount] = useState(0);
  const [roundResult, setRoundResult] = useState(null);
  const [sideShowModal, setSideShowModal] = useState(null);
  const [copied, setCopied] = useState(false);

  // Full-Mesh Voice Chat States & Refs
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
  useEffect(() => { turnCountRef.current = turnCount; }, [turnCount]);
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { sideShowModalRef.current = sideShowModal; }, [sideShowModal]);
  useEffect(() => { roundResultRef.current = roundResult; }, [roundResult]);
  useEffect(() => { myPlayerIdRef.current = myPlayerId; }, [myPlayerId]);
  useEffect(() => { audioMutedRef.current = audioMuted; }, [audioMuted]);

  // Reset customStake whenever the active turn changes so players start each turn with default stake unless they explicitly choose a custom value
  useEffect(() => {
    setCustomStake(null);
  }, [currentTurn, gameStatus]);

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

  // Full-Mesh Voice Mesh Synchronization
  useEffect(() => {
    if (!peerRef.current || !localStreamRef.current || inLobby) return;

    const humanPeers = players
      .filter(p => !p.isBot && p.id !== myPlayerId)
      .map(p => p.id);

    humanPeers.forEach(remoteId => {
      if (!mediaCallsRef.current[remoteId]) {
        try {
          const call = peerRef.current.call(remoteId, localStreamRef.current);
          if (call) setupMediaCall(call, remoteId);
        } catch (err) {
          console.error('Error initiating mesh voice call to', remoteId, err);
        }
      }
    });
  }, [players, inLobby, myPlayerId]);

  const toggleMic = async () => {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }, 
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
        console.error('Microphone access denied:', err);
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
        deck.push({
          value: val,
          suit: suit.symbol,
          color: suit.color,
          numVal: CARD_VALUES[val]
        });
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

  const getStableSessionId = () => {
    let sid = sessionStorage.getItem('tp_session_id');
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('tp_session_id', sid);
    }
    return sid;
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

    const peer = new Peer(hostId, {
      config: { iceServers: ICE_SERVERS },
      debug: 1
    });

    peer.on('open', () => {
      const initialHostPlayer = {
        id: hostId,
        sessionId: getStableSessionId(),
        name: playerName.trim() || 'Host',
        isHost: true,
        isBot: false,
        chips: 5000,
        cards: [],
        isBlind: true,
        folded: false
      };
      setPlayers([initialHostPlayer]);
      setInLobby(false);
      setGameStatus('lobby');
      setConnStatus('Room ready. Waiting for friends...');
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connectionsRef.current[conn.peer] = conn;
      });

      conn.on('data', (data) => {
        handleIncomingData(data, conn);
      });

      conn.on('close', () => {
        removeDisconnectedPeer(conn.peer);
      });

      conn.on('error', () => {
        removeDisconnectedPeer(conn.peer);
      });
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
          turnCount: turnCountRef.current,
          roundResult: roundResultRef.current,
          sideShowModal: sideShowModalRef.current
        });
      }
      return updated;
    });
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
    const hostPeerId = 'patti_host_' + cleanCode;

    setMyPlayerId(guestId);
    setIsHost(false);
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
            name: playerName.trim() || 'Player ' + Math.floor(Math.random() * 100)
          }
        });
      });

      conn.on('data', (data) => {
        handleIncomingData(data, conn);
      });

      conn.on('close', () => {
        setErrorMessage('Disconnected from host.');
        setInLobby(true);
        setGameStatus('waiting');
        cleanupAudioAndPeers();
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

  const handleLeaveRoom = () => {
    if (!isHostRef.current) {
      const hostConn = Object.values(connectionsRef.current)[0];
      if (hostConn && hostConn.open) {
        try {
          hostConn.send({ type: 'LEAVE_ROOM', payload: { id: myPlayerIdRef.current } });
        } catch (e) {}
      }
    }
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
      const { id, sessionId, name } = data.payload;

      setPlayers(prev => {
        const filtered = prev.filter(p => {
          if (p.id === id) return false;
          if (sessionId && p.sessionId === sessionId) {
            if (connectionsRef.current[p.id]) {
              try { connectionsRef.current[p.id].close(); } catch (e) {}
              delete connectionsRef.current[p.id];
            }
            return false;
          }
          return true;
        });

        const newPlayer = {
          id,
          sessionId,
          name,
          isHost: false,
          isBot: false,
          chips: 5000,
          cards: [],
          isBlind: true,
          folded: false
        };

        const updated = [...filtered, newPlayer];

        const statePayload = {
          players: updated,
          pot: potRef.current,
          currentTurn: currentTurnRef.current,
          gameStatus: gameStatusRef.current,
          currentStake: currentStakeRef.current,
          turnCount: turnCountRef.current,
          roundResult: roundResultRef.current,
          sideShowModal: sideShowModalRef.current
        };

        conn.send({ type: 'SYNC_STATE', payload: statePayload });
        broadcastState(statePayload);
        return updated;
      });
    } else if (data.type === 'LEAVE_ROOM' && isHostRef.current) {
      removeDisconnectedPeer(data.payload.id);
    } else if (data.type === 'SYNC_STATE') {
      setPlayers(data.payload.players);
      setPot(data.payload.pot);
      setCurrentTurn(data.payload.currentTurn);
      setGameStatus(data.payload.gameStatus);
      setCurrentStake(data.payload.currentStake);
      setTurnCount(data.payload.turnCount);
      setRoundResult(data.payload.roundResult || null);
      setSideShowModal(data.payload.sideShowModal || null);
      setInLobby(false);
      setConnStatus('Connected');
    } else if (['ACTION_CHAAL', 'ACTION_PACK', 'ACTION_SEE_CARDS', 'REQUEST_SIDESHOW', 'RESPOND_SIDESHOW', 'SHOW_CARDS'].includes(data.type)) {
      handleActionMessage(data);
    }
  };

  const getPreviousActivePlayerIndex = (fromIndex, currentPlayersList) => {
    let prevIndex = (fromIndex - 1 + currentPlayersList.length) % currentPlayersList.length;
    while (currentPlayersList[prevIndex] && currentPlayersList[prevIndex].folded) {
      prevIndex = (prevIndex - 1 + currentPlayersList.length) % currentPlayersList.length;
    }
    return prevIndex;
  };

  const handleActionMessage = (actionData) => {
    if (!isHostRef.current) return;

    let updatedPlayers = [...playersRef.current];
    let newPot = potRef.current;
    let newTurn = currentTurnRef.current;
    let newTurnCount = turnCountRef.current;
    let newStake = currentStakeRef.current;
    let newGameStatus = gameStatusRef.current;
    let newRoundResult = roundResultRef.current;
    let newSideShowModal = sideShowModalRef.current;

    if (actionData.type === 'ACTION_CHAAL') {
      const { playerId, totalBet, isCustom } = actionData.payload;
      const actingPlayer = updatedPlayers.find(p => p.id === playerId);
      
      // Guard against negative balances or insufficient funds
      if (!actingPlayer || actingPlayer.chips < totalBet) return;

      updatedPlayers = updatedPlayers.map(p => p.id === playerId ? { ...p, chips: p.chips - totalBet } : p);
      newPot += totalBet;

      // Update table base stake only when not overridden by a custom flat bet, or keep base stake synced appropriately
      if (!isCustom) {
        const impliedBase = actingPlayer.isBlind ? totalBet : Math.floor(totalBet / 2);
        if (impliedBase > newStake) newStake = impliedBase;
      }

      const active = updatedPlayers.filter(p => !p.folded);
      if (active.length === 1) {
        handleWinnerHost(active[0], updatedPlayers, newPot);
        return;
      }

      newTurn = getNextTurnIndexHost(newTurn, updatedPlayers);
      newTurnCount += 1;
    } else if (actionData.type === 'ACTION_PACK') {
      const { playerId } = actionData.payload;
      updatedPlayers = updatedPlayers.map(p => p.id === playerId ? { ...p, folded: true } : p);
      
      const active = updatedPlayers.filter(p => !p.folded);
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
        const active = updatedPlayers.filter(p => !p.folded);
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
        const active = updatedPlayers.filter(p => !p.folded);
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
    setGameStatus(newGameStatus);
    setSideShowModal(newSideShowModal);

    broadcastState({
      players: updatedPlayers,
      pot: newPot,
      currentTurn: newTurn,
      gameStatus: newGameStatus,
      currentStake: newStake,
      turnCount: newTurnCount,
      roundResult: newRoundResult,
      sideShowModal: newSideShowModal
    });
  };

  const getNextTurnIndexHost = (fromIndex, currentPlayersList) => {
    let next = (fromIndex + 1) % currentPlayersList.length;
    while (currentPlayersList[next] && currentPlayersList[next].folded) {
      next = (next + 1) % currentPlayersList.length;
    }
    return next;
  };

  // Bot Turn Automation Engine
  useEffect(() => {
    if (!isHost || gameStatus !== 'playing') return;

    const currentPlayer = players[currentTurn];
    if (currentPlayer && currentPlayer.isBot && !currentPlayer.folded) {
      const botTimer = setTimeout(() => {
        const requiredAmount = currentPlayer.isBlind ? currentStake : currentStake * 2;
        if (currentPlayer.chips < requiredAmount || (Math.random() < 0.15 && turnCount > 2)) {
          handleActionMessage({
            type: 'ACTION_PACK',
            payload: { playerId: currentPlayer.id }
          });
        } else {
          handleActionMessage({
            type: 'ACTION_CHAAL',
            payload: { playerId: currentPlayer.id, totalBet: requiredAmount, isCustom: false }
          });
        }
      }, 1200);

      return () => clearTimeout(botTimer);
    }
  }, [currentTurn, gameStatus, isHost, players, currentStake, turnCount]);

  const startGame = () => {
    let currentPlayers = players.filter(p => !p.isBot);
    const neededBots = Math.max(0, maxSeats - currentPlayers.length);
    
    for (let i = 0; i < neededBots; i++) {
      currentPlayers.push({
        id: `bot_${i}_${Date.now()}`,
        name: `${BOT_NAMES[i % BOT_NAMES.length]} (Bot)`,
        isHost: false,
        isBot: true,
        chips: 5000,
        cards: [],
        isBlind: Math.random() > 0.4,
        folded: false
      });
    }

    const deck = createShuffledDeck();
    let totalInitialPot = 0;

    const dealtPlayers = currentPlayers.map(p => {
      const resetChips = p.chips < bootAmount ? 5000 : p.chips;
      totalInitialPot += bootAmount;
      return {
        ...p,
        cards: [deck.pop(), deck.pop(), deck.pop()],
        isBlind: true,
        folded: false,
        chips: resetChips - bootAmount
      };
    });

    setPlayers(dealtPlayers);
    setPot(totalInitialPot);
    setCurrentStake(bootAmount);
    setCustomStake(null);
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
        turnCount: 1,
        roundResult: null,
        sideShowModal: null
      });
    }
  };

  const handleWinnerHost = (winner, updatedPlayers, finalPot) => {
    const winningEval = evaluateHand(winner.cards);
    const finalPlayers = updatedPlayers.map(p => ({
      ...p,
      isBlind: false,
      chips: p.id === winner.id ? p.chips + finalPot : p.chips
    }));
    
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
      turnCount: turnCountRef.current,
      roundResult: resData,
      sideShowModal: null
    });
  };

  const handleShowdownHost = (updatedPlayers, finalPot) => {
    const active = updatedPlayers.filter(p => !p.folded);
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

  /**
   * Bet Calculation Logic:
   * - If a custom stake option IS chosen (customStake !== null): use that exact custom value as-is (do NOT double when cards are seen).
   * - If NO custom stake option is chosen (customStake === null): double the table stake if cards are seen (currentStake * 2), or 1x if blind (currentStake).
   */
  const calculatePlayerBet = (player) => {
    if (customStake !== null) {
      return customStake;
    }
    return player.isBlind ? currentStake : currentStake * 2;
  };

  const onChaalClick = (player) => {
    const totalBet = calculatePlayerBet(player);
    if (player.chips < totalBet) return;

    sendActionToHostOrPeers({
      type: 'ACTION_CHAAL',
      payload: { 
        playerId: player.id, 
        totalBet,
        isCustom: customStake !== null
      }
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

  const activePlayers = players.filter(p => !p.folded);

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
                    Table Base Stake: <span className="text-emerald-400 font-bold">${currentStake}</span>
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
                      Share room code <span className="font-mono font-bold text-emerald-400">{roomCode}</span> with friends. Real-time players connected: {players.length}
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

                  // Exact bet calculation: Custom stake stays as-is (no doubling); default stake doubles when cards are seen
                  const calculatedBetAmount = calculatePlayerBet(player);
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
                          : player.folded 
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
                            {player.folded ? (
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

                      {(gameStatus === 'playing' || gameStatus === 'ended') && player.cards && player.cards.length > 0 && (
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

                      {/* On-Table Action Panel with Exact Custom Stake Selector + Reset Option */}
                      {isUser && gameStatus === 'playing' && isCurrentTurn && (
                        <div className="mt-3 flex flex-col items-center gap-1.5 bg-slate-950/95 border border-emerald-500/40 p-2.5 rounded-2xl shadow-2xl backdrop-blur">
                          
                          {/* Custom Stake Selector Row with Reset */}
                          <div className="flex items-center gap-1 flex-wrap justify-center">
                            <span className="text-[10px] font-semibold uppercase text-slate-400 mr-1">Custom Stake:</span>
                            {STAKE_OPTIONS.map(stakeOpt => {
                              const isDisabled = player.chips < stakeOpt;
                              const isSelected = customStake === stakeOpt;

                              return (
                                <button
                                  key={stakeOpt}
                                  disabled={isDisabled}
                                  onClick={() => setCustomStake(isSelected ? null : stakeOpt)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                                    isSelected
                                      ? 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-300'
                                      : isDisabled
                                      ? 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  ${stakeOpt}
                                </button>
                              );
                            })}
                            {customStake !== null && (
                              <button
                                onClick={() => setCustomStake(null)}
                                className="ml-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 flex items-center gap-1 transition"
                                title="Reset custom stake selection"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> Reset
                              </button>
                            )}
                          </div>

                          {/* Action Buttons Row */}
                          <div className="flex items-center gap-2">
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
