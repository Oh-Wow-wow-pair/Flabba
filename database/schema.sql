CREATE TABLE user_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    data_type TEXT NOT NULL, -- 'leave', 'meal', 'overtime', 'salary', 'bonus'
    value REAL NOT NULL,     -- 數值
    unit TEXT,               -- 'days', 'ntd', 'hours', 'date'
    description TEXT,        
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_data_type ON user_data(user_id, data_type);
CREATE INDEX idx_updated_at ON user_data(updated_at);

INSERT INTO user_data (user_id, data_type, value, unit, description) VALUES 
('user001', 'leave', 12.5, 'days', '剩餘特休天數'),
('user001', 'meal', 1500, 'ntd', '剩餘餐補'),
('user001', 'overtime', 25.5, 'hours', '累積加班時數'),
('user001', 'salary', 50000, 'ntd', '月薪'),
('user001', 'bonus', 20251215, 'date', '下次獎金發放時間');

SELECT * FROM user_data WHERE user_id = 'user001' ORDER BY updated_at DESC;

SELECT * FROM user_data 
WHERE user_id = 'user001' AND data_type = 'leave' 
ORDER BY updated_at DESC LIMIT 1;