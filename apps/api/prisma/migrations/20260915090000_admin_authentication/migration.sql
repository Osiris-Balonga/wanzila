-- Persist opaque administrator sessions. Only SHA-256 token digests are stored.
CREATE TABLE `AdminSession` (
    `id` CHAR(36) NOT NULL,
    `adminUserId` CHAR(36) NOT NULL,
    `tokenDigest` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminSession_tokenDigest_key`(`tokenDigest`),
    INDEX `AdminSession_adminUserId_expiresAt_idx`(`adminUserId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AdminSession`
  ADD CONSTRAINT `AdminSession_adminUserId_fkey`
  FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
