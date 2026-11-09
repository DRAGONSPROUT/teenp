import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { 
  Users, Shield, Zap, Play, Volume2, VolumeX, Mic, MicOff, 
  Eye, RefreshCw, Trophy, Crown, ArrowRight, Copy, Check, LogOut, AlertCircle
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
  { symbol: '♠', name: 'spades', color: 'text-slate-100' },
  { symbol: '♥', name: 'hearts', color: 'text-rose-500' },
  { symbol: '♦', name: 'diamonds', color: 'text-rose-500' },
  { symbol: '♣', name: 'clubs', color: 'text-slate-100' }
];

const BOT_NAMES = ['Aarav', 'Vihaan', 'Ananya', 'Diya', 'Kabir', 'Rohan'];

// ICE Servers configuration with multi-region STUN/TURN servers to allow cross-network connections (Wi-Fi vs Mobile Data)
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
  const [bootAmount, setBootAmount] = useState(50);
  const [maxSeats, setMaxSeats] = useState(4);
  const [playerName, setPlayerName] = useState('Player 1');
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [connStatus, setConnStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [players, setPlayers] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [pot, setPot] = useState(0);
  const [currentStake, setCurrentStake] = useState(50);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [turnCount, setTurnCount] = useState(0);
  const [winnerModal, setWinnerModal] = useState(null);
  const [copied, setCopied] = useState(false);

  const peerRef = useRef(null);
  const connectionsRef = useRef({});
  const playersRef = useRef(players);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Clean up PeerJS on component unmount
  useEffect(() => {
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  const generateCard = () => {
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const val = values[Math.floor(Math.random() * values.length)];
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    return { value: val, suit: suit.symbol, color: suit.color, numVal: CARD_VALUES[val] };
  };

  const generateHand = () => [generateCard(), generateCard(), generateCard()];

  const evaluateHand = (cards) => {
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

  const sanitizeCode = (code) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const createRoom = () => {
    setErrorMessage('');
    const rawCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const formattedCode = sanitizeCode(rawCode);
    const hostId = 'patti_host_' + formattedCode;

    setRoomCode(formattedCode);
    setIsHost(true);
    setMyPlayerId(hostId);
    setConnStatus('Initializing peer room...');

    if (peerRef.current) {
      peerRef.current.destroy();
    }

    const peer = new Peer(hostId, {
      config: { iceServers: ICE_SERVERS },
      debug: 1
    });

    peer.on('open', (id) => {
      console.log('Host room ready:', id);
      const initialHostPlayer = {
        id: hostId,
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
      console.log('Incoming client connection:', conn.peer);

      conn.on('open', () => {
        connectionsRef.current[conn.peer] = conn;
      });

      conn.on('data', (data) => {
        handleIncomingData(data, conn);
      });

      conn.on('close', () => {
        console.log('Player disconnected:', conn.peer);
        delete connectionsRef.current[conn.peer];
        setPlayers(prev => {
          const updated = prev.filter(p => p.id !== conn.peer);
          if (isHostRef.current) {
            broadcastState({
              players: updated,
              pot,
              currentTurn,
              gameStatus,
              currentStake,
              turnCount
            });
          }
          return updated;
        });
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
      });
    });

    peer.on('error', (err) => {
      console.error('Host peer error:', err);
      if (err.type === 'unavailable-id') {
        setErrorMessage('Room code collision. Please click Create again.');
      } else {
        setErrorMessage('Peer connection error: ' + err.message);
      }
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
      setErrorMessage('Room code must be 6 alphanumeric characters.');
      return;
    }

    const guestId = 'patti_guest_' + Math.random().toString(36).substring(2, 8);
    const hostPeerId = 'patti_host_' + cleanCode;

    setMyPlayerId(guestId);
    setIsHost(false);
    setConnStatus('Connecting to room ' + cleanCode + '...');

    if (peerRef.current) {
      peerRef.current.destroy();
    }

    const peer = new Peer(guestId, {
      config: { iceServers: ICE_SERVERS },
      debug: 1
    });

    peer.on('open', (id) => {
      console.log('Guest peer opened:', id);
      const conn = peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        console.log('Connected to host:', hostPeerId);
        connectionsRef.current[hostPeerId] = conn;
        setConnStatus('Handshake established! Synchronizing...');

        conn.send({
          type: 'JOIN_REQUEST',
          payload: {
            id: guestId,
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
      });

      conn.on('error', (err) => {
        console.error('Guest connection error:', err);
        setErrorMessage('Failed to connect to host. Check room code.');
      });
    });

    peer.on('error', (err) => {
      console.error('Guest peer error:', err);
      setErrorMessage('Unable to connect to room. Please check the code or network connection.');
      setConnStatus('');
    });

    peerRef.current = peer;
  };

  const handleIncomingData = (data, conn) => {
    if (!data || !data.type) return;

    if (data.type === 'JOIN_REQUEST' && isHostRef.current) {
      const newPlayer = {
        id: data.payload.id,
        name: data.payload.name,
        isHost: false,
        isBot: false,
        chips: 5000,
        cards: [],
        isBlind: true,
        folded: false
      };

      setPlayers(prev => {
        const exists = prev.some(p => p.id === newPlayer.id);
        const updated = exists ? prev : [...prev, newPlayer];

        const statePayload = {
          players: updated,
          pot,
          currentTurn,
          gameStatus,
          currentStake,
          turnCount
        };

        conn.send({ type: 'SYNC_STATE', payload: statePayload });
        broadcastState(statePayload);
        return updated;
      });
    } else if (data.type === 'SYNC_STATE') {
      setPlayers(data.payload.players);
      setPot(data.payload.pot);
      setCurrentTurn(data.payload.currentTurn);
      setGameStatus(data.payload.gameStatus);
      setCurrentStake(data.payload.currentStake);
      setTurnCount(data.payload.turnCount);
      setInLobby(false);
      setConnStatus('Connected');
    } else if (data.type === 'ACTION_CHAAL') {
      handleChaal(data.payload.playerId, data.payload.amount);
    } else if (data.type === 'ACTION_PACK') {
      handlePack(data.payload.playerId);
    }
  };

  const startGame = () => {
    let currentPlayers = [...players];
    const neededBots = maxSeats - currentPlayers.length;
    
    for (let i = 0; i < neededBots; i++) {
      currentPlayers.push({
        id: `bot_${i}`,
        name: `${BOT_NAMES[i % BOT_NAMES.length]} (Bot)`,
        isHost: false,
        isBot: true,
        chips: 5000,
        cards: [],
        isBlind: Math.random() > 0.4,
        folded: false
      });
    }

    const dealtPlayers = currentPlayers.map(p => ({
      ...p,
      cards: generateHand(),
      isBlind: true,
      folded: false,
      chips: p.chips - bootAmount
    }));

    const initialPot = bootAmount * dealtPlayers.length;
    setPlayers(dealtPlayers);
    setPot(initialPot);
    setCurrentStake(bootAmount);
    setCurrentTurn(0);
    setTurnCount(1);
    setGameStatus('playing');
    setWinnerModal(null);

    if (isHost) {
      broadcastState({
        players: dealtPlayers,
        pot: initialPot,
        currentTurn: 0,
        gameStatus: 'playing',
        currentStake: bootAmount,
        turnCount: 1
      });
    }
  };

  const getNextTurnIndex = (fromIndex) => {
    let next = (fromIndex + 1) % players.length;
    while (players[next].folded) {
      next = (next + 1) % players.length;
    }
    return next;
  };

  const advanceTurn = () => {
    const active = players.filter(p => !p.folded);
    if (active.length === 1) {
      handleWinner(active[0]);
      return;
    }

    if (turnCount >= 12) {
      handleShowdown();
      return;
    }

    const nextIndex = getNextTurnIndex(currentTurn);
    setCurrentTurn(nextIndex);
    setTurnCount(prev => prev + 1);
  };

  const handleChaal = (playerId, amount) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, chips: p.chips - amount } : p));
    setPot(prev => prev + amount);
    advanceTurn();
  };

  const handlePack = (playerId) => {
    const updated = players.map(p => p.id === playerId ? { ...p, folded: true } : p);
    setPlayers(updated);
    
    const remaining = updated.filter(p => !p.folded);
    if (remaining.length === 1) {
      handleWinner(remaining[0]);
    } else {
      advanceTurn();
    }
  };

  const handleSeeCards = (playerId) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, isBlind: false } : p));
  };

  const handleWinner = (winner, evalResult = null) => {
    const winningEval = evalResult || evaluateHand(winner.cards);
    setPlayers(prev => prev.map(p => p.id === winner.id ? { ...p, chips: p.chips + pot } : p));
    setWinnerModal({
      winner,
      handName: winningEval.name,
      amount: pot
    });
    setGameStatus('ended');
  };

  const handleShowdown = () => {
    const active = players.filter(p => !p.folded);
    let bestPlayer = active[0];
    let bestEval = evaluateHand(active[0].cards);

    active.forEach(p => {
      const ev = evaluateHand(p.cards);
      if (ev.rank > bestEval.rank || (ev.rank === bestEval.rank && ev.score > bestEval.score)) {
        bestEval = ev;
        bestPlayer = p;
      }
    });

    handleWinner(bestPlayer, bestEval);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <p className="text-xs text-slate-400 font-medium">Real-time WebRTC Private Multiplayer</p>
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
            <button 
              onClick={() => {
                setInLobby(true);
                if (peerRef.current) peerRef.current.destroy();
              }} 
              className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition"
              title="Leave Room"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 relative z-10 flex items-center justify-center p-4">
        {inLobby ? (
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold text-slate-100 mb-1">Join or Create Private Table</h2>
            <p className="text-xs text-slate-400 mb-4">Play real-time WebRTC 3-card Poker with friends across networks</p>

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
                    <option value={50}>$50</option>
                    <option value={100}>$100</option>
                    <option value={500}>$500</option>
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
            <div className="w-full aspect-[16/9] max-h-[580px] bg-slate-900 border-[12px] border-emerald-900/60 rounded-[120px] relative shadow-[0_0_80px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center p-6 border-emerald-950">
              <div className="absolute inset-4 rounded-[100px] border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-slate-950/80 pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center mb-4">
                <div className="bg-slate-950/90 border border-emerald-500/30 px-6 py-2 rounded-full shadow-lg text-center backdrop-blur">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Total Pot</span>
                  <span className="text-2xl font-black text-emerald-400 tracking-tight">${pot}</span>
                </div>
                {gameStatus === 'playing' && (
                  <div className="mt-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
                    Turn <span className="text-emerald-400 font-bold">{turnCount}</span>/12 • Stake: <span className="text-emerald-400 font-bold">${currentStake}</span>
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
                    <div className="text-xs text-amber-400 font-medium">Waiting for the host to start the game...</div>
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
                      </div>

                      {gameStatus === 'playing' && player.cards && player.cards.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {player.cards.map((card, cIdx) => (
                            <div 
                              key={cIdx} 
                              className={`w-9 h-12 rounded-md border flex flex-col items-center justify-center font-bold text-xs shadow-md ${
                                isUser && !player.isBlind 
                                  ? 'bg-slate-100 border-slate-300 text-slate-900' 
                                  : 'bg-slate-800 border-slate-700 text-slate-600'
                              }`}
                            >
                              {isUser && !player.isBlind ? (
                                <>
                                  <span className={`text-[10px] leading-none ${card.color}`}>{card.value}</span>
                                  <span className={`text-xs ${card.color}`}>{card.suit}</span>
                                </>
                              ) : (
                                <div className="w-full h-full border border-slate-700/50 rounded flex items-center justify-center">🂠</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isUser && gameStatus === 'playing' && isCurrentTurn && (
                        <div className="mt-3 flex items-center gap-2 bg-slate-950/95 border border-emerald-500/40 p-2 rounded-2xl shadow-2xl backdrop-blur">
                          {player.isBlind && (
                            <button 
                              onClick={() => handleSeeCards(player.id)} 
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200"
                            >
                              <Eye className="w-3 h-3 text-emerald-400" /> See Cards
                            </button>
                          )}
                          <button 
                            onClick={() => handlePack(player.id)} 
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-300"
                          >
                            Pack
                          </button>
                          <button 
                            onClick={() => handleChaal(player.id, player.isBlind ? currentStake : currentStake * 2)} 
                            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-extrabold"
                          >
                            Chaal (${player.isBlind ? currentStake : currentStake * 2})
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {winnerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-bounce" />
              <h3 className="font-extrabold text-2xl text-slate-100">{winnerModal.winner.name} Wins!</h3>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mt-1">{winnerModal.handName}</p>
              <div className="my-6 bg-slate-950 border border-slate-800 py-3 rounded-2xl">
                <span className="text-xs text-slate-400 block">Total Pot Won</span>
                <span className="text-3xl font-black text-emerald-400">${winnerModal.amount}</span>
              </div>
              {isHost && (
                <button 
                  onClick={startGame}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  Play Next Hand
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
