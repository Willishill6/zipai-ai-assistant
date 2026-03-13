CREATE TABLE `analysis_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`screenshotUrl` text,
	`handTiles` json,
	`exposedTiles` json,
	`opponentDiscards` json,
	`currentHuxi` int DEFAULT 0,
	`ghostCards` json,
	`remainingTiles` int,
	`aiSuggestion` text,
	`recommendedAction` varchar(32),
	`recommendedTile` varchar(16),
	`analysisReasoning` text,
	`rawLlmResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalGames` int DEFAULT 0,
	`gamesWon` int DEFAULT 0,
	`totalHuxi` int DEFAULT 0,
	`avgHuxi` float DEFAULT 0,
	`commonMistake` text,
	`winRate` float DEFAULT 0,
	`streakData` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gameState` json,
	`moveHistory` json,
	`result` varchar(16) DEFAULT 'ongoing',
	`finalHuxi` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `practice_sessions_id` PRIMARY KEY(`id`)
);
