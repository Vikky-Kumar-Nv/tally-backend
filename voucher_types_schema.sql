-- Voucher Types Table Schema
-- This table stores voucher type configurations matching Tally 7.2 functionality

CREATE TABLE IF NOT EXISTS `voucher_types` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `type` ENUM(
    'payment', 
    'receipt', 
    'contra', 
    'journal', 
    'sales', 
    'purchase', 
    'credit-note', 
    'debit-note', 
    'delivery-note', 
    'sales-order', 
    'purchase-order', 
    'quotation', 
    'stock-journal',
    'manufacturing-journal',
    'physical-stock',
    'stock-transfer',
    'memorandum',
    'rejection-out',
    'rejection-in'
  ) NOT NULL,
  `abbreviation` VARCHAR(4) NOT NULL UNIQUE,
  `numbering_method` ENUM('automatic', 'manual') NOT NULL DEFAULT 'automatic',
  `use_common_narration` BOOLEAN DEFAULT FALSE,
  `print_after_saving` BOOLEAN DEFAULT FALSE,
  `use_effective_dates` BOOLEAN DEFAULT FALSE,
  `make_optional_default` BOOLEAN DEFAULT FALSE,
  `restart_numbering_applicable` BOOLEAN DEFAULT FALSE,
  `restart_numbering_starting_number` INT DEFAULT 1,
  `restart_numbering_particulars` VARCHAR(255) DEFAULT '',
  `prefix_details_applicable` BOOLEAN DEFAULT FALSE,
  `prefix_details_particulars` VARCHAR(255) DEFAULT '',
  `suffix_details_applicable` BOOLEAN DEFAULT FALSE,
  `suffix_details_particulars` VARCHAR(255) DEFAULT '',
  `narrations_for_each_entry` BOOLEAN DEFAULT TRUE,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_type` (`type`),
  INDEX `idx_active` (`is_active`),
  INDEX `idx_abbreviation` (`abbreviation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default voucher types based on Tally 7.2 standards
INSERT INTO `voucher_types` (
  `id`,
  `name`,
  `type`,
  `abbreviation`,
  `numbering_method`,
  `use_common_narration`,
  `print_after_saving`,
  `use_effective_dates`,
  `make_optional_default`,
  `restart_numbering_applicable`,
  `restart_numbering_starting_number`,
  `restart_numbering_particulars`,
  `prefix_details_applicable`,
  `prefix_details_particulars`,
  `suffix_details_applicable`,
  `suffix_details_particulars`,
  `narrations_for_each_entry`,
  `is_active`,
  `created_at`,
  `updated_at`
) VALUES
-- Payment Vouchers
(
  UUID(),
  'Payment',
  'payment',
  'PAY',
  'automatic',
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  FALSE,
  '',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
),

-- Receipt Vouchers
(
  UUID(),
  'Receipt',
  'receipt',
  'REC',
  'automatic',
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  FALSE,
  '',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
),

-- Contra Vouchers
(
  UUID(),
  'Contra',
  'contra',
  'CON',
  'automatic',
  TRUE,
  FALSE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  FALSE,
  '',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
),

-- Journal Vouchers
(
  UUID(),
  'Journal',
  'journal',
  'JOU',
  'automatic',
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  FALSE,
  '',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
),

-- Sales Vouchers
(
  UUID(),
  'Sales',
  'sales',
  'SAL',
  'automatic',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  TRUE,
  'INV',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
),

-- Purchase Vouchers
(
  UUID(),
  'Purchase',
  'purchase',
  'PUR',
  'automatic',
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  FALSE,
  '',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
),

-- Credit Note
(
  UUID(),
  'Credit Note',
  'credit-note',
  'CRN',
  'automatic',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  TRUE,
  'CN',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
),

-- Debit Note
(
  UUID(),
  'Debit Note',
  'debit-note',
  'DBN',
  'automatic',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  1,
  'Financial Year',
  TRUE,
  'DN',
  FALSE,
  '',
  TRUE,
  TRUE,
  NOW(),
  NOW()
);

-- Add foreign key constraint to vouchers table (if it exists)
-- This ensures data integrity between vouchers and voucher types
-- ALTER TABLE vouchers ADD CONSTRAINT fk_voucher_type 
-- FOREIGN KEY (voucher_type_id) REFERENCES voucher_types(id) 
-- ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create index on vouchers table for performance (if vouchers table exists)
-- CREATE INDEX idx_vouchers_type ON vouchers(voucher_type_id);
