CREATE TABLE `AuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`actorUserId` text,
	`action` text NOT NULL,
	`entityType` text NOT NULL,
	`entityId` text NOT NULL,
	`metadataJson` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog` (`createdAt`);--> statement-breakpoint
CREATE TABLE `Evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`milestoneId` text,
	`uploadedById` text NOT NULL,
	`evidenceType` text NOT NULL,
	`category` text NOT NULL,
	`authoritative` integer DEFAULT false NOT NULL,
	`originalFilename` text NOT NULL,
	`storedFilename` text NOT NULL,
	`mimeType` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	`storagePath` text NOT NULL,
	`sha256Hash` text NOT NULL,
	`uploadedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestoneId`) REFERENCES `Milestone`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Evidence_projectId_idx` ON `Evidence` (`projectId`);--> statement-breakpoint
CREATE INDEX `Evidence_milestoneId_idx` ON `Evidence` (`milestoneId`);--> statement-breakpoint
CREATE TABLE `Milestone` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`name` text NOT NULL,
	`sequenceOrder` integer NOT NULL,
	`state` text DEFAULT 'Pending' NOT NULL,
	`validationCritical` integer DEFAULT false NOT NULL,
	`certifiedAt` integer,
	`certifiedById` text,
	`scopeType` text DEFAULT 'project_wide' NOT NULL,
	`scopeUnitCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`certifiedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Milestone_projectId_sequenceOrder_key` ON `Milestone` (`projectId`,`sequenceOrder`);--> statement-breakpoint
CREATE TABLE `ProjectMember` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`projectId` text NOT NULL,
	`membershipRole` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ProjectMember_userId_projectId_membershipRole_key` ON `ProjectMember` (`userId`,`projectId`,`membershipRole`);--> statement-breakpoint
CREATE TABLE `Project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`address` text,
	`city` text,
	`country` text,
	`latitude` real,
	`longitude` real,
	`totalUnits` integer DEFAULT 0 NOT NULL,
	`estimatedDelivery` integer,
	`status` text DEFAULT 'planning' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Project_slug_key` ON `Project` (`slug`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text NOT NULL,
	`role` text NOT NULL,
	`fullName` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_key` ON `User` (`email`);