-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    date DATE NOT NULL,
    party_id INT NOT NULL,
    purchase_ledger_id INT NOT NULL,
    reference_no VARCHAR(100),
    order_ref VARCHAR(100),
    terms_of_delivery TEXT,
    expected_delivery_date DATE,
    narration TEXT,
    status ENUM('pending', 'confirmed', 'partially_received', 'completed', 'cancelled') DEFAULT 'pending',
    destination VARCHAR(255),
    dispatch_through VARCHAR(255),
    dispatch_doc_no VARCHAR(100),
    total_amount DECIMAL(15,2) DEFAULT 0.00,
    total_quantity DECIMAL(10,3) DEFAULT 0.000,
    created_by INT,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_number (order_number),
    INDEX idx_date (date),
    INDEX idx_party_id (party_id),
    INDEX idx_status (status),
    FOREIGN KEY (party_id) REFERENCES ledgers(id) ON DELETE RESTRICT,
    FOREIGN KEY (purchase_ledger_id) REFERENCES ledgers(id) ON DELETE RESTRICT
);

-- Purchase Order Items Table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    item_id INT NOT NULL,
    hsn_code VARCHAR(20),
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    unit VARCHAR(20),
    rate DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(15,2) DEFAULT 0.00,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    godown_id INT,
    received_quantity DECIMAL(10,3) DEFAULT 0.000,
    pending_quantity DECIMAL(10,3) DEFAULT 0.000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_purchase_order_id (purchase_order_id),
    INDEX idx_item_id (item_id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_party_date ON purchase_orders(party_id, date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_date ON purchase_orders(status, date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_item_order ON purchase_order_items(item_id, purchase_order_id);

-- Add trigger to update pending quantity
DELIMITER //

CREATE TRIGGER IF NOT EXISTS update_pending_quantity_after_insert
AFTER INSERT ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_order_items 
    SET pending_quantity = quantity - received_quantity 
    WHERE id = NEW.id;
END//

CREATE TRIGGER IF NOT EXISTS update_pending_quantity_after_update
AFTER UPDATE ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_order_items 
    SET pending_quantity = quantity - received_quantity 
    WHERE id = NEW.id;
END//

-- Add trigger to update total amount in purchase_orders
CREATE TRIGGER IF NOT EXISTS update_purchase_order_total_after_insert
AFTER INSERT ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_orders 
    SET 
        total_amount = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM purchase_order_items 
            WHERE purchase_order_id = NEW.purchase_order_id
        ),
        total_quantity = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM purchase_order_items 
            WHERE purchase_order_id = NEW.purchase_order_id
        )
    WHERE id = NEW.purchase_order_id;
END//

CREATE TRIGGER IF NOT EXISTS update_purchase_order_total_after_update
AFTER UPDATE ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_orders 
    SET 
        total_amount = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM purchase_order_items 
            WHERE purchase_order_id = NEW.purchase_order_id
        ),
        total_quantity = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM purchase_order_items 
            WHERE purchase_order_id = NEW.purchase_order_id
        )
    WHERE id = NEW.purchase_order_id;
END//

CREATE TRIGGER IF NOT EXISTS update_purchase_order_total_after_delete
AFTER DELETE ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_orders 
    SET 
        total_amount = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM purchase_order_items 
            WHERE purchase_order_id = OLD.purchase_order_id
        ),
        total_quantity = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM purchase_order_items 
            WHERE purchase_order_id = OLD.purchase_order_id
        )
    WHERE id = OLD.purchase_order_id;
END//

DELIMITER ;

-- Insert sample data (optional)
-- INSERT INTO purchase_orders (order_number, date, party_id, purchase_ledger_id, reference_no, narration, status)
-- VALUES 
-- ('PO001', '2024-01-15', 1, 11, 'REF001', 'Sample Purchase Order', 'pending'),
-- ('PO002', '2024-01-16', 2, 12, 'REF002', 'Computer Hardware Order', 'confirmed'),
-- ('PO003', '2024-01-17', 3, 13, 'REF003', 'Office Equipment Order', 'pending');
