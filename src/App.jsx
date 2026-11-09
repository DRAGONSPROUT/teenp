import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import { 
  Users, Volume2, VolumeX, Shield, Play, RotateCcw, 
  Copy, Check, Award, Eye, EyeOff, Coins, RefreshCw, Mic, MicOff
} from 'lucide-react';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];

const getRankVal = (r) => RANKS.indexOf(r);

const evaluateHand = (cards) => {
  if (!cards || cards.length < 3) return { score: 0, title: "Invalid" };
  const parsed = cards.map(c => ({ val: getRankVal(c.rank), suit: c.suit, rank: c.rank })).sort((a, b) => b.val - a.val);
  const isFlush = parsed[0].suit === parsed[1].suit && parsed[1].suit === parsed[2].suit;
  
  let isSeq = false;
  let seqHighVal = parsed[0].val;

  if (parsed[0].val - parsed[1].val === 1 && parsed[1].val - parsed[2].val === 1) {
    isSeq = true;
  } else if (parsed[0].rank === 'A' && parsed[1].rank === '3' && parsed[2].rank === '2') {
    isSeq = true;
    seqHighVal = 1;
  }

  const v0 = parsed[0].val, v1 = parsed[1].val, v2 = parsed[2].val;

  if (v0 === v1 && v1 === v2) return { score: 50000 + v0, title: `Trail (${parsed[0].rank}s)` };
  if (isFlush && isSeq) return { score: 40000 + seqHighVal, title: `Pure Sequence (${parsed[0].rank} High)` };
  if (isSeq) return { score: 30000 + seqHighVal, title: `Sequence (${parsed[0].rank} High)` };
  if (isFlush) return { score: 20000 + v0 * 100 + v1 * 10 + v2, title: `Flush (${parsed[0].rank} High)` };
  if (v0 === v1 || v1 === v2 || v0 === v2) {
    const pairVal = (v0 === v1) ? v0 : (v1 === v2 ? v1 : v0);
    const kickerVal = (v0 === v1) ? v2 : (v1 === v2 ? v0 : v1);
    return { score: 10000 + pairVal * 100 + kickerVal, title: `Pair of ${RANKS[pairVal]}s` };
  }

  return { score: v0 * 100 + v1 * 10 + v2, title: `High Card (${parsed[0].rank})` };
};

export default function App() {
  const [gameState, setGameState] = useState('LOBBY');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [bootAmount, setBootAmount] = useState(100);
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [myId, setMyId] = useState('');

  // Networking state
  const peerRef = useRef(null);
  const connectionsRef = useRef([]); // Host keeps track of connected peers
  const hostConnRef = useRef(null);   // Client keeps connection to Host

  // Voice Chat State
  const [voiceMuted, setVoiceMuted] = useState(false);
  const localStreamRef = useRef(null);
  const remoteAudioContainerRef = useRef(null);

  // Gameplay State
  const [players, setPlayers] = useState([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [pot, setPot] = useState(0);
  const [currentStake, setCurrentStake] = useState(100);
  const [winner, setWinner] = useState(null);
  const [roundTurnCount, setRoundTurnCount] = useState(0);

  // Initialize Voice Media Stream
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true, video: false })
      .then(stream => {
        localStreamRef.current = stream;
      })
      .catch(err => console.warn("Mic permission missing/denied", err));
  }, []);

  // Broadcast state changes from Host to all Clients
  const broadcastState = (updatedState) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'STATE_UPDATE', data: updatedState });
      }
    });
  };

  // Host creates room with PeerJS ID
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const generatedCode = 'TP-' + Math.floor(100000 + Math.random() * 900000);
    setRoomCode(generatedCode);
    setIsHost(true);

    const peer = new Peer(generatedCode);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
      const initialHostPlayer = {
        id: id,
        name: playerName + ' (Host)',
        chips: 5000,
        isBlind: true,
        cards: [],
        isPacked: false,
        isHost: true,
        isBot: false
      };

      // Fill remaining seats with Bots
      const botPlayers = [
        { id: 'bot1', name: 'Aarav (Bot)', chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: false, isBot: true },
        { id: 'bot2', name: 'Riya (Bot)', chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: false, isBot: true },
      ];

      const initialPlayers = [initialHostPlayer, ...botPlayers];
      setPlayers(initialPlayers);
      setGameState('WAITING');
    });

    // Handle incoming client player connection
    peer.on('connection', (conn) => {
      connectionsRef.current.push(conn);

      conn.on('data', (data) => {
        if (data.type === 'JOIN_PLAYER') {
          setPlayers(prev => {
            // Replace a bot slot or add player
            const nextList = [...prev];
            const botIdx = nextList.findIndex(p => p.isBot);
            const newP = {
              id: conn.peer,
              name: data.name,
              chips: 5000,
              isBlind: true,
              cards: [],
              isPacked: false,
              isHost: false,
              isBot: false
            };

            if (botIdx !== -1) {
              nextList[botIdx] = newP;
            } else if (nextList.length < 6) {
              nextList.push(newP);
            }

            broadcastState({ players: nextList, gameState: 'WAITING', pot, currentStake });
            return nextList;
          });
        }

        if (data.type === 'PLAYER_ACTION') {
          handleActionFromClient(data.action, data.playerId, data.payload);
        }
      });
    });

    // Peer Voice Call Stream Receiver
    peer.on('call', (call) => {
      call.answer(localStreamRef.current);
      call.on('stream', (remoteStream) => {
        attachAudioStream(call.peer, remoteStream);
      });
    });
  };

  // Client joins room via PeerJS Code
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !inputCode.trim()) return;

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
      const conn = peer.connect(inputCode.trim());
      hostConnRef.current = conn;

      conn.on('open', () => {
        conn.send({ type: 'JOIN_PLAYER', name: playerName });
        setRoomCode(inputCode.trim());
        setIsHost(false);
        setGameState('WAITING');

        // Call Host Audio Voice
        if (localStreamRef.current) {
          const call = peer.call(inputCode.trim(), localStreamRef.current);
          call.on('stream', (remoteStream) => {
            attachAudioStream(inputCode.trim(), remoteStream);
          });
        }
      });

      conn.on('data', (data) => {
        if (data.type === 'STATE_UPDATE') {
          if (data.data.players) setPlayers(data.data.players);
          if (data.data.gameState) setGameState(data.data.gameState);
          if (data.data.pot !== undefined) setPot(data.data.pot);
          if (data.data.currentStake !== undefined) setCurrentStake(data.data.currentStake);
          if (data.data.currentTurnIdx !== undefined) setCurrentTurnIdx(data.data.currentTurnIdx);
          if (data.data.winner !== undefined) setWinner(data.data.winner);
        }
      });
    });
  };

  const attachAudioStream = (peerId, stream) => {
    let audioEl = document.getElementById(`audio-${peerId}`);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `audio-${peerId}`;
      audioEl.autoplay = true;
      remoteAudioContainerRef.current?.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
  };

  // Host Game Logic Engine
  const startNewHand = () => {
    if (!isHost) return;

    const deck = [];
    SUITS.forEach(suit => {
      RANKS.forEach(rank => {
        deck.push({ suit, rank });
      });
    });

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    let deckIdx = 0;
    let bootCollected = 0;

    const updatedPlayers = players.map(p => {
      if (p.chips < bootAmount) return { ...p, isPacked: true, cards: [] };
      bootCollected += bootAmount;
      return {
        ...p,
        chips: p.chips - bootAmount,
        cards: [deck[deckIdx++], deck[deckIdx++], deck[deckIdx++]],
        isBlind: true,
        isPacked: false
      };
    });

    const newState = {
      players: updatedPlayers,
      pot: bootCollected,
      currentStake: bootAmount,
      currentTurnIdx: 0,
      gameState: 'PLAYING',
      winner: null,
      roundTurnCount: 0
    };

    setPot(bootCollected);
    setCurrentStake(bootAmount);
    setPlayers(updatedPlayers);
    setCurrentTurnIdx(0);
    setGameState('PLAYING');
    setWinner(null);
    setRoundTurnCount(0);

    broadcastState(newState);
  };

  // Handle player turns & actions
  const sendPlayerAction = (action, payload = {}) => {
    if (isHost) {
      handleActionFromClient(action, myId, payload);
    } else if (hostConnRef.current) {
      hostConnRef.current.send({ type: 'PLAYER_ACTION', playerId: myId, action, payload });
    }
  };

  const handleActionFromClient = (action, playerId, payload) => {
    if (!isHost) return;

    if (action === 'PACK') {
      const updated = players.map(p => p.id === playerId ? { ...p, isPacked: true } : p);
      setPlayers(updated);
      advanceTurn(updated);
    } else if (action === 'CHAAL') {
      const updated = players.map(p => p.id === playerId ? { ...p, chips: p.chips - payload.amount } : p);
      const newPot = pot + payload.amount;
      setPot(newPot);
      setPlayers(updated);
      advanceTurn(updated, newPot);
    } else if (action === 'SEE_CARDS') {
      const updated = players.map(p => p.id === playerId ? { ...p, isBlind: false } : p);
      setPlayers(updated);
      broadcastState({ players: updated });
    } else if (action === 'SHOW') {
      executeShowdown();
    }
  };

  const advanceTurn = (currentPlayersList, updatedPot = pot) => {
    const active = currentPlayersList.filter(p => !p.isPacked);
    if (active.length === 1) {
      declareWinner(active[0], "All other players packed!", updatedPot);
      return;
    }

    if (roundTurnCount >= 12) {
      executeShowdown(currentPlayersList, updatedPot);
      return;
    }

    const nextIdx = (currentTurnIdx + 1) % currentPlayersList.length;
    setCurrentTurnIdx(nextIdx);
    setRoundTurnCount(prev => prev + 1);

    broadcastState({
      players: currentPlayersList,
      currentTurnIdx: nextIdx,
      pot: updatedPot
    });
  };

  // Bot Turn Automated Simulation
  useEffect(() => {
    if (!isHost || gameState !== 'PLAYING') return;

    const currentP = players[currentTurnIdx];
    if (currentP && currentP.isBot && !currentP.isPacked) {
      const timer = setTimeout(() => {
        const required = currentP.isBlind ? currentStake : currentStake * 2;
        const activeCount = players.filter(p => !p.isPacked).length;

        if (currentP.chips < required || (roundTurnCount > 8 && Math.random() > 0.6)) {
          handleActionFromClient('PACK', currentP.id);
        } else if (activeCount === 2 && roundTurnCount >= 6 && Math.random() > 0.5) {
          executeShowdown();
        } else {
          handleActionFromClient('CHAAL', currentP.id, { amount: required });
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [currentTurnIdx, gameState, isHost]);

  const executeShowdown = (currentPlayersList = players, targetPot = pot) => {
    const active = currentPlayersList.filter(p => !p.isPacked);
    let bestPlayer = active[0];
    let bestHand = evaluateHand(active[0].cards);

    for (let i = 1; i < active.length; i++) {
      const hand = evaluateHand(active[i].cards);
      if (hand.score > bestHand.score) {
        bestHand = hand;
        bestPlayer = active[i];
      }
    }

    declareWinner(bestPlayer, `Won showdown with ${bestHand.title}!`, targetPot);
  };

  const declareWinner = (winPlayer, reason, finalPot) => {
    const updated = players.map(p => p.id === winPlayer.id ? { ...p, chips: p.chips + finalPot } : p);
    setWinner({ ...winPlayer, reason });
    setPlayers(updated);
    setGameState('ENDED');

    broadcastState({
      players: updated,
      winner: { ...winPlayer, reason },
      gameState: 'ENDED'
    });
  };

  const toggleVoiceMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = voiceMuted;
      });
      setVoiceMuted(!voiceMuted);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myPlayerObj = players.find(p => p.id === myId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between select-none">
      <div ref={remoteAudioContainerRef} className="hidden" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-emerald-500/20">
            3P
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide bg-gradient-to-r from-amber-200 via-emerald-200 to-teal-200 bg-clip-text text-transparent">
              TEEN PATTI ARENA
            </h1>
            <p className="text-xs text-slate-400">Live Peer-to-Peer Voice Room</p>
          </div>
        </div>

        {gameState !== 'LOBBY' && (
          <div className="flex items-center gap-4">
            <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-xs text-slate-400">ROOM:</span>
              <span className="font-mono font-bold text-amber-400">{roomCode}</span>
              <button onClick={copyRoomCode} className="text-slate-400 hover:text-slate-200 transition">
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>

            <button 
              onClick={toggleVoiceMute}
              className={`p-2.5 rounded-xl border transition flex items-center gap-2 text-xs font-semibold ${
                voiceMuted 
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {voiceMuted ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{voiceMuted ? 'Muted' : 'Voice Active'}</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        {gameState === 'LOBBY' && (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl z-10">
            <h2 className="text-2xl font-bold text-center mb-6 text-slate-100">Teen Patti Private Room</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">YOUR DISPLAY NAME</label>
                <input 
                  type="text" 
                  value={playerName} 
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your nickname"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">ENTER ROOM CODE TO JOIN</label>
                <input 
                  type="text" 
                  value={inputCode} 
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="e.g. TP-492104"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 uppercase font-mono focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button 
                  onClick={handleCreateRoom}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-amber-500/20"
                >
                  Create Room
                </button>
                <button 
                  onClick={handleJoinRoom}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 rounded-xl border border-slate-700 transition"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'WAITING' && (
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center shadow-2xl z-10">
            <h2 className="text-xl font-bold mb-2">Room Code Ready</h2>
            <p className="text-sm text-slate-400 mb-6">Send this code to your friends. Host can fill empty seats with bots.</p>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500">SHARE ROOM CODE</p>
                <p className="text-3xl font-mono font-black text-amber-400">{roomCode}</p>
              </div>
              <button 
                onClick={copyRoomCode}
                className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>

            <div className="space-y-2 mb-6">
              <p className="text-xs font-semibold text-slate-400 text-left">CONNECTED PLAYERS ({players.length}/6)</p>
              {players.map(p => (
                <div key={p.id} className="bg-slate-950/60 border border-slate-800/80 px-4 py-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400 text-sm">
                      {p.name[0]}
                    </div>
                    <span className="font-semibold text-sm">{p.name}</span>
                  </div>
                  {p.isHost && <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">HOST</span>}
                </div>
              ))}
            </div>

            {isHost ? (
              <button 
                onClick={startNewHand}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-4 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Play size={18} fill="currentColor" /> Deal Hand
              </button>
            ) : (
              <p className="text-amber-400 text-xs font-medium animate-pulse">Waiting for host to start hand...</p>
            )}
          </div>
        )}

        {(gameState === 'PLAYING' || gameState === 'ENDED') && (
          <div className="w-full max-w-5xl h-[560px] relative rounded-[100px] bg-emerald-950 border-[14px] border-amber-900/60 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] flex items-center justify-center">
            <div className="z-10 bg-slate-950/80 backdrop-blur-md border border-amber-500/30 px-6 py-3 rounded-2xl text-center shadow-xl">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">TOTAL POT</p>
              <div className="flex items-center gap-1.5 justify-center">
                <Coins size={18} className="text-amber-400" />
                <span className="text-2xl font-black text-amber-400 font-mono">${pot}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Stake: ${currentStake}</p>
            </div>

            {players.map((p, idx) => {
              const total = players.length;
              const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
              const x = Math.cos(angle) * 340;
              const y = Math.sin(angle) * 210;
              const isCurrentTurn = currentTurnIdx === idx && gameState === 'PLAYING';

              return (
                <div 
                  key={p.id}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  className={`absolute flex flex-col items-center transition-all duration-300 ${
                    p.isPacked ? 'opacity-40 grayscale' : 'opacity-100'
                  }`}
                >
                  <div className="flex gap-1 -mb-3 z-10">
                    {p.cards.map((c, cIdx) => {
                      const showCard = (p.id === myId && !p.isBlind) || (gameState === 'ENDED');
                      return (
                        <div 
                          key={cIdx} 
                          className={`w-10 h-14 rounded-md border flex flex-col items-center justify-center font-bold text-xs shadow-md ${
                            showCard 
                              ? 'bg-slate-100 border-slate-300 text-slate-900' 
                              : 'bg-gradient-to-br from-amber-700 to-amber-950 border-amber-600 text-amber-400'
                          }`}
                        >
                          {showCard ? (
                            <>
                              <span className={c.suit === '♥' || c.suit === '♦' ? 'text-rose-600' : 'text-slate-900'}>{c.rank}</span>
                              <span className={c.suit === '♥' || c.suit === '♦' ? 'text-rose-600' : 'text-slate-900'}>{c.suit}</span>
                            </>
                          ) : (
                            <Shield size={14} className="opacity-40" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className={`px-4 py-2 rounded-2xl bg-slate-900/90 border flex flex-col items-center shadow-xl ${
                    isCurrentTurn ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-slate-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{p.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                        p.isBlind ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {p.isBlind ? 'BLIND' : 'SEEN'}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-amber-400 font-semibold">${p.chips}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {gameState === 'ENDED' && winner && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/40 p-8 rounded-3xl text-center max-w-sm w-full shadow-2xl">
              <Award size={48} className="mx-auto text-amber-400 mb-3 animate-bounce" />
              <h3 className="text-2xl font-black text-slate-100">{winner.name} WINS!</h3>
              <p className="text-sm text-slate-400 mt-1 mb-4">{winner.reason}</p>
              
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6">
                <span className="text-xs text-slate-500 block">TOTAL COLLECTED</span>
                <span className="text-3xl font-mono font-black text-amber-400">${pot}</span>
              </div>

              {isHost ? (
                <button 
                  onClick={startNewHand}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} /> Play Next Hand
                </button>
              ) : (
                <p className="text-slate-400 text-xs animate-pulse">Waiting for host to start next hand...</p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Control Footer */}
      {gameState === 'PLAYING' && (
        <footer className="border-t border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {myPlayerObj?.isBlind ? (
                <button 
                  onClick={() => sendPlayerAction('SEE_CARDS')}
                  className="bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                >
                  <Eye size={16} /> See Cards (2x Bet)
                </button>
              ) : (
                <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <EyeOff size={14} /> Cards Seen
                </div>
              )}
            </div>

            {players[currentTurnIdx]?.id === myId ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => sendPlayerAction('PACK')}
                  className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 px-6 py-3 rounded-xl font-bold text-sm transition"
                >
                  Pack (Fold)
                </button>

                {players.filter(p => !p.isPacked).length === 2 && (
                  <button 
                    onClick={() => sendPlayerAction('SHOW')}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition"
                  >
                    Show Cards
                  </button>
                )}

                <button 
                  onClick={() => {
                    const req = myPlayerObj?.isBlind ? currentStake : currentStake * 2;
                    sendPlayerAction('CHAAL', { amount: req });
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 px-8 py-3 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 transition"
                >
                  Chaal (${myPlayerObj?.isBlind ? currentStake : currentStake * 2})
                </button>
              </div>
            ) : (
              <div className="text-slate-400 text-sm font-semibold flex items-center gap-2 animate-pulse">
                <RefreshCw size={16} className="animate-spin" /> Waiting for {players[currentTurnIdx]?.name}'s turn...
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}