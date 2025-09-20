import sqlite3
import json
from datetime import datetime
from typing import Dict, Any, Optional

class UserDataHandler:
    def __init__(self, db_path: str = "user_data.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    data_type TEXT NOT NULL,
                    value REAL NOT NULL,
                    unit TEXT,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.execute('CREATE INDEX IF NOT EXISTS idx_user_data_type ON user_data(user_id, data_type)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_updated_at ON user_data(updated_at)')
    
    def process_backend_data(self, user_id: str, backend_response: Dict[str, Any]):
        data_mapping = {
            'leave_days': ('leave', 'days', '剩餘特休天數'),
            'meal_allowance': ('meal', 'ntd', '剩餘餐補'),
            'overtime_hours': ('overtime', 'hours', '加班時數'),
            'salary': ('salary', 'ntd', '薪水'),
            'next_bonus_date': ('bonus', 'date', '下次獎金發放時間')
        }
        
        updates = []
        for key, value in backend_response.items():
            if key in data_mapping and value is not None:
                data_type, unit, description = data_mapping[key]
                updates.append((user_id, data_type, value, unit, description))
        
        if updates:
            self.batch_update_data(updates)
            return len(updates)
        return 0
    
    def batch_update_data(self, updates: list):
        with sqlite3.connect(self.db_path) as conn:
            for user_id, data_type, value, unit, description in updates:
                conn.execute('''
                    INSERT OR REPLACE INTO user_data 
                    (user_id, data_type, value, unit, description, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (user_id, data_type, value, unit, description, datetime.now()))
    
    def get_user_data(self, user_id: str, data_type: Optional[str] = None) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            if data_type:
                cursor = conn.execute('''
                    SELECT * FROM user_data 
                    WHERE user_id = ? AND data_type = ?
                    ORDER BY updated_at DESC LIMIT 1
                ''', (user_id, data_type))
                row = cursor.fetchone()
                return dict(row) if row else {}
            else:
                cursor = conn.execute('''
                    SELECT data_type, value, unit, description, updated_at
                    FROM user_data
                    WHERE user_id = ?
                      AND updated_at = (
                        SELECT MAX(updated_at)
                        FROM user_data ud2
                        WHERE ud2.user_id = user_data.user_id AND ud2.data_type = user_data.data_type
                      )
                    ORDER BY data_type
                ''', (user_id,))
                
                result = {}
                for row in cursor.fetchall():
                    result[row['data_type']] = {
                        'value': row['value'],
                        'unit': row['unit'],
                        'description': row['description'],
                        'updated_at': row['updated_at']
                    }
                return result

if __name__ == "__main__":
    handler = UserDataHandler()
    
    backend_data = {
        'leave_days': 6.0,
        'meal_allowance': 100,
        'overtime_hours': 10,
        'salary': 28000,
        'next_bonus_date': '2025-09-20'
    }
    
    updated_count = handler.process_backend_data('user001', backend_data)
    print(f"更新了 {updated_count} 筆資料")
    
    user_info = handler.get_user_data('user001')
    print("使用者資料:")
    for data_type, info in user_info.items():
        print(f"  {info['description']}: {info['value']} {info['unit']}")
    
    leave_info = handler.get_user_data('user001', 'leave')
    print(f"\n特休資訊: {leave_info}")