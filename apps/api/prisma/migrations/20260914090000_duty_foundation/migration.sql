-- Preserve the original migration and add data-quality rules required by duty resolution.
ALTER TABLE `DutyPeriod`
  ADD CONSTRAINT `DutyPeriod_endsAt_after_startsAt` CHECK (`endsAt` > `startsAt`);

ALTER TABLE `ScheduleSource`
  ADD COLUMN `observedAt` DATETIME(3) NULL;

UPDATE `ScheduleSource`
  SET `observedAt` = `updatedAt`
  WHERE `observedAt` IS NULL;

ALTER TABLE `ScheduleSource`
  MODIFY `observedAt` DATETIME(3) NOT NULL;

CREATE TABLE `DutyException` (
    `id` CHAR(36) NOT NULL,
    `dutyPeriodId` CHAR(36) NOT NULL,
    `kind` ENUM('CANCELLED', 'UNAVAILABLE') NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DutyException_dutyPeriodId_startsAt_endsAt_idx`(`dutyPeriodId`, `startsAt`, `endsAt`),
    CONSTRAINT `DutyException_endsAt_after_startsAt` CHECK (`endsAt` > `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DutyException`
  ADD CONSTRAINT `DutyException_dutyPeriodId_fkey`
  FOREIGN KEY (`dutyPeriodId`) REFERENCES `DutyPeriod`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
