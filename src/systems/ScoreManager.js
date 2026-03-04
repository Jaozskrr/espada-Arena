export class ScoreManager {
    static SCORES_KEY = 'espada_arena_match_scores';
    static WIN_POINTS = 5;
    static KILL_POINTS = 1;
    static RESURRECTION_THRESHOLD = 25;
    static MATCH_WIN_THRESHOLD = 50;

    static getAllScores() {
        const data = localStorage.getItem(this.SCORES_KEY);
        const defaultScores = {
            yammy: 0, starrk: 0, baraggan: 0, halibel: 0, ulquiorra: 0,
            nnoitra: 0, grimmjow: 0, zommari: 0, szayel: 0, aaroniero: 0
        };
        try {
            return data ? { ...defaultScores, ...JSON.parse(data) } : defaultScores;
        } catch (e) {
            return defaultScores;
        }
    }

    static getScore(characterId) {
        const scores = this.getAllScores();
        return scores[characterId] || 0;
    }

    static addPoints(characterId, points) {
        if (!characterId) return 0;
        const scores = this.getAllScores();
        scores[characterId] = (scores[characterId] || 0) + points;
        localStorage.setItem(this.SCORES_KEY, JSON.stringify(scores));
        return scores[characterId];
    }

    static canResurrect(characterId) {
        return this.getScore(characterId) >= this.RESURRECTION_THRESHOLD;
    }

    static checkMatchWinner() {
        const scores = this.getAllScores();
        for (const char in scores) {
            if (scores[char] >= this.MATCH_WIN_THRESHOLD) {
                return char;
            }
        }
        return null;
    }

    static resetMatch() {
        localStorage.removeItem(this.SCORES_KEY);
    }
}
