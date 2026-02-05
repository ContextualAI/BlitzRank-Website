/**
 * Tournament Animation Player - SVG-based visualization with play/pause/step controls
 */

class TournamentAnimationPlayer {
    constructor(container, data, options = {}) {
        this.container = container;
        this.data = data;
        this.config = data.config;
        this.frames = data.frames;
        this.currentFrame = 0;
        this.isPlaying = false;
        this.playTimeout = null;
        this.speed = options.speed || 1200; // ms per frame (1x = slowest)
        this.onFrameChange = options.onFrameChange || null;
        this.prevDegrees = {}; // Track previous L/W for highlighting changes
        
        // Layout config
        this.cols = 5;
        this.nodeRadius = 18;
        this.spacing = 60;
        this.width = this.cols * this.spacing + 40;
        this.height = Math.ceil(this.config.n / this.cols) * this.spacing + 100;
        
        // Create SVG
        this.svg = this.createSVG();
        this.nodeElements = {};
        this.edgeGroup = null;
        this.labelElement = null;
        
        this.init();
    }

    createSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
        svg.setAttribute('class', 'tournament-svg');
        this.container.appendChild(svg);
        return svg;
    }

    getNodePosition(nodeId) {
        const idx = nodeId - 1;
        const row = Math.floor(idx / this.cols);
        const col = idx % this.cols;
        return {
            x: col * this.spacing + this.spacing / 2 + 20,
            y: row * this.spacing + this.spacing / 2 + 60
        };
    }

    init() {
        // Defs for arrowheads
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // New edge marker (cyan) - smaller, thinner
        const markerNew = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        markerNew.setAttribute('id', `arrow-new-${this.container.id}`);
        markerNew.setAttribute('viewBox', '0 0 10 10');
        markerNew.setAttribute('refX', '10');
        markerNew.setAttribute('refY', '5');
        markerNew.setAttribute('markerWidth', '5');
        markerNew.setAttribute('markerHeight', '5');
        markerNew.setAttribute('orient', 'auto-start-reverse');
        const pathNew = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathNew.setAttribute('d', 'M 0 1 L 10 5 L 0 9 z');
        pathNew.setAttribute('fill', '#00CED1');
        markerNew.appendChild(pathNew);
        defs.appendChild(markerNew);
        
        // Old edge marker (gray) - very small
        const markerOld = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        markerOld.setAttribute('id', `arrow-old-${this.container.id}`);
        markerOld.setAttribute('viewBox', '0 0 10 10');
        markerOld.setAttribute('refX', '10');
        markerOld.setAttribute('refY', '5');
        markerOld.setAttribute('markerWidth', '3');
        markerOld.setAttribute('markerHeight', '3');
        markerOld.setAttribute('orient', 'auto-start-reverse');
        const pathOld = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathOld.setAttribute('d', 'M 0 1 L 10 5 L 0 9 z');
        pathOld.setAttribute('fill', '#AAAAAA');
        markerOld.appendChild(pathOld);
        defs.appendChild(markerOld);
        
        // Inferred edge marker (orange) - for transitive closure
        const markerInferred = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        markerInferred.setAttribute('id', `arrow-inferred-${this.container.id}`);
        markerInferred.setAttribute('viewBox', '0 0 10 10');
        markerInferred.setAttribute('refX', '10');
        markerInferred.setAttribute('refY', '5');
        markerInferred.setAttribute('markerWidth', '4');
        markerInferred.setAttribute('markerHeight', '4');
        markerInferred.setAttribute('orient', 'auto-start-reverse');
        const pathInferred = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathInferred.setAttribute('d', 'M 0 1 L 10 5 L 0 9 z');
        pathInferred.setAttribute('fill', '#F59E0B');
        markerInferred.appendChild(pathInferred);
        defs.appendChild(markerInferred);
        
        this.svg.appendChild(defs);

        // Round label
        this.labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        this.labelElement.setAttribute('x', this.width / 2);
        this.labelElement.setAttribute('y', '28');
        this.labelElement.setAttribute('class', 'round-label');
        this.svg.appendChild(this.labelElement);

        // Phase label  
        this.phaseElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        this.phaseElement.setAttribute('x', this.width / 2);
        this.phaseElement.setAttribute('y', '48');
        this.phaseElement.setAttribute('class', 'phase-label');
        this.svg.appendChild(this.phaseElement);

        // Create nodes first (so edges can be drawn on top)
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', 'nodes');
        
        for (let i = 1; i <= this.config.n; i++) {
            const pos = this.getNodePosition(i);
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'node');
            g.setAttribute('data-id', i);
            g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

            // Circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', this.nodeRadius);
            circle.setAttribute('class', 'node-circle');
            g.appendChild(circle);

            // ID text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('class', 'node-id');
            text.setAttribute('dy', '0.35em');
            text.textContent = i;
            g.appendChild(text);

            // Degree labels (for BlitzRank)
            if (this.config.algorithm === 'blitzrank') {
                const lossLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                lossLabel.setAttribute('class', 'degree-label loss');
                lossLabel.setAttribute('x', -10);
                lossLabel.setAttribute('y', this.nodeRadius + 12);
                lossLabel.textContent = '0';
                g.appendChild(lossLabel);

                const winLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                winLabel.setAttribute('class', 'degree-label win');
                winLabel.setAttribute('x', 10);
                winLabel.setAttribute('y', this.nodeRadius + 12);
                winLabel.textContent = '0';
                g.appendChild(winLabel);
            }

            nodeGroup.appendChild(g);
            this.nodeElements[i] = g;
        }
        
        this.svg.appendChild(nodeGroup);

        // Edge group (drawn after nodes, so edges appear on top)
        this.edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.edgeGroup.setAttribute('class', 'edges');
        this.svg.appendChild(this.edgeGroup);
        
        // Render initial frame
        this.renderFrame(0);
    }

    renderFrame(index) {
        if (index < 0 || index >= this.frames.length) return;
        this.currentFrame = index;
        const frame = this.frames[index];

        // Update label
        this.labelElement.textContent = frame.roundLabel;
        
        // Phase text - educational descriptions (different for each algorithm)
        // Using innerHTML to support colored text for losses/wins
        const lossColor = '#dc2626';  // Red
        const winColor = '#16a34a';   // Green
        const loss = `<tspan fill="${lossColor}">losses</tspan>`;
        const win = `<tspan fill="${winColor}">wins</tspan>`;
        const lossShort = `<tspan fill="${lossColor}">losses</tspan>`;
        
        const blitzrankPhases = {
            idle: '',
            select: `Step 1: Select nodes with fewest ${lossShort}`,
            compare: 'Step 2: Compare via oracle (LLM)',
            closure: 'Step 3: Infer edges via transitivity',
            update_degrees: `Step 4: Update ${loss}/${win} counts`,
            eliminate: `Step 5: Eliminate nodes with ${lossShort} ≥ 3`,
            finalize: 'Step 6: Finalize top-3 nodes',
            final: ''
        };
        const slidingWindowPhases = {
            idle: '',
            select: 'Step 1: Select nodes from the right',
            compare: 'Step 2: Compare using oracle (LLM)',
            eliminate: 'Step 3: Eliminate bottom nodes',
            finalize: 'Step 4: Finalize top-3 nodes',
            final: ''
        };
        const phaseTexts = this.config.algorithm === 'blitzrank' ? blitzrankPhases : slidingWindowPhases;
        this.phaseElement.innerHTML = phaseTexts[frame.phase] || '';

        // Collect queried nodes
        const queriedSet = new Set();
        if (frame.queryGroups) {
            frame.queryGroups.forEach(g => g.forEach(id => queriedSet.add(id)));
        }
        if (frame.window) {
            frame.window.forEach(id => queriedSet.add(id));
        }

        // Update nodes
        for (let i = 1; i <= this.config.n; i++) {
            const nodeData = frame.nodes[String(i)];
            const g = this.nodeElements[i];
            if (!nodeData || !g) continue;

            // Determine status class
            let statusClass = 'pending';
            if (queriedSet.has(i) && (frame.phase === 'select' || frame.phase === 'compare')) {
                statusClass = 'querying';
            } else if (nodeData.status === 'finalized_top') {
                statusClass = 'finalized-top';
            } else if (nodeData.status === 'finalized_out') {
                statusClass = 'eliminated';
            } else if (nodeData.status === 'survivor') {
                statusClass = 'survivor';
            } else if (nodeData.status === 'in_window') {
                statusClass = 'querying';
            }

            g.setAttribute('class', `node ${statusClass}`);

            // Update degree labels for BlitzRank with change highlighting
            if (this.config.algorithm === 'blitzrank') {
                const lossLabel = g.querySelector('.degree-label.loss');
                const winLabel = g.querySelector('.degree-label.win');
                
                const prevKey = `${i}`;
                const prev = this.prevDegrees[prevKey] || { in: 0, out: 0 };
                const lossChanged = nodeData.inDegree !== prev.in;
                const winChanged = nodeData.outDegree !== prev.out;
                
                if (lossLabel) {
                    lossLabel.textContent = nodeData.inDegree;
                    lossLabel.classList.toggle('changed', lossChanged && frame.phase === 'update_degrees');
                }
                if (winLabel) {
                    winLabel.textContent = nodeData.outDegree;
                    winLabel.classList.toggle('changed', winChanged && frame.phase === 'update_degrees');
                }
                
                // Store current for next frame comparison
                this.prevDegrees[prevKey] = { in: nodeData.inDegree, out: nodeData.outDegree };
            }
        }

        // Update edges
        this.renderEdges(frame);

        // Callback
        if (this.onFrameChange) {
            this.onFrameChange(index, this.frames.length, frame);
        }
    }

    renderEdges(frame) {
        // Clear existing edges
        this.edgeGroup.innerHTML = '';
        
        const edges = frame.edges || [];
        const newEdges = frame.newEdges || [];
        const inferredEdges = frame.inferredEdges || [];
        const propagationPaths = frame.propagationPaths || [];
        
        const newEdgeSet = new Set(newEdges.map(e => `${e[0]}-${e[1]}`));
        const inferredEdgeSet = new Set(inferredEdges.map(e => `${e[0]}-${e[1]}`));

        // Get active nodes (not eliminated/finalized)
        const activeNodes = new Set();
        for (let i = 1; i <= this.config.n; i++) {
            const nodeData = frame.nodes[String(i)];
            if (nodeData && nodeData.status !== 'finalized_out' && nodeData.status !== 'finalized_top') {
                activeNodes.add(i);
            }
        }

        // For sliding window during compare phase, treat all edges as new (cyan)
        // since there's no separate newEdges field
        const isSlidingWindowCompare = this.config.algorithm === 'sliding_window' && 
                                        frame.phase === 'compare' && 
                                        newEdges.length === 0 && 
                                        edges.length > 0;

        // Draw base edges (minimal/reduced edges from transitive reduction)
        edges.forEach(([from, to]) => {
            const key = `${from}-${to}`;
            // Skip if this will be drawn as new or inferred
            if (newEdgeSet.has(key) && frame.phase === 'compare') return;
            if (inferredEdgeSet.has(key) && frame.phase === 'closure') return;
            
            // Only draw between active nodes
            if (!activeNodes.has(from) || !activeNodes.has(to)) return;
            
            // For sliding window compare phase, draw as new (cyan)
            if (isSlidingWindowCompare) {
                this.drawEdge(from, to, 'new');
            } else {
                this.drawEdge(from, to, 'old');
            }
        });

        // Draw new direct comparison edges (cyan)
        if (frame.phase === 'compare' && !isSlidingWindowCompare) {
            newEdges.forEach(([from, to]) => {
                this.drawEdge(from, to, 'new');
            });
        }

        // Draw inferred edges (orange, dashed) with pulse animation during closure
        if (frame.phase === 'closure' && inferredEdges.length > 0) {
            // First draw propagation path highlights
            this.drawPropagationPaths(propagationPaths, activeNodes);
            
            // Then draw inferred edges
            inferredEdges.forEach(([from, to]) => {
                if (!activeNodes.has(from) || !activeNodes.has(to)) return;
                this.drawEdge(from, to, 'inferred');
            });
        }
    }

    drawPropagationPaths(paths, activeNodes) {
        // Draw highlighted paths showing how inference works: A→B→C implies A→C
        paths.forEach((path, idx) => {
            const { from, via, to } = path;
            if (!activeNodes.has(from) || !activeNodes.has(via) || !activeNodes.has(to)) return;
            
            // Highlight the intermediate path with a pulse effect
            this.drawEdge(from, via, 'pulse', idx * 50);
            this.drawEdge(via, to, 'pulse', idx * 50 + 100);
        });
    }

    drawEdge(from, to, type, animDelay = 0) {
        const fromPos = this.getNodePosition(from);
        const toPos = this.getNodePosition(to);

        // Calculate direction
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const ux = dx / dist;
        const uy = dy / dist;

        // Start exactly at circumference
        const x1 = fromPos.x + ux * this.nodeRadius;
        const y1 = fromPos.y + uy * this.nodeRadius;
        
        // End exactly at circumference
        const x2 = toPos.x - ux * this.nodeRadius;
        const y2 = toPos.y - uy * this.nodeRadius;

        // Subtle curve for visual clarity
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const perpX = -uy;
        const perpY = ux;
        const curve = type === 'new' ? 8 : type === 'inferred' ? 10 : 6;
        const ctrlX = midX + perpX * curve;
        const ctrlY = midY + perpY * curve;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`);
        
        // Set class and marker based on type
        if (type === 'new') {
            path.setAttribute('class', 'edge new');
            path.setAttribute('marker-end', `url(#arrow-new-${this.container.id})`);
        } else if (type === 'inferred') {
            path.setAttribute('class', 'edge inferred');
            path.setAttribute('marker-end', `url(#arrow-inferred-${this.container.id})`);
        } else if (type === 'pulse') {
            path.setAttribute('class', 'edge pulse');
            // Pulse edges highlight existing paths, no marker needed
            if (animDelay > 0) {
                path.style.animationDelay = `${animDelay}ms`;
            }
        } else {
            path.setAttribute('class', 'edge old');
            path.setAttribute('marker-end', `url(#arrow-old-${this.container.id})`);
        }
        
        this.edgeGroup.appendChild(path);
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.scheduleNextFrame();
    }

    scheduleNextFrame() {
        if (!this.isPlaying) return;
        if (this.currentFrame >= this.frames.length - 1) {
            this.pause();
            return;
        }
        
        // Variable timing: closure/update_degrees phases get extra time
        const currentPhase = this.frames[this.currentFrame]?.phase;
        let delay = this.speed;
        if (currentPhase === 'closure') {
            delay = this.speed * 1.5; // 50% more time for inference step
        } else if (currentPhase === 'update_degrees') {
            delay = this.speed * 1.3; // 30% more time to see L/W changes
        }
        
        this.playTimeout = setTimeout(() => {
            this.renderFrame(this.currentFrame + 1);
            this.scheduleNextFrame();
        }, delay);
    }

    pause() {
        this.isPlaying = false;
        if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
        }
    }

    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            // Restart if at end
            if (this.currentFrame >= this.frames.length - 1) {
                this.currentFrame = 0;
            }
            this.play();
        }
        return this.isPlaying;
    }

    stepForward() {
        this.pause();
        if (this.currentFrame < this.frames.length - 1) {
            this.renderFrame(this.currentFrame + 1);
        }
    }

    stepBackward() {
        this.pause();
        if (this.currentFrame > 0) {
            this.renderFrame(this.currentFrame - 1);
        }
    }

    goToFrame(index) {
        this.pause();
        this.renderFrame(Math.max(0, Math.min(index, this.frames.length - 1)));
    }

    reset() {
        this.pause();
        this.renderFrame(0);
    }

    setSpeed(ms) {
        this.speed = ms;
        // Speed change takes effect on next frame automatically
    }
}

// Initialize animations when DOM is ready
async function initAnimations() {
    const blitzrankContainer = document.getElementById('blitzrank-animation');
    const slidingWindowContainer = document.getElementById('sliding-window-animation');
    
    if (!blitzrankContainer || !slidingWindowContainer) return;

    // Shared controls
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stepBackBtn = document.getElementById('step-back-btn');
    const stepForwardBtn = document.getElementById('step-forward-btn');
    const progressSlider = document.getElementById('progress-slider');
    const speedSelect = document.getElementById('speed-select');
    const resetBtn = document.getElementById('reset-btn');

    // Load data
    const [blitzrankData, slidingWindowData] = await Promise.all([
        fetch('gif/blitzrank.json').then(r => r.json()),
        fetch('gif/sliding_window.json').then(r => r.json())
    ]);

    // Track frame positions for both players
    const framePositions = { blitzrank: 0, slidingWindow: 0 };
    const maxFrames = Math.max(blitzrankData.frames.length, slidingWindowData.frames.length) - 1;
    
    // Frame change callback - only update slider with max of both positions
    const createUpdateCallback = (key) => (index) => {
        framePositions[key] = index;
        if (progressSlider) {
            progressSlider.max = maxFrames;
            progressSlider.value = Math.max(framePositions.blitzrank, framePositions.slidingWindow);
        }
    };

    // Create players - each runs independently at its own pace
    const blitzrankPlayer = new TournamentAnimationPlayer(blitzrankContainer, blitzrankData, {
        speed: 1200,
        onFrameChange: createUpdateCallback('blitzrank')
    });
    
    const slidingWindowPlayer = new TournamentAnimationPlayer(slidingWindowContainer, slidingWindowData, {
        speed: 1200,
        onFrameChange: createUpdateCallback('slidingWindow')
    });

    const players = [blitzrankPlayer, slidingWindowPlayer];

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            const wasPlaying = blitzrankPlayer.isPlaying;
            players.forEach(p => wasPlaying ? p.pause() : p.play());
            playPauseBtn.textContent = wasPlaying ? '▶' : '⏸';
            playPauseBtn.setAttribute('aria-label', wasPlaying ? 'Play' : 'Pause');
        });
    }

    if (stepBackBtn) {
        stepBackBtn.addEventListener('click', () => {
            players.forEach(p => p.stepBackward());
            if (playPauseBtn) playPauseBtn.textContent = '▶';
        });
    }

    if (stepForwardBtn) {
        stepForwardBtn.addEventListener('click', () => {
            players.forEach(p => p.stepForward());
            if (playPauseBtn) playPauseBtn.textContent = '▶';
        });
    }

    if (progressSlider) {
        progressSlider.addEventListener('input', (e) => {
            const frame = parseInt(e.target.value);
            players.forEach(p => p.goToFrame(frame));
            if (playPauseBtn) playPauseBtn.textContent = '▶';
        });
    }

    if (speedSelect) {
        speedSelect.addEventListener('change', (e) => {
            const speed = parseInt(e.target.value);
            players.forEach(p => p.setSpeed(speed));
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            players.forEach(p => p.reset());
            if (playPauseBtn) playPauseBtn.textContent = '▶';
        });
    }

    // Auto-play when visualization comes into view
    let hasAutoPlayed = false;
    const visualizationSection = document.getElementById('visualization');
    
    if (visualizationSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasAutoPlayed) {
                    // Start playing when section becomes visible
                    hasAutoPlayed = true;
                    players.forEach(p => p.play());
                    if (playPauseBtn) {
                        playPauseBtn.textContent = '⏸';
                        playPauseBtn.setAttribute('aria-label', 'Pause');
                    }
                }
            });
        }, {
            threshold: 0.3  // Trigger when 30% of the section is visible
        });
        
        observer.observe(visualizationSection);
    }
}

document.addEventListener('DOMContentLoaded', initAnimations);
