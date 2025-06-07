import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/Terminal.module.css';

interface TerminalProps {
  type: 'heal' | 'disable_altar' | 'railgun';
  position: { x: number; y: number };
  onComplete: (type: string) => void;
  onClose: () => void;
  randomSeed: number;
}

const Terminal: React.FC<TerminalProps> = ({
  type,
  position,
  onComplete,
  onClose,
  randomSeed
}) => {
  const [gameType, setGameType] = useState<number>(0);
  const [completed, setCompleted] = useState(false);
  const [success, setSuccess] = useState(false);

  // 游戏状态变量
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [lightPosition, setLightPosition] = useState(0);
  const [lightMoving, setLightMoving] = useState(true);
  const [targetPosition, setTargetPosition] = useState(0);
  const [showingSequence, setShowingSequence] = useState(false);

  // 根据randomSeed选择游戏类型
  useEffect(() => {
    const game = randomSeed % 2;
    setGameType(game);
    initializeGame(game);
  }, [randomSeed]);

  // 初始化游戏
  const initializeGame = useCallback((game: number) => {
    switch (game) {
      case 0: // 点击亮起的按钮
        activateRandomButton();
        break;
      case 1: // 特定顺序点击
        generateSequence();
        break;
      case 2: // 记忆顺序
        generateMemorySequence();
        break;
      case 3: // 移动的灯
        startLightMovement();
        break;
      default:
        break;
    }
  }, []);

  // =============== 游戏0: 点击亮起的按钮 ===============
  const activateRandomButton = useCallback(() => {
    const buttons = [0, 1, 2, 3];
    const randomIndex = Math.floor(Math.random() * buttons.length);

    // 每1.5秒切换一次活动按钮
    const interval = setInterval(() => {
      setActiveButton(prev => {
        let res = Math.floor(Math.random() * buttons.length);
        while ((res = Math.floor(Math.random() * buttons.length)) === prev) {
          res = Math.floor(Math.random() * buttons.length);
        }
        return res;
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const handleButtonClick0 = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (index === activeButton) {
      completeGame();
    }
  };

  // =============== 游戏1: 特定顺序点击 ===============
  const generateSequence = useCallback(() => {
    const seq: number[] = [];
    const buttons = [0, 1, 2, 3];

    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * buttons.length);
      seq.push(buttons[randomIndex]);
    }

    setSequence(seq);
    setCurrentStep(0);
    setPlayerSequence([]);
    setShowingSequence(true);

    // 展示序列给玩家
    let step = 0;
    const showSequence = setInterval(() => {
      setActiveButton(seq[step]);

      if (step >= seq.length - 1) {
        clearInterval(showSequence);
        setTimeout(() => {
          setActiveButton(null);
          setShowingSequence(false);
        }, 500);
      }
      step++;
    }, 500);
  }, []);

  const handleButtonClick1 = (index: number, e: React.MouseEvent) => {
    e.preventDefault();

    if (showingSequence) return; // 正在展示序列时不允许点击

    if (index === sequence[currentStep]) {
      if (currentStep === sequence.length - 1) {
        completeGame();
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      // 错误时重置
      generateSequence();
    }
  };

  // =============== 游戏2: 记忆顺序 ===============
  const generateMemorySequence = useCallback(() => {
    const seq = [];
    const buttons = [0, 1, 2, 3];

    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * buttons.length);
      seq.push(buttons[randomIndex]);
    }

    setSequence(seq);
    setPlayerSequence([]);
    setShowingSequence(true);

    // 显示序列给玩家
    let step = 0;
    const showSequence = setInterval(() => {
      setActiveButton(sequence[step]);

      if (step >= sequence.length - 1) {
        clearInterval(showSequence);
        setTimeout(() => {
          setActiveButton(null);
          setShowingSequence(false);
        }, 500);
      }
      step++;
    }, 500);
  }, []);

  const handleButtonClick2 = (index: number, e: React.MouseEvent) => {
    e.preventDefault();

    if (showingSequence) return; // 正在显示序列

    const newSequence = [...playerSequence, index];
    setPlayerSequence(newSequence);

    // 检查是否正确
    for (let i = 0; i < newSequence.length; i++) {
      if (newSequence[i] !== sequence[i]) {
        // 错误时重置
        generateMemorySequence();
        return;
      }
    }

    // 完成序列
    if (newSequence.length === sequence.length) {
      completeGame();
    }
  };

  // =============== 游戏3: 移动的灯 ===============
  const startLightMovement = useCallback(() => {
    const positions = [0, 1, 2, 3];
    const target = Math.floor(Math.random() * positions.length);
    setTargetPosition(target);

    setLightMoving(true);
    let currentPos = 0;

    const moveInterval = setInterval(() => {
      setLightPosition(prev => {
        const nextPos = (prev + 1) % positions.length;
        currentPos = nextPos;
        return nextPos;
      });
    }, 500);

    return () => clearInterval(moveInterval);
  }, []);

  const handleButtonClick3 = (index: number, e: React.MouseEvent) => {
    e.preventDefault();

    if (index === targetPosition && lightPosition === targetPosition) {
      setLightMoving(false);
      completeGame();
    }
  };

  // =============== 通用方法 ===============
  const completeGame = () => {
    setSuccess(true);
    setTimeout(() => {
      setCompleted(true);
      onComplete(type);
      setTimeout(onClose, 500);
    }, 1000);
  };

  const handleButtonClick = (index: number, e: React.MouseEvent) => {
    switch (gameType) {
      case 0: handleButtonClick0(index, e); break;
      case 1: handleButtonClick1(index, e); break;
      case 2: handleButtonClick2(index, e); break;
      case 3: handleButtonClick3(index, e); break;
      default: break;
    }
  };

  // 渲染游戏说明
  const renderInstructions = () => {
    switch (gameType) {
      case 0: return "Click the button that lights up!";
      case 1: return showingSequence ? "Remember the sequence..." : "Repeat the sequence you just saw!";
      case 2: return showingSequence ? "Remember the sequence..." : "Repeat the sequence you just saw!";
      case 3: return "Click the button when the light reaches the target position!";
      default: return "";
    }
  };

  // 渲染目标位置（仅用于游戏3）
  const renderTargetIndicator = () => {
    if (gameType !== 3) return null;

    return (
      <div className={styles.targetIndicator}>
        Target Position: {targetPosition + 1}
      </div>
    );
  };

  // 渲染按钮
  const renderButtons = () => {
    return [0, 1, 2, 3].map(index => (
      <button
        key={index}
        className={`${styles.terminalButton} ${(gameType === 0 || gameType === 1 || gameType === 2) && activeButton === index
          ? styles.activeButton : ''
          }`}
        onClick={(e) => handleButtonClick(index, e)}
        disabled={showingSequence}
      >
        {index + 1}
        {gameType === 3 && lightPosition === index && (
          <div className={styles.lightIndicator} />
        )}
      </button>
    ));
  };

  // 渲染游戏内容
  const renderGameContent = () => {
    if (completed) {
      return (
        <div className={styles.completedMessage}>
          {success ? "Decode Succeeded!" : "Decode Failed"}
        </div>
      );
    }

    if (success) {
      return <div className={styles.successMessage}>Terminal Decoded</div>;
    }

    return (
      <>
        <div className={styles.instructions}>{renderInstructions()}</div>
        {renderTargetIndicator()}
        <div className={styles.buttonGrid}>{renderButtons()}</div>

        {gameType === 1 && !showingSequence && (
          <div className={styles.sequenceIndicator}>
            Current Step: {currentStep + 1}/{sequence.length}
          </div>
        )}
        {gameType === 2 && (
          <div className={styles.sequenceDisplay}>
            {showingSequence ? (
              <div className={styles.memoryTimer}>Memorize the sequence...</div>
            ) : (
              <div className={styles.playerSequence}>
                Your input: {playerSequence.map(n => n + 1).join(' → ')}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className={styles.terminalContainer}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.terminalHeader}>
        <span className={styles.title}>
          {type} Terminal
        </span>
        <button className={styles.closeButton} onClick={onClose}>
          &times;
        </button>
      </div>

      <div className={styles.terminalContent}>
        {renderGameContent()}
      </div>
    </div>
  );
};

export default Terminal;