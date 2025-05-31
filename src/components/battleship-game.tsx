"use client";

import { useState, useEffect, useRef } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import { RefreshCw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import GameBoard from "@/components/game-board";
import ShipDock from "@/components/ship-dock";
import ScoreBoard from "@/components/score-board";
import type { Ship, Cell, GameState, Difficulty } from "@/lib/types";
import {
  generateEmptyBoard,
  placeShipsRandomly,
  isValidPlacement,
} from "@/lib/game-utils";
import { useSearchParams } from "next/navigation";

// Detect touch devices
const isTouchDevice = () => {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
};

export default function BattleshipGame() {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [playerBoard, setPlayerBoard] = useState<Cell[][]>(
    generateEmptyBoard()
  );
  const [computerBoard, setComputerBoard] = useState<Cell[][]>(
    generateEmptyBoard()
  );
  const [revealedComputerBoard, setRevealedComputerBoard] = useState<Cell[][]>(
    generateEmptyBoard()
  );
  const [ships, setShips] = useState<Ship[]>([
    {
      id: 1,
      name: "Carrier",
      size: 5,
      placed: false,
      orientation: "horizontal",
      hits: 0,
      sunk: false,
    },
    {
      id: 2,
      name: "Battleship",
      size: 4,
      placed: false,
      orientation: "horizontal",
      hits: 0,
      sunk: false,
    },
    {
      id: 3,
      name: "Cruiser",
      size: 3,
      placed: false,
      orientation: "horizontal",
      hits: 0,
      sunk: false,
    },
    {
      id: 4,
      name: "Submarine",
      size: 3,
      placed: false,
      orientation: "horizontal",
      hits: 0,
      sunk: false,
    },
    {
      id: 5,
      name: "Destroyer",
      size: 2,
      placed: false,
      orientation: "horizontal",
      hits: 0,
      sunk: false,
    },
  ]);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [score, setScore] = useState(0);
  const [markEmptyCells, setMarkEmptyCells] = useState(true);
  const [compactChat, setCompactChat] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [message, setMessage] = useState("Place your ships on the grid.");
  const [gameResult, setGameResult] = useState<"win" | "lose" | null>(null);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [highScores, setHighScores] = useState<
    { difficulty: Difficulty; score: number }[]
  >([]);
  const [showPopup, setShowPopup] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [movesUsed, setMovesUsed] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const params = searchParams.get("wallet");

  const hitSound = useRef<HTMLAudioElement | null>(null);
  const missSound = useRef<HTMLAudioElement | null>(null);
  const sinkSound = useRef<HTMLAudioElement | null>(null);
  const winSound = useRef<HTMLAudioElement | null>(null);
  const loseSound = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements and game
  useEffect(() => {
    if (typeof window !== "undefined") {
      hitSound.current = new Audio("/sounds/hit.mp3");
      missSound.current = new Audio("/sounds/miss.mp3");
      sinkSound.current = new Audio("/sounds/sink.mp3");
      winSound.current = new Audio("/sounds/win.mp3");
      loseSound.current = new Audio("/sounds/lose.mp3");
    }

    // Load high scores from localStorage
    const savedScores = localStorage.getItem("battleshipHighScores");
    if (savedScores) {
      setHighScores(JSON.parse(savedScores));
    }
  }, []);

  useEffect(() => {
    if (params) {
      setUserId(params);
      console.log(params);
      initializeGame(params);
    }
  }, [params]);

  const initializeGame = async (walletAddress: string) => {
    try {
      const response = await fetch(
        "http://127.0.0.1:3001/api/v1/games/battleship",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ walletAddress }),
        }
      );

      if (!response.ok) {
        console.error("Failed to initialize game");
      }
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error("Error initializing game:", error);
    }
  };

  const recordGameResult = async (won: boolean) => {
    if (!userId) return;
    const walletAddress = userId;

    try {
      const response = await fetch(
        `http://127.0.0.1:3001/api/v1/games/battleship/${walletAddress}/result`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            difficulty,
            won,
            movesUsed,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.pointsEarned;
      } else {
        console.error("Failed to record game result");
      }
    } catch (error) {
      console.error("Error recording game result:", error);
    }

    // Return default points if API call fails
    return won
      ? difficulty === "easy"
        ? 100
        : difficulty === "medium"
        ? 150
        : 200
      : 0;
  };

  // Function to redirect to home with game results
  const redirectToHome = (pointsEarned: number, won: boolean) => {
    const params = new URLSearchParams({
      gameWon: won.toString(),
      gameName: "battleship",
      pointsEarned: pointsEarned.toString(),
    });

    window.location.href = `http://localhost:3000/?${params.toString()}`;
  };

  const playSound = (sound: HTMLAudioElement | null) => {
    if (sound && soundOn) {
      sound.currentTime = 0;
      sound.play().catch((e) => console.error("Error playing sound:", e));
    }
  };

  const randomizeShips = () => {
    const newBoard = generateEmptyBoard();
    const newShips = [...ships].map((ship) => ({
      ...ship,
      placed: false,
      hits: 0,
      sunk: false,
    }));
    const { board, updatedShips } = placeShipsRandomly(newBoard, newShips);
    setPlayerBoard(board);
    setShips(updatedShips);
  };

  const resetGame = () => {
    setGameState("setup");
    setPlayerBoard(generateEmptyBoard());
    setComputerBoard(generateEmptyBoard());
    setRevealedComputerBoard(generateEmptyBoard());
    setShips(
      ships.map((ship) => ({
        ...ship,
        placed: false,
        orientation: "horizontal",
        hits: 0,
        sunk: false,
      }))
    );
    setMessage("Place your ships on the grid.");
    setGameResult(null);
    setPlayerTurn(true);
    setMovesUsed(0);
    setShowPopup(false);
  };

  const startGame = () => {
    // Check if all ships are placed
    if (!ships.every((ship) => ship.placed)) {
      setMessage("You must place all ships before starting the game!");
      return;
    }

    // Setup computer board
    const computerEmptyBoard = generateEmptyBoard();
    const computerShips = ships.map((ship) => ({
      ...ship,
      placed: false,
      hits: 0,
      sunk: false,
    }));
    const { board: newComputerBoard } = placeShipsRandomly(
      computerEmptyBoard,
      computerShips
    );

    setComputerBoard(newComputerBoard);
    setRevealedComputerBoard(generateEmptyBoard());
    setGameState("playing");
    setMessage("Game started! Click on the opponent's grid to fire.");
    setMovesUsed(0);
  };

  const handleCellClick = (row: number, col: number) => {
    if (
      gameState !== "playing" ||
      !playerTurn ||
      revealedComputerBoard[row][col].state !== "empty"
    ) {
      return;
    }

    // Increment moves counter
    setMovesUsed((prev) => prev + 1);

    // Player's turn
    const newRevealedBoard = [...revealedComputerBoard];
    const computerCell = computerBoard[row][col];

    if (computerCell.shipId) {
      // Hit
      newRevealedBoard[row][col] = { ...computerCell, state: "hit" };
      playSound(hitSound.current);

      // Update ship hits
      const newShips = [...ships];
      const hitShipIndex = newShips.findIndex(
        (ship) => ship.id === computerCell.shipId
      );

      if (hitShipIndex !== -1) {
        newShips[hitShipIndex].hits += 1;

        // Check if ship is sunk
        if (newShips[hitShipIndex].hits === newShips[hitShipIndex].size) {
          newShips[hitShipIndex].sunk = true;
          playSound(sinkSound.current);
          setMessage(`You sunk the enemy's ${newShips[hitShipIndex].name}!`);

          // Add points based on ship size and difficulty
          const difficultyMultiplier =
            difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
          setScore(
            (prev) =>
              prev + newShips[hitShipIndex].size * 10 * difficultyMultiplier
          );
        } else {
          setMessage("Hit!");
        }
      }

      setShips(newShips);
      setRevealedComputerBoard(newRevealedBoard);

      // Check if all computer ships are sunk
      if (newShips.filter((ship) => ship.id <= 5).every((ship) => ship.sunk)) {
        endGame("win");
        return;
      }
    } else {
      // Miss
      newRevealedBoard[row][col] = { ...computerCell, state: "miss" };
      playSound(missSound.current);
      setMessage("Miss! Computer's turn.");
      setRevealedComputerBoard(newRevealedBoard);
    }

    // Computer's turn
    setPlayerTurn(false);
    setTimeout(() => computerTurn(), 1000);
  };

  const computerTurn = () => {
    if (gameState !== "playing") return;

    let row: number = -1,
      col: number = -1;
    let validMove = false;
    const newPlayerBoard = [...playerBoard];

    // Different AI strategies based on difficulty
    if (difficulty === "easy") {
      // Random shots
      while (!validMove) {
        row = Math.floor(Math.random() * 10);
        col = Math.floor(Math.random() * 10);
        if (newPlayerBoard[row][col].state === "empty") {
          validMove = true;
        }
      }
    } else {
      // Medium and Hard: Smarter targeting
      // First, look for hits to target adjacent cells
      const hits = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (
            newPlayerBoard[r][c].state === "hit" &&
            !newPlayerBoard[r][c].sunk
          ) {
            hits.push({ r, c });
          }
        }
      }

      if (hits.length > 0 && (difficulty === "hard" || Math.random() > 0.3)) {
        // Target around a hit
        const targetHit = hits[Math.floor(Math.random() * hits.length)];
        const directions = [
          { r: -1, c: 0 }, // up
          { r: 1, c: 0 }, // down
          { r: 0, c: -1 }, // left
          { r: 0, c: 1 }, // right
        ];

        // Shuffle directions for more unpredictable behavior
        directions.sort(() => Math.random() - 0.5);

        let foundTarget = false;
        for (const dir of directions) {
          const newR = targetHit.r + dir.r;
          const newC = targetHit.c + dir.c;

          if (
            newR >= 0 &&
            newR < 10 &&
            newC >= 0 &&
            newC < 10 &&
            newPlayerBoard[newR][newC].state === "empty"
          ) {
            row = newR;
            col = newC;
            foundTarget = true;
            break;
          }
        }

        if (!foundTarget) {
          // If no valid adjacent cells, choose randomly
          while (!validMove) {
            row = Math.floor(Math.random() * 10);
            col = Math.floor(Math.random() * 10);
            if (newPlayerBoard[row][col].state === "empty") {
              validMove = true;
            }
          }
        } else {
          validMove = true;
        }
      } else {
        // Random shot with some intelligence for hard difficulty
        if (difficulty === "hard" && Math.random() > 0.5) {
          // Target cells in a checkerboard pattern for efficiency
          const potentialTargets = [];
          for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
              if (newPlayerBoard[r][c].state === "empty" && (r + c) % 2 === 0) {
                potentialTargets.push({ r, c });
              }
            }
          }

          if (potentialTargets.length > 0) {
            const target =
              potentialTargets[
                Math.floor(Math.random() * potentialTargets.length)
              ];
            row = target.r;
            col = target.c;
            validMove = true;
          }
        }

        // If no valid move found yet, choose randomly
        if (!validMove) {
          while (!validMove) {
            row = Math.floor(Math.random() * 10);
            col = Math.floor(Math.random() * 10);
            if (newPlayerBoard[row][col].state === "empty") {
              validMove = true;
            }
          }
        }
      }
    }

    // Execute the computer's move
    if (newPlayerBoard[row][col].shipId) {
      // Hit
      newPlayerBoard[row][col].state = "hit";
      playSound(hitSound.current);

      // Update ship hits
      const newShips = [...ships];
      const hitShipIndex = newShips.findIndex(
        (ship) => ship.id === newPlayerBoard[row][col].shipId
      );

      if (hitShipIndex !== -1) {
        newShips[hitShipIndex].hits += 1;

        // Check if ship is sunk
        if (newShips[hitShipIndex].hits === newShips[hitShipIndex].size) {
          newShips[hitShipIndex].sunk = true;

          // Mark all cells of this ship as sunk
          for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
              if (newPlayerBoard[r][c].shipId === newShips[hitShipIndex].id) {
                newPlayerBoard[r][c].sunk = true;
              }
            }
          }

          playSound(sinkSound.current);
          setMessage(`The enemy sunk your ${newShips[hitShipIndex].name}!`);
        } else {
          setMessage("Your ship was hit! Your turn.");
        }
      }

      setShips(newShips);

      // Check if all player ships are sunk
      if (newShips.filter((ship) => ship.id <= 5).every((ship) => ship.sunk)) {
        setPlayerBoard(newPlayerBoard);
        endGame("lose");
        return;
      }
    } else {
      // Miss
      newPlayerBoard[row][col].state = "miss";
      playSound(missSound.current);
      setMessage("The enemy missed! Your turn.");
    }

    setPlayerBoard(newPlayerBoard);
    setPlayerTurn(true);
  };

  const endGame = async (result: "win" | "lose") => {
    setGameState("gameover");
    setGameResult(result);

    if (result === "win") {
      playSound(winSound.current);
      setMessage("Congratulations! You won the game!");

      // Record game result and get earned points
      const earningPoints = await recordGameResult(true);
      setPointsEarned(
        earningPoints || difficulty === "easy"
          ? 100
          : difficulty === "medium"
          ? 150
          : 200
      );

      // Save high score
      const newHighScore = { difficulty, score };
      const newHighScores = [...highScores, newHighScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      setHighScores(newHighScores);
      localStorage.setItem(
        "battleshipHighScores",
        JSON.stringify(newHighScores)
      );

      // Show popup
      setShowPopup(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        redirectToHome(
          earningPoints || difficulty === "easy"
            ? 100
            : difficulty === "medium"
            ? 150
            : 200,
          true
        );
      }, 2000);
    } else {
      playSound(loseSound.current);
      setMessage("Game over! The enemy sunk all your ships.");

      // Record loss
      await recordGameResult(false);
      setPointsEarned(0);

      // Show popup
      setShowPopup(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        redirectToHome(0, false);
      }, 2000);
    }
  };

  const placeShip = (
    shipId: number,
    row: number,
    col: number,
    orientation: "horizontal" | "vertical"
  ) => {
    if (gameState !== "setup") return false;

    const shipIndex = ships.findIndex((ship) => ship.id === shipId);
    if (shipIndex === -1) return false;

    const ship = ships[shipIndex];
    const newBoard = [...playerBoard];

    // Check if placement is valid
    if (!isValidPlacement(newBoard, row, col, ship.size, orientation)) {
      return false;
    }

    // Place the ship
    for (let i = 0; i < ship.size; i++) {
      const r = orientation === "horizontal" ? row : row + i;
      const c = orientation === "horizontal" ? col + i : col;

      newBoard[r][c] = {
        state: "empty",
        shipId: ship.id,
      };
    }

    // Update ship as placed
    const newShips = [...ships];
    newShips[shipIndex] = {
      ...ship,
      placed: true,
      orientation,
    };

    setPlayerBoard(newBoard);
    setShips(newShips);
    return true;
  };

  const rotateShip = (shipId: number) => {
    const shipIndex = ships.findIndex((ship) => ship.id === shipId);
    if (shipIndex === -1 || ships[shipIndex].placed) return;

    const newShips = [...ships];
    newShips[shipIndex] = {
      ...newShips[shipIndex],
      orientation:
        newShips[shipIndex].orientation === "horizontal"
          ? "vertical"
          : "horizontal",
    };

    setShips(newShips);
  };

  const removeShip = (shipId: number) => {
    if (gameState !== "setup") return;

    const shipIndex = ships.findIndex((ship) => ship.id === shipId);
    if (shipIndex === -1 || !ships[shipIndex].placed) return;

    // Remove ship from board
    const newBoard = [...playerBoard];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (newBoard[r][c].shipId === shipId) {
          newBoard[r][c] = { state: "empty" };
        }
      }
    }

    // Update ship as not placed
    const newShips = [...ships];
    newShips[shipIndex] = {
      ...ships[shipIndex],
      placed: false,
    };

    setPlayerBoard(newBoard);
    setShips(newShips);
  };

  return (
    <DndProvider backend={isTouchDevice() ? TouchBackend : HTML5Backend}>
      <div className="w-full max-w-6xl mx-auto font-mono">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold mb-1">Battleship</h1>
          <p className="text-sm text-gray-600">45 players online</p>
        </div>

        <div className="text-center mb-4">
          <p className="text-lg font-semibold">{message}</p>
        </div>

        {showPopup && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
            <Alert className="max-w-md w-full bg-white p-6 rounded-lg shadow-lg text-center">
              <AlertTitle
                className={`text-2xl font-bold ${
                  gameResult === "win" ? "text-green-600" : "text-red-600"
                }`}
              >
                {gameResult === "win" ? "Victory!" : "Defeat!"}
              </AlertTitle>
              <AlertDescription className="mt-4">
                {gameResult === "win" ? (
                  <div className="text-xl">
                    You earned <span className="font-bold">{pointsEarned}</span>{" "}
                    points!
                  </div>
                ) : (
                  <div className="text-xl">Better luck next time!</div>
                )}
                <div className="mt-2 text-sm text-gray-500">
                  Redirecting in 2 seconds...
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Player's board */}
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2">Your grid</h2>
            <GameBoard
              board={playerBoard}
              onCellClick={() => {}}
              isPlayerBoard={true}
              gameState={gameState}
              placeShip={placeShip}
              markEmptyCells={markEmptyCells}
            />

            {gameState === "setup" && (
              <div className="mt-4 flex flex-col items-center">
                <ShipDock
                  ships={ships}
                  rotateShip={rotateShip}
                  removeShip={removeShip}
                />
                <div className="flex gap-4 mt-4">
                  <Button
                    onClick={randomizeShips}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Randomize
                  </Button>
                  <Button
                    onClick={resetGame}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RotateCw size={16} />
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Computer's board */}
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center mb-2">
              <h2 className="text-xl font-bold">Opponent</h2>
              {gameState === "setup" && (
                <div className="flex items-center gap-2 mt-1">
                  <RadioGroup
                    value={difficulty}
                    onValueChange={(value) =>
                      setDifficulty(value as Difficulty)
                    }
                    className="flex"
                  >
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="easy" id="easy" />
                      <Label htmlFor="easy" className="text-sm">
                        easy
                      </Label>
                    </div>
                    <div className="flex items-center space-x-1 mx-2">
                      <RadioGroupItem value="medium" id="medium" />
                      <Label htmlFor="medium" className="text-sm">
                        medium
                      </Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="hard" id="hard" />
                      <Label htmlFor="hard" className="text-sm">
                        hard
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            <GameBoard
              board={revealedComputerBoard}
              onCellClick={handleCellClick}
              isPlayerBoard={false}
              gameState={gameState}
              placeShip={() => false}
              markEmptyCells={markEmptyCells}
            />

            {gameState === "setup" && (
              <Button
                onClick={startGame}
                className="mt-4 px-8"
                disabled={!ships.every((ship) => ship.placed)}
              >
                Play
              </Button>
            )}

            {gameState === "gameover" && !showPopup && (
              <div className="mt-4 flex flex-col items-center">
                <div
                  className={`text-2xl font-bold mb-2 ${
                    gameResult === "win" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {gameResult === "win" ? "Victory!" : "Defeat!"}
                </div>
                <div className="text-lg">Final Score: {score}</div>
                <Button onClick={resetGame} className="mt-4">
                  Play Again
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Settings and Score */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold mb-2">Settings:</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="markEmpty"
                  checked={markEmptyCells}
                  onCheckedChange={(checked) => setMarkEmptyCells(!!checked)}
                />
                <label htmlFor="markEmpty" className="text-sm font-medium">
                  Mark verified empty cells
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="compactChat"
                  checked={compactChat}
                  onCheckedChange={(checked) => setCompactChat(!!checked)}
                />
                <label htmlFor="compactChat" className="text-sm font-medium">
                  Compact chat
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="soundOn"
                  checked={soundOn}
                  onCheckedChange={(checked) => setSoundOn(!!checked)}
                />
                <label htmlFor="soundOn" className="text-sm font-medium">
                  Sound on
                </label>
                {soundOn ? (
                  <Volume2 size={16} className="text-gray-600" />
                ) : (
                  <VolumeX size={16} className="text-gray-600" />
                )}
              </div>
            </div>
          </div>

          <ScoreBoard score={score} highScores={highScores} />
        </div>

        <footer className="mt-8 text-center text-sm text-gray-500">
          © 2023-2024 Battleship Game
        </footer>
      </div>
    </DndProvider>
  );
}
