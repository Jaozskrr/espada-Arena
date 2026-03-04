export class StackManager {
    static STORAGE_KEY = 'espada_arena_stacks';
    static MAX_STACKS = 20;

    static SCORES_KEY = 'espada_arena_scores';

    static getStacks() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? parseInt(data) : 0;
    }

    static recordScore(characterId, stacks) {
        const scores = this.getAllScores();
        if (!scores[characterId] || stacks > scores[characterId]) {
            scores[characterId] = stacks;
            localStorage.setItem(this.SCORES_KEY, JSON.stringify(scores));
        }
    }

    static getAllScores() {
        const data = localStorage.getItem(this.SCORES_KEY);
        return data ? JSON.parse(data) : { starrk: 0, ulquiorra: 0, grimmjow: 0 };
    }

    static addStack(characterId) {
        let current = this.getStacks();
        if (current < this.MAX_STACKS) {
            current++;
            localStorage.setItem(this.STORAGE_KEY, current.toString());
        }
        // Record as high score for this character
        this.recordScore(characterId, current);
        return current;
    }

    static getBonuses() {
        const stacks = this.getStacks();
        return {
            damage: 1 + (stacks * 0.02),      // +2% per stack
            movementSpeed: 1 + (stacks * 0.02), // +2% per stack
            cooldownReduction: stacks * 0.01  // -1% per stack
        };
    }

    static resetStacks() {
        localStorage.setItem(this.STORAGE_KEY, '0');
        localStorage.removeItem(this.SCORES_KEY);
    }
}
