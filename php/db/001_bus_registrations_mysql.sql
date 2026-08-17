-- =============================================================================
-- Kriativos OnBoard 2026 — schema MySQL do ônibus fretado
-- Porte de: server/db/001_bus_registrations.sql (PostgreSQL, fonte da verdade)
-- Compatível com MySQL 5.7 e MySQL 8.0 (InnoDB / utf8mb4).
--
-- COMO EXECUTAR
--   Seção A (tabelas + índices): pode ser executada por qualquer cliente,
--   inclusive PDO::exec() statement por statement.
--   Seção B (triggers): usa DELIMITER, que é um comando do CLIENTE mysql
--   (e do phpMyAdmin), NÃO do servidor. Execute a Seção B pelo cliente
--   `mysql` ou phpMyAdmin. Se precisar rodar via PHP/PDO, envie cada
--   CREATE TRIGGER como uma query única SEM as linhas DELIMITER.
--
-- CONVENÇÃO DE FUSO HORÁRIO
--   MySQL não possui tipo equivalente a TIMESTAMPTZ. Todas as colunas
--   DATETIME deste schema armazenam **UTC**. A aplicação PHP DEVE gravar e
--   ler em UTC (ex.: gmdate('Y-m-d H:i:s') / new DateTime('now', new
--   DateTimeZone('UTC'))) e converter para America/Sao_Paulo só na
--   apresentação. DEFAULT CURRENT_TIMESTAMP grava no time_zone da sessão,
--   então recomenda-se executar `SET time_zone = '+00:00';` na conexão.
-- =============================================================================

SET NAMES utf8mb4;
SET SQL_MODE = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- =============================================================================
-- SEÇÃO A — TABELAS E ÍNDICES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- bus_registrations
--   PG UUID              -> CHAR(36)  (UUID v4 gerado em PHP)
--   PG TEXT              -> VARCHAR(n) (TEXT no MySQL não aceita DEFAULT nem
--                            UNIQUE sem prefixo de índice)
--   PG TIMESTAMPTZ       -> DATETIME em UTC (ver nota acima)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_registrations (
  id                     CHAR(36)        NOT NULL,
  event_slug             VARCHAR(64)     NOT NULL DEFAULT 'kriativos-onboard-2026',
  external_reference     VARCHAR(191)    NOT NULL,
  primary_name           VARCHAR(255)    NOT NULL,
  primary_cpf            VARCHAR(14)     NOT NULL,
  email                  VARCHAR(255)    NOT NULL,
  whatsapp               VARCHAR(32)     NOT NULL,
  passenger_count        INT             NOT NULL,
  children_count         INT             NOT NULL DEFAULT 0,
  amount_cents           INT             NOT NULL,
  currency               CHAR(3)         NOT NULL DEFAULT 'BRL',
  -- ENUM em vez de TEXT + CHECK: o ENUM é aplicado tanto no 5.7 quanto no 8.0.
  status                 ENUM(
                           'payment_pending',
                           'paid_awaiting_proof',
                           'confirmed',
                           'payment_failed',
                           'cancelled',
                           'refunded'
                         )              NOT NULL DEFAULT 'payment_pending',
  status_detail          TEXT            NULL,
  mercadopago_order_id   VARCHAR(191)    NULL,
  mercadopago_payment_id VARCHAR(191)    NULL,
  paid_at                DATETIME        NULL COMMENT 'UTC',
  -- Ultima vez que consultamos o Mercado Pago para reconciliar este cadastro.
  -- Existe para limitar a frequencia: a pagina faz polling a cada 5s e sem
  -- isso cada consulta viraria uma chamada ao provedor.
  -- Idempotencia do e-mail de confirmacao: reentrega de webhook nao pode gerar
  -- um segundo e-mail para a mesma reserva.
  confirmation_email_sent_at DATETIME NULL COMMENT 'UTC',
  reconciled_at          DATETIME        NULL COMMENT 'UTC',
  created_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC',
  updated_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC',

  PRIMARY KEY (id),
  UNIQUE KEY bus_registrations_external_reference_key (external_reference),
  -- UNIQUE no MySQL permite múltiplos NULL — comportamento desejado aqui,
  -- idêntico ao PostgreSQL.
  UNIQUE KEY bus_registrations_mercadopago_order_id_key (mercadopago_order_id),
  UNIQUE KEY bus_registrations_mercadopago_payment_id_key (mercadopago_payment_id),
  KEY bus_registrations_status_idx (status),
  -- PG usa (created_at DESC). O MySQL 5.7 aceita a palavra DESC mas a ignora;
  -- índice B-tree é percorrível em ordem reversa, então o índice ASC atende
  -- ORDER BY created_at DESC nas duas versões.
  KEY bus_registrations_created_at_idx (created_at),

  -- CHECKs: APLICADOS a partir do MySQL 8.0.16. No 5.7 são apenas parseados e
  -- IGNORADOS silenciosamente -> as mesmas regras estão nos triggers da Seção B.
  CONSTRAINT bus_registrations_passenger_count_chk
    CHECK (passenger_count BETWEEN 1 AND 100),
  CONSTRAINT bus_registrations_children_count_chk
    CHECK (children_count >= 0 AND children_count <= passenger_count),
  CONSTRAINT bus_registrations_amount_cents_chk
    CHECK (amount_cents >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- bus_passengers
--   PG BIGINT GENERATED ALWAYS AS IDENTITY -> BIGINT AUTO_INCREMENT
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_passengers (
  id              BIGINT           NOT NULL AUTO_INCREMENT,
  registration_id CHAR(36)         NOT NULL,
  -- `position` e nome de funcao no MySQL; sempre entre backticks no SQL.
  -- O NOME DA COLUNA permanece exatamente "position" (igual ao PostgreSQL).
  `position`      SMALLINT         NOT NULL,
  full_name       VARCHAR(255)     NOT NULL,
  cpf             VARCHAR(14)      NOT NULL,
  -- Opcional: so o contato principal tem WhatsApp obrigatorio. Aqui serve para a
  -- organizacao falar direto com quem embarca, quando a pessoa quiser informar.
  whatsapp        VARCHAR(11)      NULL,
  is_primary      TINYINT(1)       NOT NULL DEFAULT 0,
  created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC',

  PRIMARY KEY (id),
  UNIQUE KEY bus_passengers_registration_position_key (registration_id, `position`),
  UNIQUE KEY bus_passengers_registration_cpf_key (registration_id, cpf),
  KEY bus_passengers_cpf_idx (cpf),
  CONSTRAINT bus_passengers_registration_id_fkey
    FOREIGN KEY (registration_id) REFERENCES bus_registrations (id)
    ON DELETE CASCADE,

  -- Aplicado só no 8.0.16+ — reforçado por trigger na Seção B.
  CONSTRAINT bus_passengers_position_chk CHECK (`position` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- bus_payment_proofs
--   PG BYTEA -> MEDIUMBLOB (até 16 MiB).
--   NÃO usar BLOB: o limite é 65_535 bytes (64 KiB) e o MySQL TRUNCA
--   silenciosamente fora do modo estrito. O comprovante pode ter até
--   2_097_152 bytes (2 MiB), logo MEDIUMBLOB é o tipo mínimo correto.
--   Atenção operacional: max_allowed_packet deve ser > 2 MiB (recomendado 8M+),
--   senão o INSERT falha com "Packet too large".
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_payment_proofs (
  id              CHAR(36)     NOT NULL,
  registration_id CHAR(36)     NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  -- ENUM em vez de TEXT + CHECK: aplicado no 5.7 e no 8.0.
  mime_type       ENUM(
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'application/pdf'
                  )            NOT NULL,
  file_size       INT          NOT NULL,
  sha256          CHAR(64)     NOT NULL,
  file_data       MEDIUMBLOB   NOT NULL,
  uploaded_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC',

  PRIMARY KEY (id),
  UNIQUE KEY bus_payment_proofs_registration_id_key (registration_id),
  CONSTRAINT bus_payment_proofs_registration_id_fkey
    FOREIGN KEY (registration_id) REFERENCES bus_registrations (id)
    ON DELETE CASCADE,

  -- Aplicado só no 8.0.16+ — reforçado por trigger na Seção B.
  CONSTRAINT bus_payment_proofs_file_size_chk
    CHECK (file_size BETWEEN 1 AND 2097152)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SEÇÃO B — TRIGGERS DE VALIDAÇÃO (compatibilidade com MySQL 5.7)
--
-- POR QUE ISSO EXISTE:
--   No MySQL 5.7 a cláusula CHECK é aceita pelo parser e DESCARTADA pelo
--   servidor, sem erro e sem aviso. Ou seja, as regras de negócio da Seção A
--   NÃO valem nada no 5.7. Os triggers abaixo reimplementam exatamente as
--   mesmas regras via SIGNAL SQLSTATE '45000', funcionando nas duas versões.
--   No 8.0.16+ eles são redundantes com os CHECKs (a validação simplesmente
--   ocorre duas vezes) — mantê-los é seguro e desejável.
--
-- Regras cobertas:
--   bus_registrations : passenger_count 1..100
--                       children_count 0..passenger_count (criancas <= pagantes)
--                       amount_cents >= 0
--   bus_passengers    : position >= 1
--   bus_payment_proofs: file_size 1..2097152
--                       coerência entre file_size e LENGTH(file_data)
--
-- status e mime_type NÃO precisam de trigger: são ENUM, aplicados no 5.7 e 8.0.
-- (Ainda assim há uma checagem defensiva de status, pois em SQL_MODE não
--  estrito um valor inválido de ENUM é convertido para '' com warning.)
--
-- Requer o cliente mysql/phpMyAdmin por causa do DELIMITER. Ver cabeçalho.
-- =============================================================================

DROP TRIGGER IF EXISTS bus_registrations_bi;
DROP TRIGGER IF EXISTS bus_registrations_bu;
DROP TRIGGER IF EXISTS bus_passengers_bi;
DROP TRIGGER IF EXISTS bus_passengers_bu;
DROP TRIGGER IF EXISTS bus_payment_proofs_bi;
DROP TRIGGER IF EXISTS bus_payment_proofs_bu;

DELIMITER $$

-- --- bus_registrations -------------------------------------------------------
CREATE TRIGGER bus_registrations_bi
BEFORE INSERT ON bus_registrations
FOR EACH ROW
BEGIN
  IF NEW.passenger_count < 1 OR NEW.passenger_count > 100 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: passenger_count deve estar entre 1 e 100';
  END IF;

  IF NEW.children_count < 0 OR NEW.children_count > NEW.passenger_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: children_count nao pode passar de passenger_count (cada crianca vai no colo de um pagante)';
  END IF;

  IF NEW.amount_cents < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: amount_cents nao pode ser negativo';
  END IF;

  IF NEW.status NOT IN ('payment_pending','paid_awaiting_proof','confirmed',
                        'payment_failed','cancelled','refunded') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: status invalido';
  END IF;
END$$

CREATE TRIGGER bus_registrations_bu
BEFORE UPDATE ON bus_registrations
FOR EACH ROW
BEGIN
  IF NEW.passenger_count < 1 OR NEW.passenger_count > 100 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: passenger_count deve estar entre 1 e 100';
  END IF;

  IF NEW.children_count < 0 OR NEW.children_count > NEW.passenger_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: children_count nao pode passar de passenger_count (cada crianca vai no colo de um pagante)';
  END IF;

  IF NEW.amount_cents < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: amount_cents nao pode ser negativo';
  END IF;

  IF NEW.status NOT IN ('payment_pending','paid_awaiting_proof','confirmed',
                        'payment_failed','cancelled','refunded') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: status invalido';
  END IF;
END$$

-- --- bus_passengers ----------------------------------------------------------
CREATE TRIGGER bus_passengers_bi
BEFORE INSERT ON bus_passengers
FOR EACH ROW
BEGIN
  IF NEW.`position` < 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_passengers: position deve ser >= 1';
  END IF;
END$$

CREATE TRIGGER bus_passengers_bu
BEFORE UPDATE ON bus_passengers
FOR EACH ROW
BEGIN
  IF NEW.`position` < 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_passengers: position deve ser >= 1';
  END IF;
END$$

-- --- bus_payment_proofs ------------------------------------------------------
CREATE TRIGGER bus_payment_proofs_bi
BEFORE INSERT ON bus_payment_proofs
FOR EACH ROW
BEGIN
  IF NEW.file_size < 1 OR NEW.file_size > 2097152 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_payment_proofs: file_size deve estar entre 1 e 2097152 bytes (2 MiB)';
  END IF;

  IF NEW.mime_type NOT IN ('image/jpeg','image/png','image/webp','application/pdf') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_payment_proofs: mime_type invalido';
  END IF;

  -- Guarda extra contra truncamento silencioso do BLOB: se o tamanho gravado
  -- nao bate com o declarado, aborta em vez de aceitar um comprovante corrompido.
  IF LENGTH(NEW.file_data) <> NEW.file_size THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_payment_proofs: file_size difere de LENGTH(file_data) — possivel truncamento no upload';
  END IF;
END$$

CREATE TRIGGER bus_payment_proofs_bu
BEFORE UPDATE ON bus_payment_proofs
FOR EACH ROW
BEGIN
  IF NEW.file_size < 1 OR NEW.file_size > 2097152 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_payment_proofs: file_size deve estar entre 1 e 2097152 bytes (2 MiB)';
  END IF;

  IF NEW.mime_type NOT IN ('image/jpeg','image/png','image/webp','application/pdf') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_payment_proofs: mime_type invalido';
  END IF;

  IF LENGTH(NEW.file_data) <> NEW.file_size THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_payment_proofs: file_size difere de LENGTH(file_data) — possivel truncamento no upload';
  END IF;
END$$

DELIMITER ;

-- =============================================================================
-- FIM
-- =============================================================================
