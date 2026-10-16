-- Presença operacional por passageiro e trecho. Horários em UTC; MySQL 5.7+.
CREATE TABLE IF NOT EXISTS bus_boarding_checkins (
    passenger_id BIGINT NOT NULL,
    leg ENUM('outbound', 'return') NOT NULL,
    present TINYINT(1) NOT NULL DEFAULT 0,
    checked_at DATETIME NULL COMMENT 'UTC',
    revision INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (passenger_id, leg),
    CONSTRAINT bus_boarding_passenger_fk FOREIGN KEY (passenger_id)
        REFERENCES bus_passengers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
