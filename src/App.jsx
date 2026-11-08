import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Volume2, VolumeX, Shield, Play, RotateCcw, 
  Copy, Check, Sparkles, Award, Eye, EyeOff, Radio,
  Coins, UserCheck, ArrowRight, RefreshCw, Settings, HelpCircle
} from 'lucide-react';

// --- HAND EVALUATOR HELPERS ---
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];

const getRankVal = (r) => RANKS.indexOf(r);

// Evaluate 3-card hand: Returns { rankCategory, rankValues } for comparison
// Categories: 5=Trail, 4=Pure Sequence, 3=Sequence, 2=Color, 1=Pair, 0=High Card
const evaluateHand = (cards) => {
  if (!cards || cards.length < 3) return { score: 0, title: "Invalid" };

  const parsed = cards.map(c => ({
    val: getRankVal(c.rank),
    suit: c.suit,
    rank: c.rank
  })).sort((a, b) => b.val - a.val);

  const isFlush = parsed[0].suit === parsed[1].suit && parsed[1].suit === parsed[2].suit;
  
  // Check sequence (A-K-Q is highest, A-2-3 is lowest sequence)
  let isSeq = false;
  let seqHighVal = parsed[0].val;

  if (parsed[0].val - parsed[1].val === 1 && parsed[1].val - parsed[2].val === 1) {
    isSeq = true;
  } else if (parsed[0].rank === 'A' && parsed[1].rank === '3' && parsed[2].rank === '2') {
    // A-3-2 low straight
    isSeq = true;
    seqHighVal = 1; // 3 high
  }

  const v0 = parsed[0].val, v1 = parsed[1].val, v2 = parsed[2].val;

  // 1. Trail / Trio
  if (v0 === v1 && v1 === v2) {
    return { score: 50000 + v0, title: `Trail (${parsed[0].rank}s)` };
  }

  // 2. Pure Sequence (Straight Flush)
  if (isFlush && isSeq) {
    return { score: 40000 + seqHighVal, title: `Pure Sequence (${parsed[0].rank} High)` };
  }

  // 3. Sequence (Straight)
  if (isSeq) {
    return { score: 30000 + seqHighVal, title: `Sequence (${parsed[0].rank} High)` };
  }

  // 4. Color (Flush)
  if (isFlush) {
    return { score: 20000 + v0 * 100 + v1 * 10 + v2, title: `Flush (${parsed[0].rank} High)` };
  }

  // 5. Pair
  if (v0 === v1 || v1 === v2 || v0 === v2) {
    const pairVal = (v0 === v1) ? v0 : (v1 === v2 ? v1 : v0);
    const kickerVal = (v0 === v1) ? v2 : (v1 === v2 ? v0 : v1);
    return { score: 10000 + pairVal * 100 + kickerVal, title: `Pair of ${RANKS[pairVal]}s` };
  }

  // 6. High Card
  return { score: v0 * 100 + v1 * 10 + v2, title: `High Card (${parsed[0].rank})` };
};

export default function App() {
  // Game Configuration & Room State
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY, WAITING, PLAYING, ENDED
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [bootAmount, setBootAmount] = useState(100);
  const [copied, setCopied] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [activeVoiceUsers, setActiveVoiceUsers] = useState({});

  // Table Gameplay State
  const [players, setPlayers] = useState([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [pot, setPot] = useState(0);
  const [currentStake, setCurrentStake] = useState(100);
  const [winner, setWinner] = useState(null);
  const [roundTurnCount, setRoundTurnCount] = useState(0);
  const [sideShowRequest, setSideShowRequest] = useState(null);

  // Initialize Private Room Setup
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomCode(newCode);

    const initialPlayers = [
      { id: 'user', name: playerName, chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: true, isBot: false },
      { id: 'bot1', name: 'Aarav (Bot)', chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: false, isBot: true },
      { id: 'bot2', name: 'Riya (Bot)', chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: false, isBot: true },
      { id: 'bot3', name: 'Vikram (Bot)', chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: false, isBot: true }
    ];

    setPlayers(initialPlayers);
    setGameState('WAITING');
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCode.trim()) return;

    const initialPlayers = [
      { id: 'bot1', name: 'Host Arjun (Bot)', chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: true, isBot: true },
      { id: 'user', name: playerName, chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: false, isBot: false },
      { id: 'bot2', name: 'Ananya (Bot)', chips: 5000, isBlind: true, cards: [], isPacked: false, isHost: false, isBot: true }
    ];

    setPlayers(initialPlayers);
    setGameState('WAITING');
  };

  // Start New Hand Routine
  const startNewHand = () => {
    // Generate fresh deck
    const deck = [];
    SUITS.forEach(suit => {
      RANKS.forEach(rank => {
        deck.push({ suit, rank });
      });
    });

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal 3 cards to each non-bankrupt player
    let deckIdx = 0;
    let bootCollected = 0;

    const updatedPlayers = players.map(p => {
      if (p.chips < bootAmount) {
        return { ...p, isPacked: true, cards: [] };
      }
      const pCards = [deck[deckIdx++], deck[deckIdx++], deck[deckIdx++]];
      bootCollected += bootAmount;
      return {
        ...p,
        chips: p.chips - bootAmount,
        cards: pCards,
        isBlind: true,
        isPacked: false
      };
    });

    setPot(bootCollected);
    setCurrentStake(bootAmount);
    setPlayers(updatedPlayers);
    setCurrentTurnIdx(0);
    setGameState('PLAYING');
    setWinner(null);
    setRoundTurnCount(0);
    setSideShowRequest(null);
  };

  // Turn Progression & Bot AI logic loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const activePlayers = players.filter(p => !p.isPacked);
    
    // Check Round Termination Conditions
    if (activePlayers.length === 1) {
      handleDeclareWinner(activePlayers[0], "All other players folded!");
      return;
    }

    // Auto-Showdown trigger at 12 turn limit to prevent infinite game loops
    if (roundTurnCount >= 12 && activePlayers.length >= 2) {
      executeShowdown();
      return;
    }

    const currentP = players[currentTurnIdx];
    if (!currentP) return;

    // Skip if current turn player is packed
    if (currentP.isPacked) {
      nextTurn();
      return;
    }

    // Bot Automated Decision Engine
    if (currentP.isBot) {
      const botTimer = setTimeout(() => {
        const requiredAmount = currentP.isBlind ? currentStake : currentStake * 2;

        // Bot folds if insufficient chips or high turn count with weak hand
        if (currentP.chips < requiredAmount || (roundTurnCount > 8 && Math.random() > 0.6)) {
          handlePack(currentP.id);
        } else if (activePlayers.length === 2 && roundTurnCount >= 6 && Math.random() > 0.4) {
          executeShowdown();
        } else {
          // Bot calls Chaal
          handleChaal(currentP.id, requiredAmount);
        }
      }, 1200);

      return () => clearTimeout(botTimer);
    }
  }, [currentTurnIdx, gameState, players, roundTurnCount]);

  // Voice Chat Simulation Activity Loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const interval = setInterval(() => {
      const randomSpeaking = {};
      players.forEach(p => {
        if (Math.random() > 0.65) {
          randomSpeaking[p.id] = true;
        }
      });
      setActiveVoiceUsers(randomSpeaking);
    }, 1800);
    return () => clearInterval(interval);
  }, [gameState, players]);

  const nextTurn = () => {
    setCurrentTurnIdx(prev => (prev + 1) % players.length);
    setRoundTurnCount(prev => prev + 1);
  };

  const handlePack = (playerId) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, isPacked: true } : p));
    nextTurn();
  };

  const handleSeeCards = (playerId) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, isBlind: false } : p));
  };

  const handleChaal = (playerId, amount) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, chips: p.chips - amount } : p));
    setPot(prev => prev + amount);
    nextTurn();
  };

  const executeShowdown = () => {
    const active = players.filter(p => !p.isPacked);
    let bestPlayer = active[0];
    let bestHand = evaluateHand(active[0].cards);

    for (let i = 1; i < active.length; i++) {
      const currentHand = evaluateHand(active[i].cards);
      if (currentHand.score > bestHand.score) {
        bestHand = currentHand;
        bestPlayer = active[i];
      }
    }

    handleDeclareWinner(bestPlayer, `Won showdown with ${bestHand.title}!`);
  };

  const handleDeclareWinner = (winPlayer, reason) => {
    setWinner({ ...winPlayer, reason });
    setPlayers(prev => prev.map(p => p.id === winPlayer.id ? { ...p, chips: p.chips + pot } : p));
    setGameState('ENDED');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between select-none">
      {/* Top Header / Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-emerald-500/20">
            3P
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide bg-gradient-to-r from-amber-200 via-emerald-200 to-teal-200 bg-clip-text text-transparent">
              TEEN PATTI ARENA
            </h1>
            <p className="text-xs text-slate-400">Private Voice Gaming Room</p>
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
              onClick={() => setVoiceMuted(!voiceMuted)}
              className={`p-2.5 rounded-xl border transition flex items-center gap-2 text-xs font-semibold ${
                voiceMuted 
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {voiceMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <span>{voiceMuted ? 'Muted' : 'Voice Connected'}</span>
            </button>
          </div>
        )}
      </header>

      {/* Main View Area */}
      <main className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Ambient Lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* 1. LOBBY STATE */}
        {gameState === 'LOBBY' && (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl z-10">
            <h2 className="text-2xl font-bold text-center mb-6 text-slate-100">Join Private Room</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">YOUR DISPLAY NAME</label>
                <input 
                  type="text" 
                  value={playerName} 
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter alias (e.g. Royal Flush)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">BOOT AMOUNT ($)</label>
                <select 
                  value={bootAmount} 
                  onChange={(e) => setBootAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500 transition"
                >
                  <option value={50}>$50 Low Stakes</option>
                  <option value={100}>$100 Standard</option>
                  <option value={500}>$500 High Roller</option>
                </select>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button 
                  onClick={handleCreateRoom}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-amber-500/20"
                >
                  Create Room
                </button>
                <button 
                  onClick={(e) => {
                    const code = prompt("Enter 6-digit Room Code:");
                    if (code) {
                      setRoomCode(code);
                      handleJoinRoom(e);
                    }
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 rounded-xl border border-slate-700 transition"
                >
                  Join Room
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. WAITING LOBBY */}
        {gameState === 'WAITING' && (
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center shadow-2xl z-10">
            <h2 className="text-xl font-bold mb-2">Private Table Ready</h2>
            <p className="text-sm text-slate-400 mb-6">Share room code with your friends or play with bots</p>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500">ROOM CODE</p>
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
              <p className="text-xs font-semibold text-slate-400 text-left">PLAYERS IN ROOM ({players.length}/6)</p>
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

            <button 
              onClick={startNewHand}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-4 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <Play size={18} fill="currentColor" /> Deal First Hand
            </button>
          </div>
        )}

        {/* 3. TEEN PATTI POKER TABLE (PLAYING & ENDED) */}
        {(gameState === 'PLAYING' || gameState === 'ENDED') && (
          <div className="w-full max-w-5xl h-[560px] relative rounded-[100px] bg-emerald-950 border-[14px] border-amber-900/60 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] flex items-center justify-center">
            
            {/* Table Felt Inner Border Ring */}
            <div className="absolute inset-4 rounded-[85px] border border-emerald-500/20 pointer-events-none" />

            {/* Pot Display */}
            <div className="z-10 bg-slate-950/80 backdrop-blur-md border border-amber-500/30 px-6 py-3 rounded-2xl text-center shadow-xl">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">TOTAL POT</p>
              <div className="flex items-center gap-1.5 justify-center">
                <Coins size={18} className="text-amber-400" />
                <span className="text-2xl font-black text-amber-400 font-mono">${pot}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Current Stake: ${currentStake}</p>
            </div>

            {/* Dynamic Player Seats */}
            {players.map((p, idx) => {
              const total = players.length;
              const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
              const rx = 340; // horizontal radius
              const ry = 210; // vertical radius
              const x = Math.cos(angle) * rx;
              const y = Math.sin(angle) * ry;

              const isCurrentTurn = currentTurnIdx === idx && gameState === 'PLAYING';
              const isSpeaking = activeVoiceUsers[p.id] && !voiceMuted;

              return (
                <div 
                  key={p.id}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  className={`absolute flex flex-col items-center transition-all duration-300 ${
                    p.isPacked ? 'opacity-40 grayscale' : 'opacity-100'
                  }`}
                >
                  {/* Player Cards */}
                  <div className="flex gap-1 -mb-3 z-10">
                    {p.cards.map((c, cIdx) => {
                      const showCard = p.id === 'user' ? !p.isBlind : (gameState === 'ENDED');
                      return (
                        <div 
                          key={cIdx} 
                          className={`w-10 h-14 rounded-md border flex flex-col items-center justify-center font-bold text-xs shadow-md transition-all ${
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

                  {/* Avatar / Status Badge */}
                  <div className={`relative px-4 py-2 rounded-2xl bg-slate-900/90 border flex flex-col items-center shadow-xl ${
                    isCurrentTurn 
                      ? 'border-amber-400 ring-4 ring-amber-400/20' 
                      : 'border-slate-800'
                  }`}>
                    {/* Voice Active Waves Indicator */}
                    {isSpeaking && (
                      <span className="absolute -top-2 right-2 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    )}

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

        {/* 4. WINNER OVERLAY DIALOG */}
        {gameState === 'ENDED' && winner && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/40 p-8 rounded-3xl text-center max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-300">
              <Award size={48} className="mx-auto text-amber-400 mb-3 animate-bounce" />
              <h3 className="text-2xl font-black text-slate-100">{winner.name} WINS!</h3>
              <p className="text-sm text-slate-400 mt-1 mb-4">{winner.reason}</p>
              
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6">
                <span className="text-xs text-slate-500 block">TOTAL COLLECTED</span>
                <span className="text-3xl font-mono font-black text-amber-400">${pot}</span>
              </div>

              <button 
                onClick={startNewHand}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} /> Play Next Hand
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Action Control Bar */}
      {gameState === 'PLAYING' && (
        <footer className="border-t border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {/* User Blind/Seen Toggle */}
            <div className="flex items-center gap-3">
              {players.find(p => p.id === 'user')?.isBlind ? (
                <button 
                  onClick={() => handleSeeCards('user')}
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

            {/* Main Turn Betting Controls */}
            {players[currentTurnIdx]?.id === 'user' ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handlePack('user')}
                  className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 px-6 py-3 rounded-xl font-bold text-sm transition"
                >
                  Pack (Fold)
                </button>

                {players.filter(p => !p.isPacked).length === 2 && (
                  <button 
                    onClick={executeShowdown}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition"
                  >
                    Show Cards
                  </button>
                )}

                <button 
                  onClick={() => {
                    const userP = players.find(p => p.id === 'user');
                    const required = userP.isBlind ? currentStake : currentStake * 2;
                    handleChaal('user', required);
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 px-8 py-3 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
                >
                  Chaal (${players.find(p => p.id === 'user')?.isBlind ? currentStake : currentStake * 2})
                </button>
              </div>
            ) : (
              <div className="text-slate-400 text-sm font-semibold flex items-center gap-2 animate-pulse">
                <RefreshCw size={16} className="animate-spin" /> Waiting for {players[currentTurnIdx]?.name}'s move...
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
