/**
 * AutoTyper - Simulates human typing patterns for code input
 * Implements incremental typing with realistic delays and occasional corrections
 */

class AutoTyper {
    constructor(editor) {
        this.editor = editor;
        this.isRunning = false;
        this.isPaused = false;
        this.currentPosition = 0;
        this.code = '';
        
        // Typing speed configuration (ms per character)
        this.baseSpeed = 50;      // Base typing speed
        this.minSpeed = 20;      // Minimum speed for boilerplate
        this.maxSpeed = 150;     // Maximum speed for "thinking"
        
        // Human-like error configuration
        this.errorRate = 0.02;   // 2% chance of typo
        this.correctionChance = 0.3; // 30% chance to correct typo immediately
    }
    
    /**
     * Start typing the provided code
     * @param {string} code - The code to type
     * @param {Function} onComplete - Callback when typing is complete
     */
    async start(code, onComplete = null) {
        if (this.isRunning) {
            console.warn('AutoTyper is already running');
            return;
        }
        
        this.code = code;
        this.isRunning = true;
        this.currentPosition = 0;
        
        // Clear the editor first
        this.editor.setValue('');
        
        // Parse code into segments for different typing speeds
        const segments = this.parseSegments(code);
        
        // Type each segment
        for (const segment of segments) {
            if (!this.isRunning) break;
            
            while (this.isPaused) {
                await this.sleep(100);
                if (!this.isRunning) break;
            }
            
            await this.typeSegment(segment.text, segment.speed);
        }
        
        this.isRunning = false;
        
        if (onComplete) {
            onComplete();
        }
    }
    
    /**
     * Parse code into segments with different speed requirements
     */
    parseSegments(code) {
        const segments = [];
        const lines = code.split('\n');
        
        let currentSegment = '';
        let currentSpeed = this.baseSpeed;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Determine speed based on line content
            let speed = this.baseSpeed;
            
            // Boilerplate lines - faster
            if (trimmed.startsWith('#include') || 
                trimmed.startsWith('using') ||
                trimmed.startsWith('const') ||
                trimmed.startsWith('int main') ||
                trimmed === '}' ||
                trimmed === '{' ||
                trimmed === '' ||
                trimmed.startsWith('return')) {
                speed = this.minSpeed;
            }
            // Core logic - slower (thinking)
            else if (trimmed.includes('if') || 
                     trimmed.includes('for') || 
                     trimmed.includes('while') ||
                     trimmed.includes('update') ||
                     trimmed.includes('get') ||
                     trimmed.includes('query')) {
                speed = this.maxSpeed;
            }
            
            // If speed changed, push previous segment and start new one
            if (speed !== currentSpeed && currentSegment.length > 0) {
                segments.push({ text: currentSegment + '\n', speed: currentSpeed });
                currentSegment = '';
            } else {
                currentSegment += (currentSegment ? '\n' : '') + line;
            }
            
            currentSpeed = speed;
        }
        
        // Push remaining segment
        if (currentSegment) {
            segments.push({ text: currentSegment, speed: currentSpeed });
        }
        
        return segments;
    }
    
    /**
     * Type a segment of text with potential errors
     */
    async typeSegment(text, speed) {
        for (let i = 0; i < text.length; i++) {
            if (!this.isRunning) return;
            
            while (this.isPaused) {
                await this.sleep(100);
                if (!this.isRunning) return;
            }
            
            const char = text[i];
            
            // Random chance of error
            if (Math.random() < this.errorRate && char.match(/[a-zA-Z0-9]/)) {
                // Generate a wrong character (nearby on keyboard)
                const wrongChar = this.generateTypo(char);
                await this.typeChar(wrongChar, speed);
                
                // Maybe correct it immediately
                if (Math.random() < this.correctionChance) {
                    await this.sleep(speed * 2);
                    // Backspace
                    await this.backspace(1, speed / 2);
                    // Type correct char
                    await this.typeChar(char, speed);
                }
            } else {
                await this.typeChar(char, speed);
            }
        }
    }
    
    /**
     * Type a single character
     */
    async typeChar(char, speed) {
        const currentContent = this.editor.getValue();
        const position = this.editor.getPosition();
        
        // Insert character at current cursor position
        this.editor.executeEdits('autotyper', [{
            range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            },
            text: char
        }]);
        
        // Move cursor forward
        this.editor.setPosition({
            lineNumber: position.lineNumber,
            column: position.column + 1
        });
        
        // Variable delay to simulate natural typing rhythm
        const delay = speed * (0.8 + Math.random() * 0.4);
        await this.sleep(delay);
    }
    
    /**
     * Simulate backspace
     */
    async backspace(count = 1, speed = 25) {
        for (let i = 0; i < count; i++) {
            if (!this.isRunning) return;
            
            const position = this.editor.getPosition();
            
            if (position.column > 1) {
                // Delete character before cursor
                this.editor.executeEdits('autotyper', [{
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column - 1,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    },
                    text: ''
                }]);
                
                // Move cursor back
                this.editor.setPosition({
                    lineNumber: position.lineNumber,
                    column: position.column - 1
                });
            } else if (position.lineNumber > 1) {
                // Move to end of previous line
                const lineContent = this.editor.getModel().getLineContent(position.lineNumber - 1);
                this.editor.setPosition({
                    lineNumber: position.lineNumber - 1,
                    column: lineContent.length + 1
                });
            }
            
            await this.sleep(speed);
        }
    }
    
    /**
     * Generate a typo character (nearby on keyboard)
     */
    generateTypo(char) {
        const keyboardRows = [
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm'
        ];
        
        for (let row of keyboardRows) {
            const idx = row.indexOf(char.toLowerCase());
            if (idx !== -1) {
                // Randomly pick adjacent key
                const nearby = [];
                if (idx > 0) nearby.push(row[idx - 1]);
                if (idx < row.length - 1) nearby.push(row[idx + 1]);
                if (nearby.length > 0) {
                    return nearby[Math.floor(Math.random() * nearby.length)];
                }
            }
        }
        
        // If not found on keyboard, just return a random nearby ASCII
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        return chars[Math.floor(Math.random() * chars.length)];
    }
    
    /**
     * Pause typing
     */
    pause() {
        this.isPaused = true;
    }
    
    /**
     * Resume typing
     */
    resume() {
        this.isPaused = false;
    }
    
    /**
     * Stop typing
     */
    stop() {
        this.isRunning = false;
        this.isPaused = false;
    }
    
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default AutoTyper;