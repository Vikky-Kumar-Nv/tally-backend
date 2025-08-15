-- Add CIN number column to tbcompanies table
-- Run this SQL script in your MySQL database to add the CIN number field

USE dbEnegix;

-- Add cin_number column to tbcompanies table
ALTER TABLE tbcompanies 
ADD COLUMN cin_number VARCHAR(21) NULL 
COMMENT 'Corporate Identification Number' 
AFTER vat_number;

-- Optional: Create an index for faster searching
-- CREATE INDEX idx_cin_number ON tbcompanies(cin_number);

-- Verify the column was added
-- DESCRIBE tbcompanies;
