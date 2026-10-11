ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS gender ENUM('Male', 'Female', 'Other', 'Not Specified') DEFAULT 'Not Specified';
ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS document_url MEDIUMTEXT;
