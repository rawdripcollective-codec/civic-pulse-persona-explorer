CREATE TABLE `simulationHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionKey` varchar(96) NOT NULL,
	`question` text NOT NULL,
	`filters` json NOT NULL,
	`results` json NOT NULL,
	`sentiment` json NOT NULL,
	`personaCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simulationHistory_id` PRIMARY KEY(`id`)
);
