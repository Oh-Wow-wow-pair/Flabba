# 🗄️ 使用者資料管理系統

黃巴的資料庫模組，提供使用者資料的存儲、查詢和管理功能，包含 SQLite 資料庫操作和 Flask API 服務。

## 開始

### 1. 安裝依賴

```bash
pip install -r requirements.txt
```

### 2. 啟動 API 服務

```bash
python api_server.py
```

### 3. 測試 API

```bash
python test_api.py
```

或使用 curl：
```bash
curl http://localhost:5000/health
```

## 🗄️ 資料庫操作

### UserDataHandler 類別

核心資料處理類別，負責所有資料庫操作：

```python
from data_handler import UserDataHandler

# 初始化
handler = UserDataHandler("user_data.db")
```

### 支援的資料類型

| 後端欄位 | 資料類型 | 單位 | 說明 |
|---------|---------|------|------|
| `leave_days` | `leave` | `days` | 剩餘特休天數 |
| `meal_allowance` | `meal` | `ntd` | 剩餘餐補金額 |
| `overtime_hours` | `overtime` | `hours` | 累計加班時數 |
| `salary` | `salary` | `ntd` | 月薪 |
| `next_bonus_date` | `bonus` | `date` | 下次獎金發放日期 |

### 基本操作

```python
# 更新使用者資料
data = {
    'leave_days': 12.5,
    'meal_allowance': 1500,
    'overtime_hours': 25.0
}
updated_count = handler.process_backend_data('user001', data)

# 查詢所有資料
user_data = handler.get_user_data('user001')

# 查詢特定類型資料
leave_info = handler.get_user_data('user001', 'leave')
```

## API

### 啟動服務器

```bash
python api_server.py
```

服務器將在 `http://localhost:5000` 啟動

### API 端點

#### 🔍 健康檢查
```http
GET /health
```

#### 📝 更新使用者資料
```http
POST /api/users/{user_id}/data
Content-Type: application/json

{
    "leave_days": 12.5,
    "meal_allowance": 1500,
    "overtime_hours": 25.0,
    "salary": 50000,
    "next_bonus_date": "2025-12-15"
}
```

#### 📊 獲取使用者資料
```http
GET /api/users/{user_id}/data           # 所有資料
GET /api/users/{user_id}/data/{type}    # 特定類型資料
```

#### 🔄 批量更新
```http
POST /api/users/batch
Content-Type: application/json

{
    "user001": {"leave_days": 10, "salary": 50000},
    "user002": {"meal_allowance": 2000}
}
```

### API 回應格式

#### 成功回應
```json
{
    "success": true,
    "user_id": "user001",
    "updated_count": 3,
    "data": {
        "leave": {
            "value": 12.5,
            "unit": "days",
            "description": "剩餘特休天數",
            "updated_at": "2025-09-20 14:30:00"
        }
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

#### 錯誤回應
```json
{
    "success": false,
    "error": "User ID is required",
    "timestamp": "2025-09-20T14:30:00"
}
```

## 💻 使用範例

### Python 客戶端

```python
import requests

# 更新資料
response = requests.post(
    'http://localhost:5000/api/users/user001/data',
    json={
        'leave_days': 15.0,
        'meal_allowance': 2000
    }
)
print(response.json())

# 查詢資料
response = requests.get('http://localhost:5000/api/users/user001/data')
data = response.json()['data']
```

### curl 指令

```bash
# 更新資料
curl -X POST http://localhost:5000/api/users/user001/data \
  -H "Content-Type: application/json" \
  -d '{"leave_days": 15.0, "meal_allowance": 2000}'

# 查詢資料
curl http://localhost:5000/api/users/user001/data

# 查詢特定資料
curl http://localhost:5000/api/users/user001/data/leave
```

### JavaScript 前端

```javascript
// 更新資料
const updateData = async (userId, data) => {
    const response = await fetch(`/api/users/${userId}/data`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    return await response.json();
};

// 查詢資料
const getUserData = async (userId) => {
    const response = await fetch(`/api/users/${userId}/data`);
    return await response.json();
};
```

## 🧪 測試

### 執行測試

```bash
# 執行完整 API 測試
python test_api.py

# 執行資料庫測試
python data_handler.py

# 初始化範例資料
python sample_data.py
```

## 🚀 部署

### 開發環境
```bash
python api_server.py  # Debug 模式，port 5000
```

### 生產環境

使用 Gunicorn：
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 api_server:app
```

使用 uWSGI：
```bash
pip install uwsgi
uwsgi --http :8000 --wsgi-file api_server.py --callable app
```

### Docker 部署

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "api_server.py"]
```

## 👩‍💻 開發指南

### 新增資料類型

1. 在 `data_handler.py` 中的 `data_mapping` 新增對應：

```python
data_mapping = {
    'leave_days': ('leave', 'days', '剩餘特休天數'),
    'new_field': ('new_type', 'unit', '新欄位描述'), 
}
```

2. 更新 API 文件和測試

### 擴展 API 功能

```python
@app.route('/api/users/<user_id>/data/<data_type>', methods=['DELETE'])
@handle_errors
def delete_user_data(user_id, data_type):
    """刪除特定類型資料"""
    # 實作刪除邏輯
    pass
```

### 資料庫遷移

如需修改資料表結構：

1. 更新 `schema.sql`
2. 建立遷移腳本
3. 更新 `init_database()` 方法

## 🔧 配置選項

### 環境變數

```bash
export DB_PATH="custom_path/user_data.db"  # 自訂資料庫路徑
export API_PORT=8000                       # 自訂 API 埠號
export API_HOST="0.0.0.0"                 # 自訂 API 主機
export DEBUG=False                         # 關閉 Debug 模式
```

### 設定檔

建立 `config.py`：
```python
import os

DATABASE_PATH = os.getenv('DB_PATH', 'user_data.db')
API_HOST = os.getenv('API_HOST', '0.0.0.0')
API_PORT = int(os.getenv('API_PORT', 5000))
DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
```

---

**版本**: 1.0.0  
**最後更新**: 2025-09-20  
**Python 版本**: 3.7+