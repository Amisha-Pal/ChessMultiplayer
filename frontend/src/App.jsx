import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function App() {
  const [roomCode, setRoomCode] = useState("");
  const [inputRoom, setInputRoom] = useState("");
  const [joined, setJoined] = useState(false);

  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState(null);
  const [players, setPlayers] = useState(0);
  const [opponentStatus, setOpponentStatus] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState("");
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const socketRef = useRef(null);
  const gameRef = useRef(new Chess());
  const playerColorRef = useRef(null);

  const createRoom = () => {
    const code = generateRoomCode();

    setRoomCode(code);
    setJoined(true);
  };

  const joinRoom = () => {
    const code = inputRoom.trim().toUpperCase();

    if (!code) {
      alert("Please enter Room Code");
      return;
    }

    setRoomCode(code);
    setJoined(true);
  };

  useEffect(() => {
    if (!joined || !roomCode) {
      return;
    }

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/chess/${roomCode}/`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket Connected ♟️");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "room_full") {
        alert("⚠️ This room is full! Only 2 players are allowed.");
        socket.close();
        setJoined(false);
        return;
      }

      if (data.type === "opponent_disconnected") {
        setOpponentDisconnected(true);
        setGameOver(true);
        setGameResult("Your opponent disconnected! Game stopped.");
        return;
      }

      console.log("Server:", data);

      if (data.type === "player") {
        setPlayerColor(data.color);
        playerColorRef.current = data.color;

        console.log("You are:", data.color);

        return;
      }

      if (data.type === "room_status") {
        setPlayers(data.players);

        if (data.players === 1) {
          setOpponentStatus("⏳ Waiting for opponent...");
        } else if (data.players === 2) {
          setOpponentStatus("🟢 Opponent connected!");
        }

        console.log("Players in room:", data.players);

        return;
      }

      if (data.type === "resign") {
        const resignedPlayer = data.player;
        const winner = data.winner;

        setGameOver(true);

        setGameResult(
          `${resignedPlayer.toUpperCase()} resigned! ${winner.toUpperCase()} wins! 🏆`
        );

        return;
      }

      if (data.type === "new_game") {
        const freshGame = new Chess();

        gameRef.current = freshGame;
        setGame(freshGame);

        setGameOver(false);
        setGameResult("");

        return;
      }

      if (data.type === "move") {
        console.log("Opponent move:", data.move);

        const currentGame = gameRef.current;

        try {
          currentGame.move({
            from: data.move.from,
            to: data.move.to,
            promotion: data.move.promotion || "q",
          });

          const updatedGame = new Chess(currentGame.fen());

          gameRef.current = updatedGame;
          setGame(updatedGame);
        } catch (error) {
          console.log("Remote move error:", error.message);
        }
      }

      if (data.type === "opponent_disconnected") {
        setOpponentDisconnected(true);
        setGameOver(true);
        setGameResult("Your opponent disconnected! Game stopped.");
        return;
      }
    };

    socket.onerror = (error) => {
      console.log("WebSocket Error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket Disconnected");
    };

    return () => {
      socket.close();
    };
  }, [joined, roomCode]);

  const handleMove = ({ sourceSquare, targetSquare }) => {

    if (opponentDisconnected || gameOver) {
      return false;
    }

    if (gameOver) {
      console.log("Game is over!");
      return false;
    }

    const currentGame = gameRef.current;

    if (
      currentGame.isCheckmate() ||
      currentGame.isDraw() ||
      currentGame.isStalemate() ||
      currentGame.isThreefoldRepetition() ||
      currentGame.isInsufficientMaterial()
    ) {
      console.log("Game Over!");
      return false;
    }

    if (!playerColorRef.current) {
      console.log("Player color not received yet");
      return false;
    }

    const currentTurn =
      currentGame.turn() === "w" ? "white" : "black";

    if (currentTurn !== playerColorRef.current) {
      console.log("Not your turn!");
      return false;
    }

    try {
      const move = currentGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) {
        return false;
      }

      const updatedGame = new Chess(currentGame.fen());

      gameRef.current = updatedGame;
      setGame(updatedGame);

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "move",
            move: {
              from: sourceSquare,
              to: targetSquare,
              promotion: "q",
            },
          })
        );
      }

      return true;
    } catch (error) {
      console.log("Invalid move:", error.message);
      return false;
    }
  };

  const resignGame = () => {
    if (!socketRef.current) {
      return;
    }

    if (socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "resign",
        })
      );
    }
  };

  const newGame = () => {
    if (!gameOver) {
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "new_game",
        })
      );
    }
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setJoined(false);
    setRoomCode("");
    setPlayerColor(null);
    playerColorRef.current = null;

    const newGame = new Chess();
    gameRef.current = newGame;
    setGame(newGame);

    setPlayers(0);
    setOpponentStatus("");
  };

  // Room screen
  if (!joined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f5f5",
        }}
      >
        <div
          style={{
            width: "350px",
            padding: "30px",
            background: "white",
            borderRadius: "15px",
            textAlign: "center",
            boxShadow: "0 5px 20px rgba(0,0,0,0.15)",
          }}
        >
          <h1
            style={{
              margin: "0 0 25px 0",
              fontSize: "32px",
              lineHeight: "1.3",
              fontWeight: "700",
            }}
          >
            ♟️ Multiplayer Chess
          </h1>

          <button
            onClick={createRoom}
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "20px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Create Room
          </button>

          <h3>OR</h3>

          <input
            type="text"
            placeholder="Enter Room Code"
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              fontSize: "16px",
            }}
          />

          <button
            onClick={joinRoom}
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "10px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  // Chess screen
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "30px",
        textAlign: "center",
      }}
    >
      <h1>♟️ Multiplayer Chess</h1>

      <h2>
        Room: <strong>{roomCode}</strong>
      </h2>

      <h2>
        You are:{" "}
        {playerColor === "white"
          ? "White ♔"
          : playerColor === "black"
            ? "Black ♚"
            : "Connecting..."}
      </h2>

      <h3>{opponentStatus}</h3>

      <p>
        Players: {players}/2
      </p>

      <div
        style={{
          width: "500px",
          maxWidth: "95vw",
          margin: "30px auto",
        }}
      >

        <Chessboard
          options={{
            position: game.fen(),
            onPieceDrop: handleMove,
            boardOrientation:
              playerColor === "black" ? "black" : "white",
          }}
        />

        {opponentDisconnected && (
          <div
            style={{
              marginTop: "15px",
              padding: "15px",
              background: "#ffebee",
              color: "#1c86b7",
              borderRadius: "8px",
              fontWeight: "bold",
            }}
          >
            ⚠️ Opponent disconnected! Game has stopped.
          </div>
        )}

        <button
          onClick={resignGame}
          style={{
            padding: "12px 25px",
            margin: "15px 10px",
            fontSize: "16px",
            cursor: "pointer",
            borderRadius: "8px",
            border: "none",
            background: "#d32f2f",
            color: "white",
          }}
        >
          🏳️ Resign
        </button>

        <button
          onClick={newGame}
          disabled={!gameOver}
          style={{
            padding: "12px 25px",
            margin: "15px 10px",
            fontSize: "16px",
            cursor: gameOver ? "pointer" : "not-allowed",
            borderRadius: "8px",
            border: "none",
            background: gameOver ? "#2e7d32" : "#aaa",
            color: "white",
          }}
        >
          🔄 New Game
        </button>

        <button
          onClick={leaveRoom}
          style={{
            padding: "12px 25px",
            margin: "15px 10px",
            fontSize: "16px",
            cursor: "pointer",
            borderRadius: "8px",
            border: "none",
          }}
        >
          🚪 Leave Room
        </button>

        <h2>
          {game.isCheckmate()
            ? `🏆 Checkmate! ${game.turn() === "w" ? "Black" : "White"
            } wins`
            : game.isDraw()
              ? "🤝 Game Draw!"
              : game.isCheck()
                ? `⚠️ Check! ${game.turn() === "w" ? "White" : "Black"
                } is in check`
                : ""}
        </h2>

        {gameOver && (
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              background: "#fff3cd",
              borderRadius: "10px",
              fontSize: "20px",
              fontWeight: "bold",
            }}
          >
            {gameResult}
          </div>
        )}
      </div>

      <h3>
        {game.isGameOver() ? (
          "🏁 Game Over"
        ) : (
          <>
            Turn:{" "}
            {game.turn() === "w"
              ? "White ♔"
              : "Black ♚"}
          </>
        )}
      </h3>
    </div>
  );
}

export default App;