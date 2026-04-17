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
        
        // Typing speed configuration (ms per character) - MUCH SLOWER
        this.baseSpeed = 120;     // Base typing speed
        this.minSpeed = 80;       // Minimum speed for boilerplate (was 20)
        this.maxSpeed = 250;      // Maximum speed for "thinking" (was 150)
        
        // Human-like error configuration - LESS ERRORS NOW
        this.errorRate = 0.01;    // 1% chance of typo (was 8%)
        this.correctionChance = 0.7; // 70% chance to correct typo immediately (was 50%)
        
        // Thinking pauses
        this.thinkChance = 0.15;   // 15% chance to pause and "think"
        this.thinkDuration = 800; // How long to think (ms)
    }
    
    /**
     * Start typing the provided code
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
        
        // Type line by line for proper formatting
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            if (!this.isRunning) break;
            
            while (this.isPaused) {
                await this.sleep(100);
                if (!this.isRunning) break;
            }
            
            const line = lines[i];
            
            // Random thinking pause before some lines
            if (Math.random() < this.thinkChance && i > 0) {
                await this.sleep(this.thinkDuration + Math.random() * 1000);
            }
            
            // Type each character in the line
            await this.typeLineWithErrors(line);
            
            // Press Enter for new line (except last line)
            if (i < lines.length - 1) {
                await this.pressEnter();
            }
        }
        
        this.isRunning = false;
        
        if (onComplete) {
            onComplete();
        }
    }
    
    /**
     * Type a line with potential errors and corrections
     * Handles indentation (tabs/spaces) at the beginning of line
     */
    async typeLineWithErrors(line) {
        let i = 0;
        
        // Handle leading indentation - type tabs/spaces as-is (no errors)
        while (i < line.length && (line[i] === '\t' || line[i] === ' ')) {
            await this.typeChar(line[i]);
            i++;
        }
        
        // Type remaining content with potential errors
        while (i < line.length) {
            if (!this.isRunning) return;
            
            while (this.isPaused) {
                await this.sleep(100);
                if (!this.isRunning) return;
            }
            
            const char = line[i];
            
            // Check for typo (only for alphanumeric characters)
            if (Math.random() < this.errorRate && char.match(/[a-zA-Z0-9]/)) {
                // Generate wrong character
                const wrongChar = this.generateTypo(char);
                
                // Type the wrong character
                await this.typeChar(wrongChar);
                
                // Maybe correct it after a delay
                if (Math.random() < this.correctionChance) {
                    await this.sleep(this.baseSpeed * 2);
                    await this.backspace(1);
                    await this.typeChar(char);
                } else {
                    // If not correcting immediately, continue with wrong char
                    // But later realize and correct
                    if (Math.random() < 0.3) {
                        await this.sleep(this.baseSpeed * 3);
                        await this.backspace(1);
                        await this.typeChar(char);
                    }
                }
            } else {
                await this.typeChar(char);
            }
            
            i++;
        }
    }
    
    /**
     * Type a single character
     */
    async typeChar(char) {
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
        
        // Variable delay - human typing isn't consistent
        // Add some randomness to the speed
        const randomFactor = 0.5 + Math.random(); // 0.5 to 1.5
        const delay = this.baseSpeed * randomFactor;
        await this.sleep(delay);
    }
    
    /**
     * Press Enter to go to next line
     */
    async pressEnter() {
        const position = this.editor.getPosition();
        
        this.editor.executeEdits('autotyper', [{
            range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            },
            text: '\n'
        }]);
        
        // Move to next line, column 1
        this.editor.setPosition({
            lineNumber: position.lineNumber + 1,
            column: 1
        });
        
        // Small delay after enter
        await this.sleep(this.baseSpeed * 0.8);
    }
    
    /**
     * Simulate backspace - delete character before cursor
     */
    async backspace(count = 1) {
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
            
            // Backspace speed - usually faster than typing
            await this.sleep(60 + Math.random() * 40);
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