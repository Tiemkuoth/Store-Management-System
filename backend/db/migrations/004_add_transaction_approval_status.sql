ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS status ENUM('Pending Approval', 'Approved', 'Rejected') DEFAULT 'Approved',
  ADD COLUMN IF NOT EXISTS approval_remarks TEXT,
  ADD COLUMN IF NOT EXISTS approved_at DATETIME;
