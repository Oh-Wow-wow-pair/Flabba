# 📡 Database API 整合文件

**服務地址**: `http://localhost:5001`  
**版本**: 1.0  
**更新時間**: 2025-09-20

## 🎯 API 概述

本服務提供使用者資料管理和請假申請處理功能，支援 LLM 服務和前端的雙向整合。

## 📋 資料類型定義

### 使用者資料欄位

| 欄位名稱 | 資料類型 | 單位 | 說明 |
|---------|---------|------|------|
| `leave_days` | `number` | `days` | 剩餘特休天數 |
| `meal_allowance` | `number` | `ntd` | 剩餘餐補金額 |
| `overtime_hours` | `number` | `hours` | 累計加班時數 |
| `salary` | `number` | `ntd` | 月薪 |
| `next_bonus_date` | `string` | `YYYY-MM-DD` | 下次獎金發放日期 |

### 請假類型

| 類型代碼 | 說明 |
|---------|------|
| `annual_leave` | 特休假 |
| `sick_leave` | 病假 |
| `personal_leave` | 事假 |
| `marriage_leave` | 婚假 |
| `funeral_leave` | 喪假 |

## 🤖 LLM 服務整合

### 1. 使用者資料更新

**端點**: `POST /api/llm/callback`

**用途**: LLM 分析對話後，提取的使用者資料發送到這裡進行儲存

**請求格式**:
```json
{
    "user_id": "user001",
    "extracted_data": {
        "leave_days": 12.5,
        "meal_allowance": 1500,
        "overtime_hours": 25.0,
        "salary": 50000,
        "next_bonus_date": "2025-12-15"
    }
}
```

**回應格式**:
```json
{
    "success": true,
    "message": "Data updated successfully",
    "user_id": "user001",
    "updated_count": 3,
    "current_data": {
        "leave": {
            "value": 12.5,
            "unit": "days",
            "description": "剩餘特休天數",
            "updated_at": "2025-09-20T14:30:00"
        }
        // ... 其他資料
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

### 2. 請假申請

**端點**: `POST /api/leave/request`

**用途**: LLM 處理使用者請假需求，將申請發送到前端確認

**請求格式**:
```json
{
    "user_id": "user001",
    "leave_type": "annual_leave",
    "start_date": "2025-09-25",
    "end_date": "2025-09-26", 
    "days": 2,
    "reason": "個人事務"
}
```

**回應格式**:
```json
{
    "success": true,
    "message": "Leave request created and sent to frontend",
    "request_id": "abc12345",
    "frontend_notified": true,
    "status": "pending_frontend",
    "timestamp": "2025-09-20T14:30:00"
}
```

**流程說明**:
1. LLM 呼叫此端點建立請假申請
2. 系統生成 `request_id` 並通知前端
3. 等待前端使用者確認
4. 前端確認後自動扣除特休天數

## 🖥️ 前端整合

### 1. 查詢使用者資料

**端點**: `GET /api/frontend/users/{user_id}/data`

**查詢參數**:
- `type`: 可選，查詢特定資料類型 (`leave`, `meal`, `overtime`, `salary`, `bonus`)
- `format`: 可選，回應格式 (`detailed` 預設 | `simple`)

**範例**:
```bash
GET /api/frontend/users/user001/data
GET /api/frontend/users/user001/data?type=leave
GET /api/frontend/users/user001/data?format=simple
```

**回應格式 (detailed)**:
```json
{
    "success": true,
    "user_id": "user001",
    "data": {
        "leave": {
            "value": 12.5,
            "unit": "days", 
            "description": "剩餘特休天數",
            "updated_at": "2025-09-20T14:30:00"
        },
        "meal": {
            "value": 1500,
            "unit": "ntd",
            "description": "剩餘餐補",
            "updated_at": "2025-09-20T14:30:00"
        }
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

**回應格式 (simple)**:
```json
{
    "success": true,
    "user_id": "user001", 
    "data": {
        "leave": 12.5,
        "meal": 1500,
        "overtime": 25.0,
        "salary": 50000,
        "bonus": "2025-12-15"
    },
    "format": "simple",
    "timestamp": "2025-09-20T14:30:00"
}
```

### 2. 查詢使用者摘要

**端點**: `GET /api/frontend/users/{user_id}/summary`

**用途**: 取得格式化的使用者資訊摘要，適合在 UI 上顯示

**回應格式**:
```json
{
    "success": true,
    "user_id": "user001",
    "summary": {
        "work_status": {
            "leave_days": 12.5,
            "overtime_hours": 25.0,
            "next_bonus_date": "2025-12-15"
        },
        "financial": {
            "salary": 50000,
            "meal_allowance": 1500
        },
        "last_updated": "2025-09-20T14:30:00"
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

### 3. 查詢待處理請假申請

**端點**: `GET /api/frontend/leave/pending`

**查詢參數**:
- `user_id`: 可選，只查詢特定使用者的申請

**範例**:
```bash
GET /api/frontend/leave/pending
GET /api/frontend/leave/pending?user_id=user001
```

**回應格式**:
```json
{
    "success": true,
    "pending_requests": {
        "abc12345": {
            "request_id": "abc12345",
            "user_id": "user001",
            "leave_type": "annual_leave",
            "start_date": "2025-09-25",
            "end_date": "2025-09-26",
            "days": 2,
            "reason": "個人事務",
            "status": "pending_frontend",
            "created_at": "2025-09-20T14:30:00"
        }
    },
    "count": 1,
    "timestamp": "2025-09-20T14:30:00"
}
```

### 4. 確認/拒絕請假申請

**端點**: `POST /api/leave/confirm`

**用途**: 前端使用者確認或拒絕請假申請

**請求格式**:
```json
{
    "request_id": "abc12345",
    "approved": true,
    "message": "請假申請已處理"
}
```

**回應格式 (批准)**:
```json
{
    "success": true,
    "message": "Leave request approved and processed",
    "request_id": "abc12345",
    "user_id": "user001",
    "days_deducted": 2,
    "remaining_leave_days": 10.5,
    "database_updated": true,
    "timestamp": "2025-09-20T14:30:00"
}
```

**回應格式 (拒絕)**:
```json
{
    "success": true,
    "message": "Leave request rejected",
    "request_id": "abc12345", 
    "status": "rejected",
    "timestamp": "2025-09-20T14:30:00"
}
```

## 🔧 通用格式

### 錯誤回應

所有錯誤都會回傳統一格式：

```json
{
    "success": false,
    "error": "錯誤描述",
    "timestamp": "2025-09-20T14:30:00"
}
```

**常見錯誤碼**:
- `400`: 請求格式錯誤或缺少必要欄位
- `404`: 資源不存在 (使用者資料或請假申請)
- `500`: 伺服器內部錯誤

### 健康檢查

**端點**: `GET /health`

**回應格式**:
```json
{
    "status": "healthy",
    "service": "Database API",
    "endpoints": {
        "llm_callback": "/api/llm/callback",
        "frontend_data": "/api/frontend/users/<user_id>/data",
        "frontend_summary": "/api/frontend/users/<user_id>/summary"
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

## 🚀 整合範例

### LLM 服務範例

```python
import requests

# 更新使用者資料
def update_user_data(user_id, extracted_data):
    response = requests.post(
        'http://localhost:5001/api/llm/callback',
        json={
            'user_id': user_id,
            'extracted_data': extracted_data
        }
    )
    return response.json()

# 建立請假申請
def create_leave_request(user_id, leave_data):
    response = requests.post(
        'http://localhost:5001/api/leave/request',
        json={
            'user_id': user_id,
            'leave_type': leave_data['type'],
            'start_date': leave_data['start'],
            'end_date': leave_data['end'],
            'days': leave_data['days'],
            'reason': leave_data['reason']
        }
    )
    return response.json()
```

### 前端整合範例

```javascript
// 查詢使用者資料
async function getUserData(userId) {
    const response = await fetch(`http://localhost:5001/api/frontend/users/${userId}/summary`);
    return await response.json();
}

// 查詢待處理請假
async function getPendingLeaves() {
    const response = await fetch('http://localhost:5001/api/frontend/leave/pending');
    return await response.json();
}

// 確認請假申請
async function confirmLeave(requestId, approved) {
    const response = await fetch('http://localhost:5001/api/leave/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            request_id: requestId,
            approved: approved,
            message: approved ? '已批准' : '已拒絕'
        })
    });
    return await response.json();
}
```

## ⚠️ 注意事項

1. **資料持久性**: 使用者資料儲存在 SQLite，請假申請暫存在記憶體中
2. **並發處理**: 支援多個同時請求，但請假申請處理是序列的
3. **資料驗證**: API 會驗證必要欄位，但不會驗證業務邏輯 (如日期合理性)
4. **通知機制**: 目前請假申請的前端通知是模擬的，建議實作 WebSocket 或輪詢

## 📞 支援

- 健康檢查: `GET /health`
- 服務狀態確認: 檢查回應中的 `success` 欄位
- 日誌監控: 伺服器會記錄所有請求的詳細日誌