import React, { useState, useEffect, useRef } from 'react';
import { Grid, AStarFinder, DiagonalMovement } from 'pathfinding';
import styles from '../styles/Simulator.module.css';
import Terminal from './Terminal';

interface Position {
    x: number;
    y: number;
}

interface Entity {
    id: number;
    position: Position;
    type: 'player' | 'monster' | 'obstacle' | 'goal' | 'altar' | 'terminal';
    health?: number;
    maxHealth?: number;
    speed?: number;
    path?: Position[];
    chargeProgress?: number;
    targetId?: number;
    lastPosition?: Position;
    stuckCounter?: number;
    terminalType?: 'heal' | 'disable_altar' | 'railgun';
}

interface TerminalState {
    active: boolean;
    position: Position;
    type: 'heal' | 'disable_altar' | 'railgun';
    entityId?: number;
    id: number;
    health?: number;
    maxHealth?: number;
    speed?: number;
    path?: Position[];
    chargeProgress?: number;
    targetId?: number;
    lastPosition?: Position;
    stuckCounter?: number;
}

interface Laser {
    from: Position;
    to: Position;
    progress: number;
    duration: number;
    type?: 'normal' | 'railgun';
}

const PathfindingSimulator: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [grid, setGrid] = useState<Grid | null>(null);
    const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(2);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [playerPath, setPlayerPath] = useState<Position[]>([]);
    const [lasers, setLasers] = useState<Laser[]>([]);
    const [spawnTimer, setSpawnTimer] = useState(0);
    const [termainalGenerateTimer, setTerminalGenerateTimer] = useState(5900);
    const [playerHealth, setPlayerHealth] = useState({ health: 100, maxHealth: 100 });
    const [survivalTime, setSurvivalTime] = useState(0);
    const [score, setScore] = useState(0);
    const gameAreaRef = useRef<HTMLDivElement>(null);

    // Initialize the game
    useEffect(() => {
        initGame();
        // Explicitly mark resize handler as non-passive
        window.addEventListener('resize', handleResize, { passive: false });
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Game loop
    useEffect(() => {
        let animationFrameId: number;
        let lastTime = 0;
        const frameInterval = 1000 / 30; // 30 FPS

        const gameLoop = (timestamp: number) => {
            // Update survival time and score
            if (!isDead) {
                setSurvivalTime(prev => prev + frameInterval / 1000);
                setScore(prev => prev + 0.005);
            }

            if (timestamp - lastTime > frameInterval) {
                updateGame();
                drawGame();
                lastTime = timestamp;
            }
            animationFrameId = requestAnimationFrame(gameLoop);
        };

        animationFrameId = requestAnimationFrame(gameLoop);

        return () => cancelAnimationFrame(animationFrameId);
    }, [entities, grid, viewOffset, scale]);

    const initGame = () => {
        // Create a 512x512 grid (larger than visible area)
        const newGrid = new Grid(512, 512);


        // Enhanced maze generation with varied path widths
        const generateMaze = (grid: Grid) => {
            // Initialize all cells as walls
            for (let x = 0; x < 512; x++) {
                for (let y = 0; y < 512; y++) {
                    grid.setWalkableAt(x, y, false);
                }
            }

            // Create some large open areas (rooms)
            const createRoom = (x: number, y: number, width: number, height: number) => {
                for (let dx = 0; dx < width; dx++) {
                    for (let dy = 0; dy < height; dy++) {
                        if (x + dx < 512 && y + dy < 512) {
                            grid.setWalkableAt(x + dx, y + dy, true);
                        }
                    }
                }
            };

            // Create 3-5 random rooms (10x10 to 15x15)
            for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                const roomSize = 10 + Math.floor(Math.random() * 6);
                createRoom(
                    Math.floor(Math.random() * (512 - roomSize)),
                    Math.floor(Math.random() * (512 - roomSize)),
                    roomSize,
                    roomSize
                );
            }

            // Main maze generation with 2-wide paths and 1-wide walls
            const stack: [number, number][] = [];
            const startX = Math.floor(Math.random() * 170) * 3 + 2;
            const startY = Math.floor(Math.random() * 170) * 3 + 2;
            stack.push([startX, startY]);

            // Carve initial 2x2 area
            for (let dx = 0; dx < 2; dx++) {
                for (let dy = 0; dy < 2; dy++) {
                    grid.setWalkableAt(startX + dx, startY + dy, true);
                }
            }

            // Directions with varied step sizes
            const directions = [
                [0, -3], [3, 0], [0, 3], [-3, 0], // Standard maze paths
                [0, -5], [5, 0], [0, 5], [-5, 0], // Wider avenues
                [0, -8], [8, 0], [0, 8], [-8, 0]  // Very wide paths
            ];

            while (stack.length > 0) {
                const [x, y] = stack[stack.length - 1];
                const shuffledDirections = [...directions].sort(() => Math.random() - 0.5);

                let moved = false;

                for (const [dx, dy] of shuffledDirections) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const pathWidth = Math.max(2, Math.min(Math.abs(dx), Math.abs(dy)));

                    if (nx > 0 && nx < 511 && ny > 0 && ny < 511) {
                        // Check if target area is wall
                        let canCarve = true;
                        for (let i = 0; i < pathWidth; i++) {
                            for (let j = 0; j < pathWidth; j++) {
                                if (grid.isWalkableAt(nx + (dx > 0 ? i : -i),
                                    ny + (dy > 0 ? j : -j))) {
                                    canCarve = false;
                                    break;
                                }
                            }
                            if (!canCarve) break;
                        }

                        if (canCarve) {
                            // Carve path with varied width
                            for (let i = 0; i < pathWidth; i++) {
                                for (let j = 0; j < pathWidth; j++) {
                                    grid.setWalkableAt(
                                        x + (dx > 0 ? i : dx === 0 ? 0 : -i),
                                        y + (dy > 0 ? j : dy === 0 ? 0 : -j),
                                        true
                                    );
                                    grid.setWalkableAt(
                                        nx + (dx > 0 ? i : -i),
                                        ny + (dy > 0 ? j : -j),
                                        true
                                    );
                                }
                            }
                            stack.push([nx, ny]);
                            moved = true;
                            break;
                        }
                    }
                }

                if (!moved) {
                    stack.pop();
                }
            }

            // Connect rooms to maze
            const connectRooms = () => {
                // Implementation would go here
                // This would ensure all rooms are connected to the main maze
            };
            connectRooms();
        };

        // Generate maze
        generateMaze(newGrid);

        // Ensure player and goals are on walkable tiles
        // If they are in walls, find nearest walkable tile
        const ensureWalkable = (x: number, y: number) => {
            if (newGrid.isWalkableAt(x, y)) return [x, y];

            // Search in spiral pattern for walkable tile
            for (let r = 1; r < 50; r++) {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) === r || Math.abs(dy) === r) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < 512 && ny >= 0 && ny < 512 && newGrid.isWalkableAt(nx, ny)) {
                                return [nx, ny];
                            }
                        }
                    }
                }
            }
            return [x, y]; // fallback
        };

        const [playerX, playerY] = ensureWalkable(256, 256);
        const [goal1X, goal1Y] = ensureWalkable(100, 100);
        const [goal2X, goal2Y] = ensureWalkable(400, 100);
        const [goal3X, goal3Y] = ensureWalkable(100, 400);
        const [goal4X, goal4Y] = ensureWalkable(400, 400);

        // Add player
        const player: Entity = {
            id: 0,
            position: { x: playerX, y: playerY },
            type: 'player',
            health: 100,
            maxHealth: 100,
            speed: 2,
        };

        // Add altars and goals
        const altars: Entity[] = [
            { id: 1, position: { x: 100, y: 100 }, type: 'altar' },
            { id: 2, position: { x: 400, y: 100 }, type: 'altar' },
            { id: 3, position: { x: 100, y: 400 }, type: 'altar' },
            { id: 4, position: { x: 400, y: 400 }, type: 'altar' },
        ];

        setGrid(newGrid);
        setEntities([player, ...altars]);

        // Center view on player initially
        centerViewOnPlayer();
    };

    const centerViewOnPlayer = () => {
        const player = entities.find(e => e.type === 'player');
        if (!player || !gameAreaRef.current) return;

        const gameArea = gameAreaRef.current;
        const newOffset = {
            x: player.position.x - gameArea.clientWidth / (2 * scale),
            y: player.position.y - gameArea.clientHeight / (2 * scale)
        };

        setViewOffset(newOffset);
    };

    const handleResize = () => {
        ; // pass
    };

    // 重用finder实例
    const pathFinder = new AStarFinder({
        diagonalMovement: DiagonalMovement.Never
    });

    // 简单路径缓存
    const pathCache = new Map<string, Position[]>();
    const CACHE_SIZE = 50;

    const calculatePath = (start: Position, end: Position) => {
        try {
            if (!grid || !grid.width || !grid.height) {
                console.warn('Grid not initialized');
                return [];
            }

            // 验证位置
            const startX = Math.max(0, Math.min(Math.floor(start.x), grid.width - 1));
            const startY = Math.max(0, Math.min(Math.floor(start.y), grid.height - 1));
            const endX = Math.max(0, Math.min(Math.floor(end.x), grid.width - 1));
            const endY = Math.max(0, Math.min(Math.floor(end.y), grid.height - 1));

            // 检查起点和终点是否可通行
            if (!grid.isWalkableAt(startX, startY)) {
                console.warn('Start position not walkable', { startX, startY });
                return [];
            }
            if (!grid.isWalkableAt(endX, endY)) {
                console.warn('End position not walkable', { endX, endY });
                return [];
            }

            // 检查缓存
            const cacheKey = `${startX}|${startY}|${endX}|${endY}`;
            if (pathCache.has(cacheKey)) {
                return pathCache.get(cacheKey)!;
            }

            // 创建网格副本进行计算
            const gridClone = grid.clone();
            const path = pathFinder.findPath(startX, startY, endX, endY, gridClone);

            const result = path ? path.map(([x, y]) => ({ x, y })) : [];

            // 更新缓存
            if (pathCache.size >= CACHE_SIZE) {
                const firstKey = pathCache.keys().next().value;
                if (firstKey !== undefined) {
                    pathCache.delete(firstKey);
                }
            }
            pathCache.set(cacheKey, result);

            return result;

            return result;
        } catch (e) {
            console.error('Path calculation failed:', e);
            return [];
        }
    };

    const spawnMonster = (currentEntities: Entity[]): Entity[] => {
        if (!grid) return currentEntities;

        // 预计算玩家和祭坛位置
        const player = currentEntities.find(e => e.type === 'player');
        const altar = currentEntities.find(e => e.type === 'altar');
        const target = Math.random() > 0.5 ? player : altar;

        // 在地图边缘随机选择生成区域
        const edge = Math.floor(Math.random() * 4);
        let x = 0, y = 0;
        const spawnAreaSize = 32; // 缩小搜索区域

        switch (edge) {
            case 0: x = 0; y = Math.floor(Math.random() * spawnAreaSize); break; // left
            case 1: x = 511; y = Math.floor(Math.random() * spawnAreaSize); break; // right
            case 2: x = Math.floor(Math.random() * spawnAreaSize); y = 0; break; // top
            case 3: x = Math.floor(Math.random() * spawnAreaSize); y = 511; break; // bottom
        }

        // 优化搜索逻辑 - 减少搜索半径
        for (let r = 0; r < 3; r++) {
            for (let dx = -r; dx <= r; dx++) {
                const nx = Math.floor(x + dx);
                if (nx < 0 || nx > 511) continue;

                for (let dy = -r; dy <= r; dy++) {
                    const ny = Math.floor(y + dy);
                    if (ny < 0 || ny > 511) continue;

                    if (grid.isWalkableAt(nx, ny)) {
                        const monster: Entity = {
                            id: Date.now(),
                            position: { x: nx, y: ny },
                            type: 'monster',
                            speed: 1,
                            targetId: target?.id || player?.id || currentEntities[0].id,
                            health: 100,
                            path: [],
                            chargeProgress: 0
                        };
                        return [...currentEntities, monster];
                    }
                }
            }
        }
        return currentEntities;
    };

    const updateMonsterAI = (entity: Entity) => {
        if (!grid || entity.type !== 'monster') return entity;

        try {
            // 检查怪物是否移动
            if (entity.lastPosition &&
                entity.lastPosition.x === entity.position.x &&
                entity.lastPosition.y === entity.position.y) {
                // entity.stuckCounter = (entity.stuckCounter || 0) + 1;
            } else {
                entity.stuckCounter = 0;
            }
            entity.lastPosition = { ...entity.position };
            // Find current target
            const currentTarget = entities.find(e => e.id === entity.targetId);

            // Find all possible targets (player and altars)
            const player = entities.find(e => e.type === 'player');
            const altars = entities.filter(e => e.type === 'altar');

            // Calculate distances to potential targets
            const targetOptions = [];
            if (player) {
                const dist = Math.sqrt(
                    Math.pow(entity.position.x - player.position.x, 2) +
                    Math.pow(entity.position.y - player.position.y, 2)
                );
                targetOptions.push({ id: player.id, dist, type: 'player' });
            }

            altars.forEach(altar => {
                const dist = Math.sqrt(
                    Math.pow(entity.position.x - altar.position.x, 2) +
                    Math.pow(entity.position.y - altar.position.y, 2)
                );
                targetOptions.push({ id: altar.id, dist, type: 'altar' });
            });

            // Sort by distance and prioritize altars within 200 units
            targetOptions.sort((a, b) => {
                const aScore = a.type === 'altar' && a.dist < 200 ? a.dist - 1000 : a.dist;
                const bScore = b.type === 'altar' && b.dist < 200 ? b.dist - 1000 : b.dist;
                return aScore - bScore;
            });

            const bestTarget = targetOptions[0];
            if (!bestTarget) return entity;

            // Switch target if better option found
            if (!currentTarget || currentTarget.id !== bestTarget.id) {
                entity.targetId = bestTarget.id;
                entity.path = [];
            }

            const target = entities.find(e => e.id === entity.targetId);
            if (!target) return entity;

            // If at altar, charge it
            if (target.type === 'altar') {
                const distance = Math.sqrt(
                    Math.pow(entity.position.x - target.position.x, 2) +
                    Math.pow(entity.position.y - target.position.y, 2)
                );

                if (distance < 10) {
                    const newProgress = Math.min(1, (entity.chargeProgress || 0) + 0.02);
                    // Ensure chargeProgress reaches exactly 1 when close
                    const finalProgress = newProgress >= 0.999 ? 1 : newProgress;
                    // Only return charging state if not fully charged
                    if (finalProgress < 1) {
                        return {
                            ...entity,
                            chargeProgress: finalProgress,
                            path: []
                        };
                    }

                    setLasers(prev => {
                        // Remove completed lasers
                        const updated = prev.filter(l => l.progress < l.duration)
                            .map(l => ({ ...l, progress: l.progress + 1 }));

                        const player = entities.find(e => e.type === 'player');
                        if (!player) return prev;

                        updated.push({
                            from: target.position,
                            to: player.position,
                            progress: 0,
                            duration: 10
                        });

                        return updated;
                    });

                    return {
                        ...entity,
                        chargeProgress: 0,
                        path: [],
                        targetId: undefined
                    };
                }
            }

            // 优化路径计算条件
            const shouldRecalculatePath =
                !entity.path ||
                entity.path.length === 0 ||
                (entity.path.length > 0 &&
                    Math.abs(entity.path[entity.path.length - 1].x - target.position.x) > 10) ||
                (entity.path.length > 0 &&
                    Math.abs(entity.path[entity.path.length - 1].y - target.position.y) > 10);

            // Move toward target
            if (shouldRecalculatePath) {
                const newPath = calculatePath(entity.position, target.position);
                if (newPath.length === 0) {
                    if (process.env.NODE_ENV === 'development') {
                        console.debug('Removing stuck monster:', entity.id);
                    }
                    return { ...entity, stuckCounter: 600 }
                }
                return { ...entity, path: newPath };
            }

            // 简化移动逻辑 - 直接使用现有路径
            if (entity.path && entity.path.length > 0) {
                const nextPos = entity.path[0];
                const dx = nextPos.x - entity.position.x;
                const dy = nextPos.y - entity.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = entity.speed || 1;

                if (distance < speed * 0.5) {
                    return { ...entity, path: entity.path.slice(1) };
                }
            }

            return entity;
        } catch (e) {
            console.error('Monster AI update failed:', e);
            return entity;
        }
    };

    const updateGame = () => {
        // Check for terminal interaction
        checkTerminalInteraction();

        setLasers(prev => {
            // Remove completed lasers
            const updated = prev.filter(l => l.progress < l.duration)
                .map(l => ({ ...l, progress: l.progress + 1 }));

            // 当railgun激活时，定期创建新的光柱效果
            if (railgunActive && Math.random() < 0.1) {
                const monsters = entities.filter(e => e.type === 'monster');
                monsters.forEach(monster => {
                    updated.push({
                        from: { x: monster.position.x, y: -100 },
                        to: monster.position,
                        progress: 0,
                        duration: 30, // 持续30帧(约1秒)
                        type: 'railgun'
                    });
                });
            }

            return updated;
        });

        // Spawn monsters periodically
        setSpawnTimer(prev => {
            if (prev >= 150 && !altarDisabled) { // Every 5 seconds at 60FPS when altars not disabled
                setEntities(current => {
                    let newEntities = spawnMonster(current);
                    for (let i = 0; i < Math.floor(Math.sqrt(score)); i++) newEntities = spawnMonster(newEntities);
                    if (process.env.NODE_ENV === 'development') {
                        console.debug('Spawned new monster');
                    }
                    return newEntities;
                });
                return 0;
            }
            return prev + 1;
        });

        setTerminalGenerateTimer(prev => {
            if (entities.filter(e => e.type === 'terminal').length > 0) return 0;
            if (prev >= 0) { // *****
                generateTerminals();
                return 0;
            }
            return prev + 1;
        })

        // Update monsters and check for player damage
        setEntities(prev => {
            const player = prev.find(e => e.type === 'player');
            if (!player) return prev;

            let playerDamaged = 0;

            // Check monster collisions
            let updated = prev.map(entity => {
                if (entity.type === 'monster') {
                    if (Math.abs(entity.position.x - player.position.x) < 10 &&
                        Math.abs(entity.position.y - player.position.y) < 10) {
                        playerDamaged++;
                    }
                }
                return entity;
            });

            if (playerDamaged > 0) {
                const playerIndex = updated.findIndex(e => e.type === 'player');
                if (playerIndex !== -1) {
                    const player = updated[playerIndex];
                    const newHealth = Math.max(0, (player.health || 0) - 0.03 * playerDamaged);
                    if (newHealth <= 0) {
                        setIsDead(true);
                    }
                    updated[playerIndex] = {
                        ...player,
                        health: newHealth
                    };
                }
            }
            // 先更新所有实体状态
            updated = updated.map(entity => {
                // Check laser damage
                lasers.forEach(laser => {
                    if (Math.abs(laser.to.x - entity.position.x) < 10 &&
                        Math.abs(laser.to.y - entity.position.y) < 10) {
                        entity.health = Math.max(0, (entity.health || 0) - (entity.type == 'player' ? 0.008 : 0.4));
                    }
                });

                // Move player along path
                if (entity.type === 'player') {
                    if (entity.health != undefined && entity.health <= 0.1) {
                        setIsDead(true);
                        return entity;
                    }

                    if (!entity.path || entity.path.length === 0) {
                        return entity;
                    }

                    const nextPos = entity.path[0];
                    const dx = nextPos.x - entity.position.x;
                    const dy = nextPos.y - entity.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const speed = entity.speed || 1;

                    if (distance < speed * 0.5) { // Close enough to consider reached
                        const newPath = entity.path.slice(1);

                        // Clear path if reached destination
                        if (newPath.length === 0) {
                            setPlayerPath([]);
                            return {
                                ...entity,
                                path: []
                            };
                        }

                        setPlayerPath(newPath);

                        // Smooth view adjustment
                        if (gameAreaRef.current) {
                            const gameArea = gameAreaRef.current;
                            const playerScreenX = (entity.position.x - viewOffset.x) * scale;
                            const playerScreenY = (entity.position.y - viewOffset.y) * scale;

                            const edgeThreshold = 150;
                            const lerpFactor = 0.1;
                            let newOffset = { ...viewOffset };

                            if (playerScreenX < edgeThreshold) {
                                newOffset.x = viewOffset.x + (entity.position.x - edgeThreshold / scale - viewOffset.x) * lerpFactor;
                            } else if (playerScreenX > gameArea.clientWidth - edgeThreshold) {
                                newOffset.x = viewOffset.x + (entity.position.x - (gameArea.clientWidth - edgeThreshold) / scale - viewOffset.x) * lerpFactor;
                            }

                            if (playerScreenY < edgeThreshold) {
                                newOffset.y = viewOffset.y + (entity.position.y - edgeThreshold / scale - viewOffset.y) * lerpFactor;
                            } else if (playerScreenY > gameArea.clientHeight - edgeThreshold) {
                                newOffset.y = viewOffset.y + (entity.position.y - (gameArea.clientHeight - edgeThreshold) / scale - viewOffset.y) * lerpFactor;
                            }

                            setViewOffset(newOffset);
                        }

                        // Continue moving smoothly to next position
                        const nextDx = newPath[0]?.x - nextPos.x || 0;
                        const nextDy = newPath[0]?.y - nextPos.y || 0;
                        const nextDistance = Math.sqrt(nextDx * nextDx + nextDy * nextDy);
                        const ratio = nextDistance > 0 ? speed / nextDistance : 0;

                        return {
                            ...entity,
                            position: {
                                x: nextPos.x + (nextDx * ratio * 0.1),
                                y: nextPos.y + (nextDy * ratio * 0.1)
                            },
                            path: newPath
                        };
                    }

                    // Normal movement toward next node
                    const ratio = speed / distance;
                    return {
                        ...entity,
                        position: {
                            x: entity.position.x + dx * ratio,
                            y: entity.position.y + dy * ratio
                        }
                    };
                }

                // Move monster along path
                if (entity.type === 'monster') {
                    const updatedEntity = updateMonsterAI(entity);
                    if (!updatedEntity.path || updatedEntity.path.length === 0) {
                        return updatedEntity;
                    }

                    const nextPos = updatedEntity.path[0];
                    const dx = nextPos.x - updatedEntity.position.x;
                    const dy = nextPos.y - updatedEntity.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const speed = updatedEntity.speed || 1;

                    if (distance < speed * 0.5) { // Close enough to consider reached
                        const newPath = updatedEntity.path.slice(1);
                        if (process.env.NODE_ENV === 'development') {
                            // console.debug('Monster reached path point:', updatedEntity.id);
                        }
                        return {
                            ...updatedEntity,
                            position: {
                                x: nextPos.x,
                                y: nextPos.y
                            },
                            path: newPath
                        };
                    }

                    // Normal movement toward next node
                    const ratio = speed / distance;
                    return {
                        ...updatedEntity,
                        position: {
                            x: updatedEntity.position.x + dx * ratio,
                            y: updatedEntity.position.y + dy * ratio
                        }
                    };
                }

                return entity;
            });

            // 过滤掉卡住的/死的怪物(stuckCounter >= 60)
            updated = updated.filter(entity =>
                entity.type !== 'monster' ||
                ((entity.stuckCounter || 0) < 600 && entity.health && entity.health > 0)
            );

            setPlayerHealth({ health: player.health != undefined ? player.health : 100, maxHealth: player.maxHealth != undefined ? player.maxHealth : 100 });

            return updated;
        });
    }


    const drawGame = () => {
        const canvas = canvasRef.current;
        if (!canvas || !gameAreaRef.current) return;

        const gameArea = gameAreaRef.current;
        canvas.width = gameArea.clientWidth;
        canvas.height = gameArea.clientHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid lines (every 32 game units)
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;

        const gridSize = 32;
        const startX = Math.floor(viewOffset.x / gridSize) * gridSize;
        const startY = Math.floor(viewOffset.y / gridSize) * gridSize;
        const endX = startX + Math.ceil(canvas.width / (scale * gridSize)) * gridSize;
        const endY = startY + Math.ceil(canvas.height / (scale * gridSize)) * gridSize;

        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = (x - viewOffset.x) * scale;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }

        for (let y = startY; y <= endY; y += gridSize) {
            const screenY = (y - viewOffset.y) * scale;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        }

        // Draw obstacles
        if (grid) {
            ctx.fillStyle = '#333';
            const cellSize = scale;

            // Only draw visible area
            const startCellX = Math.max(0, Math.floor(viewOffset.x));
            const startCellY = Math.max(0, Math.floor(viewOffset.y));
            const endCellX = Math.min(grid.width, Math.ceil(viewOffset.x + canvas.width / scale));
            const endCellY = Math.min(grid.height, Math.ceil(viewOffset.y + canvas.height / scale));

            for (let x = startCellX; x < endCellX; x++) {
                for (let y = startCellY; y < endCellY; y++) {
                    if (!grid.isWalkableAt(x, y)) {
                        ctx.fillRect(
                            (x - viewOffset.x) * scale,
                            (y - viewOffset.y) * scale,
                            cellSize,
                            cellSize
                        );
                    }
                }
            }
        }

        // Draw player path
        if (playerPath.length > 0) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();

            const player = entities.find(e => e.type === 'player');
            if (player) {
                ctx.moveTo(
                    (player.position.x - viewOffset.x) * scale,
                    (player.position.y - viewOffset.y) * scale
                );

                playerPath.forEach(point => {
                    ctx.lineTo(
                        (point.x - viewOffset.x) * scale,
                        (point.y - viewOffset.y) * scale
                    );
                });

                ctx.stroke();
            }
        }

        // Draw entities
        entities.forEach(entity => {
            const screenX = (entity.position.x - viewOffset.x) * scale;
            const screenY = (entity.position.y - viewOffset.y) * scale;

            switch (entity.type) {
                case 'terminal':
                    // Draw terminal
                    ctx.fillStyle = '#8af';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw terminal type indicator
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let symbol = '';
                    switch (entity.terminalType) {
                        case 'heal': symbol = 'H'; break;
                        case 'disable_altar': symbol = 'D'; break;
                        case 'railgun': symbol = 'R'; break;
                    }
                    ctx.fillText(symbol, screenX, screenY);
                    break;
                case 'player':
                    ctx.fillStyle = '#4af';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw direction indicator
                    if (entity.path && entity.path.length > 0) {
                        const nextPoint = entity.path[0];
                        const angle = Math.atan2(
                            nextPoint.y - entity.position.y,
                            nextPoint.x - entity.position.x
                        );

                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(screenX, screenY);
                        ctx.lineTo(
                            screenX + Math.cos(angle) * 10,
                            screenY + Math.sin(angle) * 10
                        );
                        ctx.stroke();
                    }
                    break;

                case 'goal':
                    ctx.fillStyle = '#8f4';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'monster':
                    ctx.fillStyle = '#f44';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw charge progress if charging
                    if (entity.chargeProgress && entity.chargeProgress > 0) {
                        // Progress bar background
                        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
                        ctx.fillRect(screenX - 10, screenY - 12, 20, 4);

                        // Progress bar fill
                        ctx.fillStyle = '#f55';
                        ctx.fillRect(screenX - 10, screenY - 12, 20 * entity.chargeProgress, 4);

                        // Glowing effect
                        const gradient = ctx.createRadialGradient(
                            screenX, screenY, 0,
                            screenX, screenY, 6 * entity.chargeProgress
                        );
                        gradient.addColorStop(0, 'rgba(255, 100, 100, 0.8)');
                        gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');

                        ctx.fillStyle = gradient;
                        ctx.beginPath();
                        ctx.arc(screenX, screenY, 6 * entity.chargeProgress, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;

                case 'altar':
                    ctx.fillStyle = '#a8f';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
                    ctx.fill();

                    // Show charge progress if monster is charging at this altar
                    const chargingMonster = entities.find(e =>
                        e.type === 'monster' &&
                        e.targetId === entity.id &&
                        e.chargeProgress &&
                        e.chargeProgress > 0
                    );

                    if (chargingMonster) {
                        // Progress bar background
                        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
                        ctx.fillRect(screenX - 15, screenY - 20, 30, 5);

                        // Progress bar fill
                        ctx.fillStyle = '#f5f';
                        ctx.fillRect(
                            screenX - 15,
                            screenY - 20,
                            30 * (chargingMonster.chargeProgress || 0),
                            5
                        );

                        // Altar glow effect
                        const altarGradient = ctx.createRadialGradient(
                            screenX, screenY, 8,
                            screenX, screenY, 16
                        );
                        altarGradient.addColorStop(0, 'rgba(170, 136, 255, 0.8)');
                        altarGradient.addColorStop(1, 'rgba(170, 136, 255, 0)');

                        ctx.fillStyle = altarGradient;
                        ctx.beginPath();
                        ctx.arc(screenX, screenY, 16, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
            }
        });

        // Draw lasers with enhanced effects
        lasers.forEach(laser => {
            const fromX = (laser.from.x - viewOffset.x) * scale;
            const fromY = (laser.from.y - viewOffset.y) * scale;
            const toX = (laser.to.x - viewOffset.x) * scale;
            const toY = (laser.to.y - viewOffset.y) * scale;

            // Calculate progress ratio (0 to 1)
            const progressRatio = laser.progress / laser.duration;
            const reverseRatio = 1 - progressRatio;

            if (laser.type === 'railgun') {
                // 红色光柱特效
                const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
                gradient.addColorStop(0, `rgba(255, 0, 0, ${reverseRatio * 0.9})`);
                gradient.addColorStop(0.5, `rgba(255, 50, 50, ${reverseRatio * 1})`);
                gradient.addColorStop(1, `rgba(255, 100, 100, ${reverseRatio * 0.8})`);

                // 更粗的光柱
                ctx.strokeStyle = `rgba(255, 0, 0, ${reverseRatio * 0.3})`;
                ctx.lineWidth = 20 + 25 * reverseRatio;
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();

                // 主光柱
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 8 + 10 * reverseRatio;
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();

                // 核心光柱
                ctx.strokeStyle = `rgba(255, 255, 255, ${reverseRatio * 0.9})`;
                ctx.lineWidth = 2 + 3 * reverseRatio;
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
            } else {
                // 普通激光特效
                const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
                gradient.addColorStop(0, `rgba(255, 80, 80, ${reverseRatio * 0.9})`);
                gradient.addColorStop(0.5, `rgba(255, 30, 30, ${reverseRatio * 1})`);
                gradient.addColorStop(1, `rgba(255, 120, 120, ${reverseRatio * 0.8})`);

                // More visible outer glow
                ctx.strokeStyle = `rgba(255, 50, 50, ${reverseRatio * 0.5})`;
                ctx.lineWidth = 12 + 15 * reverseRatio;
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();

                // Main beam
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 4 + 6 * reverseRatio;
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();

                // Core beam (bright center)
                ctx.strokeStyle = `rgba(255, 255, 255, ${reverseRatio * 0.8})`;
                ctx.lineWidth = 1 + 2 * reverseRatio;
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();

                // Spark particles at impact point
                if (progressRatio < 0.2) {
                    const particleCount = 5 + Math.floor(5 * reverseRatio);
                    for (let i = 0; i < particleCount; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const distance = 3 + Math.random() * 10 * reverseRatio;
                        const size = 1 + Math.random() * 3;

                        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 105}, 100, ${0.5 + Math.random() * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(
                            toX + Math.cos(angle) * distance,
                            toY + Math.sin(angle) * distance,
                            size,
                            0,
                            Math.PI * 2
                        );
                        ctx.fill();
                    }
                }
            }
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 1) return; // Left or middle mouse button

        // Only prevent default if we're handling the event
        e.preventDefault();
        setIsDragging(true);
        setDragStart({
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;

        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        setViewOffset(prev => ({
            x: prev.x - dx,
            y: prev.y - dy
        }));

        setDragStart({
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Only prevent default if we're actually handling the event
        if (Math.abs(e.deltaY) > 0) {
            // e.preventDefault();
            e.stopPropagation();

            // Get mouse position in game coordinates
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const gameX = viewOffset.x + mouseX / scale;
            const gameY = viewOffset.y + mouseY / scale;

            // Adjust scale
            const delta = -e.deltaY / 1000;
            const newScale = Math.min(Math.max(0.5, scale * (1 + delta)), 10);

            // Adjust offset to zoom toward mouse position
            setViewOffset({
                x: gameX - mouseX / newScale,
                y: gameY - mouseY / newScale
            });

            setScale(newScale);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isDragging) {
            // Don't register clicks that were actually drags
            setIsDragging(false);
            return;
        }

        try {
            // Convert click position to game coordinates
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = viewOffset.x + (e.clientX - rect.left) / scale;
            const clickY = viewOffset.y + (e.clientY - rect.top) / scale;

            // Find player
            const player = entities.find(e => e.type === 'player');
            if (!player || !grid || !grid.width || !grid.height) {
                console.warn('Player or grid not ready');
                return;
            }

            if (e.button === 0) { // Left click
                // Validate click position
                const validX = Math.max(0, Math.min(clickX, grid.width - 1));
                const validY = Math.max(0, Math.min(clickY, grid.height - 1));

                player.position = { x: validX, y: validY };

                // Calculate path to clicked position (disable cache temporarily)
                const path = calculatePath(player.position, { x: validX, y: validY });

                // Debug log
                if (path.length === 0) {
                    console.log('Path calculation failed', {
                        start: player.position,
                        end: { x: validX, y: validY },
                        gridWalkable: grid.isWalkableAt(Math.floor(validX), Math.floor(validY))
                    });
                }

                if (path.length > 0) {
                    // Update player path
                    setEntities(prev =>
                        prev.map(e =>
                            e.type === 'player' ? { ...e, path } : e
                        )
                    );
                    setPlayerPath(path);
                } else {
                    console.warn('No valid path found');
                }
            }
        } catch (error) {
            console.error('Click handling failed:', error);
        }
    };

    const [isDead, setIsDead] = useState(false);
    const [activeTerminal, setActiveTerminal] = useState<TerminalState | null>(null);
    const [altarDisabled, setAltarDisabled] = useState(false);
    const [railgunActive, setRailgunActive] = useState(false);

    // Generate terminals at random positions
    const generateTerminals = () => {
        if (!grid) return;

        const terminalTypes: ('heal' | 'disable_altar' | 'railgun')[] = [
            'heal', 'disable_altar', 'railgun'
        ];

        setEntities(prev => {
            // Remove existing terminals
            const filtered = prev.filter(e => e.type !== 'terminal');

            // Add 3-5 new terminals
            const count = 3 + Math.floor(Math.random() * 3);
            const newTerminals: Entity[] = [];

            for (let i = 0; i < count; i++) {
                let x = 0, y = 0;
                let attempts = 0;

                // Find valid position not too close to player or other terminals
                do {
                    x = Math.floor(Math.random() * 512);
                    y = Math.floor(Math.random() * 512);
                    attempts++;
                } while (
                    attempts < 100 &&
                    (!grid.isWalkableAt(x, y) ||
                        filtered.some(e =>
                            e.type === 'player' &&
                            Math.abs(e.position.x - x) < 50 &&
                            Math.abs(e.position.y - y) < 50) ||
                        newTerminals.some(t =>
                            Math.abs(t.position.x - x) < 50 &&
                            Math.abs(t.position.y - y) < 50))
                );

                if (attempts < 100) {
                    newTerminals.push({
                        id: Date.now() + i,
                        position: { x, y },
                        type: 'terminal',
                        terminalType: terminalTypes[i % terminalTypes.length],
                    });
                }
            }

            console.log('Generated terminals:', newTerminals);

            return [...filtered, ...newTerminals];
        });
    };

    // Check for player-terminal interaction
    const checkTerminalInteraction = () => {
        const player = entities.find(e => e.type === 'player');
        if (!player) return;

        const nearbyTerminal = entities.find(e =>
            e.type === 'terminal' &&
            Math.abs(e.position.x - player.position.x) < 15 &&
            Math.abs(e.position.y - player.position.y) < 15
        );

        if (nearbyTerminal && nearbyTerminal.terminalType) {
            setActiveTerminal({
                active: true,
                position: nearbyTerminal.position,
                type: nearbyTerminal.terminalType,
                entityId: nearbyTerminal.id,
                id: Date.now()
            });
        }
    };

    const handleTerminalComplete = (type: string) => {
        if (!activeTerminal) return;
        setScore(prev => prev + 10);

        switch (type) {
            case 'heal':
                setEntities(prev =>
                    prev.map(e =>
                        e.type === 'player' ?
                            { ...e, health: e.maxHealth } : e
                    )
                );
                break;
            case 'disable_altar':
                setAltarDisabled(true);
                setTimeout(() => setAltarDisabled(false), 30000); // 30s disable
                break;
            case 'railgun':
                setRailgunActive(true);
                setTimeout(() => setRailgunActive(false), 15000); // 15s activation
                break;
        }

        // Remove terminal after use
        setEntities(prev =>
            prev.filter(e => e.id !== activeTerminal.entityId)
        );
        setActiveTerminal(null);
    };

    const handleTerminalClose = () => {
        setActiveTerminal(null);
    };

    const handleRestart = () => {
        window.location.reload();
    };

    if (isDead) {
        return (
            <div className={styles.deathScreen}>
                <h2>You Died</h2>
                <div className={styles.scoreDisplay}>
                    Survival Time: {survivalTime.toFixed(1)}s
                    <br />
                    Score: {score.toFixed(0)}
                </div>
                <button onClick={handleRestart}>Respawn</button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.scoreBar}>
                <div className={styles.scoreItem}>Time: {survivalTime.toFixed(1)}s</div>
                <div className={styles.scoreItem}>Score: {score.toFixed(0)}</div>
            </div>
            <div
                ref={gameAreaRef}
                className={styles.gameArea}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onClick={handleClick}
            >
                <canvas ref={canvasRef} className={styles.canvas} />

                {/* Render active terminal */}
                {activeTerminal && (
                    <Terminal
                        type={activeTerminal.type}
                        position={{
                            x: (activeTerminal.position.x - viewOffset.x) * scale,
                            y: (activeTerminal.position.y - viewOffset.y) * scale
                        }}
                        onComplete={handleTerminalComplete}
                        onClose={handleTerminalClose}
                        randomSeed={activeTerminal.entityId ? activeTerminal.entityId : 0}
                    />
                )}
            </div>

            <div className={styles.controls}>
                <div className={styles.healthBarContainer}>
                    <div
                        className={styles.healthBar}
                        style={{ width: `${(playerHealth.health) / (playerHealth.maxHealth) * 100}%` }}
                    />
                </div>
                <button onClick={centerViewOnPlayer}>Center on Player</button>
                <div className={styles.zoomControls}>
                    <button onClick={() => setScale(prev => Math.min(prev + 0.5, 10))}>+</button>
                    <button onClick={() => setScale(prev => Math.max(prev - 0.5, 0.5))}>-</button>
                </div>
                <div>Scale: {scale.toFixed(1)}x</div>
            </div>
        </div>
    );
};

export default PathfindingSimulator;