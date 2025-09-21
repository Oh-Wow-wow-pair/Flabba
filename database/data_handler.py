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

    def _has_any_data(self, user_id: str) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute('SELECT 1 FROM user_data WHERE user_id = ? LIMIT 1', (user_id,))
            return cur.fetchone() is not None

    def seed_defaults(self, user_id: str) -> None:
        now = datetime.now()
        defaults = [
            ('leave_days',    15,  'days',  '剩餘特休天數'),
            ('meal_allowance',     100,  'ntd',   '剩餘餐補'),
            ('overtime_hours', 30,  'hours', '加班時數'),
            ('salary',   28000,  'ntd',   '薪水'),
            ('next_bonus_date',    '2025-09-22', 'date',  '下次獎金發放時間'),
        ]
        with sqlite3.connect(self.db_path) as conn:
            for data_type, value, unit, description in defaults:
                cur = conn.execute('''
                    UPDATE user_data
                       SET value = ?, unit = ?, description = ?, updated_at = ?
                     WHERE user_id = ? AND data_type = ?
                ''', (value, unit, description, now, user_id, data_type))
                if cur.rowcount == 0:
                    conn.execute('''
                        INSERT INTO user_data (user_id, data_type, value, unit, description, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (user_id, data_type, value, unit, description, now))

    def process_backend_data(self, user_id: str, backend_response: Dict[str, Any]):
        if not self._has_any_data(user_id):
            self.seed_defaults(user_id)

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
        now = datetime.now()
        with sqlite3.connect(self.db_path) as conn:
            for user_id, data_type, value, unit, description in updates:
                cur = conn.execute('''
                    UPDATE user_data
                       SET value = ?, unit = ?, description = ?, updated_at = ?
                     WHERE user_id = ? AND data_type = ?
                ''', (value, unit, description, now, user_id, data_type))
                if cur.rowcount == 0:
                    conn.execute('''
                        INSERT INTO user_data (user_id, data_type, value, unit, description, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (user_id, data_type, value, unit, description, now))

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
