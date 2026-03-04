export class AchievementManager {
    static KEY = 'espada_arena_achievements';

    static getAchievements() {
        const data = localStorage.getItem(this.KEY);
        const defaults = {
            winMatch: 0,
            kills: 0,
            useResurrection: 0
        };
        try {
            return data ? { ...defaults, ...JSON.parse(data) } : defaults;
        } catch (e) {
            return defaults;
        }
    }

    static recordWin() {
        const ach = this.getAchievements();
        ach.winMatch = 1;
        this.save(ach);
    }

    static recordKill() {
        const ach = this.getAchievements();
        ach.kills = Math.min(5, (ach.kills || 0) + 1);
        this.save(ach);
    }

    static recordResurrection() {
        const ach = this.getAchievements();
        ach.useResurrection = 1;
        this.save(ach);
    }

    static save(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    }
}
