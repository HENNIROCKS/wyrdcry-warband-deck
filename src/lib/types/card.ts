/** Was eine Karte zeigt. Wird bei jedem Rendern aus Instanz und Stammdaten abgeleitet. */

import type { StatKey } from './warband';

export interface CardStat {
	key: StatKey;
	label: string;
	value: number;
	/** Weicht vom Profilwert ab – durch Override oder Ausrüstung. */
	modified: boolean;
}

export interface CardWeapon {
	name: string;
	range: string;
	attacks: string;
	/** Trefferwert und kritischer Wert, wie im Wiki: "2/4". */
	damage: string;
	rules: string[];
}

export interface CardItem {
	name: string;
	description: string;
}

export interface CardAbility {
	name: string;
	type: string;
	description: string;
	/** Aus den customAbilities der Bande, nicht aus den Stammdaten. */
	custom: boolean;
}

export interface FighterCardData {
	instanceId: string;
	name: string;
	subtitle: string;
	stats: CardStat[];
	weapons: CardWeapon[];
	items: CardItem[];
	abilities: CardAbility[];
	keywords: string[];
	notes: string;
	xp: number;
	renown: number;
	cost: number;
	isHero: boolean;
	/** Profil-ID ist unbekannt – die Stammdaten kennen diesen Kämpfer nicht. */
	unresolved: boolean;
}
